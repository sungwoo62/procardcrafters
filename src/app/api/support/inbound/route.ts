// POST /api/support/inbound (OMO-2774)
// Resend(또는 Postmark 호환) 인바운드 메일 webhook → AI 1차 회신 파이프라인.
//
// 인증: 공유 시크릿. 헤더 x-pccf-inbound-secret 또는 ?secret= 가
//       env PCCF_INBOUND_SECRET 와 일치해야 함. (env 미설정 시 fail-closed)
//
// 환경변수:
//   PCCF_INBOUND_SECRET             — webhook 공유 시크릿 (필수)
//   PCCF_SUPPORT_AUTOSEND           — "true" 면 자동발송 활성 (기본 false: 전부 승인 큐)
//   PCCF_SUPPORT_APPROVAL_THRESHOLD — 첫 N건 강제 승인 (기본 10)

import { NextRequest, NextResponse } from "next/server";
import { sendSupportReplyEmail } from "@/lib/email";
import { createSupabaseSupportRepo } from "@/lib/support/repo";
import { processInboundEmail, type InboundEmail } from "@/lib/support/inbox";

export const dynamic = "force-dynamic";

type Json = Record<string, unknown>;

function asObj(v: unknown): Json | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : null;
}
function firstStr(...vals: unknown[]): string {
  for (const v of vals) if (typeof v === "string" && v) return v;
  return "";
}

/** Resend/Postmark 등 다양한 인바운드 payload 를 공통 형태로 정규화 */
export function parseInboundPayload(raw: unknown): InboundEmail | null {
  const b = asObj(raw);
  if (!b) return null;
  // Resend 는 { type, data: {...} } 래핑일 수 있음
  const d = asObj(b.data) ?? b;

  const fromRaw = d.from ?? d.From ?? d.sender ?? "";
  let fromEmail = "";
  let fromName: string | null = null;
  if (typeof fromRaw === "string") {
    fromEmail = (fromRaw.match(/<([^>]+)>/)?.[1] ?? fromRaw).trim();
    fromName = fromRaw.match(/^\s*"?([^"<]+?)"?\s*</)?.[1]?.trim() ?? null;
  } else {
    const f = asObj(fromRaw);
    if (f) {
      fromEmail = firstStr(f.email, f.address);
      fromName = typeof f.name === "string" ? f.name : null;
    }
  }
  if (!fromEmail) return null;

  const headers = asObj(d.headers);
  const messageId = firstStr(
    d.message_id,
    d.messageId,
    d.MessageID,
    d["message-id"],
    headers?.["message-id"]
  );

  return {
    messageId: messageId || null,
    fromEmail,
    fromName,
    subject: firstStr(d.subject, d.Subject),
    bodyText: firstStr(d.text, d.TextBody, d.plain, d.body),
    bodyHtml: typeof d.html === "string" ? d.html : typeof d.HtmlBody === "string" ? d.HtmlBody : null,
    receivedAt: firstStr(d.created_at, d.received_at, d.Date) || null,
  };
}

function authorized(req: NextRequest): boolean {
  const expected = process.env.PCCF_INBOUND_SECRET;
  if (!expected) return false; // fail-closed
  const header = req.headers.get("x-pccf-inbound-secret");
  const query = new URL(req.url).searchParams.get("secret");
  return header === expected || query === expected;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const email = parseInboundPayload(raw);
  if (!email) {
    return NextResponse.json({ error: "unparseable_payload" }, { status: 400 });
  }

  const config = {
    autosendEnabled: process.env.PCCF_SUPPORT_AUTOSEND === "true",
    approvalThreshold: Number(process.env.PCCF_SUPPORT_APPROVAL_THRESHOLD ?? "10") || 10,
  };

  try {
    const result = await processInboundEmail(email, {
      repo: createSupabaseSupportRepo(),
      sendEmail: (input) => sendSupportReplyEmail(input),
      config,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[support/inbound] pipeline failed", e);
    return NextResponse.json(
      { error: "pipeline_failed", detail: (e as Error).message },
      { status: 500 }
    );
  }
}
