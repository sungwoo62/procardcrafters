import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { Resend } from 'resend'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY ?? '')
}

function verifyAdmin(request: NextRequest): boolean {
  return request.headers.get('x-admin-secret') === process.env.ADMIN_SECRET
}

// List files (admin)
export async function GET(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

// Update file status (approve/reject)
export async function PATCH(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

  // Send email notification to customer
  const customerEmail = (data as Record<string, unknown> & { print_orders?: { customer_email?: string; customer_name?: string; order_number?: string } })?.print_orders?.customer_email
  const customerName = (data as Record<string, unknown> & { print_orders?: { customer_name?: string } })?.print_orders?.customer_name
  const orderNumber = (data as Record<string, unknown> & { print_orders?: { order_number?: string } })?.print_orders?.order_number

  if (customerEmail && process.env.RESEND_API_KEY) {
    if (status === 'approved') {
      await getResend().emails.send({
        from: 'Procardcrafters <noreply@procardcrafters.com>',
        to: customerEmail,
        subject: `File Approved — ${orderNumber ?? 'Order'}`,
        html: `
          <p>Hi ${customerName ?? 'Customer'},</p>
          <p>Your print file (<strong>${(data as Record<string, string>).original_filename}</strong>) has passed review.</p>
          <p>Your file has been added to the print queue. We will notify you when production begins.</p>
          <br/>
          <p>Thank you,<br/>Procardcrafters Team</p>
        `,
      }).catch(() => null)  // Silently ignore email send failures
    } else if (status === 'rejected') {
      await getResend().emails.send({
        from: 'Procardcrafters <noreply@procardcrafters.com>',
        to: customerEmail,
        subject: `File Review Result — ${orderNumber ?? 'Order'}`,
        html: `
          <p>Hi ${customerName ?? 'Customer'},</p>
          <p>Your print file (<strong>${(data as Record<string, string>).original_filename}</strong>) was rejected for the following reason:</p>
          <blockquote style="border-left:3px solid #ef4444;padding-left:12px;color:#374151;">
            ${rejectionReason ?? 'Does not meet print quality standards'}
          </blockquote>
          <p>Please update the file and re-upload it from your order page.</p>
          <p>If you have any questions, feel free to reach out.</p>
          <br/>
          <p>Thank you,<br/>Procardcrafters Team</p>
        `,
      }).catch(() => null)
    }
  }

  return NextResponse.json({ file: data })
}
