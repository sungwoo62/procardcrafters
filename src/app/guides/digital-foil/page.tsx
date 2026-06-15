import { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles, FileText, AlertTriangle, Layers, Check, Ruler } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Digital Foil — Artwork Guide | Procardcrafters',
  description:
    'How to prepare artwork for Digital Foil business cards: K100 foil layer, file grouping, line/spacing minimums, applicable papers, and flat pricing.',
}

// 디지털 박 작업가이드 — 성원 원본 가이드(pnl_dbak_postpress_preview.jpg /
// CNS2000_dbak_notice.jpg)를 영어 + Procardcrafters 디자인으로 재창작.
// 이미지 의존 없이 전부 코드(JSX + 인라인 SVG)로 구현. (OMO-3238)

const PREP_STEPS = [
  {
    title: 'One or both sides',
    body: 'Digital foil can be applied to the front, the back, or both sides of the card.',
  },
  {
    title: 'Foil layer = K100',
    body: 'The foil artwork must be drawn in 100% black only (C0 M0 Y0 K100). Anything in K100 on the foil layer becomes metallic foil.',
    emphasis: true,
  },
  {
    title: 'Trim & safe area = no fill',
    body: 'Leave the trim size and working size with no color fill — keep them as outlines only.',
  },
  {
    title: 'Draw the size box',
    body: 'Even when there is no background color, draw the working/trim size as a box outline so the area is registered.',
  },
  {
    title: 'Group each file',
    body: 'When artwork is finished, group the print file and the foil file separately before exporting.',
    emphasis: true,
  },
]

const CAUTIONS = [
  {
    icon: Ruler,
    title: 'Minimum line & font size',
    body: 'Very thin lines or tiny text may not reproduce in foil. Use lines of at least 0.1pt and fonts of at least 8pt.',
  },
  {
    icon: AlertTriangle,
    title: 'Minimum spacing between elements',
    body: 'If two foil elements sit too close together, the foil can spread and merge. Keep at least 0.3mm of space between separate foil elements.',
  },
]

const PAPERS = [
  'Armi Ultra White 230g',
  'Armi Ultra White 310g',
  'Rendezvous Natural 310g',
  'Banuvo White 204g',
  'Banuvo Snow White 227g',
]

/** 명함 목업 — 인쇄 결과(컬러 도트 패턴 + 골드 로고). */
function CardMockup({ side }: { side: 'front' | 'back' }) {
  return (
    <svg viewBox="0 0 260 156" className="w-full rounded-lg shadow-sm" role="img" aria-label={`${side} preview`}>
      <rect width="260" height="156" rx="8" fill="#fdeef0" />
      {/* 배경 도트 패턴 */}
      <g opacity="0.85">
        <circle cx="40" cy="34" r="14" fill="#f6b8c4" />
        <circle cx="92" cy="20" r="8" fill="#f29db0" />
        <circle cx="210" cy="30" r="18" fill="#f6c1cb" />
        <circle cx="234" cy="70" r="9" fill="#ef9fb2" />
        <circle cx="30" cy="120" r="10" fill="#f6c1cb" />
        <circle cx="150" cy="138" r="14" fill="#f3aebd" />
        <circle cx="120" cy="40" r="6" fill="#ec8aa1" />
      </g>
      {side === 'front' ? (
        <text x="130" y="86" textAnchor="middle" fontFamily="Georgia, serif" fontSize="30" fontStyle="italic" fill="#b8860b" fontWeight="bold">
          minagod
        </text>
      ) : (
        <g>
          <text x="196" y="74" textAnchor="middle" fontFamily="Georgia, serif" fontSize="13" fill="#7a5c12" fontWeight="bold">
            Sora Park
          </text>
          <text x="196" y="90" textAnchor="middle" fontFamily="sans-serif" fontSize="7" fill="#9a7b3a">
            Senior Manager
          </text>
          <text x="196" y="104" textAnchor="middle" fontFamily="sans-serif" fontSize="6" fill="#9a7b3a">
            www.minagod.com · +82 010 0000 0000
          </text>
        </g>
      )}
    </svg>
  )
}

/** 박 파일 목업 — K100(검정)으로만 그린 후가공 레이어. */
function FoilLayerMockup({ side }: { side: 'front' | 'back' }) {
  return (
    <svg viewBox="0 0 260 156" className="w-full rounded-lg border border-gray-200" role="img" aria-label={`${side} foil layer (K100)`}>
      <rect width="260" height="156" rx="8" fill="#ffffff" />
      <rect x="4" y="4" width="252" height="148" rx="6" fill="none" stroke="#d1d5db" strokeDasharray="4 4" />
      {side === 'front' ? (
        <text x="130" y="86" textAnchor="middle" fontFamily="Georgia, serif" fontSize="30" fontStyle="italic" fill="#000000" fontWeight="bold">
          minagod
        </text>
      ) : (
        <text x="196" y="86" textAnchor="middle" fontFamily="Georgia, serif" fontSize="13" fill="#000000" fontWeight="bold">
          Sora Park
        </text>
      )}
      <text x="130" y="146" textAnchor="middle" fontFamily="sans-serif" fontSize="8" fill="#9ca3af">
        Foil layer — drawn in K100
      </text>
    </svg>
  )
}

