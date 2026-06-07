import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// [환경 호환] 프로덕션은 PAYPAL_API_URL/PAYPAL_SECRET/NEXT_PUBLIC_PAYPAL_CLIENT_ID 네이밍을 사용.
// 명시적 PAYPAL_API_URL 이 있으면 우선 사용하고, 없으면 PAYPAL_ENV 로 모드 결정.
const PAYPAL_API_BASE = (() => {
  const explicit = process.env.PAYPAL_API_URL?.trim();
  if (explicit && /^https?:\/\//.test(explicit)) {
    return explicit.replace(/\/$/, "");
  }
  return process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
})();

async function getAccessToken(): Promise<string> {
  const clientId =
    process.env.PAYPAL_CLIENT_ID ?? process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET ?? process.env.PAYPAL_SECRET;

  if (!clientId || !secret) {
    throw new Error("PayPal 자격증명이 설정되지 않았습니다.");
  }

  const credentials = Buffer.from(`${clientId}:${secret}`).toString("base64");
  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    throw new Error("PayPal 액세스 토큰 획득 실패");
  }

  const data = await res.json();
  return data.access_token as string;
}

export async function POST(req: NextRequest) {
  try {
    // [보안] 금액은 클라이언트 입력을 신뢰하지 않는다. orderId 필수.
    const { currency = "USD", orderId } = await req.json();

    if (!orderId) {
      return NextResponse.json(
        { error: "주문 ID가 필요합니다." },
        { status: 400 }
      );
    }

    // [보안] 서버측 금액 바인딩: print_orders.total_amount 를 권위 있는 값으로 사용
    const supabase = await createClient();
    const { data: ord } = await supabase
      .from("print_orders")
      .select("id, total_amount, payment_status, is_complimentary")
      .eq("id", orderId)
      .single();

    if (!ord) {
      return NextResponse.json(
        { error: "주문을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 무상 주문이거나 이미 결제 대상이 아닌 경우 결제 생성 거부
    if (ord.is_complimentary || ord.payment_status !== "unpaid") {
      return NextResponse.json(
        { error: "결제 대상 주문이 아닙니다." },
        { status: 409 }
      );
    }

    if (!(Number(ord.total_amount) > 0)) {
      return NextResponse.json(
        { error: "유효하지 않은 결제 금액입니다." },
        { status: 400 }
      );
    }

    const value = Number(ord.total_amount).toFixed(2);

    const accessToken = await getAccessToken();

    const orderPayload = {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: orderId,
          description: "Procardcrafters 인쇄 주문",
          amount: {
            currency_code: currency,
            value,
          },
        },
      ],
      application_context: {
        brand_name: "Procardcrafters",
        locale: "en-US",
        landing_page: "NO_PREFERENCE",
        user_action: "PAY_NOW",
      },
    };

    const res = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        // [F] 멱등성: 동일 주문에 대한 중복 PayPal 주문 생성 방지
        "PayPal-Request-Id": `pcc-create-${orderId}`,
      },
      body: JSON.stringify(orderPayload),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("PayPal 주문 생성 실패:", err);
      return NextResponse.json(
        { error: "PayPal 주문 생성에 실패했습니다." },
        { status: 500 }
      );
    }

    const order = await res.json();

    // [보안] PayPal 주문 ID를 print_orders에 저장하여 캡처 시 소유권 검증에 사용
    await supabase
      .from("print_orders")
      .update({ paypal_order_id: order.id })
      .eq("id", orderId)
      .eq("payment_status", "unpaid");

    return NextResponse.json({ id: order.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
