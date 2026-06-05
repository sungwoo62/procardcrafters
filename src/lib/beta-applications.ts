import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const APP_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "fulfilled",
  "reviewed",
  "expired",
] as const;

export type BetaAppStatus = (typeof APP_STATUSES)[number];

export const BETA_APP_STATUSES = APP_STATUSES;

export const ADMIN_TAB_STATUSES = [
  "pending",
  "approved",
  "fulfilled",
  "rejected",
] as const satisfies readonly BetaAppStatus[];

export type AdminTabStatus = (typeof ADMIN_TAB_STATUSES)[number];

export interface BetaApplicationRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  shipping_address: Record<string, unknown>;
  channel: string | null;
  channel_handle: string | null;
  preferred_sku: string;
  use_case: string | null;
  review_commitment: boolean;
  disclosure_acknowledged: boolean;
  status: BetaAppStatus;
  rejected_reason: string | null;
  approved_at: string | null;
  fulfilled_order_id: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  created_at: string;
}

export function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL 환경변수가 필요합니다.",
    );
  }
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export const SKU_LABELS: Record<string, string> = {
  "business-cards": "명함",
  flyers: "전단",
  postcards: "엽서",
  "eco-stickers": "친환경 스티커",
};

export const CHANNEL_LABELS: Record<string, string> = {
  instagram: "Instagram",
  threads: "Threads",
  twitter: "X (Twitter)",
  disquiet: "디스콰이엇",
  dbcut: "디비컷",
  business: "소상공인 협찬",
  network: "지인 네트워크",
  other: "기타",
};
