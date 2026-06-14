// OMO-3159: 고객용 견적 API (비회원 공개).
//
// POST /api/quote
//   body: { slug, selections?: Record<string,string>, quantity?, country?, format?: 'pdf'|'json' }
//   - format 'json' (또는 Accept: application/json): 라이브 가격 JSON (PDF 미생성, 가드 느슨)
//   - format 'pdf' (기본): 견적서 PDF 바이트 (application/pdf, 다운로드). IP 레이트리밋 적용.
//
// 가격은 buildQuote() 가 제품 페이지와 동일 페처/계산기로 산출 → 라이브 사이트와 일치.

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { isPccfSlug } from '@/config/pccf-catalog'
import { buildQuote } from '@/lib/quote-pricing'
import { buildQuotePdf } from '@/lib/quote-pdf'
import { pantoneMixesForCategory } from '@/lib/pantone-quote-theme'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import type { PrintProduct, PrintProductOption } from '@/types/database'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PDF: IP 당 10분에 12회 (남용 가드). JSON: 60초에 30회.
const PDF_LIMIT = 12
const PDF_WINDOW_MS = 10 * 60 * 1000
const JSON_LIMIT = 30
const JSON_WINDOW_MS = 60 * 1000

const VALIDITY_DAYS = 14

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function makeQuoteNumber(now: Date): string {
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const suffix = Math.floor(1000 + Math.random() * 9000)
  return `PCC-${ymd}-${suffix}`
}

export async function POST(request: NextRequest) {
  let body: {
    slug?: string
    selections?: Record<string, string>
    quantity?: number
    country?: string
    format?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const slug = body.slug?.trim()
  if (!slug) {
    return NextResponse.json({ error: 'slug is required' }, { status: 400 })
  }
  if (!isPccfSlug(slug)) {
    return NextResponse.json({ error: 'Unknown product' }, { status: 404 })
  }

  const wantsPdf =
    (body.format ?? 'pdf').toLowerCase() !== 'json' &&
    !(request.headers.get('accept') ?? '').includes('application/json')

  // ── 남용 가드 ─────────────────────────────────────────
  const ip = clientIp(request.headers)
  const limit = wantsPdf
    ? rateLimit(`quote-pdf:${ip}`, PDF_LIMIT, PDF_WINDOW_MS)
    : rateLimit(`quote-json:${ip}`, JSON_LIMIT, JSON_WINDOW_MS)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } },
    )
  }

  // ── 제품 + 옵션 조회 (공개 읽기) ───────────────────────
  const supabase = createServerClient()
  const { data: productData, error: prodErr } = await supabase
    .from('print_products')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (prodErr || !productData) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }
  const product = productData as PrintProduct

  const { data: optionsData } = await supabase
    .from('print_product_options')
    .select('*')
    .eq('product_id', product.id)
    .order('option_type', { ascending: true })
    .order('sort_order', { ascending: true })
  const options = (optionsData as PrintProductOption[] | null) ?? []

  // ── 가격 산출 ─────────────────────────────────────────
  const quote = await buildQuote({
    product,
    options,
    selections: body.selections ?? {},
    quantity: body.quantity,
    countryCode: body.country || 'US',
  })

  if (!wantsPdf) {
    return NextResponse.json({ quote }, { headers: { 'X-RateLimit-Remaining': String(limit.remaining) } })
  }

  // ── PDF 생성 ──────────────────────────────────────────
  const now = new Date()
  const validUntil = new Date(now.getTime() + VALIDITY_DAYS * 24 * 60 * 60 * 1000)
  const quoteNumber = makeQuoteNumber(now)

  const pdfBytes = await buildQuotePdf({
    quote,
    quoteNumber,
    issuedDate: fmtDate(now),
    validUntilDate: fmtDate(validUntil),
    mixes: pantoneMixesForCategory(product.category),
  })

  const fileName = `pccf-quote-${slug}-${quoteNumber}.pdf`
  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
      'X-Quote-Number': quoteNumber,
      'X-RateLimit-Remaining': String(limit.remaining),
    },
  })
}
