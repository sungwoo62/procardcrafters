/**
 * OMO-2485: 전체 명함 제품군 성원 피팅 검증 — 테스트 발주
 *
 * 새로 매핑된 6개 명함 상품의 Swadpia 자동 발주 가능 여부를 검증합니다.
 * - CNC3000: premium-foil-cards, metallic-business-cards (Luxury 메탈 — 웹발주 불가 예상)
 * - CNC4000: letterpress-business-cards (아트지 300g)
 * - CNC5000: transparent-business-cards (PET 투명)
 * - CNC6000: uv-business-cards (아르미 230g)
 * - CNC8000: pearl-business-cards (아르미 230g)
 *
 * 실행:
 *   node --experimental-strip-types --env-file=.env.local scripts/test-specialty-cards-orders.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { placeSwadpiaOrder } from '../src/lib/swadpia-order.ts'

function log(msg: string) {
  process.stdout.write(`[${new Date().toLocaleTimeString('ko-KR')}] ${msg}\n`)
}
function logSection(title: string) {
  log(`\n${'─'.repeat(60)}`)
  log(`  ${title}`)
  log(`${'─'.repeat(60)}\n`)
}

function createTestPdf(label: string): string {
  const dir = path.join(import.meta.dirname ?? __dirname, 'test-artifacts')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const safeLabel = label.replace(/[^a-zA-Z0-9-]/g, '-')
  const filePath = path.join(dir, `specialty-${safeLabel}-${Date.now()}.pdf`)
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
  fs.writeFileSync(filePath, pdfContent)
  return filePath
}

if (!process.env.SWADPIA_USERNAME || !process.env.SWADPIA_PASSWORD) {
  process.stderr.write('SWADPIA_USERNAME / SWADPIA_PASSWORD 없음\n')
  process.exit(1)
}

const TEST_CASES = [
  {
    label: 'CNC4000 letterpress (아트지 300g)',
    productSlug: 'letterpress-business-cards',
    options: {
      paper_code: 'ART300W00',
      print_color_type: 'CTN40',
      paper_size: 'N0100',
    },
    quantity: 200,
  },
  {
    label: 'CNC5000 transparent (PET 투명 300μm)',
    productSlug: 'transparent-business-cards',
    options: {
      paper_code: 'PET300TRU',
      print_color_type: 'CTN40',
      paper_size: 'N0300',
    },
    quantity: 100,
  },
  {
    label: 'CNC6000 UV (아르미 울트라화이트 230g)',
    productSlug: 'uv-business-cards',
    options: {
      paper_code: 'ARM230W00',
      print_color_type: 'CTN40',
      paper_size: 'N0100',
    },
    quantity: 200,
  },
  {
    label: 'CNC6000 UV (인버코트 350g)',
    productSlug: 'uv-business-cards',
    options: {
      paper_code: 'INV350MT0',
      print_color_type: 'CTN40',
      paper_size: 'N0100',
    },
    quantity: 200,
  },
  {
    label: 'CNC8000 pearl (아르미 울트라화이트 230g)',
    productSlug: 'pearl-business-cards',
    options: {
      paper_code: 'ARM230W00',
      print_color_type: 'CTN40',
      paper_size: 'N0100',
    },
    quantity: 200,
  },
  {
    label: 'CNC3000 foil (Luxury 화이트 250μm) — 웹발주 불가 예상',
    productSlug: 'premium-foil-cards',
    options: {
      paper_code: 'LUX250W0U',
      paper_size: 'N0400',
    },
    quantity: 200,
  },
  {
    label: 'CNC3000 metallic (Luxury 골드 200μm) — 웹발주 불가 예상',
    productSlug: 'metallic-business-cards',
    options: {
      paper_code: 'LUX200GDU',
      paper_size: 'N0400',
    },
    quantity: 200,
  },
]

interface OrderResult {
  label: string
  slug: string
  category_code: string
  success: boolean
  swadpiaOrderNumber?: string
  error?: string
}

async function main() {
  log('=== OMO-2485 전체 명함 제품군 성원 피팅 검증 — 테스트 발주 ===\n')

  const results: OrderResult[] = []

  for (const tc of TEST_CASES) {
    logSection(tc.label)
    log(`슬러그: ${tc.productSlug}`)
    log(`옵션: ${JSON.stringify(tc.options)}`)
    log(`수량: ${tc.quantity}매\n`)

    const filePath = createTestPdf(tc.productSlug)

    try {
      const result = await placeSwadpiaOrder({
        productSlugOrCategoryCode: tc.productSlug,
        selectedOptions: tc.options as Record<string, string>,
        quantity: tc.quantity,
        fileUrl: `file://${filePath}`,
        orderTitle: `[테스트] ${tc.label}`,
      })

      if (result.success) {
        log(`✓ 주문 완료`)
        if (result.swadpiaOrderNumber) log(`  발주번호: ${result.swadpiaOrderNumber}`)
        if (result.checkoutUrl) log(`  URL: ${result.checkoutUrl}`)
        results.push({
          label: tc.label,
          slug: tc.productSlug,
          category_code: tc.productSlug,
          success: true,
          swadpiaOrderNumber: result.swadpiaOrderNumber,
        })
      } else {
        log(`✗ 실패: ${result.errorMessage}`)
        results.push({
          label: tc.label,
          slug: tc.productSlug,
          category_code: tc.productSlug,
          success: false,
          error: result.errorMessage,
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      log(`✗ 예외: ${msg}`)
      results.push({
        label: tc.label,
        slug: tc.productSlug,
        category_code: tc.productSlug,
        success: false,
        error: msg,
      })
    }

    // 발주 간격
    await new Promise(r => setTimeout(r, 2000))
  }

  // 최종 결과 요약
  log('\n')
  log('═'.repeat(60))
  log('  최종 결과 요약')
  log('═'.repeat(60))
  for (const r of results) {
    const icon = r.success ? '✓' : '✗'
    const detail = r.success
      ? (r.swadpiaOrderNumber ? `발주번호: ${r.swadpiaOrderNumber}` : '발주 완료')
      : `실패: ${r.error}`
    log(`${icon} ${r.label}`)
    log(`    ${detail}`)
  }

  const passed = results.filter(r => r.success).length
  log(`\n${passed}/${results.length} 성공`)
}

main().catch(err => {
  process.stderr.write(`오류: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
