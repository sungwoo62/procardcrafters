/**
 * 파일 검증 + 배치 발주 스크립트
 *
 * 1. 이전 E2E 테스트 파일이 성원에 실제로 업로드되었는지 검증
 * 2. 명함 다양한 옵션 5건 발주
 * 3. 다른 제품 5종 각 1건 발주
 *
 * 실행:
 *   node --experimental-strip-types --env-file=.env.local scripts/test-batch-orders.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import { placeSwadpiaOrder } from '../src/lib/swadpia-order'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY) {
  process.stderr.write('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 없음\n')
  process.exit(1)
}
if (!process.env.SWADPIA_USERNAME || !process.env.SWADPIA_PASSWORD) {
  process.stderr.write('SWADPIA_USERNAME / SWADPIA_PASSWORD 없음\n')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

function log(msg: string) {
  process.stdout.write(`[${new Date().toLocaleTimeString('ko-KR')}] ${msg}\n`)
}
function logSection(title: string) {
  log(`\n${'═'.repeat(60)}`)
  log(`  ${title}`)
  log(`${'═'.repeat(60)}\n`)
}

function createTestPdf(label: string): string {
  const dir = path.join(import.meta.dirname ?? __dirname, 'test-artifacts')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const safeLabel = label.replace(/[^a-zA-Z0-9-]/g, '-')
  const filePath = path.join(dir, `batch-${safeLabel}-${Date.now()}.pdf`)
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

// ─── Step 0: 파일 검증 ──────────────────────────────────────
async function verifyPreviousFile() {
  logSection('Step 0: 이전 E2E 테스트 파일 검증')

  const prevOrderId = '7bd5d309-71a0-4c93-8e03-a1f43f8a862a'
  const prevSwadpiaOrderNum = 'OSA260603581455'

  const { data: files } = await supabase
    .from('print_files')
    .select('*')
    .eq('order_id', prevOrderId)
    .order('created_at', { ascending: false })

  if (!files || files.length === 0) {
    log('⚠ print_files 레코드 없음 (--cleanup으로 이미 삭제됨)')
  } else {
    log(`print_files 레코드 ${files.length}건 발견`)
    for (const f of files) {
      log(`  storage_path: ${f.storage_path}`)
      log(`  status: ${f.status}`)
      log(`  original_filename: ${f.original_filename}`)
      log(`  file_size_bytes: ${f.file_size_bytes}`)

      const { data: signedResult, error: signErr } = await supabase
        .storage
        .from('print-assets')
        .createSignedUrl(f.storage_path, 60)

      if (signErr || !signedResult?.signedUrl) {
        log(`  ✗ Storage 파일 없음: ${signErr?.message}`)
      } else {
        log(`  ✓ Storage 파일 존재 확인`)
        const headRes = await fetch(signedResult.signedUrl, { method: 'HEAD' })
        log(`    HTTP ${headRes.status}, Content-Length: ${headRes.headers.get('content-length')} bytes`)
      }
    }
  }

  const { data: factOrders } = await supabase
    .from('print_factory_orders')
    .select('*')
    .eq('print_order_id', prevOrderId)

  if (factOrders && factOrders.length > 0) {
    const fo = factOrders[0]
    log(`\n공장 발주 레코드:`)
    log(`  status: ${fo.status}`)
    log(`  swadpia_order_number: ${fo.swadpia_order_number}`)
    log(`  category_code: ${fo.category_code}`)
    log(`  quantity: ${fo.quantity}`)
    log(`  options_snapshot: ${JSON.stringify(fo.options_snapshot)}`)
    if (fo.swadpia_order_number === prevSwadpiaOrderNum) {
      log(`  ✓ 성원 발주번호 일치: ${prevSwadpiaOrderNum} — 동일 파일로 파이프라인 연결 정상`)
    }
  }
}

// ─── 단일 발주 실행 ──────────────────────────────────────────
const SLUG_TO_CODE: Record<string, string> = {
  'business-cards': 'CNC1000',
  'premium-business-cards': 'CNC2000',
  'stickers': 'CST1000',
  'die-cut-stickers': 'CST2000',
  'flyers': 'CLF1000',
  'brochures': 'CLF2000',
  'postcards': 'CDP3000',
  'posters': 'CPR2000',
  'banners': 'CPR5000',
}

async function runOrder(params: {
  label: string
  productSlug: string
  options: Record<string, string>
  quantity: number
  orderTitle: string
}): Promise<{ success: boolean; swadpiaOrderNumber?: string; orderNumber?: string; error?: string }> {
  const { data: product } = await supabase
    .from('print_products')
    .select('id, name_ko, name_en')
    .eq('slug', params.productSlug)
    .single()

  if (!product) {
    return { success: false, error: `${params.productSlug} 상품 없음` }
  }

  const { data: order, error: orderErr } = await supabase
    .from('print_orders')
    .insert({
      customer_email: 'batch-test@procardcrafters.com',
      customer_name: `배치테스트-${params.label}`,
      customer_phone: '010-0000-0000',
      shipping_name: 'Batch Test',
      shipping_address_line1: '123 Test St',
      shipping_city: 'Los Angeles',
      shipping_state: 'CA',
      shipping_country: 'US',
      shipping_postal_code: '90001',
      subtotal_usd: 29.99,
      shipping_usd: 5.99,
      total_usd: 35.98,
      exchange_rate_krw_usd: 1380.00,
      status: 'paid',
      notes: `배치 발주 테스트 — ${params.label}`,
    })
    .select('id, order_number')
    .single()

  if (orderErr || !order) {
    return { success: false, error: `주문 생성 실패: ${orderErr?.message}` }
  }

  const { data: item } = await supabase
    .from('print_order_items')
    .insert({
      order_id: order.id,
      product_id: product.id,
      product_name_ko: product.name_ko,
      product_name_en: product.name_en,
      selected_options: params.options,
      quantity: params.quantity,
      unit_price_usd: 29.99,
      subtotal_usd: 29.99,
    })
    .select('id')
    .single()

  if (!item) {
    return { success: false, error: '아이템 생성 실패', orderNumber: order.order_number }
  }

  // 파일 업로드
  const testPdf = createTestPdf(params.label)
  const fileBuffer = fs.readFileSync(testPdf)
  const safeFileName = params.label.replace(/[^a-zA-Z0-9-]/g, '-')
  const storagePath = `print-files/${order.id}/test-${safeFileName}.pdf`

  const { error: uploadErr } = await supabase.storage
    .from('print-assets')
    .upload(storagePath, fileBuffer, { contentType: 'application/pdf', upsert: true })

  fs.unlinkSync(testPdf)

  if (uploadErr) {
    return { success: false, error: `파일 업로드 실패: ${uploadErr.message}`, orderNumber: order.order_number }
  }

  await supabase.from('print_files').insert({
    order_id: order.id,
    order_item_id: item.id,
    storage_path: storagePath,
    original_filename: `test-${safeFileName}.pdf`,
    file_size_bytes: fileBuffer.length,
    mime_type: 'application/pdf',
    status: 'approved',
  })

  // 공장 발주 큐 등록 (placing으로 직접)
  const { data: factoryOrder } = await supabase
    .from('print_factory_orders')
    .insert({
      print_order_id: order.id,
      print_order_item_id: item.id,
      status: 'placing',
      category_code: SLUG_TO_CODE[params.productSlug] ?? 'UNKNOWN',
      options_snapshot: params.options,
      quantity: params.quantity,
      attempt_count: 1,
    })
    .select('id')
    .single()

  // 서명 URL 생성
  const { data: signed } = await supabase.storage
    .from('print-assets')
    .createSignedUrl(storagePath, 3600)

  if (!signed?.signedUrl) {
    return { success: false, error: '서명 URL 생성 실패', orderNumber: order.order_number }
  }

  log(`  파일 서명 URL 생성 완료 (Storage: print-assets/${storagePath.substring(0, 40)}...)`)

  // Playwright 발주
  const result = await placeSwadpiaOrder({
    productSlugOrCategoryCode: params.productSlug,
    selectedOptions: params.options,
    quantity: params.quantity,
    fileUrl: signed.signedUrl,
    orderTitle: `${params.orderTitle}-${order.order_number}`,
  })

  if (factoryOrder) {
    await supabase.from('print_factory_orders').update({
      status: result.success ? 'placed' : 'failed',
      swadpia_order_number: result.swadpiaOrderNumber ?? null,
      checkout_url: result.checkoutUrl ?? null,
      placed_at: result.success ? new Date().toISOString() : null,
      last_error: result.success ? null : (result.errorMessage ?? null),
      failed_at: result.success ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', factoryOrder.id)
  }

  if (result.success) {
    await supabase.from('print_orders')
      .update({ status: 'processing' })
      .eq('id', order.id)
  }

  return {
    success: result.success,
    swadpiaOrderNumber: result.swadpiaOrderNumber,
    orderNumber: order.order_number,
    error: result.errorMessage,
  }
}

// ─── Main ────────────────────────────────────────────────────
async function main() {
  logSection('파일 검증 + 배치 발주 테스트')

  await verifyPreviousFile()

  // ─── 명함 옵션 5가지 ───────────────────────────────────────
  logSection('명함(business-cards) 다양한 옵션 5건 발주')

  const cardOrders = [
    {
      label: 'card-snw250-양면-500-86x52',
      productSlug: 'business-cards',
      options: { paper_code: 'SNW250W00', print_color_type: 'CTN40', size_type: 'SZT10', paper_size: 'N0200', order_count: '1' },
      quantity: 500,
      orderTitle: 'BC-SNW250-양면-500-86x52',
    },
    {
      label: 'card-snw250-단면-500',
      productSlug: 'business-cards',
      options: { paper_code: 'SNW250W00', print_color_type: 'CTN10', size_type: 'SZT10', paper_size: 'N0100', order_count: '1' },
      quantity: 500,
      orderTitle: 'BC-SNW250-단면-500',
    },
    {
      label: 'card-snw250-양면-1000',
      productSlug: 'business-cards',
      options: { paper_code: 'SNW250W00', print_color_type: 'CTN40', size_type: 'SZT10', paper_size: 'N0100', order_count: '1' },
      quantity: 1000,
      orderTitle: 'BC-SNW250-양면-1000',
    },
    {
      label: 'card-snw300-양면-500',
      productSlug: 'business-cards',
      options: { paper_code: 'SNW300W00', print_color_type: 'CTN40', size_type: 'SZT10', paper_size: 'N0100', order_count: '1' },
      quantity: 500,
      orderTitle: 'BC-SNW300-양면-500',
    },
    {
      label: 'card-snw300-양면-1500',
      productSlug: 'business-cards',
      options: { paper_code: 'SNW300W00', print_color_type: 'CTN40', size_type: 'SZT10', paper_size: 'N0100', order_count: '1' },
      quantity: 1500,
      orderTitle: 'BC-SNW300-양면-1500',
    },
  ]

  const cardResults: Array<{ label: string; result: Awaited<ReturnType<typeof runOrder>> }> = []
  for (const order of cardOrders) {
    log(`\n► ${order.orderTitle}`)
    const result = await runOrder(order).catch(e => ({
      success: false as const,
      error: e instanceof Error ? e.message : String(e),
    }))
    cardResults.push({ label: order.label, result })
    if (result.success) {
      log(`  ✓ 성원 주문번호: ${result.swadpiaOrderNumber}`)
    } else {
      log(`  ✗ 실패: ${result.error}`)
    }
  }

  // ─── 다른 제품 5종 ─────────────────────────────────────────
  logSection('다른 제품 5종 각 1건 발주')

  const productOrders = [
    {
      // 스티커: paper_code=STK075AT0, print_color_type=SPD10, qty=500 (size_type select 없음)
      label: 'sticker-art75-500',
      productSlug: 'stickers',
      options: { paper_code: 'STK075AT0', print_color_type: 'SPD10', order_count: '1' },
      quantity: 500,
      orderTitle: 'Sticker-Art75g-500',
    },
    {
      // 전단지: paper_code=ART090W00, size_type=SZT10, paper_size=A0400, qty=2000
      label: 'flyer-art90-a4-2000',
      productSlug: 'flyers',
      options: { paper_code: 'ART090W00', size_type: 'SZT10', paper_size: 'A0400', order_count: '1' },
      quantity: 2000,
      orderTitle: 'Flyer-Art90g-A4-2000',
    },
    {
      // 브로셔: paper_code=ART100W00, size_type=SZT10, paper_size=A0400, qty=1000
      label: 'brochure-art100-a4-1000',
      productSlug: 'brochures',
      options: { paper_code: 'ART100W00', size_type: 'SZT10', paper_size: 'A0400', order_count: '1' },
      quantity: 1000,
      orderTitle: 'Brochure-Art100g-A4-1000',
    },
    {
      // 엽서: paper_code=SNW120W00, print_color_type=DPD10, size_type=SZT10, paper_size=V0500, qty=200
      label: 'postcard-snw120-200',
      productSlug: 'postcards',
      options: { paper_code: 'SNW120W00', print_color_type: 'DPD10', size_type: 'SZT10', paper_size: 'V0500', order_count: '1' },
      quantity: 200,
      orderTitle: 'Postcard-SNW120g-200',
    },
    {
      // 포스터: paper_code=ART100W00, size_type=SZT10, paper_size=A0300, qty=250
      label: 'poster-art100-a3-250',
      productSlug: 'posters',
      options: { paper_code: 'ART100W00', size_type: 'SZT10', paper_size: 'A0300', order_count: '1' },
      quantity: 250,
      orderTitle: 'Poster-Art100g-A3-250',
    },
  ]

  const productResults: Array<{ label: string; result: Awaited<ReturnType<typeof runOrder>> }> = []
  for (const order of productOrders) {
    log(`\n► ${order.orderTitle}`)
    const result = await runOrder(order).catch(e => ({
      success: false as const,
      error: e instanceof Error ? e.message : String(e),
    }))
    productResults.push({ label: order.label, result })
    if (result.success) {
      log(`  ✓ 성원 주문번호: ${result.swadpiaOrderNumber}`)
    } else {
      log(`  ✗ 실패: ${result.error}`)
    }
  }

  // ─── 최종 요약 ────────────────────────────────────────────
  logSection('최종 결과 요약')

  log('\n[명함 옵션 5건]')
  for (const { label, result } of cardResults) {
    const icon = result.success ? '✓' : '✗'
    const detail = result.success
      ? `성원: ${result.swadpiaOrderNumber} (주문: ${result.orderNumber})`
      : `실패: ${result.error}`
    log(`  ${icon} ${label}: ${detail}`)
  }

  log('\n[다른 제품 5종]')
  for (const { label, result } of productResults) {
    const icon = result.success ? '✓' : '✗'
    const detail = result.success
      ? `성원: ${result.swadpiaOrderNumber} (주문: ${result.orderNumber})`
      : `실패: ${result.error}`
    log(`  ${icon} ${label}: ${detail}`)
  }

  const total = cardResults.length + productResults.length
  const success = [...cardResults, ...productResults].filter(r => r.result.success).length
  log(`\n총 ${total}건 중 ${success}건 성공`)
  log(`성원 미결제 주문 확인: https://www.swadpia.co.kr/mypage/order_unpaid`)
}

main().catch(err => {
  process.stderr.write(`오류: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
