/**
 * 성원애드피아 자동 발주 통합 테스트
 *
 * 실행:
 *   node --experimental-strip-types --env-file=.env.local scripts/test-swadpia-order.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { placeSwadpiaOrder } from '../src/lib/swadpia-order'

const SCREENSHOT_DIR = path.join(import.meta.dirname ?? __dirname, 'screenshots')

function log(msg: string) {
  process.stdout.write(`[${new Date().toLocaleTimeString('ko-KR')}] ${msg}\n`)
}

async function main() {
  if (!process.env.SWADPIA_USERNAME || !process.env.SWADPIA_PASSWORD) {
    log('SWADPIA_USERNAME / SWADPIA_PASSWORD 환경변수 없음')
    process.exit(1)
  }

  // 테스트 PDF 생성
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
  const testFilePath = path.join(SCREENSHOT_DIR, 'test-card.pdf')
  if (!fs.existsSync(testFilePath)) {
    const pdfContent = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 255 142]/Parent 2 0 R/Resources<<>>>>endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer<</Size 4/Root 1 0 R>>
startxref
206
%%EOF`
    fs.writeFileSync(testFilePath, pdfContent)
  }

  log('=== 성원애드피아 자동 발주 테스트 ===\n')
  log('상품: 명함 (CNC1000)')
  log('옵션: 스노우지250g / 양면컬러 / 90x50mm / 500매\n')

  const result = await placeSwadpiaOrder({
    productSlugOrCategoryCode: 'business-cards',
    selectedOptions: {
      paper_code: 'SNW250W00',
      print_color_type: 'CTN40',
      size_type: 'SZT10',
      paper_size: 'N0100',
      order_count: '1',
    },
    quantity: 500,
    fileUrl: `file://${testFilePath}`,
    orderTitle: '테스트 명함 - 스노우지250g 양면컬러 500매',
  })

  log(`\n결과: ${JSON.stringify(result, null, 2)}`)

  if (result.success) {
    log('\n✓ 주문 완료 (S머니/가상계좌 — 미결제 상태)')
    if (result.swadpiaOrderNumber) log(`  주문번호: ${result.swadpiaOrderNumber}`)
    if (result.checkoutUrl) log(`  URL: ${result.checkoutUrl}`)
  } else {
    log(`\n✗ 실패: ${result.errorMessage}`)
    process.exit(1)
  }
}

main().catch((err) => {
  process.stderr.write(`오류: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
