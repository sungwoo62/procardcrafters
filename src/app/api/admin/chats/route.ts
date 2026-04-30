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

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const limit = 50
  const offset = (page - 1) * limit

  const supabase = createServerClient()

  // Group by session: last message time + latest estimate info
  const { data: sessions, error: sessErr } = await supabase
    .from('print_chat_logs')
    .select('session_id, created_at, estimate_product, estimate_price_usd')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (sessErr) {
    return NextResponse.json({ error: sessErr.message }, { status: 500 })
  }

  // Deduplicate by session ID (keep most recent record)
  const seen = new Set<string>()
  const uniqueSessions = (sessions ?? []).filter((row) => {
    if (seen.has(row.session_id)) return false
    seen.add(row.session_id)
    return true
  })

  return NextResponse.json({ sessions: uniqueSessions })
}
