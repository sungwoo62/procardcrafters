// 직업별 니치 허브 /business-cards/for (OMO-2971).
// 모든 직업 페이지로의 내부링크 흐름 + 프리미엄 마감 개요. en-US.
import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import { getAllProfessions } from '@/lib/niche/professions'
import { FINISHES } from '@/lib/niche/finishes'
import { absoluteUrl } from '@/lib/site'

export const revalidate = 3600

const url = absoluteUrl('/business-cards/for')
const BLUE = '#2563eb'
const CONTAINER: CSSProperties = { maxWidth: '1120px', margin: '0 auto', padding: '0 1.25rem' }

export const metadata: Metadata = {
  // absolute: 루트 layout 템플릿 우회(브랜드 중복 방지).
  title: { absolute: 'Premium Business Cards by Profession | ProCardCrafters' },
  description:
    'Foil, letterpress, painted-edge and NFC business cards designed for your line of work. Find the premium card built for your profession.',
  alternates: { canonical: url, languages: { 'en-US': url } },
  openGraph: { title: 'Premium Business Cards by Profession', url, type: 'website', locale: 'en_US' },
}

export default async function NicheHubPage() {
  const professions = await getAllProfessions()

  return (
    <div lang="en-US">
      <section style={{ background: `linear-gradient(135deg,${BLUE},#1d4ed8)`, color: 'white', padding: '4rem 0', textAlign: 'center' }}>
        <div style={CONTAINER}>
          <h1 style={{ fontSize: '2.3rem', fontWeight: 800, marginBottom: '1rem' }}>Business Cards Built for Your Profession</h1>
          <p style={{ fontSize: '1.15rem', opacity: 0.92, maxWidth: '620px', margin: '0 auto' }}>
            Premium finishes, designed around how you actually hand out a card.
          </p>
        </div>
      </section>

      <section style={{ padding: '3.5rem 0' }}>
        <div style={CONTAINER}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.75rem' }}>Choose your profession</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: '1.25rem' }}>
            {professions.map((p) => (
              <a key={p.slug} href={`/business-cards/for/${p.slug}`} style={{ display: 'block', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', color: '#0f172a', textDecoration: 'none' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem' }}>{p.profession}</h3>
                <p style={{ color: '#475569', fontSize: '0.92rem', lineHeight: 1.5 }}>{p.heroSubhead}</p>
                <span style={{ display: 'inline-block', marginTop: '0.9rem', color: BLUE, fontWeight: 600, fontSize: '0.9rem' }}>View cards →</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: '3rem 0', background: '#f8fafc' }}>
        <div style={CONTAINER}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.75rem', textAlign: 'center' }}>Our premium finishes</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '1.1rem' }}>
            {FINISHES.map((f) => (
              <div key={f.slug} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.4rem' }}>
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
