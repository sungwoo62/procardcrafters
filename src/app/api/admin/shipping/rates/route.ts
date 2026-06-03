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
 * 일괄 임포트 — 두 가지 모드:
 *
 *   1. 직접 USD 요금:
 *      { serviceId, mode: 'direct', rows: [{ zoneCode, weightKgMax, rateUsd, effectiveFrom? }, ...] }
 *
 *   2. 할인 + list price 기반 (FedEx PricingAgreement):
 *      { serviceId, mode: 'contract', rows: [{ zoneCode, weightKgMax, discountPct, listRateKrw?, effectiveFrom? }, ...] }
 *      list_rate_krw 는 추후 FedEx Service Guide 에서 별도 임포트 가능
 *
 * replaceExisting=true → 해당 서비스의 모든 기존 행 삭제 후 신규 입력
 */
export async function POST(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body?.serviceId || !Array.isArray(body.rows) || body.rows.length === 0) {
    return NextResponse.json({ error: 'serviceId, rows 필수' }, { status: 400 })
  }

  const mode: 'direct' | 'contract' = body.mode === 'contract' ? 'contract' : 'direct'
  const supabase = createServerClient()

  const { data: zones, error: zoneErr } = await supabase
    .from('print_shipping_zones')
    .select('id, code')
  if (zoneErr) return NextResponse.json({ error: zoneErr.message }, { status: 500 })

  const zoneByCode = new Map((zones ?? []).map((z) => [z.code, z.id]))
  const today = new Date().toISOString().slice(0, 10)

  const inserts: Record<string, unknown>[] = []
  const errors: string[] = []

  for (const r of body.rows) {
    const zoneId = zoneByCode.get(r.zoneCode)
    if (!zoneId) { errors.push(`Unknown zone: ${r.zoneCode}`); continue }
    const w = Number(r.weightKgMax)
    if (!Number.isFinite(w) || w <= 0) { errors.push(`Invalid weight: ${JSON.stringify(r)}`); continue }

    if (mode === 'contract') {
      const discount = Number(r.discountPct)
      if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
        errors.push(`Invalid discount: ${JSON.stringify(r)}`); continue
      }
      inserts.push({
        service_id: body.serviceId,
        zone_id: zoneId,
        weight_kg_max: w,
        discount_pct: discount,
        list_rate_krw: r.listRateKrw != null && Number.isFinite(Number(r.listRateKrw)) ? Number(r.listRateKrw) : null,
        rate_usd: 0,
        effective_from: r.effectiveFrom ?? today,
      })
    } else {
      const rate = Number(r.rateUsd)
      if (!Number.isFinite(rate) || rate < 0) { errors.push(`Invalid rateUsd: ${JSON.stringify(r)}`); continue }
      inserts.push({
        service_id: body.serviceId,
        zone_id: zoneId,
        weight_kg_max: w,
        rate_usd: rate,
        effective_from: r.effectiveFrom ?? today,
      })
    }
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

  return NextResponse.json({ inserted: inserts.length, skipped: errors.length, issues: errors, mode })
}
