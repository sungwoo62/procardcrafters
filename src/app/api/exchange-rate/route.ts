import { NextResponse } from 'next/server'
import { getKrwToUsdRate } from '@/lib/exchange-rate'

// Client-side exchange rate endpoint (1-hour cache)
export async function GET() {
  const rate = await getKrwToUsdRate()
  return NextResponse.json(
    { rate, currency: 'KRW_USD' },
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' } }
  )
}
