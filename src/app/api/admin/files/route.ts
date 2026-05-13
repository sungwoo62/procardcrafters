import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createServerClient } from '@/lib/supabase'
import { sendFileRejectionEmail } from '@/lib/email'


// List files (admin)
export async function GET(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

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

// Update file status (approve/reject)
export async function PATCH(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const body = await request.json()
  const { fileId, status, rejectionReason, reviewedBy } = body

  if (!fileId || !status) {
    return NextResponse.json({ error: 'fileId and status are required' }, { status: 400 })
  }

  const allowedStatuses = ['uploaded', 'approved', 'rejected', 'processing']
  if (!allowedStatuses.includes(status)) {
    return NextResponse.json({ error: `Allowed statuses: ${allowedStatuses.join(', ')}` }, { status: 400 })
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

  // Send rejection email to customer
  type FileWithRelations = {
    original_filename: string
    print_orders?: { customer_email?: string; customer_name?: string; order_number?: string } | null
  }
  const fileData = data as FileWithRelations
  const customerEmail = fileData.print_orders?.customer_email
  const customerName = fileData.print_orders?.customer_name
  const orderNumber = fileData.print_orders?.order_number

  if (status === 'rejected' && customerEmail && orderNumber) {
    await sendFileRejectionEmail({
      customerEmail,
      customerName: customerName ?? 'Customer',
      orderNumber,
      filename: fileData.original_filename,
      rejectionReason: rejectionReason ?? 'Does not meet print quality standards',
    }).catch(() => null)
  }

  return NextResponse.json({ file: data })
}
