// OMO-3265: AI 큐레이션 — 고객 의도(자연어/프리셋)를 받아 제품을 추천하는 엔진의 데이터 레이어.
// 가격은 서버에서 산정(LLM 환각 방지)하고, 딥링크(/order)로 바로 주문 전환을 유도한다.
// 전환 강화(v2): 경쟁사 절감률(price anchoring) + Good/Better/Best 3단 비교(중간 "Most popular").
import { createServerClient } from '@/lib/supabase'
import { getKrwToUsdRate } from '@/lib/exchange-rate'
import { calculateItemPriceUsd } from '@/lib/pricing'
import { SLUG_TO_GROUP } from '@/config/product-nav'
import { FINISHING_BY_VALUE } from '@/config/finishing-catalog'
import type { PrintProduct, CompetitorPriceSummary } from '@/types/database'

export interface CurationProduct {
  slug: string
  name: string
  category: string
  isPremium: boolean
  /** 최소수량 기준 "from" 예상가(USD). 미가격(0) 제품은 0. */
  fromUsd: number
  imageUrl: string | null
  recommendedUse: string | null
  /** 주요 브랜드 대비 최대 절감률(%) — print_competitor_price_summary 기준. 없으면 0. */
  savingsPct: number
}

/** 큐레이션이 추천하는 단일 픽(렌더/딥링크용으로 가공 완료된 형태). */
export interface CurationPick {
  slug: string
  name: string
  category: string
  tier: string
  hook: string
  why: string
  finishing: string[]
  finishingLabels: string[]
  quantity: number | null
  fromUsd: number
  savingsPct: number
  imageUrl: string | null
  orderHref: string
  /** 비교 카드용 강조 라벨(예: "Most popular") — 가격 앵커링. */
  badge: string | null
  /** 고객이 고른 vibe에 해당하는 픽이면 true → 시각 강조. */
  highlight: boolean
}

export interface CurationResult {
  summary: string
  /** true면 LLM 미사용(프리셋/폴백) 결과임을 표시. */
  heuristic: boolean
  picks: CurationPick[]
}

export async function loadCurationCatalog(): Promise<CurationProduct[]> {
  const supabase = createServerClient()
  const [{ data }, { data: competitorRows }, rate] = await Promise.all([
    supabase
      .from('print_products')
      .select(
        'slug,name_en,category,base_price_krw,margin_multiplier,is_premium,hero_image_url,thumbnail_url,recommended_use_en,is_active,sort_order',
      )
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase.from('print_competitor_price_summary').select('sku_slug,savings_pct,is_fresh').eq('is_fresh', true),
    getKrwToUsdRate(),
  ])

  // slug → 최대 절감률(신선·양수만). 가격 앵커링 배지에 사용.
  const savingsBySlug = new Map<string, number>()
  for (const row of (competitorRows as Pick<CompetitorPriceSummary, 'sku_slug' | 'savings_pct'>[] | null) ?? []) {
    if (row.savings_pct > 0) {
      savingsBySlug.set(row.sku_slug, Math.max(savingsBySlug.get(row.sku_slug) ?? 0, Math.round(row.savings_pct)))
    }
  }

  const rows = (data ?? []) as Partial<PrintProduct>[]
  return rows
    .filter((p) => !!p.slug)
    .map((p) => ({
      slug: p.slug!,
      name: p.name_en ?? p.slug!,
      category: p.category ?? 'unknown',
      isPremium: !!p.is_premium,
      fromUsd: Math.round(
        calculateItemPriceUsd({
          basePriceKrw: p.base_price_krw ?? 0,
          marginMultiplier: p.margin_multiplier ?? 3.3,
          extraPricesKrw: [],
          exchangeRate: rate,
        }),
      ),
      imageUrl: p.hero_image_url ?? p.thumbnail_url ?? null,
      recommendedUse: p.recommended_use_en ?? null,
      savingsPct: savingsBySlug.get(p.slug!) ?? 0,
    }))
}

/** /order 딥링크 생성 — 옵션 사전선택으로 "바로 주문하러 가기" 전환을 줄인다. */
export function buildOrderHref(
  slug: string,
  opts: { quantity?: number | null; finishing?: string[] } = {},
): string {
  const params = new URLSearchParams({ product: slug })
  if (opts.quantity && opts.quantity > 0) params.set('quantity', String(opts.quantity))
  if (opts.finishing && opts.finishing.length) params.set('finishing', opts.finishing.join(','))
  return `/order?${params.toString()}`
}

