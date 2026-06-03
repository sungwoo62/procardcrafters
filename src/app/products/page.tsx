import { createClient } from "@/lib/supabase/server";
import ProductCard from "@/components/ui/ProductCard";
import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import type { Category, Product } from "@/lib/types";

export const revalidate = 3600;

export const metadata = {
  title: "All Products — ProCardCrafters",
  description: "Browse our full range of premium print products.",
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const supabase = await createClient();

  const { data: categories } = await supabase
    .from("product_categories")
    .select("*")
    .order("sort_order");

  const cats = (categories ?? []) as Category[];
  const catMap = new Map(cats.map((c) => [c.id, c]));

  let categoryId: string | null = null;
  if (category) {
    const matched = cats.find((c) => c.slug === category);
    categoryId = matched?.id ?? null;
  }

  let productsQuery = supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (categoryId) {
    productsQuery = productsQuery.eq("category_id", categoryId);
  }

  const { data: products } = await productsQuery;
  const prods = (products ?? []) as Product[];

  const activeCategory = cats.find((c) => c.slug === category);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-text">
            {activeCategory ? activeCategory.name : "All Products"}
          </h1>
          <p className="mt-1 text-sm text-secondary">
            {prods.length} product{prods.length !== 1 ? "s" : ""} available
          </p>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-8 lg:flex-row">
        {/* Sidebar */}
        <aside className="w-full shrink-0 lg:w-60">
          <div className="rounded-2xl border border-border bg-white p-4">
            <div className="flex items-center gap-2 mb-4">
              <SlidersHorizontal size={15} className="text-secondary" strokeWidth={1.75} />
              <h2 className="text-xs font-bold uppercase tracking-widest text-secondary">
                Categories
              </h2>
            </div>
            <ul className="space-y-0.5">
              <li>
                <Link
                  href="/products"
                  className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-colors ${
                    !category
                      ? "bg-primary text-white font-semibold"
                      : "text-secondary hover:bg-bg-light hover:text-text font-medium"
                  }`}
                >
                  All Products
                  {!category && <span className="text-xs text-white/70">{prods.length}</span>}
                </Link>
              </li>
              {cats.map((cat) => (
                <li key={cat.id}>
                  <Link
                    href={`/products?category=${cat.slug}`}
                    className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-colors ${
                      category === cat.slug
                        ? "bg-primary text-white font-semibold"
                        : "text-secondary hover:bg-bg-light hover:text-text font-medium"
                    }`}
                  >
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Product grid */}
        <div className="flex-1">
          {prods.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="h-16 w-16 rounded-2xl bg-bg-light flex items-center justify-center mb-4">
                <SlidersHorizontal size={28} className="text-border" strokeWidth={1.25} />
              </div>
              <p className="text-base font-semibold text-text">No products found</p>
              <p className="mt-1 text-sm text-secondary">Check back soon!</p>
              <Link
                href="/products"
                className="mt-4 text-sm font-medium text-primary hover:underline"
              >
                View all products
              </Link>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {prods.map((prod) => {
                const cat = catMap.get(prod.category_id);
                return (
                  <ProductCard
                    key={prod.id}
                    name={prod.name}
                    slug={prod.slug}
                    categorySlug={cat?.slug ?? ""}
                    description={prod.description}
                    basePrice={prod.base_price}
                    imageUrl={prod.thumbnail_url}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
