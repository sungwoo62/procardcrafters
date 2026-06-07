import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { runOptimizationLoop } from '@/lib/experiments/service'

// 자동 최적화 루프 (OMO-2596): 성과수집 → 평가 → 자동 승자 채택.
// running + auto_promote 실험을 평가하고, 유의한 승자 발견 시 채택 + 패자 비활성화.
// Vercel Cron: 매일 1회 (Hobby 플랜 제약 — 일 1회).
export const maxDuration = 60

async function run(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerClient()
  const outcomes = await runOptimizationLoop(supabase)

  const promoted = outcomes.filter((o) => o.promoted)
  return NextResponse.json({
    ok: true,
    evaluated: outcomes.length,
    promoted: promoted.length,
    outcomes: outcomes.map((o) => ({
      experiment: o.experimentKey,
      decided: o.result.decided,
      reason: o.result.reason,
      winner: o.result.winnerKey,
      promoted: o.promoted,
      deactivated: o.deactivatedVariantKeys,
    })),
  })
}

export async function GET(request: NextRequest) {
  return run(request)
}

export async function POST(request: NextRequest) {
  return run(request)
}
