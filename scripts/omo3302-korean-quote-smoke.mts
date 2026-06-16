// OMO-3302: 한글 서명자/제품명이 견적서 PDF 에 "????" 가 아니라 정상 렌더되는지 검증.
//
// 실행:  npx tsx scripts/omo3302-korean-quote-smoke.mts
// 검증:  pdffonts /tmp/omo3302-korean-quote.pdf  → NotoSansKR (Type0/CID) 임베드 확인.

import { buildQuotePdf } from '../src/lib/quote-pdf'
import { pantoneMixesForCategory } from '../src/lib/pantone-quote-theme'
import type { QuoteResult } from '../src/lib/quote-pricing'

// 한글 제품명/옵션 라벨로 비-ASCII 경로(NotoSansKR 임베드)를 강제한다.
const quote: QuoteResult = {
  product: { slug: 'business-cards', nameEn: '명함 — 홍길동', category: 'business_cards' },
  selections: [
    { optionType: 'paper_code', labelEn: '스노우화이트 250g', value: 'SNW250W00' },
    { optionType: 'sides', labelEn: '양면', value: '2' },
    { optionType: 'paper_qty', labelEn: '500', value: '500' },
  ],
  quantity: 500,
  effectiveQty: 500,
  press: 'offset',
  unitPriceUsd: 0.09,
  itemPriceUsd: 45.0,
  shippingUsd: 18.0,
  totalUsd: 63.0,
  exchangeRate: 1 / 1525,
  usedSwadpia: true,
  productionDays: { min: 3, max: 5 },
}

const bytes = await buildQuotePdf({
  quote,
  quoteNumber: 'PCC-20260616-3302',
  issuedDate: 'Jun 16, 2026',
  validUntilDate: 'Jun 30, 2026',
  mixes: pantoneMixesForCategory('business_cards'),
})

const fs = await import('node:fs')
const out = '/tmp/omo3302-korean-quote.pdf'
fs.writeFileSync(out, Buffer.from(bytes))
const head = Buffer.from(bytes.slice(0, 5)).toString('latin1')
console.log('PDF bytes:', bytes.length, 'header:', head, head === '%PDF-' ? 'OK' : 'BAD')
console.log('wrote', out, '→ run: pdffonts', out)
