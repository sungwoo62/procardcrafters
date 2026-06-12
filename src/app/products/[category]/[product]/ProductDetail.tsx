"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import OptionSelector from "@/components/print/OptionSelector";
import PriceCalculator from "@/components/print/PriceCalculator";
import WishlistButton from "@/components/ui/WishlistButton";
import { ImageOff, ChevronRight, ArrowRight, Zap, Shield, RotateCcw } from "lucide-react";
import type { Product, OptionGroup, OptionValue, PriceRule } from "@/lib/types";
import { trackViewItem, trackSelectItem } from "@/lib/analytics";

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

          {/* Honest trust note — no fabricated ratings or brand claims (OMO-2975) */}
          <div className="flex items-center gap-2 rounded-xl bg-accent/8 border border-accent/20 px-4 py-2.5">
            <Shield size={14} className="text-accent flex-shrink-0" />
            <p className="text-xs text-text font-medium">
              Commercial-grade print quality · secure checkout · ships worldwide
            </p>
          </div>

          {/* CTA */}
          <div>
            <Link
              href={`/quote?product=${encodeURIComponent(product.name)}`}
              onClick={() =>
                trackSelectItem({
                  itemId: product.id,
                  itemName: product.name,
                  itemCategory: product.category_id ?? "print",
                })
              }
              className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-4 text-sm font-bold text-white hover:bg-accent-dark transition-all duration-200 shadow-lg shadow-accent/30 hover:scale-[1.01] active:scale-[0.99]"
            >
              Get a Free Quote
              <ArrowRight
                size={16}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </Link>
            <p className="mt-2 text-center text-[11px] text-secondary">
              <Zap size={10} className="inline mr-1 text-accent" />
              Response within 24 hours · No commitment required
            </p>
          </div>

          {/* Trust badges */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-bg-light p-3 text-center">
              <Shield size={18} className="text-primary" strokeWidth={1.5} />
              <p className="text-[10px] font-bold text-text leading-tight">Free Digital<br />Proof</p>
            </div>
            <div className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-bg-light p-3 text-center">
              <Zap size={18} className="text-primary" strokeWidth={1.5} />
              <p className="text-[10px] font-bold text-text leading-tight">3–5 Day<br />Turnaround</p>
            </div>
            <div className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-bg-light p-3 text-center">
              <RotateCcw size={18} className="text-primary" strokeWidth={1.5} />
              <p className="text-[10px] font-bold text-text leading-tight">Satisfaction<br />Guarantee</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
