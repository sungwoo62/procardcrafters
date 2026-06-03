"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { CheckCircle, Mail, User, Package, Hash, MessageSquare, Loader2, Lock, Star, Zap } from "lucide-react";
import { submitQuote } from "./actions";
import { trackGenerateLead, trackPurchase } from "@/lib/analytics";

const PayPalCheckout = dynamic(
  () => import("@/components/PayPalCheckout"),
  { ssr: false }
);

const DEPOSIT_AMOUNT = "50.00";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-border px-4 py-3 text-sm text-text placeholder:text-secondary/40 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:outline-none transition-shadow bg-white";

const labelClass = "flex items-center gap-1.5 text-sm font-semibold text-text";

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
      trackGenerateLead({ value: 50, currency: "USD" });
    }
  }

  if (submitted) {
    return (
      <div className="mt-10 space-y-5">
        <div className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle size={40} className="text-green-500" strokeWidth={1.5} />
          </div>
          <p className="text-lg font-bold text-text">Thank you for your inquiry!</p>
          <p className="mt-2 text-sm text-secondary leading-6">
            We&apos;ll review your request and get back to you within 24 hours.
          </p>
        </div>

        {!paid && orderId && (
          <div className="rounded-2xl border border-border bg-bg-light p-6">
            <p className="text-sm font-bold text-text">
              Optional: Pay a ${DEPOSIT_AMOUNT} Deposit
            </p>
            <p className="mt-1 mb-5 text-xs leading-5 text-secondary">
              Secure your order slot with a deposit. The remainder will be invoiced after we finalize your quote.
            </p>
            <PayPalCheckout
              orderId={orderId}
              amount={DEPOSIT_AMOUNT}
              currency="USD"
              onSuccess={(paypalOrderId) => {
                setPaid(true);
                trackPurchase({
                  transactionId: paypalOrderId,
                  value: parseFloat(DEPOSIT_AMOUNT),
                  currency: "USD",
                });
              }}
            />
          </div>
        )}

        {paid && (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
            <p className="text-sm font-bold text-green-800">
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
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="email" className={labelClass}>
          <Mail size={14} className="text-secondary" />
          Email Address{" "}
          <span className="ml-0.5 text-red-500 font-bold">*</span>
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className={inputClass}
          placeholder="john@example.com"
        />
      </div>

      <div>
        <label htmlFor="name" className={labelClass}>
          <User size={14} className="text-secondary" />
          Full Name{" "}
          <span className="ml-1 text-xs font-normal text-secondary">(optional)</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          className={inputClass}
          placeholder="John Smith"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="product" className={labelClass}>
            <Package size={14} className="text-secondary" />
            Product
          </label>
          <input
            id="product"
            name="product"
            type="text"
            defaultValue={defaultProduct ?? ""}
            className={inputClass}
            placeholder="e.g. Standard Business Cards"
          />
        </div>

        <div>
          <label htmlFor="quantity" className={labelClass}>
            <Hash size={14} className="text-secondary" />
            Quantity
          </label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            min={1}
            className={inputClass}
            placeholder="500"
          />
        </div>
      </div>

      <div>
        <label htmlFor="message" className={labelClass}>
          <MessageSquare size={14} className="text-secondary" />
          Message
        </label>
        <textarea
          id="message"
          name="message"
          rows={5}
          className={`${inputClass} resize-none`}
          placeholder="Tell us about your project — size, material preferences, deadline, etc."
        />
      </div>

      {/* Pre-submit trust bar */}
      <div className="flex items-center justify-center gap-4 rounded-xl border border-border bg-bg-light px-4 py-3">
        <div className="flex items-center gap-1.5 text-[11px] text-secondary">
          <Lock size={11} className="text-green-600" />
          <span>Secure & Private</span>
        </div>
        <div className="h-3 w-px bg-border" />
        <div className="flex items-center gap-1.5 text-[11px] text-secondary">
          <Zap size={11} className="text-accent" />
          <span>Reply within 24h</span>
        </div>
        <div className="h-3 w-px bg-border" />
        <div className="flex items-center gap-1.5 text-[11px] text-secondary">
          <Star size={11} className="fill-accent text-accent" />
          <span>4.9★ Rated</span>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-6 py-4 text-sm font-bold text-white hover:bg-accent-dark disabled:opacity-60 transition-all duration-200 shadow-md shadow-accent/30 hover:scale-[1.01] active:scale-[0.99]"
      >
        {pending ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            Get My Free Quote
            <span className="text-white/80">→</span>
          </>
        )}
      </button>

      <p className="text-center text-xs text-secondary">
        No commitment required. We&apos;ll get back to you within 24 hours.
      </p>
    </form>
  );
}
