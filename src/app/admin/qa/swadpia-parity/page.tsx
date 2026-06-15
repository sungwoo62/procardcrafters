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

import { useEffect, useState } from 'react'
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
  // 성원 발주 폼 dry-run 스크린샷(omo2903-swadpia-screenshots.ts, 결제 직전 정지)
  swadpiaShot: string
  swadpiaShotNote: string
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
    swadpiaShot: '/qa/omo2903/sungwoo-01-business-cards.png',
    swadpiaShotNote: '박+타공 적용 발주폼 · 결제 직전(파일업로드) 정지 · ₩34,320(라이브 dry-run 일치)',
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
    swadpiaShot: '/qa/omo2903/sungwoo-02-posters.png',
    swadpiaShotNote: '포스터 발주폼(용지/사이즈/수량 옵션·가격) · 실주문 없음',
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
    swadpiaShot: '/qa/omo2903/sungwoo-03-booklet.png',
    swadpiaShotNote: '책자 발주폼(용지/사이즈/수량 옵션·가격) · 실주문 없음',
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

// ─── OMO-3241 ③ 매트릭스 vs 현행가 대조(parity) ───────────────────────
type MatrixCoverage = {
  categoryCode: string
  productSlug: string | null
  routed: boolean
  cells: number
  sampled: number
  interpolated: number
  qtyRange: [number, number]
  sizeCount: number
  paperCount: number
  printColorTypes: string[]
  representative: {
    combo: string
    qty: number
    matrixWholesaleKrw: number
    source: string
    matrixCustomerUsd: number | null
    currentCustomerUsd: number | null
    deltaPct: number | null
  } | null
}
type MatrixParity = {
  generatedAt: string
  rate: number
  routedCategories: string[]
  totalCells: number
  coverage: MatrixCoverage[]
  recentRuns: Array<{
    id: string
    started_at: string
    status: string
    sampled_count: number
    interpolated_count: number
    drift_detected: boolean
    error: string | null
  }>
}

