// OMO-2597 주간 마케팅 리뷰 — 순수 로직(부수효과 없음).
// 전주/금주 성과 윈도우를 받아 전주 대비 델타·실행 가능한 개선 제안·마크다운 요약을 만든다.
// DB I/O는 performance.ts가 담당하므로 여기는 계산만 — 단위 테스트가 쉽다.
import type { ChannelAgg, PerformanceWindow } from './performance'

export interface MetricDelta {
  current: number
  previous: number
  absChange: number
  pctChange: number | null // previous=0 이면 null(증가율 정의 불가)
}

export interface Suggestion {
  category: 'budget' | 'seo' | 'landing' | 'email' | 'data'
  priority: 'high' | 'medium' | 'low'
  title: string
  rationale: string // 데이터 근거
  action: string // 구체 실행
}

export interface DataGap {
  metric: string
  reason: string
  unblock: string
}

export interface WeeklyReview {
  periodStart: string
  periodEnd: string
  current: PerformanceWindow
  previous: PerformanceWindow | null
  deltas: {
    revenue_usd: MetricDelta
    orders: MetricDelta
    aov_usd: MetricDelta
    ad_spend_usd: MetricDelta
    blended_roas: MetricDelta | null
    paid_cvr_pct: MetricDelta | null
  } | null
  suggestions: Suggestion[]
  dataGaps: DataGap[]
  summaryMd: string
}

// ── 계산 유틸 ────────────────────────────────────────────────
export function delta(current: number, previous: number): MetricDelta {
  const absChange = current - previous
  const pctChange = previous === 0 ? null : (absChange / previous) * 100
  return { current, previous, absChange, pctChange }
}

function deltaNullable(current: number | null, previous: number | null): MetricDelta | null {
  if (current === null || previous === null) return null
  return delta(current, previous)
}

