// OMO-3265: AI 큐레이션 진입 페이지 /curate. ?group= 로 제품군 한정, ?q= 로 초기 의도 프리필.
import type { Metadata } from 'next'
import { Suspense } from 'react'
import CurateClient from './CurateClient'

export const metadata: Metadata = {
  title: 'AI Curation — find your perfect print setup',
  description:
    'Describe what you need and let our AI curate the perfect print products and finishes — then order in one click.',
}

interface PageProps {
  searchParams: Promise<Record<string, string>>
}

async function CurateContent({ searchParams }: PageProps) {
  const params = await searchParams
  return <CurateClient group={params.group} initialIntent={params.q} />
}

export default function CuratePage(props: PageProps) {
  return (
    <Suspense fallback={<div className="text-gray-400 text-sm p-12 text-center">Loading…</div>}>
      <CurateContent {...props} />
    </Suspense>
  )
}
