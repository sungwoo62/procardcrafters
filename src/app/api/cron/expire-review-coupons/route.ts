import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// Vercel Cron: 매일 UTC 02:00 (KST 11:00) 실행
export const maxDuration = 30

async function runExpireReviewCoupons(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('print_review_coupons')
    .update({ status: 'expired' })
    .eq('status', 'sent')
    .lt('expires_at', new Date().toISOString())
    .select('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, expired: data?.length ?? 0 })
}

export async function GET(request: NextRequest) {
  return runExpireReviewCoupons(request)
}

export async function POST(request: NextRequest) {
  return runExpireReviewCoupons(request)
}
