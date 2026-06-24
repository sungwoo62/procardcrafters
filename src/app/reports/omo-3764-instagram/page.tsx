import type { Metadata } from 'next'
import Omo3764InstagramReportView from '@/components/Omo3764InstagramReportView'

// OMO-3764(보드 요청): "게시물 어떻게 할건지 60개 뽑아서 웹에다 해서 먼저 보고."
// 어드민 전용 검토 리포트. /reports/* 는 미들웨어에서 어드민 인증 게이트(OMO-3593).
// 렌더는 공유 뷰 컴포넌트 Omo3764InstagramReportView 로 일원화 — 로그인 없는 토큰 공유
// 링크(/share/instagram-plan/[token])도 동일 뷰를 재사용한다.
export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'OMO-3764 — 프로카드 인스타 30일 콘텐츠 플랜 (검토용)',
  description: '인스타 하루 2건 × 30일 = 60개 게시물 초안 프리뷰. 발행 전 보드 검토용.',
  robots: { index: false, follow: false },
}

export default function Omo3764InstagramReport() {
  return <Omo3764InstagramReportView />
}
