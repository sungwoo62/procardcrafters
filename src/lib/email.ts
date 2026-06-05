// 이메일 발송 유틸 (OMO-2421) — Resend REST API 직접 호출, SDK 의존성 회피
// 환경변수:
//   RESEND_API_KEY  — Resend 발송 키 (없으면 console 로깅 fallback, throw 안 함)
//   BETA_FROM_EMAIL — 발신 주소 (기본 "ProCardCrafters <hello@procardcrafters.com>")

const RESEND_ENDPOINT = "https://api.resend.com/emails";

const DEFAULT_FROM =
  process.env.BETA_FROM_EMAIL ?? "ProCardCrafters <hello@procardcrafters.com>";

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
};

type SendEmailResult =
  | { ok: true; id: string | null }
  | { ok: false; error: string; skipped?: boolean };

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    // 로컬 개발 / 키 미설정 환경: 본문을 콘솔에 남기고 ok 반환해 신청 흐름은 끊지 않음
    console.warn(
      "[email] RESEND_API_KEY 미설정 — 발송 생략",
      JSON.stringify({ to: input.to, subject: input.subject })
    );
    return { ok: true, id: null };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: input.from ?? DEFAULT_FROM,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        reply_to: input.replyTo,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[email] Resend 발송 실패", res.status, errText);
      return { ok: false, error: `resend_${res.status}` };
    }

    const data = (await res.json()) as { id?: string };
    return { ok: true, id: data.id ?? null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    console.error("[email] Resend 네트워크 오류", message);
    return { ok: false, error: message };
  }
}

// --- 베타 테스터 신청 confirmation 템플릿 (OMO-2421) ---

type BetaConfirmationInput = {
  to: string;
  name: string;
  preferredSku: string;
};

const SKU_LABELS: Record<string, string> = {
  "business-cards": "명함",
  flyers: "전단지",
  postcards: "엽서",
  "eco-stickers": "친환경 스티커",
};

