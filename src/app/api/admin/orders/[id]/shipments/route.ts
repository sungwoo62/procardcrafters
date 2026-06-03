import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createServerClient } from '@/lib/supabase'
import { quoteShipping } from '@/lib/shipping'
import { logOrderEvent } from '@/lib/order-events'

// GET: 주문에 속한 모든 송장
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { id } = await params
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('print_shipments')
    .select('*, print_shipping_services(code, name_ko, name_en), print_shipping_zones(code, name_ko, name_en)')
    .eq('order_id', id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ shipments: data })
}

// POST: 새 송장 생성 (선택적으로 weight/service 받아 견적 계산)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const supabase = createServerClient()

  // 주문 조회 (국가 → 권역)
  const { data: order, error: orderErr } = await supabase
    .from('print_orders')
    .select('id, shipping_country')
    .eq('id', id)
    .maybeSingle()
  if (orderErr || !order) return NextResponse.json({ error: orderErr?.message ?? 'order not found' }, { status: 404 })

  const weightKg = Number(body.weightKg ?? body.weight_kg ?? 1.0)
  const quote = await quoteShipping(order.shipping_country, weightKg, body.serviceCode)

  // 권역/서비스 id 조회 (송장에 FK 저장)
  const [{ data: zone }, { data: service }] = await Promise.all([
    supabase.from('print_shipping_zones').select('id').eq('code', quote.zoneCode).maybeSingle(),
    quote.serviceCode
      ? supabase.from('print_shipping_services').select('id').eq('code', quote.serviceCode).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const insert = {
    order_id: id,
    service_id: service?.id ?? null,
    zone_id: zone?.id ?? null,
    carrier: body.carrier ?? 'fedex',
    tracking_number: body.trackingNumber ?? null,
    weight_kg: weightKg,
    length_cm: body.lengthCm ?? null,
    width_cm: body.widthCm ?? null,
    height_cm: body.heightCm ?? null,
    cost_usd: quote.baseCostUsd,
    charged_usd: quote.costUsd,
    status: 'pending' as const,
    notes: body.notes ?? null,
  }

  const { data, error } = await supabase
    .from('print_shipments')
    .insert(insert)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logOrderEvent({
    orderId: id,
    eventType: 'shipment_created',
    actor: user.email ?? 'admin',
    metadata: {
      shipment_id: data.id,
      zone_code: quote.zoneCode,
      weight_kg: weightKg,
      cost_usd: quote.baseCostUsd,
      charged_usd: quote.costUsd,
    },
  })

  return NextResponse.json({ shipment: data, quote })
}

// PATCH: 송장 업데이트 (tracking, status, weight 등) - body.shipmentId 필수
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => null)
  if (!body?.shipmentId) return NextResponse.json({ error: 'shipmentId 필수' }, { status: 400 })

  const supabase = createServerClient()
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.trackingNumber !== undefined) update.tracking_number = body.trackingNumber || null
  if (body.weightKg       !== undefined) update.weight_kg = Number(body.weightKg) || null
  if (body.lengthCm       !== undefined) update.length_cm = Number(body.lengthCm) || null
  if (body.widthCm        !== undefined) update.width_cm  = Number(body.widthCm)  || null
  if (body.heightCm       !== undefined) update.height_cm = Number(body.heightCm) || null
  if (body.notes          !== undefined) update.notes = body.notes || null
  if (body.labelStoragePath        !== undefined) update.label_storage_path = body.labelStoragePath
  if (body.packingSlipStoragePath  !== undefined) update.packing_slip_storage_path = body.packingSlipStoragePath

  if (body.status !== undefined) {
    update.status = body.status
    if (body.status === 'in_transit' && !body.shippedAt) update.shipped_at = new Date().toISOString()
    if (body.status === 'delivered'  && !body.deliveredAt) update.delivered_at = new Date().toISOString()
  }
  if (body.shippedAt   !== undefined) update.shipped_at   = body.shippedAt
  if (body.deliveredAt !== undefined) update.delivered_at = body.deliveredAt

  const { data, error } = await supabase
    .from('print_shipments')
    .update(update)
    .eq('id', body.shipmentId)
    .eq('order_id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 송장 상태가 in_transit으로 변경 + tracking_number 있으면 주문도 shipped로 동기화
  if (data.status === 'in_transit' && data.tracking_number) {
    await supabase
      .from('print_orders')
      .update({ status: 'shipped', tracking_number: data.tracking_number, updated_at: new Date().toISOString() })
      .eq('id', id)
    await logOrderEvent({
      orderId: id,
      eventType: 'shipped',
      actor: user.email ?? 'admin',
      newValue: data.tracking_number,
      metadata: {
        shipment_id: data.id,
        tracking_number: data.tracking_number,
        carrier: data.carrier,
      },
    })
  }
  if (data.status === 'delivered') {
    await supabase
      .from('print_orders')
      .update({ status: 'delivered', updated_at: new Date().toISOString() })
      .eq('id', id)
    await logOrderEvent({
      orderId: id,
      eventType: 'delivered',
      actor: user.email ?? 'admin',
      metadata: { shipment_id: data.id },
    })
  }

  return NextResponse.json({ shipment: data })
}
