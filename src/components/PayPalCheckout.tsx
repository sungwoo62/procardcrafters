"use client";

import {
  PayPalScriptProvider,
  PayPalButtons,
  usePayPalScriptReducer,
} from "@paypal/react-paypal-js";
import { useState } from "react";

interface Props {
  orderId: string;
  amount: string;
  currency?: string;
  onSuccess?: (paypalOrderId: string) => void;
}

function CheckoutButtons({ orderId, amount, currency, onSuccess }: Props) {
  const [{ isPending }] = usePayPalScriptReducer();
  const [payError, setPayError] = useState<string | null>(null);

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-4">
        <span className="text-sm text-secondary">PayPal 로딩 중...</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {payError && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {payError}
        </div>
      )}
      <PayPalButtons
        style={{ layout: "vertical", color: "gold", shape: "rect", label: "pay" }}
        createOrder={async () => {
          setPayError(null);
          const res = await fetch("/api/paypal/create-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount, currency, orderId }),
          });
          const data = await res.json();
          if (!res.ok || !data.id) {
            throw new Error(data.error ?? "주문 생성 실패");
          }
          return data.id as string;
        }}
        onApprove={async (data) => {
          const res = await fetch("/api/paypal/capture-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              paypalOrderId: data.orderID,
              supabaseOrderId: orderId,
            }),
          });
          const result = await res.json();
          if (!res.ok) {
            setPayError(result.error ?? "결제 처리 실패");
            return;
          }
          if (result.status === "COMPLETED") {
            onSuccess?.(data.orderID);
          }
        }}
        onError={(err) => {
          console.error("PayPal 오류:", err);
          setPayError("PayPal 결제 중 오류가 발생했습니다. 다시 시도해주세요.");
        }}
      />
    </div>
  );
}

export default function PayPalCheckout(props: Props) {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

  if (!clientId) {
    return null;
  }

  return (
    <PayPalScriptProvider
      options={{
        clientId,
        currency: props.currency ?? "USD",
        intent: "capture",
      }}
    >
      <CheckoutButtons {...props} />
    </PayPalScriptProvider>
  );
}
