"use server";

// OMO-2774: 지원 초안 승인 큐 서버 액션
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { PCCF_SUPPORT_EMAIL } from "@/lib/support/context";

async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}

/** 초안 승인 → 고객에게 발송 → outbound 적재 → draft sent 처리 */
export async function approveDraftAction(formData: FormData) {
  await requireAdmin();
  const draftId = String(formData.get("draftId") ?? "");
  // 관리자가 편집한 본문이 있으면 그것을 사용
  const editedText = String(formData.get("editedText") ?? "").trim();
  if (!draftId) return;

  const sb = createAdminClient();
  const { data: draft, error } = await sb
    .from("pccf_support_drafts")
    .select("id, thread_id, draft_subject, draft_text, status")
    .eq("id", draftId)
    .single();
  if (error || !draft) return;
  if (draft.status === "sent" || draft.status === "auto_sent") {
    revalidatePath("/admin/support");
    return;
  }

  const { data: thread } = await sb
    .from("pccf_support_threads")
    .select("id, from_email")
    .eq("id", draft.thread_id)
    .single();
  if (!thread?.from_email) return;

  const finalText = editedText || (draft.draft_text as string);
  const subject = (draft.draft_subject as string) || "Re: Your inquiry";

  const sent = await sendEmail({
    to: thread.from_email as string,
    subject,
    html: finalText.replace(/\n/g, "<br/>"),
    text: finalText,
    replyTo: PCCF_SUPPORT_EMAIL,
  });

  if (!sent.ok) {
    await sb
      .from("pccf_support_drafts")
      .update({ status: "failed", send_error: sent.error ?? "send_failed" })
      .eq("id", draftId);
    revalidatePath("/admin/support");
    return;
  }

  const now = new Date().toISOString();
  await sb.from("pccf_support_messages").insert({
    thread_id: draft.thread_id,
    direction: "outbound",
    from_email: PCCF_SUPPORT_EMAIL,
    to_email: thread.from_email,
    subject,
    body_text: finalText,
    ai_generated: !editedText,
  });
  await sb
    .from("pccf_support_drafts")
    .update({ status: "sent", sent_at: now, draft_text: finalText })
    .eq("id", draftId);
  await sb
    .from("pccf_support_threads")
    .update({ status: "waiting", last_outbound_at: now })
    .eq("id", draft.thread_id);

  revalidatePath("/admin/support");
}

/** 초안 반려 (발송 안 함) */
export async function rejectDraftAction(formData: FormData) {
  await requireAdmin();
  const draftId = String(formData.get("draftId") ?? "");
  if (!draftId) return;
  const sb = createAdminClient();
  await sb.from("pccf_support_drafts").update({ status: "rejected" }).eq("id", draftId);
  revalidatePath("/admin/support");
}

/** 스레드 종료 */
export async function resolveThreadAction(formData: FormData) {
  await requireAdmin();
  const threadId = String(formData.get("threadId") ?? "");
  if (!threadId) return;
  const sb = createAdminClient();
  await sb.from("pccf_support_threads").update({ status: "resolved" }).eq("id", threadId);
  revalidatePath("/admin/support");
}
