'use client'

// OMO-2830: 주문 교차검증 패널
// "초반에는 고객이 주문한거랑 우리가 주문한거랑 전체스펙/수량 맞는지, 금액 비교,
//  마진금액 계산, 배송비 확인" — 각 오더마다 운영자가 발주 전 육안+자동 점검하는 창.
//
// 데이터 출처:
//  - 고객 주문: print_order_items (selected_options / quantity / subtotal_usd)
//  - 우리 발주: print_factory_orders (options_snapshot / quantity / actual_cost_*) — item별 링크
//  - 원가: ① 발주 실원가(actual_cost_usd) 우선 ② base_price_krw×수량÷환율 추정
//          ③ 판매가÷margin_multiplier 폴백
//  - 배송: print_shipments cost_usd(실 FedEx 원가) vs 고객 청구 shipping_usd
//
// 스펙 점검(OMO-2830 보드 결정): 좌우 병치 육안확인 + 자동 프리셋 일치 메시지 둘 다 제공.
// 발주 options_snapshot 은 큐 등록 시 expandFinishingToSwadpiaFields(고객 selected_options)로
// 생성되므로, 같은 변환을 고객 선택에 적용해 발주 스냅샷과 대조하면 사후 드리프트
// (주문 수정 등)를 자동 감지할 수 있다.

import { expandFinishingToSwadpiaFields } from '@/config/swadpia-finishing-fields'

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
  actual_cost_krw?: number | null
  actual_cost_usd?: number | null
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
  exchange_rate_krw_usd: number | null
  print_order_items: VItem[]
}

const DEFAULT_MULTIPLIER = 3.3
const DEFAULT_RATE = 1300 // KRW per USD (promotion-engine 폴백과 동일)

// OMO-2830: 실원가 확정 후 차이 대처 임계값
const COST_OVERRUN_ALERT = 0.2 // 실원가가 예상 대비 +20% 초과 → 경보
const MARGIN_FLOOR_PCT = 0.15 // 항목 마진율 15% 미만 → 경보

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

type CostBasis = 'actual' | 'estimate_master' | 'estimate_multiplier'

const COST_BASIS_LABEL: Record<CostBasis, string> = {
  actual: '실원가',
  estimate_master: '추정(원가표)',
  estimate_multiplier: '추정(배수)',
}

