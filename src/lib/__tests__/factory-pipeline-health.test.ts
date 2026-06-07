import { describe, it, expect } from 'vitest'
import { summarizePipeline, isTestEmail, type PipelineCounts } from '@/lib/factory-pipeline-health'

const base: PipelineCounts = {
  total: 0,
  placed: 0,
  pending: 0,
  placing: 0,
  failed: 0,
  stalledPlacing: 0,
  stalePending: 0,
  unownedPaid: 0,
}

describe('summarizePipeline — 자동화 커버리지/심각도', () => {
  it('드리프트 없으면 ok, 알림 없음', () => {
    const s = summarizePipeline({ ...base, total: 10, placed: 10 })
    expect(s.severity).toBe('ok')
    expect(s.alerts).toEqual([])
    expect(s.automationCoveragePct).toBe(100)
    expect(s.manualInterventionPct).toBe(0)
  })

  it('automation coverage = placed / total', () => {
    const s = summarizePipeline({ ...base, total: 8, placed: 6, pending: 2 })
    expect(s.automationCoveragePct).toBe(75)
  })

  it('failed 존재 → critical + 수동개입 비율 반영', () => {
    const s = summarizePipeline({ ...base, total: 4, placed: 3, failed: 1 })
    expect(s.severity).toBe('critical')
    expect(s.manualInterventionPct).toBe(25)
    expect(s.alerts.some((a) => a.includes('실패'))).toBe(true)
  })

  it('unownedPaid(핸드오프 단절) → critical, 분모에 가산', () => {
    // total=2 placed=2, unownedPaid=2 → 수동개입 = 2 / (2+2) = 50%
    const s = summarizePipeline({ ...base, total: 2, placed: 2, unownedPaid: 2 })
    expect(s.severity).toBe('critical')
    expect(s.manualInterventionPct).toBe(50)
    expect(s.alerts.some((a) => a.includes('핸드오프'))).toBe(true)
  })

  it('stalledPlacing/stalePending만 있으면 warning', () => {
    const s = summarizePipeline({ ...base, total: 5, placed: 3, placing: 1, pending: 1, stalledPlacing: 1, stalePending: 1 })
    expect(s.severity).toBe('warning')
    expect(s.alerts.some((a) => a.includes('재할당'))).toBe(true)
    expect(s.alerts.some((a) => a.includes('적체'))).toBe(true)
  })

  it('critical이 warning보다 우선', () => {
    const s = summarizePipeline({ ...base, total: 5, placed: 3, failed: 1, stalledPlacing: 1 })
    expect(s.severity).toBe('critical')
  })

  it('total=0이면 0으로 나누지 않고 0% 반환', () => {
    const s = summarizePipeline({ ...base })
    expect(s.automationCoveragePct).toBe(0)
    expect(s.manualInterventionPct).toBe(0)
    expect(s.severity).toBe('ok')
  })
})

describe('isTestEmail — QA/테스트 주문 식별 (OMO-2598)', () => {
  it('회사 도메인 + test 토큰이면 테스트 주문', () => {
    expect(isTestEmail('batch-test@procardcrafters.com')).toBe(true)
    expect(isTestEmail('e2e-test@procardcrafters.com')).toBe(true)
    expect(isTestEmail('test@procardcrafters.com')).toBe(true)
    expect(isTestEmail('BATCH-TEST@Procardcrafters.com')).toBe(true) // 대소문자 무시
  })

  it('실제 고객 이메일은 테스트 주문이 아님', () => {
    expect(isTestEmail('jane@gmail.com')).toBe(false)
    expect(isTestEmail('orders@acme.co')).toBe(false)
    // 외부 도메인이면 test 토큰이 있어도 제외하지 않음 (실고객 보호)
    expect(isTestEmail('test.user@gmail.com')).toBe(false)
    // 회사 도메인이지만 test 토큰 없으면 실제 운영 메일로 간주
    expect(isTestEmail('hello@procardcrafters.com')).toBe(false)
  })

  it('빈 값/null/undefined는 false', () => {
    expect(isTestEmail('')).toBe(false)
    expect(isTestEmail(null)).toBe(false)
    expect(isTestEmail(undefined)).toBe(false)
  })
})
