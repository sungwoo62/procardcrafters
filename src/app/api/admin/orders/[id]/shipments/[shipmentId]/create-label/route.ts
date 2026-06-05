// OMO-2371 — FedEx 실제 라벨 생성 (ETD Commercial Invoice 자동 첨부)
//
// 흐름
//   1. shipment + order 조회 (서비스 코드, 배송지)
//   2. createFedexShipment() 호출 — ETD 자동 invoice 첨부 (국제 only)
//   3. PDF 두 개를 Supabase Storage `print-assets` 버킷에 저장
//   4. shipment 업데이트: tracking_number / label_storage_path / invoice_storage_path / status=label_created
//   5. order_event 기록

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createServerClient } from '@/lib/supabase'
import { createFedexShipment } from '@/lib/fedex-api'
import { logOrderEvent } from '@/lib/order-events'

interface OrderItem {
  quantity: number
  unit_price_usd: number
  product_name_en: string
}

function serviceCodeToFedexType(code: string | null | undefined): 'INTERNATIONAL_PRIORITY' | 'INTERNATIONAL_ECONOMY' | 'INTERNATIONAL_PRIORITY_EXPRESS' {
  if (code === 'fedex_ie') return 'INTERNATIONAL_ECONOMY'
  if (code === 'fedex_ipe') return 'INTERNATIONAL_PRIORITY_EXPRESS'
  return 'INTERNATIONAL_PRIORITY'
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string; shipmentId: string }> }) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { id: orderId, shipmentId } = await params
  const supabase = createServerClient()

  const [{ data: order, error: orderErr }, { data: shipment, error: shipErr }, { data: items, error: itemsErr }] = await Promise.all([
    supabase
      .from('print_orders')
      .select('id, order_number, customer_email, customer_phone, shipping_name, shipping_address_line1, shipping_address_line2, shipping_city, shipping_state, shipping_country, shipping_postal_code')
      .eq('id', orderId)
      .maybeSingle(),
    supabase
      .from('print_shipments')
      .select('id, weight_kg, length_cm, width_cm, height_cm, carrier, status, print_shipping_services(code)')
      .eq('id', shipmentId)
      .eq('order_id', orderId)
      .maybeSingle(),
    supabase
      .from('print_order_items')
      .select('quantity, unit_price_usd, product_name_en')
      .eq('order_id', orderId),
  ])

  if (orderErr || !order) return NextResponse.json({ error: orderErr?.message ?? 'order not found' }, { status: 404 })
  if (shipErr  || !shipment) return NextResponse.json({ error: shipErr?.message ?? 'shipment not found' }, { status: 404 })
  if (itemsErr || !items?.length) return NextResponse.json({ error: itemsErr?.message ?? 'order items not found' }, { status: 404 })
  if (shipment.carrier !== 'fedex') return NextResponse.json({ error: 'FedEx 송장만 지원' }, { status: 400 })

  // 운영 안전: 이미 라벨 발급된 송장 재발급 차단 (명시적 재시도가 필요하면 status 를 pending 으로 되돌리고 재호출)
  if (shipment.status !== 'pending') {
    return NextResponse.json({ error: `상태가 pending 이 아닙니다 (현재 ${shipment.status})` }, { status: 409 })
  }

  // 서비스 코드 → FedEx serviceType
  const serviceRow = shipment.print_shipping_services as { code?: string } | { code?: string }[] | null
  const serviceCode = Array.isArray(serviceRow) ? serviceRow[0]?.code : serviceRow?.code
  const serviceType = serviceCodeToFedexType(serviceCode)

  // 통관 commodities — 우리 상품 라인 그대로 매핑
  const totalQty = (items as OrderItem[]).reduce((s, it) => s + it.quantity, 0)
  const commodities = (items as OrderItem[]).map((it) => ({
    description: it.product_name_en || 'Printed marketing materials',
    countryOfManufacture: 'KR',
    quantity: it.quantity,
    quantityUnits: 'PCS',
    unitPriceUsd: Number(it.unit_price_usd),
    customsValueUsd: Number(it.unit_price_usd) * it.quantity,
    weightKg: totalQty > 0 ? (Number(shipment.weight_kg) || 1) * (it.quantity / totalQty) : 1,
    harmonizedCode: '491110', // 인쇄물 일반
    numberOfPieces: it.quantity,
  }))

  let shipResult
  try {
    shipResult = await createFedexShipment({
      serviceType,
      recipient: {
        personName: order.shipping_name,
        phoneNumber: order.customer_phone ?? '0000000000',
        companyName: order.shipping_name,
        streetLines: [order.shipping_address_line1, order.shipping_address_line2].filter((x): x is string => Boolean(x)),
        city: order.shipping_city,
        stateOrProvinceCode: order.shipping_state ?? '',
        postalCode: order.shipping_postal_code,
        countryCode: order.shipping_country,
      },
      packageWeightKg: Number(shipment.weight_kg) || 1,
      packageLengthCm: shipment.length_cm ? Number(shipment.length_cm) : undefined,
      packageWidthCm: shipment.width_cm ? Number(shipment.width_cm) : undefined,
      packageHeightCm: shipment.height_cm ? Number(shipment.height_cm) : undefined,
      customerReference: order.order_number,
      commodities,
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }

  const bucket = supabase.storage.from('print-assets')
  const baseDir = `shipping/${orderId}/${shipmentId}`
  const labelPath = shipResult.labelPdf   ? `${baseDir}/label.pdf`   : null
  const invoicePath = shipResult.invoicePdf ? `${baseDir}/invoice.pdf` : null

  const uploads = await Promise.all([
    shipResult.labelPdf && labelPath
      ? bucket.upload(labelPath, shipResult.labelPdf, { contentType: 'application/pdf', upsert: true })
      : Promise.resolve({ data: null, error: null }),
    shipResult.invoicePdf && invoicePath
      ? bucket.upload(invoicePath, shipResult.invoicePdf, { contentType: 'application/pdf', upsert: true })
      : Promise.resolve({ data: null, error: null }),
  ])
  const uploadError = uploads.find((u) => u.error)?.error
  if (uploadError) return NextResponse.json({ error: `PDF 저장 실패: ${uploadError.message}` }, { status: 500 })

  const { data: updated, error: updateErr } = await supabase
    .from('print_shipments')
    .update({
      tracking_number: shipResult.masterTrackingNumber,
      label_storage_path: labelPath,
      invoice_storage_path: invoicePath,
      status: 'label_created',
      updated_at: new Date().toISOString(),
    })
    .eq('id', shipmentId)
    .select()
    .single()
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  await logOrderEvent({
    orderId,
    eventType: 'shipment_label_created',
    actor: user.email ?? 'admin',
    newValue: shipResult.masterTrackingNumber,
    metadata: {
      shipment_id: shipmentId,
      service_type: shipResult.serviceType,
      label_path: labelPath,
      invoice_path: invoicePath,
      etd_attached: Boolean(invoicePath),
    },
  })

  return NextResponse.json({
    shipment: updated,
    masterTrackingNumber: shipResult.masterTrackingNumber,
    labelPath,
    invoicePath,
    etdAttached: Boolean(invoicePath),
  })
}
