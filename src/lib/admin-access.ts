// 어드민 접근 통제 단일 진실원(single source of truth).
// 미들웨어와 서버측 requireAdmin 이 동일한 fail-closed 규칙을 공유한다.
// (OMO-2736 — fail-open 제거: ADMIN_EMAILS 가 비면 모두 거부)

/** ADMIN_EMAILS 환경변수 raw 문자열을 정규화된 소문자 이메일 목록으로 파싱. */
export function parseAdminEmails(raw: string | undefined | null): string[] {
  return (raw ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * 주어진 사용자 이메일이 어드민 허용 목록에 있는지 fail-closed 로 판정.
 * 허용 목록이 비어 있으면(설정 누락 포함) 무조건 false → 접근 거부.
 */
export function isAllowedAdmin(
  userEmail: string | undefined | null,
  rawAllowed: string | undefined | null
): boolean {
  const allowed = parseAdminEmails(rawAllowed)
  if (allowed.length === 0) return false // fail-closed
  const email = (userEmail ?? '').trim().toLowerCase()
  if (!email) return false
  return allowed.includes(email)
}
