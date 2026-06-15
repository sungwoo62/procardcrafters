// 니치 랜딩 프리셋 "실제 예상가" 산정 (보드 지시 OMO-3211).
//
// "Make it with these options" CTA(ctaPresetHref) 가 여는 컨피규레이터 구성의
// 실제 예상 가격(USD)을 서버에서 미리 계산해 랜딩 CTA 아래에 노출한다.
//
// 권위 일관성: 제품 상세 페이지의 JSON-LD lowPrice(=calculateItemPriceUsd, base_price_krw)
// 와 동일한 가격 함수를 쓰되, 프리셋에 실린 후가공(finishing=) surcharge 를 더한다.
//   고객가 = (base_price_krw + Σ finishing surcharge KRW) × margin_multiplier × 환율
// (finishing-surcharge.ts / pricing.ts 공유 — 결제·SSR 동일 로직.)
//
// 정직성: 이 값은 "최저(from) 기준 예상가"이며 수량·옵션에 따라 변한다. 최종가는
// 디자이너(컨피규레이터)의 실시간 성원 단가가 권위. 라벨에 그 한계를 명시한다.

import { createServerClient } from '@/lib/supabase'
import { getKrwToUsdRate } from '@/lib/exchange-rate'
import { calculateItemPriceUsd } from '@/lib/pricing'
import { finishingSurchargeKrwFromOptions } from '@/config/finishing-surcharge'

export type PresetEstimate = {
  /** 예상 최저가(USD, 반올림 전 원값). */
  priceUsd: number
  /** 프리셋에 주문가능 후가공 surcharge 가 반영됐는지(라벨 분기용). */
  hasFinishing: boolean
}

/** 프리셋 딥링크에서 제품 slug 와 finishing 쿼리를 파싱. */
function parsePresetHref(href: string): { slug: string; finishing: string } | null {
  const qIdx = href.indexOf('?')
  const path = qIdx >= 0 ? href.slice(0, qIdx) : href
  const query = qIdx >= 0 ? href.slice(qIdx + 1) : ''
  const m = path.match(/\/products\/([^/?#]+)/)
  if (!m) return null
  const params = new URLSearchParams(query)
  return { slug: decodeURIComponent(m[1]), finishing: params.get('finishing') ?? '' }
}

/**
 * 프리셋 딥링크(ctaPresetHref)의 실제 예상가(USD)를 산정한다.
 * - 제품이 DB(print_products) 에 없거나 가격 데이터 부재 시 null → 랜딩에서 가격줄 생략(비치명적).
 * - finishing 미포함 그룹은 base 기준 예상가만 반환(hasFinishing=false).
 */
export async function estimatePresetPrice(presetHref: string): Promise<PresetEstimate | null> {
  const parsed = parsePresetHref(presetHref)
  if (!parsed) return null

  const supabase = createServerClient()
  const [{ data }, exchangeRate] = await Promise.all([
    supabase
      .from('print_products')
      .select('base_price_krw, margin_multiplier')
      .eq('slug', parsed.slug)
      .eq('is_active', true)
      .maybeSingle(),
    getKrwToUsdRate(),
  ])
  if (!data || !data.base_price_krw || !data.margin_multiplier) return null

  const surchargeKrw = parsed.finishing
    ? finishingSurchargeKrwFromOptions({ finishing: parsed.finishing })
    : 0

  const priceUsd = calculateItemPriceUsd({
    basePriceKrw: data.base_price_krw,
    marginMultiplier: data.margin_multiplier,
    extraPricesKrw: surchargeKrw > 0 ? [surchargeKrw] : [],
    exchangeRate,
  })

  return { priceUsd, hasFinishing: surchargeKrw > 0 }
}
