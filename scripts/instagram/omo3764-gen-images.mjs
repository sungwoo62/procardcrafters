#!/usr/bin/env node
/**
 * OMO-3764 — 60개 게시물용 브랜드 SVG 크리에이티브 생성기
 *
 * 보드 요청("이미지도 다 적용해서 업뎃"): 각 게시물에 실제 1080×1080 인스타용
 * 비주얼을 생성한다. 이미지 생성 API 없이 브랜드 일관 SVG 템플릿으로 결정론적 생성.
 * - public/instagram/omo3764/<id>.svg 로 저장(정적 공개 에셋)
 * - plan JSON의 각 post.imageUrl 을 /instagram/omo3764/<id>.svg 로 세팅 후 저장
 *
 * 주의: 실제 IG Graph 발행은 JPG/PNG 만 허용 → 발행 단계에서 래스터화 필요(발행기 주석 참조).
 *       이 SVG는 검토 리포트용 비주얼 + 디자인 소스. 최종 사진 교체도 imageUrl만 바꾸면 됨.
 *
 * 실행: node scripts/instagram/omo3764-gen-images.mjs
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PLAN = join(__dirname, '..', '..', 'src', 'data', 'omo3764-instagram-plan.json')
const OUT_DIR = join(__dirname, '..', '..', 'public', 'instagram', 'omo3764')

// 카테고리별 리치 그라데이션(흰 텍스트 대비 좋게)
const GRAD = {
  business_cards: ['#6366f1', '#1e1b4b'],
  stickers: ['#f59e0b', '#7c2d12'],
  flyers: ['#10b981', '#064e3b'],
  posters: ['#d946ef', '#581c87'],
  postcards: ['#ec4899', '#831843'],
  brochures: ['#06b6d4', '#164e63'],
  labels: ['#f59e0b', '#7c2d12'],
  banners: ['#14b8a6', '#134e4a'],
  mixed: ['#64748b', '#0f172a'],
}
const PRODUCT_NAME = {
  business_cards: 'Business Cards', stickers: 'Stickers', flyers: 'Flyers',
  posters: 'Posters', postcards: 'Postcards', brochures: 'Brochures',
  labels: 'Labels', banners: 'Banners', mixed: 'Premium Print',
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// 글자수 기준 단순 워드랩 → tspan 줄 배열
function wrap(text, maxChars) {
  const words = text.split(/\s+/)
  const lines = []
  let cur = ''
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars && cur) {
      lines.push(cur.trim()); cur = w
    } else {
      cur = (cur + ' ' + w).trim()
    }
  }
  if (cur) lines.push(cur.trim())
  return lines
}

function svgFor(post) {
  const [c1, c2] = GRAD[post.product] || GRAD.mixed
  const headline = post.caption.split('\n')[0]
  // 길이에 따라 폰트/줄당 글자수 조절
  const fs = headline.length > 64 ? 56 : headline.length > 40 ? 66 : 78
  const maxChars = headline.length > 64 ? 22 : 18
  const lines = wrap(headline, maxChars).slice(0, 5)
  const lh = fs * 1.18
  const blockH = lines.length * lh
  const startY = 540 - blockH / 2 + fs * 0.7 // 세로 중앙 정렬
  const tspans = lines
    .map((ln, i) => `<tspan x="90" y="${Math.round(startY + i * lh)}">${esc(ln)}</tspan>`)
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}"/>
      <stop offset="1" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1080" fill="url(#bg)"/>
  <!-- 장식 도형 -->
  <circle cx="930" cy="170" r="260" fill="#ffffff" opacity="0.07"/>
  <circle cx="120" cy="980" r="200" fill="#ffffff" opacity="0.06"/>
  <rect x="-40" y="430" width="1160" height="3" fill="#ffffff" opacity="0.18"/>
  <!-- 워드마크 -->
  <text x="90" y="120" fill="#ffffff" font-size="30" font-weight="700" letter-spacing="6" opacity="0.92">PROCARDCRAFTERS</text>
  <!-- 필러 태그 -->
  <text x="990" y="120" text-anchor="end" fill="#ffffff" font-size="24" font-weight="600" opacity="0.8">${esc(post.pillarLabel)}</text>
  <!-- 헤드라인 -->
  <text fill="#ffffff" font-size="${fs}" font-weight="800" letter-spacing="-1">${tspans}</text>
  <!-- 제품 칩 -->
  <rect x="86" y="900" rx="26" ry="26" width="${52 + (PRODUCT_NAME[post.product]||'Print').length * 16}" height="52" fill="#ffffff" opacity="0.16"/>
  <text x="110" y="934" fill="#ffffff" font-size="26" font-weight="700">${esc(PRODUCT_NAME[post.product] || 'Premium Print')}</text>
  <!-- CTA -->
  <text x="90" y="1015" fill="#ffffff" font-size="28" font-weight="600" opacity="0.95">Configure &amp; price in seconds — link in bio</text>
  <text x="990" y="1015" text-anchor="end" fill="#ffffff" font-size="24" opacity="0.7">Day ${post.day} · ${post.slot}</text>
</svg>
`
}

const plan = JSON.parse(await readFile(PLAN, 'utf8'))
await mkdir(OUT_DIR, { recursive: true })

let n = 0
for (const post of plan.posts) {
  const svg = svgFor(post)
  await writeFile(join(OUT_DIR, `${post.id}.svg`), svg)
  post.imageUrl = `/instagram/omo3764/${post.id}.svg`
  n++
}
plan._imagesNote = '각 post.imageUrl = 브랜드 SVG 크리에이티브(public/instagram/omo3764/). 검토용 비주얼 + 디자인 소스. 실제 IG 발행 시 JPG/PNG 래스터화 또는 사진 교체.'

await writeFile(PLAN, JSON.stringify(plan, null, 2) + '\n')
console.log(`[OMO-3764] ${n}개 SVG 생성 → ${OUT_DIR}`)
console.log(`[OMO-3764] plan JSON imageUrl ${n}건 갱신`)
