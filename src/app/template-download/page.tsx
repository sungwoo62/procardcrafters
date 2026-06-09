import type { Metadata } from 'next'
import TemplateDownloadClient from './TemplateDownloadClient'

export const metadata: Metadata = {
  title: '성원 규격 템플릿 다운로드 | Procardcrafters',
  description:
    '사이즈·후가공을 선택하면 트림/블리드/세이프 가이드와 M100 별색 레이어가 포함된 인쇄 템플릿(PDF/SVG/AI)을 받을 수 있습니다.',
}

export default function TemplateDownloadPage() {
  return <TemplateDownloadClient />
}
