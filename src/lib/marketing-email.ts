import { Resend } from 'resend'
import { createHmac } from 'crypto'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const MARKETING_FROM = `Procardcrafters <${process.env.MARKETING_FROM_EMAIL ?? 'marketing@mail.omoongmoo.com'}>`
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://procardcrafters.com'
// CAN-SPAM: 발신 회사 실주소 필수
const COMPANY_ADDRESS = process.env.COMPANY_MAILING_ADDRESS ?? '10880 Wilshire Blvd, Los Angeles, CA 90024'

const REVIEW_REQUEST_SCOPE = 'review_request'

function hmacSecret(): string {
  if (!process.env.UNSUBSCRIBE_SECRET) {
    throw new Error('UNSUBSCRIBE_SECRET 환경변수 미설정')
  }
  return process.env.UNSUBSCRIBE_SECRET
}

export function buildUnsubscribeToken(email: string, campaignId: string): string {
  return createHmac('sha256', hmacSecret())
    .update(`${email}:${campaignId}`)
    .digest('hex')
    .slice(0, 32)
}

export function buildUnsubscribeUrl(email: string, campaignId: string): string {
  const token = buildUnsubscribeToken(email, campaignId)
  const params = new URLSearchParams({ email, campaign_id: campaignId, token })
  return `${SITE_URL}/api/unsubscribe?${params.toString()}`
}

export function buildReviewUnsubscribeToken(email: string): string {
  return createHmac('sha256', hmacSecret())
    .update(`${email}:${REVIEW_REQUEST_SCOPE}`)
    .digest('hex')
    .slice(0, 32)
}

export function buildReviewUnsubscribeUrl(email: string): string {
  const token = buildReviewUnsubscribeToken(email)
  const params = new URLSearchParams({ email, email_type: REVIEW_REQUEST_SCOPE, token })
  return `${SITE_URL}/api/unsubscribe?${params.toString()}`
}

export interface CampaignAnnouncementData {
  customerEmail: string
  customerName: string
  campaignId: string
  seasonName: string
  headlineEn: string
  discountPct: number
  promoCode: string
  cutoffAt: Date | null
  heroImageUrl: string | null
  shopUrl: string
}