function usd(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function signed(d: MetricDelta | null): string {
  if (!d) return '비교 불가'
  const arrow = d.absChange > 0 ? '▲' : d.absChange < 0 ? '▼' : '–'
  const pct = d.pctChange === null ? '신규' : `${d.pctChange >= 0 ? '+' : ''}${d.pctChange.toFixed(1)}%`
  return `${arrow} ${pct}`
}

// GA4 세션 미연동으로 남는 유일한 데이터 부족 항목(나머지는 OMO-2587/2595로 해소됨).
export const STANDING_DATA_GAPS: DataGap[] = [
  {
    metric: '사이트 전체 CVR(주문/세션)',
    reason: 'GA4 Data API 자격증명 미연동 — 세션수(분모) 서버 집계 불가. 현재는 광고 클릭 기준 CVR만 제공.',
    unblock: 'GA4_PROPERTY_ID + 서비스계정 뷰어 권한(OMO-2602) 주입 시 산출',
  },
]

// ── 개선 제안 생성 ───────────────────────────────────────────
// 실측 ROAS/CPA/매출 추세만 근거로 제안(데이터 없는 제안 금지).
export function generateSuggestions(
  current: PerformanceWindow,
  previous: PerformanceWindow | null,
): Suggestion[] {
  const out: Suggestion[] = []
  const paidChannels = current.channels.filter((c) => c.spend_usd > 0 && c.roas !== null)

  // 1) 예산 재배분: 최고 ROAS vs 최저 ROAS 채널 격차가 크면 재배분.
  if (paidChannels.length >= 2) {
    const sorted = [...paidChannels].sort((a, b) => (b.roas as number) - (a.roas as number))
    const best = sorted[0]
    const worst = sorted[sorted.length - 1]
    if ((best.roas as number) >= (worst.roas as number) * 1.5) {
      out.push({
        category: 'budget',
        priority: 'high',
        title: `예산을 '${worst.label}'(ROAS ${worst.roas}) → '${best.label}'(ROAS ${best.roas})로 재배분`,
        rationale: `'${best.label}' ROAS ${best.roas} vs '${worst.label}' ROAS ${worst.roas} (광고비 ${usd(
          best.spend_usd,
        )}/${usd(worst.spend_usd)}). 최소 1.5배 격차.`,
        action: `'${worst.label}' 일예산을 단계적으로 줄여 '${best.label}'에 이전하고 2주 후 ROAS 재측정.`,
      })
    }
  }

  // 2) 손실 채널 차단: ROAS < 1 (광고비 > 매출)인 채널.
  for (const c of paidChannels) {
    if ((c.roas as number) < 1) {
      out.push({
        category: 'budget',
        priority: 'high',
        title: `'${c.label}' 캠페인 점검/축소 — ROAS ${c.roas} (손실 구간)`,
        rationale: `광고비 ${usd(c.spend_usd)} 대비 매출 ${usd(c.revenue_usd)}, ROAS ${c.roas} (<1.0).`,
        action: '저성과 키워드/오디언스 제외, 입찰 하향 또는 일시중지 후 크리에이티브 재설계.',
      })
    }
  }

  // 3) 랜딩/전환 개선: 유료 클릭은 많은데 클릭 기준 CVR이 낮으면 랜딩 이탈.
  if (current.kpi.paid_clicks >= 200 && current.kpi.paid_cvr_pct !== null && current.kpi.paid_cvr_pct < 1) {
    out.push({
      category: 'landing',
      priority: 'medium',
      title: '유료 유입 랜딩 전환 점검 — 클릭 기준 CVR 1% 미만',
      rationale: `유료 클릭 ${current.kpi.paid_clicks}건 대비 클릭 CVR ${current.kpi.paid_cvr_pct}%.`,
      action: '광고 메시지-랜딩 일치도, 첫 화면 가치제안, 견적/체크아웃 동선·모바일 UX 마찰 제거.',
    })
  }

  // 4) SEO: 자연 검색 매출 기여가 낮거나(=유료 의존), 전체 매출이 정체/하락이면 콘텐츠 강화.
  const organic = current.channels.find((c) => c.channel === 'organic_search')
  const organicShare = current.kpi.revenue_usd > 0 ? (organic?.revenue_usd ?? 0) / current.kpi.revenue_usd : 0
  const revStalled = previous ? current.kpi.revenue_usd <= previous.kpi.revenue_usd : false
  if (organicShare < 0.2 || revStalled) {
    out.push({
      category: 'seo',
      priority: 'medium',
      title: '오가닉 유입 확대용 SEO 콘텐츠 발행',
      rationale: `자연 검색 매출 기여 ${(organicShare * 100).toFixed(1)}%${
        previous ? `, 매출 ${signed(delta(current.kpi.revenue_usd, previous.kpi.revenue_usd))}` : ''
      }. 유료 의존도를 낮출 오가닉 채널 강화 필요.`,
      action:
        "세그먼트 검색의도 주제(예: '마라톤 대회 기념품 단체주문 가이드', '졸업식 상패 제작 비용·납기') Content팀에 의뢰.",
    })
  }

  // 5) 이메일: 매출 기여 채널로 활성화돼 있으면 유지/확대, 없으면 리드 확보.
  const email = current.channels.find((c) => c.channel === 'email')
  if (!email || email.orders === 0) {
    out.push({
      category: 'email',
      priority: 'low',
      title: '이메일 채널 매출 기여 부재 — 구독자 대상 캠페인 가동',
      rationale: '이번 주 이메일 귀속 주문 0건. 보유 구독자 대비 매출 전환 미흡.',
      action: '신규/시즌 프로모를 구독자 세그먼트에 발송하고 utm_medium=email로 귀속 측정.',
    })
  }

  // 6) 안전망: 제안이 없으면(데이터 부족/안정) 측정 토대 강화 제안.
  if (out.length === 0) {
    out.push({
      category: 'data',
      priority: 'low',
      title: '측정 토대 강화 — 표본/귀속 커버리지 확보 우선',
      rationale: '유의미한 추세/격차를 뽑을 표본 또는 채널 귀속 데이터가 충분치 않음.',
      action: '체크아웃 UTM 캡처 커버리지·광고비 적재 상태 점검 후 차주 재평가.',
    })
  }

  return out
}

// ── 마크다운 요약(코멘트/이메일용) ───────────────────────────
export function buildSummaryMd(review: Omit<WeeklyReview, 'summaryMd'>): string {
  const { current, deltas, suggestions, dataGaps } = review
  const k = current.kpi
  const lines: string[] = []
  const ds = current.since.slice(0, 10)
  const de = current.until.slice(0, 10)
  lines.push(`# 주간 마케팅 리뷰 (${ds} ~ ${de})`)
  lines.push('')
  lines.push('## 핵심 지표 (전주 대비)')
  lines.push(`- 매출: ${usd(k.revenue_usd)} (${signed(deltas?.revenue_usd ?? null)})`)
  lines.push(`- 주문: ${k.orders}건 (${signed(deltas?.orders ?? null)})`)
  lines.push(`- AOV: ${usd(k.aov_usd)} (${signed(deltas?.aov_usd ?? null)})`)
  lines.push(`- 광고비: ${usd(k.ad_spend_usd)} (${signed(deltas?.ad_spend_usd ?? null)})`)
  lines.push(
    `- Blended ROAS: ${k.blended_roas ?? '데이터 부족'} (${signed(deltas?.blended_roas ?? null)})`,
  )
  lines.push(
    `- 유료 클릭 CVR: ${k.paid_cvr_pct === null ? '데이터 부족' : `${k.paid_cvr_pct}%`} (${signed(
      deltas?.paid_cvr_pct ?? null,
    )})`,
  )
  lines.push(`- 채널 귀속 주문: ${k.attributed_orders}/${k.orders}건`)
  lines.push('')

  lines.push('## 채널별 성과')
  if (current.channels.length === 0) {
    lines.push('- 집계된 주문 없음.')
  } else {
    for (const c of current.channels) {
      lines.push(
        `- ${c.label}: 매출 ${usd(c.revenue_usd)} · 주문 ${c.orders} · ROAS ${
          c.roas ?? 'N/A'
        } · CPA ${c.cpa_usd === null ? 'N/A' : usd(c.cpa_usd)}`,
      )
    }
  }
  lines.push('')

  lines.push('## 실행 가능한 개선 제안')
  const order = { high: 0, medium: 1, low: 2 } as const
  const sorted = [...suggestions].sort((a, b) => order[a.priority] - order[b.priority])
  sorted.forEach((s, i) => {
    lines.push(`${i + 1}. [${s.priority.toUpperCase()}/${s.category}] **${s.title}**`)
    lines.push(`   - 근거: ${s.rationale}`)
    lines.push(`   - 실행: ${s.action}`)
  })
  lines.push('')

  lines.push('## 데이터 부족 (산출 불가 — 언블록 필요)')
  for (const g of dataGaps) {
    lines.push(`- **${g.metric}**: ${g.reason} → ${g.unblock}`)
  }
  lines.push('')
  lines.push('> 북극성 축3 「마케팅 성과측정 및 평가와 개선」 루프 · 자동 생성 리포트')

  return lines.join('\n')
}

// 전체 리뷰 조립(순수). service가 current/previous 윈도우를 넘기면 나머지 계산.
export function assembleReview(
  current: PerformanceWindow,
  previous: PerformanceWindow | null,
): WeeklyReview {
  const deltas = previous
    ? {
        revenue_usd: delta(current.kpi.revenue_usd, previous.kpi.revenue_usd),
        orders: delta(current.kpi.orders, previous.kpi.orders),
        aov_usd: delta(current.kpi.aov_usd, previous.kpi.aov_usd),
        ad_spend_usd: delta(current.kpi.ad_spend_usd, previous.kpi.ad_spend_usd),
        blended_roas: deltaNullable(current.kpi.blended_roas, previous.kpi.blended_roas),
        paid_cvr_pct: deltaNullable(current.kpi.paid_cvr_pct, previous.kpi.paid_cvr_pct),
      }
    : null
  const suggestions = generateSuggestions(current, previous)
  const partial = {
    periodStart: current.since,
    periodEnd: current.until,
    current,
    previous,
    deltas,
    suggestions,
    dataGaps: STANDING_DATA_GAPS,
  }
  return { ...partial, summaryMd: buildSummaryMd(partial) }
}

// service가 호출: 금주/전주 윈도우 → 리뷰 + 영속화용 행 형태.
export function buildReviewFromWindows(
  current: PerformanceWindow,
  previous: PerformanceWindow,
): WeeklyReview {
  // 전주에 데이터가 전혀 없으면 비교 대상에서 제외(추세 왜곡 방지).
  const hasPrev =
    previous.kpi.orders > 0 || previous.kpi.revenue_usd > 0 || previous.kpi.ad_spend_usd > 0
  return assembleReview(current, hasPrev ? previous : null)
}
