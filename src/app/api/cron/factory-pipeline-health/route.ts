/**
 * 공장 발주 파이프라인 헬스 모니터 (북극성 축1: 업무 풀 자동화)
 *
 * Vercel 크론(하루 1회 backstop) + Railway 워커가 매 루프(~5분) 호출하여
 * 결제→발주 파이프라인 드리프트를 감지한다:
 *  - stalled placing(워커 사망) 자동 재할당(self-heal)
 *  - stale pending(큐 미배출), unowned paid(핸드오프 단절), failed 감지
 *  - 자동화 커버리지/수동개입 비율 측정 후 스냅샷 기록
 *  - 드리프트 발생 시에만 관리자 알림(정상이면 telemetry로만 적재, inbox 노이즈 0)
 */

import { NextRequest, NextResponse } from 'next/server'
import { runPipelineHealthCheck } from '@/lib/factory-pipeline-health'

export const maxDuration = 30

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let result
  try {
    result = await runPipelineHealthCheck(Date.now())
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }

  const { summary, requeued } = result

  // 정상(ok)이면 알림 없이 telemetry만 — 사람 inbox에는 "조치가 필요한 사건"만
  if (summary.severity !== 'ok') {
    await sendPipelineDriftAlert(summary).catch(() => {})
  }

  return NextResponse.json({
    severity: summary.severity,
    automationCoveragePct: summary.automationCoveragePct,
    manualInterventionPct: summary.manualInterventionPct,
    requeued,
    counts: {
      total: summary.total,
      placed: summary.placed,
      pending: summary.pending,
      placing: summary.placing,
      failed: summary.failed,
      stalledPlacing: summary.stalledPlacing,
      stalePending: summary.stalePending,
      unownedPaid: summary.unownedPaid,
    },
    alerts: summary.alerts,
  })
}

async function sendPipelineDriftAlert(summary: Awaited<ReturnType<typeof runPipelineHealthCheck>>['summary']) {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL
  const resendKey = process.env.RESEND_API_KEY
  if (!adminEmail || !resendKey) return

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const tag = summary.severity === 'critical' ? '🔴 긴급' : '🟡 경고'
  const subject = `[Procardcrafters] ${tag} 공장 발주 파이프라인 드리프트 감지`

  const alertItems = summary.alerts.map((a) => `<li>${a}</li>`).join('')
  const html = `
    <h2>공장 발주 파이프라인 드리프트</h2>
    <p><strong>심각도:</strong> ${summary.severity}</p>
    <ul>${alertItems}</ul>
    <h3>자동화 지표</h3>
    <p>자동 완료율(automation coverage): <strong>${summary.automationCoveragePct}%</strong></p>
    <p>수동개입 필요 비율(manual intervention): <strong>${summary.manualInterventionPct}%</strong></p>
    <p>큐: placed ${summary.placed} / pending ${summary.pending} / placing ${summary.placing} / failed ${summary.failed}</p>
    <p><a href="${siteUrl}/admin/orders">관리자 페이지에서 확인</a></p>
  `

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from: 'Procardcrafters <orders@procardcrafters.com>',
      to: adminEmail,
      subject,
      html,
    }),
  })
}