function MatrixParitySection() {
  const [data, setData] = useState<MatrixParity | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/qa/matrix-parity')
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `HTTP ${r.status}`)
        return r.json()
      })
      .then(setData)
      .catch((e) => setErr(e.message))
  }, [])

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-800 border-b pb-1">
        ④ 매트릭스 vs 현행가 대조 — 멀티사이즈/디지털/토너 (OMO-3241)
      </h2>
      <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-3 leading-relaxed">
        <strong>컷오버 게이트:</strong> 멀티사이즈/디지털/토너는 성원 json_data 가 size 를 무시(전 size 동일가)해
        라이브 가격경로로 정확한 단가를 못 낸다 → 오프라인 크롤러가 hidden total_price 를 표집해
        <code className="px-1 bg-gray-100 rounded">print_swadpia_price_matrix</code> 에 적재(OMO-3240). 아래는
        <strong> 현행 고객가(base_price_krw×margin)</strong> 대비 <strong>매트릭스 도매가×margin</strong> 의 델타다.
        라이브 가격 변경(회귀 리스크)이므로 parity 확인 + 보드 승인 + <code className="px-1 bg-gray-100 rounded">SWADPIA_MATRIX_ROUTING=on</code>
        후에만 컷오버한다(플래그 OFF=현행 유지).
      </div>

      {err && <div className="text-sm text-red-600">대조 데이터 로드 실패: {err}</div>}
      {!data && !err && <div className="text-sm text-gray-400">대조 데이터 로딩 중…</div>}

      {data && (
        <>
          <div className="text-xs text-gray-500">
            적재 셀 {data.totalCells.toLocaleString()}개 · 라우팅 대상 {data.routedCategories.length}종 ·
            기준환율 ₩{data.rate}/USD · 생성 {new Date(data.generatedAt).toLocaleString()}
          </div>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-2 py-2 text-left">카테고리</th>
                  <th className="px-2 py-2 text-right">셀</th>
                  <th className="px-2 py-2 text-right">size·용지·인쇄</th>
                  <th className="px-2 py-2 text-right">qty 범위</th>
                  <th className="px-2 py-2 text-right">대표 qty</th>
                  <th className="px-2 py-2 text-right">현행가</th>
                  <th className="px-2 py-2 text-right">매트릭스가</th>
                  <th className="px-2 py-2 text-right">델타</th>
                </tr>
              </thead>
              <tbody>
                {data.coverage.map((c) => {
                  const rep = c.representative
                  const delta = rep?.deltaPct
                  const deltaColor =
                    delta == null
                      ? 'text-gray-400'
                      : Math.abs(delta) < 5
                      ? 'text-gray-600'
                      : Math.abs(delta) < 25
                      ? 'text-amber-600'
                      : 'text-red-600 font-semibold'
                  return (
                    <tr key={c.categoryCode} className="border-t">
                      <td className="px-2 py-2">
                        <div className="font-mono text-gray-800">{c.categoryCode}</div>
                        <div className="text-gray-400">{c.productSlug ?? '—'}</div>
                      </td>
                      <td className="px-2 py-2 text-right">
                        {c.cells}
                        {c.interpolated > 0 && (
                          <span className="text-gray-400"> ({c.interpolated} interp)</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right text-gray-500">
                        {c.sizeCount}·{c.paperCount}·{c.printColorTypes.filter(Boolean).length || 1}
                      </td>
                      <td className="px-2 py-2 text-right text-gray-500">
                        {c.qtyRange[0]}–{c.qtyRange[1]}
                      </td>
                      <td className="px-2 py-2 text-right">{rep?.qty ?? '—'}</td>
                      <td className="px-2 py-2 text-right">
                        {rep?.currentCustomerUsd != null ? `$${rep.currentCustomerUsd}` : '—'}
                      </td>
                      <td className="px-2 py-2 text-right">
                        {rep?.matrixCustomerUsd != null ? `$${rep.matrixCustomerUsd}` : '—'}
                        {rep && rep.source !== 'sampled' && (
                          <span className="text-gray-400"> ({rep.source})</span>
                        )}
                      </td>
                      <td className={`px-2 py-2 text-right ${deltaColor}`}>
                        {delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta}%`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="text-xs text-gray-500">
            <strong>판정:</strong> 델타 &lt;5% 회색(무시가능) · 5–25% 주황(검토) · ≥25% 빨강(컷오버 시 큰 가격이동, 보드 확인 필수).
            현행가는 단일 base_price_krw 라 size/qty 미반영 → 매트릭스 컷오버가 곧 size/qty 정확가 도입이다.
          </div>

          <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700 border-b">
              최근 크롤 런 (드리프트 안전망 — 크롤≠화면 차단)
            </div>
            <table className="w-full text-xs">
              <thead className="bg-white text-gray-500">
                <tr>
                  <th className="px-2 py-1 text-left">시각</th>
                  <th className="px-2 py-1 text-left">상태</th>
                  <th className="px-2 py-1 text-right">sampled</th>
                  <th className="px-2 py-1 text-right">interp</th>
                  <th className="px-2 py-1 text-left">drift</th>
                </tr>
              </thead>
              <tbody>
                {data.recentRuns.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-2 py-2 text-gray-400">
                      크롤 런 기록 없음
                    </td>
                  </tr>
                )}
                {data.recentRuns.map((run) => (
                  <tr key={run.id} className="border-t">
                    <td className="px-2 py-1">{new Date(run.started_at).toLocaleString()}</td>
                    <td className="px-2 py-1">{run.status}</td>
                    <td className="px-2 py-1 text-right">{run.sampled_count}</td>
                    <td className="px-2 py-1 text-right">{run.interpolated_count}</td>
                    <td className={`px-2 py-1 ${run.drift_detected ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                      {run.drift_detected ? '⚠️ drift' : 'ok'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
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
          <strong>비용가드:</strong> 성원 실발주 없음(무료). 각 섹션 하단의 성원 발주 폼 스크린샷은
          Playwright dry-run(omo2903-swadpia-screenshots.ts)으로 결제 직전(파일업로드 단계)까지만 진행해 캡처했다 — 결제 버튼 미클릭.
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
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700 border-b">
                성원 발주 폼 (dry-run 스크린샷 · 결제 X)
                <span className="ml-2 font-normal text-gray-400">{spec.swadpiaShotNote}</span>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={spec.swadpiaShot}
                alt={`${spec.label} 성원 발주 폼 스크린샷`}
                className="w-full"
                loading="lazy"
              />
            </div>
          </section>
        )
      })}

      <MatrixParitySection />

      <footer className="text-xs text-gray-400 border-t pt-4">
        증거 아티팩트: scripts/test-artifacts/omo2903/ (option-linkage / finishing-transform / db-option-linkage).
        파리티 기준: OMO-2902 parity-report.md · 매트릭스 라우팅: OMO-3241 / 적재 OMO-3240 / 오라클 OMO-3239.
      </footer>
    </div>
  )
}
