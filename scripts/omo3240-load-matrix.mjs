/**
 * OMO-3240 — 가격 매트릭스 적재기. 크롤 아티팩트(JSON) → print_swadpia_price_matrix upsert
 * + print_swadpia_price_crawl_runs 로그.
 *
 * 멱등: unique(category_code,size_code,paper_code,side,qty) on-conflict upsert.
 * 마이그 배포 게이트(OMO-1292): 테이블 미배포(42P01)면 적재를 건너뛰고 경고만 남긴다
 * (크롤러 개발/검증은 선행 가능 — 표는 CEO 배포 후 동일 아티팩트로 재실행).
 *
 * 사용:
 *   node scripts/omo3240-load-matrix.mjs                                  # matrix-latest.json
 *   node scripts/omo3240-load-matrix.mjs scripts/test-artifacts/omo3240/matrix-...json
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const envPath = path.resolve('.env.local')
if (fs.existsSync(envPath)) {
  for (const l of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function rowsFromArtifact(artifact, hasPct) {
  const out = []
  for (const r of artifact.results || []) {
    if (r.error || !r.rows) continue
    for (const row of r.rows) {
      if (!Number.isFinite(row.total)) continue // 가격 미독취 셀 제외
      const o = {
        category_code: r.code,
        product_slug: r.slug || null,
        size_code: row.size_code || '',
        paper_code: row.paper_code || '',
        side: row.side || 1,
        qty: row.qty,
        total_price_krw: row.total,
        paper_price: row.paper ?? null,
        plate_price: row.plate ?? null,
        print_price: row.print ?? null,
        source: row.source || 'sampled',
        option_combo: { size_label: row.size_label, paper_label: row.paper_label, side_label: row.side_label, print_color_type: row.print_color_type || '', qty_field: r.qtyField },
      }
      // print_color_type 컬럼이 배포된 경우에만 키에 포함(마이그 ...000020 전엔 컬럼 부재 → 제외).
      if (hasPct) o.print_color_type = row.print_color_type || ''
      out.push(o)
    }
  }
  return out
}

export async function loadMatrix(artifact) {
  if (!SUPABASE_URL || !SERVICE_KEY) { console.error('[load] SUPABASE 키 누락 — 적재 불가'); return { ok: false, reason: 'no-keys' } }
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
  // print_color_type 컬럼 배포 여부 감지 → 유니크키/행 구성 분기(전·후방 호환).
  const pctProbe = await supabase.from('print_swadpia_price_matrix').select('print_color_type').limit(1)
  const hasPct = !pctProbe.error
  const onConflict = hasPct
    ? 'category_code,size_code,paper_code,side,print_color_type,qty'
    : 'category_code,size_code,paper_code,side,qty'
  const rows = rowsFromArtifact(artifact, hasPct)
  const sampledCount = rows.filter(r => r.source === 'sampled').length
  const interpolatedCount = rows.filter(r => r.source === 'interpolated').length
  const categoryCodes = [...new Set(rows.map(r => r.category_code))]

  // crawl_run 시작 로그
  let runId = null
  const runIns = await supabase.from('print_swadpia_price_crawl_runs').insert({
    started_at: artifact.startedAt, finished_at: artifact.finishedAt, status: 'partial',
    category_codes: categoryCodes, sampled_count: sampledCount, interpolated_count: interpolatedCount,
  }).select('id').single()

  const isMissingTable = (e) => e && (e.code === '42P01' || e.code === 'PGRST205' || /schema cache|could not find the table|does not exist/i.test(e.message || ''))
  if (runIns.error) {
    if (isMissingTable(runIns.error)) {
      console.warn('[load] ⚠️ print_swadpia_price_crawl_runs 미배포(42P01) — 마이그 게이트(OMO-1292) 대기. 적재 건너뜀.')
      console.warn(`[load] 준비된 행: ${rows.length} (sampled ${sampledCount} / interp ${interpolatedCount}). 표 배포 후 재실행하면 동일 결과.`)
      return { ok: false, reason: 'table-missing', preparedRows: rows.length, sampledCount, interpolatedCount }
    }
    console.error('[load] crawl_runs insert 오류:', runIns.error.message)
    return { ok: false, reason: 'run-insert-error', error: runIns.error.message }
  }
  runId = runIns.data.id

  // 매트릭스 upsert(배치)
  let upserted = 0, failed = 0
  const BATCH = 500
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH).map(r => ({ ...r, crawl_run_id: runId }))
    const up = await supabase.from('print_swadpia_price_matrix')
      .upsert(batch, { onConflict })
    if (up.error) { failed += batch.length; console.error(`[load] batch ${i} 오류:`, up.error.message) }
    else upserted += batch.length
  }

  await supabase.from('print_swadpia_price_crawl_runs').update({
    status: failed ? 'partial' : 'success',
    error: failed ? `${failed} rows failed to upsert` : null,
  }).eq('id', runId)

  console.log(`[load] run=${runId} upserted=${upserted} failed=${failed} (sampled ${sampledCount} / interp ${interpolatedCount})`)
  return { ok: failed === 0, runId, upserted, failed, sampledCount, interpolatedCount }
}

// CLI 직접 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2] || 'scripts/test-artifacts/omo3240/matrix-latest.json'
  if (!fs.existsSync(file)) { console.error(`아티팩트 없음: ${file}`); process.exit(1) }
  const artifact = JSON.parse(fs.readFileSync(file, 'utf8'))
  loadMatrix(artifact).then(r => process.exit(r.ok ? 0 : 0)).catch(e => { console.error(e); process.exit(1) })
}
