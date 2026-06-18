'use client'

// OMO-3452: printcity 명함 실제 제품 페이지 구성기(클라이언트).
//   모든 옵션축(용지·사이즈·코팅·도수·박·부분코팅·에폭)을 선택 가능하게 노출하고,
//   선택 조합+수량의 printcity 공급가(KRW)를 priceTable 직독으로 산출한다.
//   고객가(USD·마진)·체크아웃 컷오버는 보드 게이트 — 본 구성기는 printcity 공급가+VAT 견적까지.

import { useMemo, useState } from 'react'
import { Database, ShieldCheck, Info, Sparkles } from 'lucide-react'
import {
  resolveSupplyKrw,
  defaultSelection,
  availableCodes,
  availableQuantities,
  reconcile,
  withVat,
  type PrintcityProductData,
} from '@/lib/printcity-product'
import {
  getProductFinishing,
  finishingTotalKrw,
  finishingSurchargeKrw,
} from '@/lib/printcity-finishing'

// 축 표시 순서(가격영향 큰 순). 알 수 없는 키는 뒤에 자동 추가.
const AXIS_ORDER = ['material', 'size', 'coating', 'color', 'foil', 'PCS', 'EPS']

function orderedAxisKeys(axes: Record<string, unknown>): string[] {
  const keys = Object.keys(axes)
  const known = AXIS_ORDER.filter((k) => keys.includes(k))
  const rest = keys.filter((k) => !AXIS_ORDER.includes(k))
  return [...known, ...rest]
}

// 영어사이트: 가격은 ₩ 표기(고객 USD 컷오버는 보드 게이트).
const won = (n: number) => `₩${Math.round(n).toLocaleString('en-US')}`

