import SwadpiaMappingEditor from './SwadpiaMappingEditor'

// OMO-3059: 성원 맵핑 편집 도구(어드민 전용). 라우트는 middleware.ts 의 /admin/:path*
// 게이트로 보호되고, 쓰기 API(POST /api/swadpia-mapping)는 requireAdmin 게이트 하위다.
export const dynamic = 'force-dynamic'

export default function AdminSwadpiaMappingPage() {
  return <SwadpiaMappingEditor />
}
