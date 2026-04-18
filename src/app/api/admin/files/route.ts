import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

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
    .select(`
      *,
      print_order_items!left(order_id),
      print_orders!left(customer_email, customer_name, order_number)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 고객에게 이메일 알림 발송
  const customerEmail = (data as Record<string, unknown> & { print_orders?: { customer_email?: string; customer_name?: string; order_number?: string } })?.print_orders?.customer_email
  const customerName = (data as Record<string, unknown> & { print_orders?: { customer_name?: string } })?.print_orders?.customer_name
  const orderNumber = (data as Record<string, unknown> & { print_orders?: { order_number?: string } })?.print_orders?.order_number

  if (customerEmail && process.env.RESEND_API_KEY) {
    if (status === 'approved') {
      await resend.emails.send({
        from: 'Procardcrafters <noreply@procardcrafters.com>',
        to: customerEmail,
        subject: `파일 승인 완료 — ${orderNumber ?? '주문'}`,
        html: `
          <p>안녕하세요, ${customerName ?? '고객'}님</p>
          <p>업로드하신 인쇄 파일(<strong>${(data as Record<string, string>).original_filename}</strong>)이 검토를 통과했습니다.</p>
          <p>파일이 인쇄 대기 큐에 등록되었습니다. 생산이 시작되면 별도로 알려드리겠습니다.</p>
          <br/>
          <p>감사합니다,<br/>Procardcrafters 팀</p>
        `,
      }).catch(() => null)  // 이메일 전송 실패 시 조용히 무시
    } else if (status === 'rejected') {
      await resend.emails.send({
        from: 'Procardcrafters <noreply@procardcrafters.com>',
        to: customerEmail,
        subject: `파일 검토 결과 안내 — ${orderNumber ?? '주문'}`,
        html: `
          <p>안녕하세요, ${customerName ?? '고객'}님</p>
          <p>업로드하신 인쇄 파일(<strong>${(data as Record<string, string>).original_filename}</strong>)이 다음 사유로 반려되었습니다:</p>
          <blockquote style="border-left:3px solid #ef4444;padding-left:12px;color:#374151;">
            ${rejectionReason ?? '인쇄 품질 기준 미충족'}
          </blockquote>
          <p>파일을 수정한 후 주문 페이지에서 다시 업로드해 주시기 바랍니다.</p>
          <p>문의 사항이 있으시면 언제든지 연락주세요.</p>
          <br/>
          <p>감사합니다,<br/>Procardcrafters 팀</p>
        `,
      }).catch(() => null)
    }
  }

  return NextResponse.json({ file: data })
}
