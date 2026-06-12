// OMO-3027 [OMO-3019-2]: 제품별 PDF 템플릿 다운로드 엔드포인트.
//
// GET /api/products/{slug}/template
//   · print_products.print_spec(OMO-3026) 를 읽어 빈 인쇄 템플릿 PDF 를 즉석 생성·반환.
//   · 규격 미시드 제품은 404 + 안내 JSON("준비중"). 폴백 규격 강제 적용하지 않는다
//     (잘못된 치수의 템플릿을 주는 것보다 명시적 미제공이 정직 — OMO-2975).

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import type { PrintSpec } from '@/lib/print-spec'
import { buildPrintTemplatePdf, templatePdfFileName } from '@/lib/print-template-pdf'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const supabase = createServerClient()

  const { data: product } = await supabase
    .from('print_products')
    .select('name_en, print_spec')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()

  if (!product) {
    return NextResponse.json({ error: '상품을 찾을 수 없습니다.' }, { status: 404 })
  }

  const spec = (product as { print_spec: PrintSpec | null }).print_spec
  if (!spec) {
    // 규격 미시드 — graceful 미제공(준비중).
    return NextResponse.json(
      { error: '이 제품의 인쇄 템플릿은 준비 중입니다.', status: 'coming_soon' },
      { status: 404 },
    )
  }

  const label = (product as { name_en: string }).name_en
  let pdfBytes: Uint8Array
  try {
    pdfBytes = await buildPrintTemplatePdf({ spec, productLabel: label })
  } catch {
    return NextResponse.json({ error: '템플릿 생성 중 오류가 발생했습니다.' }, { status: 500 })
  }

  const fileName = templatePdfFileName(slug, spec)
  // Uint8Array → ArrayBuffer 슬라이스로 Response 바디에 안전 전달.
  const body = pdfBytes.slice().buffer
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