export async function sendCampaignAnnouncementEmail(
  data: CampaignAnnouncementData
): Promise<{ messageId: string | null }> {
  if (!resend) return { messageId: null }

  const {
    customerEmail, customerName, campaignId, seasonName,
    headlineEn, discountPct, promoCode, cutoffAt, heroImageUrl, shopUrl,
  } = data

  const firstName = customerName.split(' ')[0]
  const unsubUrl = buildUnsubscribeUrl(customerEmail, campaignId)
  const subject = `${firstName}, your ${seasonName} discount is live`

  const cutoffLine = cutoffAt
    ? `<p style="margin:6px 0 0;font-size:13px;color:#92400e">
        Order by ${cutoffAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} to receive your discount.
       </p>`
    : ''

  const heroBlock = heroImageUrl
    ? `<tr><td>
        <img src="${heroImageUrl}" alt="${seasonName}" width="600"
          style="width:100%;max-height:280px;object-fit:cover;display:block" />
       </td></tr>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0">
<tr><td>
<table width="600" align="center" cellpadding="0" cellspacing="0"
  style="background:#ffffff;border-radius:10px;overflow:hidden;max-width:600px;margin:0 auto;box-shadow:0 2px 8px rgba(0,0,0,0.08)">

  ${heroBlock}

  <!-- Headline -->
  <tr><td style="padding:36px 48px 20px">
    <h1 style="margin:0 0 10px;font-size:26px;font-weight:800;color:#111;line-height:1.25">
      ${headlineEn}
    </h1>
    <p style="margin:0;font-size:16px;color:#555;line-height:1.5">
      Hi ${firstName} — your <strong>${seasonName}</strong> deal is officially live.
      Use the code below at checkout.
    </p>
  </td></tr>

  <!-- Promo code block -->
  <tr><td style="padding:4px 48px 20px">
    <div style="background:#fef9ec;border:2px solid #f59e0b;border-radius:10px;padding:28px 24px;text-align:center">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#92400e;letter-spacing:1.5px;text-transform:uppercase">
        Your discount code
      </p>
      <p style="margin:0 0 10px;font-size:34px;font-weight:900;letter-spacing:5px;color:#b45309;font-family:monospace">
        ${promoCode}
      </p>
      <p style="margin:0;font-size:20px;font-weight:700;color:#111">
        ${discountPct}% off your entire order
      </p>
      ${cutoffLine}
    </div>
  </td></tr>

  <!-- CTA -->
  <tr><td style="padding:20px 48px 40px;text-align:center">
    <a href="${shopUrl}"
      style="display:inline-block;padding:15px 48px;background:#111111;color:#ffffff;text-decoration:none;border-radius:6px;font-size:16px;font-weight:700;letter-spacing:0.5px">
      Shop Now →
    </a>
  </td></tr>

  <!-- CAN-SPAM compliant footer -->
  <tr><td style="background:#f9f9f9;border-top:1px solid #eeeeee;padding:20px 48px">
    <p style="margin:0 0 6px;font-size:11px;color:#aaaaaa;line-height:1.6">
      You're receiving this email because you placed an order with Procardcrafters.<br>
      ${COMPANY_ADDRESS}
    </p>
    <p style="margin:0;font-size:11px;color:#aaaaaa">
      <a href="${unsubUrl}" style="color:#aaaaaa;text-decoration:underline">Unsubscribe</a>
      from promotional emails.
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`

  const { data: sent, error } = await resend.emails.send({
    from: MARKETING_FROM,
    to: customerEmail,
    subject,
    html,
    headers: {
      // RFC 8058 one-click unsubscribe
      'List-Unsubscribe': `<${unsubUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  })

  if (error) throw new Error(`Resend 오류: ${error.message}`)
  return { messageId: sent?.id ?? null }
}

export interface ReviewRequestEmailData {
  customerEmail: string
  customerName: string
  orderNumber: string
  emailType: 'd7' | 'd14'
}

export async function sendReviewRequestEmail(
  data: ReviewRequestEmailData
): Promise<{ messageId: string | null }> {
  if (!resend) return { messageId: null }

  const { customerEmail, customerName, orderNumber, emailType } = data
  const firstName = customerName.split(' ')[0]
  const unsubUrl = buildReviewUnsubscribeUrl(customerEmail)
  const reviewUrl = `${SITE_URL}/orders/${encodeURIComponent(orderNumber)}#write-review`

  const isReminder = emailType === 'd14'
  const subject = isReminder
    ? `${firstName}, still time to review your order — get $2 off`
    : `${firstName}, how was your order? Leave a review & get $2 off`

  const headlineText = isReminder
    ? `Just a quick reminder — your review earns you $2 off`
    : `Share your experience and we'll thank you with $2 off`

  const bodyText = isReminder
    ? `You haven't left a review for order <strong>#${orderNumber}</strong> yet — no worries, there's still time. It only takes a minute, and we'd love to hear what you think.`
    : `Your order <strong>#${orderNumber}</strong> has been delivered. We hope everything looks great! Would you mind taking a moment to leave a quick review?`

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0">
<tr><td>
<table width="600" align="center" cellpadding="0" cellspacing="0"
  style="background:#ffffff;border-radius:10px;overflow:hidden;max-width:600px;margin:0 auto;box-shadow:0 2px 8px rgba(0,0,0,0.08)">

  <!-- Header bar -->
  <tr><td style="background:#111111;padding:20px 48px">
    <p style="margin:0;color:#ffffff;font-size:18px;font-weight:800;letter-spacing:-0.3px">Procardcrafters</p>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:40px 48px 28px">
    <h1 style="margin:0 0 14px;font-size:24px;font-weight:800;color:#111;line-height:1.3">
      ${headlineText}
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.6">
      Hi ${firstName} — ${bodyText}
    </p>
  </td></tr>

  <!-- Coupon incentive block -->
  <tr><td style="padding:0 48px 28px">
    <div style="background:#f0fdf4;border:2px solid #22c55e;border-radius:10px;padding:24px;text-align:center">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#166534;letter-spacing:1px;text-transform:uppercase">Review reward</p>
      <p style="margin:0 0 6px;font-size:32px;font-weight:900;color:#15803d">$2 OFF</p>
      <p style="margin:0;font-size:13px;color:#166534">your next order of $30 or more · valid 30 days after review</p>
      <p style="margin:8px 0 0;font-size:11px;color:#4ade80">★ Any star rating is welcome — coupon applies regardless</p>
    </div>
  </td></tr>

  <!-- CTA -->
  <tr><td style="padding:0 48px 40px;text-align:center">
    <a href="${reviewUrl}"
      style="display:inline-block;padding:15px 48px;background:#111111;color:#ffffff;text-decoration:none;border-radius:6px;font-size:16px;font-weight:700;letter-spacing:0.5px">
      Write a Review →
    </a>
  </td></tr>

  <!-- CAN-SPAM footer -->
  <tr><td style="background:#f9f9f9;border-top:1px solid #eeeeee;padding:20px 48px">
    <p style="margin:0 0 6px;font-size:11px;color:#aaa;line-height:1.6">
      You're receiving this email because you placed order #${orderNumber} with Procardcrafters.<br>
      ${COMPANY_ADDRESS}<br>
      <em>Coupon is provided as a thank-you for submitting an honest review (FTC disclosure).</em>
    </p>
    <p style="margin:0;font-size:11px;color:#aaa">
      <a href="${unsubUrl}" style="color:#aaa;text-decoration:underline">Unsubscribe</a>
      from review reminder emails.
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`

  const { data: sent, error } = await resend.emails.send({
    from: MARKETING_FROM,
    to: customerEmail,
    subject,
    html,
    headers: {
      'List-Unsubscribe': `<${unsubUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  })

  if (error) throw new Error(`Resend 오류: ${error.message}`)
  return { messageId: sent?.id ?? null }
}
