// 제품군 일반화 니치 허브 /[group]/for (OMO-3215).
// 그룹 내 모든 니치 페이지로의 내부링크 흐름. en-US.
// 기존 /business-cards/for URL 을 동일 엔진으로 무회귀 재사용.
import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  getNicheGroups,
  getNicheGroupConfig,
  getNicheByGroup,
} from '@/lib/niche/content'
import { FINISHES } from '@/lib/niche/finishes'
import { absoluteUrl } from '@/lib/site'

export const revalidate = 3600
export const dynamicParams = true

const BLUE = '#2563eb'
const CONTAINER: CSSProperties = { maxWidth: '1120px', margin: '0 auto', padding: '0 1.25rem' }

type Params = { group: string }

export async function generateStaticParams(): Promise<Params[]> {
  return getNicheGroups().map((g) => ({ group: g.group }))
}

export async function generateMetadata(
  { params }: { params: Promise<Params> },
): Promise<Metadata> {
  const { group } = await params
  const cfg = getNicheGroupConfig(group)
  if (!cfg) return { title: 'Not found' }
  const url = absoluteUrl(`/${group}/for`)
  return {
    // absolute: 루트 layout 템플릿 우회(브랜드 중복 방지).
    title: { absolute: cfg.hubMetaTitle },
    description: cfg.hubMetaDescription,
    alternates: { canonical: url, languages: { 'en-US': url } },
    openGraph: { title: cfg.hubMetaTitle, url, type: 'website', locale: 'en_US' },
  }
}

export default async function NicheHubPage(
  { params }: { params: Promise<Params> },
) {
  const { group } = await params
  const cfg = getNicheGroupConfig(group)
  if (!cfg) notFound()
  const items = await getNicheByGroup(group)

  return (
    <div lang="en-US">
      <section style={{ background: `linear-gradient(135deg,${BLUE},#1d4ed8)`, color: 'white', padding: '4rem 0', textAlign: 'center' }}>
        <div style={CONTAINER}>
          <h1 style={{ fontSize: '2.3rem', fontWeight: 800, marginBottom: '1rem' }}>{cfg.hubH1}</h1>
          <p style={{ fontSize: '1.15rem', opacity: 0.92, maxWidth: '620px', margin: '0 auto' }}>
            {cfg.hubSubhead}
          </p>
        </div>
      </section>

      <section style={{ padding: '3.5rem 0' }}>
        <div style={CONTAINER}>
          {items.length > 0 ? (
            <>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.75rem' }}>Choose yours</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: '1.25rem' }}>
                {items.map((c) => (
                  <a key={c.slug} href={`/${c.productGroup}/for/${c.slug}`} style={{ display: 'block', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', color: '#0f172a', textDecoration: 'none' }}>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem' }}>{c.title}</h3>
                    <p style={{ color: '#475569', fontSize: '0.92rem', lineHeight: 1.5 }}>{c.heroSubhead}</p>
                    <span style={{ display: 'inline-block', marginTop: '0.9rem', color: BLUE, fontWeight: 600, fontSize: '0.9rem' }}>View →</span>
                  </a>
                ))}
              </div>
            </>
          ) : (
            <p style={{ color: '#475569', fontSize: '1.05rem', lineHeight: 1.6, maxWidth: '620px' }}>
              New {cfg.label.toLowerCase()} landing pages are on the way. In the meantime, explore our full
              {' '}<a href="/products" style={{ color: BLUE, fontWeight: 600 }}>product catalog</a>.
            </p>
          )}
        </div>
      </section>

      {/* business-cards 허브: 프리미엄 마감 개요(기존 OMO-2971 섹션 유지) */}
      {group === 'business-cards' && (
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
      )}
    </div>
  )
}
