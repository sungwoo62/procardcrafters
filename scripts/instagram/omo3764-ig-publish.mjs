#!/usr/bin/env node
/**
 * OMO-3764 — 프로카드 인스타그램 자동 발행 파이프라인 (승인 게이트)
 *
 * 하루 2건 콘텐츠 발행을 자동화한다. 단, 외부 발송 게이트(OMO-1908)와
 * 대외 콘텐츠 사람 승인 게이트(OMO-2760 / OMO-3444)를 준수한다:
 *   - AUTO_PUBLISH 기본 OFF. 켜져 있어도 status === "approved" 항목만 발행.
 *   - 가짜 후기·내부 임계값 노출 금지(콘텐츠 큐 작성 단계에서 차단).
 *
 * 발행 메커니즘: Meta Graph API — Instagram Content Publishing
 *   1) POST /{IG_USER_ID}/media        (image_url + caption) → creation_id
 *   2) POST /{IG_USER_ID}/media_publish (creation_id)        → 발행
 * 요구 권한: instagram_content_publish, pages_read_engagement, business_management
 * 요구 자산: 페이스북 페이지에 연결된 IG 비즈니스 계정 + 장기 페이지 액세스 토큰.
 *
 * 환경변수 (.env.local, gitignored):
 *   IG_USER_ID            인스타 비즈니스 계정 ID
 *   IG_GRAPH_TOKEN        장기 페이지 액세스 토큰
 *   IG_AUTO_PUBLISH       "1" 이어야 실제 발행 (기본 미설정 = dry-run)
 *
 * 사용:
 *   node scripts/instagram/omo3764-ig-publish.mjs            # dry-run: approved 항목 미리보기
 *   IG_AUTO_PUBLISH=1 node scripts/instagram/omo3764-ig-publish.mjs   # 실제 발행(승인+토큰 필요)
 */

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const QUEUE_PATH = join(__dirname, 'content-queue.json')
const GRAPH = 'https://graph.facebook.com/v21.0'

const IG_USER_ID = process.env.IG_USER_ID
const IG_GRAPH_TOKEN = process.env.IG_GRAPH_TOKEN
const AUTO_PUBLISH = process.env.IG_AUTO_PUBLISH === '1'
const MAX_PER_RUN = Number(process.env.IG_MAX_PER_RUN || '1') // 하루 2건 = 09:00/18:00 크론 각 1건

function buildBody(post) {
  const tags = (post.hashtags || []).join(' ')
  return [post.caption, tags].filter(Boolean).join('\n\n')
}

async function createContainer(post) {
  const url = new URL(`${GRAPH}/${IG_USER_ID}/media`)
  url.searchParams.set('image_url', post.imageUrl)
  url.searchParams.set('caption', buildBody(post))
  url.searchParams.set('access_token', IG_GRAPH_TOKEN)
  const res = await fetch(url, { method: 'POST' })
  const data = await res.json()
  if (!res.ok) throw new Error(`media 생성 실패: ${JSON.stringify(data)}`)
  return data.id
}

async function publishContainer(creationId) {
  const url = new URL(`${GRAPH}/${IG_USER_ID}/media_publish`)
  url.searchParams.set('creation_id', creationId)
  url.searchParams.set('access_token', IG_GRAPH_TOKEN)
  const res = await fetch(url, { method: 'POST' })
  const data = await res.json()
  if (!res.ok) throw new Error(`media_publish 실패: ${JSON.stringify(data)}`)
  return data.id
}

async function main() {
  const queue = JSON.parse(await readFile(QUEUE_PATH, 'utf8'))
  const approved = queue.posts.filter(p => p.status === 'approved')
  const drafts = queue.posts.filter(p => p.status === 'draft')

  console.log(`[OMO-3764] 큐 상태 — approved: ${approved.length}, draft(승인대기): ${drafts.length}`)

  if (!AUTO_PUBLISH) {
    console.log('AUTO_PUBLISH=OFF → dry-run. 발행 대상(approved) 미리보기:')
    for (const p of approved.slice(0, MAX_PER_RUN)) {
      console.log(`\n--- ${p.id} (${p.pillar}) ---`)
      console.log(buildBody(p))
      console.log(`image: ${p.imageUrl || '(미지정 — 보드 제공 필요)'}`)
    }
    if (drafts.length) console.log(`\n⏳ 승인 대기 draft ${drafts.length}건 — 보드 승인 후 status를 "approved"로 변경.`)
    return
  }

  if (!IG_USER_ID || !IG_GRAPH_TOKEN) {
    console.error('❌ IG_USER_ID / IG_GRAPH_TOKEN 미설정 — 보드가 Meta Graph 자격 제공 필요(승인 게이트).')
    process.exit(2)
  }

  let published = 0
  for (const post of approved) {
    if (published >= MAX_PER_RUN) break
    if (!post.imageUrl) { console.warn(`skip ${post.id}: imageUrl 없음`); continue }
    const creationId = await createContainer(post)
    const mediaId = await publishContainer(creationId)
    post.status = 'published'
    post.publishedMediaId = mediaId
    published++
    console.log(`✅ 발행: ${post.id} → media ${mediaId}`)
  }

  await writeFile(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n')
  console.log(`[OMO-3764] 이번 실행 발행 ${published}건.`)
}

main().catch(e => { console.error(e); process.exit(1) })
