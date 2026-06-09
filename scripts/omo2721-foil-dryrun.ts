/**
 * OMO-2721 — 후가공(박) 발주 라이브 dry-run 러너 (ops 게이트)
 *
 * OMO-2707 종결 시 CEO가 이월한 단 하나의 라이브 검증:
 * 첫 박(foil_stamp) 포함 실주문이 print_factory_orders 큐에 들어오는 시점에
 * 해당 주문 데이터로 dryRun=true 1회 실행해 성원 폼 정합성을 최종 확인한다.
 *
 * dryRun=true 는 로그인 → 옵션/후가공 활성화 → 주문모달 → plupload 업로드 →
 * hidden 필드 세팅까지 프로덕션 경로를 그대로 거친 뒤 **제출/결제 직전에 멈추고**
 * 폼 스냅샷을 반환한다. 실주문은 발생하지 않는다(큐 상태도 변경하지 않음).
 *
 * 실행 (SWADPIA creds 보유한 ops/cron 환경):
 *   node --experimental-strip-types --env-file=.env.local scripts/omo2721-foil-dryrun.ts
 *
 * 옵션:
 *   FOIL_ORDER_ID=<print_factory_orders.id>  특정 레코드 지정(미지정 시 큐에서 첫 박 주문 자동 선택)
 *
 * 환경변수: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SWADPIA_USERNAME, SWADPIA_PASSWORD
 *
 * 출력: result.finishing 스냅샷 + OMO-2707 Done 기준 자동 판정(PASS/FAIL).
 *       그대로 OMO-2721 코멘트에 붙여 종결 근거로 사용.
 */

