// PCCF 분석 공통 모듈 (OMO-2442)
// GTM-first: 표준 이벤트를 dataLayer에 push 하고, GTM 미주입 환경에서는
// 직접 로드된 gtag로 fallback 한다. (layout.tsx 의 로더와 짝을 이룬다)

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: Record<string, unknown>[];
  }
}

type EcommerceItem = {
  item_id: string;
  item_name: string;
  item_category?: string;
  price?: number;
  quantity?: number;
};

// GTM 컨테이너가 주입되었는지 여부 (layout.tsx 와 동일 기준)
function gtmEnabled() {
  return Boolean(process.env.NEXT_PUBLIC_GTM_ID);
}

/**
 * 표준 이벤트 전송 공통 함수.
 * - GTM 주입 시: dataLayer 에 `{ event, ...params }` push (GTM 커스텀 이벤트 트리거 기준)
 * - GTM 미주입 시: 직접 로드된 gtag('event', ...) 로 fallback
 * ecommerce 객체는 GA4 권장대로 이벤트 직전에 초기화(null)하여 잔여값 오염을 막는다.
 */
function pushEvent(
  eventName: string,
  params: Record<string, unknown> = {},
  options: { ecommerce?: boolean } = {}
) {
  if (typeof window === "undefined") return;

  if (gtmEnabled()) {
    window.dataLayer = window.dataLayer || [];
    if (options.ecommerce) {
      // 이전 ecommerce 데이터 초기화 (GA4 enhanced ecommerce 권장 패턴)
      window.dataLayer.push({ ecommerce: null });
    }
    window.dataLayer.push({ event: eventName, ...params });
    return;
  }

  // GTM fallback — 직접 로드된 GA4 gtag
  if (window.gtag) {
    window.gtag("event", eventName, params);
  }
}

// ── 페이지/상품 ──────────────────────────────────────────────

export function trackPageView(url: string) {
  if (gtmEnabled()) {
    pushEvent("page_view", { page_path: url });
    return;
  }
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (!gaId || typeof window === "undefined" || !window.gtag) return;
  window.gtag("config", gaId, { page_path: url });
}

export function trackViewItem(params: {
  itemId: string;
  itemName: string;
  itemCategory: string;
  price?: number;
}) {
  pushEvent(
    "view_item",
    {
      currency: "USD",
      value: params.price ?? 0,
      items: [
        {
          item_id: params.itemId,
          item_name: params.itemName,
          item_category: params.itemCategory,
          price: params.price ?? 0,
        } satisfies EcommerceItem,
      ],
    },
    { ecommerce: true }
  );
}

export function trackSelectItem(params: {
  itemId: string;
  itemName: string;
  itemCategory?: string;
}) {
  pushEvent(
    "select_item",
    {
      items: [
        {
          item_id: params.itemId,
          item_name: params.itemName,
          item_category: params.itemCategory,
        } satisfies EcommerceItem,
      ],
    },
    { ecommerce: true }
  );
}

// ── 장바구니 (PCCF는 현재 위시리스트 기반이라 view_cart/remove는 미사용,
//    추후 카트 도입 시 GTM 트리거 재사용 위해 표준 이벤트를 제공) ─────────

export function trackAddToCart(params: {
  itemId: string;
  itemName: string;
  price?: number;
  quantity?: number;
}) {
  pushEvent(
    "add_to_cart",
    {
      currency: "USD",
      value: params.price ?? 0,
      items: [
        {
          item_id: params.itemId,
          item_name: params.itemName,
          price: params.price ?? 0,
          quantity: params.quantity ?? 1,
        } satisfies EcommerceItem,
      ],
    },
    { ecommerce: true }
  );
}

export function trackRemoveFromCart(params: {
  itemId: string;
  itemName: string;
  price?: number;
}) {
  pushEvent(
    "remove_from_cart",
    {
      currency: "USD",
      items: [
        {
          item_id: params.itemId,
          item_name: params.itemName,
          price: params.price ?? 0,
        } satisfies EcommerceItem,
      ],
    },
    { ecommerce: true }
  );
}

export function trackViewCart(params: {
  value?: number;
  items?: EcommerceItem[];
}) {
  pushEvent(
    "view_cart",
    {
      currency: "USD",
      value: params.value ?? 0,
      items: params.items ?? [],
    },
    { ecommerce: true }
  );
}

// ── 퍼널: 견적/문의/체크아웃/구매 ────────────────────────────

/** 견적 요청(폼 제출) — PCCF 핵심 리드 전환 */
export function trackRequestQuote(params: {
  product?: string;
  quantity?: number;
  value?: number;
  currency?: string;
}) {
  pushEvent("request_quote", {
    product: params.product,
    quantity: params.quantity,
    value: params.value ?? 50,
    currency: params.currency ?? "USD",
  });
}

/** 문의 폼 제출 (견적 외 일반 문의용 표준 이벤트) */
export function trackContactSubmit(params: { method?: string } = {}) {
  pushEvent("contact_submit", {
    method: params.method ?? "quote_form",
  });
}

/** GA4 표준 리드 이벤트 (Google Ads 리드 전환 매핑용) */
export function trackGenerateLead(params: {
  value?: number;
  currency?: string;
}) {
  pushEvent("generate_lead", {
    value: params.value ?? 50,
    currency: params.currency ?? "USD",
  });
}

/** 결제 시작 (디파짓 결제 UI 노출 시점) */
export function trackBeginCheckout(params: {
  value: number;
  currency?: string;
  items?: EcommerceItem[];
}) {
  pushEvent(
    "begin_checkout",
    {
      currency: params.currency ?? "USD",
      value: params.value,
      items: params.items ?? [],
    },
    { ecommerce: true }
  );
}

export function trackPurchase(params: {
  transactionId: string;
  value: number;
  currency?: string;
  items?: EcommerceItem[];
}) {
  pushEvent(
    "purchase",
    {
      transaction_id: params.transactionId,
      value: params.value,
      currency: params.currency ?? "USD",
      items: params.items ?? [],
    },
    { ecommerce: true }
  );
}

/**
 * Google Ads 직접 전환 helper.
 * GTM 주입 환경에서는 Google Ads Conversion Tag 를 dataLayer 커스텀 이벤트
 * (purchase / request_quote) 트리거로 구성하므로 이 helper 호출은 불필요하다.
 * GTM 미주입(직접 gtag) 환경의 fallback 으로만 유지한다.
 */
export function trackGoogleAdsConversion(params: {
  sendTo: string;
  value?: number;
  currency?: string;
  transactionId?: string;
}) {
  if (gtmEnabled()) return; // GTM 트리거가 처리
  const conversionId = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID;
  if (!conversionId) return;
  if (typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", "conversion", {
    send_to: params.sendTo,
    value: params.value,
    currency: params.currency ?? "USD",
    transaction_id: params.transactionId,
  });
}
