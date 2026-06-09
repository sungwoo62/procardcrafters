// OMO-2774: 테스트용 인메모리 SupportRepo
import type { SupportRepo, ThreadRow, DraftRow } from "../inbox";

type Row = Record<string, unknown>;

let seq = 0;
const id = (p: string) => `${p}_${++seq}`;

export interface FakeState {
  threads: Map<string, Row>;
  messages: Map<string, Row>;
  drafts: Map<string, Row>;
}

export function createFakeRepo(opts: { sentCount?: number } = {}): {
  repo: SupportRepo;
  state: FakeState;
} {
  const state: FakeState = {
    threads: new Map(),
    messages: new Map(),
    drafts: new Map(),
  };
  const baseSent = opts.sentCount ?? 0;

  const repo: SupportRepo = {
    async findMessageByMessageId(messageId) {
      for (const m of state.messages.values()) {
        if (m.message_id === messageId) return { id: m.id as string };
      }
      return null;
    },
    async findOpenThreadByEmail(email) {
      for (const t of state.threads.values()) {
        if (
          t.status !== "resolved" &&
          String(t.from_email).toLowerCase() === email.toLowerCase()
        ) {
          return t as unknown as ThreadRow;
        }
      }
      return null;
    },
    async createThread(input) {
      const t: Row = {
        id: id("thread"),
        from_email: input.from_email,
        from_name: input.from_name,
        subject: input.subject,
        status: "open",
        escalated: false,
        message_count: 0,
      };
      state.threads.set(t.id as string, t);
      return t as unknown as ThreadRow;
    },
    async insertInboundMessage(input) {
      const m: Row = { id: id("msg"), direction: "inbound", ...input };
      state.messages.set(m.id as string, m);
      return { id: m.id as string };
    },
    async insertOutboundMessage(input) {
      const m: Row = { id: id("msg"), direction: "outbound", ...input };
      state.messages.set(m.id as string, m);
      return { id: m.id as string };
    },
    async countSentDrafts() {
      let c = baseSent;
      for (const d of state.drafts.values()) {
        if (d.status === "sent" || d.status === "auto_sent") c++;
      }
      return c;
    },
    async insertDraft(input) {
      const d: Row = { id: id("draft"), ...input };
      state.drafts.set(d.id as string, d);
      return d as unknown as DraftRow;
    },
    async updateThread(tid, patch) {
      const t = state.threads.get(tid);
      if (t) Object.assign(t, patch);
    },
    async updateDraft(did, patch) {
      const d = state.drafts.get(did);
      if (d) Object.assign(d, patch);
    },
  };

  return { repo, state };
}
