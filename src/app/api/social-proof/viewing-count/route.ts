import { NextRequest, NextResponse } from 'next/server'

// 뷰어 카운트는 Supabase Realtime Presence로 클라이언트에서 직접 관리.
// 이 엔드포인트는 최소 임계(5명 이상) 충족 여부를 확인하기 위한 폴백용.
// 실제 카운트는 클라이언트 useProductViewers 훅이 담당.
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug') ?? ''
  if (!slug) return NextResponse.json({ count: 0, show: false })
  // 클라이언트 presence가 primary source — 서버 응답은 항상 show:false (presence 로드 전 안전 기본값)
  return NextResponse.json({ count: 0, show: false })
}
