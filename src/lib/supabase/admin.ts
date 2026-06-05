import { createClient } from "@supabase/supabase-js";

// 서버사이드 전용 — service_role 키로 RLS 우회
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY 미설정");
  return createClient(url, key, { auth: { persistSession: false } });
}
