/**
 * OMO-3752: procard 광고를 뉴트라(Nutrabiovis) 공용 KRW 광고계정에서 "분리 집행"하기 위한
 * 정책 모듈 — 통화(KRW) 단위·금액, PROCARD 네이밍 강제, 신원/픽셀 혼용 차단 가드,
 * 그리고 토큰 없이도 검증 가능한 순수 payload 빌더.
 *
 * 배경(보드 OMO-3737/3752):
 *  - 광고계정은 뉴트라(act_4465710467084819, KRW) 공용이지만 신원·예산·픽셀·네이밍은
 *    procard로 완전 분리한다. 광고가 @nutrabiovis로 나가거나, 뉴트라 픽셀/예산과 섞이면 안 된다.
 *  - 계정이 공용이므로 "계정 단위" 가드(spend_cap 등)는 절대 건드리지 않는다(뉴트라 설정 덮어쓰기 금지).
 *    procard 가드는 PROCARD 네이밍으로 선별한 캠페인 + per-campaign daily_budget으로만 적용한다.
 */

// ─── 통화: KRW (보조단위 없음, offset 0 → ×1) ────────────────────────────────
// Meta Marketing API의 금액 필드(daily_budget/spend_cap/bid)는 "계정 통화의 최소단위"로 보낸다.
// USD는 1/100(cents, offset 2)이지만 KRW는 보조단위가 없어 "원" 그대로 보낸다(offset 0, ×1).
// 예) 일 예산 ₩30,000 → daily_budget: 30000.
export const ACCOUNT_CURRENCY = 'KRW'
export const CURRENCY_MINOR_UNIT_DIGITS = 0 // KRW: ×1 (원 단위 그대로)

/** 주(major) 단위 금액(원)을 Meta API 최소단위로 변환. KRW(offset 0)는 그대로. */
export function toMinorUnits(majorAmount: number, digits = CURRENCY_MINOR_UNIT_DIGITS): number {
  return Math.round(majorAmount * 10 ** digits)
}

/** Meta 최소단위 금액을 사람이 읽는 통화 문자열로. KRW는 ₩ + 천단위 구분. */
export function formatMinor(minor: number): string {
  if (CURRENCY_MINOR_UNIT_DIGITS === 0) return `₩${minor.toLocaleString('ko-KR')}`
  const major = minor / 10 ** CURRENCY_MINOR_UNIT_DIGITS
  return `${ACCOUNT_CURRENCY} ${major.toLocaleString()}`
}

// ─── 예산 가드레일 (KRW) ─────────────────────────────────────────────────────
// 기존 USD 기준($20/일, $600 누적 캡)을 KRW로 재정의. 환율 ~₩1,350/$ 기준 근사.
//  - 일 예산 ₩30,000 (≈$22, 기존 일$20 수준 유지)
//  - procard 누적 상한 ₩800,000 (≈$590, 기존 $600 수준) — 계정 spend_cap이 아니라
//    procard 스코프 자체 추적/알림용. 계정 spend_cap은 공용이라 절대 변경하지 않는다.
export const DAILY_BUDGET_KRW = 30_000
export const DAILY_BUDGET_MINOR = toMinorUnits(DAILY_BUDGET_KRW) // KRW offset 0 → 30000
export const PROCARD_TOTAL_CAP_KRW = 800_000
export const PROCARD_TOTAL_CAP_MINOR = toMinorUnits(PROCARD_TOTAL_CAP_KRW)
export const DAILY_CAP_WARN_PCT = 90

// ─── PROCARD 네이밍 강제 ─────────────────────────────────────────────────────
// 공용 계정에서 뉴트라 캠페인과 섞이지 않도록 모든 procard 엔티티에 프리픽스를 강제한다.
// 대시보드/일일캡/ROAS 워처는 이 프리픽스로 procard 캠페인만 선별한다.
export const PROCARD_PREFIX = 'PROCARD —'

/** 이름에 PROCARD 프리픽스를 멱등 적용(이미 있으면 그대로). */
export function withProcardPrefix(name: string): string {
  const trimmed = name.trim()
  return trimmed.startsWith(PROCARD_PREFIX) ? trimmed : `${PROCARD_PREFIX} ${trimmed}`
}

