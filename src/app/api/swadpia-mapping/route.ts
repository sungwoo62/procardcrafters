import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { PRODUCT_GROUPS, SLUG_TO_GROUP } from '@/config/product-nav'
import { CATEGORY_MAP } from '@/lib/swadpia'
import { verifySwadpiaLink } from '@/lib/swadpia-mapping'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// OMO-3058/3059: 성원 맵핑 조회/편집 API.
// GET  → 전체 제품 맵핑 행(누락분은 기본값으로 시드 후 반환). 공개 읽기 리포트가 사용.
// POST → {slug, swadpiaUrl|hidden} 저장. 링크 라이브 검증 후 category_code 세팅 + 핑거프린트 스냅샷,
//        또는 고객 노출 토글.
//
// 보안(OMO-3059 prod 승격): 쓰기(POST: 링크저장·검증·고객숨김 토글)는 requireAdmin 게이트 하위다.
// 프리뷰 bypass 전용이던 쓰기를 prod 에서 공개 금지한다. 읽기(GET)는 공개 유지.

const SLUG_META: Record<string, { label: string; group: string }> = Object.fromEntries(
  PRODUCT_GROUPS.flatMap((g) => g.items.map((i) => [i.slug, { label: i.label, group: g.key }])),
)
const ALL_SLUGS = Object.keys(SLUG_META)

/** 누락된 제품 행을 기본값으로 채운다(보드 편집은 덮어쓰지 않음). */
async function ensureSeeded(supabase: ReturnType<typeof createServerClient>) {
  const rows = ALL_SLUGS.map((slug) => {
    const code = CATEGORY_MAP[slug] ?? null
    return {
      slug,
      label: SLUG_META[slug].label,
      group_key: SLUG_META[slug].group,
      category_code: code,
      status: code ? 'mapped' : 'unmapped',
    }
  })
  await supabase
    .from('print_swadpia_mapping')
    .upsert(rows, { onConflict: 'slug', ignoreDuplicates: true })
}

export async function GET() {
  const supabase = createServerClient()
  await ensureSeeded(supabase)
  const { data, error } = await supabase
    .from('print_swadpia_mapping')
    .select('*')
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  // CATEGORY_MAP 에 새 코드가 추가되면(예: OMO-3058 전체정렬) 보드가 손대지 않은
  // 행(swadpia_url null)의 category_code 를 동기화 + status unmapped→mapped 자가치유.
  const rowsData = data ?? []
  for (const r of rowsData) {
    const code = CATEGORY_MAP[r.slug]
    if (code && !r.swadpia_url && r.category_code !== code) {
      // 코드가 바뀌면 옛 핑거프린트는 다른 카테고리 기준이라 무효 → null 로 리셋해
      // 다음 드리프트 점검이 새 카테고리로 깨끗이 baseline 하게 한다(허위 드리프트 방지).
      const newStatus = r.status === 'unmapped' || !r.status ? 'mapped' : r.status
      await supabase
        .from('print_swadpia_mapping')
        .update({ category_code: code, status: newStatus, fingerprint: null })
        .eq('slug', r.slug)
      r.category_code = code
      r.status = newStatus
    }
  }
  // 그룹/슬러그 순서를 PRODUCT_GROUPS 기준으로 정렬해 반환
  const order = new Map(ALL_SLUGS.map((s, i) => [s, i]))
  const rows = rowsData.sort(
    (a, b) => (order.get(a.slug) ?? 999) - (order.get(b.slug) ?? 999),
  )
  return NextResponse.json({ rows, groups: PRODUCT_GROUPS })
}

export async function POST(req: NextRequest) {
  // OMO-3059: 쓰기 경로는 어드민 전용(API 직접호출도 차단). 링크저장·검증·고객숨김 토글 모두 보호.
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: '인증 필요 — 어드민만 맵핑을 편집할 수 있습니다.' }, { status: 401 })
  }

  let body: { slug?: string; swadpiaUrl?: string; hidden?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON 파싱 실패' }, { status: 400 })
  }
  const slug = body.slug?.trim()
  const swadpiaUrl = (body.swadpiaUrl ?? '').trim()

  if (!slug || !SLUG_META[slug]) {
    return NextResponse.json({ error: `알 수 없는 제품 슬러그: ${slug}` }, { status: 400 })
  }

  const supabase = createServerClient()

  // 고객 노출 토글 (링크와 독립) — OMO-3058
  if (typeof body.hidden === 'boolean') {
    const { data, error } = await supabase
      .from('print_swadpia_mapping')
      .upsert(
        {
          slug,
          label: SLUG_META[slug].label,
          group_key: SLUG_TO_GROUP[slug] ?? null,
          hidden_from_customer: body.hidden,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'slug' },
      )
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, hidden: body.hidden, row: data })
  }
  const base = {
    slug,
    label: SLUG_META[slug].label,
    group_key: SLUG_TO_GROUP[slug] ?? null,
    updated_at: new Date().toISOString(),
  }

  // 링크 비우기 = 맵핑 해제(기본 코드로 복귀)
  if (!swadpiaUrl) {
    const code = CATEGORY_MAP[slug] ?? null
    const row = {
      ...base,
      swadpia_url: null,
      category_code: code,
      status: code ? 'mapped' : 'unmapped',
      fingerprint: null,
      verify_error: null,
      last_verified_at: null,
    }
    const { error } = await supabase.from('print_swadpia_mapping').upsert(row, { onConflict: 'slug' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, cleared: true, row })
  }

  // 링크 검증
  const result = await verifySwadpiaLink(swadpiaUrl)
  const row = {
    ...base,
    swadpia_url: swadpiaUrl,
    category_code: result.categoryCode,
    status: result.ok ? 'verified' : 'error',
    fingerprint: result.fingerprint ?? null,
    verify_error: result.error ?? null,
    last_verified_at: result.ok ? new Date().toISOString() : null,
  }
  const { error } = await supabase.from('print_swadpia_mapping').upsert(row, { onConflict: 'slug' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: result.ok, verify: result, row })
}
