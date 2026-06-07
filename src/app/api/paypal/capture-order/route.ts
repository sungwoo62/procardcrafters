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
    const { paypalOrderId, supabaseOrderId } = await req.json();

    if (!paypalOrderId) {
      return NextResponse.json(
        { error: "PayPal 주문 ID가 필요합니다." },
        { status: 400 }
      );
    }

    // [C][보안] supabaseOrderId 필수: 없으면 소유권·멱등·금액 검증 우회 가능
    if (!supabaseOrderId) {
      return NextResponse.json(
        { error: "주문 ID가 필요합니다." },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // [보안] 소유권 검증: create-order 시 연결된 paypal_order_id와 일치해야 캡처 허용
    const { data: orderRecord } = await supabase
      .from("print_orders")
      .select("id, payment_status, paypal_order_id, total_amount")
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

    // [B][보안] 캡처 금액 ↔ 주문 total_amount 대조. 불일치 시 paid 처리 금지.
    const captured =
      captureData?.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value;
    if (
      captureStatus === "COMPLETED" &&
      captured !== Number(orderRecord.total_amount).toFixed(2)
    ) {
      return NextResponse.json(
        { error: "결제 금액 불일치" },
        { status: 409 }
      );
    }

    // 캡처 미완료(PENDING 등)는 paid 처리하지 않고 상태만 반영
    if (captureStatus !== "COMPLETED") {
      await supabase
        .from("print_orders")
        .update({ paypal_order_id: paypalOrderId })
        .eq("id", supabaseOrderId)
        .eq("payment_status", "unpaid");

      return NextResponse.json({ status: captureStatus, paypalOrderId });
    }

    // [D][보안] 멱등 update guard (TOCTOU): unpaid → paid 조건부 전이
    const { data: upd } = await supabase
      .from("print_orders")
      .update({ payment_status: "paid", paypal_order_id: paypalOrderId })
      .eq("id", supabaseOrderId)
      .eq("payment_status", "unpaid")
      .select("id")
      .maybeSingle();

    // upd === null → 동시 중복 capture. 멱등 처리(중복 후처리 금지), 성공 응답만 반환.
    return NextResponse.json({
      status: captureStatus,
      paypalOrderId,
      duplicate: upd === null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
