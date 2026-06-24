import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Omo3764CompareView from '@/components/Omo3764CompareView'

// OMO-3764(보드 지시): "비교본으로 해서 버전 1 2 나눠서 말해줘."
// 캡션 V1↔V2 비교본. 로그인 없는 토큰(capability URL) 경로 — 콘텐츠 플랜과 동일 토큰 사용.
//   URL 예) /share/ig-compare/<TOKEN>
const DEFAULT_SHARE_TOKEN = 'd18e0d6430f6380fff31492bc4084464'

function shareToken(): string {
  return process.env.OMO3764_SHARE_TOKEN?.trim() || DEFAULT_SHARE_TOKEN
}

export const metadata: Metadata = {
  title: 'OMO-3764 — 인스타 캡션 비교본 (V1 ↔ V2)',
  description: '60개 게시물 캡션 원본(V1)과 이미지 기준 보강(V2) 비교. 로그인 없이 토큰 링크로 열람.',
  robots: { index: false, follow: false },
}

type Props = {
  params: Promise<{ token: string }>
}

export default async function Omo3764ComparePage({ params }: Props) {
  const { token } = await params
  if (token !== shareToken()) notFound()
  return <Omo3764CompareView />
}
