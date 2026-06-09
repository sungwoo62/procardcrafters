// OMO-2774: 인바운드 지원 메일 처리 파이프라인 (오케스트레이션)
//
// 흐름: 멱등성 체크 → 스레드 upsert → 인바운드 적재 → 휴리스틱 분류 + AI 초안 →
//       가드레일(첫 N건 승인 모드 + 고관여 에스컬레이션)로 자동발송/큐 결정 →
//       자동발송이면 Resend 발송 + outbound 적재, 아니면 초안 큐 + Telegram 알림.
//
// 모든 외부 의존(DB/AI/메일/텔레그램)을 주입받아 테스트 가능하게 설계.

import { classifyInbound, reasonsToText } from "./classify";
import { generateDraft as defaultGenerateDraft, type DraftInput, type DraftResult } from "./ai";
import { sendTelegram as defaultSendTelegram } from "./telegram";
import { PCCF_SUPPORT_EMAIL, PCCF_SITE_URL } from "./context";

// ── 도메인 타입 ────────────────────────────────────────────────
export interface InboundEmail {
  messageId: string | null;
  fromEmail: string;
  fromName?: string | null;
  subject: string;
  bodyText: string;
  bodyHtml?: string | null;
  receivedAt?: string | null;
}

export interface ThreadRow {
  id: string;
  from_email: string;
  status: string;
  message_count: number;
}

export interface DraftRow {
  id: string;
  status: string;
}

export type ProcessStatus = "duplicate" | "auto_sent" | "queued" | "escalated" | "send_failed";

export interface ProcessResult {
  status: ProcessStatus;
  threadId?: string;
  draftId?: string;
  escalate?: boolean;
  escalationReason?: string | null;
  autosendEligible?: boolean;
  reason?: string;
}

// ── 저장소 인터페이스 (실DB / 테스트 fake 공용) ────────────────
export interface SupportRepo {
  findMessageByMessageId(messageId: string): Promise<{ id: string } | null>;
  findOpenThreadByEmail(email: string): Promise<ThreadRow | null>;
  createThread(input: {
    from_email: string;
    from_name: string | null;
    subject: string | null;
  }): Promise<ThreadRow>;
  insertInboundMessage(input: {
    thread_id: string;
    message_id: string | null;
    from_email: string;
    to_email: string;
    subject: string;
    body_text: string;
    body_html: string | null;
    received_at: string | null;
  }): Promise<{ id: string }>;
  insertOutboundMessage(input: {
    thread_id: string;
    from_email: string;
    to_email: string;
    subject: string;
    body_text: string;
    ai_generated: boolean;
  }): Promise<{ id: string }>;
  countSentDrafts(): Promise<number>;
  insertDraft(input: {
    thread_id: string;
    inbound_message_id: string;
    status: string;
    draft_subject: string | null;
    draft_text: string;
    ai_model: string;
    confidence: number | null;
    escalate: boolean;
    escalation_reason: string | null;
  }): Promise<DraftRow>;
  updateThread(
    id: string,
    patch: Partial<{
      status: string;
      escalated: boolean;
      escalation_reason: string | null;
      last_inbound_at: string;
      last_outbound_at: string;
      message_count: number;
    }>
  ): Promise<void>;
  updateDraft(
    id: string,
    patch: Partial<{ status: string; sent_at: string; send_error: string }>
  ): Promise<void>;
}

export type SendEmailFn = (input: {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}) => Promise<{ ok: boolean; error?: string }>;

export interface ProcessConfig {
  /** 첫 N건은 무조건 승인 큐 (오발송 방지). 기본 10 */
  approvalThreshold: number;
  /** 자동발송 마스터 스위치. 기본 false (MVP 안전: 전부 승인 큐) */
  autosendEnabled: boolean;
}

export interface ProcessDeps {
  repo: SupportRepo;
  generateDraft?: (input: DraftInput) => Promise<DraftResult>;
  sendEmail: SendEmailFn;
  sendTelegram?: (text: string) => Promise<{ ok: boolean }>;
  config: ProcessConfig;
}

function replySubject(subject: string): string {
  const s = (subject || "").trim();
  if (!s) return "Re: Your inquiry";
  return /^re:/i.test(s) ? s : `Re: ${s}`;
}

