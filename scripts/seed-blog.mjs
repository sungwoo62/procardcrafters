#!/usr/bin/env node
/**
 * 블로그 시드/인제스트 스크립트 — OMO-2569
 *
 * print_blog_categories / print_blog_posts 에 JSON 콘텐츠를 upsert.
 * 카테고리는 slug, 글은 slug 기준 upsert(멱등) — 같은 JSON 을 반복 실행해도 안전.
 *
 * 사용법:
 *   node scripts/seed-blog.mjs <path-to-seed.json>
 *   node scripts/seed-blog.mjs scripts/seed/blog-sample.json
 *
 * 필요 환경변수 (.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (service_role — RLS 우회, 절대 클라이언트 노출 금지)
 *
 * seed JSON 포맷은 docs/blog-seed-format.md 참조.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// .env.local 로드 (dotenv 의존성 없이 직접 파싱)
function loadEnv() {
  try {
    const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    for (const line of raw.split('\n')) {
      const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim())
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {
    // .env.local 없으면 프로세스 환경변수에 의존
  }
}
loadEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('✗ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.')
  process.exit(1)
}

const seedPath = process.argv[2]
if (!seedPath) {
  console.error('사용법: node scripts/seed-blog.mjs <path-to-seed.json>')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

function fail(msg, err) {
  console.error(`✗ ${msg}`, err?.message ?? err ?? '')
  process.exit(1)
}

async function main() {
  let seed
  try {
    seed = JSON.parse(readFileSync(seedPath, 'utf8'))
  } catch (e) {
    fail(`시드 JSON 파싱 실패 (${seedPath})`, e)
  }

  const categories = Array.isArray(seed.categories) ? seed.categories : []
  const posts = Array.isArray(seed.posts) ? seed.posts : []

  // 1) 카테고리 upsert (slug 충돌 시 갱신)
  if (categories.length > 0) {
    const rows = categories.map((c, idx) => ({
      slug: c.slug,
      name: c.name,
      description: c.description ?? null,
      sort_order: c.sort_order ?? idx,
    }))
    const { error } = await supabase.from('print_blog_categories').upsert(rows, { onConflict: 'slug' })
    if (error) fail('카테고리 upsert 실패', error)
    console.log(`✓ 카테고리 ${rows.length}건 upsert`)
  }

  // 2) 카테고리 slug → id 매핑
  const { data: catRows, error: catErr } = await supabase.from('print_blog_categories').select('id, slug')
  if (catErr) fail('카테고리 조회 실패', catErr)
  const catIdBySlug = new Map((catRows ?? []).map((c) => [c.slug, c.id]))

  // 3) 글 upsert (slug 충돌 시 갱신)
  if (posts.length > 0) {
    const rows = posts.map((p) => {
      if (!p.slug || !p.title) fail(`글에 slug/title 누락: ${JSON.stringify(p).slice(0, 80)}`)
      const categoryId = p.category ? catIdBySlug.get(p.category) ?? null : null
      if (p.category && !categoryId) {
        console.warn(`  ⚠ 글 '${p.slug}' 의 카테고리 '${p.category}' 를 찾지 못함 — category_id=null 로 적재`)
      }
      return {
        slug: p.slug,
        category_id: categoryId,
        title: p.title,
        excerpt: p.excerpt ?? null,
        body_md: p.body_md ?? '',
        cover_image_url: p.cover_image_url ?? null,
        body_images: p.body_images ?? [],
        tags: p.tags ?? [],
        seo_title: p.seo_title ?? null,
        seo_description: p.seo_description ?? null,
        og_image_url: p.og_image_url ?? null,
        is_published: p.is_published ?? false,
        published_at: p.published_at ?? (p.is_published ? new Date().toISOString() : null),
      }
    })
    const { error } = await supabase.from('print_blog_posts').upsert(rows, { onConflict: 'slug' })
    if (error) fail('글 upsert 실패', error)
    console.log(`✓ 글 ${rows.length}건 upsert (발행 ${rows.filter((r) => r.is_published).length}건)`)
  }

  console.log('완료.')
}

main().catch((e) => fail('예기치 못한 오류', e))
