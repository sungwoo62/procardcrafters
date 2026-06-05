// D+7 리뷰 요청 메일 cron — OMO-2423 (OMO-2411 #3)
//
// 매일 1회 실행. 7일 전 배송된 주문 중 리뷰 요청 메일 미발송 분에 대해 발송:
//   * is_complimentary=FALSE → "review_request_paid" 변형
//   * is_complimentary=TRUE  → "review_request_beta" 변형 (FTC disclosure 자동)
//
// 멱등성: print_orders.review_request_sent_at으로 1주문 1회 보장.
// 인증: Vercel cron의 Authorization: Bearer ${CRON_SECRET} 또는 ADMIN_TOKEN.

import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { sendReviewRequestEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH_LIMIT = 100;

function getServiceSupabase() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function isAuthorized(req: Request): boolean {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  const token = auth.slice("Bearer ".length).trim();
  return (
    (!!process.env.CRON_SECRET && token === process.env.CRON_SECRET) ||
    (!!process.env.ADMIN_TOKEN && token === process.env.ADMIN_TOKEN)
  );
}

type CandidateOrder = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string | null;
  is_complimentary: boolean;
  shipped_at: string;
  print_order_items: { product_name_ko: string | null }[] | null;
};

function pickProductLabel(order: CandidateOrder): string {
  const items = order.print_order_items ?? [];
  const first = items.find((i) => i.product_name_ko)?.product_name_ko;
  if (!first) return "주문하신 제품";
  if (items.length > 1) return `${first} 외 ${items.length - 1}건`;
  return first;
}

async function runD7Cron() {
  const supabase = getServiceSupabase();
  const sevenDaysAgoIso = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: orders, error } = await supabase
    .from("print_orders")
    .select(
      "id, order_number, customer_name, customer_email, is_complimentary, shipped_at, print_order_items(product_name_ko)"
    )
    .lte("shipped_at", sevenDaysAgoIso)
    .is("review_request_sent_at", null)
    .not("status", "in", "(cancelled)")
    .not("customer_email", "is", null)
    .order("shipped_at", { ascending: true })
    .limit(BATCH_LIMIT);

  if (error) {
    return {
      ok: false as const,
      error: error.message,
      processed: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
    };
  }

  const candidates = (orders ?? []) as CandidateOrder[];
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const order of candidates) {
    const result = await sendReviewRequestEmail({
      orderId: order.id,
      orderNumber: order.order_number,
      customerName: order.customer_name,
      customerEmail: order.customer_email!,
      productLabel: pickProductLabel(order),
      isComplimentary: !!order.is_complimentary,
      isReminder: false,
    });

    if (result.ok) {
      await supabase
        .from("print_orders")
        .update({ review_request_sent_at: new Date().toISOString() })
        .eq("id", order.id)
        .is("review_request_sent_at", null);
      sent += 1;
    } else if (result.reason === "opt_out" || result.reason === "no_email") {
      // 영구 skip — sent_at 기록해서 재시도 차단
      await supabase
        .from("print_orders")
        .update({ review_request_sent_at: new Date().toISOString() })
        .eq("id", order.id)
        .is("review_request_sent_at", null);
      skipped += 1;
    } else {
      // resend_error / config_missing — sent_at 미기록, 다음 day 재시도
      failed += 1;
    }
  }

  return {
    ok: true as const,
    processed: candidates.length,
    sent,
    skipped,
    failed,
    batchLimit: BATCH_LIMIT,
    cutoff: sevenDaysAgoIso,
  };
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "인증 실패" }, { status: 401 });
  }
  const result = await runD7Cron();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export async function GET(req: Request) {
  return POST(req);
}
