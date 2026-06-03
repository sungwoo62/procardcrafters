import { NextRequest, NextResponse } from 'next/server'
import { quoteShipping, calculateOrderWeightKg } from '@/lib/shipping'
import { createServerClient } from '@/lib/supabase'

// 공개 견적 엔드포인트
//   POST body: {
//     country: string (ISO-2),
//     postalCode?: string,
//     weightKg?: number,                 // 직접 지정 시 사용
//     items?: [{ productId, quantity }], // 없으면 weightKg 사용 / 둘 다 없으면 0.5kg
//     subtotalUsd?: number,              // 무료배송 임계 비교용
//     serviceCode?: string,
//   }
//   응답: { quote: ShippingQuote, freeShipping: bool, freeShippingThresholdUsd, freeShippingShortageUsd }
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body?.country) {
    return NextResponse.json({ error: 'country 필수' }, { status: 400 })
  }

  const supabase = createServerClient()
  let weightKg = Number(body.weightKg ?? 0)

  // items 주어진 경우 제품 default_weight_kg 합으로 계산
  if (!weightKg && Array.isArray(body.items) && body.items.length > 0) {
    const productIds = body.items.map((i: { productId: string }) => i.productId).filter(Boolean)
    if (productIds.length) {
      const { data: products } = await supabase
        .from('print_products')
        .select('id, default_weight_kg')
        .in('id', productIds)
      const productMap = new Map((products ?? []).map((p) => [p.id, Number(p.default_weight_kg ?? 0.5)]))
      weightKg = calculateOrderWeightKg(
        body.items.map((i: { productId: string; quantity: number }) => ({
          quantity: Number(i.quantity ?? 1),
          default_weight_kg: productMap.get(i.productId) ?? 0.5,
        })),
      )
    }
  }
  if (!weightKg || weightKg <= 0) weightKg = 0.5

  const quote = await quoteShipping(body.country, weightKg, body.serviceCode, body.postalCode)

  // 무료배송 임계 적용
  const { data: cfg } = await supabase
    .from('print_shipping_config')
    .select('free_shipping_threshold_usd')
    .eq('id', 1)
    .maybeSingle()
  const threshold = Number(cfg?.free_shipping_threshold_usd ?? 0)
  const subtotalUsd = Number(body.subtotalUsd ?? 0)
  const freeShipping = threshold > 0 && subtotalUsd >= threshold

  const responseQuote = freeShipping
    ? { ...quote, costUsd: 0, baseCostUsd: quote.baseCostUsd, reason: 'free_shipping_promo' as const }
    : quote

  return NextResponse.json({
    quote: responseQuote,
    freeShipping,
    freeShippingThresholdUsd: threshold,
    freeShippingShortageUsd: threshold > 0 ? Math.max(0, threshold - subtotalUsd) : 0,
  })
}
