import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createServerClient } from '@/lib/supabase'

// GET /api/admin/shipping/reconciliation?from=YYYY-MM-DD&to=YYYY-MM-DD&format=json|csv&unit=pccf
export async function GET(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from') ?? defaultFrom()
  const to   = searchParams.get('to')   ?? defaultTo()
  const unit = searchParams.get('unit') ?? 'pccf'
  const format = searchParams.get('format') ?? 'json'

  const supabase = createServerClient()
  const { data: shipments, error } = await supabase
    .from('print_shipments')
    .select(`
      id, tracking_number, carrier, weight_kg,
      cost_usd, charged_usd, status, business_unit,
      shipped_at, created_at,
      print_orders(order_number, customer_name, shipping_country, shipping_city, shipping_postal_code),
      print_shipping_zones(code, name_en),
      print_shipping_services(code, name_en)
    `)
    .eq('business_unit', unit)
    .gte('created_at', from)
    .lte('created_at', to + 'T23:59:59')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (shipments ?? []).map((s) => {
    const order = Array.isArray(s.print_orders) ? s.print_orders[0] : s.print_orders
    const zone = Array.isArray(s.print_shipping_zones) ? s.print_shipping_zones[0] : s.print_shipping_zones
    const service = Array.isArray(s.print_shipping_services) ? s.print_shipping_services[0] : s.print_shipping_services
    return {
      shipmentId: s.id,
      orderNumber: order?.order_number ?? null,
      customer: order?.customer_name ?? null,
      destinationCountry: order?.shipping_country ?? null,
      destinationCity: order?.shipping_city ?? null,
      destinationPostal: order?.shipping_postal_code ?? null,
      trackingNumber: s.tracking_number,
      carrier: s.carrier,
      serviceCode: service?.code ?? null,
      serviceName: service?.name_en ?? null,
      zoneCode: zone?.code ?? null,
      weightKg: Number(s.weight_kg ?? 0),
      costUsd: Number(s.cost_usd ?? 0),      // 우리 추정 원가
      chargedUsd: Number(s.charged_usd ?? 0), // 고객 청구액
      status: s.status,
      businessUnit: s.business_unit,
      shippedAt: s.shipped_at,
      createdAt: s.created_at,
    }
  })

  const summary = {
    totalShipments: rows.length,
    totalEstimatedCostUsd: round2(rows.reduce((s, r) => s + r.costUsd, 0)),
    totalChargedUsd: round2(rows.reduce((s, r) => s + r.chargedUsd, 0)),
    avgWeightKg: rows.length ? round2(rows.reduce((s, r) => s + r.weightKg, 0) / rows.length) : 0,
    byCountry: countBy(rows, 'destinationCountry'),
    byStatus: countBy(rows, 'status'),
    byCarrier: countBy(rows, 'carrier'),
    period: { from, to, unit },
  }

  if (format === 'csv') {
    const csv = toCsv(rows)
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="pccf-shipments_${from}_to_${to}.csv"`,
      },
    })
  }

  return NextResponse.json({ summary, rows })
}

function defaultFrom() {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  d.setDate(1)
  return d.toISOString().slice(0, 10)
}
function defaultTo() {
  return new Date().toISOString().slice(0, 10)
}
function round2(n: number) { return Math.round(n * 100) / 100 }
function countBy<T extends Record<string, unknown>>(rows: T[], key: keyof T): Record<string, number> {
  const m: Record<string, number> = {}
  for (const r of rows) {
    const k = String(r[key] ?? '—')
    m[k] = (m[k] ?? 0) + 1
  }
  return m
}
function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ''
  const keys = Object.keys(rows[0])
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = keys.join(',')
  const lines = rows.map((r) => keys.map((k) => escape(r[k])).join(','))
  return [header, ...lines].join('\n')
}
