// OMO-3058: 주문 순손익 서버 계산 — 실측 배송비 확정(송장 무게 입력) 후 손해 자동경보용.
// OrderVerificationPanel 의 원가 로직과 동일: 실원가(발주 실결제) → 원가표(base_price_krw×수량÷환율)
// → 배수 폴백(판매가÷margin) 순. 순손익 = 매출(total) − 상품원가 − 실 배송원가.
import type { createServerClient } from '@/lib/supabase'

const DEFAULT_MULTIPLIER = 3.3
const DEFAULT_RATE = 1300 // KRW per USD 폴백(promotion-engine·패널과 동일)

export interface OrderNetProfit {
  netUsd: number
  revenueUsd: number
  productCostUsd: number
  actualShipUsd: number
  hasActualShip: boolean
}

export async function computeOrderNetProfit(
  supabase: ReturnType<typeof createServerClient>,
  orderId: string,
): Promise<OrderNetProfit | null> {
  const { data: order } = await supabase
    .from('print_orders')
    .select(
      'total_usd, exchange_rate_krw_usd, print_order_items(id, subtotal_usd, quantity, print_products(base_price_krw, margin_multiplier))',
    )
    .eq('id', orderId)
    .maybeSingle()
  if (!order) return null

  const rate = Number(order.exchange_rate_krw_usd) || DEFAULT_RATE
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = (order as any).print_order_items ?? []
  const itemIds = items.map((it) => it.id).filter(Boolean)

  // 발주 실원가(있으면 우선)
  const factoryByItem = new Map<string, number[]>()
  if (itemIds.length) {
    const { data: factory } = await supabase
      .from('print_factory_orders')
      .select('print_order_item_id, actual_cost_usd')
      .in('print_order_item_id', itemIds)
    for (const f of factory ?? []) {
      if (f.print_order_item_id == null) continue
      const list = factoryByItem.get(f.print_order_item_id) ?? []
      if (f.actual_cost_usd != null) list.push(Number(f.actual_cost_usd))
      factoryByItem.set(f.print_order_item_id, list)
    }
  }

  let productCostUsd = 0
  for (const item of items) {
    const linked = factoryByItem.get(item.id) ?? []
    const allActual = linked.length > 0
    const pp = item.print_products ?? {}
    const mult = Number(pp.margin_multiplier) || DEFAULT_MULTIPLIER
    const baseKrw = Number(pp.base_price_krw) || 0
    const subtotal = Number(item.subtotal_usd) || 0
    const qty = Number(item.quantity) || 1
    const cost = allActual
      ? linked.reduce((s, v) => s + v, 0)
      : baseKrw > 0
        ? (baseKrw * qty) / rate
        : subtotal / mult
    productCostUsd += cost
  }

  const { data: ships } = await supabase
    .from('print_shipments')
    .select('cost_usd, status')
    .eq('order_id', orderId)
  const active = (ships ?? []).filter((s) => s.status !== 'cancelled')
  const actualShipUsd = active.reduce((s, sh) => s + (Number(sh.cost_usd) || 0), 0)

  const revenueUsd = Number(order.total_usd) || 0
  const netUsd = revenueUsd - productCostUsd - actualShipUsd

  return {
    netUsd: Math.round(netUsd * 100) / 100,
    revenueUsd: Math.round(revenueUsd * 100) / 100,
    productCostUsd: Math.round(productCostUsd * 100) / 100,
    actualShipUsd: Math.round(actualShipUsd * 100) / 100,
    hasActualShip: active.length > 0,
  }
}
