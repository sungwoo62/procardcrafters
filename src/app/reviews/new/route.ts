// /reviews/new?order={signedToken} — OMO-2423
//
// D+7 / D+14 메일 CTA 진입점. 서명 토큰을 검증하고 source(paid/beta_tester)를 기록한 뒤
// 리뷰 작성 페이지로 redirect.
//
// 리뷰 작성 UI(OMO-2408)가 아직 머지되지 않은 경우, /reviews로 fallback 후
// ?welcome=token-ok 메시지로 사용자에게 "곧 열립니다" 안내를 보낸다.

import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { verifyReviewToken } from "@/lib/email";

export const dynamic = "force-dynamic";

function getServiceSupabase() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function generateReviewToken(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let t = "";
  for (let i = 0; i < 24; i++) t += chars[Math.floor(Math.random() * chars.length)];
  return t;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const signed = url.searchParams.get("order");
  if (!signed) {
    return NextResponse.redirect(new URL("/reviews?error=missing", url.origin));
  }

  const verified = verifyReviewToken(signed);
  if (!verified) {
    return NextResponse.redirect(new URL("/reviews?error=expired", url.origin));
  }

  const supabase = getServiceSupabase();
  const { data: order } = await supabase
    .from("print_orders")
    .select("id, review_token, is_complimentary, review_request_source")
    .eq("id", verified.orderId)
    .maybeSingle();

  if (!order) {
    return NextResponse.redirect(new URL("/reviews?error=unknown", url.origin));
  }

  let reviewToken = order.review_token as string | null;
  if (!reviewToken) {
    reviewToken = generateReviewToken();
    await supabase
      .from("print_orders")
      .update({ review_token: reviewToken })
      .eq("id", order.id);
  }

  // source 자동 결정 — 어드민 승인 시 disclosure 자동 적용 (OMO-2408 흐름)
  if (!order.review_request_source) {
    const source = order.is_complimentary ? "beta_tester" : "paid";
    await supabase
      .from("print_orders")
      .update({ review_request_source: source })
      .eq("id", order.id);
  }

  return NextResponse.redirect(
    new URL(`/reviews?token=${encodeURIComponent(reviewToken)}`, url.origin)
  );
}
