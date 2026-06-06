import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createServerClient } from '@/lib/supabase'
import { sendDesignProofEmail } from '@/lib/email'
import { logOrderEvent } from '@/lib/order-events'

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/tiff',
]

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { id } = await params
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('print_design_proofs')
    .select('*')
    .eq('order_id', id)
    .order('version', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const proofsWithUrls = await Promise.all(
    (data ?? []).map(async (proof) => {
      const { data: urlData } = await supabase.storage
        .from('print-assets')
        .createSignedUrl(proof.storage_path, 3600)
      return { ...proof, signed_url: urlData?.signedUrl ?? null }
    })
  )

  return NextResponse.json({ proofs: proofsWithUrls })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { id } = await params
  const supabase = createServerClient()

  const { data: order, error: orderError } = await supabase
    .from('print_orders')
    .select('id, order_number, customer_email, customer_name, status')
    .eq('id', id)
    .single()

  if (orderError || !order) {
    return NextResponse.json({ error: '주문을 찾을 수 없습니다' }, { status: 404 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const adminNote = formData.get('adminNote') as string | null

  if (!file) {
    return NextResponse.json({ error: '파일을 선택해주세요' }, { status: 400 })
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'PDF, PNG, JPG, TIFF 파일만 지원합니다' },
      { status: 400 }
    )
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: '파일 크기는 50MB 이하여야 합니다' },
      { status: 400 }
    )
  }

  const { count } = await supabase
    .from('print_design_proofs')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', id)

  const version = (count ?? 0) + 1

  const arrayBuffer = await file.arrayBuffer()
  const ext = file.name.split('.').pop() ?? 'bin'
  const storagePath = `design-proofs/${order.order_number}/${Date.now()}-v${version}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('print-assets')
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      cacheControl: '3600',
    })

  if (uploadError) {
    return NextResponse.json({ error: `업로드 실패: ${uploadError.message}` }, { status: 500 })
  }

  const { data: proof, error: dbError } = await supabase
    .from('print_design_proofs')
    .insert({
      order_id: id,
      storage_path: storagePath,
      original_filename: file.name,
      file_size_bytes: file.size,
      mime_type: file.type,
      admin_note: adminNote || null,
      status: 'pending',
      version,
      uploaded_by: user.email ?? 'admin',
    })
    .select()
    .single()

  if (dbError) {
    return NextResponse.json({ error: `DB 오류: ${dbError.message}` }, { status: 500 })
  }

  await Promise.allSettled([
    sendDesignProofEmail({
      customerEmail: order.customer_email,
      customerName: order.customer_name,
      orderNumber: order.order_number,
      version,
      adminNote: adminNote || undefined,
    }),
    logOrderEvent({
      orderId: id,
      eventType: 'status_change',
      newValue: `시안 v${version} 업로드`,
      metadata: { proofId: proof.id, filename: file.name },
      actor: user.email ?? 'admin',
    }),
  ])

  return NextResponse.json({ proof })
}
