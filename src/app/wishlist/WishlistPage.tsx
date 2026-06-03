"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Heart, Trash2 } from "lucide-react";
import { getWishlist, toggleWishlist, type WishlistItem } from "@/lib/wishlist";

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);

  useEffect(() => {
    setItems(getWishlist());
  }, []);

  function handleRemove(item: WishlistItem) {
    toggleWishlist(item);
    setItems(getWishlist());
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Heart size={48} className="mb-4 text-gray-300" />
        <h2 className="text-lg font-semibold text-text">찜한 상품이 없습니다</h2>
        <p className="mt-2 text-sm text-secondary">
          상품 페이지에서 하트를 눌러 찜 목록에 추가하세요.
        </p>
        <Link
          href="/products"
          className="mt-6 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors"
        >
          상품 둘러보기
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">찜한 상품</h1>
      <p className="mt-1 text-sm text-secondary">{items.length}개 상품</p>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.slug}
            className="relative flex flex-col overflow-hidden rounded-xl border border-border bg-white transition-shadow hover:shadow-lg"
          >
            <button
              onClick={() => handleRemove(item)}
              aria-label="찜 해제"
              className="absolute top-3 right-3 z-10 flex items-center justify-center rounded-full bg-white/80 p-2 text-red-400 shadow-sm hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <Trash2 size={16} />
            </button>

            <Link
              href={`/products/${item.categorySlug}/${item.slug}`}
              className="flex flex-1 flex-col"
            >
              <div className="flex h-44 items-center justify-center bg-bg-light">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-4xl text-border">📷</span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-4">
                <h3 className="text-sm font-semibold text-text hover:text-primary transition-colors">
                  {item.name}
                </h3>
                {item.basePrice != null && (
                  <p className="mt-auto pt-2 text-sm font-bold text-primary">
                    From ${item.basePrice.toFixed(2)}
                  </p>
                )}
              </div>
            </Link>

            <div className="border-t border-border px-4 pb-4 pt-3">
              <Link
                href={`/quote?product=${encodeURIComponent(item.name)}`}
                className="flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-dark transition-colors"
              >
                견적 요청
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
