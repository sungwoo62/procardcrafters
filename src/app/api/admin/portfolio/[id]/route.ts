import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

function verifyAdmin(request: NextRequest): boolean {
  const secret = request.headers.get('x-admin-secret')
  return secret === process.env.ADMIN_SECRET
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()

  // 허용된 필드만 업데이트
  const allowed = ['title', 'description', 'category', 'image_url', 'thumbnail_url', 'tags', 'is_featured', 'is_published', 'sort_order']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: '업데이트할 필드 없음' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('print_portfolio')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ item: data })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 })
  }

  const { id } = await params
  const supabase = createServerClient()
  const { error } = await supabase
    .from('print_portfolio')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
