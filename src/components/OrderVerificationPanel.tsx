'use client'

// OMO-2830: 주문 교차검증 패널
// "초반에는 고객이 주문한거랑 우리가 주문한거랑 전체스펙/수량 맞는지, 금액 비교,
//  마진금액 계산, 배송비 확인" — 각 오더마다 운영자가 발주 전 육안+자동 점검하는 창.
//
// 데이터 출처:
//  - 고객 주문: print_order_items (selected_options / quantity / subtotal_usd)
//  - 우리 발주: print_factory_orders (options_snapshot / quantity) — item별 링크
//  - 원가 추정: 상품 margin_multiplier (sell ÷ 배수 = 추정 원가, 프로모션 로직과 동일)
//  - 배송: print_shipments cost_usd(실 FedEx 원가) vs 고객 청구 shipping_usd
//
// 스펙 일치는 자동 판정하지 않는다(성원 카테고리 옵션 키와 내부 옵션 키가 달라 오탐 위험).
// 자동 점검은 직접 비교 가능한 항목(발주 연결 / 수량 / 마진 양수 / 배송 원가)만 판정하고,
// 스펙은 좌우 병치로 보여주고 육안 확인을 권고한다.

interface VItem {
  id: string
  product_name_en: string
  selected_options: Record<string, string>
  quantity: number
  subtotal_usd: number
  print_products?: { margin_multiplier: number | null; base_price_krw: number | null } | null
}

interface VFactoryOrder {
  id: string
  print_order_item_id: string | null
  status: string
  category_code: string
  options_snapshot: Record<string, string>
  quantity: number
}

interface VShipment {
  id: string
  cost_usd: number | null
  charged_usd: number | null
  status: string
}

interface VOrder {
  subtotal_usd: number
  shipping_usd: number
  total_usd: number
  print_order_items: VItem[]
}

const DEFAULT_MULTIPLIER = 3.3

function usd(n: number): string {
  return `$${n.toFixed(2)}`
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}

type CheckTone = 'ok' | 'warn' | 'info'

function Check({ tone, label }: { tone: CheckTone; label: string }) {
  const icon = tone === 'ok' ? '✓' : tone === 'warn' ? '⚠' : 'ℹ'
  const cls =
    tone === 'ok'
      ? 'bg-green-100 text-green-700'
      : tone === 'warn'
        ? 'bg-red-100 text-red-700'
        : 'bg-blue-100 text-blue-700'
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      <span aria-hidden>{icon}</span>
      {label}
    </span>
  )
}

