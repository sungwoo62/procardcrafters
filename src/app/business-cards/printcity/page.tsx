import Link from 'next/link'
import { ArrowLeft, BadgeCheck, Database, ShieldCheck } from 'lucide-react'
import { CENSUS } from '@/lib/printcity-namecard'
import PrintcityNamecardSection from './PrintcityNamecardSection'

// OMO-3417 (보드 결정 2026-06-17, OMO-3411 파생): 명함 섹션 공급사 printcity 전환(별도 섹션).
//   - 성원(swadpia) 명함 경로는 삭제하지 않고 본 섹션에 노출하지 않음(hide by construction).
//   - 가격/옵션은 printcity 공개 GET JSON census(price-api.dtp21.com/v2) 직독값.
//   - 고객가(마진·USD)·체크아웃 컷오버는 보드 게이트.
export const dynamic = 'force-static'
export const metadata = {
  title: '명함 섹션 (printcity) · Procardcrafters',
  description: 'printcity 공개 가격 API 직독으로 구성한 명함 섹션 — 옵션 누락 없는 선언적 JSON 매핑.',
}

export default function PrintcityNamecardSectionPage() {
  const products = CENSUS.products
  const pricedCount = products.filter((p) => p.counts.combos > 0).length

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Link
        href="/reports/printcity-namecard"
        className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" /> printcity 명함 비교 리포트
      </Link>

      <div className="flex items-center gap-2">
        <BadgeCheck className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">명함 섹션 — printcity</h1>
      </div>
      <p className="mt-2 text-sm text-gray-600 max-w-2xl">
        명함 섹션을 성원(swadpia)에서 printcity 공급사로 전환한 별도 섹션입니다. 가격·옵션은
        printcity 공개 가격 API(<span className="font-mono text-xs">price-api.dtp21.com/v2</span>)의
        선언적 JSON을 직독한 값으로, <strong>옵션 누락이 없습니다</strong>. 성원 명함 구성/코드는
        삭제하지 않고 이 섹션에 노출하지 않습니다(보존).
      </p>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
          <div className="text-lg font-bold text-gray-900">{products.length}</div>
          <div className="text-[11px] text-gray-500">명함 제품(census)</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
          <div className="text-lg font-bold text-gray-900">{pricedCount}</div>
          <div className="text-[11px] text-gray-500">가격표 적재 제품</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
          <div className="flex items-center gap-1 text-lg font-bold text-green-700"><Database className="h-4 w-4" />JSON</div>
          <div className="text-[11px] text-gray-500">공개 GET 직독 · 누락 0</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
          <div className="flex items-center gap-1 text-lg font-bold text-amber-700"><ShieldCheck className="h-4 w-4" />게이트</div>
          <div className="text-[11px] text-gray-500">결제/가격 컷오버 보드 승인</div>
        </div>
      </div>

      <div className="mt-8">
        <PrintcityNamecardSection />
      </div>

      <p className="mt-8 text-[11px] text-gray-400">
        데이터: <span className="font-mono">src/data/printcity-namecard-census.json</span> (OMO-3414 전수 census,
        가격 JSON 직독 · OCR/LLM 미사용 · 읽기전용). 출처: printcity(dtp21/iamdesign) 공개 가격 API.
      </p>
    </div>
  )
}
