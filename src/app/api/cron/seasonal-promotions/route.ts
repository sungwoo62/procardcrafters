import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// Vercel Cron: 매일 KST 00:30 (UTC 15:30) 실행
export const maxDuration = 30

const NINE_WEEKS_MS = 9 * 7 * 24 * 60 * 60 * 1000

const TIER_DEFAULT_PCT: Record<string, number> = {
  top: 15,
  standard: 10,
  always_on: 5,
  bestseller: 10,
}

type CalendarRow = {
  id: string
  key: string
  recurring_pattern: string
  default_lead_days: number
  default_peak_days: number
  default_cutoff_days: number
  default_discount_tier: string
  applicable_product_groups: string[]
  peak_anchor_month: number
  peak_anchor_day: number
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

function peakAnchorDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
}

async function runSeasonalPromotions(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerClient()
  const now = new Date()
  const cutoff = new Date(now.getTime() + NINE_WEEKS_MS)

  // KST(UTC+9) 기준 현재 연도
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const currentYear = kstNow.getUTCFullYear()

  const { data: calendars, error: calErr } = await supabase
    .from('print_promotion_calendar')
    .select('*')
    .eq('is_active', true)

  if (calErr) {
    return NextResponse.json({ error: calErr.message }, { status: 500 })
  }

  // 현재 연도 + 내년 기존 캠페인 조회
  const { data: existing, error: exErr } = await supabase
    .from('print_promotion_campaigns')
    .select('calendar_id, year')
    .in('year', [currentYear, currentYear + 1])
    .not('status', 'eq', 'cancelled')

  if (exErr) {
    return NextResponse.json({ error: exErr.message }, { status: 500 })
  }

  const existingSet = new Set(
    (existing ?? []).map((c: { calendar_id: string; year: number }) => `${c.calendar_id}:${c.year}`)
  )

  const created: string[] = []
  const errors: string[] = []

  // ─── Step 1: draft 캠페인 자동 생성 ───────────────────────────
  for (const cal of (calendars ?? []) as CalendarRow[]) {
    try {
      if (cal.recurring_pattern === 'ONE_TIME') continue

      if (cal.recurring_pattern === 'ALWAYS_ON') {
        if (!existingSet.has(`${cal.id}:${currentYear}`)) {
          await createDraftCampaign(supabase, cal, currentYear, now)
          created.push(`${cal.key}:${currentYear}`)
        }
        continue
      }

      // EVERY_YEAR: 당해 연도 + 내년 모두 확인
      for (const year of [currentYear, currentYear + 1]) {
        if (existingSet.has(`${cal.id}:${year}`)) continue
        if (!cal.peak_anchor_month || !cal.peak_anchor_day) continue

        const peakStart = peakAnchorDate(year, cal.peak_anchor_month, cal.peak_anchor_day)
        const promoStart = addDays(peakStart, -cal.default_lead_days)
        const promoEnd = addDays(peakStart, cal.default_peak_days)

        // 프로모션 기간이 아직 종료되지 않았고 9주 이내에 시작
        if (promoEnd > now && promoStart <= cutoff) {
          await createDraftCampaign(supabase, cal, year, now)
          created.push(`${cal.key}:${year}`)
        }
      }
    } catch (err) {
      errors.push(`${cal.key}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // ─── Step 2: scheduled → live ─────────────────────────────────
  const { data: toActivate } = await supabase
    .from('print_promotion_campaigns')
    .select('id')
    .eq('status', 'scheduled')
    .lte('promo_start_at', now.toISOString())

  const activatedIds = (toActivate ?? []).map((c: { id: string }) => c.id)
  if (activatedIds.length > 0) {
    await supabase
      .from('print_promotion_campaigns')
      .update({ status: 'live' })
      .in('id', activatedIds)

    // 새로 live 전환된 캠페인마다 announcement 이메일 잡 비동기 호출
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://procardcrafters.com'
    await Promise.allSettled(
      activatedIds.map((id) =>
        fetch(`${baseUrl}/api/jobs/promotion-announcement`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.CRON_SECRET}`,
          },
          body: JSON.stringify({ campaign_id: id }),
        }).catch((err) => {
          console.error(`promotion-announcement 잡 호출 실패 (campaign ${id}):`, err)
        })
      )
    )
  }

  // ─── Step 3: live → ended ──────────────────────────────────────
  const { data: toEnd } = await supabase
    .from('print_promotion_campaigns')
    .select('id')
    .eq('status', 'live')
    .lt('promo_end_at', now.toISOString())

  const endedIds = (toEnd ?? []).map((c: { id: string }) => c.id)
  if (endedIds.length > 0) {
    await supabase
      .from('print_promotion_campaigns')
      .update({ status: 'ended' })
      .in('id', endedIds)
  }

  return NextResponse.json({
    ok: true,
    created,
    activated: activatedIds.length,
    ended: endedIds.length,
    ...(errors.length > 0 && { errors }),
  })
}