import { createClient } from '@supabase/supabase-js'
import { placeSwadpiaOrder, type FactoryOrderRecord } from '../src/lib/swadpia-order'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY) {
  process.stderr.write('오류: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수 없음\n')
  process.exit(1)
}
if (!process.env.SWADPIA_USERNAME || !process.env.SWADPIA_PASSWORD) {
  process.stderr.write('오류: SWADPIA_USERNAME / SWADPIA_PASSWORD 환경변수 없음 (dev 환경에선 dry-run 불가)\n')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

/** options_snapshot 에 박(bak) 후가공이 포함됐는지 — expandFinishingToSwadpiaFields 결과 기준 */
function isFoilOrder(opts: Record<string, string> | null): boolean {
  if (!opts) return false
  const s = JSON.stringify(opts).toLowerCase()
  return s.includes('chk_is_bak') || s.includes('bak_section') || s.includes('foil') || s.includes('박')
}

/** 첫 박 주문 선택: 명시 ID 우선, 없으면 큐에서 가장 오래된 박 주문 */
async function pickFoilOrder(): Promise<FactoryOrderRecord | null> {
  const explicitId = process.env.FOIL_ORDER_ID
  if (explicitId) {
    const { data } = await supabase
      .from('print_factory_orders')
      .select('*')
      .eq('id', explicitId)
      .single()
    return (data as FactoryOrderRecord) ?? null
  }
  const { data, error } = await supabase
    .from('print_factory_orders')
    .select('*')
    .order('queued_at', { ascending: true })
    .limit(200)
  if (error) {
    process.stderr.write(`DB 조회 실패: ${error.message}\n`)
    process.exit(1)
  }
  const rows = (data ?? []) as FactoryOrderRecord[]
  return rows.find((r) => isFoilOrder(r.options_snapshot)) ?? null
}

/** place-factory-orders.ts 와 동일한 파일 URL 해소 로직(2706 합본 PDF signed URL) */
async function resolveFileUrl(record: FactoryOrderRecord): Promise<string | null> {
  if (record.file_url) return record.file_url

  const tryFiles = async (col: 'order_item_id' | 'order_id', val: string) => {
    const { data: files } = await supabase
      .from('print_files')
      .select('storage_path')
      .eq(col, val)
      .in('status', ['approved', 'uploaded'])
      .limit(1)
    if (files && files.length > 0) {
      const { data: signed } = await supabase.storage
        .from('print-files')
        .createSignedUrl(files[0].storage_path, 3600)
      return signed?.signedUrl ?? null
    }
    return null
  }

  if (record.print_order_item_id) {
    const u = await tryFiles('order_item_id', record.print_order_item_id)
    if (u) return u
  }
  return tryFiles('order_id', record.print_order_id)
}

/** OMO-2707 Done 기준 자동 판정 */
function evaluateDone(finishing: NonNullable<Awaited<ReturnType<typeof placeSwadpiaOrder>>['finishing']>) {
  const fs = finishing.formState ?? {}
  const checks = [
    ['present === true', finishing.present === true],
    ['spotPlatePresent === true (합본 ≥2p = M100 별색판 포함)', finishing.spotPlatePresent === true],
    ['formState.chk_is_bak === true', fs.chk_is_bak === true],
    ['bak_section_1 채워짐', !!fs.bak_section_1],
    ['bak_side_1 채워짐', !!fs.bak_side_1],
    ['bak_type_1 채워짐', !!fs.bak_type_1],
    ['uploadedFileName 존재(plupload chgFileName)', !!finishing.uploadedFileName],
  ] as const
  return checks
}

async function main() {
  process.stdout.write(`[${new Date().toISOString()}] OMO-2721 박 발주 dry-run 시작\n`)

  const record = await pickFoilOrder()
  if (!record) {
    process.stdout.write(
      '\n[TRIGGER 미발생] print_factory_orders 큐에 박(foil_stamp) 포함 주문이 아직 없습니다.\n' +
        '첫 박 실주문이 큐에 들어오면 본 스크립트를 다시 실행하세요.\n',
    )
    return
  }

  process.stdout.write(
    `\n대상 박 주문: ${record.id}\n` +
      `  print_order_id: ${record.print_order_id}\n` +
      `  category_code:  ${record.category_code}\n` +
      `  quantity:       ${record.quantity}\n` +
      `  status:         ${record.status}\n` +
      `  options_snapshot: ${JSON.stringify(record.options_snapshot)}\n`,
  )

  const fileUrl = await resolveFileUrl(record)
  if (!fileUrl) {
    process.stderr.write('\n오류: 2706 합본 PDF 파일 URL을 찾을 수 없음(print_files approved/uploaded 없음).\n')
    process.exit(1)
  }

  process.stdout.write('\nPlaywright dry-run 실행(제출 직전 멈춤, 실주문 미발생)...\n')
  const result = await placeSwadpiaOrder({
    productSlugOrCategoryCode: record.category_code,
    selectedOptions: record.options_snapshot,
    quantity: record.quantity,
    fileUrl,
    orderTitle: `OMO-2721 dryrun ${record.print_order_id.slice(0, 8)}`,
    dryRun: true,
  })

  process.stdout.write('\n===== result.finishing 스냅샷 =====\n')
  process.stdout.write(JSON.stringify(result.finishing, null, 2) + '\n')

  if (!result.finishing) {
    process.stderr.write('\nFAIL: finishing 스냅샷이 비어있음(후가공 미인식). 옵션 매핑 확인 필요.\n')
    process.exit(1)
  }

  process.stdout.write('\n===== OMO-2707 Done 기준 판정 =====\n')
  const checks = evaluateDone(result.finishing)
  let allPass = true
  for (const [label, ok] of checks) {
    process.stdout.write(`  [${ok ? 'PASS' : 'FAIL'}] ${label}\n`)
    if (!ok) allPass = false
  }
  process.stdout.write(`\n종합: ${allPass ? 'PASS — OMO-2721 종결 근거 충족' : 'FAIL — 위 항목 확인 필요'}\n`)
  process.exit(allPass ? 0 : 2)
}

main().catch((e) => {
  process.stderr.write(`\n예외: ${e?.stack ?? e}\n`)
  process.exit(1)
})
