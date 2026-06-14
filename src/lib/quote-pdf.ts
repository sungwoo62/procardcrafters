// OMO-3159: 고객용 견적서(PDF) 렌더러 — pdf-lib.
//
// 라이브러리 결정(서브태스크 1): **pdf-lib** 채택.
//   근거: ① 이미 의존성에 존재하고 사내 PDF 코드(print-template-pdf.ts)가 사용 중
//        ② Next.js 16 nodejs 런타임에서 네이티브 의존성 없이 동작(react-pdf 대비 경량)
//        ③ 좌표 기반이라 견적서 같은 정형 1페이지 레이아웃엔 충분.
//   트레이드오프: 복잡한 자동 레이아웃은 수동 좌표 계산이 필요(여기선 1페이지라 OK).
//
// 폰트: 표준 Helvetica(WinAnsi) — 한글 인코딩 불가. PCCF 는 영문/USD 국제 사이트이므로
//   견적서 본문은 영문으로 작성한다(폰트 임베드 불필요). 비-ASCII 는 asciiSafe 로 방어.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { PANTONE_QUOTE_THEME, hexToRgb01, type PantoneMix } from './pantone-quote-theme'
import type { QuoteResult } from './quote-pricing'

const A4 = { w: 595.28, h: 841.89 }
const MARGIN = 48

function asciiSafe(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[^\x20-\x7E]/g, '?').replace(/\?+/g, '?').trim() || '-'
}

function color(hex: string) {
  const { r, g, b } = hexToRgb01(hex)
  return rgb(r, g, b)
}

function usd(n: number): string {
  return `$${n.toFixed(2)}`
}

export interface QuotePdfBrand {
  companyName: string
  website: string
  email: string
  /** 푸터 법무/유효성 문구. */
  legalNote: string
}

export const DEFAULT_BRAND: QuotePdfBrand = {
  companyName: 'Procardcrafters',
  website: 'procardcrafters.com',
  email: 'orders@procardcrafters.com',
  legalNote:
    'This quotation is an estimate based on current pricing and exchange rates and is valid until the date shown above. ' +
    'Final pricing is confirmed at order checkout. Prices are in USD and exclude any applicable import duties or taxes.',
}

export interface QuotePdfInput {
  quote: QuoteResult
  quoteNumber: string
  /** 발행일 — 표시용 포맷된 문자열(예: "Jun 14, 2026"). 라우트에서 주입. */
  issuedDate: string
  /** 유효기한 — 표시용 포맷된 문자열. */
  validUntilDate: string
  mixes: PantoneMix[]
  brand?: QuotePdfBrand
}

