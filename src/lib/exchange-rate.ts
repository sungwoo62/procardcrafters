// KRW → USD 환율 관리
//
// 기준 환율: 1525 KRW/USD (환율 리스크 완충 포함)
// 반환값: USD per KRW (예: 0.000656 = 1/1525)
//
// 우선순위:
//   1. 환경변수 EXCHANGE_RATE_KRW_PER_USD (관리자 수동 설정)
//   2. Frankfurter 실시간 API — 단, 기준값 미만이면 기준값 사용
//   3. Fallback (API 장애 시)

const FRANKFURTER_URL = 'https://api.frankfurter.app/latest?from=KRW&to=USD'

// 운영 기준 최솟값: 실시간이 이보다 낮으면 이 값을 사용한다
const FLOOR_KRW_PER_USD = process.env.EXCHANGE_RATE_KRW_PER_USD
  ? parseInt(process.env.EXCHANGE_RATE_KRW_PER_USD, 10)
  : 1525

// Fallback (API 장애 시)
const FALLBACK_USD_PER_KRW = 1 / FLOOR_KRW_PER_USD

let cached: { rate: number; fetchedAt: number } | null = null
const CACHE_TTL_MS = 60 * 60 * 1000

// Returns USD per KRW (e.g. 0.000656 for 1525 KRW/USD)
export async function getKrwToUsdRate(): Promise<number> {
  const now = Date.now()

  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.rate
  }

  try {
    const res = await fetch(FRANKFURTER_URL, { next: { revalidate: 3600 } })
    if (!res.ok) throw new Error(`Exchange rate API error: ${res.status}`)
    const data = await res.json()
    const usdPerKrw: number = data.rates?.USD
    if (!usdPerKrw) throw new Error('USD rate not found')

    const krwPerUsd = Math.round(1 / usdPerKrw)
    // 실시간이 기준값보다 낮으면 기준값 사용 (1/x가 클수록 krw 약세 → 더 보수적)
    const effectiveKrwPerUsd = Math.max(krwPerUsd, FLOOR_KRW_PER_USD)
    const effectiveRate = 1 / effectiveKrwPerUsd

    cached = { rate: effectiveRate, fetchedAt: now }
    return effectiveRate
  } catch {
    return FALLBACK_USD_PER_KRW
  }
}

// KRW to USD conversion
export function krwToUsd(krw: number, rate: number): number {
  return Math.round(krw * rate * 100) / 100
}
