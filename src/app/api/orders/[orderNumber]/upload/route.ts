// OMO-3028 [OMO-3019-3]: 결제후 파일 업로드 + 제품규격 프리플라이트.
//
// 결제 완료(paid) 주문에 고객이 인쇄 파일을 업로드하면:
//   1) 범용 파일 검증(validateFile) + 2) 제품 규격(print_spec) 대비 프리플라이트(runPreflight)
//   를 수행하고, 결과를 print_files(order_id 연결)에 저장한 뒤 통과/경고를 반환한다.
// 동의 기록은 별도 단계(/consent)에서 수행한다.

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { validateFile } from '@/lib/file-validation'
import { runPreflight } from '@/lib/preflight'
import { DEFAULT_PRINT_SPEC, type PrintSpec } from '@/lib/print-spec'
import { getConsentCopy } from '@/lib/design-consent'
import { logOrderEvent } from '@/lib/order-events'

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/illustrator',
  'application/postscript',
  'image/vnd.adobe.photoshop',
  'image/png',
  'image/jpeg',
  'image/tiff',
]

const MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024 // 200MB

async function sha256Hex(data: ArrayBuffer | string): Promise<string> {
  const buf = typeof data === 'string' ? new TextEncoder().encode(data) : data
  const hashBuffer = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> },
) {
  const { orderNumber } = await params
  const supabase = createServerClient()

  // ── 1. 주문 확인 (결제완료 이상만 업로드 허용) ─────────────────────
  const { data: order } = await supabase
    .from('print_orders')
    .select('id, status')
    .eq('order_number', orderNumber)
    .single()

  if (!order) {
    return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 })
  }
  if (order.status === 'pending') {
    return NextResponse.json(
      { error: '결제 완료 후에 파일을 업로드할 수 있습니다.' },
      { status: 409 },
    )
  }

  // ── 2. 입력 검증 ──────────────────────────────────────────────────
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const orderItemId = (formData.get('orderItemId') as string | null) || null

  if (!file) {
    return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'PDF, AI, PSD, PNG, JPG, TIFF 형식만 지원합니다.' },
      { status: 400 },
    )
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: '파일 크기는 200MB 이하여야 합니다.' }, { status: 400 })
  }

  // ── 3. 대상 주문항목 + 제품 인쇄규격 조회 ─────────────────────────
  const { data: items } = await supabase
    .from('print_order_items')
    .select('id, product_id')
    .eq('order_id', order.id)

  const targetItem = orderItemId
    ? (items ?? []).find((i) => i.id === orderItemId)
    : (items ?? [])[0]

  let spec: PrintSpec = DEFAULT_PRINT_SPEC
  if (targetItem?.product_id) {
    const { data: product } = await supabase
      .from('print_products')
      .select('print_spec')
      .eq('id', targetItem.product_id)
      .single()
    if (product?.print_spec) spec = product.print_spec as PrintSpec
  }

  // ── 4. 검증 + 프리플라이트 ───────────────────────────────────────
  const arrayBuffer = await file.arrayBuffer()
  const validation = await validateFile(arrayBuffer, file.type)

  if (!validation.isValid) {
    return NextResponse.json(
      {
        error: '파일을 읽을 수 없습니다. 파일이 손상되었거나 보호되어 있을 수 있습니다.',
        validation: { errors: validation.errors, warnings: validation.warnings },
      },
      { status: 422 },
    )
  }

  const preflight = runPreflight(validation, spec)

  // ── 5. Storage 업로드 ────────────────────────────────────────────
  const ext = file.name.split('.').pop() ?? 'bin'
  const fileHash = await sha256Hex(arrayBuffer)
  const storagePath = `print-files/${order.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('print-assets')
    .upload(storagePath, arrayBuffer, { contentType: file.type, cacheControl: '3600' })

  if (uploadError) {
    return NextResponse.json({ error: `업로드 실패: ${uploadError.message}` }, { status: 500 })
  }

  // ── 6. DB 기록 (order_id 연결 + 프리플라이트 결과) ────────────────
  const { data: fileRecord, error: dbError } = await supabase
    .from('print_files')
    .insert({
      order_id: order.id,
      order_item_id: targetItem?.id ?? null,
      storage_path: storagePath,
      original_filename: file.name,
      file_size_bytes: file.size,
      mime_type: file.type,
      file_hash: fileHash,
      status: 'uploaded',
      validation_result: {
        isValid: validation.isValid,
        warnings: validation.warnings,
        details: validation.details,
      },
      preflight_result: preflight,
    })
    .select('id')
    .single()

  if (dbError) {
    return NextResponse.json({ error: `DB 오류: ${dbError.message}` }, { status: 500 })
  }

  await logOrderEvent({
    orderId: order.id,
    eventType: 'file_uploaded',
    newValue: `${file.name} (프리플라이트: ${preflight.status === 'pass' ? '통과' : '경고'})`,
    metadata: { fileId: fileRecord.id, preflightStatus: preflight.status },
    actor: 'customer',
  }).catch(() => null)

  return NextResponse.json({
    fileId: fileRecord.id,
    preflight,
    consent: getConsentCopy(),
  })
}
