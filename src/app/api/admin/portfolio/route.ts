import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

function verifyAdmin(request: NextRequest): boolean {
  const secret = request.headers.get('x-admin-secret')
  return secret === process.env.ADMIN_SECRET
}

export async function GET(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('print_portfolio')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ items: data })
}

export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
  }

  const body = await request.json()
  const { title, description, category, image_url, thumbnail_url, tags, is_featured, is_published, sort_order } = body

  if (!title || !category || !image_url) {
    return NextResponse.json({ error: 'Required fields missing' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('print_portfolio')
    .insert({
      title,
      description: description || null,
      category,
      image_url,
      thumbnail_url: thumbnail_url || null,
      tags: tags ?? [],
      is_featured: is_featured ?? false,
      is_published: is_published ?? true,
      sort_order: sort_order ?? 0,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ item: data }, { status: 201 })
}
