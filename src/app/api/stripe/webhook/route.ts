import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// 웹훅은 쿠키 세션 없이 서버-서버 호출이므로 직접 클라이언트 생성
function getSupabase() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// App Router는 body를 자동 파싱하지 않으므로 raw body 직접 읽기
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json(
      { error: "Webhook 서명 정보가 없습니다." },
      { status: 400 }
    );
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Webhook 서명 검증 실패";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabase = getSupabase();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;

      if (orderId) {
        await supabase
          .from("print_orders")
          .update({
            payment_status: "paid",
            stripe_session_id: session.id,
          })
          .eq("id", orderId)
          .eq("stripe_session_id", session.id);
      }
      break;
    }

    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;

      if (orderId) {
        // 만료된 세션 — 재결제 가능하도록 stripe_session_id 초기화
        await supabase
          .from("print_orders")
          .update({ stripe_session_id: null })
          .eq("id", orderId)
          .eq("payment_status", "unpaid");
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
