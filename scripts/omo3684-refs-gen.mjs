// OMO-3684 · 제품별 레퍼런스 이미지 배치 생성기.
// 배포된 /api/studio/gen 을 ref-{slug}-{n} 항목별로 호출 → 생성 URL 을
// src/config/product-references.json (slug → URL[]) 에 적재.
// scene 정의는 src/config/reference-scenes.json(공유 SSOT), 슬러그는 product-nav.ts 에서 파싱.
// 사용:
//   STUDIO_GEN_SECRET=xxx node scripts/omo3684-refs-gen.mjs [baseUrl] [--group=cards|all] [--slugs=a,b]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const NAV = path.join(ROOT, 'src/config/product-nav.ts')
const SCENES = path.join(ROOT, 'src/config/reference-scenes.json')
const OUT = path.join(ROOT, 'src/config/product-references.json')

const args = process.argv.slice(2)
const baseUrl = (args.find((a) => a.startsWith('http')) || 'https://procardcrafters.com').replace(/\/$/, '')
const group = args.find((a) => a.startsWith('--group='))?.split('=')[1] || 'all'
const slugsArg = args.find((a) => a.startsWith('--slugs='))?.split('=')[1]
const secret = process.env.STUDIO_GEN_SECRET
if (!secret) {
  console.error('STUDIO_GEN_SECRET env required')
  process.exit(1)
}

const sceneData = JSON.parse(fs.readFileSync(SCENES, 'utf8'))
const perProduct = sceneData.perProduct
const groupScenes = sceneData.groups

// product-nav.ts 에서 그룹 key + (slug,label) 추출.
const navSrc = fs.readFileSync(NAV, 'utf8')
const groups = [] // { key, items: [{slug,label}] }
const groupRe = /key: '([a-z]+)',[\s\S]*?items: \[([\s\S]*?)\],\s*\}/g
let gm
while ((gm = groupRe.exec(navSrc)) !== null) {
  const key = gm[1]
  const items = []
  const itemRe = /\{ slug: '([^']+)', label: '([^']+)' \}/g
  let im
  while ((im = itemRe.exec(gm[2])) !== null) items.push({ slug: im[1], label: im[2] })
  if (items.length) groups.push({ key, items })
}

// 레퍼런스 스펙 빌드(productReferences.ts 와 동일 로직).
const refs = []
for (const g of groups) {
  const scenes = (groupScenes[g.key] || groupScenes.cards).slice(0, perProduct)
  for (const item of g.items) {
    scenes.forEach((sc, idx) => {
      refs.push({ id: `ref-${item.slug}-${idx + 1}`, slug: item.slug, label: item.label, groupKey: g.key, scene: sc.scene })
    })
  }
}

let targets = refs
if (slugsArg) {
  const set = new Set(slugsArg.split(','))
  targets = refs.filter((r) => set.has(r.slug))
} else if (group !== 'all') {
  targets = refs.filter((r) => r.groupKey === group)
}

function buildPrompt(ref) {
  return [
    `Ultra-realistic commercial product photography of ${ref.label.toLowerCase()} for a premium American print shop.`,
    `Scene direction: ${ref.scene}.`,
    `Beautiful styled background, soft directional studio lighting, shallow depth of field, true-to-life paper texture and print finish, crisp macro detail, magazine-quality, modern and elegant.`,
    `IMPORTANT: the product surface is blank or shows only abstract non-readable decorative marks. Absolutely no real text, no readable words, no letters, no numbers, no logos, no brand names, no statistics, no phone numbers, no QR codes.`,
    `Square 1:1 composition. No watermark, no border, no UI, photoreal only.`,
  ].join(' ')
}

console.log(`base=${baseUrl} group=${group} targets=${targets.length} (groups=${groups.length})`)

const manifest = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {}
let ok = 0
let fail = 0

async function genOne(ref, attempt = 1) {
  try {
    const res = await fetch(`${baseUrl}/api/studio/gen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-studio-secret': secret },
      body: JSON.stringify({ id: ref.id, prompt: buildPrompt(ref) }),
    })
    const json = await res.json()
    if (res.ok && json.url) {
      const arr = manifest[ref.slug] || []
      if (!arr.includes(json.url)) arr.push(json.url)
      manifest[ref.slug] = arr
      fs.writeFileSync(OUT, JSON.stringify(manifest, null, 2) + '\n')
      console.log(`✓ ${ref.id} [${json.model}] ${json.bytes}B ${json.url}`)
      ok++
      return
    }
    throw new Error(`${res.status} ${JSON.stringify(json).slice(0, 300)}`)
  } catch (e) {
    if (attempt < 3) {
      console.log(`… retry ${ref.id} (${attempt}) — ${e.message.slice(0, 120)}`)
      await new Promise((r) => setTimeout(r, 2500 * attempt))
      return genOne(ref, attempt + 1)
    }
    console.error(`✗ ${ref.id} — ${e.message.slice(0, 300)}`)
    fail++
  }
}

for (const t of targets) {
  await genOne(t)
}

console.log(`\nDONE ok=${ok} fail=${fail} total=${targets.length}`)
console.log(`manifest: ${OUT} (${Object.keys(manifest).length} slugs)`)
