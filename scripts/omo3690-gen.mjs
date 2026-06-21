// OMO-3690 · Ad Studio 이미지 배치 생성기.
// 배포된 /api/studio/gen 을 IG 항목별로 호출 → 생성 URL 을 src/config/studio-generated.json 에 적재.
// 명함류(category=cards) 우선. 사용:
//   STUDIO_GEN_SECRET=xxx node scripts/omo3690-gen.mjs [baseUrl] [--only=cards|all] [--ids=IG-01,IG-02]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const CONFIG = path.join(ROOT, 'src/config/adStudio.ts')
const OUT = path.join(ROOT, 'src/config/studio-generated.json')

const args = process.argv.slice(2)
const baseUrl = (args.find((a) => a.startsWith('http')) || 'https://procardcrafters.com').replace(/\/$/, '')
const only = (args.find((a) => a.startsWith('--only='))?.split('=')[1]) || 'cards'
const idsArg = args.find((a) => a.startsWith('--ids='))?.split('=')[1]
const secret = process.env.STUDIO_GEN_SECRET
if (!secret) {
  console.error('STUDIO_GEN_SECRET env required')
  process.exit(1)
}

// adStudio.ts 에서 id + category 추출(명함류 우선 정렬).
const src = fs.readFileSync(CONFIG, 'utf8')
const re = /id: '(IG-\d+)',[\s\S]{0,400}?category: '([a-z]+)'/g
const items = []
let m
while ((m = re.exec(src)) !== null) items.push({ id: m[1], category: m[2] })

let targets
if (idsArg) {
  const set = new Set(idsArg.split(','))
  targets = items.filter((it) => set.has(it.id))
} else if (only === 'cards') {
  targets = items.filter((it) => it.category === 'cards')
} else {
  // 'all' 이어도 명함류 먼저.
  targets = [...items].sort((a, b) => (a.category === 'cards' ? -1 : 1) - (b.category === 'cards' ? -1 : 1))
}

console.log(`base=${baseUrl} only=${only} targets=${targets.length}`)
console.log(targets.map((t) => t.id).join(', '))

const manifest = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {}
let ok = 0
let fail = 0

async function genOne(id, attempt = 1) {
  try {
    const res = await fetch(`${baseUrl}/api/studio/gen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-studio-secret': secret },
      body: JSON.stringify({ id }),
    })
    const json = await res.json()
    if (res.ok && json.url) {
      manifest[id] = json.url
      fs.writeFileSync(OUT, JSON.stringify(manifest, null, 2) + '\n')
      console.log(`✓ ${id} [${json.model}] ${json.bytes}B ${json.url}`)
      ok++
      return
    }
    throw new Error(`${res.status} ${JSON.stringify(json).slice(0, 300)}`)
  } catch (e) {
    if (attempt < 3) {
      console.log(`… retry ${id} (${attempt}) — ${e.message.slice(0, 120)}`)
      await new Promise((r) => setTimeout(r, 2500 * attempt))
      return genOne(id, attempt + 1)
    }
    console.error(`✗ ${id} — ${e.message.slice(0, 300)}`)
    fail++
  }
}

for (const t of targets) {
  await genOne(t.id)
}

console.log(`\nDONE ok=${ok} fail=${fail} total=${targets.length}`)
console.log(`manifest: ${OUT} (${Object.keys(manifest).length} entries)`)
