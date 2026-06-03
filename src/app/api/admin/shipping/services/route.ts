import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createServerClient } from '@/lib/supabase'

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('print_shipping_services')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ services: data })
}

export async function POST(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body?.code || !body?.name_ko) {
    return NextResponse.json({ error: 'code, name_ko 필수' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('print_shipping_services')
    .insert({
      code: body.code,
      name_ko: body.name_ko,
      name_en: body.name_en ?? body.name_ko,
      carrier: body.carrier ?? 'fedex',
      est_days_min: body.est_days_min ?? null,
      est_days_max: body.est_days_max ?? null,
      sort_order: Number(body.sort_order ?? 0),
      is_active: body.is_active !== false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ service: data })
}
