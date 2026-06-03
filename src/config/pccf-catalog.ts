// ProCardCrafters 카탈로그 슬러그 화이트리스트 — opt-in.
// `PCCF_PRODUCT_SLUGS` env (CSV) 가 설정되면 해당 슬러그만 노출.
// 미설정 시 필터링하지 않음 (DB 의 is_active=true 모두 노출).
//
// OMO-2314 후속: 보드와 어떤 슬러그가 진짜 ProCard 카탈로그인지 정해진 뒤
// 본 env 를 채우는 식으로 운영. 기본은 무필터 — 데이터 보존이 우선.

function parseEnv(): readonly string[] | null {
  const raw = process.env.PCCF_PRODUCT_SLUGS
  if (!raw || !raw.trim()) return null
  const list = raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  return list.length > 0 ? list : null
}

export const PCCF_PRODUCT_SLUGS: readonly string[] | null = parseEnv()

export function isPccfSlug(slug: string): boolean {
  if (!PCCF_PRODUCT_SLUGS) return true
  return PCCF_PRODUCT_SLUGS.includes(slug)
}