/** 견적서 1페이지 PDF 를 생성한다. */
export async function buildQuotePdf(input: QuotePdfInput): Promise<Uint8Array> {
  const { quote, quoteNumber, issuedDate, validUntilDate, mixes } = input
  const brand = input.brand ?? DEFAULT_BRAND

  const doc = await PDFDocument.create()
  doc.setTitle(`Quotation ${quoteNumber} — ${quote.product.nameEn}`)
  doc.setAuthor(brand.companyName)
  doc.setSubject('Customer quotation')

  const page = doc.addPage([A4.w, A4.h])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const headerColor = color(PANTONE_QUOTE_THEME.header.hex)
  const accentColor = color(PANTONE_QUOTE_THEME.accent.hex)
  const inkColor = color(PANTONE_QUOTE_THEME.ink.hex)
  const mutedColor = color(PANTONE_QUOTE_THEME.muted.hex)
  const tableHeadBg = color(PANTONE_QUOTE_THEME.tableHeaderBg.hex)
  const positiveColor = color(PANTONE_QUOTE_THEME.positive.hex)

  const text = (
    p: PDFPage,
    s: string,
    x: number,
    y: number,
    size: number,
    f: PDFFont = font,
    c = inkColor,
  ) => p.drawText(asciiSafe(s), { x, y, size, font: f, color: c })

  // 우측 정렬 텍스트
  const textRight = (s: string, xRight: number, y: number, size: number, f: PDFFont, c = inkColor) => {
    const w = f.widthOfTextAtSize(asciiSafe(s), size)
    page.drawText(asciiSafe(s), { x: xRight - w, y, size, font: f, color: c })
  }

  const contentRight = A4.w - MARGIN

  // ── 헤더 밴드 ──────────────────────────────────────────
  const bandH = 96
  page.drawRectangle({ x: 0, y: A4.h - bandH, width: A4.w, height: bandH, color: headerColor })
  // 액센트 라인
  page.drawRectangle({ x: 0, y: A4.h - bandH - 4, width: A4.w, height: 4, color: accentColor })

  const white = rgb(1, 1, 1)
  text(page, brand.companyName, MARGIN, A4.h - 44, 22, bold, white)
  text(page, `${brand.website}  |  ${brand.email}`, MARGIN, A4.h - 64, 9, font, white)
  textRight('QUOTATION', contentRight, A4.h - 44, 20, bold, white)
  textRight(`No. ${quoteNumber}`, contentRight, A4.h - 64, 10, font, white)

  let y = A4.h - bandH - 32

  // ── 메타(발행/유효) ────────────────────────────────────
  text(page, 'Issued', MARGIN, y, 8, bold, mutedColor)
  text(page, issuedDate, MARGIN, y - 13, 11, font)
  text(page, 'Valid Until', MARGIN + 150, y, 8, bold, mutedColor)
  text(page, validUntilDate, MARGIN + 150, y - 13, 11, font)
  text(page, 'Currency', MARGIN + 300, y, 8, bold, mutedColor)
  text(page, 'USD', MARGIN + 300, y - 13, 11, font)
  y -= 44

  // ── 제품 / 사양 ────────────────────────────────────────
  text(page, 'PRODUCT', MARGIN, y, 9, bold, accentColor)
  y -= 18
  text(page, quote.product.nameEn, MARGIN, y, 15, bold)
  y -= 22

  // 선택 사양 (label: value) 두 칼럼
  const specs: string[] = [
    `Quantity: ${quote.effectiveQty}${quote.effectiveQty !== quote.quantity ? ` (requested ${quote.quantity})` : ''}`,
    ...quote.selections
      .filter((s) => !['paper_qty', 'quantity'].includes(s.optionType))
      .map((s) => `${prettyType(s.optionType)}: ${s.labelEn}`),
  ]
  if (quote.press) specs.push(`Press: ${quote.press === 'digital' ? 'Digital' : 'Offset'}`)
  specs.push(`Production: ${quote.productionDays.min}-${quote.productionDays.max} business days`)

  const colW = (contentRight - MARGIN) / 2
  specs.forEach((line, i) => {
    const colX = MARGIN + (i % 2) * colW
    if (i % 2 === 0 && i > 0) y -= 16
    if (i === 0) {
      /* first row baseline already set */
    }
    const rowY = y - Math.floor(i / 2) * 16
    page.drawCircle({ x: colX + 2, y: rowY + 3, size: 1.6, color: accentColor })
    text(page, line, colX + 12, rowY, 10, font)
  })
  y -= Math.ceil(specs.length / 2) * 16 + 18

  // ── 가격 표 ────────────────────────────────────────────
  const tableX = MARGIN
  const tableW = contentRight - MARGIN
  const rowH = 24
  // 헤더
  page.drawRectangle({ x: tableX, y: y - rowH, width: tableW, height: rowH, color: tableHeadBg })
  text(page, 'DESCRIPTION', tableX + 10, y - 16, 9, bold, inkColor)
  textRight('UNIT', tableX + tableW - 200, y - 16, 9, bold, inkColor)
  textRight('QTY', tableX + tableW - 110, y - 16, 9, bold, inkColor)
  textRight('AMOUNT', tableX + tableW - 10, y - 16, 9, bold, inkColor)
  y -= rowH

  const rows: Array<{ desc: string; unit: string; qty: string; amount: string }> = [
    {
      desc: `${quote.product.nameEn} - print`,
      unit: usd(quote.unitPriceUsd),
      qty: String(quote.effectiveQty),
      amount: usd(quote.itemPriceUsd),
    },
    {
      desc: quote.shippingUsd > 0 ? 'Shipping (FedEx Worldwide)' : 'Shipping (included)',
      unit: '',
      qty: '',
      amount: quote.shippingUsd > 0 ? usd(quote.shippingUsd) : 'FREE',
    },
  ]
  for (const r of rows) {
    text(page, r.desc, tableX + 10, y - 16, 10, font)
    textRight(r.unit, tableX + tableW - 200, y - 16, 10, font, mutedColor)
    textRight(r.qty, tableX + tableW - 110, y - 16, 10, font, mutedColor)
    textRight(r.amount, tableX + tableW - 10, y - 16, 10, font)
    page.drawLine({
      start: { x: tableX, y: y - rowH },
      end: { x: tableX + tableW, y: y - rowH },
      thickness: 0.5,
      color: color('#E5E7EB'),
    })
    y -= rowH
  }

  // 합계 행
  page.drawRectangle({ x: tableX, y: y - rowH - 4, width: tableW, height: rowH + 4, color: color('#F3F8FB') })
  text(page, 'TOTAL', tableX + 10, y - 17, 12, bold, headerColor)
  textRight(usd(quote.totalUsd), tableX + tableW - 10, y - 17, 14, bold, positiveColor)
  y -= rowH + 4 + 26

  // ── 추천 팬톤 믹스 ─────────────────────────────────────
  text(page, 'RECOMMENDED PANTONE COLOR MIX', MARGIN, y, 9, bold, accentColor)
  y -= 6
  text(page, 'Curated palettes that suit this product. Final spot-color matching confirmed at print.', MARGIN, y - 10, 8, font, mutedColor)
  y -= 28

  for (const mix of mixes.slice(0, 2)) {
    text(page, mix.label, MARGIN, y, 11, bold)
    text(page, mix.mood, MARGIN + 4, y - 13, 8, font, mutedColor)
    // 스와치 칩
    let chipX = MARGIN + 280
    for (const sw of mix.swatches) {
      const chipW = 120
      page.drawRectangle({
        x: chipX,
        y: y - 14,
        width: 22,
        height: 22,
        color: color(sw.hex),
        borderColor: color('#D1D5DB'),
        borderWidth: 0.5,
      })
      text(page, `Pantone ${sw.pantone}`, chipX + 28, y, 8, bold)
      text(page, sw.name, chipX + 28, y - 11, 7.5, font, mutedColor)
      chipX += chipW + 8
      if (chipX > contentRight - 100) {
        chipX = MARGIN + 280
        y -= 30
      }
    }
    y -= 40
  }

  // ── 푸터 ───────────────────────────────────────────────
  const footY = MARGIN + 36
  page.drawLine({
    start: { x: MARGIN, y: footY + 28 },
    end: { x: contentRight, y: footY + 28 },
    thickness: 0.5,
    color: color('#E5E7EB'),
  })
  // 법무 문구(줄바꿈)
  wrapText(brand.legalNote, 128).forEach((line, i) => {
    text(page, line, MARGIN, footY + 16 - i * 9, 7, font, mutedColor)
  })
  textRight(`${brand.companyName}  |  ${brand.website}`, contentRight, footY - 14, 8, bold, headerColor)

  return doc.save()
}

function prettyType(t: string): string {
  const map: Record<string, string> = {
    paper_code: 'Paper',
    paper: 'Paper',
    size: 'Size',
    sides: 'Sides',
    finish: 'Finish',
    finishing: 'Finishing',
    corner: 'Corner',
    lamination: 'Lamination',
  }
  return map[t] ?? t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** 폭(문자수 근사) 기준 단순 워드랩. */
function wrapText(s: string, maxChars: number): string[] {
  const words = asciiSafe(s).split(/\s+/)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars) {
      if (cur) lines.push(cur)
      cur = w
    } else {
      cur = (cur + ' ' + w).trim()
    }
  }
  if (cur) lines.push(cur)
  return lines.slice(0, 3)
}
