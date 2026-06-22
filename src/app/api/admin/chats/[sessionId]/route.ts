import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createServerClient } from '@/lib/supabase'
import {
  mapProfileRow,
  mapPageViewRows,
  type VisitorProfileResponse,
} from '@/lib/chat/visitorProfile'


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { sessionId } = await params
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('print_chat_logs')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // OMO-3744: 방문자 프로필/페이지뷰(공유 cs_visitor_profiles/cs_page_views, site='procard').
  // session_id 로 페이지뷰를 찾고 → visitor_id 로 전체 프로필을 조회. IP 는 서버측 마스킹(OMO-2760).
  // 수집 데이터가 없는 과거 세션은 visitor=null 로 정상 응답(하위호환).
  const visitor = await loadVisitor(supabase, sessionId)

  return NextResponse.json({ messages: data ?? [], visitor })
}

async function loadVisitor(
  supabase: ReturnType<typeof createServerClient>,
  sessionId: string,
): Promise<VisitorProfileResponse | null> {
  try {
    const { data: pvRows } = await supabase
      .from('cs_page_views')
      .select('id, page_url, referrer, created_at, visitor_id')
      .eq('session_id', sessionId)
      .eq('site', 'procard')
      .order('created_at', { ascending: false })
      .limit(20)

    const pageViews = mapPageViewRows(pvRows)
    const visitorId = pvRows?.find((r) => r.visitor_id)?.visitor_id as string | undefined

    let profile = null
    if (visitorId) {
      const { data: profRow } = await supabase
        .from('cs_visitor_profiles')
        .select('*')
        .eq('visitor_id', visitorId)
        .eq('site', 'procard')
        .maybeSingle()
      profile = mapProfileRow(profRow)
    }

    if (!profile && pageViews.length === 0) return null
    return { profile, pageViews }
  } catch {
    return null
  }
}
