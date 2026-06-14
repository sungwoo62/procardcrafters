import { buildQuotePdf } from '../src/lib/quote-pdf'
import { pantoneMixesForCategory } from '../src/lib/pantone-quote-theme'
import type { QuoteResult } from '../src/lib/quote-pricing'

const quote: QuoteResult = {
  product: { slug: 'business-cards', nameEn: 'Business Cards', category: 'business_cards' },
  selections: [
    { optionType: 'paper_code', labelEn: 'Snow White 250g', value: 'SNW250W00' },
    { optionType: 'sides', labelEn: 'Double-sided', value: '2' },
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
  quoteNumber: 'PCC-20260614-1234',
  issuedDate: 'Jun 14, 2026',
  validUntilDate: 'Jun 28, 2026',
  mixes: pantoneMixesForCategory('business_cards'),
})

const fs = await import('node:fs')
fs.writeFileSync('/tmp/omo3159-sample-quote.pdf', Buffer.from(bytes))
const head = Buffer.from(bytes.slice(0, 5)).toString('latin1')
console.log('PDF bytes:', bytes.length, 'header:', head, head === '%PDF-' ? 'OK' : 'BAD')