export function OrderVerificationPanel({
  order,
  factoryOrders,
  shipments,
}: {
  order: VOrder
  factoryOrders: VFactoryOrder[]
  shipments: VShipment[]
}) {
  const items = order.print_order_items ?? []

  // item → 연결된 발주 목록
  const factoryByItem = new Map<string, VFactoryOrder[]>()
  const unlinkedFactory: VFactoryOrder[] = []
  for (const fo of factoryOrders) {
    if (fo.status === 'cancelled') continue
    if (fo.print_order_item_id) {
      const arr = factoryByItem.get(fo.print_order_item_id) ?? []
      arr.push(fo)
      factoryByItem.set(fo.print_order_item_id, arr)
    } else {
      unlinkedFactory.push(fo)
    }
  }

  // 상품 원가/마진 추정
  let estProductCost = 0
  const rows = items.map((item) => {
    const mult = item.print_products?.margin_multiplier || DEFAULT_MULTIPLIER
    const estCost = item.subtotal_usd / mult
    estProductCost += estCost
    const margin = item.subtotal_usd - estCost
    const linked = factoryByItem.get(item.id) ?? []
    const factoryQty = linked.reduce((s, f) => s + (f.quantity ?? 0), 0)
    const hasFactory = linked.length > 0
    const qtyMatch = hasFactory && factoryQty === item.quantity
    return { item, mult, estCost, margin, linked, factoryQty, hasFactory, qtyMatch }
  })

  const productSell = order.subtotal_usd
  const productMargin = productSell - estProductCost

  // 배송: 실 원가 vs 고객 청구
  const activeShipments = shipments.filter((s) => s.status !== 'cancelled')
  const hasShipment = activeShipments.length > 0
  const actualShipCost = activeShipments.reduce((s, sh) => s + (sh.cost_usd ?? 0), 0)
  const customerShip = order.shipping_usd
  const shipMargin = customerShip - actualShipCost

  const totalMargin = productMargin + (hasShipment ? shipMargin : 0)
  const totalRevenue = order.total_usd
  const totalMarginPct = totalRevenue > 0 ? totalMargin / totalRevenue : 0

  // 자동 점검 종합
  const allLinked = rows.length > 0 && rows.every((r) => r.hasFactory)
  const allQtyMatch = rows.every((r) => r.qtyMatch)
  const marginPositive = productMargin > 0 && (!hasShipment || shipMargin >= 0)
  const autoPass = allLinked && allQtyMatch && marginPositive

  return (
    <div className="bg-white rounded-lg shadow p-5 space-y-5 border-l-4 border-indigo-400">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="font-semibold text-gray-700">주문 교차검증</h2>
          <p className="text-xs text-gray-400 mt-0.5">발주 전 고객 주문 ↔ 우리 발주 대조 · 금액/마진/배송 점검</p>
        </div>
        {autoPass ? (
          <Check tone="ok" label="자동 점검 통과 · 스펙 육안 확인 권장" />
        ) : (
          <Check tone="warn" label="검토 필요" />
        )}
      </div>

      {/* 항목별 대조 */}
      <div className="space-y-3">
        {rows.map(({ item, mult, estCost, margin, linked, factoryQty, hasFactory, qtyMatch }) => (
          <div key={item.id} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="font-medium text-sm">{item.product_name_en}</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {!hasFactory ? (
                  <Check tone="warn" label="발주 미연결" />
                ) : qtyMatch ? (
                  <Check tone="ok" label={`수량 일치 (${item.quantity})`} />
                ) : (
                  <Check tone="warn" label={`수량 불일치 고객 ${item.quantity} ≠ 발주 ${factoryQty}`} />
                )}
              </div>
            </div>

            {/* 스펙 좌우 병치 (육안 확인) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-gray-50 rounded p-2.5">
                <p className="font-medium text-gray-500 mb-1">고객 주문 스펙</p>
                <ul className="space-y-0.5 text-gray-700">
                  {Object.entries(item.selected_options).map(([k, v]) => (
                    <li key={k}>
                      <span className="text-gray-400">{k}:</span> {v}
                    </li>
                  ))}
                  <li><span className="text-gray-400">수량:</span> {item.quantity}</li>
                </ul>
              </div>
              <div className="bg-indigo-50/60 rounded p-2.5">
                <p className="font-medium text-gray-500 mb-1">우리 발주 스펙</p>
                {hasFactory ? (
                  linked.map((fo) => (
                    <div key={fo.id} className="space-y-0.5 text-gray-700">
                      <p><span className="text-gray-400">카테고리:</span> {fo.category_code}</p>
                      {Object.entries(fo.options_snapshot).map(([k, v]) => (
                        <p key={k}><span className="text-gray-400">{k}:</span> {v}</p>
                      ))}
                      <p><span className="text-gray-400">수량:</span> {fo.quantity}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400">발주 기록 없음 — 발주 후 재확인</p>
                )}
              </div>
            </div>

            {/* 금액/마진 */}
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs border-t pt-2.5">
              <span><span className="text-gray-400">판매가:</span> {usd(item.subtotal_usd)}</span>
              <span><span className="text-gray-400">추정 원가(÷{mult}):</span> {usd(estCost)}</span>
              <span className={margin > 0 ? 'text-green-700' : 'text-red-600'}>
                <span className="text-gray-400">마진:</span> {usd(margin)} ({pct(item.subtotal_usd > 0 ? margin / item.subtotal_usd : 0)})
              </span>
              {item.print_products?.base_price_krw != null && (
                <span className="text-gray-400">원가표 ₩{item.print_products.base_price_krw.toLocaleString('ko-KR')}/단위</span>
              )}
            </div>
          </div>
        ))}

        {unlinkedFactory.length > 0 && (
          <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 text-xs text-amber-700">
            <Check tone="warn" label="항목 미연결 발주" /> {unlinkedFactory.length}건의 발주가 특정 주문 항목과 연결되지 않았습니다. 육안 확인 필요.
          </div>
        )}
      </div>

      {/* 합계 / 배송 / 마진 요약 */}
      <div className="border-t pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-400 uppercase">상품</p>
          <div className="flex justify-between"><span className="text-gray-500">판매 합계</span><span>{usd(productSell)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">추정 원가</span><span>{usd(estProductCost)}</span></div>
          <div className={`flex justify-between font-medium ${productMargin > 0 ? 'text-green-700' : 'text-red-600'}`}>
            <span>상품 마진</span><span>{usd(productMargin)}</span>
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-400 uppercase">배송</p>
          <div className="flex justify-between"><span className="text-gray-500">고객 청구 배송비</span><span>{usd(customerShip)}</span></div>
          {hasShipment ? (
            <>
              <div className="flex justify-between"><span className="text-gray-500">실 FedEx 원가</span><span>{usd(actualShipCost)}</span></div>
              <div className={`flex justify-between font-medium ${shipMargin >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                <span>배송 마진</span><span>{usd(shipMargin)}</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between text-gray-400"><span>실 배송 원가</span><span>송장 생성 전</span></div>
          )}
        </div>
      </div>

      <div className="border-t pt-3 flex items-center justify-between">
        <span className="font-semibold text-gray-700">총 추정 마진</span>
        <span className={`font-bold ${totalMargin > 0 ? 'text-green-700' : 'text-red-600'}`}>
          {usd(totalMargin)} <span className="text-xs font-normal text-gray-400">({pct(totalMarginPct)} of {usd(totalRevenue)})</span>
        </span>
      </div>

      <p className="text-[11px] text-gray-400 leading-relaxed">
        ※ 원가는 상품 마진배수 기준 추정값(옵션별 실 원가 미반영). 스펙 일치는 자동 판정하지 않으니
        위 좌우 스펙을 육안 대조 후 발주하세요. 배송 마진은 송장 생성(FedEx 원가 확정) 후 표시됩니다.
      </p>
    </div>
  )
}
