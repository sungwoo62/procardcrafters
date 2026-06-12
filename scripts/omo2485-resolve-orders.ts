/**
 * OMO-2485: 미해결 2건 교정 발주 검증
 *
 * 라이브 옵션 구조 조사(omo2485-probe-selects)로 밝혀진 교정값:
 *  1) CNC5000 투명명함: print_color_type CTN40→CTN10 (CNC5000은 CTN10/CTN99만),
 *                       quantity 100→200 (paper_qty 최소 200, 100 옵션 없음)
 *  2) CNC6000/8000 ARM230W00: 파라미터(ARM230W00/CTN40/N0100/200) 전부 유효 →
 *                       이전 실패는 paper_code AJAX 리로드 레이스 추정. 재검증.
 *
 * 결과: 결제대기(direct_order) 페이지까지 진행하는 미결제 드래프트 발주 = 검증 안전.
 * 실행: node --experimental-strip-types --env-file=.env.local scripts/omo2485-resolve-orders.mjs
 */
import * as fs from 'fs'
import * as path from 'path'
import { placeSwadpiaOrder } from '../src/lib/swadpia-order.ts'

function log(m) { process.stdout.write(`[${new Date().toLocaleTimeString('ko-KR')}] ${m}\n`) }

function makePdf(label) {
  const dir = path.join(import.meta.dirname, 'test-artifacts', 'omo2485')
  fs.mkdirSync(dir, { recursive: true })
  const f = path.join(dir, `order-${label.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`)
  fs.writeFileSync(f, `%PDF-1.4
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
%%EOF`)
  return f
}

// CNC5000(OSA260612697962) 검증완료 → 재발주 생략. ARM230W00 2건만 교정 재검증.
const CASES = [
  {
    // ARM230W00(아르미230g)은 paper_code 변경 시 paper_qty 사다리가 300단위로
    // 리로드됨(200 옵션 없음). qty 200 발주가 "did not find some options"로
    // 실패했던 원인. 교정: 300단위 수량 사용.
    label: 'CNC6000 UV ARM230W00 (교정: qty300)',
    productSlug: 'uv-business-cards',
    options: { paper_code: 'ARM230W00', print_color_type: 'CTN40', paper_size: 'N0100' },
    quantity: 300,
  },
  {
    label: 'CNC8000 pearl ARM230W00 (교정: qty300)',
    productSlug: 'pearl-business-cards',
    options: { paper_code: 'ARM230W00', print_color_type: 'CTN40', paper_size: 'N0100' },
    quantity: 300,
  },
]

async function main() {
  if (!process.env.SWADPIA_USERNAME) { process.stderr.write('SWADPIA creds 없음\n'); process.exit(1) }
  const results = []
  for (const tc of CASES) {
    log(`\n${'─'.repeat(56)}\n  ${tc.label}\n  옵션 ${JSON.stringify(tc.options)} 수량 ${tc.quantity}`)
    const filePath = makePdf(tc.label)
    try {
      const r = await placeSwadpiaOrder({
        productSlugOrCategoryCode: tc.productSlug,
        selectedOptions: tc.options,
        quantity: tc.quantity,
        fileUrl: `file://${filePath}`,
        orderTitle: `[테스트] ${tc.label}`,
      })
      if (r.success) {
        log(`  ✓ 발주 OK  번호=${r.swadpiaOrderNumber ?? '(미캡처)'}`)
        results.push({ label: tc.label, success: true, order: r.swadpiaOrderNumber })
      } else {
        log(`  ✗ 실패: ${r.errorMessage}`)
        results.push({ label: tc.label, success: false, error: r.errorMessage })
      }
    } catch (e) {
      log(`  ✗ 예외: ${e.message}`)
      results.push({ label: tc.label, success: false, error: e.message })
    }
    await new Promise((res) => setTimeout(res, 2500))
  }
  log(`\n${'═'.repeat(56)}\n  최종 결과`)
  for (const r of results) log(`  ${r.success ? '✓' : '✗'} ${r.label} — ${r.success ? r.order : r.error}`)
  const pass = results.filter((r) => r.success).length
  log(`\n  ${pass}/${results.length} 성공`)
  const dir = path.join(import.meta.dirname, 'test-artifacts', 'omo2485')
  fs.writeFileSync(path.join(dir, 'resolve-orders-result.json'), JSON.stringify(results, null, 2))
}
main().catch((e) => { process.stderr.write(`오류: ${e.message}\n`); process.exit(1) })
