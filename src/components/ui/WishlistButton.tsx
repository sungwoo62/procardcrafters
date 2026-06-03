"use client";

import { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import { isWishlisted, toggleWishlist, type WishlistItem } from "@/lib/wishlist";

export default function WishlistButton({
  item,
  className = "",
}: {
  item: WishlistItem;
  className?: string;
}) {
  const [wishlisted, setWishlisted] = useState(false);

  useEffect(() => {
    setWishlisted(isWishlisted(item.slug));
  }, [item.slug]);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const added = toggleWishlist(item);
    setWishlisted(added);
    window.dispatchEvent(new Event("storage"));
  }

  return (
    <button
      onClick={handleClick}
      aria-label={wishlisted ? "찜 해제" : "찜하기"}
      className={`flex items-center justify-center rounded-full p-2 transition-colors ${
        wishlisted
          ? "bg-red-50 text-red-500 hover:bg-red-100"
          : "bg-white/80 text-gray-400 hover:text-red-400 hover:bg-red-50"
      } shadow-sm ${className}`}
    >
      <Heart
        size={18}
        className={wishlisted ? "fill-red-500" : ""}
      />
    </button>
  );
}
