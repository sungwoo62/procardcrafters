/**
 * OMO-2774 E2E 데모 — 실제 키/DB 없이 파이프라인 전 구간을 추적 출력.
 * 실행:  npx tsx scripts/support-e2e-demo.mts
 *
 * 인메모리 fake repo + 목 AI/메일/텔레그램으로, 인바운드 메일 1건이
 * (a) 일반 문의 → 승인 큐, (b) 환불 문의 → 에스컬레이션, (c) autosend → 자동발송
 * 으로 흐르는지 콘솔에 보여준다. (livewire는 ANTHROPIC/Resend/Telegram 키 필요)
 */
import { processInboundEmail, type InboundEmail } from "../src/lib/support/inbox.ts";
import { createFakeRepo } from "../src/lib/support/__tests__/fakeRepo.ts";

const mockAi = async (i: { fromName?: string | null; subject: string; body: string }) => ({
  draftText: `Hi ${i.fromName ?? "there"},\n\nThanks for reaching out to ProCardCrafters! ${i.subject.includes("turnaround") || i.body.includes("turnaround") ? "Our standard production turnaround is 3–5 business days (plus shipping). " : ""}You can see full specs and transparent pricing at https://procardcrafters.com/products. Let me know if I can help further!\n\nBest regards,\nThe ProCardCrafters Team`,
  model: "mock-haiku",
  needsHuman: false,
  reason: null,
  confidence: 0.9,
});

function banner(t: string) {
  console.log("\n" + "═".repeat(64) + `\n  ${t}\n` + "═".repeat(64));
}

async function scenario(
  title: string,
  email: InboundEmail,
  cfg: { autosendEnabled: boolean; approvalThreshold: number; sentCount: number }
) {
  banner(title);
  const { repo, state } = createFakeRepo({ sentCount: cfg.sentCount });
  const sent: unknown[] = [];
  const tg: string[] = [];
  const res = await processInboundEmail(email, {
    repo,
    generateDraft: mockAi,
    sendEmail: async (x) => {
      sent.push(x);
      return { ok: true };
    },
    sendTelegram: async (t) => {
      tg.push(t);
      return { ok: true };
    },
    config: { autosendEnabled: cfg.autosendEnabled, approvalThreshold: cfg.approvalThreshold },
  });

  console.log(`📨 inbound: "${email.subject}" from ${email.fromEmail}`);
  console.log(`⚙️  config: autosend=${cfg.autosendEnabled} threshold=${cfg.approvalThreshold} priorSent=${cfg.sentCount}`);
  console.log(`➡️  RESULT status = ${res.status}` + (res.reason ? ` (${res.reason})` : ""));
  const draft = [...state.drafts.values()][0] as Record<string, unknown> | undefined;
  if (draft) {
    console.log(`   draft.status=${draft.status} escalate=${draft.escalate} reason=${draft.escalation_reason ?? "-"}`);
    console.log(`   draft.text  → ${String(draft.draft_text).split("\n")[0]} …`);
  }
  console.log(`   emails sent: ${sent.length}, telegram alerts: ${tg.length}`);
  if (tg[0]) console.log(`   telegram[0]: ${tg[0].split("\n")[0]}`);
}

const base = (over: Partial<InboundEmail>): InboundEmail => ({
  messageId: `m-${Math.round(performance.now())}-${over.subject}`,
  fromEmail: "jane@example.com",
  fromName: "Jane Doe",
  subject: "",
  bodyText: "",
  bodyHtml: null,
  receivedAt: "2026-06-09T00:00:00Z",
  ...over,
});

await scenario(
  "A) 일반 제품 문의 — 첫 N건 승인 모드(autosend OFF) → 승인 큐",
  base({ subject: "Business card turnaround?", bodyText: "How fast is turnaround for 250 matte cards?" }),
  { autosendEnabled: false, approvalThreshold: 10, sentCount: 0 }
);

await scenario(
  "B) 환불 문의 — autosend ON 이어도 무조건 에스컬레이션",
  base({ subject: "Refund request", bodyText: "I want a refund, my order never arrived." }),
  { autosendEnabled: true, approvalThreshold: 10, sentCount: 50 }
);

await scenario(
  "C) 일반 문의 + autosend ON + 임계 초과 → AI 자동 발송",
  base({ subject: "Do you print flyers?", bodyText: "Hi, do you offer A5 flyers and what stock?" }),
  { autosendEnabled: true, approvalThreshold: 10, sentCount: 25 }
);

console.log("\n✅ E2E demo complete — 인바운드→AI초안→(승인큐/에스컬레이션/자동발송) 전 구간 동작 확인\n");
