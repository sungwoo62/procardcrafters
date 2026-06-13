import { NextRequest, NextResponse } from 'next/server'
import { quoteShippingOptions, calculateOrderWeightKg } from '@/lib/shipping'
import { createServerClient } from '@/lib/supabase'

// 공개 견적 엔드포인트
//   POST body: {
//     country: string (ISO-2),
//     postalCode?: string,
//     weightKg?: number,
//     items?: [{ productId, quantity, selectedOptions? }],
//     subtotalUsd?: number,
//   }
//   응답:
//     quote: 최저가 옵션 (backward compat)
//     options: ShippingQuote[] (전체 옵션 배열, costUsd 오름차순)
//     defaultOptionIndex: number
//     freeShipping: bool
//     freeShippingThresholdUsd, freeShippingShortageUsd, ...
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body?.country) {
    return NextResponse.json({ error: 'country 필수' }, { status: 400 })
  }

  const supabase = createServerClient()
  let weightKg = Number(body.weightKg ?? 0)
  // OMO-3058: 카트의 모든 품목이 free_shipping 제품이면 배송 무료(운임은 단가에 흡수).
  let allItemsFreeShipping = false

  if (Array.isArray(body.items) && body.items.length > 0) {
    const productIds = body.items.map((i: { productId: string }) => i.productId).filter(Boolean)
    if (productIds.length) {
      const { data: products } = await supabase
        .from('print_products')
        .select('id, default_weight_kg, unit_weight_g, free_shipping')
        .in('id', productIds)
      const productMap = new Map(
        (products ?? []).map((p) => [
          p.id,
          {
            default_weight_kg: Number(p.default_weight_kg ?? 0.5),
            unit_weight_g: Number(p.unit_weight_g ?? 0),
            free_shipping: Boolean(p.free_shipping),
          },
        ]),
      )
      if (!weightKg) {
        weightKg = calculateOrderWeightKg(
          body.items.map((i: { productId: string; quantity: number; selectedOptions?: Record<string, string> }) => {
            const meta = productMap.get(i.productId)
            return {
              quantity: Number(i.quantity ?? 1),
              default_weight_kg: meta?.default_weight_kg ?? 0.5,
              unit_weight_g: meta?.unit_weight_g ?? 0,
              selected_options: i.selectedOptions ?? null,
            }
          }),
        )
      }
      allItemsFreeShipping = body.items.every(
        (i: { productId: string }) => productMap.get(i.productId)?.free_shipping === true,
      )
    }
  }
  if (!weightKg || weightKg <= 0) weightKg = 0.5

  const { options, defaultOptionIndex } = await quoteShippingOptions(body.country, weightKg, body.postalCode)

  // 무료배송 임계 + 무게 상한 적용
  const { data: cfg } = await supabase
    .from('print_shipping_config')
    .select('free_shipping_threshold_usd, free_shipping_max_weight_kg')
    .eq('id', 1)
    .maybeSingle()
  const threshold = Number(cfg?.free_shipping_threshold_usd ?? 0)
  const maxWeight = Number(cfg?.free_shipping_max_weight_kg ?? 0)
  const subtotalUsd = Number(body.subtotalUsd ?? 0)

  const meetsSubtotal = threshold > 0 && subtotalUsd >= threshold
  const meetsWeight = maxWeight === 0 || weightKg <= maxWeight
  // 임계 기반 무료배송 OR 제품별 free_shipping(패키지: 운임 단가흡수) — OMO-3058
  const freeShipping = (meetsSubtotal && meetsWeight) || allItemsFreeShipping

  // 최저가 옵션 기준 가격 (differential 계산용)
  const cheapestCostUsd = options[defaultOptionIndex]?.costUsd ?? 0

  // 각 옵션에 effectiveCostUsd 추가
  // - freeShipping: cheapest → 0, 나머지 → 원가 - cheapest (differential)
  // - 일반: 그대로
  const enrichedOptions = options.map((opt, i) => {
    const effectiveCostUsd = freeShipping
      ? Math.max(0, Math.round((opt.costUsd - cheapestCostUsd) * 100) / 100)
      : opt.costUsd
    return { ...opt, effectiveCostUsd, isDefault: i === defaultOptionIndex }
  })

  // backward compat: quote 필드 (cheapest, free shipping 적용)
  const cheapestOpt = enrichedOptions[defaultOptionIndex]
  const responseQuote = cheapestOpt
    ? { ...cheapestOpt, costUsd: cheapestOpt.effectiveCostUsd, reason: freeShipping ? 'free_shipping_promo' : cheapestOpt.reason }
    : null

  let freeShippingNote: string | null = null
  if (threshold > 0) {
    if (!meetsSubtotal) {
      freeShippingNote = `Add $${(threshold - subtotalUsd).toFixed(2)} more for FREE shipping`
    } else if (!meetsWeight) {
      freeShippingNote = `Free shipping not available — package over ${maxWeight}kg limit`
    }
  }

  return NextResponse.json({
    quote: responseQuote,
    options: enrichedOptions,
    defaultOptionIndex,
    freeShipping,
    freeShippingThresholdUsd: threshold,
    freeShippingMaxWeightKg: maxWeight,
    freeShippingShortageUsd: threshold > 0 ? Math.max(0, threshold - subtotalUsd) : 0,
    overWeightLimit: maxWeight > 0 && weightKg > maxWeight,
    freeShippingNote,
  })
}
