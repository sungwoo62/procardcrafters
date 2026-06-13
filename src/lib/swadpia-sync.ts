/**
 * Swadpia 도매가 → print_products.base_price_krw 자동 sync (OMO-3072)
 *
 * 기존 두 라우트(admin/sync-prices, cron/update-prices)가 각각
 *  - category_code → slug **1개**만 처리하는 역매핑을 갖고 있어, 같은 카테고리를
 *    공유하는 collapse 제품(x-banners/rollup 등)은 아예 sync 되지 않았고,
 *  - 동일한 비결정적 extractBasePrice 를 중복 정의했다.
 *
 * 이 모듈은 **제품별 루프**로 통일한다:
 *  1) 활성 제품 각각의 category_code 를 CATEGORY_MAP 으로 해석
 *  2) 카테고리당 1회만 fetch (대표 slug 사용) 후 같은 카테고리 제품들이 재사용
 *  3) deriveProductBasePriceKrw 로 제품별 결정적 기준단가 산출
 *     (quote-only/no-matrix 는 null → 업데이트 건너뜀, history 에는 사유 기록)
 */

import { fetchSwadpiaCategoryData, CATEGORY_MAP, type SwadpiaCategoryData } from './swadpia'
import { deriveProductBasePriceKrw } from './swadpia-base-price'
import { createServerClient } from './supabase'

type SupabaseClient = ReturnType<typeof createServerClient>

export interface SyncProduct {
  id: string
  slug: string
  base_price_krw: number | string | null
}

export interface SwadpiaSyncResult {
  slug: string
  success: boolean
  priceChanged: boolean
  skipped: boolean
  mode?: string
  reason?: string
  prevPrice?: number
  newPrice?: number | null
  fetchSuccess?: boolean
  error?: string
}

/**
 * 주어진 제품 목록을 Swadpia 도매가로 sync 한다.
 * @param source price_history.source 값 ('cron' | 'manual')
 */
export async function runSwadpiaSync(
  supabase: SupabaseClient,
  products: SyncProduct[],
  source: 'cron' | 'manual',
): Promise<SwadpiaSyncResult[]> {
  // 1) 카테고리별 제품 그룹핑 (매핑 없는 제품은 제외)
  const byCategory = new Map<string, SyncProduct[]>()
  for (const p of products) {
    const code = CATEGORY_MAP[p.slug]
    if (!code) continue
    const list = byCategory.get(code)
    if (list) list.push(p)
    else byCategory.set(code, [p])
  }

  // 2) 카테고리당 1회 fetch (대표 slug). 같은 카테고리 제품이 재사용.
  const dataByCategory = new Map<string, SwadpiaCategoryData>()
  await Promise.all(
    [...byCategory.entries()].map(async ([code, prods]) => {
      const data = await fetchSwadpiaCategoryData(prods[0].slug)
      dataByCategory.set(code, data)
    }),
  )

  // 3) 제품별 결정적 산출 + 기록/업데이트
  const results: SwadpiaSyncResult[] = []
  for (const [code, prods] of byCategory.entries()) {
    const data = dataByCategory.get(code)
    if (!data) continue

    for (const product of prods) {
      const prevPrice = Number(product.base_price_krw ?? 0)
      const derived = deriveProductBasePriceKrw(product.slug, data)
      const newPrice = derived.priceKrw
      const isSkip = newPrice === null
      const priceChanged =
        newPrice !== null && newPrice > 0 && Math.abs(prevPrice - newPrice) > 0.01

      const { error: historyError } = await supabase.from('print_price_history').insert({
        product_id: product.id,
        product_slug: product.slug,
        prev_price_krw: prevPrice,
        new_price_krw: newPrice ?? prevPrice,
        price_changed: priceChanged,
        source_data: {
          mode: derived.mode,
          reason: derived.reason ?? null,
          papers: data.papers.length,
          printEntries: data.printEntries.length,
          sizes: data.sizes.length,
        },
        fetch_success: data.fetchSuccess,
        error_message: derived.reason ?? data.errorMessage ?? null,
        source,
      })

      if (historyError) {
        results.push({
          slug: product.slug,
          success: false,
          priceChanged: false,
          skipped: false,
          error: historyError.message,
        })
        continue
      }

      if (priceChanged && data.fetchSuccess) {
        const { error: updateError } = await supabase
          .from('print_products')
          .update({ base_price_krw: newPrice })
          .eq('id', product.id)
        if (updateError) {
          results.push({
            slug: product.slug,
            success: false,
            priceChanged,
            skipped: false,
            mode: derived.mode,
            error: updateError.message,
          })
          continue
        }
      }

      results.push({
        slug: product.slug,
        success: true,
        priceChanged,
        skipped: isSkip,
        mode: derived.mode,
        reason: derived.reason,
        prevPrice,
        newPrice,
        fetchSuccess: data.fetchSuccess,
        error: data.errorMessage,
      })
    }
  }

  return results
}
