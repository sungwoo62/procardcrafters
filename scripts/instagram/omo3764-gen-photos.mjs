#!/usr/bin/env node
/**
 * OMO-3764 — 실사풍(포토리얼) 제품사진 생성 파이프라인 (키 게이트)
 *
 * 보드 요청("제품사진 막 예쁘게 촬영한 실사느낌, 배경 감각적, 트렌디/힙"):
 * 각 게시물에 포토리얼 제품사진을 생성한다.
 *
 * ⚠️ 이미지 생성에는 외부 이미지생성 API 키가 필요하다(Claude/Anthropic은 이미지
 *    생성 불가). 이 리포에는 현재 이미지생성 키가 없음 → 키 제공 전까지 dry-run으로
 *    60개 프롬프트만 산출하고, plan JSON에 photoPrompt를 기록한다.
 *
 * 동작:
 *   - 항상: 각 post에 photoPrompt(실사·트렌디·힙·감각적 배경) 기록 후 plan 저장.
 *   - OPENAI_API_KEY 있으면: OpenAI Images(gpt-image-1)로 1024² PNG 생성 →
 *     public/instagram/omo3764/<id>.png 저장 + imageUrl 을 .png 로 전환.
 *   - 키 없으면: dry-run. 프롬프트를 artifacts/omo3764-photo-prompts.md 로 출력.
 *   (provider는 교체 가능 — 보드가 정하는 제공자에 맞춰 generateOne()만 바꾸면 됨.)
 *
 * 실행: node scripts/instagram/omo3764-gen-photos.mjs
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PLAN = join(__dirname, '..', '..', 'src', 'data', 'omo3764-instagram-plan.json')
const OUT_DIR = join(__dirname, '..', '..', 'public', 'instagram', 'omo3764')
const PROMPTS_OUT = join(__dirname, '..', '..', 'artifacts', 'omo3764-photo-prompts.md')

const OPENAI_API_KEY = process.env.OPENAI_API_KEY // 보드 제공 시에만 실제 생성

// 제품별 피사체 묘사
const SUBJECT = {
  business_cards: 'an elegant stack of luxe matte business cards with subtle gold foil edges, gently fanned out, one card standing upright',
  stickers: 'a playful scatter of glossy die-cut and holographic stickers catching the light on a surface',
  flyers: 'a crisp freshly-printed flyer held at a dynamic angle by manicured fingers',
  posters: 'a large framed fine-art poster leaning against a styled wall',
  postcards: 'a premium printed postcard resting on a textured surface beside minimal props',
  brochures: 'an open tri-fold brochure with crisp folds and rich print',
  labels: 'a beautifully branded product bottle with a glossy waterproof printed label',
  banners: 'a sleek roll-up banner standing in a chic modern event space',
  mixed: 'an artful flat-lay of premium printed brand collateral — cards, stickers and a flyer',
}
// 감각적·트렌디 배경 풀
const BACKGROUNDS = [
  'soft pastel gradient seamless backdrop, peachy-pink melting into lilac',
  'warm terracotta and cream color-blocked background, editorial styling',
  'glossy chrome and iridescent holographic backdrop with light flares',
  'minimalist beige studio with long soft sculptural shadows',
  'Y2K-inspired vibrant candy gradient with a subtle film grain',
  'polished marble surface with eucalyptus sprigs, overhead flat-lay',
  'moody neon-lit dark studio with a cyber glow, deep blues and magenta',
  'sunlit natural linen with dappled window light and gentle shadows',
  'bold cobalt and tangerine duotone backdrop, high fashion vibe',
  'translucent acrylic shapes and glassy pastel props, playful modern set',
]
// 라이팅/렌즈 풀
const LIGHTING = [
  'shot on 85mm f1.8, shallow depth of field, soft diffused studio light',
  'golden-hour window light, creamy bokeh, gentle warm highlights',
  'high-key softbox lighting, crisp clean shadows, glossy reflections',
  'cinematic side light, rich contrast and an editorial mood',
]
const SUFFIX =
  'photorealistic, ultra-detailed, professional product photography, trendy and hip Gen-Z aesthetic, vibrant yet tasteful, social-media ready, perfectly square 1:1 composition, no text, no watermark, no logos'

function photoPromptFor(post, i) {
  const subject = SUBJECT[post.product] || SUBJECT.mixed
  const bg = BACKGROUNDS[i % BACKGROUNDS.length]
  const light = LIGHTING[i % LIGHTING.length]
  return `${subject}, set against ${bg}, ${light}. ${SUFFIX}`
}

async function generateOne(prompt) {
  // OpenAI Images (gpt-image-1). provider 교체 시 이 함수만 변경.
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-image-1', prompt, size: '1024x1024', n: 1 }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`image gen 실패: ${JSON.stringify(data).slice(0, 300)}`)
  const b64 = data.data?.[0]?.b64_json
  if (!b64) throw new Error('응답에 b64_json 없음')
  return Buffer.from(b64, 'base64')
}

const plan = JSON.parse(await readFile(PLAN, 'utf8'))
await mkdir(OUT_DIR, { recursive: true })

// 1) 항상: photoPrompt 기록
plan.posts.forEach((post, i) => { post.photoPrompt = photoPromptFor(post, i) })

if (!OPENAI_API_KEY) {
  // dry-run: 프롬프트 산출
  await mkdir(dirname(PROMPTS_OUT), { recursive: true })
  const md = ['# OMO-3764 — 60개 실사풍 제품사진 프롬프트 (키 제공 시 생성)', '',
    '> 이미지생성 키 미제공 → dry-run. 키(OPENAI_API_KEY 등) 제공 시 이 프롬프트로 PNG 생성.', '']
  for (const p of plan.posts) md.push(`## ${p.id} · Day ${p.day} ${p.slot} · ${p.product}`, p.photoPrompt, '')
  await writeFile(PROMPTS_OUT, md.join('\n'))
  await writeFile(PLAN, JSON.stringify(plan, null, 2) + '\n')
  console.log(`[OMO-3764] 키 없음 → dry-run. ${plan.posts.length}개 photoPrompt 기록 + ${PROMPTS_OUT}`)
  console.log('실제 생성하려면 보드가 이미지생성 API 키(OPENAI_API_KEY 등)를 제공해야 함.')
  process.exit(0)
}

// 2) 키 있으면 실제 생성
const MAX = Number(process.env.IG_PHOTO_MAX || plan.posts.length)
let made = 0
for (const post of plan.posts) {
  if (made >= MAX) break
  try {
    const png = await generateOne(post.photoPrompt)
    await writeFile(join(OUT_DIR, `${post.id}.png`), png)
    post.imageUrl = `/instagram/omo3764/${post.id}.png`
    made++
    console.log(`✅ ${post.id} 생성`)
  } catch (e) {
    console.warn(`⚠️ ${post.id} 실패: ${e.message}`)
  }
}
await writeFile(PLAN, JSON.stringify(plan, null, 2) + '\n')
console.log(`[OMO-3764] 실사 PNG ${made}개 생성, imageUrl 갱신.`)
