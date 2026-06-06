import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

interface ShareEventBody {
  toastId: string
  orderId?: string
  shareMethod: 'image_download' | 'kakao' | 'url_copy' | 'twitter'
  utmRef?: string
  userId?: string
}

export async function POST(req: NextRequest) {
  try {
    const body: ShareEventBody = await req.json()
    const { toastId, orderId, shareMethod, utmRef, userId } = body

    if (!toastId || !shareMethod) {
      return NextResponse.json({ error: '필수 필드 누락' }, { status: 400 })
    }

    const supabase = createServerClient()
    const { error } = await supabase.from('print_share_events').insert({
      toast_id: toastId,
      user_id: userId ?? null,
      order_id: orderId ?? null,
      share_method: shareMethod,
      utm_ref: utmRef ?? null,
    })

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
