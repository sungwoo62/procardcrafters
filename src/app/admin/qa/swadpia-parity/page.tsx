'use client'

// OMO-2903 ⑤ 런칭점검 비교 웹페이지 — 고객주문 ↔ 성원발주 좌우 대조 QA 증거.
//   기존 OrderVerificationPanel(OMO-2830) 재사용. 대표 카테고리 3종의 테스트 스펙에 대해
//   고객 selected_options ↔ 우리 발주 options_snapshot(=expandFinishingToSwadpiaFields)을
//   병치하고 스펙/수량/후가공/마진 자동 일치판정을 보여준다.
//
//   ⚠️ 비용가드: 성원 실발주 없음. 발주 스냅샷은 큐 등록과 동일한 변환(코드)으로 합성하여
//      "고객선택 → 성원폼 필드" 매핑 정합성을 무브라우저로 증명한다. 실제 성원 폼 스샷은
//      로컬 Playwright 러너 dry-run(자식 이슈)에서 캡처한다.
//
//   인증/비SEO → 정적 프리렌더 제외.
export const dynamic = 'force-dynamic'

import { expandFinishingToSwadpiaFields } from '@/config/swadpia-finishing-fields'
import { OrderVerificationPanel } from '@/components/OrderVerificationPanel'

const RATE = 1300 // KRW per USD (패널 폴백과 동일)
const MARGIN = 3.3

// 대표 테스트 스펙 3종 (OMO-2902 파리티 ✅ 카테고리에서 서로 다른 3개 선택).
// base_price_krw 는 db-option-linkage 감사값(2026-06-11)과 일치.
type TestSpec = {
  key: string
  label: string
  categoryCode: string
  basePriceKrw: number
  // 고객 에디터 선택(= print_order_items.selected_options)
  customerOptions: Record<string, string>
  // 가격이동 옵션 extra_price_krw 합(브로슈어/포스터 등 db 감사 기준 대표값)
  extraKrw: number
  quantity: number
}

const SPECS: TestSpec[] = [
  {
    key: 'bc',
    label: '① 명함 (business-cards / CNC1000)',
    categoryCode: 'CNC1000',
    basePriceKrw: 4000,
    quantity: 500,
    extraKrw: 3000 + 12000, // paper_code(SNW300W00) + paper_qty(500)
    customerOptions: {
      paper_code: 'SNW300W00',
      paper_size: '90x50',
      paper_qty: '500',
      print_color_type: 'PCT10',
      finishing: 'foil_stamp,drilled_hole', // 자동발주(mapped) 2종
    },
  },
  {
    key: 'poster',
    label: '② 포스터 (posters / CPR2000)',
    categoryCode: 'CPR2000',
    basePriceKrw: 64000,
    quantity: 100,
    extraKrw: 12000 + 30000, // paper_code + paper_size
    customerOptions: {
      paper_code: 'MGC120CG0',
      paper_size: 'A2',
      paper_qty: '100',
      finishing: '', // 자동 후가공 없음(포스터)
    },
  },
  {
    key: 'booklet',
    label: '③ 책자 (saddle-stitch-booklet / CPR4000)',
    categoryCode: 'CPR4000',
    basePriceKrw: 64000,
    quantity: 200,
    extraKrw: 5000 + 70000, // paper_code + paper_qty
    customerOptions: {
      paper_code: 'ESE090W00',
      paper_size: 'A5',
      paper_qty: '200',
      print_color_type: 'PCT10',
      finishing: 'numbering', // 자동발주(mapped)
    },
  },
]

// 고객 옵션 → 항목 판매가(USD). calculateItemPriceUsd 와 동일 공식.
function sellUsd(base: number, extra: number): number {
  return Math.round(((base + extra) * MARGIN) / RATE * 100) / 100
}

