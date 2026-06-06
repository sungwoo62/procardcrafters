/**
 * 공장 발주 큐 관리 (serverless 호환)
 *
 * 결제 웹훅에서 호출 가능. DB insert만 수행하며 Playwright를 직접 실행하지 않는다.
 * 실제 Playwright 발주는 scripts/place-factory-orders.ts 에서 처리한다.
 */

import { createServerClient } from '@/lib/supabase'

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

export function toCategoryCode(productNameEn: string): string {
  const slug = productNameEn.toLowerCase().replace(/\s+/g, '-')
  return SLUG_TO_CATEGORY[slug] ?? 'UNKNOWN'
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
    .in('status', ['pending', 'placing', 'placed'])
    .limit(1)

  if (existing && existing.length > 0) return

  const inserts = items.map((item) => ({
    print_order_id: printOrderId,
    print_order_item_id: item.id,
    status: 'pending',
    category_code: toCategoryCode(item.product_name_en),
    options_snapshot: item.selected_options ?? {},
    quantity: item.quantity,
  }))

  await supabase.from('print_factory_orders').insert(inserts)
}
