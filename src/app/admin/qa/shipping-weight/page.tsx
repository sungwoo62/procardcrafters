// OMO-3190 — 배송 예상 무게 산출 "예시표" (보드 검토용 링크).
//
//   보드 지시: 종이 평량(gsm) + 수량 → 종이 무게 → 박스 tier(+tare) → 총 무게 →
//   FedEx 운임이 수량에 따라 변동되는 파이프라인을 한 페이지에서 눈으로 확인.
//
//   이 페이지는 대표 제품 4종을 수량 사다리(100~5000부)로 돌려 무게 분해와
//   실제 FedEx 견적(미국 배송 기준)을 표로 보여준다. 무게 산출은 결정론적(순수 함수)이고
//   배송비는 quoteShipping(FedEx API 우선·실패 시 DB 계약 fallback)으로 라이브 산출한다.
//
//   인증/비SEO → 정적 프리렌더 제외.
export const dynamic = 'force-dynamic'

import { estimateItemWeight, type WeightBreakdown } from '@/lib/weight-estimate'
import { quoteShipping } from '@/lib/shipping'

// 배송비 변동을 보여줄 목적지(대표): 미국. (procardcrafters 주 타깃 US English)
const DEST_COUNTRY = 'US'
const DEST_POSTAL = '10001' // New York, NY

// 대표 제품 4종: 사이즈(재단 mm) + 평량(gsm).
const PRODUCTS = [
  { key: 'business-card', label: '명함 (Business Card)', w: 85, h: 55, gsm: 300 },
  { key: 'postcard', label: '엽서 (Postcard)', w: 148, h: 105, gsm: 250 },
  { key: 'leaflet', label: '전단 A5 (Leaflet)', w: 148, h: 210, gsm: 150 },
  { key: 'brochure', label: '브로슈어 A4 (Brochure)', w: 210, h: 297, gsm: 200 },
] as const

// 수량 사다리.
const QUANTITIES = [100, 200, 500, 1000, 2000, 5000] as const

interface Row {
  qty: number
  breakdown: WeightBreakdown
  shipUsd: number | null
  shipReason: string | null
}

interface ProductBlock {
  key: string
  label: string
  w: number
  h: number
  gsm: number
  rows: Row[]
}

async function buildBlocks(): Promise<ProductBlock[]> {
  const blocks: ProductBlock[] = []
  for (const p of PRODUCTS) {
    const rows: Row[] = []
    for (const qty of QUANTITIES) {
      const breakdown = estimateItemWeight({
        gsm: p.gsm,
        sheetWidthMm: p.w,
        sheetHeightMm: p.h,
        quantity: qty,
      })
      let shipUsd: number | null = null
      let shipReason: string | null = null
      try {
        const q = await quoteShipping(DEST_COUNTRY, breakdown.totalKg)
        shipUsd = q.costUsd
        shipReason = q.reason
      } catch {
        shipUsd = null
        shipReason = 'error'
      }
      rows.push({ qty, breakdown, shipUsd, shipReason })
    }
    blocks.push({ ...p, rows })
  }
  return blocks
}

function fmtKg(kg: number) {
  return `${kg.toFixed(3)} kg`
}

function fmtG(g: number) {
  return `${Math.round(g).toLocaleString()} g`
}

export default async function ShippingWeightExamplePage() {
  const blocks = await buildBlocks()

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">배송 예상 무게 산출 — 예시표 (OMO-3190)</h1>
      <p className="mt-2 text-sm text-gray-600">
        수량이 늘어나면 종이 무게가 늘고 → 더 큰 박스가 선택되어 박스 무게가 가산되고 → 총 무게가 커져
        → FedEx 운임이 실제로 변동되는 것을 한눈에 보여줍니다. 무게는 결정론적 산식, 배송비는 라이브
        FedEx 견적(미국 {DEST_POSTAL} 배송 기준)입니다.
      </p>

      {/* 산식 설명 */}
      <div className="mt-5 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <div className="font-semibold">산식</div>
        <ol className="mt-1 list-decimal space-y-0.5 pl-5">
          <li>1매 무게(g) = 평량(gsm) × 재단면적(m²)</li>
          <li>종이 무게(g) = 1매 무게 × 수량(부)</li>
          <li>박스 선택 = 종이 무게를 담을 수 있는 최소 박스 tier → 박스 무게(tare) 가산</li>
          <li>총 무게(kg) = (종이 무게 + 박스 무게) ÷ 1000 → FedEx API 입력</li>
        </ol>
        <div className="mt-2 text-xs text-blue-700">
          ※ 박스 규격·무게(tare)는 현재 보수적 근사값입니다. 실측 박스 데이터를 주시면 정확히 보정합니다
          (<code>src/lib/weight-estimate.ts</code> · <code>BOX_TIERS</code>).
        </div>
      </div>

      {blocks.map((b) => (
        <section key={b.key} className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">
            {b.label}
            <span className="ml-2 text-sm font-normal text-gray-500">
              재단 {b.w}×{b.h}mm · {b.gsm}gsm
            </span>
          </h2>
          <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-3 py-2 font-medium">수량(부)</th>
                  <th className="px-3 py-2 font-medium">종이 무게</th>
                  <th className="px-3 py-2 font-medium">박스</th>
                  <th className="px-3 py-2 font-medium">박스 무게</th>
                  <th className="px-3 py-2 font-medium">총 무게</th>
                  <th className="px-3 py-2 font-medium">FedEx 운임 (US)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {b.rows.map((r) => (
                  <tr key={r.qty} className="text-gray-800">
                    <td className="px-3 py-2 font-medium">{r.qty.toLocaleString()}</td>
                    <td className="px-3 py-2">{fmtG(r.breakdown.paperWeightG)}</td>
                    <td className="px-3 py-2">{r.breakdown.boxLabel ?? 'overflow'}</td>
                    <td className="px-3 py-2">{fmtG(r.breakdown.boxTareG)}</td>
                    <td className="px-3 py-2 font-semibold">{fmtKg(r.breakdown.totalKg)}</td>
                    <td className="px-3 py-2">
                      {r.shipUsd != null ? (
                        <span className="font-semibold text-gray-900">${r.shipUsd.toFixed(2)}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                      {r.shipReason ? (
                        <span className="ml-1 text-xs text-gray-400">({r.shipReason})</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <p className="mt-8 text-xs text-gray-400">
        reason 범례: <code>fedex_api</code> = FedEx 라이브 견적 · <code>fallback_*</code> = FedEx 미설정/오류 시
        DB 계약식 견적. 동일 제품에서 수량↑ → 총 무게↑ → 운임↑ 흐름을 확인하세요.
      </p>
    </div>
  )
}
