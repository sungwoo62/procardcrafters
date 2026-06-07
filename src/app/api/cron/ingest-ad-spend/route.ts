import { NextRequest, NextResponse } from 'next/server'
import { runAdSpendIngest, type AdSpendChannel } from '@/lib/ad-spend'

// 광고비 일배치 cron (OMO-2595 · 북극성 축3)
// Google Ads/Meta에서 일자×캠페인 spend/impressions/clicks/conversions를 가져와
// print_ad_spend에 upsert → /admin/marketing 의 ROAS/CPA를 활성화한다.
//
// 자격증명 없는 채널은 skipped로 정직하게 보고(추측 적재 금지).
// 기본 days=3: 최근 3일을 겹쳐 재동기화해 플랫폼 사후 보정(전환/스펜드)을 반영.
// 백필: ?days=N (최대 365). 수동 호출 시 Bearer CRON_SECRET 필요.

export const maxDuration = 60

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
  }

  const daysParam = Number(request.nextUrl.searchParams.get('days'))
  const days = Number.isFinite(daysParam) && daysParam > 0 ? daysParam : undefined

  const channelParam = request.nextUrl.searchParams.get('channel')
  const channels =
    channelParam && channelParam !== 'all'
      ? (channelParam.split(',').filter((c): c is AdSpendChannel => c === 'google_ads' || c === 'meta'))
      : undefined

  try {
    const summary = await runAdSpendIngest({ now: Date.now(), days, channels })
    return NextResponse.json(summary)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
