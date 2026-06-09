import { NextRequest, NextResponse } from 'next/server'
import {
  buildTemplateSvg,
  buildTemplatePdf,
  buildTemplateAi,
  templateFileName,
  type TemplateSpec,
} from '@/lib/spec-template'
import { TEMPLATE_FORMATS, type TemplateFormat } from '@/config/printSpecs'

/**
 * 성원 규격 템플릿 다운로드 API — OMO-2709 [Part C]
 *
 * GET /api/template?product=business_cards&w=85&h=55&finish=foil_stamp,deboss_emboss&format=pdf
 *
 * format: pdf | svg | ai (기본 pdf)
 * finish: finishing-catalog value 콤마구분 (선택)
 *
 * 트림/블리드/세이프 가이드 + 후가공별 M100 별색 레이어 placeholder 가 포함된다.
 * 고객은 받아서 자기 일러로 작업 후 단일 합본으로 재업로드(/api/files/upload) 한다.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const productSlug = searchParams.get('product')
  if (!productSlug) {
    return NextResponse.json({ error: 'product 파라미터가 필요합니다.' }, { status: 400 })
  }

  const formatRaw = (searchParams.get('format') ?? 'pdf').toLowerCase()
  if (!TEMPLATE_FORMATS.includes(formatRaw as TemplateFormat)) {
    return NextResponse.json(
      { error: `format 은 ${TEMPLATE_FORMATS.join(' / ')} 중 하나여야 합니다.` },
      { status: 400 },
    )
  }
  const format = formatRaw as TemplateFormat

  const wRaw = searchParams.get('w')
  const hRaw = searchParams.get('h')
  const widthMm = wRaw ? Number(wRaw) : undefined
  const heightMm = hRaw ? Number(hRaw) : undefined
  if ((wRaw && !Number.isFinite(widthMm)) || (hRaw && !Number.isFinite(heightMm))) {
    return NextResponse.json({ error: 'w/h 는 숫자(mm)여야 합니다.' }, { status: 400 })
  }

  const finishing = (searchParams.get('finish') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const spec: TemplateSpec = {
    productSlug,
    productLabel: searchParams.get('label') ?? undefined,
    widthMm: widthMm && widthMm > 0 ? widthMm : undefined,
    heightMm: heightMm && heightMm > 0 ? heightMm : undefined,
    finishing,
  }

  try {
    if (format === 'svg') {
      const svg = buildTemplateSvg(spec)
      return new NextResponse(svg, {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Content-Disposition': `attachment; filename="${templateFileName(spec, 'svg')}"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    const bytes = format === 'ai' ? await buildTemplateAi(spec) : await buildTemplatePdf(spec)
    const contentType = format === 'ai' ? 'application/illustrator' : 'application/pdf'
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${templateFileName(spec, format)}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    return NextResponse.json(
      { error: '템플릿 생성에 실패했습니다.', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
