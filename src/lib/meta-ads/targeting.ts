/**
 * 광고세트 위치 타겟팅 — 광역(국가) 기본값 + 반경(로컬) 타겟팅 토글 (OMO-3769)
 *
 * 보드 요청(OMO-3737 코멘트 "회사 주변 최소반경 관련인만 노출")에 따라
 * "핀(주소/좌표) + 반경 + 도달옵션('이 지역 거주')" 을 공유 meta-ads 엔진에
 * 재사용 가능한 **캠페인 단위 토글**로 추가한다.
 *
 * 설계 원칙:
 *  - procard 는 기본값(US 광역)을 그대로 쓴다 → 미적용. 로컬 니즈가 있는
 *    서비스/클라이언트가 캠페인 단위로 `buildLocalRadiusTargeting()` 을 켠다.
 *  - 반환 객체는 Meta Marketing API `targeting` 스펙(geo_locations)으로 그대로
 *    펼쳐 넣을 수 있다 → `createCampaignWithGuardrails({ targeting })` 에 주입.
 *  - Meta Special Ad Categories(주거/고용/신용)는 반경·우편번호 타겟이 제한되므로
 *    해당 카테고리에서 반경 타겟을 요청하면 차단하고 광역으로만 가게 한다.
 *
 * 단위/한도(주의): Meta custom_locations 반경은 1~80km(또는 1~50mile).
 * 너무 좁은 반경은 모수 부족 → 학습 미진입/빈도 폭증 위험 → 단계적으로 좁힌다.
 */

// ─── 상수 (Meta 제약) ────────────────────────────────────────────────────

/** procard 기본 도달 국가 — US 광역 유지 */
export const DEFAULT_COUNTRY = 'US'

/** custom_locations 반경 하한 (km / mile 공통 1) */
export const RADIUS_MIN_KM = 1
export const RADIUS_MIN_MILE = 1
/** custom_locations 반경 상한 — Meta: 80km / 50mile */
export const RADIUS_MAX_KM = 80
export const RADIUS_MAX_MILE = 50

/**
 * Meta Special Ad Categories — 반경/우편번호 타겟 제한 카테고리.
 * 'NONE' 은 제한 없음(반경 타겟 허용).
 */
export type SpecialAdCategory =
  | 'NONE'
  | 'HOUSING'
  | 'EMPLOYMENT'
  | 'CREDIT'
  | 'ISSUES_ELECTIONS_POLITICS'

/** 반경 타겟이 제한되는 카테고리(주거/고용/신용/정치) */
const RADIUS_RESTRICTED_CATEGORIES: ReadonlySet<SpecialAdCategory> = new Set([
  'HOUSING',
  'EMPLOYMENT',
  'CREDIT',
  'ISSUES_ELECTIONS_POLITICS',
])

/**
 * 도달 옵션 — 핀 위치와 사람의 관계.
 *  - 'home'   : "이 지역 거주"(집이 반경 안) → 보드 요청 기본값
 *  - 'recent' : 최근 이 지역에 있었던 사람(여행자 포함)
 * Meta `geo_locations.location_types` 에 대응. 'home' 단독이 가장 좁다.
 */
export type DwellOption = 'home' | 'recent'

// ─── 타입 ────────────────────────────────────────────────────────────────

/** Meta `targeting.geo_locations` 부분 스펙(우리가 쓰는 필드만) */
export interface MetaGeoLocations {
  countries?: string[]
  location_types?: DwellOption[]
  custom_locations?: Array<{
    latitude: number
    longitude: number
    radius: number
    distance_unit: 'kilometer' | 'mile'
    /** 디버깅/감사용 주소 라벨(Meta 무시) */
    address_string?: string
  }>
}

/** `createCampaignWithGuardrails({ targeting })` 에 주입 가능한 형태 */
export interface MetaTargeting {
  geo_locations: MetaGeoLocations
}

export interface LocalRadiusOptions {
  /** 핀 위도 */
  latitude: number
  /** 핀 경도 */
  longitude: number
  /** 반경 값(단위는 distanceUnit) */
  radius: number
  /** 반경 단위 — 기본 'kilometer' */
  distanceUnit?: 'kilometer' | 'mile'
  /** 도달 옵션 — 기본 'home'("이 지역 거주") */
  dwell?: DwellOption
  /** 감사/디버깅용 주소 라벨(선택) */
  address?: string
  /**
   * 캠페인 Special Ad Category. 반경 제한 카테고리면 에러를 던진다(광역만 허용).
   * 기본 'NONE'.
   */
  specialAdCategory?: SpecialAdCategory
}

