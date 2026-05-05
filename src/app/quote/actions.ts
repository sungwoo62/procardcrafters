"use server";

import { createClient } from "@/lib/supabase/server";

export async function submitQuote(
  formData: FormData
): Promise<{ error?: string; orderId?: string }> {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const product = formData.get("product") as string;
  const quantityRaw = formData.get("quantity") as string;
  const message = formData.get("message") as string;

  if (!name || !email) {
    return { error: "Name and email are required." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("print_orders")
    .insert({
      customer_name: name,
      customer_email: email,
      product_name: product || null,
      quantity: quantityRaw ? parseInt(quantityRaw, 10) : null,
      message: message || null,
      site: "procardcrafters",
      status: "pending",
      payment_status: "unpaid",
    })
    .select("id")
    .single();

  if (error) {
    return { error: "Something went wrong. Please try again." };
  }

  return { orderId: data.id };
}
