import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { buildWeeklyReview, persistReview } from '@/lib/marketing/performance'

// 주간 마케팅 개선 리뷰 자동 생성 (OMO-2597 · 북극성 축3 '평가와 개선' 루프 마감).
// 매주 1회: 성과 집계(/api/admin/marketing/performance 로직 공용) + 전주 대비 추세
// + 실행 가능한 개선 제안을 산출해 print_marketing_reviews 에 영속화한다.
// 대상 주는 "직전 완료 주"(실행일 -1일이 속한 주) — 월요일 실행 시 지난 한 주를 마감 평가.
// Vercel Cron(Hobby): 매주 월요일 1회 — 일배치 이하 빈도라 제약 위반 없음.
export const maxDuration = 60

async function run(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 직전 완료 주를 대상으로 한다(실행 시점이 이번 주 월요일이면 지난 주가 마감 대상).
  const anchor = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const supabase = createServerClient()
  try {
    const review = await buildWeeklyReview(supabase, anchor)
    await persistReview(supabase, review)
    return NextResponse.json({
      ok: true,
      period: { start: review.periodStart, end: review.periodEnd },
      comparedToPrevWeek: review.previous !== null,
      kpi: review.current.kpi,
      suggestions: review.suggestions.length,
      dataGaps: review.dataGaps.length,
      summaryMd: review.summaryMd,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : '리뷰 생성 실패'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return run(request)
}

export async function POST(request: NextRequest) {
  return run(request)
}
