// 주문 회신메일 산출물 이미지 생성 (OMO-2841)
// 고객에게 나가는 메일과 동일한 빌더(buildEmailHtml)·인보이스 PDF(generateOrderInvoicePdf)를 그대로 사용해
//  1) 주문 확정(Order Confirmed) 회신메일 HTML 렌더 PNG
//  2) 인보이스 PDF 1페이지 PNG
// 를 docs/quote-samples/pccf/ 에 생성한다.
//
// 실행: node --import ./scripts/_sample-register.mjs scripts/generate-quote-samples.mjs
import { chromium } from 'playwright'
import { writeFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { buildEmailHtml } from '@/lib/email'
import { generateOrderInvoicePdf } from '@/lib/order-pdf'

const OUT = path.resolve('docs/quote-samples/pccf')
mkdirSync(OUT, { recursive: true })

// route.ts 의 SAMPLE_ORDER 와 동일한 대표 샘플 (영문)
const sample = {
  orderNumber: 'PCC-SAMPLE-0001',
  customerEmail: 'sample@example.com',
  customerName: 'John Doe',
  totalUsd: 248.0,
  items: [
    { name: 'Premium Business Cards (16pt, Matte)', quantity: 500, priceUsd: 89.0 },
    { name: 'Folded Flyers (A5, Full Color, 2-sided)', quantity: 1000, priceUsd: 159.0 },
  ],
}

// 1) 주문 확정 회신메일 HTML → PNG
const html = buildEmailHtml('paid', sample)
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 720, height: 1000 }, deviceScaleFactor: 2 })
// 외부 추적 픽셀 등 원격 요청 차단 (오프라인 렌더)
await page.route('**/*', (route) => {
  const url = route.request().url()
  if (url.startsWith('http')) return route.abort()
  return route.continue()
})
await page.setContent(`<body style="margin:0;background:#f3f4f6;padding:24px;">${html}</body>`, {
  waitUntil: 'domcontentloaded',
})
await page.waitForTimeout(300)
await page.screenshot({ path: path.join(OUT, 'email-order-confirmation.png'), fullPage: true })
await browser.close()
console.log('✓ email-order-confirmation.png')

// 2) 인보이스 PDF → 1페이지 PNG
const pdf = await generateOrderInvoicePdf({
  orderNumber: sample.orderNumber,
  customerName: sample.customerName,
  customerEmail: sample.customerEmail,
  totalUsd: sample.totalUsd,
  lineItems: sample.items.map((i) => ({
    description: i.name,
    quantity: i.quantity,
    unitPriceUsd: i.quantity > 0 ? i.priceUsd / i.quantity : i.priceUsd,
    subtotalUsd: i.priceUsd,
  })),
})
const tmpPdf = path.join('/tmp', 'pccf-invoice-sample.pdf')
writeFileSync(tmpPdf, Buffer.from(pdf))
execFileSync('pdftoppm', [
  '-png',
  '-r',
  '150',
  '-f',
  '1',
  '-l',
  '1',
  '-singlefile',
  tmpPdf,
  path.join(OUT, 'invoice-pdf-page1'),
])
console.log('✓ invoice-pdf-page1.png')
