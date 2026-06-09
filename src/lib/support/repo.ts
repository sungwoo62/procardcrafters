// OMO-2774: SupportRepo 의 Supabase(service_role) 구현체
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupportRepo, ThreadRow, DraftRow } from "./inbox";

type Sb = ReturnType<typeof createAdminClient>;

export function createSupabaseSupportRepo(client?: Sb): SupportRepo {
  const sb = client ?? createAdminClient();

  return {
    async findMessageByMessageId(messageId) {
      const { data } = await sb
        .from("pccf_support_messages")
        .select("id")
        .eq("message_id", messageId)
        .maybeSingle();
      return data ? { id: data.id as string } : null;
    },

    async findOpenThreadByEmail(email) {
      const { data } = await sb
        .from("pccf_support_threads")
        .select("id, from_email, status, message_count")
        .neq("status", "resolved")
        .ilike("from_email", email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data as ThreadRow) ?? null;
    },

    async createThread(input) {
      const { data, error } = await sb
        .from("pccf_support_threads")
        .insert({
          from_email: input.from_email,
          from_name: input.from_name,
          subject: input.subject,
          status: "open",
        })
        .select("id, from_email, status, message_count")
        .single();
      if (error) {
        // 경합으로 unique 충돌 시 기존 스레드 재조회
        const { data: existing } = await sb
          .from("pccf_support_threads")
          .select("id, from_email, status, message_count")
          .neq("status", "resolved")
          .ilike("from_email", input.from_email)
          .limit(1)
          .maybeSingle();
        if (existing) return existing as ThreadRow;
        throw error;
      }
      return data as ThreadRow;
    },

    async insertInboundMessage(input) {
      const { data, error } = await sb
        .from("pccf_support_messages")
        .insert({ ...input, direction: "inbound" })
        .select("id")
        .single();
      if (error) throw error;
      return { id: data.id as string };
    },

    async insertOutboundMessage(input) {
      const { data, error } = await sb
        .from("pccf_support_messages")
        .insert({ ...input, direction: "outbound" })
        .select("id")
        .single();
      if (error) throw error;
      return { id: data.id as string };
    },

    async countSentDrafts() {
      const { count } = await sb
        .from("pccf_support_drafts")
        .select("id", { count: "exact", head: true })
        .in("status", ["sent", "auto_sent"]);
      return count ?? 0;
    },

    async insertDraft(input) {
      const { data, error } = await sb
        .from("pccf_support_drafts")
        .insert(input)
        .select("id, status")
        .single();
      if (error) throw error;
      return data as DraftRow;
    },

    async updateThread(id, patch) {
      await sb.from("pccf_support_threads").update(patch).eq("id", id);
    },

    async updateDraft(id, patch) {
      await sb.from("pccf_support_drafts").update(patch).eq("id", id);
    },
  };
}
