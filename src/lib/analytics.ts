declare global {
  interface Window {
    gtag: (...args: unknown[]) => void
    fbq: (...args: unknown[]) => void
    _fbq: unknown
    dataLayer: Array<Record<string, unknown> | unknown[]>
  }
}

interface EnhancedConversionAddress {
  first_name: string
  last_name: string
  street?: string
  city?: string
  region?: string
  postal_code: string
  country: string
}

interface EnhancedConversionUserData {
  email?: string
  phone_number?: string
  address?: EnhancedConversionAddress
}

function pushDataLayerEvent(event: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({ event, ...params })
}

// OMO-2914 (R2) — 라이브 퍼널 상단(view_item / begin_checkout)을 1st-party DB 에도 적재한다.
// GA4 Data API 가 막혀(OMO-2894) 있어도 위클리 신호 루틴(OMO-2891)이 DB 에서
// products → checkout → order → paid 이탈을 측정할 수 있게 하는 fire-and-forget 싱크.
function sendFunnelEvent(
  event_type: 'view_item' | 'begin_checkout',
  params: Record<string, unknown>,
): void {
  if (typeof window === 'undefined') return
  try {
    void fetch('/api/analytics/funnel-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        event_type,
        session_id: getSessionId(),
        path: window.location.pathname,
        referrer: document.referrer || undefined,
        ...params,
      }),
    }).catch(() => {})
  } catch {
    // fire-and-forget — 실패해도 UX 영향 없음
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
  pushDataLayerEvent('page_view', { page_path: url })
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
  const params = {
    items: [
      {
        item_id: product.id,
        item_name: product.name,
        item_category: product.category,
        price: product.price,
        currency: 'USD',
      },
    ],
  }
  pushDataLayerEvent('view_item', params)
  gtagEvent('view_item', params)
  sendFunnelEvent('view_item', {
    product_id: product.id,
    product_name: product.name,
    category: product.category,
    value: product.price,
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
  const params = {
    items: [
      {
        item_id: product.id,
        item_name: product.name,
        item_category: product.category,
        price: product.price,
        currency: 'USD',
      },
    ],
  }
  pushDataLayerEvent('add_to_cart', params)
  gtagEvent('add_to_cart', params)
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
  const eventParams = {
    currency: 'USD',
    value: params.value,
    items: params.productId
      ? [{ item_id: params.productId, item_name: params.productName }]
      : undefined,
  }
  pushDataLayerEvent('begin_checkout', eventParams)
  gtagEvent('begin_checkout', eventParams)
  sendFunnelEvent('begin_checkout', {
    product_id: params.productId,
    product_name: params.productName,
    value: params.value,
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
  userData?: EnhancedConversionUserData
}) {
  if (params.userData && typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('set', 'user_data', params.userData)
  }

  const eventParams = {
    transaction_id: params.orderId,
    currency: 'USD',
    value: params.value,
    items: params.productId
      ? [{ item_id: params.productId, item_name: params.productName }]
      : undefined,
  }
  pushDataLayerEvent('purchase', eventParams)
  gtagEvent('purchase', eventParams)
  metaPixelEvent('Purchase', {
    value: params.value,
    currency: 'USD',
  })
}

// 리드 정의는 여러 종류를 둘 수 있다(이메일 구독 / 챗 견적 요청 등).
// leadType 으로 구분해 GTM/Google Ads 에서 단일 트리거를 여러 전환 액션으로 분기한다.
export type LeadType = 'email_signup' | 'chat_quote'

export function trackGenerateLead(params?: {
  leadType?: LeadType
  value?: number
  currency?: string
}) {
  const eventParams = {
    lead_type: params?.leadType,
    currency: params?.currency ?? 'USD',
    value: params?.value,
  }
  pushDataLayerEvent('generate_lead', eventParams)
  gtagEvent('generate_lead', eventParams)
  metaPixelEvent('Lead', {
    content_category: params?.leadType,
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
  const eventParams = { campaign_id: params.campaign_id, surface: params.surface }
  pushDataLayerEvent('promo_impression', eventParams)
  gtagEvent('promo_impression', eventParams)
  void sendPromoEvent('promo_impression', params)
}

export function trackPromoClick(params: PromoEventParams) {
  const eventParams = { campaign_id: params.campaign_id, surface: params.surface }
  pushDataLayerEvent('promo_click', eventParams)
  gtagEvent('promo_click', eventParams)
  void sendPromoEvent('promo_click', params)
}

export function trackPromoCodeView(params: PromoEventParams) {
  const eventParams = { campaign_id: params.campaign_id, code: params.code }
  pushDataLayerEvent('promo_code_view', eventParams)
  gtagEvent('promo_code_view', eventParams)
  void sendPromoEvent('promo_code_view', params)
}

export function trackPromoAddToCart(params: PromoEventParams) {
  const eventParams = {
    campaign_id: params.campaign_id,
    item_id: params.product_slug,
  }
  pushDataLayerEvent('promo_add_to_cart', eventParams)
  gtagEvent('promo_add_to_cart', eventParams)
  void sendPromoEvent('promo_add_to_cart', params)
}

export function trackPromoCheckoutStart(params: PromoEventParams) {
  const eventParams = { campaign_id: params.campaign_id }
  pushDataLayerEvent('promo_checkout_start', eventParams)
  gtagEvent('promo_checkout_start', eventParams)
  void sendPromoEvent('promo_checkout_start', params)
}

export function trackPromoCodeRedeem(params: PromoEventParams) {
  const eventParams = { campaign_id: params.campaign_id, code: params.code }
  pushDataLayerEvent('promo_code_redeem', eventParams)
  gtagEvent('promo_code_redeem', eventParams)
  void sendPromoEvent('promo_code_redeem', params)
}
