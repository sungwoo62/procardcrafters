"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import OptionSelector from "@/components/print/OptionSelector";
import PriceCalculator from "@/components/print/PriceCalculator";
import WishlistButton from "@/components/ui/WishlistButton";
import { ImageOff, ChevronRight, ArrowRight } from "lucide-react";
import type { Product, OptionGroup, OptionValue, PriceRule } from "@/lib/types";
import { trackViewItem } from "@/lib/analytics";

export default function ProductDetail({
  product,
  groups,
  values,
  rules,
}: {
  product: Product;
  groups: OptionGroup[];
  values: OptionValue[];
  rules: PriceRule[];
}) {
  const [selected, setSelected] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const g of groups) {
      const firstVal = values.find((v) => v.group_id === g.id);
      if (firstVal) init[g.id] = firstVal.id;
    }
    return init;
  });

  useEffect(() => {
    trackViewItem({
      itemId: product.id,
      itemName: product.name,
      itemCategory: product.category_id ?? "print",
    });
  }, [product.id, product.name, product.category_id]);

  function handleChange(groupId: string, valueId: string) {
    setSelected((prev) => ({ ...prev, [groupId]: valueId }));
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-secondary mb-8">
        <Link href="/products" className="hover:text-text transition-colors">
          Products
        </Link>
        <ChevronRight size={12} />
        <span className="text-text font-medium">{product.name}</span>
      </nav>

      <div className="grid gap-12 lg:grid-cols-2">
        {/* Left — Image + Info */}
        <div>
          {/* Image */}
          <div className="relative overflow-hidden rounded-3xl border border-border bg-bg-light aspect-[4/3] flex items-center justify-center">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-3 text-border">
                <ImageOff size={48} strokeWidth={1} />
                <span className="text-sm font-medium text-secondary/50">
                  Preview coming soon
                </span>
              </div>
            )}
            <div className="absolute top-4 right-4">
              <WishlistButton
                item={{
                  id: product.id,
                  name: product.name,
                  slug: product.slug,
                  categorySlug: product.category_id,
                  imageUrl: product.image_url,
                  basePrice: product.base_price,
                }}
                className=""
              />
            </div>
          </div>

          {/* Product info */}
          <div className="mt-8">
            <h1 className="text-3xl font-extrabold text-text leading-tight">
              {product.name}
            </h1>
            {product.description && (
              <p className="mt-4 text-sm leading-7 text-secondary">
                {product.description}
              </p>
            )}
          </div>
        </div>

        {/* Right — Configurator */}
        <div className="space-y-5">
          {/* Options */}
          {groups.length > 0 && (
            <div className="rounded-2xl border border-border bg-white p-6">
              <h2 className="text-sm font-bold text-text mb-5">
                Configure Your Order
              </h2>
              <OptionSelector
                groups={groups}
                values={values}
                selected={selected}
                onChange={handleChange}
              />
            </div>
          )}

          {/* Price */}
          <PriceCalculator
            rules={rules}
            groups={groups}
            values={values}
            selected={selected}
          />

          {/* CTA */}
          <Link
            href={`/quote?product=${encodeURIComponent(product.name)}`}
            className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-sm font-bold text-white hover:bg-primary-dark transition-all duration-200 shadow-lg shadow-primary/20"
          >
            Request a Quote
            <ArrowRight
              size={16}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </Link>

          {/* Trust badges */}
          <div className="flex items-center justify-center gap-6 pt-2">
            <div className="text-center">
              <p className="text-xs font-bold text-text">Free Proof</p>
              <p className="text-[10px] text-secondary">Digital proof included</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="text-center">
              <p className="text-xs font-bold text-text">3–5 Days</p>
              <p className="text-[10px] text-secondary">Standard turnaround</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="text-center">
              <p className="text-xs font-bold text-text">Ships Worldwide</p>
              <p className="text-[10px] text-secondary">Global delivery</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
