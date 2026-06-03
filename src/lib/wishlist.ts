const STORAGE_KEY = "plaque_wishlist";

export interface WishlistItem {
  id: string;
  name: string;
  slug: string;
  categorySlug: string;
  imageUrl?: string;
  basePrice?: number;
}

export function getWishlist(): WishlistItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as WishlistItem[]) : [];
  } catch {
    return [];
  }
}

export function isWishlisted(slug: string): boolean {
  return getWishlist().some((item) => item.slug === slug);
}

export function toggleWishlist(item: WishlistItem): boolean {
  const list = getWishlist();
  const idx = list.findIndex((i) => i.slug === item.slug);
  let next: WishlistItem[];
  if (idx >= 0) {
    next = list.filter((_, i) => i !== idx);
  } else {
    next = [...list, item];
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return idx < 0; // true if added
}
