import { describe, it, expect } from 'vitest'
import {
  getAdTargetingDefaults,
  buildLocalRadiusTargeting,
  resolveCampaignTargeting,
  clampRadius,
  assertRadiusAllowed,
  DEFAULT_COUNTRY,
  RADIUS_MIN_KM,
  RADIUS_MAX_KM,
  RADIUS_MAX_MILE,
} from '../targeting'

describe('getAdTargetingDefaults', () => {
  it('인자 없으면 US 광역 기본값', () => {
    expect(getAdTargetingDefaults()).toEqual({
      geo_locations: { countries: [DEFAULT_COUNTRY] },
    })
  })

  it('국가 지정 시 해당 국가 광역', () => {
    expect(getAdTargetingDefaults('KR')).toEqual({
      geo_locations: { countries: ['KR'] },
    })
  })
})

describe('clampRadius', () => {
  it('하한 미만 → 최소 반경', () => {
    expect(clampRadius(0)).toBe(RADIUS_MIN_KM)
  })

  it('상한 초과(km) → 80km', () => {
    expect(clampRadius(500)).toBe(RADIUS_MAX_KM)
  })

  it('상한 초과(mile) → 50mile', () => {
    expect(clampRadius(500, 'mile')).toBe(RADIUS_MAX_MILE)
  })

  it('범위 내 값은 그대로', () => {
    expect(clampRadius(5)).toBe(5)
  })

  it('NaN → 최소 반경', () => {
    expect(clampRadius(Number.NaN)).toBe(RADIUS_MIN_KM)
  })
})

describe('assertRadiusAllowed', () => {
  it('NONE 은 허용', () => {
    expect(() => assertRadiusAllowed('NONE')).not.toThrow()
  })

  it.each(['HOUSING', 'EMPLOYMENT', 'CREDIT', 'ISSUES_ELECTIONS_POLITICS'] as const)(
    '%s 은 반경 제한 → 에러',
    (cat) => {
      expect(() => assertRadiusAllowed(cat)).toThrow(/반경/)
    }
  )
})

describe('buildLocalRadiusTargeting', () => {
  it('핀 + 반경 + "이 지역 거주"(home) 기본 구성', () => {
    const t = buildLocalRadiusTargeting({
      latitude: 37.5665,
      longitude: 126.978,
      radius: 5,
      address: '서울시청',
    })
    expect(t.geo_locations.location_types).toEqual(['home'])
    expect(t.geo_locations.custom_locations).toEqual([
      {
        latitude: 37.5665,
        longitude: 126.978,
        radius: 5,
        distance_unit: 'kilometer',
        address_string: '서울시청',
      },
    ])
    // 광역 countries 는 포함하지 않는다(로컬 전용)
    expect(t.geo_locations.countries).toBeUndefined()
  })

  it('dwell=recent 지정 시 location_types 반영', () => {
    const t = buildLocalRadiusTargeting({
      latitude: 40.0,
      longitude: -74.0,
      radius: 10,
      dwell: 'recent',
      distanceUnit: 'mile',
    })
    expect(t.geo_locations.location_types).toEqual(['recent'])
    expect(t.geo_locations.custom_locations?.[0].distance_unit).toBe('mile')
  })

  it('반경이 한도 초과 시 클램프', () => {
    const t = buildLocalRadiusTargeting({ latitude: 0, longitude: 0, radius: 9999 })
    expect(t.geo_locations.custom_locations?.[0].radius).toBe(RADIUS_MAX_KM)
  })

  it('주소 미지정 시 address_string 생략', () => {
    const t = buildLocalRadiusTargeting({ latitude: 0, longitude: 0, radius: 3 })
    expect(t.geo_locations.custom_locations?.[0].address_string).toBeUndefined()
  })

  it('Special Ad Category(HOUSING) → 에러', () => {
    expect(() =>
      buildLocalRadiusTargeting({
        latitude: 37.5,
        longitude: 127,
        radius: 5,
        specialAdCategory: 'HOUSING',
      })
    ).toThrow(/Special Ad Category/)
  })

  it('잘못된 위도 → 에러', () => {
    expect(() =>
      buildLocalRadiusTargeting({ latitude: 999, longitude: 0, radius: 5 })
    ).toThrow(/위도/)
  })

  it('잘못된 경도 → 에러', () => {
    expect(() =>
      buildLocalRadiusTargeting({ latitude: 0, longitude: 999, radius: 5 })
    ).toThrow(/경도/)
  })
})

describe('resolveCampaignTargeting (캠페인 단위 토글)', () => {
  it('옵션 없음 → 광역 기본값(US)', () => {
    expect(resolveCampaignTargeting()).toEqual({
      geo_locations: { countries: ['US'] },
    })
  })

  it('country 지정 → 해당 국가 광역', () => {
    expect(resolveCampaignTargeting({ country: 'KR' })).toEqual({
      geo_locations: { countries: ['KR'] },
    })
  })

  it('local 옵션 → 반경 타겟', () => {
    const t = resolveCampaignTargeting({
      local: { latitude: 37.5, longitude: 127, radius: 5 },
    })
    expect(t.geo_locations.custom_locations).toHaveLength(1)
    expect(t.geo_locations.location_types).toEqual(['home'])
  })
})
