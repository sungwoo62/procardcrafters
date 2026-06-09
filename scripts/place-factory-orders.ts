/**
 * 성원애드피아 공장 발주 처리 스크립트 (배치/폴백)
 *
 * print_factory_orders 의 pending 항목을 Playwright 로 자동 발주.
 * 핵심 로직은 src/lib/factory-order-processor.ts 로 추출되어, 무인 게이트웨이
 * (scripts/automation-hub/factory-runner.ts)와 공유한다.
 *
 * 이 스크립트는 (1) 크론/수동 배치 폴백, (2) 무인 큐가 놓친 pending 정리 용도.
 * 평시 무인 발주는 결제 웹훅 → ops_automation_jobs → 맥스튜 워커 → factory-runner 로 흐른다(OMO-2716).
 *
 * 실행:
 *   node --env-file=.env.local --import tsx scripts/place-factory-orders.ts
 *
 * 크론 예시 (crontab — 무인 큐 백업 청소부):
 *   0 9,14,17 * * 1-5  cd /path/to/project && node --env-file=.env.local --import tsx scripts/place-factory-orders.ts
 *
 * 환경변수 필요:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   SWADPIA_USERNAME, SWADPIA_PASSWORD
 *   ADMIN_NOTIFICATION_EMAIL / RESEND_API_KEY (실패 알림, 선택)
 *   TELEGRAM_BOT_TOKEN / TELEGRAM_OWNER_CHAT_ID (사장님 알림, 선택)
 */

import { createClient } from '@supabase/supabase-js'
import { processPendingFactoryOrders } from '../src/lib/factory-order-processor'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY) {
  process.stderr.write('오류: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수 없음\n')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function main() {
  process.stdout.write(`[${new Date().toISOString()}] 공장 발주 배치 시작\n`)

  const results = await processPendingFactoryOrders(supabase, {
    limit: 10,
    log: (msg) => process.stdout.write(msg + '\n'),
  })

  const summary = {
    total: results.length,
    placed: results.filter((r) => r.outcome === 'placed').length,
    retry: results.filter((r) => r.outcome === 'retry').length,
    failed: results.filter((r) => r.outcome === 'failed').length,
    skipped: results.filter((r) => r.outcome === 'skipped').length,
  }

  process.stdout.write(`[${new Date().toISOString()}] 완료 — ${JSON.stringify(summary)}\n`)
}

main().catch((err) => {
  process.stderr.write(`치명적 오류: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