export async function sendBetaConfirmation(
  input: BetaConfirmationInput
): Promise<SendEmailResult> {
  const skuLabel = SKU_LABELS[input.preferredSku] ?? input.preferredSku;

  const subject = "[ProCardCrafters] 베타 테스터 신청을 받았습니다";

  const html = `<!doctype html>
<html lang="ko">
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; line-height: 1.6; max-width: 560px; margin: 0 auto; padding: 24px;">
    <h1 style="font-size: 20px; margin: 0 0 16px;">신청해 주셔서 감사합니다, ${escapeHtml(input.name)} 님</h1>
    <p>ProCardCrafters 베타 테스터 모집에 신청해 주셔서 감사합니다.</p>
    <p><strong>관심 품목:</strong> ${escapeHtml(skuLabel)}</p>
    <h2 style="font-size: 16px; margin: 24px 0 8px;">앞으로의 진행</h2>
    <ul>
      <li>7월 초까지 선정 결과를 이메일로 안내드립니다.</li>
      <li>선정되시면 무료 샘플을 한국 내 주소로 발송해 드립니다.</li>
      <li>수령 후 7일 이내에 솔직한 사용 후기를 작성해 주시면 됩니다.</li>
    </ul>
    <h2 style="font-size: 16px; margin: 24px 0 8px;">공시 안내</h2>
    <p style="font-size: 13px; color: #555;">
      베타 테스터로 선정되시면 무료 제품을 제공받게 되며, 작성하시는 리뷰에는
      미국 FTC §255.5 가이드라인에 따라 "무료 제공 받음" 표기가 자동으로 추가됩니다.
      평점이나 우호적 내용은 요구하지 않으며, 솔직한 의견을 그대로 작성해 주시면 됩니다.
    </p>
    <p style="font-size: 12px; color: #888; margin-top: 32px;">
      문의는 본 메일에 회신해 주세요. — ProCardCrafters Team
    </p>
  </body>
</html>`;

  const text = [
    `신청해 주셔서 감사합니다, ${input.name} 님`,
    ``,
    `ProCardCrafters 베타 테스터 모집에 신청해 주셔서 감사합니다.`,
    `관심 품목: ${skuLabel}`,
    ``,
    `앞으로의 진행:`,
    `- 7월 초까지 선정 결과를 이메일로 안내드립니다.`,
    `- 선정되시면 무료 샘플을 한국 내 주소로 발송해 드립니다.`,
    `- 수령 후 7일 이내에 솔직한 사용 후기를 작성해 주시면 됩니다.`,
    ``,
    `공시 안내:`,
    `베타 테스터로 선정되시면 무료 제품을 제공받게 되며, 작성하시는 리뷰에는`,
    `미국 FTC §255.5 가이드라인에 따라 "무료 제공 받음" 표기가 자동으로 추가됩니다.`,
    `평점이나 우호적 내용은 요구하지 않으며, 솔직한 의견을 그대로 작성해 주시면 됩니다.`,
    ``,
    `— ProCardCrafters Team`,
  ].join("\n");

  return sendEmail({
    to: input.to,
    subject,
    html,
    text,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// --- D+7 / D+14 리뷰 요청 메일 (OMO-2423) ---
//
// 일반(paid) / 베타테스터(beta) 변형 2종 + 각 리마인더 변형.
// CTA URL은 HMAC-SHA256 서명 토큰(`{orderIdB64}.{exp}.{sig}`, 30일 만료)을 query로 받는다.
// 정지선:
//   - "솔직한 리뷰" 표현만 허용 ("좋은 후기"·"5점 부탁" 금지)
//   - 베타 변형은 disclosure ("무료 제공받고 작성") 명시
//   - print_email_unsubscribes 매치 시 skip + log
//   - 멱등성은 호출자가 print_orders.review_request_sent_at(또는 reminder_sent_at)로 보장

import crypto from "node:crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const REVIEW_TOKEN_TTL_DAYS = 30;
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://procardcrafters.com";

type ReviewEmailType =
  | "review_request_paid"
  | "review_request_beta"
  | "review_request_reminder_paid"
  | "review_request_reminder_beta";

export type ReviewRequestArgs = {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  productLabel: string;
  isComplimentary: boolean;
  isReminder?: boolean;
};

export type ReviewRequestResult =
  | { ok: true; resendId: string | null; emailType: ReviewEmailType }
  | {
      ok: false;
      reason: "opt_out" | "no_email" | "resend_error" | "config_missing";
      message: string;
      emailType: ReviewEmailType;
    };

function getReviewTokenSecret(): string {
  const secret = process.env.REVIEW_TOKEN_SECRET ?? process.env.ADMIN_TOKEN;
  if (!secret) {
    throw new Error(
      "REVIEW_TOKEN_SECRET(or ADMIN_TOKEN) env가 설정되지 않았습니다."
    );
  }
  return secret;
}

function base64urlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlDecode(input: string): Buffer {
  const padded =
    input.replace(/-/g, "+").replace(/_/g, "/") +
    "===".slice((input.length + 3) % 4);
  return Buffer.from(padded, "base64");
}

/** 30일 만료 HMAC 서명 토큰: `{orderIdB64}.{exp}.{sigB64}` */
export function signReviewToken(orderId: string, ttlDays = REVIEW_TOKEN_TTL_DAYS): string {
  const exp = Math.floor(Date.now() / 1000) + ttlDays * 24 * 60 * 60;
  const sig = crypto
    .createHmac("sha256", getReviewTokenSecret())
    .update(`${orderId}.${exp}`)
    .digest();
  return `${base64urlEncode(Buffer.from(orderId))}.${exp}.${base64urlEncode(sig)}`;
}

/** 서명 토큰 검증 — 성공 시 orderId, 실패 시 null (만료/변조/형식오류) */
export function verifyReviewToken(token: string): { orderId: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [orderIdB64, expStr, sigB64] = parts;
  let orderId: string;
  try {
    orderId = base64urlDecode(orderIdB64).toString("utf8");
  } catch {
    return null;
  }
  const exp = Number.parseInt(expStr, 10);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return null;
  const expected = crypto
    .createHmac("sha256", getReviewTokenSecret())
    .update(`${orderId}.${exp}`)
    .digest();
  let actual: Buffer;
  try {
    actual = base64urlDecode(sigB64);
  } catch {
    return null;
  }
  if (expected.length !== actual.length) return null;
  if (!crypto.timingSafeEqual(expected, actual)) return null;
  return { orderId };
}

function getServiceSupabase() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function isEmailUnsubscribed(email: string): Promise<boolean> {
  const supabase = getServiceSupabase();
  const { count } = await supabase
    .from("print_email_unsubscribes")
    .select("id", { count: "exact", head: true })
    .ilike("email", email);
  return (count ?? 0) > 0;
}

function pickReviewEmailType(
  isComplimentary: boolean,
  isReminder: boolean
): ReviewEmailType {
  if (isReminder) {
    return isComplimentary
      ? "review_request_reminder_beta"
      : "review_request_reminder_paid";
  }
  return isComplimentary ? "review_request_beta" : "review_request_paid";
}

function pickReviewSubject(
  emailType: ReviewEmailType,
  productLabel: string
): string {
  switch (emailType) {
    case "review_request_paid":
      return `[procardcrafters] ${productLabel} 잘 받으셨나요? $2 쿠폰 안내`;
    case "review_request_beta":
      return `[procardcrafters] 베타 테스터 리뷰 부탁드려요 — ${productLabel}`;
    case "review_request_reminder_paid":
      return `[procardcrafters] 잠깐만요 — $2 쿠폰 잊지 마세요 (${productLabel})`;
    case "review_request_reminder_beta":
      return `[procardcrafters] 베타 테스터 리뷰 한 번만 더 부탁드려요`;
  }
}

function buildReviewRequestHtml(args: {
  customerName: string;
  productLabel: string;
  orderNumber: string;
  reviewUrl: string;
  unsubscribeUrl: string;
  emailType: ReviewEmailType;
}): string {
  const isBeta =
    args.emailType === "review_request_beta" ||
    args.emailType === "review_request_reminder_beta";
  const isReminder = args.emailType.includes("reminder");

  const safeName = escapeHtml(args.customerName);
  const safeProduct = escapeHtml(args.productLabel);
  const safeOrder = escapeHtml(args.orderNumber);

  const intro = isBeta
    ? `${safeName}님, procardcrafters 베타 테스터로 ${safeProduct}를 받아주셔서 진심으로 감사합니다.`
    : `${safeName}님, ${safeProduct}(주문 ${safeOrder}) 잘 받으셨나요?`;

  const ask = isBeta
    ? "제품을 사용해보신 솔직한 리뷰를 남겨주세요. 평점·내용 무관하게 모든 리뷰를 게시합니다."
    : "솔직한 리뷰를 남겨주시면 다음 주문에 사용 가능한 $2 쿠폰을 자동으로 보내드립니다.";

  const disclosure = isBeta
    ? `<p style="font-size:13px;color:#6b7280;line-height:1.6;margin:18px 0 0">
        ※ FTC §255.5 disclosure: 베타 테스터로 무료 제품을 받고 작성하신 리뷰임을 게시 시 자동으로 표기합니다.
        평점 약속 조건 없이 솔직한 의견을 부탁드립니다.
      </p>`
    : `<p style="font-size:13px;color:#6b7280;line-height:1.6;margin:18px 0 0">
        ※ 쿠폰은 리뷰 작성 후 어드민 승인 시 자동 발급됩니다. 평점 약속이나 별점 조건은 없습니다.
      </p>`;

  const reminderNote = isReminder
    ? `<p style="font-size:14px;color:#6b7280;margin:0 0 16px">
        지난 주에 리뷰 안내를 한 번 보내드렸어요. 마지막으로 다시 한 번만 부탁드려요.
      </p>`
    : "";

  return `<!doctype html>
<html lang="ko">
  <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:40px 20px">
    <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
      <div style="background:#111827;padding:28px 32px">
        <h1 style="color:#fff;font-size:22px;margin:0;font-weight:800;letter-spacing:-0.01em">procardcrafters</h1>
      </div>
      <div style="padding:32px">
        <p style="font-size:16px;color:#111827;margin:0 0 14px;line-height:1.6">${intro}</p>
        ${reminderNote}
        <p style="font-size:15px;color:#374151;margin:0 0 24px;line-height:1.7">${ask}</p>
        <a href="${args.reviewUrl}"
           style="display:block;background:#111827;color:#fff;text-align:center;padding:14px;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px">
          리뷰 작성하기 (3분)
        </a>
        ${disclosure}
      </div>
      <div style="padding:14px 32px;background:#f3f4f6;text-align:center;font-size:12px;color:#9ca3af">
        <a href="${args.unsubscribeUrl}" style="color:#6b7280;text-decoration:underline">수신거부</a>
        · 주문 ${safeOrder}
        · procardcrafters
      </div>
    </div>
  </body>
</html>`;
}

function buildReviewRequestText(args: {
  customerName: string;
  productLabel: string;
  orderNumber: string;
  reviewUrl: string;
  unsubscribeUrl: string;
  emailType: ReviewEmailType;
}): string {
  const isBeta =
    args.emailType === "review_request_beta" ||
    args.emailType === "review_request_reminder_beta";
  const lines = [
    isBeta
      ? `${args.customerName}님, procardcrafters 베타 테스터로 ${args.productLabel}를 받아주셔서 진심으로 감사합니다.`
      : `${args.customerName}님, ${args.productLabel}(주문 ${args.orderNumber}) 잘 받으셨나요?`,
    "",
    isBeta
      ? "솔직한 리뷰를 남겨주세요. 평점·내용 무관하게 모든 리뷰를 게시합니다."
      : "솔직한 리뷰를 남겨주시면 다음 주문에 사용 가능한 $2 쿠폰을 자동으로 보내드립니다.",
    "",
    `리뷰 작성: ${args.reviewUrl}`,
    "",
    isBeta
      ? "※ FTC §255.5: 베타 테스터로 무료 제품을 받고 작성한 리뷰임을 게시 시 자동으로 표기합니다."
      : "※ 쿠폰은 리뷰 작성 후 어드민 승인 시 자동 발급됩니다.",
    "",
    `수신거부: ${args.unsubscribeUrl}`,
  ];
  return lines.join("\n");
}

/** D+7 또는 D+14 리뷰 요청 메일을 전송하고 print_marketing_email_log에 적재한다. */
export async function sendReviewRequestEmail(
  args: ReviewRequestArgs
): Promise<ReviewRequestResult> {
  const emailType = pickReviewEmailType(
    args.isComplimentary,
    args.isReminder ?? false
  );
  const supabase = getServiceSupabase();

  if (!args.customerEmail) {
    await supabase.from("print_marketing_email_log").insert({
      order_id: args.orderId,
      customer_email: "",
      email_type: emailType,
      status: "failed",
      error_message: "no_email",
    });
    return {
      ok: false,
      reason: "no_email",
      message: "이메일 주소 없음",
      emailType,
    };
  }

  if (await isEmailUnsubscribed(args.customerEmail)) {
    await supabase.from("print_marketing_email_log").insert({
      order_id: args.orderId,
      customer_email: args.customerEmail,
      email_type: emailType,
      status: "skipped_opt_out",
    });
    return {
      ok: false,
      reason: "opt_out",
      message: "수신거부 처리됨",
      emailType,
    };
  }

  if (!process.env.RESEND_API_KEY) {
    return {
      ok: false,
      reason: "config_missing",
      message: "RESEND_API_KEY 미설정",
      emailType,
    };
  }

  const signedToken = signReviewToken(args.orderId);
  const reviewUrl = `${SITE_URL}/reviews/new?order=${encodeURIComponent(signedToken)}`;
  const unsubscribeUrl = `${SITE_URL}/api/email/unsubscribe?email=${encodeURIComponent(args.customerEmail)}`;

  const subject = pickReviewSubject(emailType, args.productLabel);
  const html = buildReviewRequestHtml({
    customerName: args.customerName,
    productLabel: args.productLabel,
    orderNumber: args.orderNumber,
    reviewUrl,
    unsubscribeUrl,
    emailType,
  });
  const text = buildReviewRequestText({
    customerName: args.customerName,
    productLabel: args.productLabel,
    orderNumber: args.orderNumber,
    reviewUrl,
    unsubscribeUrl,
    emailType,
  });

  const sendResult = await sendEmail({ to: args.customerEmail, subject, html, text });

  if (!sendResult.ok) {
    await supabase.from("print_marketing_email_log").insert({
      order_id: args.orderId,
      customer_email: args.customerEmail,
      email_type: emailType,
      status: "failed",
      error_message: sendResult.error.slice(0, 500),
    });
    return {
      ok: false,
      reason: "resend_error",
      message: sendResult.error,
      emailType,
    };
  }

  await supabase.from("print_marketing_email_log").insert({
    order_id: args.orderId,
    customer_email: args.customerEmail,
    email_type: emailType,
    status: "sent",
    resend_id: sendResult.id,
    metadata: { subject, signed_token_ttl_days: REVIEW_TOKEN_TTL_DAYS },
  });

  return { ok: true, resendId: sendResult.id, emailType };
}