// 고객 선택을 발주 변환과 동일하게 펼친 뒤 발주 스냅샷과 대조 → 자동 프리셋 일치 점검
function comparePreset(
  selected: Record<string, string>,
  snapshot: Record<string, string>,
): { ok: boolean; diffs: string[] } {
  const expected = expandFinishingToSwadpiaFields(selected ?? {})
  const diffs: string[] = []
  const keys = new Set([...Object.keys(expected), ...Object.keys(snapshot ?? {})])
  for (const k of keys) {
    const e = expected[k]
    const a = (snapshot ?? {})[k]
    if (e !== undefined && a !== undefined) {
      if (String(e) !== String(a)) diffs.push(`${k}: 고객 '${e}' ≠ 발주 '${a}'`)
    } else if (e !== undefined && a === undefined) {
      diffs.push(`${k}: 발주에 미반영(고객 '${e}')`)
    } else if (e === undefined && a !== undefined) {
      diffs.push(`${k}: 발주에만 존재('${a}')`)
    }
  }
  return { ok: diffs.length === 0, diffs }
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
  const rate = Number(order.exchange_rate_krw_usd) || DEFAULT_RATE

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

  let totalCost = 0
  const rows = items.map((item) => {
    const linked = factoryByItem.get(item.id) ?? []
    const hasFactory = linked.length > 0
    const factoryQty = linked.reduce((s, f) => s + (f.quantity ?? 0), 0)
    const qtyMatch = hasFactory && factoryQty === item.quantity

    // 원가 결정: 실원가 우선 → 원가표(base_price_krw) → 배수 폴백
    const actualVals = linked.map((f) => f.actual_cost_usd).filter((v) => v != null) as number[]
    const allActual = hasFactory && actualVals.length === linked.length && linked.length > 0
    const mult = item.print_products?.margin_multiplier || DEFAULT_MULTIPLIER
    const baseKrw = item.print_products?.base_price_krw
    // 예상 원가(실원가와 무관한 추정 기준값) — 차이 비교용
    const expectedCost = baseKrw != null && baseKrw > 0
      ? (baseKrw * item.quantity) / rate
      : item.subtotal_usd / mult
    const actualCost = allActual ? actualVals.reduce((s, v) => s + v, 0) : null

    const cost = actualCost != null ? actualCost : expectedCost
    const basis: CostBasis = actualCost != null
      ? 'actual'
      : baseKrw != null && baseKrw > 0
        ? 'estimate_master'
        : 'estimate_multiplier'
    totalCost += cost
    const margin = item.subtotal_usd - cost
    const marginPct = item.subtotal_usd > 0 ? margin / item.subtotal_usd : 0

    // OMO-2830: 실원가 확정 시 차이 감지(원가초과/마진음수/저마진)
    let alert: { severity: 'critical' | 'warn'; overrunPct: number | null; reasons: string[] } | null = null
    if (actualCost != null) {
      const overrunPct = expectedCost > 0 ? (actualCost - expectedCost) / expectedCost : null
      const reasons: string[] = []
      if (margin < 0) reasons.push('마진 음수(손해)')
      else if (marginPct < MARGIN_FLOOR_PCT) reasons.push(`저마진(${pct(marginPct)})`)
      if (overrunPct != null && overrunPct > COST_OVERRUN_ALERT) reasons.push(`실원가 예상 대비 +${pct(overrunPct)}`)
      if (reasons.length > 0) {
        alert = { severity: margin < 0 ? 'critical' : 'warn', overrunPct, reasons }
      }
    }

    // 자동 프리셋 일치 점검(발주 연결된 경우만)
    const preset = hasFactory ? comparePreset(item.selected_options, linked[0].options_snapshot) : null

    return { item, mult, baseKrw, cost, expectedCost, basis, margin, marginPct, alert, linked, factoryQty, hasFactory, qtyMatch, preset }
  })

  // 차이 감지된 항목 모음(대처 배너용)
  const costAlerts = rows.filter((r) => r.alert)
  const hasCostAlert = costAlerts.length > 0

  const productSell = order.subtotal_usd
  const productMargin = productSell - totalCost
  const anyEstimated = rows.some((r) => r.basis !== 'actual')

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
  const allPresetOk = rows.every((r) => r.preset?.ok)
  const marginPositive = productMargin > 0 && (!hasShipment || shipMargin >= 0)
  const autoPass = allLinked && allQtyMatch && allPresetOk && marginPositive && !hasCostAlert

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

      {/* OMO-2830: 실원가 차이 대처 배너 */}
      {hasCostAlert && (
        <div className="rounded-lg border-2 border-red-300 bg-red-50 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-red-700 font-semibold text-sm">⚠ 실원가 차이 감지 — 대처 필요</span>
            {costAlerts.some((r) => r.alert?.severity === 'critical') && (
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-600 text-white">손해 주문</span>
            )}
          </div>
          <ul className="text-xs text-red-700 list-disc list-inside space-y-0.5">
            {costAlerts.map((r) => (
              <li key={r.item.id}>
                <b>{r.item.product_name_en}</b>: 실원가 {usd(r.cost)} (예상 {usd(r.expectedCost)}) · 마진 {usd(r.margin)} ({pct(r.marginPct)})
                {' — '}{r.alert!.reasons.join(', ')}
              </li>
            ))}
          </ul>
          <div className="text-xs text-gray-600 bg-white/60 rounded p-2 leading-relaxed">
            <p className="font-medium text-gray-700 mb-1">대처 가이드</p>
            <p>① 성원 결제내역에서 실원가가 맞는지 재확인(자동 캡처 오독 가능 → 발주 카드에서 수동 보정).</p>
            <p>② 원인 점검: 옵션 추가단가 미반영 / 성원 가격 인상 / 상품가 책정 오류 / 수량·스펙 변경.</p>
            <p>③ <b>마진 음수면 발송 보류</b> 후 상품가 조정·고객 추가청구·사양 협의 중 택일. 단순 단가표 오류면 상품 base_price_krw / margin_multiplier 수정.</p>
          </div>
        </div>
      )}

      {/* 항목별 대조 */}
      <div className="space-y-3">
        {rows.map(({ item, mult, baseKrw, cost, basis, margin, alert, linked, factoryQty, hasFactory, qtyMatch, preset }) => (
          <div key={item.id} className={`border rounded-lg p-4 space-y-3 ${alert ? 'border-red-300' : ''}`}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="font-medium text-sm">{item.product_name_en}</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {alert && (
                  <Check tone="warn" label={alert.severity === 'critical' ? '손해' : '마진 경보'} />
                )}
                {!hasFactory ? (
                  <Check tone="warn" label="발주 미연결" />
                ) : qtyMatch ? (
                  <Check tone="ok" label={`수량 일치 (${item.quantity})`} />
                ) : (
                  <Check tone="warn" label={`수량 불일치 고객 ${item.quantity} ≠ 발주 ${factoryQty}`} />
                )}
              </div>
            </div>

            {/* 자동 프리셋 일치 메시지 */}
            {hasFactory && preset && (
              preset.ok ? (
                <div className="text-xs">
                  <Check tone="ok" label="사전 프리셋 자동 일치 — 발주 스펙 = 고객 선택" />
                </div>
              ) : (
                <div className="text-xs bg-red-50 border border-red-100 rounded p-2 space-y-1">
                  <Check tone="warn" label="사전 프리셋 불일치 자동 감지" />
                  <ul className="list-disc list-inside text-red-700">
                    {preset.diffs.map((d, i) => <li key={i}>{d}</li>)}
                  </ul>
                </div>
              )
            )}

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
              <span>
                <span className="text-gray-400">원가:</span> {usd(cost)}
                <span className={`ml-1 px-1 rounded ${basis === 'actual' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {COST_BASIS_LABEL[basis]}
                </span>
              </span>
              <span className={margin > 0 ? 'text-green-700' : 'text-red-600'}>
                <span className="text-gray-400">마진:</span> {usd(margin)} ({pct(item.subtotal_usd > 0 ? margin / item.subtotal_usd : 0)})
              </span>
              {basis !== 'actual' && baseKrw != null && (
                <span className="text-gray-400">원가표 ₩{baseKrw.toLocaleString('ko-KR')}/단위</span>
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
          <div className="flex justify-between">
            <span className="text-gray-500">원가 {anyEstimated ? '(일부 추정)' : '(실원가)'}</span>
            <span>{usd(totalCost)}</span>
          </div>
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
        ※ 원가는 <b>실원가</b>(발주 실 결제액 입력 시) → <b>원가표</b>(base_price_krw×수량÷환율) → <b>배수</b>(판매가÷마진배수) 순으로 결정.
        실원가 입력 전에는 추정값입니다. 스펙은 자동 프리셋 일치 점검(발주↔고객) + 좌우 육안 대조 둘 다 제공하니
        발주 전 확인하세요. 배송 마진은 송장 생성(FedEx 원가 확정) 후 표시됩니다.
      </p>
    </div>
  )
}
