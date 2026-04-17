// FedEx/기쿠리어 기반 국가별 기본 배송비 (USD)
// 실제 운영 시에는 무게/사이즈별 정밀 계산 필요

export interface ShippingZone {
  name: string
  baseUsd: number
  countries: string[]
}

const SHIPPING_ZONES: ShippingZone[] = [
  {
    name: '미국/캐나다',
    baseUsd: 15,
    countries: ['US', 'CA'],
  },
  {
    name: '아시아태평양',
    baseUsd: 18,
    countries: ['AU', 'NZ', 'JP', 'SG', 'HK', 'TW', 'CN', 'KR', 'TH', 'MY', 'PH', 'ID', 'VN'],
  },
  {
    name: '유럽',
    baseUsd: 25,
    countries: [
      'GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'SE', 'NO', 'DK', 'FI',
      'PL', 'PT', 'AT', 'CH', 'IE', 'CZ', 'HU', 'RO', 'GR',
    ],
  },
  {
    name: '중동/아프리카',
    baseUsd: 32,
    countries: ['AE', 'SA', 'QA', 'KW', 'BH', 'OM', 'ZA', 'EG', 'NG', 'KE'],
  },
  {
    name: '기타',
    baseUsd: 35,
    countries: [],
  },
]

export function getShippingCost(countryCode: string): number {
  const zone =
    SHIPPING_ZONES.find((z) => z.countries.includes(countryCode.toUpperCase())) ??
    SHIPPING_ZONES[SHIPPING_ZONES.length - 1]

  return zone.baseUsd
}

export function getShippingZoneName(countryCode: string): string {
  const zone =
    SHIPPING_ZONES.find((z) => z.countries.includes(countryCode.toUpperCase())) ??
    SHIPPING_ZONES[SHIPPING_ZONES.length - 1]

  return zone.name
}

export { SHIPPING_ZONES }
