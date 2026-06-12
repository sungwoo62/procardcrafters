// 직업별 니치 랜딩 재사용 템플릿(OMO-2971).
// 섹션: Hero / 직업 맥락 / 프리미엄 마감 그리드 / 가격 CTA / FAQ / 비교 내부링크.
// en-US 콘텐츠. 외부 CSS 클래스 의존 없이 self-contained 인라인 스타일(서버 컴포넌트).

import type { CSSProperties } from 'react'
import type { ProfessionContent } from '@/lib/niche/professions'
import { getFinishes } from '@/lib/niche/finishes'

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

function Breadcrumbs({ profession }: { profession: string }) {
  return (
    <nav aria-label="Breadcrumb" style={{ fontSize: '0.85rem', color: '#64748b' }}>
      <a href="/" style={{ color: '#64748b' }}>Home</a>
      <span style={{ margin: '0 0.4rem' }}>/</span>
      <a href="/business-cards/for" style={{ color: '#64748b' }}>Business Cards</a>
      <span style={{ margin: '0 0.4rem' }}>/</span>
      <span style={{ color: '#0f172a' }}>{profession}</span>
    </nav>
  )
}

export default function NicheLanding({ p }: { p: ProfessionContent }) {
  const finishes = getFinishes(p.recommendedFinishes)

  return (
    <div lang="en-US">
      {/* Hero */}
      <section style={{ background: `linear-gradient(135deg,${BLUE},${DARK})`, color: 'white', padding: '4rem 0 4.5rem' }}>
        <div style={CONTAINER}>
          <Breadcrumbs profession={p.profession} />
          <h1 style={{ fontSize: '2.4rem', fontWeight: 800, margin: '1.25rem 0 1rem', lineHeight: 1.15 }}>{p.h1}</h1>
          <p style={{ fontSize: '1.2rem', opacity: 0.92, maxWidth: '640px', marginBottom: '2rem' }}>{p.heroSubhead}</p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <a href={`/quote?type=namecard&niche=${p.slug}`} style={{ ...BTN, background: 'white', color: BLUE, fontSize: '1.05rem', padding: '0.9rem 2.25rem', fontWeight: 700 }}>
              Get a Free Quote
            </a>
            <a href="/business-cards/for" style={{ ...BTN, background: 'transparent', color: 'white', fontSize: '1.05rem', padding: '0.9rem 2.25rem', fontWeight: 700, border: '2px solid white' }}>
              See All Finishes
            </a>
          </div>
          <p style={{ fontSize: '0.9rem', opacity: 0.85, marginTop: '1.1rem' }}>
            Premium cards from <strong>${p.priceFrom}</strong> · proofed before printing · ships in 4–6 business days
          </p>
        </div>
      </section>

      {/* 직업 맥락 */}
      <section style={{ padding: '3.5rem 0' }}>
        <div style={{ ...CONTAINER, maxWidth: '780px' }}>
          <p style={{ fontSize: '1.1rem', lineHeight: 1.7, color: '#334155' }}>{p.intro}</p>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '2rem 0 1rem' }}>Where {p.profession.toLowerCase()} use them</h2>
          <ul style={{ display: 'grid', gap: '0.65rem', paddingLeft: '1.1rem', color: '#334155', lineHeight: 1.6 }}>
            {p.useCases.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* 프리미엄 마감 그리드 */}
      <section style={{ padding: '3rem 0', background: '#f8fafc' }}>
        <div style={CONTAINER}>
          <h2 style={{ textAlign: 'center', fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Recommended finishes for {p.profession.toLowerCase()}
          </h2>
          <p style={{ textAlign: 'center', color: '#64748b', marginBottom: '2.5rem' }}>
            The premium finishes that convert best in your line of work.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: '1.25rem' }}>
            {finishes.map((f) => (
              <div key={f.slug} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem' }}>
                <div style={{ fontSize: '1.8rem', marginBottom: '0.6rem' }} aria-hidden>{f.icon}</div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>{f.name}</h3>
                <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: 1.55 }}>{f.blurb}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 가격 CTA */}
      <section style={{ padding: '3.5rem 0' }}>
        <div style={{ ...CONTAINER, textAlign: 'center', maxWidth: '640px' }}>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.75rem' }}>Ready to design yours?</h2>
          <p style={{ color: '#475569', marginBottom: '2rem' }}>
            Tell us about your card and we&apos;ll send a free quote and proof. No account required.
          </p>
          <a href={`/quote?type=namecard&niche=${p.slug}`} style={{ ...BTN, background: BLUE, color: 'white', fontSize: '1.1rem', padding: '1rem 2.75rem', fontWeight: 700 }}>
            Get My Free Quote
          </a>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: '3rem 0', background: '#f8fafc' }}>
        <div style={{ ...CONTAINER, maxWidth: '780px' }}>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '1.75rem', textAlign: 'center' }}>Frequently asked questions</h2>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {p.faqs.map((f, i) => (
              <details key={i} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.1rem 1.25rem' }}>
                <summary style={{ fontWeight: 600, cursor: 'pointer', color: '#0f172a' }}>{f.question}</summary>
                <p style={{ marginTop: '0.75rem', color: '#475569', lineHeight: 1.6 }}>{f.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 비교 / 내부링크 */}
      {p.internalLinks.length > 0 && (
        <section style={{ padding: '2.5rem 0 3.5rem' }}>
          <div style={{ ...CONTAINER, maxWidth: '780px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' }}>Explore more</h2>
            <ul style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', listStyle: 'none', padding: 0 }}>
              {p.internalLinks.map((l, i) => (
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
