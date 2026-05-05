"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { submitQuote } from "./actions";

const PayPalCheckout = dynamic(
  () => import("@/components/PayPalCheckout"),
  { ssr: false }
);

// 데모용 기본 보증금 금액 (실제 운영 시 견적에 따라 동적으로 변경)
const DEPOSIT_AMOUNT = "50.00";

export default function QuoteForm({
  defaultProduct,
}: {
  defaultProduct?: string;
}) {
  const [submitted, setSubmitted] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = await submitQuote(formData);

    setPending(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSubmitted(true);
      setOrderId(result.orderId ?? null);
    }
  }

  if (submitted) {
    return (
      <div className="mt-10 space-y-6">
        <div className="rounded-xl border border-border bg-bg-light p-8 text-center">
          <p className="text-lg font-semibold text-text">
            Thank you for your inquiry!
          </p>
          <p className="mt-2 text-sm text-secondary">
            We&apos;ll review your request and get back to you within 24 hours.
          </p>
        </div>

        {!paid && orderId && (
          <div className="rounded-xl border border-border bg-bg-light p-6">
            <p className="mb-1 text-sm font-semibold text-text">
              Optional: Pay a ${DEPOSIT_AMOUNT} Deposit
            </p>
            <p className="mb-4 text-xs text-secondary">
              Secure your order slot with a deposit. The remainder will be invoiced after we finalize your quote.
            </p>
            <PayPalCheckout
              orderId={orderId}
              amount={DEPOSIT_AMOUNT}
              currency="USD"
              onSuccess={() => setPaid(true)}
            />
          </div>
        )}

        {paid && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
            <p className="text-sm font-semibold text-green-800">
              Deposit received — your order is confirmed!
            </p>
            <p className="mt-1 text-xs text-green-700">
              We&apos;ll contact you shortly to finalize your order details.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-10 space-y-5">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-text">
          Full Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          className="mt-1.5 w-full rounded-lg border border-border px-4 py-2.5 text-sm text-text placeholder:text-secondary/50 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
          placeholder="John Smith"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-text">
          Email Address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="mt-1.5 w-full rounded-lg border border-border px-4 py-2.5 text-sm text-text placeholder:text-secondary/50 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
          placeholder="john@example.com"
        />
      </div>

      <div>
        <label
          htmlFor="product"
          className="block text-sm font-medium text-text"
        >
          Product
        </label>
        <input
          id="product"
          name="product"
          type="text"
          defaultValue={defaultProduct ?? ""}
          className="mt-1.5 w-full rounded-lg border border-border px-4 py-2.5 text-sm text-text placeholder:text-secondary/50 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
          placeholder="e.g. Standard Business Cards"
        />
      </div>

      <div>
        <label
          htmlFor="quantity"
          className="block text-sm font-medium text-text"
        >
          Quantity
        </label>
        <input
          id="quantity"
          name="quantity"
          type="number"
          min={1}
          className="mt-1.5 w-full rounded-lg border border-border px-4 py-2.5 text-sm text-text placeholder:text-secondary/50 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
          placeholder="500"
        />
      </div>

      <div>
        <label
          htmlFor="message"
          className="block text-sm font-medium text-text"
        >
          Message
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          className="mt-1.5 w-full rounded-lg border border-border px-4 py-2.5 text-sm text-text placeholder:text-secondary/50 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none resize-none"
          placeholder="Tell us about your project — size, material preferences, deadline, etc."
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50 transition-colors"
      >
        {pending ? "Submitting..." : "Submit Quote Request"}
      </button>
    </form>
  );
}
