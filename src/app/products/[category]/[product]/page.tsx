import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ProductDetail from "./ProductDetail";
import type { OptionGroup, OptionValue, PriceRule } from "@/lib/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; product: string }>;
}) {
  const { product: productSlug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("name, description")
    .eq("slug", productSlug)
    .single();

  return {
    title: data ? `${data.name} — ProCardCrafters` : "Product — ProCardCrafters",
    description: data?.description ?? "",
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ category: string; product: string }>;
}) {
  const { product: productSlug } = await params;
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("slug", productSlug)
    .eq("is_active", true)
    .single();

  if (!product) notFound();

  const [{ data: groups }, { data: rules }] = await Promise.all([
    supabase
      .from("option_groups")
      .select("*")
      .eq("product_id", product.id)
      .order("sort_order"),
    supabase
      .from("price_rules")
      .select("*")
      .eq("product_id", product.id),
  ]);

  const groupIds = (groups ?? []).map((g: OptionGroup) => g.id);
  const { data: values } = groupIds.length
    ? await supabase
        .from("option_values")
        .select("*")
        .in("group_id", groupIds)
        .order("sort_order")
    : { data: [] };

  return (
    <ProductDetail
      product={product}
      groups={(groups ?? []) as OptionGroup[]}
      values={(values ?? []) as OptionValue[]}
      rules={(rules ?? []) as PriceRule[]}
    />
  );
}
