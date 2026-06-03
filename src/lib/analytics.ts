declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

function gtag(...args: unknown[]) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag(...args);
  }
}

export function trackPageView(url: string) {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (!gaId) return;
  gtag("config", gaId, { page_path: url });
}

export function trackViewItem(params: {
  itemId: string;
  itemName: string;
  itemCategory: string;
  price?: number;
}) {
  gtag("event", "view_item", {
    currency: "USD",
    items: [
      {
        item_id: params.itemId,
        item_name: params.itemName,
        item_category: params.itemCategory,
        price: params.price ?? 0,
      },
    ],
  });
}

export function trackGenerateLead(params: {
  value?: number;
  currency?: string;
}) {
  gtag("event", "generate_lead", {
    value: params.value ?? 50,
    currency: params.currency ?? "USD",
  });
}

export function trackPurchase(params: {
  transactionId: string;
  value: number;
  currency?: string;
  items?: { item_id: string; item_name: string; price: number }[];
}) {
  gtag("event", "purchase", {
    transaction_id: params.transactionId,
    value: params.value,
    currency: params.currency ?? "USD",
    items: params.items ?? [],
  });
}

export function trackAddToCart(params: {
  itemId: string;
  itemName: string;
  price?: number;
}) {
  gtag("event", "add_to_cart", {
    currency: "USD",
    items: [
      {
        item_id: params.itemId,
        item_name: params.itemName,
        price: params.price ?? 0,
      },
    ],
  });
}

export function trackGoogleAdsConversion(params: {
  sendTo: string;
  value?: number;
  currency?: string;
  transactionId?: string;
}) {
  const conversionId = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID;
  if (!conversionId) return;
  gtag("event", "conversion", {
    send_to: params.sendTo,
    value: params.value,
    currency: params.currency ?? "USD",
    transaction_id: params.transactionId,
  });
}
