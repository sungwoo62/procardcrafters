declare global {
  interface Window {
    gtag: (...args: unknown[]) => void
    fbq: (...args: unknown[]) => void
    _fbq: unknown
  }
}

export function gtagEvent(eventName: string, params?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', eventName, params)
  }
}

export function metaPixelEvent(eventName: string, params?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq('track', eventName, params)
  }
}

export function trackPageView(url: string) {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
  if (measurementId && typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('config', measurementId, { page_path: url })
  }
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq('track', 'PageView')
  }
}

export function trackViewItem(product: {
  id: string
  name: string
  category?: string
  price?: number
}) {
  gtagEvent('view_item', {
    items: [
      {
        item_id: product.id,
        item_name: product.name,
        item_category: product.category,
        price: product.price,
        currency: 'USD',
      },
    ],
  })
  metaPixelEvent('ViewContent', {
    content_ids: [product.id],
    content_name: product.name,
    content_category: product.category,
    content_type: 'product',
    value: product.price,
    currency: 'USD',
  })
}

export function trackAddToCart(product: {
  id: string
  name: string
  category?: string
  price?: number
}) {
  gtagEvent('add_to_cart', {
    items: [
      {
        item_id: product.id,
        item_name: product.name,
        item_category: product.category,
        price: product.price,
        currency: 'USD',
      },
    ],
  })
  metaPixelEvent('AddToCart', {
    content_ids: [product.id],
    content_name: product.name,
    content_type: 'product',
    value: product.price,
    currency: 'USD',
  })
}

export function trackBeginCheckout(params: {
  value: number
  productId?: string
  productName?: string
}) {
  gtagEvent('begin_checkout', {
    currency: 'USD',
    value: params.value,
    items: params.productId
      ? [{ item_id: params.productId, item_name: params.productName }]
      : undefined,
  })
  metaPixelEvent('InitiateCheckout', {
    currency: 'USD',
    value: params.value,
  })
}

export function trackPurchase(params: {
  orderId: string
  value: number
  productId?: string
  productName?: string
}) {
  gtagEvent('purchase', {
    transaction_id: params.orderId,
    currency: 'USD',
    value: params.value,
    items: params.productId
      ? [{ item_id: params.productId, item_name: params.productName }]
      : undefined,
  })
  metaPixelEvent('Purchase', {
    value: params.value,
    currency: 'USD',
  })
}

export function trackGenerateLead(params?: { value?: number; currency?: string }) {
  gtagEvent('generate_lead', {
    currency: params?.currency ?? 'USD',
    value: params?.value,
  })
  metaPixelEvent('Lead', {
    currency: params?.currency ?? 'USD',
    value: params?.value,
  })
}

// ─── Promo funnel 이벤트 ──────────────────────────────────────

export type PromoSurface = 'megamenu' | 'hero' | 'toast' | 'lp' | 'unknown'

export interface PromoEventParams {
  campaign_id: string
  code?: string
  surface?: PromoSurface
  user_id?: string
  product_slug?: string
}

function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  const key = '_pcsid'
  let sid = localStorage.getItem(key)
  if (!sid) {
    sid = crypto.randomUUID()
    localStorage.setItem(key, sid)
  }
  return sid
}

async function sendPromoEvent(
  event_type: string,
  params: PromoEventParams,
): Promise<void> {
  const session_id = getSessionId()
  try {
    await fetch('/api/analytics/promo-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type, session_id, ...params }),
    })
  } catch {
    // 비동기 fire-and-forget — 실패해도 UX에 영향 없음
  }
}

export function trackPromoImpression(params: PromoEventParams) {
  gtagEvent('promo_impression', { campaign_id: params.campaign_id, surface: params.surface })
  void sendPromoEvent('promo_impression', params)
}

export function trackPromoClick(params: PromoEventParams) {
  gtagEvent('promo_click', { campaign_id: params.campaign_id, surface: params.surface })
  void sendPromoEvent('promo_click', params)
}

export function trackPromoCodeView(params: PromoEventParams) {
  gtagEvent('promo_code_view', { campaign_id: params.campaign_id, code: params.code })
  void sendPromoEvent('promo_code_view', params)
}

export function trackPromoAddToCart(params: PromoEventParams) {
  gtagEvent('promo_add_to_cart', {
    campaign_id: params.campaign_id,
    item_id: params.product_slug,
  })
  void sendPromoEvent('promo_add_to_cart', params)
}

export function trackPromoCheckoutStart(params: PromoEventParams) {
  gtagEvent('promo_checkout_start', { campaign_id: params.campaign_id })
  void sendPromoEvent('promo_checkout_start', params)
}

export function trackPromoCodeRedeem(params: PromoEventParams) {
  gtagEvent('promo_code_redeem', { campaign_id: params.campaign_id, code: params.code })
  void sendPromoEvent('promo_code_redeem', params)
}
