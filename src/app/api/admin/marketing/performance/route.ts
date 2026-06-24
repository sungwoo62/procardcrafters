import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createServerClient } from '@/lib/supabase'
import { aggregatePerformance } from '@/lib/marketing/performance'

// 마케팅 성과측정 API (OMO-2587 · 북극성 축3)
// CVR / 매출 / ROAS / CPA / 채널별 매출 기여를 실데이터로 집계한다.
// 집계 로직은 src/lib/marketing/performance.ts(aggregatePerformance)에 공용화되어
// 주간 리뷰 cron(/api/cron/marketing-review)과 동일 규칙을 공유한다.
// 데이터가 아직 없는 지표(예: 광고비 미적재)는 0/null + notes 로 정직하게 반환 — 추측성 수치 금지.
export async function GET(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const daysParam = Number(request.nextUrl.searchParams.get('days') ?? '30')
  const days = Number.isFinite(daysParam) && daysParam > 0 && daysParam <= 365 ? daysParam : 30

  const until = new Date()
  const since = new Date(until.getTime() - days * 86400000)

  const supabase = createServerClient()
  try {
    const window = await aggregatePerformance(supabase, since, until)
    return NextResponse.json({
      range: { days, since: window.since.slice(0, 10) },
      kpi: window.kpi,
      channels: window.channels,
      notes: window.notes,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : '집계 실패'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