export async function processInboundEmail(
  email: InboundEmail,
  deps: ProcessDeps
): Promise<ProcessResult> {
  const generate = deps.generateDraft ?? ((i: DraftInput) => defaultGenerateDraft(i));
  const notify = deps.sendTelegram ?? ((t: string) => defaultSendTelegram(t));
  const now = email.receivedAt ?? new Date().toISOString();

  // 1) 멱등성
  if (email.messageId) {
    const existing = await deps.repo.findMessageByMessageId(email.messageId);
    if (existing) return { status: "duplicate", reason: "message_id already processed" };
  }

  // 2) 스레드 upsert
  let thread = await deps.repo.findOpenThreadByEmail(email.fromEmail);
  if (!thread) {
    thread = await deps.repo.createThread({
      from_email: email.fromEmail,
      from_name: email.fromName ?? null,
      subject: email.subject ?? null,
    });
  }

  // 3) 인바운드 적재
  const inbound = await deps.repo.insertInboundMessage({
    thread_id: thread.id,
    message_id: email.messageId,
    from_email: email.fromEmail,
    to_email: PCCF_SUPPORT_EMAIL,
    subject: email.subject,
    body_text: email.bodyText,
    body_html: email.bodyHtml ?? null,
    received_at: now,
  });
  await deps.repo.updateThread(thread.id, {
    last_inbound_at: now,
    message_count: (thread.message_count ?? 0) + 1,
  });

  // 4) 휴리스틱 분류 + AI 초안
  const heuristic = classifyInbound(email.subject, email.bodyText);
  const ai = await generate({
    fromName: email.fromName,
    subject: email.subject,
    body: email.bodyText,
  });

  const escalate = heuristic.escalate || ai.needsHuman || ai.draftText === null;
  const escalationReason =
    [
      heuristic.escalate ? `policy:${reasonsToText(heuristic.reasons)}` : "",
      ai.needsHuman || ai.draftText === null ? `ai:${ai.reason ?? "flagged"}` : "",
    ]
      .filter(Boolean)
      .join(" | ") || null;

  // 5) 가드레일: 자동발송 자격
  const sentCount = await deps.repo.countSentDrafts();
  const belowThreshold = sentCount < deps.config.approvalThreshold;
  const autosendEligible =
    deps.config.autosendEnabled && !escalate && !belowThreshold && ai.draftText !== null;

  const draftText = ai.draftText ?? "(No AI draft generated — human reply required.)";
  const draftSubject = replySubject(email.subject);

  // 6) 초안 큐 적재
  const draft = await deps.repo.insertDraft({
    thread_id: thread.id,
    inbound_message_id: inbound.id,
    status: autosendEligible ? "auto_sent" : "pending",
    draft_subject: draftSubject,
    draft_text: draftText,
    ai_model: ai.model,
    confidence: ai.confidence,
    escalate,
    escalation_reason: escalationReason,
  });

  // 7) 자동발송 경로
  if (autosendEligible) {
    const sent = await deps.sendEmail({
      to: email.fromEmail,
      subject: draftSubject,
      text: draftText,
      replyTo: PCCF_SUPPORT_EMAIL,
    });
    if (!sent.ok) {
      await deps.repo.updateDraft(draft.id, {
        status: "failed",
        send_error: sent.error ?? "send_failed",
      });
      // 발송 실패 → 사람 검토로 강등 + 알림
      await deps.repo.updateThread(thread.id, { status: "waiting" });
      await notify(
        `⚠️ PCCF auto-send FAILED for ${email.fromEmail}\nDraft ${draft.id} needs manual send.\nError: ${sent.error ?? "?"}`
      );
      return {
        status: "send_failed",
        threadId: thread.id,
        draftId: draft.id,
        reason: sent.error,
      };
    }
    await deps.repo.insertOutboundMessage({
      thread_id: thread.id,
      from_email: PCCF_SUPPORT_EMAIL,
      to_email: email.fromEmail,
      subject: draftSubject,
      body_text: draftText,
      ai_generated: true,
    });
    await deps.repo.updateDraft(draft.id, { status: "auto_sent", sent_at: now });
    await deps.repo.updateThread(thread.id, { last_outbound_at: now, status: "waiting" });
    return { status: "auto_sent", threadId: thread.id, draftId: draft.id, autosendEligible: true };
  }

  // 8) 승인 큐 / 에스컬레이션 경로
  if (escalate) {
    await deps.repo.updateThread(thread.id, {
      status: "escalated",
      escalated: true,
      escalation_reason: escalationReason,
    });
    await notify(
      `🚩 PCCF support escalation\nFrom: ${email.fromName ?? ""} <${email.fromEmail}>\nSubject: ${email.subject}\nReason: ${escalationReason}\nReview: ${PCCF_SITE_URL}/admin/support`
    );
    return {
      status: "escalated",
      threadId: thread.id,
      draftId: draft.id,
      escalate: true,
      escalationReason,
    };
  }

  // 승인 모드(첫 N건 또는 autosend off): 초안 대기 + 알림
  await deps.repo.updateThread(thread.id, { status: "waiting" });
  await notify(
    `📝 PCCF AI draft ready for review\nFrom: ${email.fromEmail}\nSubject: ${email.subject}\nApprove: ${PCCF_SITE_URL}/admin/support`
  );
  return {
    status: "queued",
    threadId: thread.id,
    draftId: draft.id,
    autosendEligible: false,
    reason: belowThreshold ? "below_approval_threshold" : "autosend_disabled",
  };
}
