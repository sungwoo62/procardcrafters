import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { buildUnsubscribeToken, buildReviewUnsubscribeToken } from '@/lib/marketing-email'

function verifyCampaignToken(email: string, campaignId: string, token: string): boolean {
  try {
    return buildUnsubscribeToken(email, campaignId) === token
  } catch {
    return false
  }
}

function verifyReviewToken(email: string, token: string): boolean {
  try {
    return buildReviewUnsubscribeToken(email) === token
  } catch {
    return false
  }
}

async function doUnsubscribe(
  email: string,
  source: string,
  campaignId: string | null
): Promise<void> {
  const supabase = createServerClient()
  await supabase.from('print_email_unsubscribes').upsert(
    {
      email,
      campaign_id: campaignId,
      source,
      unsubscribed_at: new Date().toISOString(),
    },
    { onConflict: 'email' }
  )
}

// RFC 8058 one-click unsubscribe (mail client POST)
export async function POST(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams
  const email = params.get('email')
  const token = params.get('token')
  const emailType = params.get('email_type')
  const campaignId = params.get('campaign_id')

  if (!email || !token) {
    return new NextResponse('파라미터 누락', { status: 400 })
  }

  if (emailType === 'review_request') {
    if (!verifyReviewToken(email, token)) {
      return new NextResponse('유효하지 않은 토큰', { status: 403 })
    }
    await doUnsubscribe(email, 'one_click', null)
    return new NextResponse('Unsubscribed', { status: 200 })
  }

  if (!campaignId) {
    return new NextResponse('파라미터 누락', { status: 400 })
  }
  if (!verifyCampaignToken(email, campaignId, token)) {
    return new NextResponse('유효하지 않은 토큰', { status: 403 })
  }

  await doUnsubscribe(email, 'one_click', campaignId)
  return new NextResponse('Unsubscribed', { status: 200 })
}

// 링크 클릭 수신 거부 — HTML 확인 페이지 반환
export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams
  const email = params.get('email')
  const token = params.get('token')
  const emailType = params.get('email_type')
  const campaignId = params.get('campaign_id')

  if (!email || !token) {
    return new NextResponse('유효하지 않은 수신 거부 링크입니다.', { status: 403 })
  }

  let valid = false
  let upsertCampaignId: string | null = null

  if (emailType === 'review_request') {
    valid = verifyReviewToken(email, token)
  } else if (campaignId) {
    valid = verifyCampaignToken(email, campaignId, token)
    upsertCampaignId = campaignId
  }

  if (!valid) {
    return new NextResponse('유효하지 않은 수신 거부 링크입니다.', { status: 403 })
  }

  await doUnsubscribe(email, 'link', upsertCampaignId)

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Unsubscribed</title>
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 480px;
           margin: 80px auto; padding: 0 24px; text-align: center; color: #333; }
    h1 { font-size: 22px; margin-bottom: 12px; }
    p  { color: #666; line-height: 1.6; font-size: 15px; }
  </style>
</head>
<body>
  <h1>You've been unsubscribed</h1>
  <p>
    We've removed <strong>${email}</strong> from our promotional email list.<br>
    You'll still receive order confirmations and shipping updates.
  </p>
</body>
</html>`

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
