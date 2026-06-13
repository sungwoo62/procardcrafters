import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { fetchSwadpiaCategoryDataByCode } from '@/lib/swadpia'
import {
  computeFingerprint,
  diffFingerprint,
  type SwadpiaFingerprint,
} from '@/lib/swadpia-mapping'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// OMO-3058: 성원 맵핑/옵션 드리프트 감지 크론.
// 검증된(category_code 보유) 제품마다 성원 라이브 데이터를 재조회해 핑거프린트를
// 비교한다. 변경이 있으면 (1) mapping.status='drift' 로 표시 (2) drift_log 에
// 미보고 레코드 적재. 보드 보고는 Paperclip 루틴이 미보고분을 읽어 처리한다.
//
// 인증: CRON_SECRET (Vercel Cron / 수동 트리거 공통). ?dry=1 이면 DB 미기록 진단만.

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
  }
  const dryRun = req.nextUrl.searchParams.get('dry') === '1'
  const supabase = createServerClient()

  const { data: rows, error } = await supabase
    .from('print_swadpia_mapping')
    .select('slug, category_code, fingerprint, status')
    .not('category_code', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const checked: string[] = []
  const drifted: { slug: string; categoryCode: string; summary: string }[] = []
  const errored: { slug: string; error: string }[] = []

  for (const row of rows ?? []) {
    const code = row.category_code as string
    checked.push(row.slug)
    const data = await fetchSwadpiaCategoryDataByCode(code)
    if (!data.fetchSuccess) {
      errored.push({ slug: row.slug, error: data.errorMessage ?? 'fetch 실패' })
      continue
    }
    const next = computeFingerprint(data)
    const prev = row.fingerprint as SwadpiaFingerprint | null
    const diff = diffFingerprint(prev, next)
    if (!diff) {
      // 변경 없음 — 최신 핑거프린트로 갱신(최초 baseline 포함)
      if (!dryRun) {
        await supabase
          .from('print_swadpia_mapping')
          .update({ fingerprint: next })
          .eq('slug', row.slug)
      }
      continue
    }
    drifted.push({ slug: row.slug, categoryCode: code, summary: diff.summary })
    if (!dryRun) {
      await supabase.from('print_swadpia_drift_log').insert({
        slug: row.slug,
        category_code: code,
        change_summary: diff.summary,
        suggested_action: diff.suggestion,
        prev_fingerprint: prev,
        new_fingerprint: next,
        reported: false,
      })
      // 맵핑 행: 드리프트 표시 + 핑거프린트는 보드 재검증 전까지 보존(prev 유지)
      await supabase
        .from('print_swadpia_mapping')
        .update({ status: 'drift', verify_error: diff.summary })
        .eq('slug', row.slug)
    }
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    checkedCount: checked.length,
    driftedCount: drifted.length,
    erroredCount: errored.length,
    drifted,
    errored,
  })
}
