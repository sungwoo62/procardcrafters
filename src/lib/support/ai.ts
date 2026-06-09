// OMO-2774: AI 1차 회신 초안 생성 (Anthropic Messages API, REST 직접 호출)
//
// SDK 의존성 없이 fetch 로 호출 (email.ts 의 Resend 패턴과 동일).
// 환경변수:
//   ANTHROPIC_API_KEY     — 없으면 draft=null 반환 → 파이프라인이 사람 검토로 보냄(안전)
//   PCCF_SUPPORT_MODEL     — 기본 "claude-haiku-4-5"
//
// AI는 JSON 으로 응답하도록 강제한다:
//   { "reply": "...", "needs_human": bool, "reason": "...", "confidence": 0~1 }

import { PCCF_KNOWLEDGE_BASE, PCCF_REPLY_SIGNATURE } from "./context";

const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-haiku-4-5";

export interface DraftInput {
  fromName?: string | null;
  subject: string;
  body: string;
}

export interface DraftResult {
  /** AI 초안 본문. 키 미설정/실패/거부 시 null → 사람 검토 필수 */
  draftText: string | null;
  model: string;
  /** AI 자가 판단: 사람 검토 필요 */
  needsHuman: boolean;
  reason: string | null;
  confidence: number | null;
}

// 테스트를 위해 fetch 주입 가능
export type FetchFn = typeof fetch;

const SYSTEM_PROMPT = `You are the first-line customer support assistant for ProCardCrafters, a US print-on-demand company. You draft the FIRST email reply to inbound customer inquiries.

Use ONLY the facts in the KNOWLEDGE BASE below. Never invent prices, exact ship dates, discounts, or policies that are not stated. If the customer asks something you cannot answer from the knowledge base, or the inquiry is sensitive/high-stakes (refunds, chargebacks, legal, bulk/wholesale, complaints), set needs_human=true and keep the reply minimal and safe (acknowledge + promise a teammate will follow up).

Write in professional, warm, concise American English. Address the customer by name if available. Do not include a subject line in the reply body. Do not include the signature block (it is appended automatically).

KNOWLEDGE BASE:
${PCCF_KNOWLEDGE_BASE}

Respond with a single JSON object and nothing else:
{"reply": string, "needs_human": boolean, "reason": string, "confidence": number}
- reply: the email body (no signature).
- needs_human: true if a human must review before sending.
- reason: short reason if needs_human is true, else "".
- confidence: 0..1, your confidence the reply fully and safely answers the inquiry.`;

function extractJson(text: string): Record<string, unknown> | null {
  // 모델이 코드펜스/잡음을 붙일 수 있으니 첫 { ... 마지막 } 추출
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * AI 초안 생성. 키가 없으면 즉시 needsHuman=true, draftText=null 로 안전 반환.
 */
export async function generateDraft(
  input: DraftInput,
  deps: { fetchFn?: FetchFn; apiKey?: string; model?: string } = {}
): Promise<DraftResult> {
  const apiKey = deps.apiKey ?? process.env.ANTHROPIC_API_KEY;
  const model = deps.model ?? process.env.PCCF_SUPPORT_MODEL ?? DEFAULT_MODEL;
  const doFetch = deps.fetchFn ?? fetch;

  if (!apiKey) {
    return {
      draftText: null,
      model,
      needsHuman: true,
      reason: "ANTHROPIC_API_KEY not configured — routed to human",
      confidence: null,
    };
  }

  const userMessage = [
    input.fromName ? `Customer name: ${input.fromName}` : "Customer name: (unknown)",
    `Subject: ${input.subject || "(no subject)"}`,
    "",
    "Customer message:",
    input.body || "(empty)",
  ].join("\n");

  let raw = "";
  try {
    const res = await doFetch(ANTHROPIC_ENDPOINT, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return {
        draftText: null,
        model,
        needsHuman: true,
        reason: `anthropic_${res.status}: ${errText.slice(0, 200)}`,
        confidence: null,
      };
    }

    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
    };
    raw = (data.content ?? [])
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("\n")
      .trim();
  } catch (e) {
    return {
      draftText: null,
      model,
      needsHuman: true,
      reason: `anthropic_request_failed: ${(e as Error).message}`,
      confidence: null,
    };
  }

  const parsed = extractJson(raw);
  if (!parsed || typeof parsed.reply !== "string" || !parsed.reply.trim()) {
    return {
      draftText: null,
      model,
      needsHuman: true,
      reason: "ai_response_unparseable",
      confidence: null,
    };
  }

  const reply = (parsed.reply as string).trim();
  const needsHuman = parsed.needs_human === true;
  const confidence =
    typeof parsed.confidence === "number" ? parsed.confidence : null;

  return {
    draftText: `${reply}\n\n${PCCF_REPLY_SIGNATURE}`,
    model,
    needsHuman,
    reason: needsHuman ? String(parsed.reason ?? "ai_flagged") : null,
    confidence,
  };
}
