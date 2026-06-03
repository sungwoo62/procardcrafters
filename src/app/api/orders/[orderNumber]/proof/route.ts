import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { logOrderEvent } from '@/lib/order-events'
import { queueFactoryOrdersForPrintOrder } from '@/lib/factory-queue'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  const { orderNumber } = await params
  const supabase = createServerClient()

  const { data: order } = await supabase
    .from('print_orders')
    .select('id')
    .eq('order_number', orderNumber)
    .single()

  if (!order) {
    return NextResponse.json({ error: '주문을 찾을 수 없습니다' }, { status: 404 })
  }

  const { data: proofs } = await supabase
    .from('print_design_proofs')
    .select('*')
    .eq('order_id', order.id)
    .order('version', { ascending: false })

  const proofsWithUrls = await Promise.all(
    (proofs ?? []).map(async (proof) => {
      const { data: urlData } = await supabase.storage
        .from('print-assets')
        .createSignedUrl(proof.storage_path, 3600)
      return {
        id: proof.id,
        version: proof.version,
        status: proof.status,
        admin_note: proof.admin_note,
        customer_comment: proof.customer_comment,
        original_filename: proof.original_filename,
        uploaded_at: proof.uploaded_at,
        responded_at: proof.responded_at,
        signed_url: urlData?.signedUrl ?? null,
      }
    })
  )

  return NextResponse.json({ proofs: proofsWithUrls })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  const { orderNumber } = await params
  const supabase = createServerClient()

  const { data: order } = await supabase
    .from('print_orders')
    .select('id, order_number, customer_name')
    .eq('order_number', orderNumber)
    .single()

  if (!order) {
    return NextResponse.json({ error: '주문을 찾을 수 없습니다' }, { status: 404 })
  }

  let body: { proofId: string; action: 'approve' | 'revision_requested'; comment?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다' }, { status: 400 })
  }

  const { proofId, action, comment } = body

  if (!proofId || !['approve', 'revision_requested'].includes(action)) {
    return NextResponse.json({ error: 'proofId와 action(approve/revision_requested)이 필요합니다' }, { status: 400 })
  }

  const { data: proof } = await supabase
    .from('print_design_proofs')
    .select('id, status, version')
    .eq('id', proofId)
    .eq('order_id', order.id)
    .single()

  if (!proof) {
    return NextResponse.json({ error: '시안을 찾을 수 없습니다' }, { status: 404 })
  }

  if (proof.status !== 'pending') {
    return NextResponse.json({ error: '이미 응답된 시안입니다' }, { status: 400 })
  }

  const newStatus = action === 'approve' ? 'approved' : 'revision_requested'

  const { data: updated, error } = await supabase
    .from('print_design_proofs')
    .update({
      status: newStatus,
      customer_comment: comment || null,
      responded_at: new Date().toISOString(),
    })
    .eq('id', proofId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const eventDescription = action === 'approve'
    ? `시안 v${proof.version} 고객 승인`
    : `시안 v${proof.version} 수정 요청`

  const tasks: Promise<unknown>[] = [
    logOrderEvent({
      orderId: order.id,
      eventType: 'status_change',
      newValue: eventDescription,
      metadata: {
        proofId,
        action: newStatus,
        ...(comment ? { customerComment: comment } : {}),
      },
      actor: 'customer',
    }).catch(() => null),
  ]

  if (action === 'approve') {
    tasks.push(
      (async () => {
        const { data: items } = await supabase
          .from('print_order_items')
          .select('id, product_name_en, selected_options, quantity')
          .eq('order_id', order.id)
        if (items && items.length > 0) {
          await queueFactoryOrdersForPrintOrder(order.id, items)
        }
      })().catch(() => null)
    )
  }

  await Promise.allSettled(tasks)

  return NextResponse.json({ proof: updated })
}
