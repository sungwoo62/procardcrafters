import Link from "next/link";
import CategoryCard from "@/components/ui/CategoryCard";
import { Award, DollarSign, Zap } from "lucide-react";

export const revalidate = 3600

const CATEGORIES = [
  { name: "Business Cards", slug: "business-cards" },
  { name: "Flyers & Leaflets", slug: "flyers-leaflets" },
  { name: "Banners & Displays", slug: "banners-displays" },
  { name: "Stickers & Labels", slug: "stickers-labels" },
  { name: "Packaging", slug: "packaging" },
  { name: "Lanyards & Accessories", slug: "lanyards-accessories" },
];

const WHY_US = [
  {
    icon: Award,
    title: "Premium Quality",
    desc: "Industry-leading print technology and carefully selected materials ensure every order looks flawless.",
  },
  {
    icon: DollarSign,
    title: "Clear Pricing",
    desc: "No hidden fees, no surprises. See exactly what you pay before you order.",
  },
  {
    icon: Zap,
    title: "Fast Turnaround",
    desc: "Standard orders ship within 3–5 business days. Rush options available.",
  },
];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="bg-bg-light">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-4xl font-extrabold tracking-tight text-text sm:text-5xl lg:text-6xl">
              Print That Means Business
            </h1>
            <p className="mt-6 text-lg leading-8 text-secondary">
              Premium quality printing for businesses of all sizes. Fast
              turnaround, transparent pricing.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/products"
                className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-primary-dark transition-colors"
              >
                Shop All Products
              </Link>
              <Link
                href="/quote"
                className="rounded-lg border border-border px-6 py-3 text-sm font-semibold text-text hover:bg-white transition-colors"
              >
                Get Instant Quote
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Category grid */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-bold text-text sm:text-3xl">
          What Are You Printing?
        </h2>
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {CATEGORIES.map((cat) => (
            <CategoryCard key={cat.slug} name={cat.name} slug={cat.slug} />
          ))}
        </div>
      </section>

      {/* Why us */}
      <section className="bg-bg-light">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-bold text-text sm:text-3xl">
            Why ProCardCrafters?
          </h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {WHY_US.map((item) => (
              <div
                key={item.title}
                className="flex flex-col items-center gap-4 text-center"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <item.icon size={28} />
                </div>
                <h3 className="text-lg font-semibold text-text">
                  {item.title}
                </h3>
                <p className="text-sm leading-6 text-secondary">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-6 text-center text-sm font-medium text-secondary sm:gap-10">
            <span>50,000+ Happy Customers</span>
            <span className="hidden sm:inline text-border">|</span>
            <span>500+ Products</span>
            <span className="hidden sm:inline text-border">|</span>
            <span>4.9★ Rating</span>
            <span className="hidden sm:inline text-border">|</span>
            <span>Ships Worldwide</span>
          </div>
        </div>
      </section>
    </>
  );
}
