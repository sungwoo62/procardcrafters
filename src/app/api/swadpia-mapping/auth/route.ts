import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

// OMO-3156: 공개 맵핑 리포트(/reports/swadpia-mapping)의 편집 UI(링크 입력·저장·검증)는
// 인증된 어드민에게만 노출한다. 클라이언트가 마운트 시 이 엔드포인트로 어드민 여부만
// 확인한다(이메일 허용목록은 서버에만 — 노출하지 않음).
//
// 주의: 이 엔드포인트는 UX 게이트일 뿐 보안 게이트가 아니다. 실제 쓰기 보호는
// POST /api/swadpia-mapping 의 requireAdmin(401) 이 담당한다.
export async function GET() {
  const user = await requireAdmin()
  return NextResponse.json({ admin: Boolean(user) })
}
