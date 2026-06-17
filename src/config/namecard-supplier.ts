// OMO-3417: 명함 섹션 공급사 분기 플래그.
//
// 보드 결정(2026-06-17, OMO-3411 코멘트 9af1ee5e): 명함 섹션만 성원(swadpia)→printcity(프린트시티)
// 로 공급사를 전환한다. 타 카테고리는 성원 유지. 성원 명함 코드/설정은 **삭제 금지** — 이 플래그로
// hide(비활성)만 한다.
//
// 가격 컷오버(flag=printcity 라이브 적용)는 **보드 전용 승인 게이트**다. 따라서 기본값은
// 'swadpia'(현행 유지·라이브 고객가 무영향). env NEXT_PUBLIC_NAMECARD_SUPPLIER=printcity 로만 전환.
//
// 주의: 이 모듈은 서버/클라이언트 양쪽에서 import 되므로 census/매트릭스 JSON 을 가져오지 않는다
// (클라이언트 번들 비대화 방지). 명함 slug 목록만 자체 보유한다.

export type NamecardSupplier = 'swadpia' | 'printcity'

// printcity-namecard.ts OUR_CARD_SLUGS 와 동기화. (census 미import 위해 의도적 중복 — 8개 고정)
export const NAMECARD_SLUGS: readonly string[] = [
  'business-cards',
  'premium-business-cards',
  'premium-foil-cards',
  'letterpress-business-cards',
  'pearl-business-cards',
  'uv-business-cards',
  'transparent-business-cards',
  'metallic-business-cards',
] as const

const NAMECARD_SLUG_SET: ReadonlySet<string> = new Set(NAMECARD_SLUGS)

export function isNamecardSlug(slug: string): boolean {
  return NAMECARD_SLUG_SET.has(slug)
}

function readFlag(): NamecardSupplier {
  const raw = (process.env.NEXT_PUBLIC_NAMECARD_SUPPLIER ?? '').trim().toLowerCase()
  return raw === 'printcity' ? 'printcity' : 'swadpia'
}

/** 전역 명함 공급사 플래그(절대값, 기본 swadpia). */
export const NAMECARD_SUPPLIER: NamecardSupplier = readFlag()

/**
 * 주어진 slug 에 적용할 공급사.
 * 명함 slug + 플래그 printcity 일 때만 printcity, 그 외(타 카테고리·플래그 OFF)는 전부 swadpia.
 */
export function supplierForSlug(slug: string): NamecardSupplier {
  return isNamecardSlug(slug) && NAMECARD_SUPPLIER === 'printcity' ? 'printcity' : 'swadpia'
}
