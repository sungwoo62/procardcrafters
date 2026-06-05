import { Resend } from 'resend'
import { OrderStatus } from '@/types/database'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM = 'Procardcrafters <orders@procardcrafters.com>'
const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL ?? 'admin@procardcrafters.com'
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://procardcrafters.com'

export interface OrderEmailData {
  orderNumber: string
  customerEmail: string
  customerName: string
  totalUsd: number
  trackingNumber?: string
  items?: { name: string; quantity: number; priceUsd: number }[]
}

const STATUS_SUBJECTS: Partial<Record<OrderStatus, string>> = {
  pending: 'Order Received — Awaiting Payment',
  paid: 'Order Confirmed',
  processing: 'Your Order Is Being Printed',
  shipped: 'Your Order Has Shipped',
  delivered: 'Your Order Has Been Delivered',
  cancelled: 'Order Cancelled',
  refunded: 'Order Refunded',
}

function buildItemsTable(items: OrderEmailData['items']): string {
  if (!items?.length) return ''
  const rows = items
    .map(
      (i) =>
        `<tr><td style="padding:4px 8px;border-bottom:1px solid #eee">${i.name}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:center">${i.quantity}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right">$${i.priceUsd.toFixed(2)}</td></tr>`
    )
    .join('')
  return `
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <thead><tr style="background:#f8f8f8">
        <th style="padding:6px 8px;text-align:left">Item</th>
        <th style="padding:6px 8px;text-align:center">Qty</th>
        <th style="padding:6px 8px;text-align:right">Price</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `
}

function buildEmailHtml(status: OrderStatus, data: OrderEmailData): string {
  const { orderNumber, customerName, totalUsd, trackingNumber, items } = data

  const header = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">`
  const footer = `<hr style="margin:24px 0;border:none;border-top:1px solid #e5e5e5"/><p style="color:#888;font-size:12px">Procardcrafters · Premium Print Services<br/>${SITE_URL}</p></div>`

  if (status === 'pending') {
    return `${header}
      <p>Hi ${customerName},</p>
      <p>We've received your order <strong>#${orderNumber}</strong>. Please complete your payment to begin production.</p>
      <p><strong>Total:</strong> $${totalUsd.toFixed(2)} USD</p>
      ${buildItemsTable(items)}
      <p>If you've already paid, please disregard this email — we'll confirm your payment shortly.</p>
      <p>— Procardcrafters Team</p>
    ${footer}`
  }

  if (status === 'paid') {
    return `${header}
      <p>Hi ${customerName},</p>
      <p>Thank you for your order! We've received your payment and will begin processing your print job shortly.</p>
      <p><strong>Order #:</strong> ${orderNumber}<br/>
      <strong>Total:</strong> $${totalUsd.toFixed(2)} USD</p>
      ${buildItemsTable(items)}
      <p>You'll receive another email when your order ships.</p>
      <p>— Procardcrafters Team</p>
    ${footer}`
  }

  if (status === 'processing') {
    return `${header}
      <p>Hi ${customerName},</p>
      <p>Your order <strong>#${orderNumber}</strong> is now being printed. We'll notify you as soon as it ships.</p>
      <p>Typical production time: 3-5 business days.</p>
      <p>— Procardcrafters Team</p>
    ${footer}`
  }

  if (status === 'shipped') {
    return `${header}
      <p>Hi ${customerName},</p>
      <p>Great news — your order <strong>#${orderNumber}</strong> has shipped!</p>
      ${trackingNumber ? `<p><strong>Tracking #:</strong> ${trackingNumber}</p>` : ''}
      <p>Estimated delivery: 7-14 business days depending on your location.</p>
      <p>— Procardcrafters Team</p>
    ${footer}`
  }

  if (status === 'delivered') {
    return `${header}
      <p>Hi ${customerName},</p>
      <p>Your order <strong>#${orderNumber}</strong> has been delivered. We hope you love your prints!</p>
      <p>If you have any questions, reply to this email.</p>
      <p>— Procardcrafters Team</p>
    ${footer}`
  }

  if (status === 'cancelled') {
    return `${header}
      <p>Hi ${customerName},</p>
      <p>Your order <strong>#${orderNumber}</strong> has been cancelled.</p>
      <p>If you didn't request this, please contact us at orders@procardcrafters.com.</p>
      <p>— Procardcrafters Team</p>
    ${footer}`
  }

  if (status === 'refunded') {
    return `${header}
      <p>Hi ${customerName},</p>
      <p>A refund of <strong>$${totalUsd.toFixed(2)} USD</strong> has been issued for order <strong>#${orderNumber}</strong>.</p>
      <p>Please allow 5-10 business days for the refund to appear on your statement.</p>
      <p>— Procardcrafters Team</p>
    ${footer}`
  }

  return ''
}

export async function sendOrderStatusEmail(
  status: OrderStatus,
  data: OrderEmailData
): Promise<void> {
  if (!resend) return
  const subject = STATUS_SUBJECTS[status]
  if (!subject) return

  const html = buildEmailHtml(status, data)
  if (!html) return

  await resend.emails.send({
    from: FROM,
    to: data.customerEmail,
    subject: `[Procardcrafters] ${subject} — #${data.orderNumber}`,
    html,
  })
}

