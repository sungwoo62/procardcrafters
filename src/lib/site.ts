// ProCardCrafters(미국 프리미엄 명함) 브랜드 사이트 상수.
// 직업별 니치 랜딩(프로그래매틱 SEO, OMO-2971)에서 canonical/JSON-LD/sitemap 절대 URL 생성에 사용.
// en-US 타겟.

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://procardcrafters.com'
).replace(/\/$/, '')

export const BRAND = {
  name: 'ProCardCrafters',
  locale: 'en-US',
  currency: 'USD',
} as const

/** 절대 URL 생성 헬퍼. path는 '/'로 시작. */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}
