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

    // [보안] 소유권 검증: create-order 시 연결된 paypal_order_id와 일치해야 캡처 허용
    if (supabaseOrderId) {
      const supabase = await createClient();
      const { data: orderRecord } = await supabase
        .from("print_orders")
        .select("id, payment_status, paypal_order_id")
        .eq("id", supabaseOrderId)
        .single();

      if (!orderRecord) {
        return NextResponse.json(
          { error: "주문을 찾을 수 없습니다." },
          { status: 404 }
        );
      }

      if (orderRecord.payment_status === "paid") {
        return NextResponse.json(
          { error: "이미 결제가 완료된 주문입니다." },
          { status: 409 }
        );
      }

      if (orderRecord.paypal_order_id !== paypalOrderId) {
        return NextResponse.json(
          { error: "결제 정보가 일치하지 않습니다." },
          { status: 403 }
        );
      }
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