export async function sendAdminNewOrderEmail(
  data: OrderEmailData & { paymentMethod?: string }
): Promise<void> {
  if (!resend) return

  const itemRows = data.items
    ?.map((i) => `<li>${i.name} × ${i.quantity} — $${i.priceUsd.toFixed(2)}</li>`)
    .join('') ?? ''

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#dc2626">New Order Received</h2>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:4px 0;font-weight:bold">Order #</td><td>${data.orderNumber}</td></tr>
        <tr><td style="padding:4px 0;font-weight:bold">Customer</td><td>${data.customerName} (${data.customerEmail})</td></tr>
        <tr><td style="padding:4px 0;font-weight:bold">Total</td><td>$${data.totalUsd.toFixed(2)} USD</td></tr>
        <tr><td style="padding:4px 0;font-weight:bold">Payment</td><td>${data.paymentMethod ?? 'Pending'}</td></tr>
      </table>
      ${itemRows ? `<h3>Items</h3><ul>${itemRows}</ul>` : ''}
      <p><a href="${SITE_URL}/admin/orders" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px">View in Admin</a></p>
    </div>
  `

  await resend.emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `[New Order] #${data.orderNumber} — $${data.totalUsd.toFixed(2)} from ${data.customerName}`,
    html,
  })
}

export async function sendAdminFraudAlertEmail(
  data: OrderEmailData & { expectedAmount: number; actualAmount: number; paymentMethod: string }
): Promise<void> {
  if (!resend) return

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#dc2626">Payment Fraud Alert — Order Cancelled</h2>
      <p>A payment amount mismatch was detected. The order has been automatically cancelled.</p>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:4px 0;font-weight:bold">Order #</td><td>${data.orderNumber}</td></tr>
        <tr><td style="padding:4px 0;font-weight:bold">Customer</td><td>${data.customerName} (${data.customerEmail})</td></tr>
        <tr><td style="padding:4px 0;font-weight:bold">Payment Method</td><td>${data.paymentMethod}</td></tr>
        <tr style="background:#fef2f2"><td style="padding:4px 0;font-weight:bold;color:#dc2626">Expected Amount</td><td style="color:#dc2626">$${data.expectedAmount.toFixed(2)} USD</td></tr>
        <tr style="background:#fef2f2"><td style="padding:4px 0;font-weight:bold;color:#dc2626">Actual Amount</td><td style="color:#dc2626">$${data.actualAmount.toFixed(2)} USD</td></tr>
      </table>
      <p><a href="${SITE_URL}/admin/orders" style="display:inline-block;padding:10px 20px;background:#dc2626;color:#fff;text-decoration:none;border-radius:6px">Review in Admin</a></p>
    </div>
  `

  await resend.emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `[FRAUD ALERT] Amount mismatch — #${data.orderNumber} (${data.paymentMethod})`,
    html,
  })
}

export interface FileRejectionEmailData {
  customerEmail: string
  customerName: string
  orderNumber: string
  filename: string
  rejectionReason: string
}

