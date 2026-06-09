/**
 * 공장 발주 러너 게이트웨이 (OMO-2716 — 무인 결선)
 *
 * 맥스튜디오 자동화 워커(allpack-ops/scripts/automation-hub/automation-worker.py)가
 * action=`factory.swadpia.send` 인 ops_automation_jobs 를 드레인 →
 *   POST http://127.0.0.1:18790/agent/swadpia-runner/message  { printOrderId }
 * 로 디스패치한다. 이 서버가 그걸 받아 해당 주문의 pending 발주를 Playwright 로 실행한다.
 *
 * 응답 규약(워커 재시도 계약):
 *   - 2xx : 모든 발주가 종결(placed/failed/dryRun/skip). 워커는 job=done 처리.
 *   - 5xx : 인프라 오류 또는 1건 이상 transient 재시도 필요(record 여전히 pending).
 *           → 워커가 지수 백오프 후 동일 job 재시도 → 무인 재시도 달성.
 *
 * 실행 (procardcrafters 체크아웃에서):
 *   node --env-file=.env.local --import tsx scripts/automation-hub/factory-runner.ts
 *
 * 환경변수: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *           SWADPIA_USERNAME, SWADPIA_PASSWORD, RESEND_API_KEY(선택),
 *           ADMIN_NOTIFICATION_EMAIL(선택), TELEGRAM_BOT_TOKEN/TELEGRAM_OWNER_CHAT_ID(선택),
 *           FACTORY_RUNNER_PORT(기본 18790), SWADPIA_DRY_RUN(선택)
 */

import http from 'node:http'
import { createClient } from '@supabase/supabase-js'
import { processPendingFactoryOrders } from '../../src/lib/factory-order-processor'

const PORT = Number(process.env.FACTORY_RUNNER_PORT ?? 18790)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  process.stderr.write('오류: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 없음\n')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

function log(msg: string) {
  process.stdout.write(`[${new Date().toISOString()}] [factory-runner] ${msg}\n`)
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (c) => {
      data += c
      if (data.length > 1_000_000) reject(new Error('payload too large'))
    })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

const server = http.createServer(async (req, res) => {
  const send = (code: number, obj: unknown) => {
    res.writeHead(code, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(obj))
  }

  // 헬스 체크
  if (req.method === 'GET' && (req.url === '/health' || req.url === '/')) {
    return send(200, { ok: true, service: 'factory-runner', port: PORT })
  }

  // 워커 디스패치: POST /agent/<channel>-runner/message
  if (req.method === 'POST' && /^\/agent\/[\w.-]+\/message$/.test(req.url ?? '')) {
    let payload: { printOrderId?: string; dryRun?: boolean } = {}
    try {
      const raw = await readBody(req)
      payload = raw ? JSON.parse(raw) : {}
    } catch (e) {
      return send(400, { ok: false, error: `잘못된 페이로드: ${(e as Error).message}` })
    }

    if (payload.dryRun) process.env.SWADPIA_DRY_RUN = '1'

    log(`발주 작업 수신: printOrderId=${payload.printOrderId ?? '(전체 pending)'} dryRun=${!!payload.dryRun}`)

    try {
      const results = await processPendingFactoryOrders(supabase, {
        printOrderId: payload.printOrderId,
        log,
      })

      const summary = {
        total: results.length,
        placed: results.filter((r) => r.outcome === 'placed').length,
        retry: results.filter((r) => r.outcome === 'retry').length,
        failed: results.filter((r) => r.outcome === 'failed').length,
        skipped: results.filter((r) => r.outcome === 'skipped').length,
      }
      log(`완료: ${JSON.stringify(summary)}`)

      // transient 재시도가 남아있으면 5xx → 워커가 백오프 후 job 재시도(무인 재시도).
      if (summary.retry > 0) {
        return send(503, { ok: false, retry: true, summary, results })
      }
      return send(200, { ok: true, summary, results })
    } catch (e) {
      log(`처리 오류: ${(e as Error).message}`)
      // 인프라 오류 → 5xx 로 워커 재시도 유도.
      return send(500, { ok: false, error: (e as Error).message })
    }
  }

  send(404, { ok: false, error: 'not found' })
})

server.listen(PORT, '127.0.0.1', () => {
  log(`공장 발주 러너 게이트웨이 시작 — http://127.0.0.1:${PORT}  (dryRunDefault=${process.env.SWADPIA_DRY_RUN ?? '0'})`)
})
