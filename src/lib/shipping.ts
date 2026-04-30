// FedEx-based flat shipping rates by country (USD)
// In production, precise weight/size-based calculation is needed

export interface ShippingZone {
  name: string
  baseUsd: number
  countries: string[]
}

const SHIPPING_ZONES: ShippingZone[] = [
  {
    name: 'US/Canada',
    baseUsd: 15,
    countries: ['US', 'CA'],
  },
  {
    name: 'Asia Pacific',
    baseUsd: 18,
    countries: ['AU', 'NZ', 'JP', 'SG', 'HK', 'TW', 'CN', 'KR', 'TH', 'MY', 'PH', 'ID', 'VN'],
  },
  {
    name: 'Europe',
    baseUsd: 25,
    countries: [
      'GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'SE', 'NO', 'DK', 'FI',
      'PL', 'PT', 'AT', 'CH', 'IE', 'CZ', 'HU', 'RO', 'GR',
    ],
  },
  {
    name: 'Middle East/Africa',
    baseUsd: 32,
    countries: ['AE', 'SA', 'QA', 'KW', 'BH', 'OM', 'ZA', 'EG', 'NG', 'KE'],
  },
  {
    name: 'Other',
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
