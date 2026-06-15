// 제품군 니치 라우트 공통 헬퍼(OMO-3213) — 카테고리별 thin 라우트 파일이 공유.
import type { Metadata } from 'next'
import { absoluteUrl } from '@/lib/site'
import { getNicheCategory, getNicheEntry } from '@/lib/niche/categories'

/** 허브(/{category}/for) 메타데이터. */
export function buildHubMetadata(categorySlug: string): Metadata {
  const c = getNicheCategory(categorySlug)
  if (!c) return { title: 'Not found' }
  const url = absoluteUrl(`/${c.slug}/for`)
  return {
    // absolute: 루트 layout 의 '%s | …' 템플릿 우회(브랜드 중복 방지).
    title: { absolute: c.hubMetaTitle },
    description: c.hubMetaDescription,
    alternates: { canonical: url, languages: { 'en-US': url } },
    openGraph: { title: c.hubMetaTitle, description: c.hubMetaDescription, url, type: 'website', locale: 'en_US' },
  }
}

/** 스포크(/{category}/for/{entry}) 메타데이터. */
export function buildEntryMetadata(categorySlug: string, entrySlug: string): Metadata {
  const c = getNicheCategory(categorySlug)
  const e = getNicheEntry(categorySlug, entrySlug)
  if (!c || !e) return { title: 'Not found' }
  const url = absoluteUrl(`/${c.slug}/for/${e.slug}`)
  return {
    title: { absolute: e.metaTitle },
    description: e.metaDescription,
    alternates: { canonical: url, languages: { 'en-US': url } },
    openGraph: { title: e.metaTitle, description: e.metaDescription, url, type: 'website', locale: 'en_US' },
  }
}
