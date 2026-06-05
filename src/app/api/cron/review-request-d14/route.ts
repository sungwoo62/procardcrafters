// D+14 리뷰 요청 리마인더 cron — OMO-2423 (OMO-2411 #3)
//
// D+7 메일 발송 후 7일 경과 + 리뷰 미작성(또는 print_reviews 테이블 부재) + 리마인더 미발송
// 분에 대해 1회 발송. 1주문 합계 메일 2회 한도.

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
  review_request_sent_at: string;
  print_order_items: { product_name_ko: string | null }[] | null;
};

function pickProductLabel(order: CandidateOrder): string {
  const items = order.print_order_items ?? [];
  const first = items.find((i) => i.product_name_ko)?.product_name_ko;
  if (!first) return "주문하신 제품";
  if (items.length > 1) return `${first} 외 ${items.length - 1}건`;
  return first;
}

async function runD14Cron() {
  const supabase = getServiceSupabase();
  const sevenDaysAgoIso = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: orders, error } = await supabase
    .from("print_orders")
    .select(
      "id, order_number, customer_name, customer_email, is_complimentary, review_request_sent_at, print_order_items(product_name_ko)"
    )
    .lte("review_request_sent_at", sevenDaysAgoIso)
    .is("review_request_reminder_sent_at", null)
    .not("status", "in", "(cancelled)")
    .not("customer_email", "is", null)
    .order("review_request_sent_at", { ascending: true })
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

  // 이미 리뷰가 있는 주문은 reminder 발송 차단.
  // print_reviews 테이블이 아직 없는 경우(OMO-2408 미머지)에도 graceful 동작.
  const orderIds = candidates.map((o) => o.id);
  let respondedOrderIds = new Set<string>();
  if (orderIds.length > 0) {
    const { data: reviews } = await supabase
      .from("print_reviews")
      .select("order_id")
      .in("order_id", orderIds);
    if (reviews) {
      respondedOrderIds = new Set(
        reviews.map((r) => r.order_id).filter(Boolean) as string[]
      );
    }
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const order of candidates) {
    if (respondedOrderIds.has(order.id)) {
      await supabase
        .from("print_orders")
        .update({
          review_request_reminder_sent_at: new Date().toISOString(),
        })
        .eq("id", order.id)
        .is("review_request_reminder_sent_at", null);
      skipped += 1;
      continue;
    }

    const result = await sendReviewRequestEmail({
      orderId: order.id,
      orderNumber: order.order_number,
      customerName: order.customer_name,
      customerEmail: order.customer_email!,
      productLabel: pickProductLabel(order),
      isComplimentary: !!order.is_complimentary,
      isReminder: true,
    });

    if (result.ok) {
      await supabase
        .from("print_orders")
        .update({
          review_request_reminder_sent_at: new Date().toISOString(),
        })
        .eq("id", order.id)
        .is("review_request_reminder_sent_at", null);
      sent += 1;
    } else if (result.reason === "opt_out" || result.reason === "no_email") {
      await supabase
        .from("print_orders")
        .update({
          review_request_reminder_sent_at: new Date().toISOString(),
        })
        .eq("id", order.id)
        .is("review_request_reminder_sent_at", null);
      skipped += 1;
    } else {
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
  const result = await runD14Cron();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export async function GET(req: Request) {
  return POST(req);
}
