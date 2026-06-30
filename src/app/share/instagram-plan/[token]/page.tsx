import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Omo3764InstagramReportView from '@/components/Omo3764InstagramReportView'

// OMO-3764(보드 지시): "로그인 필요 없는 페이지로 해줘, 토큰 형태로."
// /reports/* 는 성원(Swadpia) 도매가 등 내부 데이터 보호 때문에 어드민 인증 게이트(OMO-3593)다.
// 인스타 콘텐츠 플랜은 마케팅 초안+제품사진뿐이라 민감정보가 없으므로, /reports 게이트를
// 약화시키지 않고 별도의 로그인 없는 토큰(capability URL) 경로로 공개한다.
//   URL 예) /share/instagram-plan/<TOKEN>
// 토큰은 추측 불가한 capability 값. 환경변수 OMO3764_SHARE_TOKEN 으로 회전 가능하며,
// 미설정 시 코드에 박힌 기본 토큰을 사용한다(민감정보 없는 콘텐츠라 capability URL로 충분).
const DEFAULT_SHARE_TOKEN = 'd18e0d6430f6380fff31492bc4084464'

function shareToken(): string {
  return process.env.OMO3764_SHARE_TOKEN?.trim() || DEFAULT_SHARE_TOKEN
}

// 토큰 게이트는 런타임에 평가돼야 하고, 미매칭 404가 엣지에 정적 캐시되면 안 되므로 동적 렌더 강제.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'OMO-3764 — 프로카드 인스타 30일 콘텐츠 플랜 (공유)',
  description: '인스타 하루 2건 × 30일 = 60개 게시물 초안 프리뷰. 로그인 없이 토큰 링크로 열람.',
  robots: { index: false, follow: false },
}

type Props = {
  params: Promise<{ token: string }>
}

export default async function Omo3764InstagramSharePage({ params }: Props) {
  const { token } = await params
  // 토큰 불일치 → 404 (열거/추측 차단)
  if (token !== shareToken()) notFound()
  return <Omo3764InstagramReportView />
}
