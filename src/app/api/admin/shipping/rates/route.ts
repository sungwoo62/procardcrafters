import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createServerClient } from '@/lib/supabase'

// GET /api/admin/shipping/rates?serviceId=...&zoneId=...
export async function GET(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const serviceId = searchParams.get('serviceId')
  const zoneId    = searchParams.get('zoneId')

  const supabase = createServerClient()
  let query = supabase
    .from('print_shipping_rates')
    .select('*')
    .order('weight_kg_max', { ascending: true })

  if (serviceId) query = query.eq('service_id', serviceId)
  if (zoneId)    query = query.eq('zone_id', zoneId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ rates: data })
}

/**
 * 일괄 임포트:
 *   { serviceId, replaceExisting?: bool, rows: [{ zoneCode, weightKgMax, rateUsd, effectiveFrom? }, ...] }
 * FedEx 요금표를 권역×무게 매트릭스로 받아 들이는 진입점.
 */
export async function POST(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body?.serviceId || !Array.isArray(body.rows) || body.rows.length === 0) {
    return NextResponse.json({ error: 'serviceId, rows 필수' }, { status: 400 })
  }

  const supabase = createServerClient()

  // 권역 코드 → id 매핑
  const { data: zones, error: zoneErr } = await supabase
    .from('print_shipping_zones')
    .select('id, code')
  if (zoneErr) return NextResponse.json({ error: zoneErr.message }, { status: 500 })

  const zoneByCode = new Map((zones ?? []).map((z) => [z.code, z.id]))
  const today = new Date().toISOString().slice(0, 10)

  const inserts: {
    service_id: string
    zone_id: string
    weight_kg_max: number
    rate_usd: number
    effective_from: string
  }[] = []
  const errors: string[] = []

  for (const r of body.rows) {
    const zoneId = zoneByCode.get(r.zoneCode)
    if (!zoneId) {
      errors.push(`Unknown zone: ${r.zoneCode}`)
      continue
    }
    const w = Number(r.weightKgMax)
    const rate = Number(r.rateUsd)
    if (!Number.isFinite(w) || w <= 0 || !Number.isFinite(rate) || rate < 0) {
      errors.push(`Invalid row: ${JSON.stringify(r)}`)
      continue
    }
    inserts.push({
      service_id: body.serviceId,
      zone_id: zoneId,
      weight_kg_max: w,
      rate_usd: rate,
      effective_from: r.effectiveFrom ?? today,
    })
  }

  if (!inserts.length) {
    return NextResponse.json({ error: 'No valid rows', issues: errors }, { status: 400 })
  }

  if (body.replaceExisting) {
    const { error: delErr } = await supabase
      .from('print_shipping_rates')
      .delete()
      .eq('service_id', body.serviceId)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  const { error: insErr } = await supabase
    .from('print_shipping_rates')
    .upsert(inserts, { onConflict: 'service_id,zone_id,weight_kg_max,effective_from' })

  if (insErr) return NextResponse.json({ error: insErr.message, issues: errors }, { status: 500 })

  return NextResponse.json({ inserted: inserts.length, skipped: errors.length, issues: errors })
}
