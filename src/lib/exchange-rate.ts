// Frankfurter free exchange rate API (CORS-enabled)
const FRANKFURTER_URL = 'https://api.frankfurter.app/latest?from=KRW&to=USD'

// In-memory exchange rate cache (1-hour TTL)
let cached: { rate: number; fetchedAt: number } | null = null
const CACHE_TTL_MS = 60 * 60 * 1000

export async function getKrwToUsdRate(): Promise<number> {
  const now = Date.now()

  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.rate
  }

  try {
    const res = await fetch(FRANKFURTER_URL, { next: { revalidate: 3600 } })
    if (!res.ok) throw new Error(`Exchange rate API error: ${res.status}`)
    const data = await res.json()
    const rate: number = data.rates?.USD
    if (!rate) throw new Error('USD exchange rate data not found')

    cached = { rate, fetchedAt: now }
    return rate
  } catch {
    // Fallback rate if API fails (approximate KRW/USD)
    return 0.00073
  }
}

// KRW to USD conversion
export function krwToUsd(krw: number, rate: number): number {
  return Math.round(krw * rate * 100) / 100
}