export default function PrintcityProductConfigurator({ product }: { product: PrintcityProductData }) {
  const axisKeys = useMemo(() => orderedAxisKeys(product.axes), [product])
  const initial = useMemo(() => defaultSelection(product), [product])

  // 기본값 = 실제 가격이 있는 대표 조합(첫 옵션 단순조합은 미가격일 수 있어 priced row 에서 도출)
  const [codes, setCodes] = useState<Record<string, string>>(initial.codes)
  const [qty, setQty] = useState<number>(initial.qty)

  // 현재 선택에서 실제 가능한 수량(조합 의존)
  const qtys = useMemo(() => availableQuantities(product, codes), [product, codes])
  const effectiveQty = qtys.includes(qty) ? qty : qtys[0] ?? qty

  // ── 후가공(addwork): printcity 직접 링크 work 만. selections[workType] = 선택된 옵션 codes ──
  const works = useMemo(() => getProductFinishing(product.id), [product.id])
  const [finishing, setFinishing] = useState<Record<string, string[]>>({})

  const toggleWork = (workType: string, firstCodes: string[]) => {
    setFinishing((prev) => {
      const next = { ...prev }
      if (next[workType]) delete next[workType]
      else next[workType] = firstCodes
      return next
    })
  }
  const pickWorkOption = (workType: string, optCodes: string[]) => {
    setFinishing((prev) => ({ ...prev, [workType]: optCodes }))
  }

  const baseSupply = resolveSupplyKrw(product, { codes, qty: effectiveQty })
  const finish = useMemo(
    () => finishingTotalKrw(works, finishing, effectiveQty),
    [works, finishing, effectiveQty],
  )
  const supply = baseSupply != null ? baseSupply + finish.total : null
  const money = supply != null ? withVat(supply) : null
  const unit = baseSupply != null && effectiveQty > 0 ? supply! / effectiveQty : null

  // 옵션 변경: 의존 축을 가능한 값으로 정합화(printcity 조건부 옵션 재현) + 수량 보정
  const pick = (axisKey: string, code: string) => {
    setCodes((prev) => {
      const next = reconcile(product, { ...prev, [axisKey]: code }, axisKey)
      const q = availableQuantities(product, next)
      setQty((cur) => (q.includes(cur) ? cur : q[0] ?? cur))
      return next
    })
  }

  return (
    <div className="space-y-5">
      {axisKeys.map((key) => {
        const axis = product.axes[key]
        if (!axis || axis.options.length === 0) return null
        // 의존 옵션: 현재 다른 축 선택에서 실제 가능한 값만 노출(printcity 스토어프론트 동일).
        const avail = availableCodes(product, key, codes)
        const opts = axis.options.filter((o) => avail.has(o.code))
        if (opts.length === 0) return null
        const isChips = opts.length <= 6
        return (
          <div key={key}>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {axis.label}
              {opts.length === 1 && (
                <span className="ml-2 text-[11px] font-normal text-gray-400">(fixed)</span>
              )}
            </label>
            {isChips ? (
              <div className="flex flex-wrap gap-2">
                {opts.map((o) => {
                  const active = codes[key] === o.code
                  return (
                    <button
                      key={o.code}
                      type="button"
                      onClick={() => pick(key, o.code)}
                      className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                        active
                          ? 'border-blue-500 bg-blue-50 text-blue-800 font-medium'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {o.ko}
                    </button>
                  )
                })}
              </div>
            ) : (
              <select
                value={avail.has(codes[key]) ? codes[key] : opts[0].code}
                onChange={(e) => pick(key, e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {opts.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.ko}
                  </option>
                ))}
              </select>
            )}
          </div>
        )
      })}

      {/* Quantity */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Quantity</label>
        <select
          value={effectiveQty}
          onChange={(e) => setQty(Number(e.target.value))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          {qtys.map((q) => (
            <option key={q} value={q}>
              {q.toLocaleString('en-US')} pcs
            </option>
          ))}
        </select>
      </div>

      {/* 후가공(addwork) — printcity 직접 링크 work 만 노출. 선택 시 견적에 surcharge 합산 */}
      {works.length > 0 && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-amber-500" /> Finishing <span className="font-normal text-gray-400 text-xs">(optional · priced by quantity)</span>
          </label>
          <div className="space-y-2.5">
            {works.map((work) => {
              const sel = finishing[work.workType]
              const on = !!sel
              const surcharge = on ? finishingSurchargeKrw(work, sel, effectiveQty) : null
              return (
                <div
                  key={work.workType}
                  className={`rounded-xl border p-3 transition-colors ${
                    on ? 'border-amber-300 bg-amber-50/60' : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggleWork(work.workType, work.options[0]?.codes ?? [])}
                        className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-400"
                      />
                      <span className="text-sm font-medium text-gray-800">{work.name}</span>
                      <span className="text-[11px] text-gray-400">
                        {work.pricing === 'per_unit' ? 'per unit' : 'per order'}
                      </span>
                    </label>
                    {on && surcharge != null && (
                      <span className="text-sm font-semibold text-amber-700 whitespace-nowrap">
                        + {won(surcharge)}
                      </span>
                    )}
                  </div>
                  {on && work.options.length > 1 && (
                    <select
                      value={sel.join('+')}
                      onChange={(e) =>
                        pickWorkOption(
                          work.workType,
                          e.target.value ? e.target.value.split('+') : [],
                        )
                      }
                      className="mt-2.5 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      {work.options.map((o) => (
                        <option key={o.codes.join('+')} value={o.codes.join('+')}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 견적 — printcity 공개 GET JSON 직독 */}
      <div className="border border-gray-200 rounded-xl p-5 bg-gray-50 space-y-2.5">
        {money ? (
          <>
            <div className="flex justify-between text-sm text-gray-600">
              <span>
                {finish.lines.length > 0 ? 'Base print' : 'Price'} ({effectiveQty.toLocaleString('en-US')} pcs)
              </span>
              <span>{won(baseSupply ?? 0)}</span>
            </div>
            {finish.lines.map((l) => (
              <div key={l.workType} className="flex justify-between text-sm text-amber-700">
                <span>+ {l.name} <span className="text-amber-500/80 text-xs">({l.optionLabel})</span></span>
                <span>{won(l.krw)}</span>
              </div>
            ))}
            {finish.lines.length > 0 && (
              <div className="flex justify-between text-sm text-gray-600 border-t border-gray-200 pt-2.5">
                <span>Subtotal</span>
                <span>{won(money.supply)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm text-gray-600">
              <span>VAT (10%)</span>
              <span>{won(money.vat)}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-200 pt-2.5">
              <span>Total (incl. VAT)</span>
              <span>{won(money.total)}</span>
            </div>
            {unit != null && (
              <div className="text-right text-[11px] text-gray-400">
                {won(unit)} per unit
              </div>
            )}
          </>
        ) : (
          <div className="flex items-start gap-2 text-sm text-gray-500">
            <Info className="h-4 w-4 mt-0.5 shrink-0 text-gray-400" />
            <span>This option combination isn&apos;t available. Please choose a different paper, size, or quantity.</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-gray-400">
        <span className="inline-flex items-center gap-1">
          <Database className="h-3.5 w-3.5" /> Live pricing · all options mapped
        </span>
        <span className="inline-flex items-center gap-1">
          <ShieldCheck className="h-3.5 w-3.5" /> Quality guaranteed · worldwide delivery
        </span>
      </div>
    </div>
  )
}