export default function DigitalFoilGuidePage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-amber-50 to-white py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-amber-100 rounded-2xl mb-6">
            <Sparkles className="w-7 h-7 text-amber-600" />
          </div>
          <p className="text-sm font-semibold tracking-wide text-amber-600 uppercase mb-2">Artwork Guide</p>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Digital Foil for Premium Cards</h1>
          <p className="text-lg text-gray-600 leading-relaxed">
            A modern metallic foil applied digitally — sharper detail, no size limit, and a flat price.
            Follow this guide to prepare print-ready artwork with no errors.
          </p>
        </div>
      </section>

      {/* Cost & papers callout */}
      <section className="border-y border-gray-100 bg-white py-10 px-4">
        <div className="max-w-4xl mx-auto grid gap-8 md:grid-cols-2 items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">More affordable than traditional foil</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Digital foil costs less than hot-stamped foil and has{' '}
              <span className="font-semibold text-gray-900">no size limit</span>.
            </p>
            <div className="inline-flex items-baseline gap-2 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3">
              <span className="text-3xl font-bold text-amber-600">₩15,000</span>
              <span className="text-sm text-gray-500">flat rate · per business-card order</span>
            </div>
          </div>
          <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-600" /> Applicable papers
            </h3>
            <ul className="space-y-2">
              {PAPERS.map((p) => (
                <li key={p} className="flex items-center gap-2 text-sm text-gray-700">
                  <Check className="w-4 h-4 text-green-600 shrink-0" /> {p}
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-400 mt-3">Digital foil is only available on the papers listed above.</p>
          </div>
        </div>
      </section>

      {/* Section 1 — File prep */}
      <section className="max-w-4xl mx-auto px-4 py-16">
        <div className="flex items-center gap-3 mb-8">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white text-sm font-bold">1</span>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" /> How to prepare your file
          </h2>
        </div>
        <ol className="space-y-4">
          {PREP_STEPS.map((s, i) => (
            <li
              key={s.title}
              className={`flex gap-4 rounded-xl border p-5 ${s.emphasis ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-white'}`}
            >
              <span className="shrink-0 w-7 h-7 rounded-full bg-gray-900 text-white text-sm font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <div>
                <p className="font-semibold text-gray-900">{s.title}</p>
                <p className="text-sm text-gray-600 leading-relaxed mt-1">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Finished example */}
      <section className="bg-gray-50 py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-bold text-gray-900 mb-2 text-center">Finished product</h2>
          <p className="text-sm text-gray-500 text-center mb-8">
            Print spec: double-sided print + double-sided gloss gold foil
          </p>
          <div className="grid gap-6 sm:grid-cols-2 mb-12">
            <figure>
              <CardMockup side="front" />
              <figcaption className="text-center text-sm text-gray-500 mt-2">Front</figcaption>
            </figure>
            <figure>
              <CardMockup side="back" />
              <figcaption className="text-center text-sm text-gray-500 mt-2">Back</figcaption>
            </figure>
          </div>

          <h3 className="text-lg font-bold text-gray-900 mb-6 text-center">File setup example</h3>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Print file</p>
              <div className="grid grid-cols-2 gap-3">
                <CardMockup side="front" />
                <CardMockup side="back" />
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Foil file <span className="text-amber-600">(draw in K100)</span>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <FoilLayerMockup side="front" />
                <FoilLayerMockup side="back" />
              </div>
            </div>
          </div>
          <p className="text-center text-sm text-gray-500 mt-4">
            Keep the print file and the foil file as separate groups in the same document.
          </p>
        </div>
      </section>

      {/* Section 2 — Cautions */}
      <section className="max-w-4xl mx-auto px-4 py-16">
        <div className="flex items-center gap-3 mb-8">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white text-sm font-bold">2</span>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" /> Design cautions
          </h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          {CAUTIONS.map((c) => (
            <div key={c.title} className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="inline-flex items-center justify-center w-10 h-10 bg-amber-50 rounded-lg mb-4">
                <c.icon className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{c.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gray-900 py-16 px-4 text-center">
        <h2 className="text-2xl font-bold text-white mb-4">Ready to add digital foil?</h2>
        <p className="text-gray-300 mb-8 max-w-md mx-auto">
          Choose a supported premium paper, upload your K100 foil layer, and we handle the rest.
        </p>
        <Link
          href="/products"
          className="inline-flex items-center justify-center gap-2 bg-amber-500 text-gray-900 px-6 py-3 rounded-lg font-semibold hover:bg-amber-400 transition-colors"
        >
          <Sparkles className="w-4 h-4" /> Browse premium cards
        </Link>
      </section>
    </>
  )
}
