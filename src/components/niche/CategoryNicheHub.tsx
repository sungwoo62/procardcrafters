// 제품군별 니치 허브 템플릿(OMO-3213) — /{category}/for.
// 카테고리 내 모든 유스케이스로의 내부링크 + 카테고리 공통 옵션 개요. en-US.
import type { CSSProperties } from 'react'
import type { NicheCategory } from '@/lib/niche/categories'

const BLUE = '#2563eb'
const CONTAINER: CSSProperties = { maxWidth: '1120px', margin: '0 auto', padding: '0 1.25rem' }

export default function CategoryNicheHub({ category }: { category: NicheCategory }) {
  return (
    <div lang="en-US">
      <section style={{ background: `linear-gradient(135deg,${BLUE},#1d4ed8)`, color: 'white', padding: '4rem 0', textAlign: 'center' }}>
        <div style={CONTAINER}>
          <h1 style={{ fontSize: '2.3rem', fontWeight: 800, marginBottom: '1rem' }}>{category.hubH1}</h1>
          <p style={{ fontSize: '1.15rem', opacity: 0.92, maxWidth: '640px', margin: '0 auto' }}>{category.hubSubhead}</p>
        </div>
      </section>

      <section style={{ padding: '3.5rem 0' }}>
        <div style={CONTAINER}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.75rem' }}>Choose your use case</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: '1.25rem' }}>
            {category.entries.map((e) => (
              <a key={e.slug} href={`/${category.slug}/for/${e.slug}`} style={{ display: 'block', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', color: '#0f172a', textDecoration: 'none' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem' }}>{e.audience}</h3>
                <p style={{ color: '#475569', fontSize: '0.92rem', lineHeight: 1.5 }}>{e.heroSubhead}</p>
                <span style={{ display: 'inline-block', marginTop: '0.9rem', color: BLUE, fontWeight: 600, fontSize: '0.9rem' }}>View options →</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: '3rem 0', background: '#f8fafc' }}>
        <div style={CONTAINER}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.75rem', textAlign: 'center' }}>What you can choose</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '1.1rem' }}>
            {category.hubFeatures.map((f) => (
              <div key={f.name} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.4rem' }}>
                <div style={{ fontSize: '1.7rem', marginBottom: '0.5rem' }} aria-hidden>{f.icon}</div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.4rem' }}>{f.name}</h3>
                <p style={{ color: '#475569', fontSize: '0.9rem', lineHeight: 1.5 }}>{f.blurb}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
