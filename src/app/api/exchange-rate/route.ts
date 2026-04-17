import { NextResponse } from 'next/server'
import { getKrwToUsdRate } from '@/lib/exchange-rate'

// 클라이언트용 환율 엔드포인트 (1시간 캐시)
export async function GET() {
  const rate = await getKrwToUsdRate()
  return NextResponse.json(
    { rate, currency: 'KRW_USD' },
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' } }
  )
}
