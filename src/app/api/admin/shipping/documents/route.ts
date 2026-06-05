// 운영용 PDF (라벨, invoice) 서명 URL 발급 → 302 redirect.
// 관리자만 접근. OMO-2371.

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createServerClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const path = request.nextUrl.searchParams.get('path')
  if (!path || !path.startsWith('shipping/')) {
    return NextResponse.json({ error: '잘못된 경로' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase.storage.from('print-assets').createSignedUrl(path, 600)
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: error?.message ?? '서명 URL 발급 실패' }, { status: 500 })
  }

  return NextResponse.redirect(data.signedUrl)
}
