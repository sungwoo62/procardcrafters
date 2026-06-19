// 니치 랜딩 재사용 템플릿 — 전 제품군 공유(OMO-3215, 기반 OMO-2971/3211).
// 섹션: Hero / 맥락 / 추천옵션 사진 그리드 / 가격 CTA / FAQ / 비교 내부링크.
// en-US 콘텐츠. 외부 CSS 클래스 의존 없이 self-contained 인라인 스타일(서버 컴포넌트).
//
// 제품군 파라미터화: ProfessionContent 대신 일반화된 NicheContent 를 받는다.
// 사진 섹션(photos[])·프리셋 딥링크 CTA(ctaPresetHref)는 보드 지시(OMO-3211)로 내재화.

import type { CSSProperties } from 'react'
import type { NicheContent } from '@/lib/niche/content'
import type { PresetEstimate } from '@/lib/niche/estimate'
import { getGroupLabel } from '@/lib/niche/content'

const BLUE = '#2563eb'
const DARK = '#1d4ed8'

// .container / .btn 글로벌 클래스 대체(procardcrafters 미정의) — 인라인으로 자체 완결.
const CONTAINER: CSSProperties = { maxWidth: '1120px', margin: '0 auto', padding: '0 1.25rem' }
const BTN: CSSProperties = {
  display: 'inline-block',
  borderRadius: '8px',
  textDecoration: 'none',
  lineHeight: 1.2,
  cursor: 'pointer',
}

function Breadcrumbs({ groupLabel, groupHref, title }: { groupLabel: string; groupHref: string; title: string }) {
  return (
    <nav aria-label="Breadcrumb" style={{ fontSize: '0.85rem', color: '#64748b' }}>
      <a href="/" style={{ color: '#64748b' }}>Home</a>
      <span style={{ margin: '0 0.4rem' }}>/</span>
      <a href={groupHref} style={{ color: '#64748b' }}>{groupLabel}</a>
      <span style={{ margin: '0 0.4rem' }}>/</span>
      <span style={{ color: '#0f172a' }}>{title}</span>
    </nav>
  )
}

/** "Make it with these options" CTA 아래 실제 예상가 줄 (보드 지시 OMO-3211). */
function EstimateLine({ estimate }: { estimate: PresetEstimate }) {
  const price = Math.round(estimate.priceUsd)
  return (
    <p style={{ color: '#475569', fontSize: '0.95rem', marginTop: '0.85rem' }}>
      Estimated from <strong style={{ color: '#0f172a' }}>${price}</strong>
      {estimate.hasFinishing ? ' with these finishes' : ''} · final price set in the designer
      <br />
      <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
        Varies by quantity and options — adjust anything before you order.
      </span>
    </p>
  )
}

