import { describe, it, expect, vi } from "vitest";
import { processInboundEmail, type InboundEmail, type ProcessDeps } from "../inbox";
import { createFakeRepo, type FakeState } from "./fakeRepo";

type Row = Record<string, unknown>;
const firstRow = (m: Map<string, Row>): Row => [...m.values()][0] as Row;

function makeEmail(over: Partial<InboundEmail> = {}): InboundEmail {
  return {
    messageId: "msg-1",
    fromEmail: "jane@example.com",
    fromName: "Jane Doe",
    subject: "Question about business cards",
    bodyText: "Hi, what paper options do you offer and how fast is turnaround?",
    bodyHtml: null,
    receivedAt: "2026-06-09T00:00:00Z",
    ...over,
  };
}

const goodAi = async () => ({
  draftText: "Hi Jane,\n\nThanks for reaching out! We offer several paper options...\n\nThe Team",
  model: "mock-model",
  needsHuman: false,
  reason: null,
  confidence: 0.92,
});

function baseDeps(over: Partial<ProcessDeps> = {}): {
  deps: ProcessDeps;
  sendEmail: ReturnType<typeof vi.fn>;
  sendTelegram: ReturnType<typeof vi.fn>;
  state: FakeState;
} {
  const { repo, state } = createFakeRepo();
  const sendEmail = vi.fn(async () => ({ ok: true }));
  const sendTelegram = vi.fn(async () => ({ ok: true }));
  const deps: ProcessDeps = {
    repo,
    generateDraft: goodAi,
    sendEmail,
    sendTelegram,
    config: { approvalThreshold: 10, autosendEnabled: false },
    ...over,
  };
  return { deps, sendEmail, sendTelegram, state };
}

describe("processInboundEmail (E2E 파이프라인)", () => {
  it("기본(autosend off): 초안 큐 적재 + 알림, 발송 안 함", async () => {
    const { deps, sendEmail, sendTelegram, state } = baseDeps();
    const r = await processInboundEmail(makeEmail(), deps);

    expect(r.status).toBe("queued");
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendTelegram).toHaveBeenCalledOnce();
    // 스레드 + 인바운드 메시지 + pending 초안 생성됨
    expect(state.threads.size).toBe(1);
    const inbound = [...state.messages.values()].filter((m) => m.direction === "inbound");
    expect(inbound).toHaveLength(1);
    const draft = firstRow(state.drafts);
    expect(draft.status).toBe("pending");
    expect(draft.draft_text).toContain("Thanks for reaching out");
  });

  it("autosend on + 임계 초과: 자동 발송 + outbound 적재", async () => {
    const { repo } = createFakeRepo({ sentCount: 10 }); // 이미 10건 발송됨
    const sendEmail = vi.fn(async () => ({ ok: true }));
    const sendTelegram = vi.fn(async () => ({ ok: true }));
    const r = await processInboundEmail(makeEmail(), {
      repo,
      generateDraft: goodAi,
      sendEmail,
      sendTelegram,
      config: { approvalThreshold: 10, autosendEnabled: true },
    });

    expect(r.status).toBe("auto_sent");
    expect(sendEmail).toHaveBeenCalledOnce();
    const firstCallArg = (sendEmail.mock.calls[0] as unknown as [{ to: string }])[0];
    expect(firstCallArg.to).toBe("jane@example.com");
  });

  it("autosend on but 임계 미달(첫 N건): 승인 큐로 보류", async () => {
    const { repo } = createFakeRepo({ sentCount: 3 });
    const sendEmail = vi.fn(async () => ({ ok: true }));
    const r = await processInboundEmail(makeEmail(), {
      repo,
      generateDraft: goodAi,
      sendEmail,
      sendTelegram: async () => ({ ok: true }),
      config: { approvalThreshold: 10, autosendEnabled: true },
    });
    expect(r.status).toBe("queued");
    expect(r.reason).toBe("below_approval_threshold");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("환불 키워드: autosend 켜져 있어도 무조건 에스컬레이션", async () => {
    const { repo } = createFakeRepo({ sentCount: 50 });
    const sendEmail = vi.fn(async () => ({ ok: true }));
    const sendTelegram = vi.fn(async () => ({ ok: true }));
    const r = await processInboundEmail(
      makeEmail({ subject: "Refund", bodyText: "I want a refund, my order never arrived." }),
      {
        repo,
        generateDraft: goodAi,
        sendEmail,
        sendTelegram,
        config: { approvalThreshold: 10, autosendEnabled: true },
      }
    );
    expect(r.status).toBe("escalated");
    expect(r.escalate).toBe(true);
    expect(r.escalationReason).toContain("Refund");
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendTelegram).toHaveBeenCalledOnce();
  });

  it("AI 초안 null(키 없음): 에스컬레이션 + 플레이스홀더 초안", async () => {
    const { deps, state } = baseDeps({
      generateDraft: async () => ({
        draftText: null,
        model: "claude-haiku-4-5",
        needsHuman: true,
        reason: "ANTHROPIC_API_KEY not configured — routed to human",
        confidence: null,
      }),
    });
    const r = await processInboundEmail(makeEmail(), deps);
    expect(r.status).toBe("escalated");
    const draft = firstRow(state.drafts);
    expect(draft.draft_text).toContain("human reply required");
  });

  it("중복 message_id: 멱등 처리(duplicate)", async () => {
    const { deps, state } = baseDeps();
    await processInboundEmail(makeEmail(), deps);
    const before = state.drafts.size;
    const r2 = await processInboundEmail(makeEmail(), deps); // 동일 messageId
    expect(r2.status).toBe("duplicate");
    expect(state.drafts.size).toBe(before); // 새 초안 생성 안 됨
  });

  it("자동발송 중 메일 실패: failed 처리 + send_failed 반환", async () => {
    const { repo } = createFakeRepo({ sentCount: 20 });
    const r = await processInboundEmail(makeEmail(), {
      repo,
      generateDraft: goodAi,
      sendEmail: async () => ({ ok: false, error: "resend_500" }),
      sendTelegram: async () => ({ ok: true }),
      config: { approvalThreshold: 10, autosendEnabled: true },
    });
    expect(r.status).toBe("send_failed");
    expect(r.reason).toBe("resend_500");
  });
});