export async function sendFileRejectionEmail(data: FileRejectionEmailData): Promise<void> {
  if (!resend) return

  const reuploadUrl = `${SITE_URL}/orders/${data.orderNumber}#reupload`

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <p>Hi ${data.customerName},</p>
      <p>Unfortunately, the print file you uploaded for order <strong>#${data.orderNumber}</strong> did not pass our quality review.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:6px 0;font-weight:bold;width:140px">File</td><td>${data.filename}</td></tr>
        <tr><td style="padding:6px 0;font-weight:bold">Reason</td><td style="color:#dc2626">${data.rejectionReason}</td></tr>
      </table>
      <p><strong>How to fix this:</strong></p>
      <ol style="padding-left:20px;line-height:1.8">
        <li>Review the rejection reason above and adjust your file accordingly.</li>
        <li>Make sure your file meets our requirements: PDF/AI/PSD/PNG/JPG/TIFF, 300 DPI or higher, correct dimensions.</li>
        <li>Click the button below to re-upload your corrected file.</li>
      </ol>
      <p style="text-align:center;margin:24px 0">
        <a href="${reuploadUrl}" style="display:inline-block;padding:12px 28px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">
          Re-upload File
        </a>
      </p>
      <p>If you have any questions or need help preparing your file, reply to this email — we're happy to assist.</p>
      <p>— Procardcrafters Team</p>
      <hr style="margin:24px 0;border:none;border-top:1px solid #e5e5e5"/>
      <p style="color:#888;font-size:12px">Procardcrafters · Premium Print Services<br/>${SITE_URL}</p>
    </div>
  `

  await resend.emails.send({
    from: FROM,
    to: data.customerEmail,
    subject: `[Action Required] File Re-upload Needed — Order #${data.orderNumber}`,
    html,
  })
}

export async function sendAdminStatusChangeEmail(
  status: OrderStatus,
  data: OrderEmailData & { changedBy?: string }
): Promise<void> {
  if (!resend) return
  if (status === 'pending') return

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2>Order Status Update</h2>
      <p>Order <strong>#${data.orderNumber}</strong> → <strong>${status.toUpperCase()}</strong></p>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:4px 0;font-weight:bold">Customer</td><td>${data.customerName} (${data.customerEmail})</td></tr>
        <tr><td style="padding:4px 0;font-weight:bold">Total</td><td>$${data.totalUsd.toFixed(2)} USD</td></tr>
        ${data.trackingNumber ? `<tr><td style="padding:4px 0;font-weight:bold">Tracking</td><td>${data.trackingNumber}</td></tr>` : ''}
        ${data.changedBy ? `<tr><td style="padding:4px 0;font-weight:bold">Changed by</td><td>${data.changedBy}</td></tr>` : ''}
      </table>
      <p><a href="${SITE_URL}/admin/orders" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px">View in Admin</a></p>
    </div>
  `

  await resend.emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `[Order ${status}] #${data.orderNumber} — ${data.customerName}`,
    html,
  })
}

export interface ReviewCouponEmailData {
  reviewerEmail: string
  reviewerName: string
  couponCode: string
  amountUsd: number
  minOrderUsd: number
}

export async function sendReviewCouponEmail(data: ReviewCouponEmailData): Promise<void> {
  if (!resend) return

  const { reviewerEmail, reviewerName, couponCode, amountUsd, minOrderUsd } = data

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <p>Hi ${reviewerName},</p>
      <p>Thank you for your review! As a token of appreciation, here's a <strong>$${amountUsd.toFixed(2)} USD coupon</strong> for your next order.</p>
      <div style="background:#f0fdf4;border:2px solid #22c55e;border-radius:8px;padding:16px 24px;margin:20px 0;text-align:center">
        <p style="margin:0 0 8px;font-size:13px;color:#166534;font-weight:600">YOUR COUPON CODE</p>
        <p style="margin:0;font-size:28px;font-weight:bold;letter-spacing:4px;color:#15803d">${couponCode}</p>
        <p style="margin:8px 0 0;font-size:12px;color:#166534">Valid for 30 days · Minimum order $${minOrderUsd.toFixed(2)}</p>
      </div>
      <p style="font-size:12px;color:#666">
        <em>This coupon was provided as an incentive for your review. This fact is disclosed on the review per FTC guidelines.</em>
      </p>
      <p><a href="${SITE_URL}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px">Shop Now</a></p>
      <p>— Procardcrafters Team</p>
      <hr style="margin:24px 0;border:none;border-top:1px solid #e5e5e5"/>
      <p style="color:#888;font-size:12px">Procardcrafters · Premium Print Services<br/>${SITE_URL}</p>
    </div>
  `

  await resend.emails.send({
    from: FROM,
    to: reviewerEmail,
    subject: `[Procardcrafters] Thank you — here's your $${amountUsd.toFixed(2)} review coupon`,
    html,
  })
}

// OMO-2314: 빌드 통과용 임시 스텁 (WIP 가 실제 구현 가져올 때까지)
export async function sendDesignProofEmail(_data: {
  customerEmail: string
  customerName?: string | null
  orderNumber: string
  version: number
  adminNote?: string
}): Promise<void> {
  // 실제 구현 대기. 호출 시 no-op.
}
