import { createClient } from "@/lib/supabase/server";
import ProductCard from "@/components/ui/ProductCard";
import Link from "next/link";
import type { Category, Product } from "@/lib/types";

export const revalidate = 3600

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

  // Fetch all categories for sidebar
  const { data: categories } = await supabase
    .from("product_categories")
    .select("*")
    .order("sort_order");

  const cats = (categories ?? []) as Category[];

  // Build a slug-to-category map for product cards
  const catMap = new Map(cats.map((c) => [c.id, c]));

  // Find category_id if filtering by slug
  let categoryId: string | null = null;
  if (category) {
    const matched = cats.find((c) => c.slug === category);
    categoryId = matched?.id ?? null;
  }

  // Simple products query without join
  let productsQuery = supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (categoryId) {
    productsQuery = productsQuery.eq("category_id", categoryId);
  }

  const { data: products, error } = await productsQuery;
  console.log('products result:', JSON.stringify(products, null, 2));
  console.log('categories result:', JSON.stringify(categories, null, 2));
  console.log('error:', error);
  const prods = (products ?? []) as Product[];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-text">Products</h1>

      <div className="mt-8 flex flex-col gap-8 lg:flex-row">
        {/* Sidebar */}
        <aside className="w-full shrink-0 lg:w-56">
          <h2 className="text-sm font-semibold text-text">Categories</h2>
          <ul className="mt-3 space-y-1">
            <li>
              <Link
                href="/products"
                className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                  !category
                    ? "bg-primary/10 font-semibold text-primary"
                    : "text-secondary hover:bg-bg-light hover:text-text"
                }`}
              >
                All Products
              </Link>
            </li>
            {cats.map((cat) => (
              <li key={cat.id}>
                <Link
                  href={`/products?category=${cat.slug}`}
                  className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                    category === cat.slug
                      ? "bg-primary/10 font-semibold text-primary"
                      : "text-secondary hover:bg-bg-light hover:text-text"
                  }`}
                >
                  {cat.name}
                </Link>
              </li>
            ))}
          </ul>
        </aside>

        {/* Product grid */}
        <div className="flex-1">
          {prods.length === 0 ? (
            <p className="text-sm text-secondary">
              No products found. Check back soon!
            </p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
