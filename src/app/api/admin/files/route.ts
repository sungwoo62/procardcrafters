import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

function verifyAdmin(request: NextRequest): boolean {
  return request.headers.get('x-admin-secret') === process.env.ADMIN_SECRET
}

// 파일 목록 조회 (관리자)
export async function GET(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const limit = 20
  const offset = (page - 1) * limit

  const supabase = createServerClient()

  let query = supabase
    .from('print_files')
    .select('*, print_order_items!left(order_id, product_name_en), print_orders!left(order_number, customer_name, customer_email)', { count: 'exact' })
    .order('uploaded_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    files: data ?? [],
    total: count ?? 0,
    page,
    totalPages: Math.ceil((count ?? 0) / limit),
  })
}

// 파일 상태 업데이트 (승인/거부)
export async function PATCH(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 401 })
  }

  const body = await request.json()
  const { fileId, status, rejectionReason, reviewedBy } = body

  if (!fileId || !status) {
    return NextResponse.json({ error: 'fileId, status 필수' }, { status: 400 })
  }

  const allowedStatuses = ['uploaded', 'approved', 'rejected', 'processing']
  if (!allowedStatuses.includes(status)) {
    return NextResponse.json({ error: `허용된 상태: ${allowedStatuses.join(', ')}` }, { status: 400 })
  }

  const supabase = createServerClient()

  const updateData: Record<string, unknown> = {
    status,
    reviewed_at: new Date().toISOString(),
    reviewed_by: reviewedBy ?? 'admin',
  }

  if (status === 'rejected' && rejectionReason) {
    updateData.rejection_reason = rejectionReason
  }

  const { data, error } = await supabase
    .from('print_files')
    .update(updateData)
    .eq('id', fileId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ file: data })
}