async function createDraftCampaign(
  supabase: ReturnType<typeof createServerClient>,
  cal: CalendarRow,
  year: number,
  now: Date,
) {
  let promoStartAt: Date | null = null
  let promoEndAt: Date | null = null
  let peakStartAt: Date | null = null
  let orderCutoffAt: Date | null = null

  if (cal.recurring_pattern === 'EVERY_YEAR' && cal.peak_anchor_month && cal.peak_anchor_day) {
    peakStartAt = peakAnchorDate(year, cal.peak_anchor_month, cal.peak_anchor_day)
    promoStartAt = addDays(peakStartAt, -cal.default_lead_days)
    promoEndAt = addDays(peakStartAt, cal.default_peak_days)
    if (cal.default_cutoff_days > 0) {
      orderCutoffAt = addDays(peakStartAt, cal.default_cutoff_days)
    }
  } else if (cal.recurring_pattern === 'ALWAYS_ON') {
    promoStartAt = new Date(Date.UTC(year, 0, 1))
    promoEndAt = new Date(Date.UTC(year, 11, 31))
  }

  const { data: campaign, error: campErr } = await supabase
    .from('print_promotion_campaigns')
    .insert({
      calendar_id: cal.id,
      year,
      status: 'draft',
      promo_start_at: promoStartAt?.toISOString() ?? null,
      promo_end_at: promoEndAt?.toISOString() ?? null,
      peak_start_at: peakStartAt?.toISOString() ?? null,
      order_cutoff_at: orderCutoffAt?.toISOString() ?? null,
    })
    .select('id')
    .single()

  if (campErr) throw new Error(campErr.message)

  // applicable_product_groups = product slug 목록으로 후보 상품 자동 매핑
  if (cal.applicable_product_groups.length > 0) {
    const { data: products } = await supabase
      .from('print_products')
      .select('slug')
      .in('slug', cal.applicable_product_groups)
      .eq('is_active', true)
      .limit(50)

    if (products && products.length > 0) {
      await supabase.from('print_promotion_products').insert(
        products.map((p: { slug: string }, idx: number) => ({
          campaign_id: campaign.id,
          product_slug: p.slug,
          sort_order: idx,
        }))
      )
    }
  }

  // default discount tier에 맞춰 프로모 코드 1개 자동 생성
  const rnd = String(Math.floor(Math.random() * 9000) + 1000)
  const code = `PRINTPROMO_${cal.key.toUpperCase()}_${year}_${rnd}`
  const discountPct = TIER_DEFAULT_PCT[cal.default_discount_tier] ?? 10

  await supabase.from('print_promo_codes').insert({
    campaign_id: campaign.id,
    code,
    discount_pct: discountPct,
    discount_tier: cal.default_discount_tier,
    valid_from: promoStartAt?.toISOString() ?? now.toISOString(),
    valid_until: promoEndAt?.toISOString() ?? new Date(Date.UTC(year, 11, 31)).toISOString(),
    status: 'active',
  })
}

// GET: Vercel Cron Job에서 호출
export async function GET(request: NextRequest) {
  return runSeasonalPromotions(request)
}

// POST: 수동 트리거 / 테스트용
export async function POST(request: NextRequest) {
  return runSeasonalPromotions(request)
}
