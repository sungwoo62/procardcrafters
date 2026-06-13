/**
 * 공장 발주 큐 관리 (serverless 호환)
 *
 * 결제 웹훅에서 호출 가능. DB insert만 수행하며 Playwright를 직접 실행하지 않는다.
 * 실제 Playwright 발주는 scripts/place-factory-orders.ts 에서 처리한다.
 */

import { createServerClient } from '@/lib/supabase'
import { expandFinishingToSwadpiaFields } from '@/config/swadpia-finishing-fields'
import { PRESS_ROUTES, resolvePressCategoryCode } from '@/lib/swadpia'

// 내부 상품명 → Swadpia 카테고리 코드 매핑
const SLUG_TO_CATEGORY: Record<string, string> = {
  'business-cards':         'CNC1000',
  'premium-business-cards': 'CNC2000',
  'stickers':               'CST1000',
  'die-cut-stickers':       'CST2000',
  'flyers':                 'CLF1000',
  'brochures':              'CLF2000',
  'postcards':              'CDP3000',
  'posters':                'CPR2000',
  'banners':                'CPR5000',
}

export function productNameToSlug(productNameEn: string): string {
  return productNameEn.toLowerCase().replace(/\s+/g, '-')
}

export function toCategoryCode(productNameEn: string): string {
  return SLUG_TO_CATEGORY[productNameToSlug(productNameEn)] ?? 'UNKNOWN'
}

/**
 * OMO-3061: 발주용 category_code 를 수량 기반 프레스 라우팅으로 결정한다.
 * 듀얼 프레스 제품(PRESS_ROUTES)이면 라이브 가격을 비교해 그 수량의 최저가 프레스를
 * 고른다(고객이 견적받은 것과 동일). 그 외엔 기존 sync 매핑(toCategoryCode) 그대로.
 */
export async function resolveOrderCategoryCode(
  productNameEn: string,
  quantity: number,
): Promise<string> {
  const slug = productNameToSlug(productNameEn)
  if (PRESS_ROUTES[slug]) {
    return resolvePressCategoryCode(slug, quantity, toCategoryCode(productNameEn))
  }
  return toCategoryCode(productNameEn)
}

interface OrderItemLike {
  id: string
  product_name_en: string
  selected_options: Record<string, string>
  quantity: number
}

/**
 * 결제 완료 시 모든 주문 아이템에 대해 print_factory_orders 레코드를 생성한다.
 * 이미 pending/placing/placed 발주가 있으면 중복 생성하지 않는다.
 */
export async function queueFactoryOrdersForPrintOrder(
  printOrderId: string,
  items: OrderItemLike[],
): Promise<void> {
  if (!items || items.length === 0) return

  const supabase = createServerClient()

  // 기존 발주 여부 확인
  const { data: existing } = await supabase
    .from('print_factory_orders')
    .select('id')
    .eq('print_order_id', printOrderId)
    .in('status', ['pending', 'placing', 'placed', 'paid'])
    .limit(1)

  if (existing && existing.length > 0) return

  const inserts = await Promise.all(
    items.map(async (item) => ({
      print_order_id: printOrderId,
      print_order_item_id: item.id,
      status: 'pending',
      // OMO-3061: 수량 기반 프레스 라우팅(듀얼 프레스 제품은 소량→디지털/대량→옵셋).
      category_code: await resolveOrderCategoryCode(item.product_name_en, item.quantity),
      // 후가공(finishing)을 성원 발주 폼 필드코드로 확장(OMO-2635). finishing 키 없으면 무영향.
      options_snapshot: expandFinishingToSwadpiaFields(item.selected_options ?? {}),
      quantity: item.quantity,
    })),
  )

  await supabase.from('print_factory_orders').insert(inserts)
}
