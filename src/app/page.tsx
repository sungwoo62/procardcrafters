import Link from "next/link";
import CategoryCard from "@/components/ui/CategoryCard";
import { Award, DollarSign, Zap, Star, Globe, Shield } from "lucide-react";

export const revalidate = 3600;

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

const TRUST_STATS = [
  { icon: Star, value: "4.9★", label: "Customer Rating" },
  { icon: Globe, value: "Ships Worldwide", label: "Global Delivery" },
  { icon: Shield, value: "50,000+", label: "Happy Customers" },
  { icon: Award, value: "500+", label: "Products" },
];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-bg-dark">
        {/* Subtle background pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle at 25% 50%, #2563EB 0%, transparent 50%), radial-gradient(circle at 75% 20%, #d4860a 0%, transparent 40%)",
          }}
        />
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-medium text-white/80 backdrop-blur-sm mb-8">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              Trusted by 50,000+ businesses worldwide
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl xl:text-7xl leading-tight">
              Print That{" "}
              <span className="text-accent">Means Business</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-white/70 max-w-xl mx-auto">
              Premium quality printing for businesses of all sizes. Fast
              turnaround, transparent pricing — no surprises.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/products"
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-accent/30 hover:bg-accent-dark transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              >
                Shop All Products
                <svg
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                  />
                </svg>
              </Link>
              <Link
                href="/quote"
                className="inline-flex items-center justify-center rounded-xl border border-white/25 bg-white/10 px-8 py-3.5 text-sm font-semibold text-white hover:bg-white/20 transition-all duration-200 backdrop-blur-sm"
              >
                Get Instant Quote
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg
            viewBox="0 0 1440 60"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full"
            preserveAspectRatio="none"
          >
            <path
              d="M0 60L60 50C120 40 240 20 360 15C480 10 600 20 720 25C840 30 960 30 1080 25C1200 20 1320 10 1380 5L1440 0V60H0Z"
              fill="#ffffff"
            />
          </svg>
        </div>
      </section>

      {/* Category grid */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-text sm:text-3xl lg:text-4xl">
            What Are You Printing?
          </h2>
          <p className="mt-3 text-secondary text-sm sm:text-base max-w-xl mx-auto">
            Browse our full range of premium print products
          </p>
        </div>
        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {CATEGORIES.map((cat) => (
            <CategoryCard key={cat.slug} name={cat.name} slug={cat.slug} />
          ))}
        </div>
      </section>

      {/* Why us */}
      <section className="bg-bg-light border-y border-border">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-text sm:text-3xl lg:text-4xl">
              Why ProCardCrafters?
            </h2>
            <p className="mt-3 text-secondary text-sm sm:text-base max-w-xl mx-auto">
              We combine quality craftsmanship with transparent pricing
            </p>
          </div>
          <div className="mt-14 grid gap-8 sm:grid-cols-3">
            {WHY_US.map((item, i) => (
              <div
                key={item.title}
                className="group relative flex flex-col items-center gap-5 text-center rounded-2xl bg-white border border-border p-8 shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/8 text-primary group-hover:bg-primary group-hover:text-white transition-colors duration-200">
                  <item.icon size={30} strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-text">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-secondary">{item.desc}</p>
                </div>
                <div className="absolute top-4 right-4 text-xs font-bold text-primary/30">
                  0{i + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="bg-primary">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {TRUST_STATS.map((stat) => (
              <div key={stat.label} className="flex flex-col items-center gap-2 text-center">
                <stat.icon size={22} className="text-accent" strokeWidth={1.75} />
                <p className="text-lg font-extrabold text-white">{stat.value}</p>
                <p className="text-xs text-white/60 font-medium">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA banner */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-gradient-to-r from-primary to-[#2a5080] p-10 text-center sm:p-14">
          <h2 className="text-2xl font-extrabold text-white sm:text-3xl">
            Ready to get started?
          </h2>
          <p className="mt-3 text-white/70 text-sm sm:text-base">
            Get an instant quote or browse our products — no account required.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/quote"
              className="inline-flex items-center justify-center rounded-xl bg-accent px-8 py-3.5 text-sm font-bold text-white hover:bg-accent-dark transition-colors"
            >
              Get a Free Quote
            </Link>
            <Link
              href="/products"
              className="inline-flex items-center justify-center rounded-xl border border-white/30 bg-white/10 px-8 py-3.5 text-sm font-semibold text-white hover:bg-white/20 transition-colors"
            >
              Browse Products
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
