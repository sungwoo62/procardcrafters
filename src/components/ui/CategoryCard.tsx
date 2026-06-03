import Link from "next/link";
import {
  CreditCard,
  FileText,
  Flag,
  Sticker,
  Package,
  IdCardLanyard,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  "business-cards": CreditCard,
  "flyers-leaflets": FileText,
  "banners-displays": Flag,
  "stickers-labels": Sticker,
  packaging: Package,
  "lanyards-accessories": IdCardLanyard,
};

const GRADIENT_MAP: Record<string, string> = {
  "business-cards": "from-blue-50 to-indigo-50",
  "flyers-leaflets": "from-emerald-50 to-teal-50",
  "banners-displays": "from-orange-50 to-amber-50",
  "stickers-labels": "from-pink-50 to-rose-50",
  packaging: "from-purple-50 to-violet-50",
  "lanyards-accessories": "from-sky-50 to-cyan-50",
};

export default function CategoryCard({
  name,
  slug,
  description,
}: {
  name: string;
  slug: string;
  description?: string;
}) {
  const Icon = ICON_MAP[slug] ?? Package;
  const gradient = GRADIENT_MAP[slug] ?? "from-slate-50 to-gray-50";

  return (
    <Link
      href={`/products?category=${slug}`}
      className="group flex flex-col items-center gap-3 rounded-2xl border border-border bg-white p-5 text-center transition-all duration-200 hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5"
    >
      <div
        className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-primary transition-all duration-200 group-hover:scale-110`}
      >
        <Icon size={26} strokeWidth={1.75} />
      </div>
      <h3 className="text-xs font-bold text-text leading-tight group-hover:text-primary transition-colors">
        {name}
      </h3>
      {description && (
        <p className="text-[11px] text-secondary leading-5">{description}</p>
      )}
    </Link>
  );
}
