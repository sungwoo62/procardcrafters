// frankfurter.app 무료 환율 API (CORS 지원)
const FRANKFURTER_URL = 'https://api.frankfurter.app/latest?from=KRW&to=USD'

// 환율 캐시 (메모리, 1시간 TTL)
let cached: { rate: number; fetchedAt: number } | null = null
const CACHE_TTL_MS = 60 * 60 * 1000 // 1시간

export async function getKrwToUsdRate(): Promise<number> {
  const now = Date.now()

  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.rate
  }

  try {
    const res = await fetch(FRANKFURTER_URL, { next: { revalidate: 3600 } })
    if (!res.ok) throw new Error(`환율 API 응답 오류: ${res.status}`)
    const data = await res.json()
    const rate: number = data.rates?.USD
    if (!rate) throw new Error('USD 환율 데이터 없음')

    cached = { rate, fetchedAt: now }
    return rate
  } catch {
    // API 실패 시 폴백 환율 (대략적인 KRW/USD)
    return 0.00073
  }
}

// KRW → USD 변환
export function krwToUsd(krw: number, rate: number): number {
  return Math.round(krw * rate * 100) / 100
}
