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