// ─── 광역 기본값 (procard 등 비-로컬 서비스) ─────────────────────────────

/**
 * 광고세트 위치 타겟팅 기본값 — 국가 광역.
 * procard 는 이 값을 그대로 사용한다(US 전역). 인자로 다른 국가를 넘기면
 * 해당 국가 광역으로 바뀐다.
 */
export function getAdTargetingDefaults(country: string = DEFAULT_COUNTRY): MetaTargeting {
  return {
    geo_locations: {
      countries: [country],
    },
  }
}

// ─── 반경(로컬) 타겟팅 토글 ───────────────────────────────────────────────

/** Meta 한도로 반경 클램프(1~80km / 1~50mile). 범위 밖이면 가까운 한도로. */
export function clampRadius(
  radius: number,
  distanceUnit: 'kilometer' | 'mile' = 'kilometer'
): number {
  const min = distanceUnit === 'mile' ? RADIUS_MIN_MILE : RADIUS_MIN_KM
  const max = distanceUnit === 'mile' ? RADIUS_MAX_MILE : RADIUS_MAX_KM
  if (!Number.isFinite(radius)) return min
  return Math.min(max, Math.max(min, radius))
}

/**
 * Special Ad Category 가 반경 타겟을 허용하는지 검증.
 * 주거/고용/신용/정치 카테고리는 반경·우편번호 타겟이 제한 → 에러.
 */
export function assertRadiusAllowed(category: SpecialAdCategory = 'NONE'): void {
  if (RADIUS_RESTRICTED_CATEGORIES.has(category)) {
    throw new Error(
      `Special Ad Category(${category})는 반경/우편번호 타겟이 제한됩니다. ` +
        `광역 타겟(getAdTargetingDefaults)만 사용하세요.`
    )
  }
}

/**
 * 반경(로컬) 타겟팅 스펙 생성 — 핀 + 반경 + 도달옵션("이 지역 거주").
 * 반환값을 `createCampaignWithGuardrails({ targeting })` 에 그대로 주입한다.
 *
 * 좌표 유효성, 반경 한도(클램프), Special Ad Category 제한을 검증한다.
 */
export function buildLocalRadiusTargeting(opts: LocalRadiusOptions): MetaTargeting {
  const {
    latitude,
    longitude,
    radius,
    distanceUnit = 'kilometer',
    dwell = 'home',
    address,
    specialAdCategory = 'NONE',
  } = opts

  assertRadiusAllowed(specialAdCategory)

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error(`잘못된 위도: ${latitude} (−90~90 범위)`)
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error(`잘못된 경도: ${longitude} (−180~180 범위)`)
  }

  const clamped = clampRadius(radius, distanceUnit)

  const customLocation: NonNullable<MetaGeoLocations['custom_locations']>[number] = {
    latitude,
    longitude,
    radius: clamped,
    distance_unit: distanceUnit,
  }
  if (address) customLocation.address_string = address

  return {
    geo_locations: {
      custom_locations: [customLocation],
      // "이 지역 거주" = location_types: ['home']. 'recent' 포함 시 여행자도 도달.
      location_types: [dwell],
    },
  }
}

/**
 * 캠페인 단위 위치 타겟팅 토글 — 로컬 옵션이 있으면 반경, 없으면 광역 기본값.
 * 공유 엔진 호출부가 분기 없이 한 줄로 타겟팅을 결정할 수 있게 한다.
 *
 *   resolveCampaignTargeting()                        // → US 광역 (procard)
 *   resolveCampaignTargeting({ local: { ... } })      // → 반경(로컬)
 */
export function resolveCampaignTargeting(options?: {
  /** 로컬 반경 옵션. 주면 반경 타겟, 없으면 광역 기본값. */
  local?: LocalRadiusOptions
  /** 광역일 때 도달 국가(기본 US) */
  country?: string
}): MetaTargeting {
  if (options?.local) {
    return buildLocalRadiusTargeting(options.local)
  }
  return getAdTargetingDefaults(options?.country)
}
