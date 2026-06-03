import Link from "next/link";
import WishlistButton from "@/components/ui/WishlistButton";
import { ImageOff } from "lucide-react";

export default function ProductCard({
  name,
  slug,
  categorySlug,
  description,
  basePrice,
  imageUrl,
}: {
  name: string;
  slug: string;
  categorySlug: string;
  description?: string;
  basePrice?: number;
  imageUrl?: string;
}) {
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-white transition-all duration-200 hover:shadow-lg hover:border-primary/25 hover:-translate-y-0.5">
      <WishlistButton
        item={{ id: slug, name, slug, categorySlug, imageUrl, basePrice }}
        className="absolute top-3 right-3 z-10"
      />
      <Link href={`/products/${categorySlug}/${slug}`} className="flex flex-col flex-1">
        {/* Image */}
        <div className="relative flex h-48 items-center justify-center bg-bg-light overflow-hidden">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-border">
              <ImageOff size={36} strokeWidth={1.25} />
              <span className="text-[11px] font-medium text-secondary/50">
                Image coming soon
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 p-5">
          <h3 className="text-sm font-bold text-text group-hover:text-primary transition-colors leading-snug">
            {name}
          </h3>
          {description && (
            <p className="text-xs leading-5 text-secondary line-clamp-2">
              {description}
            </p>
          )}
          {basePrice != null && (
            <div className="mt-auto pt-3">
              <span className="inline-flex items-baseline gap-1">
                <span className="text-[10px] font-semibold text-secondary uppercase tracking-wide">
                  From
                </span>
                <span className="text-base font-extrabold text-primary">
                  ${basePrice.toFixed(2)}
                </span>
              </span>
            </div>
          )}
        </div>
      </Link>
    </div>
  );
}
