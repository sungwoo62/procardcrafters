import { Resend } from 'resend'
import { OrderStatus } from '@/types/database'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM = 'Procardcrafters <orders@procardcrafters.com>'

interface OrderEmailData {
  orderNumber: string
  customerEmail: string
  customerName: string
  totalUsd: number
  trackingNumber?: string
}

const STATUS_SUBJECTS: Partial<Record<OrderStatus, string>> = {
  paid: 'Order Confirmed',
  shipped: 'Your Order Has Shipped',
  delivered: 'Your Order Has Been Delivered',
}

function buildEmailHtml(status: OrderStatus, data: OrderEmailData): string {
  const { orderNumber, customerName, totalUsd, trackingNumber } = data

  if (status === 'paid') {
    return `
      <p>Hi ${customerName},</p>
      <p>Thank you for your order! We've received your payment and will begin processing your print job shortly.</p>
      <p><strong>Order #:</strong> ${orderNumber}<br/>
      <strong>Total:</strong> $${totalUsd.toFixed(2)} USD</p>
      <p>You'll receive another email when your order ships.</p>
      <p>— Procardcrafters Team</p>
    `
  }

  if (status === 'shipped') {
    return `
      <p>Hi ${customerName},</p>
      <p>Great news — your order <strong>#${orderNumber}</strong> has shipped!</p>
      ${trackingNumber ? `<p><strong>Tracking #:</strong> ${trackingNumber}</p>` : ''}
      <p>Estimated delivery: 7-14 business days depending on your location.</p>
      <p>— Procardcrafters Team</p>
    `
  }

  if (status === 'delivered') {
    return `
      <p>Hi ${customerName},</p>
      <p>Your order <strong>#${orderNumber}</strong> has been delivered. We hope you love your prints!</p>
      <p>If you have any questions, reply to this email.</p>
      <p>— Procardcrafters Team</p>
    `
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
