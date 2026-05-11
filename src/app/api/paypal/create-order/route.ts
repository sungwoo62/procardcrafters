import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const PAYPAL_API_BASE =
  process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

async function getAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;

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
    const { amount, currency = "USD", orderId } = await req.json();

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return NextResponse.json(
        { error: "유효하지 않은 금액입니다." },
        { status: 400 }
      );
    }

    const accessToken = await getAccessToken();

    const orderPayload = {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: orderId ?? `pcc-${Date.now()}`,
          description: "Procardcrafters 인쇄 주문",
          amount: {
            currency_code: currency,
            value: Number(amount).toFixed(2),
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
    if (orderId) {
      const supabase = await createClient();
      await supabase
        .from("print_orders")
        .update({ paypal_order_id: order.id })
        .eq("id", orderId)
        .eq("payment_status", "unpaid");
    }

    return NextResponse.json({ id: order.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
