import QuoteForm from "./QuoteForm";
import { Clock, Shield, Star } from "lucide-react";

export const metadata = {
  title: "Get a Quote — ProCardCrafters",
  description:
    "Request a free, no-obligation quote for your printing project.",
};

const TRUST_POINTS = [
  { icon: Clock, text: "Response within 24 hours" },
  { icon: Shield, text: "No commitment required" },
  { icon: Star, text: "4.9★ customer satisfaction" },
];

export default async function QuotePage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const { product } = await searchParams;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-accent-light px-4 py-1.5 text-xs font-bold text-accent mb-6">
          Free & No Obligation
        </div>
        <h1 className="text-3xl font-extrabold text-text sm:text-4xl">
          Get a Custom Quote
        </h1>
        <p className="mt-3 text-sm leading-7 text-secondary max-w-md mx-auto">
          Tell us about your project and we&apos;ll get back to you with a tailored
          quote — usually within 24 hours.
        </p>
      </div>

      {/* Trust points */}
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        {TRUST_POINTS.map((point) => (
          <div
            key={point.text}
            className="flex items-center gap-1.5 text-xs font-medium text-secondary"
          >
            <point.icon size={13} className="text-primary" strokeWidth={2} />
            {point.text}
          </div>
        ))}
      </div>

      {/* Form */}
      <div className="mt-8 rounded-3xl border border-border bg-white p-8 shadow-sm">
        <QuoteForm defaultProduct={product} />
      </div>
    </div>
  );
}