/** procard 소유 엔티티인지 이름으로 판별(공용 계정에서 뉴트라 캠페인 제외용). */
export function isProcardName(name: string | undefined | null): boolean {
  return !!name && name.trim().startsWith(PROCARD_PREFIX)
}

// ─── 혼용 차단: 뉴트라 자산 금지 가드 ────────────────────────────────────────
// 광고 신원/픽셀이 실수로 뉴트라로 새어나가지 않게 하드 가드(throw).
export const NUTRA_FORBIDDEN_PIXEL_ID = '2950106602047822' // Nutrabiovis Main Pixel
export const PROCARD_INSTAGRAM_ACTOR_ID = '17841464131369489' // @procardcrafters (OMO-3737)

export interface AdIdentity {
  page_id: string
  instagram_actor_id?: string
}

/** 광고 신원이 procard인지 검증 — 페이지 필수, IG actor는 있으면 procard와 일치해야 함. */
export function assertProcardIdentity(identity: { page_id?: string; instagram_actor_id?: string }): void {
  if (!identity.page_id) {
    throw new Error('OMO-3752: object_story_spec.page_id(procard 페이지) 미설정 — 신원 분리 불가')
  }
  if (identity.instagram_actor_id && identity.instagram_actor_id !== PROCARD_INSTAGRAM_ACTOR_ID) {
    throw new Error(
      `OMO-3752: instagram_actor_id(${identity.instagram_actor_id})가 procard(@procardcrafters ${PROCARD_INSTAGRAM_ACTOR_ID})와 불일치 — 뉴트라 신원 노출 위험`,
    )
  }
}

/** 픽셀이 뉴트라 메인 픽셀이 아닌지 검증(혼용 차단). */
export function assertProcardPixel(pixelId: string | null | undefined): void {
  if (pixelId && pixelId === NUTRA_FORBIDDEN_PIXEL_ID) {
    throw new Error('OMO-3752: 뉴트라 Main Pixel 사용 금지 — procard 전용 픽셀로 분리하세요')
  }
}

// ─── 순수 payload 빌더 (토큰/네트워크 불필요 → dry-run·단위테스트 가능) ──────────

export function buildCampaignPayload(name: string, objective: string) {
  return {
    name: withProcardPrefix(name),
    objective,
    status: 'PAUSED' as const, // 신규는 항상 PAUSED 빌드 → 사장님 1클릭 활성
    special_ad_categories: [] as string[],
  }
}

export function buildAdsetPayload(params: {
  name: string
  campaignId: string
  targeting: Record<string, unknown>
  dailyBudgetMinor: number
  optimizationGoal?: string
  billingEvent?: string
  /** procard 전용 픽셀 — 전환 최적화 시 promoted_object로 명시(뉴트라 픽셀 혼용 차단) */
  pixelId?: string | null
  customEventType?: string
}) {
  assertProcardPixel(params.pixelId)
  const body: Record<string, unknown> = {
    name: withProcardPrefix(`${params.name} — AdSet`),
    campaign_id: params.campaignId,
    billing_event: params.billingEvent ?? 'IMPRESSIONS',
    optimization_goal: params.optimizationGoal ?? 'OFFSITE_CONVERSIONS',
    // KRW: 원 단위 그대로(offset 0). USD cents가 아님에 주의.
    daily_budget: params.dailyBudgetMinor,
    targeting: params.targeting,
    status: 'PAUSED',
  }
  if (params.pixelId) {
    body.promoted_object = {
      pixel_id: params.pixelId,
      custom_event_type: params.customEventType ?? 'PURCHASE',
    }
  }
  return body
}

export function buildCreativePayload(
  name: string,
  identity: AdIdentity,
  linkData: Record<string, unknown>,
) {
  assertProcardIdentity(identity)
  return {
    name: withProcardPrefix(`${name} — Creative`),
    object_story_spec: {
      ...identity,
      link_data: linkData,
    },
  }
}

export function buildAdPayload(name: string, adsetId: string, creativeId: string) {
  return {
    name: withProcardPrefix(name),
    adset_id: adsetId,
    creative: { creative_id: creativeId },
    status: 'PAUSED' as const,
  }
}
