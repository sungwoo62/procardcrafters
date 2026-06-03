import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createServerClient } from '@/lib/supabase'

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('print_shipping_zones')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ zones: data })
}

export async function POST(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body?.code || !body?.name_ko || !body?.name_en) {
    return NextResponse.json({ error: 'code, name_ko, name_en 필수' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('print_shipping_zones')
    .insert({
      code: body.code,
      name_ko: body.name_ko,
      name_en: body.name_en,
      countries: Array.isArray(body.countries) ? body.countries : [],
      sort_order: Number(body.sort_order ?? 0),
      is_active: body.is_active !== false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ zone: data })
}

export async function PATCH(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body?.id) return NextResponse.json({ error: 'id 필수' }, { status: 400 })

  const supabase = createServerClient()
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.name_ko !== undefined) update.name_ko = body.name_ko
  if (body.name_en !== undefined) update.name_en = body.name_en
  if (body.countries !== undefined) update.countries = body.countries
  if (body.sort_order !== undefined) update.sort_order = Number(body.sort_order)
  if (body.is_active !== undefined) update.is_active = !!body.is_active

  const { data, error } = await supabase
    .from('print_shipping_zones')
    .update(update)
    .eq('id', body.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ zone: data })
}
