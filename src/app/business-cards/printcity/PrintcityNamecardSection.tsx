'use client'

// OMO-3417 (보드 결정 2026-06-17, OMO-3411 파생): 명함 섹션 공급사 printcity 전환.
//   성원(swadpia) 명함 경로는 삭제하지 않고 이 섹션에 노출하지 않음(hide by construction).
//   가격/옵션은 printcity 공개 GET JSON census(src/data/printcity-namecard-census.json) 직독값.
//   고객 마진/USD 체크아웃 컷오버는 보드 게이트 — 본 섹션은 printcity 공급가(KRW)+VAT 견적까지.

import { useMemo, useState } from 'react'
import { CENSUS, PRODUCT_MAPPING, withVat, type PrintcityProduct } from '@/lib/printcity-namecard'

const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`

// 판매 가능한(가격표 적재된) 명함 제품만 노출. baseByQty 또는 foilTable 가 있어야 견적 가능.
function isSellable(p: PrintcityProduct): boolean {
  const hasBase = p.baseByQty && Object.values(p.baseByQty).some((v) => v > 0)
  const hasFoil = !!p.foilTable && Object.keys(p.foilTable.byColor ?? {}).length > 0
  return (hasBase || hasFoil) && (p.categoryCode === 'CA_NC' || p.category2nd === 'Offset')
}

const SLUG_LABEL: Record<string, string | null> = Object.fromEntries(
  PRODUCT_MAPPING.map((m) => [m.printcityId, m.ourSlug]),
)

/** 선택된 수량에서 가용한 가격(원, 주문총액 supply)을 해석. foil 제품은 색상별 all-in 표 사용. */
function priceFor(p: PrintcityProduct, qty: number, foilColor: string | null): number | null {
  if (p.hasFoil && p.foilTable && foilColor) {
    const v = p.foilTable.byColor[foilColor]?.[String(qty)]
    return typeof v === 'number' && v > 0 ? v : null
  }
  const v = p.baseByQty?.[String(qty)]
  return typeof v === 'number' && v > 0 ? v : null
}

export default function PrintcityNamecardSection() {
  const products = useMemo(() => CENSUS.products.filter(isSellable), [])
  const [selectedId, setSelectedId] = useState<string>(products[0]?.id ?? '')
  const product = useMemo(
    () => products.find((p) => p.id === selectedId) ?? products[0],
    [products, selectedId],
  )

  const quantities = useMemo(() => {
    if (!product) return [] as number[]
    // 가격이 실제로 존재하는 수량만(공백 구간 제외).
    const src = product.hasFoil && product.foilColors[0]
      ? Object.keys(product.foilTable?.byColor[product.foilColors[0].code] ?? {})
      : Object.keys(product.baseByQty ?? {})
    return src.map(Number).filter((n) => n > 0).sort((a, b) => a - b)
  }, [product])

  const [qty, setQty] = useState<number>(quantities[0] ?? 0)
  const [foilColor, setFoilColor] = useState<string | null>(
    product?.hasFoil ? (product.foilColors[0]?.code ?? null) : null,
  )

  // 제품 변경 시 수량/박색 초기화
  const onPickProduct = (id: string) => {
    const p = products.find((x) => x.id === id)
    setSelectedId(id)
    const qs = p
      ? (p.hasFoil && p.foilColors[0]
          ? Object.keys(p.foilTable?.byColor[p.foilColors[0].code] ?? {})
          : Object.keys(p.baseByQty ?? {})
        ).map(Number).filter((n) => n > 0).sort((a, b) => a - b)
      : []
    setQty(qs[0] ?? 0)
    setFoilColor(p?.hasFoil ? (p.foilColors[0]?.code ?? null) : null)
  }

  if (!product) {
    return <p className="text-gray-500">판매 가능한 printcity 명함 제품을 찾을 수 없습니다.</p>
  }

  const supply = priceFor(product, qty, foilColor)
  const money = supply != null ? withVat(supply) : null
  const unit = supply != null && qty > 0 ? supply / qty : null

  return (
    <div className="grid md:grid-cols-[1fr_1.2fr] gap-6">
      {/* 제품 선택 */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-700">명함 제품 ({products.length}종 · printcity)</h2>
        <div className="space-y-1.5 max-h-[460px] overflow-auto pr-1">
          {products.map((p) => {
            const active = p.id === product.id
            return (
              <button
                key={p.id}
                onClick={() => onPickProduct(p.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-all ${
                  active ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="font-medium">{p.nameKO}</span>
                {p.hasFoil && <span className="ml-2 text-[11px] text-amber-600 font-semibold">박 {p.foilColors.length}색</span>}
                <span className="block text-[11px] text-gray-400 mt-0.5">
                  {p.category3rd ?? p.categoryCode} · {p.priceType}
                  {SLUG_LABEL[p.id] ? ` · ↔ ${SLUG_LABEL[p.id]}` : ''}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 구성/견적 */}
      <div className="space-y-5">
        <div>
          <h3 className="text-lg font-bold text-gray-900">{product.nameKO}</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            용지 {product.counts.material} · 사이즈 {product.counts.size} · 도수 {product.counts.color} · 코팅 {product.counts.coating}
            {product.hasFoil ? ` · 박 ${product.foilColors.length}색` : ''}
          </p>
        </div>

        {/* 박 색상 (foil 제품만) */}
        {product.hasFoil && product.foilColors.length > 0 && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">박 종류</label>
            <div className="flex flex-wrap gap-2">
              {product.foilColors.map((c) => (
                <button
                  key={c.code}
                  onClick={() => setFoilColor(c.code)}
                  className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                    foilColor === c.code ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {c.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 수량 */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">수량</label>
          <select
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {quantities.map((q) => (
              <option key={q} value={q}>{q.toLocaleString('ko-KR')}매</option>
            ))}
          </select>
        </div>

        {/* 견적 (printcity 공개 GET JSON 직독) */}
        <div className="border border-gray-200 rounded-xl p-5 bg-gray-50 space-y-2.5">
          {money ? (
            <>
              <div className="flex justify-between text-sm text-gray-600">
                <span>printcity 공급가 ({qty.toLocaleString('ko-KR')}매{product.hasFoil ? ', 박 포함' : ''})</span>
                <span>{won(money.supply)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>부가세 (10%)</span>
                <span>{won(money.vat)}</span>
              </div>
              {unit != null && (
                <div className="flex justify-between text-xs text-gray-500">
                  <span>매당 단가</span>
                  <span>{won(unit)}/매</span>
                </div>
              )}
              <div className="border-t border-gray-200 pt-2.5 flex justify-between font-bold text-lg">
                <span>합계</span>
                <span className="text-blue-600">{won(money.total)}</span>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">이 조합은 가격표가 적재되지 않았습니다(draft).</p>
          )}
          <p className="text-[11px] text-gray-400 border-t border-gray-200 pt-2">
            가격은 printcity 공개 가격 API(price-api.dtp21.com/v2) JSON 직독값(공급가, KRW). 고객 판매가(마진·USD)·체크아웃 컷오버는 보드 승인 게이트입니다.
          </p>
        </div>
      </div>
    </div>
  )
}
