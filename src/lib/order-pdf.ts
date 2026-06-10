// 주문 인보이스 PDF 생성 (OMO-2841)
// 고객 주문 회신메일(주문 접수/확정)에 첨부되는 영문 인보이스. pdf-lib + 내장 Helvetica
// 폰트만 사용하므로 외부 폰트 파일·바이너리 의존성이 없고 Vercel serverless 에서 안전하게 동작한다.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export interface OrderInvoiceLineItem {
  description: string
  quantity: number
  unitPriceUsd: number
  subtotalUsd: number
}

export interface OrderInvoiceData {
  orderNumber: string
  customerName: string
  customerEmail?: string | null
  totalUsd: number
  subtotalUsd?: number | null
  shippingUsd?: number | null
  issuedAt?: string | null
  lineItems?: OrderInvoiceLineItem[]
}

const BRAND = rgb(37 / 255, 99 / 255, 235 / 255) // #2563eb
const INK = rgb(0.1, 0.1, 0.1)
const MUTED = rgb(0.45, 0.45, 0.45)
const LINE = rgb(0.9, 0.9, 0.9)

function usd(n: number): string {
  return `$${(Number.isFinite(n) ? n : 0).toFixed(2)}`
}

/** 영문 주문 인보이스 PDF 1페이지(A4)를 생성해 바이트로 반환한다. */
export async function generateOrderInvoicePdf(data: OrderInvoiceData): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  const page = doc.addPage([595.28, 841.89]) // A4
  const { width, height } = page.getSize()
  const margin = 50
  const right = width - margin
  let y = height - margin

  const text = (
    s: string,
    x: number,
    yy: number,
    opts?: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; align?: 'left' | 'right' }
  ) => {
    const size = opts?.size ?? 10
    const f = opts?.bold ? fontBold : font
    const w = f.widthOfTextAtSize(s, size)
    const drawX = opts?.align === 'right' ? x - w : x
    page.drawText(s, { x: drawX, y: yy, size, font: f, color: opts?.color ?? INK })
  }

  // 헤더
  text('Procardcrafters', margin, y, { size: 22, bold: true, color: BRAND })
  text('INVOICE', right, y, { size: 22, bold: true, color: INK, align: 'right' })
  y -= 18
  text('Premium Print Services · procardcrafters.com', margin, y, { size: 9, color: MUTED })
  y -= 30

  // 메타 정보
  const issued = data.issuedAt ? new Date(data.issuedAt) : null
  const issuedLabel = issued && !Number.isNaN(issued.getTime())
    ? issued.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—'
  text(`Order #: ${data.orderNumber}`, margin, y, { size: 10, bold: true })
  text(`Date: ${issuedLabel}`, right, y, { size: 10, align: 'right' })
  y -= 16
  text('Bill To:', margin, y, { size: 10, color: MUTED })
  y -= 14
  text(data.customerName || 'Customer', margin, y, { size: 11, bold: true })
  y -= 14
  if (data.customerEmail) {
    text(data.customerEmail, margin, y, { size: 9, color: MUTED })
    y -= 14
  }
  y -= 12

  // 라인아이템 테이블 헤더
  const colDesc = margin
  const colQty = width - margin - 200
  const colUnit = width - margin - 110
  const colSub = right
  page.drawRectangle({ x: margin, y: y - 4, width: width - margin * 2, height: 20, color: rgb(0.96, 0.97, 1) })
  text('Description', colDesc + 4, y, { size: 9, bold: true })
  text('Qty', colQty, y, { size: 9, bold: true, align: 'right' })
  text('Unit', colUnit, y, { size: 9, bold: true, align: 'right' })
  text('Amount', colSub - 4, y, { size: 9, bold: true, align: 'right' })
  y -= 22

  const items: OrderInvoiceLineItem[] = data.lineItems && data.lineItems.length > 0
    ? data.lineItems
    : [
        {
          description: 'Print order',
          quantity: 1,
          unitPriceUsd: data.subtotalUsd ?? data.totalUsd,
          subtotalUsd: data.subtotalUsd ?? data.totalUsd,
        },
      ]

  for (const it of items) {
    const desc = it.description.length > 58 ? `${it.description.slice(0, 57)}…` : it.description
    text(desc, colDesc + 4, y, { size: 9 })
    text(String(it.quantity), colQty, y, { size: 9, align: 'right' })
    text(usd(it.unitPriceUsd), colUnit, y, { size: 9, align: 'right' })
    text(usd(it.subtotalUsd), colSub - 4, y, { size: 9, align: 'right' })
    y -= 16
    page.drawLine({ start: { x: margin, y: y + 6 }, end: { x: right, y: y + 6 }, thickness: 0.5, color: LINE })
  }

  y -= 10
  const labelX = right - 90
  if (typeof data.subtotalUsd === 'number') {
    text('Subtotal', labelX, y, { size: 9, color: MUTED, align: 'right' })
    text(usd(data.subtotalUsd), right - 4, y, { size: 9, align: 'right' })
    y -= 15
  }
  if (typeof data.shippingUsd === 'number') {
    text('Shipping', labelX, y, { size: 9, color: MUTED, align: 'right' })
    text(usd(data.shippingUsd), right - 4, y, { size: 9, align: 'right' })
    y -= 15
  }
  y -= 4
  page.drawLine({ start: { x: labelX - 40, y: y + 8 }, end: { x: right, y: y + 8 }, thickness: 1, color: INK })
  text('Total (USD)', labelX, y - 6, { size: 11, bold: true, align: 'right' })
  text(usd(data.totalUsd), right - 4, y - 6, { size: 11, bold: true, color: BRAND, align: 'right' })

  // 푸터
  text(
    'Thank you for your order. Questions? Reply to this email or contact orders@procardcrafters.com.',
    margin,
    margin + 10,
    { size: 8, color: MUTED }
  )

  return doc.save()
}