export default function NicheLanding({
  content,
  estimate,
}: {
  content: NicheContent
  /** 프리셋 실제 예상가(서버 산정). 산정 불가 시 undefined → 가격줄 생략. */
  estimate?: PresetEstimate | null
}) {
  const c = content
  const groupHref = `/${c.productGroup}/for`
  const groupLabel = getGroupLabel(c.productGroup)
  const buildHref = c.ctaPresetHref

  return (
    <div lang="en-US">
      {/* Hero */}
      <section style={{ background: `linear-gradient(135deg,${BLUE},${DARK})`, color: 'white', padding: '4rem 0 4.5rem' }}>
        <div style={CONTAINER}>
          <Breadcrumbs groupLabel={groupLabel} groupHref={groupHref} title={c.title} />
          <h1 style={{ fontSize: '2.4rem', fontWeight: 800, margin: '1.25rem 0 1rem', lineHeight: 1.15 }}>{c.h1}</h1>
          <p style={{ fontSize: '1.2rem', opacity: 0.92, maxWidth: '640px', marginBottom: '2rem' }}>{c.heroSubhead}</p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <a href={buildHref} style={{ ...BTN, background: 'white', color: BLUE, fontSize: '1.05rem', padding: '0.9rem 2.25rem', fontWeight: 700 }}>
              Make it with these options
            </a>
            <a href={groupHref} style={{ ...BTN, background: 'transparent', color: 'white', fontSize: '1.05rem', padding: '0.9rem 2.25rem', fontWeight: 700, border: '2px solid white' }}>
              See all {groupLabel.toLowerCase()}
            </a>
          </div>
          <p style={{ fontSize: '0.9rem', opacity: 0.85, marginTop: '1.1rem' }}>
            From <strong>${c.priceFrom}</strong> · proofed before printing · ships in 4–6 business days
          </p>
        </div>
      </section>

      {/* 맥락 */}
      <section style={{ padding: '3.5rem 0' }}>
        <div style={{ ...CONTAINER, maxWidth: '780px' }}>
          <p style={{ fontSize: '1.1rem', lineHeight: 1.7, color: '#334155' }}>{c.intro}</p>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '2rem 0 1rem' }}>Where {c.title.toLowerCase()} use them</h2>
          <ul style={{ display: 'grid', gap: '0.65rem', paddingLeft: '1.1rem', color: '#334155', lineHeight: 1.6 }}>
            {c.useCases.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* 추천옵션 사진 그리드 (OMO-3211 보드 지시: 사진 + 프리셋 딥링크 CTA) */}
      {c.photos.length > 0 && (
        <section style={{ padding: '3rem 0', background: '#f8fafc' }}>
          <div style={CONTAINER}>
            <h2 style={{ textAlign: 'center', fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Recommended options for {c.title.toLowerCase()}
            </h2>
            <p style={{ textAlign: 'center', color: '#64748b', marginBottom: '2.5rem' }}>
              The premium options that convert best in your line of work.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: '1.25rem' }}>
              {c.photos.map((photo, i) => (
                <div key={i} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.src}
                    alt={photo.alt}
                    loading="lazy"
                    style={{ width: '100%', height: '160px', objectFit: 'cover', display: 'block', background: '#e2e8f0' }}
                  />
                  <div style={{ padding: '1.5rem' }}>
                    {photo.icon && (
                      <div style={{ fontSize: '1.4rem', marginBottom: '0.4rem' }} aria-hidden>{photo.icon}</div>
                    )}
                    {photo.title && (
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>{photo.title}</h3>
                    )}
                    {photo.blurb && (
                      <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: 1.55 }}>{photo.blurb}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
              <a href={buildHref} style={{ ...BTN, background: BLUE, color: 'white', fontSize: '1.05rem', padding: '0.9rem 2.5rem', fontWeight: 700 }}>
                Make it with these options →
              </a>
              {estimate ? (
                <EstimateLine estimate={estimate} />
              ) : (
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '0.75rem' }}>
                  Opens the designer with these options pre-selected — adjust anything before you order.
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* AI 큐레이션 진입 (OMO-3265): 정해진 프리셋 외에 "더 원하는 게 있으면" 유도 */}
      <section style={{ padding: '2.5rem 0', background: '#0f172a', color: 'white' }}>
        <div style={{ ...CONTAINER, maxWidth: '780px', textAlign: 'center' }}>
          <p style={{ fontSize: '0.85rem', letterSpacing: '0.05em', color: '#93c5fd', fontWeight: 700, marginBottom: '0.6rem' }}>
            ✨ AI CURATION
          </p>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.6rem' }}>
            Want something other than these?
          </h2>
          <p style={{ color: '#cbd5e1', marginBottom: '1.5rem', lineHeight: 1.6 }}>
            Tell us your style and budget — &ldquo;top-tier, money no object&rdquo;, &ldquo;premium but great value&rdquo;, or
            &ldquo;cheaper than anywhere else&rdquo; — and our AI curates the perfect setup, ready to order.
          </p>
          <a
            href={`/curate?group=${c.productGroup}`}
            style={{ ...BTN, background: '#3b82f6', color: 'white', fontSize: '1.05rem', padding: '0.85rem 2.25rem', fontWeight: 700 }}
          >
            Try AI Curation →
          </a>
        </div>
      </section>

      {/* 가격 CTA */}
      <section style={{ padding: '3.5rem 0' }}>
        <div style={{ ...CONTAINER, textAlign: 'center', maxWidth: '640px' }}>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.75rem' }}>Ready to design yours?</h2>
          <p style={{ color: '#475569', marginBottom: '2rem' }}>
            Start from our recommended setup and tweak it — every order is proofed before printing. No account required.
          </p>
          <a href={buildHref} style={{ ...BTN, background: BLUE, color: 'white', fontSize: '1.1rem', padding: '1rem 2.75rem', fontWeight: 700 }}>
            Design my {c.titleSingular.toLowerCase()}
          </a>
          {estimate && <EstimateLine estimate={estimate} />}
        </div>
      </section>

      {/* FAQ */}
      {c.faqs.length > 0 && (
        <section style={{ padding: '3rem 0', background: '#f8fafc' }}>
          <div style={{ ...CONTAINER, maxWidth: '780px' }}>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '1.75rem', textAlign: 'center' }}>Frequently asked questions</h2>
            <div style={{ display: 'grid', gap: '1rem' }}>
              {c.faqs.map((f, i) => (
                <details key={i} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.1rem 1.25rem' }}>
                  <summary style={{ fontWeight: 600, cursor: 'pointer', color: '#0f172a' }}>{f.question}</summary>
                  <p style={{ marginTop: '0.75rem', color: '#475569', lineHeight: 1.6 }}>{f.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 비교 / 내부링크 */}
      {c.internalLinks.length > 0 && (
        <section style={{ padding: '2.5rem 0 3.5rem' }}>
          <div style={{ ...CONTAINER, maxWidth: '780px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' }}>Explore more</h2>
            <ul style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', listStyle: 'none', padding: 0 }}>
              {c.internalLinks.map((l, i) => (
                <li key={i}>
                  <a href={l.href} style={{ display: 'inline-block', padding: '0.5rem 1rem', border: `1px solid ${BLUE}`, borderRadius: '999px', color: BLUE, fontSize: '0.9rem', fontWeight: 600, textDecoration: 'none' }}>
                    {l.label} →
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  )
}
