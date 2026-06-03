import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createServerClient } from '@/lib/supabase'

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('print_shipping_config')
    .select('*')
    .eq('id', 1)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ config: data })
}

export async function PATCH(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: '본문 누락' }, { status: 400 })

  const supabase = createServerClient()
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.vat_markup_percent !== undefined) update.vat_markup_percent = Number(body.vat_markup_percent)
  if (body.origin_country !== undefined)     update.origin_country = String(body.origin_country).toUpperCase()
  if (body.default_weight_kg !== undefined)  update.default_weight_kg = Number(body.default_weight_kg)
  if (body.fallback_rate_usd !== undefined)  update.fallback_rate_usd = Number(body.fallback_rate_usd)

  const { data, error } = await supabase
    .from('print_shipping_config')
    .update(update)
    .eq('id', 1)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ config: data })
}
