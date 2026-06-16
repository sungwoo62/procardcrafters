// OMO-3159: 고객용 견적서(PDF) 렌더러 — pdf-lib.
//
// 라이브러리 결정(서브태스크 1): **pdf-lib** 채택.
//   근거: ① 이미 의존성에 존재하고 사내 PDF 코드(print-template-pdf.ts)가 사용 중
//        ② Next.js 16 nodejs 런타임에서 네이티브 의존성 없이 동작(react-pdf 대비 경량)
//        ③ 좌표 기반이라 견적서 같은 정형 1페이지 레이아웃엔 충분.
//   트레이드오프: 복잡한 자동 레이아웃은 수동 좌표 계산이 필요(여기선 1페이지라 OK).
//
// 폰트(OMO-3302): 본문 기본은 표준 Helvetica(WinAnsi). 단, 한글 등 비-ASCII 가 한 글자라도
//   포함되면 — 예: 한글 서명자/고객명, 한글 제품명 — Helvetica(WinAnsi) 코드페이지엔 글리프가
//   없어 "????" 로 깨진다. 따라서 비-ASCII 가 감지되면 NotoSansKR(Type0/CID) 를 fontkit 으로
//   임베드(★ subset:false — subset:true 면 Noto/Nanum cmap 손상, 전 서비스 공통 함정)하고
//   해당 문자열만 한글 폰트로 그린다. 전부 ASCII 인 일반 견적서는 폰트를 임베드하지 않아 가볍다.

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { PANTONE_QUOTE_THEME, hexToRgb01, type PantoneMix } from './pantone-quote-theme'
import type { QuoteResult } from './quote-pricing'

const A4 = { w: 595.28, h: 841.89 }
const MARGIN = 48

// 한글 등 ASCII 밖의 문자가 하나라도 있는가.
const NON_ASCII = /[^\x00-\x7F]/

// Helvetica 로 그릴 때만 사용하는 최후의 방어(비-ASCII → '?'). 한글 폰트로 그릴 땐 원문 유지.
function asciiSafe(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[^\x20-\x7E]/g, '?').replace(/\?+/g, '?').trim() || '-'
}

interface KoFonts {
  regular: PDFFont
  bold: PDFFont
}

// NotoSansKR(Regular/Bold) 를 subset:false 로 임베드. hardcase/medal 등 한국 서비스와 동일 패턴.
async function embedKoreanFonts(doc: PDFDocument): Promise<KoFonts> {
  doc.registerFontkit(fontkit)
  const dir = path.join(process.cwd(), 'public/fonts')
  const [regularBytes, boldBytes] = await Promise.all([
    readFile(path.join(dir, 'NotoSansKR-Regular.otf')),
    readFile(path.join(dir, 'NotoSansKR-Bold.otf')),
  ])
  return {
    regular: await doc.embedFont(regularBytes, { subset: false }),
    bold: await doc.embedFont(boldBytes, { subset: false }),
  }
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

  // 비-ASCII(한글 등) 가 들어갈 수 있는 모든 동적 문자열을 미리 훑어, 한 글자라도 있으면
  // NotoSansKR 을 임베드한다. (서명자/고객명·한글 제품명·한글 옵션 라벨 등을 모두 포괄)
  const dynamicStrings: string[] = [
    quote.product.nameEn,
    ...quote.selections.flatMap((s) => [s.labelEn, s.optionType]),
    brand.companyName,
    brand.website,
    brand.email,
    brand.legalNote,
    quoteNumber,
    issuedDate,
    validUntilDate,
    ...mixes.flatMap((m) => [m.label, m.mood, ...m.swatches.flatMap((sw) => [sw.name, sw.pantone])]),
  ]
  const ko: KoFonts | null = dynamicStrings.some((s) => NON_ASCII.test(s ?? ''))
    ? await embedKoreanFonts(doc)
    : null

  // 문자열에 비-ASCII 가 있고 한글 폰트가 임베드돼 있으면 한글 폰트(weight 매칭)를, 아니면 원래 폰트를.
  const resolveFont = (s: string, f: PDFFont): PDFFont =>
    ko && NON_ASCII.test(s) ? (f === bold ? ko.bold : ko.regular) : f
  // Helvetica 로 남는 경우에만 asciiSafe 방어; 한글 폰트로 가면 원문 그대로.
  const renderStr = (s: string, f: PDFFont): string => (resolveFont(s, f) === f ? asciiSafe(s) : s)

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
  ) => p.drawText(renderStr(s, f), { x, y, size, font: resolveFont(s, f), color: c })

  // 우측 정렬 텍스트 — 폭 계산도 실제 사용할 폰트로(정렬 어긋남 방지).
  const textRight = (s: string, xRight: number, y: number, size: number, f: PDFFont, c = inkColor) => {
    const ff = resolveFont(s, f)
    const str = renderStr(s, f)
    const w = ff.widthOfTextAtSize(str, size)
    page.drawText(str, { x: xRight - w, y, size, font: ff, color: c })
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

/** 폭(문자수 근사) 기준 단순 워드랩. 인코딩 방어는 그리는 단계(text())에 위임한다. */
function wrapText(s: string, maxChars: number): string[] {
  const words = s.split(/\s+/)
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
