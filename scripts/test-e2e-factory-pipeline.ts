/**
 * E2E 공장 발주 파이프라인 테스트
 *
 * 고객 주문 → 파일 업로드(Supabase Storage) → 결제 → 공장 발주 큐 → Swadpia 자동 발주
 * 전체 흐름을 시뮬레이션한다.
 *
 * 실행:
 *   node --experimental-strip-types --env-file=.env.local scripts/test-e2e-factory-pipeline.ts
 *
 * 환경변수 필요:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   SWADPIA_USERNAME, SWADPIA_PASSWORD
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import { placeSwadpiaOrder, type FactoryOrderRecord } from '../src/lib/swadpia-order'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY) {
  process.stderr.write('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수 없음\n')
  process.exit(1)
}
if (!process.env.SWADPIA_USERNAME || !process.env.SWADPIA_PASSWORD) {
  process.stderr.write('SWADPIA_USERNAME / SWADPIA_PASSWORD 환경변수 없음\n')
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

// ─── 테스트 PDF 생성 ─────────────────────────────────────────

function createTestPdf(label: string): string {
  const dir = path.join(import.meta.dirname ?? __dirname, 'test-artifacts')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  const filePath = path.join(dir, `test-${label}-${Date.now()}.pdf`)
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

// ─── Step 1: 고객 주문 시뮬레이션 ───────────────────────────

async function simulateCustomerOrder(): Promise<{ orderId: string; orderNumber: string; itemId: string }> {
  logSection('Step 1: 고객 주문 생성 (시뮬레이션)')

  // 상품 조회 (business-cards)
  const { data: product } = await supabase
    .from('print_products')
    .select('id, name_ko, name_en')
    .eq('slug', 'business-cards')
    .single()

  if (!product) {
    throw new Error('print_products에 business-cards 상품이 없음 — seed 데이터 필요')
  }

  log(`상품: ${product.name_ko} (${product.name_en})`)

  // 주문 생성
  const { data: order, error: orderError } = await supabase
    .from('print_orders')
    .insert({
      customer_email: 'e2e-test@procardcrafters.com',
      customer_name: 'E2E 테스트 고객',
      customer_phone: '010-0000-0000',
      shipping_name: 'E2E Test',
      shipping_address_line1: '123 Test Street',
      shipping_city: 'Los Angeles',
      shipping_state: 'CA',
      shipping_country: 'US',
      shipping_postal_code: '90001',
      subtotal_usd: 29.99,
      shipping_usd: 5.99,
      total_usd: 35.98,
      exchange_rate_krw_usd: 1380.00,
      status: 'pending',
      notes: 'E2E 파이프라인 테스트 — 자동 삭제 가능',
    })
    .select('id, order_number')
    .single()

  if (orderError || !order) {
    throw new Error(`주문 생성 실패: ${orderError?.message}`)
  }

  log(`주문 생성 완료: ${order.order_number} (${order.id})`)

  // 주문 아이템 생성
  const { data: item, error: itemError } = await supabase
    .from('print_order_items')
    .insert({
      order_id: order.id,
      product_id: product.id,
      product_name_ko: product.name_ko,
      product_name_en: product.name_en,
      selected_options: {
        paper_code: 'SNW250W00',
        print_color_type: 'CTN40',
        size_type: 'SZT10',
        paper_size: 'N0100',
        order_count: '1',
      },
      quantity: 500,
      unit_price_usd: 29.99,
      subtotal_usd: 29.99,
    })
    .select('id')
    .single()

  if (itemError || !item) {
    throw new Error(`주문 아이템 생성 실패: ${itemError?.message}`)
  }

  log(`주문 아이템 생성 완료: ${item.id}`)

  return { orderId: order.id, orderNumber: order.order_number, itemId: item.id }
}

// ─── Step 2: 파일 업로드 (Supabase Storage) ─────────────────

async function uploadFileToStorage(
  orderId: string,
  itemId: string,
  localFilePath: string,
): Promise<string> {
  logSection('Step 2: 파일 업로드 (Supabase Storage)')

  const fileName = path.basename(localFilePath)
  const storagePath = `print-files/${orderId}/${fileName}`

  const fileBuffer = fs.readFileSync(localFilePath)

  const { error: uploadError } = await supabase
    .storage
    .from('print-assets')
    .upload(storagePath, fileBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (uploadError) {
    throw new Error(`Storage 업로드 실패: ${uploadError.message}`)
  }

  log(`Storage 업로드 완료: print-assets/${storagePath}`)

  // print_files 레코드 생성
  const { error: fileRecordError } = await supabase
    .from('print_files')
    .insert({
      order_id: orderId,
      order_item_id: itemId,
      storage_path: storagePath,
      original_filename: fileName,
      file_size_bytes: fileBuffer.length,
      mime_type: 'application/pdf',
      status: 'approved',
    })

  if (fileRecordError) {
    throw new Error(`print_files 레코드 생성 실패: ${fileRecordError.message}`)
  }

  log(`print_files 레코드 생성 완료 (status: approved)`)

  // 서명 URL 테스트
  const { data: signed } = await supabase
    .storage
    .from('print-assets')
    .createSignedUrl(storagePath, 3600)

  if (signed?.signedUrl) {
    log(`서명 URL 생성 확인: ${signed.signedUrl.substring(0, 80)}...`)
  }

  return storagePath
}

// ─── Step 3: 결제 완료 시뮬레이션 ───────────────────────────

async function simulatePayment(orderId: string): Promise<void> {
  logSection('Step 3: 결제 완료 시뮬레이션')

  const { error } = await supabase
    .from('print_orders')
    .update({
      status: 'paid',
      stripe_payment_intent_id: `pi_e2e_test_${Date.now()}`,
    })
    .eq('id', orderId)

  if (error) {
    throw new Error(`결제 상태 업데이트 실패: ${error.message}`)
  }

  log(`주문 상태 → paid`)

  // 이벤트 로그
  await supabase.from('print_order_events').insert({
    order_id: orderId,
    event_type: 'payment_received',
    new_value: 'paid',
    metadata: { source: 'e2e_test', amount_usd: 35.98 },
    actor: 'e2e_test',
  })

  log(`이벤트 로그: payment_received`)
}

// ─── Step 4: 공장 발주 큐 등록 ──────────────────────────────

async function queueFactoryOrder(
  orderId: string,
  itemId: string,
): Promise<string> {
  logSection('Step 4: 공장 발주 큐 등록')

  const { data: item } = await supabase
    .from('print_order_items')
    .select('id, product_name_en, selected_options, quantity')
    .eq('id', itemId)
    .single()

  if (!item) {
    throw new Error('주문 아이템 조회 실패')
  }

  // factory-queue.ts의 toCategoryCode 로직 재현
  const slug = item.product_name_en.toLowerCase().replace(/\s+/g, '-')
  const SLUG_TO_CATEGORY: Record<string, string> = {
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
  const categoryCode = SLUG_TO_CATEGORY[slug] ?? 'UNKNOWN'

  const { data: factoryOrder, error } = await supabase
    .from('print_factory_orders')
    .insert({
      print_order_id: orderId,
      print_order_item_id: itemId,
      status: 'pending',
      category_code: categoryCode,
      options_snapshot: item.selected_options ?? {},
      quantity: item.quantity,
    })
    .select('id')
    .single()

  if (error || !factoryOrder) {
    throw new Error(`공장 발주 큐 등록 실패: ${error?.message}`)
  }

  log(`공장 발주 큐 등록 완료: ${factoryOrder.id}`)
  log(`  카테고리: ${categoryCode}`)
  log(`  옵션: ${JSON.stringify(item.selected_options)}`)
  log(`  수량: ${item.quantity}`)

  return factoryOrder.id
}

// ─── Step 5: Swadpia 자동 발주 (place-factory-orders 로직) ──

async function processFactoryOrder(factoryOrderId: string): Promise<void> {
  logSection('Step 5: Swadpia 자동 발주 실행')

  // pending 발주 조회
  const { data: record, error } = await supabase
    .from('print_factory_orders')
    .select('*')
    .eq('id', factoryOrderId)
    .single()

  if (error || !record) {
    throw new Error(`발주 레코드 조회 실패: ${error?.message}`)
  }

  const factoryRecord = record as FactoryOrderRecord

  // placing으로 잠금
  await supabase
    .from('print_factory_orders')
    .update({
      status: 'placing',
      attempt_count: factoryRecord.attempt_count + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', factoryOrderId)

  log(`발주 상태 → placing (시도 ${factoryRecord.attempt_count + 1}회)`)

  // 파일 URL 결정 (place-factory-orders.ts의 resolveFileUrl 로직)
  let fileUrl: string | null = factoryRecord.file_url

  if (!fileUrl && factoryRecord.print_order_item_id) {
    const { data: files } = await supabase
      .from('print_files')
      .select('storage_path')
      .eq('order_item_id', factoryRecord.print_order_item_id)
      .in('status', ['approved', 'uploaded'])
      .limit(1)

    if (files && files.length > 0) {
      const { data: signed } = await supabase
        .storage
        .from('print-assets')
        .createSignedUrl(files[0].storage_path, 3600)
      fileUrl = signed?.signedUrl ?? null
    }
  }

  if (!fileUrl) {
    // 주문 전체에서 파일 조회
    const { data: files } = await supabase
      .from('print_files')
      .select('storage_path')
      .eq('order_id', factoryRecord.print_order_id)
      .in('status', ['approved', 'uploaded'])
      .limit(1)

    if (files && files.length > 0) {
      const { data: signed } = await supabase
        .storage
        .from('print-assets')
        .createSignedUrl(files[0].storage_path, 3600)
      fileUrl = signed?.signedUrl ?? null
    }
  }

  if (!fileUrl) {
    await supabase
      .from('print_factory_orders')
      .update({ status: 'failed', last_error: '인쇄 파일 URL을 찾을 수 없음', failed_at: new Date().toISOString() })
      .eq('id', factoryOrderId)
    throw new Error('인쇄 파일 URL을 찾을 수 없음')
  }

  log(`파일 URL 확인: ${fileUrl.substring(0, 80)}...`)

  // Playwright 발주 실행
  log(`\nPlaywright 발주 시작...`)
  const result = await placeSwadpiaOrder({
    productSlugOrCategoryCode: factoryRecord.category_code,
    selectedOptions: factoryRecord.options_snapshot,
    quantity: factoryRecord.quantity,
    fileUrl,
    orderTitle: `E2E테스트-${factoryRecord.print_order_id.substring(0, 8)}`,
  })

  if (result.success) {
    await supabase
      .from('print_factory_orders')
      .update({
        status: 'placed',
        swadpia_order_number: result.swadpiaOrderNumber ?? null,
        checkout_url: result.checkoutUrl ?? null,
        placed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', factoryOrderId)

    // 주문 상태 processing으로 전환
    await supabase
      .from('print_orders')
      .update({ status: 'processing' })
      .eq('id', factoryRecord.print_order_id)
      .eq('status', 'paid')

    log(`\n발주 완료!`)
    log(`  Swadpia 주문번호: ${result.swadpiaOrderNumber ?? '(파싱 불가)'}`)
    if (result.checkoutUrl) log(`  결제 URL: ${result.checkoutUrl}`)
  } else {
    await supabase
      .from('print_factory_orders')
      .update({
        status: 'failed',
        last_error: result.errorMessage ?? '알 수 없는 오류',
        failed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', factoryOrderId)

    throw new Error(`Swadpia 발주 실패: ${result.errorMessage}`)
  }
}

// ─── Step 6: 결과 검증 ──────────────────────────────────────

async function verifyResults(orderId: string, factoryOrderId: string): Promise<void> {
  logSection('Step 6: 결과 검증')

  const { data: order } = await supabase
    .from('print_orders')
    .select('order_number, status')
    .eq('id', orderId)
    .single()

  const { data: factoryOrder } = await supabase
    .from('print_factory_orders')
    .select('status, swadpia_order_number, checkout_url, attempt_count')
    .eq('id', factoryOrderId)
    .single()

  log(`주문 상태: ${order?.status} (기대: processing)`)
  log(`공장 발주 상태: ${factoryOrder?.status} (기대: placed)`)
  log(`Swadpia 주문번호: ${factoryOrder?.swadpia_order_number ?? '없음'}`)
  log(`시도 횟수: ${factoryOrder?.attempt_count}회`)

  const passed =
    order?.status === 'processing' &&
    factoryOrder?.status === 'placed' &&
    !!factoryOrder?.swadpia_order_number

  if (passed) {
    log(`\n✓ E2E 파이프라인 테스트 성공!`)
  } else {
    log(`\n✗ 일부 검증 실패 — 위 상태 확인 필요`)
  }
}

// ─── 정리 (테스트 데이터 삭제) ───────────────────────────────

async function cleanup(orderId: string, storagePath: string): Promise<void> {
  logSection('정리: 테스트 데이터 삭제')

  // Storage 파일 삭제
  await supabase.storage.from('print-assets').remove([storagePath])
  log(`Storage 파일 삭제: ${storagePath}`)

  // DB 레코드 삭제 (CASCADE로 items, files, factory_orders, events 함께 삭제)
  await supabase.from('print_orders').delete().eq('id', orderId)
  log(`DB 레코드 삭제 완료 (CASCADE)`)
}

// ─── Main ────────────────────────────────────────────────────

async function main() {
  logSection('E2E 공장 발주 파이프라인 테스트')
  log('흐름: 고객 주문 → 파일 업로드 → 결제 → 큐 등록 → Swadpia 발주\n')

  let orderId = ''
  let storagePath = ''

  try {
    // Step 1: 고객 주문 생성
    const { orderId: oid, orderNumber, itemId } = await simulateCustomerOrder()
    orderId = oid

    // Step 2: 파일 업로드 (Supabase Storage)
    const testPdf = createTestPdf('business-card')
    storagePath = await uploadFileToStorage(orderId, itemId, testPdf)
    fs.unlinkSync(testPdf)

    // Step 3: 결제 완료
    await simulatePayment(orderId)

    // Step 4: 공장 발주 큐 등록
    const factoryOrderId = await queueFactoryOrder(orderId, itemId)

    // Step 5: Swadpia 자동 발주
    await processFactoryOrder(factoryOrderId)

    // Step 6: 결과 검증
    await verifyResults(orderId, factoryOrderId)

    logSection('테스트 완료')
    log(`주문번호: ${orderNumber}`)
    log(`Swadpia 미결제 주문 확인: https://www.swadpia.co.kr/mypage/order_unpaid\n`)

    // 테스트 데이터는 유지 (수동 확인용) — --cleanup 플래그로 삭제 가능
    if (process.argv.includes('--cleanup')) {
      await cleanup(orderId, storagePath)
    } else {
      log('테스트 데이터 유지 중. 삭제하려면 --cleanup 플래그 사용.\n')
    }

  } catch (err) {
    process.stderr.write(`\n오류: ${err instanceof Error ? err.message : String(err)}\n`)

    if (orderId && process.argv.includes('--cleanup-on-error')) {
      await cleanup(orderId, storagePath).catch(() => {})
    }

    process.exit(1)
  }
}

main().catch((err) => {
  process.stderr.write(`치명적 오류: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
