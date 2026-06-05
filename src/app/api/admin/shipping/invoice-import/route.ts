import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createServerClient } from '@/lib/supabase'

// POST /api/admin/shipping/invoice-import
// body: { invoiceNumber, invoiceDate, accountNumber?, totalUsd?, rows: [{ trackingNumber, shipDate?, serviceCode?, weightKg?, chargedUsd, currency?, destinationCountry? }] }
//
// 1) 인보이스 헤더 upsert
// 2) 각 row 를 print_fedex_invoice_lines 에 insert
// 3) tracking_number 로 PCCF print_shipments 조회 → matched / discrepancy / unmatched 판정
//    - matched: 우리가 보낸 + 금액 차이 ≤ \$1
//    - discrepancy: 우리가 보낸 + 금액 차이 > \$1
//    - unmatched: 우리 시스템에 없는 송장번호 → 다른 사업부(Ettiang 등) 발송 가능성
export async function POST(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body?.invoiceNumber || !body?.invoiceDate || !Array.isArray(body?.rows)) {
    return NextResponse.json({ error: 'invoiceNumber, invoiceDate, rows 필수' }, { status: 400 })
  }

  const supabase = createServerClient()

  // 1) 인보이스 upsert
  const { data: invoice, error: invErr } = await supabase
    .from('print_fedex_invoices')
    .upsert({
      invoice_number: body.invoiceNumber,
      invoice_date: body.invoiceDate,
      account_number: body.accountNumber ?? null,
      total_usd: body.totalUsd ?? null,
      uploaded_by: user.email ?? 'admin',
      notes: body.notes ?? null,
    }, { onConflict: 'invoice_number' })
    .select()
    .single()

  if (invErr || !invoice) return NextResponse.json({ error: invErr?.message ?? 'invoice insert failed' }, { status: 500 })

  // 2) 라인 분해 + 매칭
  const trackingNumbers = body.rows
    .map((r: { trackingNumber?: string }) => r.trackingNumber)
    .filter((t: unknown): t is string => typeof t === 'string' && t.length > 0)

  const { data: shipments } = await supabase
    .from('print_shipments')
    .select('id, tracking_number, cost_usd, business_unit')
    .in('tracking_number', trackingNumbers)

  const byTracking = new Map((shipments ?? []).map((s) => [s.tracking_number ?? '', s]))
  const DISCREPANCY_THRESHOLD = 1.0  // \$1 이하 차이는 OK

  const lineInserts = body.rows.map((r: {
    trackingNumber?: string; shipDate?: string; serviceCode?: string;
    weightKg?: number; chargedUsd?: number; currency?: string;
    destinationCountry?: string;
  }) => {
    const tracking = r.trackingNumber ?? ''
    const matched = byTracking.get(tracking)
    const chargedUsd = Number(r.chargedUsd ?? 0)
    let status: 'matched' | 'unmatched' | 'discrepancy' = 'unmatched'
    let costDiff: number | null = null
    if (matched) {
      const ours = Number(matched.cost_usd ?? 0)
      costDiff = Math.round((chargedUsd - ours) * 100) / 100
      status = Math.abs(costDiff) <= DISCREPANCY_THRESHOLD ? 'matched' : 'discrepancy'
    }
    return {
      invoice_id: invoice.id,
      tracking_number: tracking,
      ship_date: r.shipDate ?? null,
      service_code: r.serviceCode ?? null,
      weight_kg: r.weightKg ?? null,
      charged_usd: chargedUsd,
      currency: r.currency ?? 'USD',
      destination_country: r.destinationCountry ?? null,
      matched_shipment_id: matched?.id ?? null,
      match_status: status,
      cost_diff_usd: costDiff,
      raw_data: r,
    }
  })

  // 기존 라인 삭제 후 재삽입 (idempotent)
  await supabase.from('print_fedex_invoice_lines').delete().eq('invoice_id', invoice.id)
  const { error: lineErr } = await supabase.from('print_fedex_invoice_lines').insert(lineInserts)
  if (lineErr) return NextResponse.json({ error: lineErr.message }, { status: 500 })

  const stats = {
    total: lineInserts.length,
    matched: lineInserts.filter((l: { match_status: string }) => l.match_status === 'matched').length,
    discrepancy: lineInserts.filter((l: { match_status: string }) => l.match_status === 'discrepancy').length,
    unmatched: lineInserts.filter((l: { match_status: string }) => l.match_status === 'unmatched').length,
    totalChargedUsd: lineInserts.reduce((s: number, l: { charged_usd: number }) => s + l.charged_usd, 0),
  }

  return NextResponse.json({ invoiceId: invoice.id, ...stats })
}

// GET /api/admin/shipping/invoice-import?invoiceId=...
// 최근 인보이스 목록 또는 특정 인보이스의 라인 상세
export async function GET(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const invoiceId = searchParams.get('invoiceId')
  const supabase = createServerClient()

  if (invoiceId) {
    const [invRes, linesRes] = await Promise.all([
      supabase.from('print_fedex_invoices').select('*').eq('id', invoiceId).maybeSingle(),
      supabase
        .from('print_fedex_invoice_lines')
        .select('*, print_shipments(order_id, business_unit, charged_usd, print_orders(order_number, customer_name))')
        .eq('invoice_id', invoiceId)
        .order('match_status', { ascending: true }),
    ])
    return NextResponse.json({ invoice: invRes.data, lines: linesRes.data ?? [] })
  }

  const { data } = await supabase
    .from('print_fedex_invoices')
    .select('id, invoice_number, invoice_date, account_number, total_usd, created_at')
    .order('invoice_date', { ascending: false })
    .limit(50)
  return NextResponse.json({ invoices: data ?? [] })
}