function buildPanelData(spec: TestSpec) {
  const sub = sellUsd(spec.basePriceKrw, spec.extraKrw)
  const shipping = 12 // 대표 배송비(US)
  const itemId = `qa-${spec.key}`
  // 우리 발주 옵션 스냅샷 = 큐 등록과 동일 변환(고객선택 → 성원 폼 필드)
  const snapshot = expandFinishingToSwadpiaFields(spec.customerOptions)
  return {
    order: {
      subtotal_usd: sub,
      shipping_usd: shipping,
      total_usd: Math.round((sub + shipping) * 100) / 100,
      exchange_rate_krw_usd: RATE,
      print_order_items: [
        {
          id: itemId,
          product_name_en: spec.label,
          selected_options: spec.customerOptions,
          quantity: spec.quantity,
          subtotal_usd: sub,
          print_products: { margin_multiplier: MARGIN, base_price_krw: spec.basePriceKrw },
        },
      ],
    },
    factoryOrders: [
      {
        id: `qa-fo-${spec.key}`,
        print_order_item_id: itemId,
        status: 'pending',
        category_code: spec.categoryCode,
        options_snapshot: snapshot,
        quantity: spec.quantity,
        // 실원가 미캡처(dry-run) → 패널이 base_price 추정으로 폴백
        actual_cost_krw: null,
        actual_cost_usd: null,
      },
    ],
    shipments: [
      { id: `qa-sh-${spec.key}`, cost_usd: 9.5, charged_usd: shipping, status: 'pending' },
    ],
  }
}

export default function SwadpiaParityQaPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">런칭점검 — 고객주문 ↔ 성원발주 비교 (OMO-2903)</h1>
        <p className="text-sm text-gray-600">
          대표 카테고리 3종의 테스트 스펙에 대해 고객 에디터 선택과 우리 성원 발주 폼 필드를 좌우 대조한다.
          발주 옵션 스냅샷은 큐 등록과 동일한 <code className="px-1 bg-gray-100 rounded">expandFinishingToSwadpiaFields</code> 변환으로
          합성되어 스펙·수량·후가공 일치 여부를 자동 판정한다.
        </p>
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-3 leading-relaxed">
          <strong>비용가드:</strong> 성원 실발주 없음(무료). 본 페이지는 코드 변환 정합성을 무브라우저로 증명한다.
          실제 성원 발주 폼 스크린샷 캡처는 로컬 Playwright dry-run 러너(결제 직전 정지)에서 수행한다(자식 이슈).
          <br />
          <strong>가격 경로(검증됨):</strong> 고객가 = (base_price_krw + Σ print_product_options.extra_price_krw) × margin × 환율.
          (<code className="px-1 bg-gray-100 rounded">/api/swadpia-price</code> 는 UI 미사용 — base_price 동기화 전용)
        </div>
      </header>

      {SPECS.map((spec) => {
        const data = buildPanelData(spec)
        const finishings = spec.customerOptions.finishing
          ? spec.customerOptions.finishing.split(',').filter(Boolean)
          : []
        return (
          <section key={spec.key} className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-800 border-b pb-1">{spec.label}</h2>
            <div className="flex flex-wrap gap-2 text-xs text-gray-500">
              <span className="px-2 py-0.5 bg-gray-100 rounded">수량 {spec.quantity}매</span>
              <span className="px-2 py-0.5 bg-gray-100 rounded">용지 {spec.customerOptions.paper_code}</span>
              <span className="px-2 py-0.5 bg-gray-100 rounded">사이즈 {spec.customerOptions.paper_size}</span>
              <span className="px-2 py-0.5 bg-gray-100 rounded">
                후가공 {finishings.length ? finishings.join(', ') : '없음'}
              </span>
            </div>
            <OrderVerificationPanel
              order={data.order}
              factoryOrders={data.factoryOrders}
              shipments={data.shipments}
            />
          </section>
        )
      })}

      <footer className="text-xs text-gray-400 border-t pt-4">
        증거 아티팩트: scripts/test-artifacts/omo2903/ (option-linkage / finishing-transform / db-option-linkage).
        파리티 기준: OMO-2902 parity-report.md.
      </footer>
    </div>
  )
}
