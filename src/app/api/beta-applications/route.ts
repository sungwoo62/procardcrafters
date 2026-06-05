// POST /api/beta-applications (OMO-2421)
// 베타 테스터 신청 접수 → print_beta_applications INSERT → confirmation 이메일 발송

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendBetaConfirmation } from "@/lib/email";
import { sendCapiEvent, extractClientSignals } from "@/lib/meta-capi";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://procardcrafters.com";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_SKUS = new Set([
  "business-cards",
  "flyers",
  "postcards",
  "eco-stickers",
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ApplicationInput = {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  shipping_address?: unknown;
  channel?: unknown;
  channel_handle?: unknown;
  preferred_sku?: unknown;
  use_case?: unknown;
  review_commitment?: unknown;
  disclosure_acknowledged?: unknown;
  utm_source?: unknown;
  utm_medium?: unknown;
  utm_campaign?: unknown;
  utm_term?: unknown;
  utm_content?: unknown;
  /** 픽셀과 dedup용 UUID — 클라이언트 fbq('track','Lead',...,{eventID}) 와 동일 값 */
  event_id?: unknown;
};

function asString(v: unknown, max = 500): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

function asJsonObject(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return {};
}

export async function POST(req: NextRequest) {
  let body: ApplicationInput;
  try {
    body = (await req.json()) as ApplicationInput;
  } catch {
    return NextResponse.json(
      { error: "잘못된 요청 형식입니다." },
      { status: 400 }
    );
  }

  const name = asString(body.name, 120);
  const emailRaw = asString(body.email, 254);
  const email = emailRaw?.toLowerCase() ?? null;
  const preferredSku = asString(body.preferred_sku, 50);
  const reviewCommitment = body.review_commitment === true;
  const disclosureAcknowledged = body.disclosure_acknowledged === true;

  // 필수 검증
  if (!name) {
    return NextResponse.json({ error: "이름을 입력해 주세요." }, { status: 400 });
  }
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "올바른 이메일 주소를 입력해 주세요." },
      { status: 400 }
    );
  }
  if (!preferredSku || !ALLOWED_SKUS.has(preferredSku)) {
    return NextResponse.json(
      { error: "관심 품목을 선택해 주세요." },
      { status: 400 }
    );
  }
  if (!reviewCommitment) {
    return NextResponse.json(
      { error: "7일 이내 리뷰 작성 동의가 필요합니다." },
      { status: 400 }
    );
  }
  if (!disclosureAcknowledged) {
    return NextResponse.json(
      { error: "FTC §255.5 무료 제공 표기 동의가 필요합니다." },
      { status: 400 }
    );
  }

  const phone = asString(body.phone, 50);
  const channel = asString(body.channel, 50);
  const channelHandle = asString(body.channel_handle, 200);
  const useCase = asString(body.use_case, 1000);
  const shippingAddress = asJsonObject(body.shipping_address);

  const utm = {
    utm_source: asString(body.utm_source, 200),
    utm_medium: asString(body.utm_medium, 200),
    utm_campaign: asString(body.utm_campaign, 200),
    utm_term: asString(body.utm_term, 200),
    utm_content: asString(body.utm_content, 200),
  };

  const supabase = await createClient();

  // 중복 이메일 사전 체크 — DB unique index 가 최종 방어선이지만
  // 한국어 에러 메시지를 위해 사전 조회로 분기
  const { data: existing } = await supabase
    .from("print_beta_applications")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "이미 동일한 이메일로 신청이 접수되어 있습니다." },
      { status: 409 }
    );
  }

  const { data: inserted, error: insertError } = await supabase
    .from("print_beta_applications")
    .insert({
      name,
      email,
      phone,
      shipping_address: shippingAddress,
      channel,
      channel_handle: channelHandle,
      preferred_sku: preferredSku,
      use_case: useCase,
      review_commitment: reviewCommitment,
      disclosure_acknowledged: disclosureAcknowledged,
      status: "pending",
      ...utm,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    // unique 위반 race condition 처리
    if (insertError?.code === "23505") {
      return NextResponse.json(
        { error: "이미 동일한 이메일로 신청이 접수되어 있습니다." },
        { status: 409 }
      );
    }
    console.error("[beta-applications] INSERT 실패", insertError);
    return NextResponse.json(
      { error: "신청 저장에 실패했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 }
    );
  }

  // confirmation 이메일은 best-effort: 실패해도 신청은 성공으로 응답
  const mail = await sendBetaConfirmation({
    to: email,
    name,
    preferredSku,
  });

  // Meta CAPI Lead 이벤트 (OMO-2427) — best-effort, 응답 차단 금지
  const rawEventId = asString(body.event_id, 64);
  const eventId =
    rawEventId && UUID_RE.test(rawEventId) ? rawEventId : crypto.randomUUID();
  const signals = extractClientSignals(req.headers);
  const capi = await sendCapiEvent({
    eventName: "Lead",
    eventId,
    eventSourceUrl: `${SITE_URL}/beta-tester`,
    userData: {
      email,
      phone,
      clientIp: signals.ip,
      userAgent: signals.userAgent,
      fbp: signals.fbp,
      fbc: signals.fbc,
    },
    customData: {
      content_name: "beta_tester_landing",
      channel: channel ?? undefined,
      preferred_sku: preferredSku,
      utm_source: utm.utm_source ?? undefined,
      utm_medium: utm.utm_medium ?? undefined,
      utm_campaign: utm.utm_campaign ?? undefined,
      utm_term: utm.utm_term ?? undefined,
      utm_content: utm.utm_content ?? undefined,
      currency: "USD",
      value: 0,
    },
  });
  if (!capi.ok) {
    console.error("[beta-applications] CAPI Lead 실패", capi.reason);
  }

  return NextResponse.json(
    {
      ok: true,
      id: inserted.id,
      emailSent: mail.ok,
      eventId,
    },
    { status: 201 }
  );
}
