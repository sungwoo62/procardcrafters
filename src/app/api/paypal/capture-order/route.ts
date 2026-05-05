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
    const { paypalOrderId, supabaseOrderId } = await req.json();

    if (!paypalOrderId) {
      return NextResponse.json(
        { error: "PayPal 주문 ID가 필요합니다." },
        { status: 400 }
      );
    }

    const accessToken = await getAccessToken();

    const res = await fetch(
      `${PAYPAL_API_BASE}/v2/checkout/orders/${paypalOrderId}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("PayPal 결제 캡처 실패:", err);
      return NextResponse.json(
        { error: "결제 처리에 실패했습니다." },
        { status: 500 }
      );
    }

    const captureData = await res.json();
    const captureStatus = captureData.status; // "COMPLETED"

    // Supabase 주문 상태 업데이트
    if (supabaseOrderId) {
      const supabase = await createClient();
      await supabase
        .from("print_orders")
        .update({
          payment_status: captureStatus === "COMPLETED" ? "paid" : "pending",
          paypal_order_id: paypalOrderId,
        })
        .eq("id", supabaseOrderId);
    }

    return NextResponse.json({
      status: captureStatus,
      paypalOrderId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
