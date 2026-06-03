// ProCardCrafters 카탈로그 화이트리스트 — 성원애드피아(Swadpia) 기반 9개 슬러그만 노출.
// 다른 프로젝트(omoongmoo 등)와의 prefix 분리 원칙 + OMO-2314 보드 지시에 따른 사양.
// `PCCF_PRODUCT_SLUGS` env (CSV) 로 오버라이드 가능.

const DEFAULT_PCCF_SLUGS = [
  'business-cards',
  'premium-business-cards',
  'stickers',
  'die-cut-stickers',
  'flyers',
  'brochures',
  'postcards',
  'posters',
  'banners',
] as const

function parseEnv(): readonly string[] {
  const raw = process.env.PCCF_PRODUCT_SLUGS
  if (!raw) return DEFAULT_PCCF_SLUGS
  const list = raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  return list.length > 0 ? list : DEFAULT_PCCF_SLUGS
}

export const PCCF_PRODUCT_SLUGS: readonly string[] = parseEnv()

export function isPccfSlug(slug: string): boolean {
  return PCCF_PRODUCT_SLUGS.includes(slug)
}
