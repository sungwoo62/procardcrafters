import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { sendCampaignAnnouncementEmail } from '@/lib/marketing-email'

// 빈도 캡 상수
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
const MARKETING_CAP_PER_30D = 4

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://procardcrafters.com'

// Vercel 함수 최대 실행 시간 (60초) — 대량 발송 시 Vercel Queue로 대체 고려
export const maxDuration = 60

type PromoCodeRow = { code: string; discount_pct: number; status: string }
type CalendarRow = { key: string; name_en: string }
type CampaignRow = {
  id: string
  status: string
  headline_en: string | null
  hero_image_url: string | null
  order_cutoff_at: string | null
  print_promotion_calendar: CalendarRow
  print_promo_codes: PromoCodeRow[]
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // cron 내부 호출 전용 — CRON_SECRET 인증
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { campaign_id } = body as { campaign_id?: string }
  if (!campaign_id) {
    return NextResponse.json({ error: 'campaign_id 필수' }, { status: 400 })
  }

  const supabase = createServerClient()
  const now = new Date()

  // ─── 1. 캠페인 + 캘린더 + 프로모 코드 조회 ───────────────────────
  const { data: campaign, error: campErr } = await supabase
    .from('print_promotion_campaigns')
    .select(`
      id, status, headline_en, hero_image_url, order_cutoff_at,
      print_promotion_calendar!inner(key, name_en),
      print_promo_codes(code, discount_pct, status)
    `)
    .eq('id', campaign_id)
    .single<CampaignRow>()

  if (campErr || !campaign) {
    return NextResponse.json({ error: campErr?.message ?? '캠페인 없음' }, { status: 404 })
  }
  if (campaign.status !== 'live') {
    return NextResponse.json(
      { error: '캠페인이 live 상태가 아님', status: campaign.status },
      { status: 422 }
    )
  }

  const calendar = campaign.print_promotion_calendar
  const promoCode = campaign.print_promo_codes?.find((c) => c.status === 'active')
  if (!promoCode) {
    return NextResponse.json({ error: '활성 프로모 코드 없음' }, { status: 422 })
  }

  // ─── 2. 90일 이내 주문자 집계 ────────────────────────────────────
  const since90d = new Date(now.getTime() - NINETY_DAYS_MS).toISOString()
  const { data: orders, error: orderErr } = await supabase
    .from('print_orders')
    .select('customer_email, customer_name, created_at')
    .gte('created_at', since90d)
    .not('customer_email', 'is', null)
    .in('status', ['paid', 'processing', 'shipped', 'delivered'])
    .order('created_at', { ascending: false })

  if (orderErr) {
    return NextResponse.json({ error: orderErr.message }, { status: 500 })
  }

  // 이메일별 가장 최근 이름 보존
  const emailMap = new Map<string, string>()
  for (const o of orders ?? []) {
    if (o.customer_email && !emailMap.has(o.customer_email)) {
      emailMap.set(o.customer_email, o.customer_name ?? 'Customer')
    }
  }

  if (emailMap.size === 0) {
    return NextResponse.json({ ok: true, sent: 0, skipped: 0, reason: '수신자 없음' })
  }

  // ─── 3. 수신 거부 목록 로드 ──────────────────────────────────────
  const allEmails = Array.from(emailMap.keys())
  const { data: unsubscribes } = await supabase
    .from('print_email_unsubscribes')
    .select('email')
    .in('email', allEmails)
  const unsubSet = new Set((unsubscribes ?? []).map((u: { email: string }) => u.email))

  // ─── 4. 빈도 캡 데이터 로드 ──────────────────────────────────────
  const since30d = new Date(now.getTime() - THIRTY_DAYS_MS).toISOString()
  const since7d = new Date(now.getTime() - SEVEN_DAYS_MS).toISOString()

  const { data: recentLogs } = await supabase
    .from('print_marketing_email_log')
    .select('email, campaign_id, sent_at')
    .in('email', allEmails)
    .gte('sent_at', since30d)

  // 30일 발송 카운트 + 7일 내 같은 캠페인 발송 여부
  const count30d = new Map<string, number>()
  const campaignSent7d = new Map<string, Set<string>>() // email → Set<campaign_id>

  for (const log of recentLogs ?? []) {
    count30d.set(log.email, (count30d.get(log.email) ?? 0) + 1)
    if (log.sent_at >= since7d) {
      if (!campaignSent7d.has(log.email)) campaignSent7d.set(log.email, new Set())
      campaignSent7d.get(log.email)!.add(log.campaign_id)
    }
  }

  // ─── 5. 이메일 발송 루프 ─────────────────────────────────────────
  let sent = 0
  let skipped = 0
  const skipReasons: Record<string, number> = {}
  const logRows: {
    email: string
    campaign_id: string
    email_type: string
    subject: string
    resend_message_id: string | null
  }[] = []

  const seasonName = calendar.name_en
  const headlineEn = campaign.headline_en ?? `${seasonName} Sale Is Live`
  const cutoffAt = campaign.order_cutoff_at ? new Date(campaign.order_cutoff_at) : null
  const shopUrl = `${SITE_URL}?promo=${encodeURIComponent(promoCode.code)}`

  for (const [email, name] of emailMap) {
    // 수신 거부 확인
    if (unsubSet.has(email)) {
      skipped++
      skipReasons.unsubscribed = (skipReasons.unsubscribed ?? 0) + 1
      continue
    }
    // 같은 캠페인 7일 내 중복 발송 방지
    if (campaignSent7d.get(email)?.has(campaign_id)) {
      skipped++
      skipReasons.campaign_dedup = (skipReasons.campaign_dedup ?? 0) + 1
      continue
    }
    // 30일 마케팅 이메일 4회 cap
    if ((count30d.get(email) ?? 0) >= MARKETING_CAP_PER_30D) {
      skipped++
      skipReasons.frequency_cap = (skipReasons.frequency_cap ?? 0) + 1
      continue
    }

    try {
      const { messageId } = await sendCampaignAnnouncementEmail({
        customerEmail: email,
        customerName: name,
        campaignId: campaign_id,
        seasonName,
        headlineEn,
        discountPct: promoCode.discount_pct,
        promoCode: promoCode.code,
        cutoffAt,
        heroImageUrl: campaign.hero_image_url ?? null,
        shopUrl,
      })

      const subject = `${name.split(' ')[0]}, your ${seasonName} discount is live`
      logRows.push({ email, campaign_id, email_type: 'campaign_announcement', subject, resend_message_id: messageId })
      sent++

      // 인-메모리 카운터 갱신 — 동일 배치 내 이중 발송 방지
      count30d.set(email, (count30d.get(email) ?? 0) + 1)
    } catch (err) {
      skipped++
      skipReasons.send_error = (skipReasons.send_error ?? 0) + 1
      console.error(`발송 실패 ${email}:`, err)
    }
  }

  // ─── 6. 발송 로그 일괄 저장 ──────────────────────────────────────
  if (logRows.length > 0) {
    await supabase.from('print_marketing_email_log').insert(logRows)
  }

  return NextResponse.json({
    ok: true,
    campaign_id,
    season: seasonName,
    sent,
    skipped,
    skipReasons,
  })
}
