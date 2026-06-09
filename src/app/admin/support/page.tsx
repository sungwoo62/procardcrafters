import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { approveDraftAction, rejectDraftAction, resolveThreadAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Support Inbox — Admin" };

interface DraftView {
  id: string;
  thread_id: string;
  status: string;
  draft_subject: string | null;
  draft_text: string;
  ai_model: string | null;
  confidence: number | null;
  escalate: boolean;
  escalation_reason: string | null;
  created_at: string;
  from_email: string | null;
  from_name: string | null;
  inbound_text: string | null;
}

async function fetchPendingDrafts(): Promise<DraftView[]> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("pccf_support_drafts")
    .select(
      "id, thread_id, status, draft_subject, draft_text, ai_model, confidence, escalate, escalation_reason, created_at, inbound_message_id, " +
        "pccf_support_threads(from_email, from_name)"
    )
    .in("status", ["pending"])
    .order("escalate", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(100);
  if (error || !data) {
    console.error("[admin/support] fetch failed", error);
    return [];
  }

  const rows = data as unknown as Record<string, unknown>[];

  // 인바운드 본문 별도 조회
  const inboundIds = rows.map((d) => d.inbound_message_id).filter(Boolean) as string[];
  const inboundMap = new Map<string, string>();
  if (inboundIds.length) {
    const { data: msgs } = await sb
      .from("pccf_support_messages")
      .select("id, body_text")
      .in("id", inboundIds);
    for (const m of msgs ?? []) inboundMap.set(m.id as string, (m.body_text as string) ?? "");
  }

  return rows.map((d) => {
    const thread = (d.pccf_support_threads ?? {}) as Record<string, unknown>;
    return {
      id: d.id as string,
      thread_id: d.thread_id as string,
      status: d.status as string,
      draft_subject: d.draft_subject as string | null,
      draft_text: d.draft_text as string,
      ai_model: d.ai_model as string | null,
      confidence: d.confidence as number | null,
      escalate: d.escalate as boolean,
      escalation_reason: d.escalation_reason as string | null,
      created_at: d.created_at as string,
      from_email: (thread.from_email as string | null) ?? null,
      from_name: (thread.from_name as string | null) ?? null,
      inbound_text: inboundMap.get(d.inbound_message_id as string) ?? null,
    };
  });
}

export default async function SupportInboxPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  const drafts = await fetchPendingDrafts();

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold">Support Inbox — AI 1차 회신 승인 큐</h1>
      <p className="mb-6 text-sm text-gray-500">
        대기 중 초안 {drafts.length}건. 🚩 = 에스컬레이션(고관여/AI 불확실). 승인 시 고객에게 발송됩니다.
      </p>

      {drafts.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-gray-400">
          대기 중인 초안이 없습니다.
        </div>
      )}

      <ul className="space-y-6">
        {drafts.map((d) => (
          <li key={d.id} className="rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <span className="font-semibold">
                  {d.escalate ? "🚩 " : ""}
                  {d.from_name ? `${d.from_name} ` : ""}
                  <span className="text-gray-500">&lt;{d.from_email}&gt;</span>
                </span>
                {d.escalation_reason && (
                  <span className="ml-2 rounded bg-red-50 px-2 py-0.5 text-xs text-red-600">
                    {d.escalation_reason}
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-400">
                {d.ai_model}
                {d.confidence != null ? ` · conf ${d.confidence}` : ""}
              </span>
            </div>

            <details className="mb-3">
              <summary className="cursor-pointer text-sm text-gray-600">고객 원문 보기</summary>
              <pre className="mt-2 whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs text-gray-700">
                {d.inbound_text ?? "(본문 없음)"}
              </pre>
            </details>

            <form action={approveDraftAction} className="space-y-3">
              <input type="hidden" name="draftId" value={d.id} />
              <div className="text-xs font-medium text-gray-500">
                회신 제목: {d.draft_subject}
              </div>
              <textarea
                name="editedText"
                defaultValue={d.draft_text}
                rows={8}
                className="w-full rounded-lg border border-gray-300 p-3 text-sm font-mono"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                >
                  승인 & 발송
                </button>
                <button
                  type="submit"
                  formAction={rejectDraftAction}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  반려
                </button>
                <button
                  type="submit"
                  formAction={resolveThreadAction}
                  name="threadId"
                  value={d.thread_id}
                  className="ml-auto rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-400 hover:bg-gray-50"
                >
                  스레드 종료
                </button>
              </div>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