/** 카탈로그 행 + 추천 메타를 렌더용 픽으로 가공. 잘못된 slug/finishing은 제거. */
export function toPick(
  catalog: CurationProduct[],
  raw: {
    slug: string
    tier: string
    hook: string
    why: string
    finishing?: string[]
    quantity?: number | null
    badge?: string | null
    highlight?: boolean
  },
): CurationPick | null {
  const product = catalog.find((p) => p.slug === raw.slug)
  if (!product) return null
  const finishing = (raw.finishing ?? []).filter((f) => !!FINISHING_BY_VALUE[f])
  const finishingLabels = finishing.map((f) => FINISHING_BY_VALUE[f].label_en)
  return {
    slug: product.slug,
    name: product.name,
    category: product.category,
    tier: raw.tier,
    hook: raw.hook,
    why: raw.why,
    finishing,
    finishingLabels,
    quantity: raw.quantity ?? null,
    fromUsd: product.fromUsd,
    savingsPct: product.savingsPct,
    imageUrl: product.imageUrl,
    orderHref: buildOrderHref(product.slug, { quantity: raw.quantity ?? null, finishing }),
    badge: raw.badge ?? null,
    highlight: raw.highlight ?? false,
  }
}

export type CurationMode = 'premium' | 'value' | 'cheap'

const MODE_COPY: Record<
  CurationMode,
  { tier: string; hook: string; why: (n: string) => string; finishing: string[] }
> = {
  premium: {
    tier: 'Top-Tier',
    hook: 'The card people keep on their desk',
    why: (n) => `Our most premium ${n.toLowerCase()} with luxury finishes that signal status on contact.`,
    finishing: ['foil_stamp', 'deboss_emboss'],
  },
  value: {
    tier: 'Best Value',
    hook: 'Looks high-end, priced to reorder',
    why: (n) => `Premium-grade ${n.toLowerCase()} with one standout finish — the sweet spot of quality and price.`,
    finishing: ['coating'],
  },
  cheap: {
    tier: 'Lowest Price',
    hook: 'Beat the price you saw elsewhere',
    why: (n) => `Our most affordable ${n.toLowerCase()} — clean, professional, and priced to win the comparison.`,
    finishing: [],
  },
}

const MODE_SUMMARY: Record<CurationMode, string> = {
  premium: 'You want the best — no compromise. Compare your options, top-tier highlighted.',
  value: 'Premium feel, sensible price. Compare your options, best value highlighted.',
  cheap: 'Lowest price wins. Compare your options, the most affordable highlighted.',
}

function pickProductForMode(pool: CurationProduct[], mode: CurationMode): CurationProduct | undefined {
  if (!pool.length) return undefined
  if (mode === 'premium') {
    return [...pool].sort((a, b) => Number(b.isPremium) - Number(a.isPremium) || b.fromUsd - a.fromUsd)[0]
  }
  if (mode === 'cheap') {
    return [...pool].sort((a, b) => a.fromUsd - b.fromUsd)[0]
  }
  // value: 프리미엄 우선, 가격 중앙값 근처
  const byPrice = [...pool].sort((a, b) => a.fromUsd - b.fromUsd)
  const premiumMid = byPrice.filter((p) => p.isPremium)
  const src = premiumMid.length ? premiumMid : byPrice
  return src[Math.floor(src.length * 0.5)] ?? src[0]
}

/**
 * 프리셋 후킹 → Good/Better/Best 3단 비교 큐레이션(결정론적, LLM 불필요).
 * 항상 cheap→value→premium 순으로 보여주고, value=중간 앵커("Most popular"),
 * 고객이 고른 mode 의 카드에 highlight. group 주어지면 해당 제품군으로 한정.
 */
export function heuristicCuration(
  catalog: CurationProduct[],
  highlightMode: CurationMode,
  group?: string,
): CurationResult {
  const scoped = group ? catalog.filter((p) => SLUG_TO_GROUP[p.slug] === group) : catalog
  const pool = (scoped.length ? scoped : catalog).filter((p) => p.fromUsd > 0)

  const order: CurationMode[] = ['cheap', 'value', 'premium']
  const usedSlugs = new Set<string>()
  const picks: CurationPick[] = []

  for (const mode of order) {
    const remaining = pool.filter((p) => !usedSlugs.has(p.slug))
    const product = pickProductForMode(remaining.length ? remaining : pool, mode)
    if (!product) continue
    usedSlugs.add(product.slug)
    const copy = MODE_COPY[mode]
    const finishing = copy.finishing.filter((f) => FINISHING_BY_VALUE[f]?.fits.includes(product.category))
    const pick = toPick(catalog, {
      slug: product.slug,
      tier: copy.tier,
      hook: copy.hook,
      why: copy.why(product.name),
      finishing,
      quantity: null,
      badge: mode === 'value' ? 'Most popular' : null,
      highlight: mode === highlightMode,
    })
    if (pick) picks.push(pick)
  }

  return { summary: MODE_SUMMARY[highlightMode], heuristic: true, picks }
}
