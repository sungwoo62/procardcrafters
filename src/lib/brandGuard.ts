/**
 * 고객 노출 카피 브랜드 가드 (OMO-2975 · 보드 지시 2026-06-12, local-board)
 *
 * procardcrafters 고객 노출 카피(홈·제품·견적·메타데이터·광고 랜딩)에는
 * **모회사·타사 브랜드명을 절대 넣지 않는다.** 과거 'Powered by Sungwon Adpia'
 * provenance 표기를 넣었다가 보드가 전면 거부 → 재발 방지를 위해 금지어를
 * 코드/환경변수/테스트로 3중 고정한다.
 *
 * - 금지어 출처: NEXT_PUBLIC_FORBIDDEN_BRAND_MENTIONS (쉼표 구분, .env*)
 *   미설정 시 아래 DEFAULT_FORBIDDEN_BRAND_MENTIONS 사용.
 * - 강제: src/lib/__tests__/brandGuard.test.ts 가 `npm test` 시 src/app·
 *   src/components 전수 스캔 → 금지어 발견 시 빌드 실패.
 * - 정책 문서: docs/BRAND-COPY-POLICY.md
 */

/** 환경변수 미설정 시 기본 금지어 (대소문자 무시 부분일치). */
export const DEFAULT_FORBIDDEN_BRAND_MENTIONS = [
  "Sungwon Adpia",
  "Sungwon",
  "Adpia",
  "성원애드피아",
  "성원 애드피아",
];

/** 실제 적용 금지어 목록 (env override > default). */
export const FORBIDDEN_BRAND_MENTIONS: string[] = (
  process.env.NEXT_PUBLIC_FORBIDDEN_BRAND_MENTIONS ??
  DEFAULT_FORBIDDEN_BRAND_MENTIONS.join(",")
)
  .split(",")
  .map((term) => term.trim())
  .filter(Boolean);

/** text 안에서 발견된 금지 브랜드명을 반환(대소문자 무시). 없으면 빈 배열. */
export function findForbiddenBrandMentions(text: string): string[] {
  const lower = text.toLowerCase();
  return FORBIDDEN_BRAND_MENTIONS.filter((term) =>
    lower.includes(term.toLowerCase()),
  );
}

/** 금지 브랜드명이 있으면 throw. 카피 생성 파이프라인에서 가드로 사용. */
export function assertNoForbiddenBrandMentions(text: string, label = "text"): void {
  const hits = findForbiddenBrandMentions(text);
  if (hits.length > 0) {
    throw new Error(
      `금지된 타사/모회사 브랜드명이 ${label}에 포함됨: ${hits.join(", ")} (OMO-2975)`,
    );
  }
}
