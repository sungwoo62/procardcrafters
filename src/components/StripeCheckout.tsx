"use client";

import { useState } from "react";

interface Props {
  orderId: string;
  amount: string;
  currency?: string;
  productName?: string;
  className?: string;
}

export default function StripeCheckout({
  orderId,
  amount,
  currency = "USD",
  productName,
  className,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    return null;
  }

  async function handleCheckout() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, currency, orderId, productName }),
      });

      const data = await res.json();

      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "결제 세션 생성 실패");
      }

      window.location.href = data.url;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "결제 중 오류가 발생했습니다."
      );
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <button
        onClick={handleCheckout}
        disabled={loading}
        className={
          className ??
          "w-full rounded-lg bg-[#635bff] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#5248e0] disabled:opacity-60"
        }
      >
        {loading ? "이동 중..." : "카드로 결제 (Stripe)"}
      </button>
    </div>
  );
}
