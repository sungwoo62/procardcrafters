"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/admin-auth";
import {
  getServiceSupabase,
  type BetaApplicationRow,
} from "@/lib/beta-applications";

const PCC_SITE = "procardcrafters";

export type ApproveActionResult =
  | { ok: true; orderId: string }
  | { ok: false; error: string };

export async function approveBetaApplication(
  id: string,
): Promise<ApproveActionResult> {
  if (!(await isAdmin())) return { ok: false, error: "Unauthorized" };
  if (!id) return { ok: false, error: "ID 가 필요합니다." };

  const supabase = getServiceSupabase();

  const { data: app, error: fetchErr } = await supabase
    .from("print_beta_applications")
    .select("*")
    .eq("id", id)
    .maybeSingle<BetaApplicationRow>();

  if (fetchErr || !app) {
    return { ok: false, error: "신청을 찾을 수 없습니다." };
  }
  if (app.status === "fulfilled") {
    return { ok: false, error: "이미 처리된 신청입니다." };
  }
  if (app.status === "rejected" || app.status === "expired") {
    return { ok: false, error: `현재 상태(${app.status})에서는 승인할 수 없습니다.` };
  }
  if (!app.review_commitment || !app.disclosure_acknowledged) {
    return { ok: false, error: "동의 게이트 미충족 — 승인 불가." };
  }

  const { data: order, error: insertErr } = await supabase
    .from("print_orders")
    .insert({
      site: PCC_SITE,
      status: "pending",
      payment_status: "comp",
      total_amount: 0,
      promo_discount: 0,
      coupon_discount: 0,
      is_complimentary: true,
      complimentary_application_id: app.id,
      customer_name: app.name,
      customer_email: app.email,
      shipping_address: app.shipping_address ?? {},
      notes: `OMO-2422 베타 무상 주문 — 신청 ${app.id} / SKU ${app.preferred_sku}`,
    })
    .select("id")
    .single();

  if (insertErr || !order) {
    return {
      ok: false,
      error: `주문 생성 실패: ${insertErr?.message ?? "알 수 없는 오류"}`,
    };
  }

  const { error: updateErr } = await supabase
    .from("print_beta_applications")
    .update({
      status: "fulfilled",
      approved_at: new Date().toISOString(),
      fulfilled_order_id: order.id,
      rejected_reason: null,
    })
    .eq("id", app.id)
    .in("status", ["pending", "approved"]);

  if (updateErr) {
    await supabase.from("print_orders").delete().eq("id", order.id);
    return {
      ok: false,
      error: `신청 상태 업데이트 실패: ${updateErr.message}`,
    };
  }

  revalidatePath("/admin/beta-applications");
  return { ok: true, orderId: order.id };
}

export type RejectActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function rejectBetaApplication(
  id: string,
  reason: string,
): Promise<RejectActionResult> {
  if (!(await isAdmin())) return { ok: false, error: "Unauthorized" };

  const trimmed = (reason ?? "").trim();
  if (!trimmed) return { ok: false, error: "반려 사유는 필수입니다." };
  if (trimmed.length > 1000) {
    return { ok: false, error: "반려 사유는 1000자 이내로 입력하세요." };
  }

  const supabase = getServiceSupabase();
  const { data: app, error: fetchErr } = await supabase
    .from("print_beta_applications")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr || !app) return { ok: false, error: "신청을 찾을 수 없습니다." };
  if (app.status === "fulfilled") {
    return { ok: false, error: "이미 발송된 신청은 반려할 수 없습니다." };
  }

  const { error: updateErr } = await supabase
    .from("print_beta_applications")
    .update({
      status: "rejected",
      rejected_reason: trimmed,
    })
    .eq("id", id)
    .neq("status", "fulfilled");

  if (updateErr) {
    return { ok: false, error: `상태 업데이트 실패: ${updateErr.message}` };
  }

  revalidatePath("/admin/beta-applications");
  return { ok: true };
}
