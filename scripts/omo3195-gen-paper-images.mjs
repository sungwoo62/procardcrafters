// OMO-3195: 용지 선택 팝업(PaperPopup)에 재질 샘플 사진을 채운다.
// 보드 지시 — "그 제미나이로 걸어둔거(GOOGLE_GEMINI_API_KEY)로 이미지 생성해".
//
// 동작:
//   1) ListModels 로 이미지 출력(generateContent) 가능한 Gemini 모델 자동 탐색
//      (모델명 하드코딩 회피 — chat-llm.ts 패턴 재사용).
//   2) 용지 "패밀리"별(스노우/아트/코튼/크라프트/반누보/랑데뷰… 16종) 사진 1장씩 생성.
//      gsm 만 다른 코드(SNW120 vs SNW300)는 스와치 사진이 동일하므로 패밀리로 묶어
//      112개 코드 → 16장으로 압축(거의 동일한 렌더 반복 방지).
//   3) Supabase Storage `products/paper/{slug}.jpg` 업로드(service_role).
//   4) 업로드 성공 slug 로 src/config/paper-images.ts 의 GENERATED_PAPER_IMAGES 갱신.
//
// 사용:
//   node scripts/omo3195-gen-paper-images.mjs --dry-run   # 프롬프트/모델만 출력
//   node scripts/omo3195-gen-paper-images.mjs             # 생성+업로드+config 갱신
//   node scripts/omo3195-gen-paper-images.mjs --only matte-coated,kraft
//
// 환경변수(.env.local): GOOGLE_GEMINI_API_KEY, NEXT_PUBLIC_SUPABASE_URL,
//   SUPABASE_SERVICE_ROLE_KEY. 키는 Vercel Production(sensitive)이라 pull 시 마스킹됨 →
//   로컬 .env.local 에 실제 값이 있어야 한다(보드 제공 게이트).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// --- .env.local 로드(의존성 없이) ---
function loadEnv() {
  try {
    const raw = readFileSync(join(ROOT, '.env.local'), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {
    /* env 파일 없으면 process.env 그대로 사용 */
  }
}
loadEnv()

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const BUCKET = 'products'
const STORAGE_PREFIX = 'paper'

const DRY = process.argv.includes('--dry-run')
const onlyArg = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1]
  ?? (process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null)
const ONLY = onlyArg ? new Set(onlyArg.split(',').map((s) => s.trim())) : null

// 공통 사진 스타일 — 데스크에 놓인 종이 스와치를 위에서 비스듬히 촬영한 매크로.
const STYLE =
  'Professional product macro photograph of a single rectangular paper/card stock swatch ' +
  'lying flat on a clean neutral light-gray studio surface, shot slightly from above at a ' +
  '30-degree angle with soft diffused daylight that reveals the surface texture and a gentle ' +
  'edge shadow showing thickness. Square 1:1 framing, the swatch fills ~80% of the frame, ' +
  'shallow depth of field, no text, no logos, no hands, no props. Photorealistic, high detail.'

// 패밀리: slug 는 paper-display.ts 의 img 슬러그와 반드시 일치.
const FAMILIES = [
  { slug: 'matte-coated', desc: 'pure bright-white smooth matte coated paper with a clean non-glare finish' },
  { slug: 'glossy-coated', desc: 'bright-white glossy coated paper with a reflective high-sheen surface' },
  { slug: 'rendezvous', desc: 'premium natural-white uncoated designer paper with an ultra-smooth fine surface' },
  { slug: 'vent-nouveau', desc: 'soft warm-white uncoated fine-art paper with a delicate subtle tooth' },
  { slug: 'stardream', desc: 'pearlescent metallic shimmer card stock that catches light with a soft silver-pearl glow' },
  { slug: 'majestic', desc: 'luxury pearl-metallic card stock with a subtle satin sheen' },
  { slug: 'felt-art', desc: 'heavy felt-textured uncoated art card stock with a visible tactile felt grain' },
  { slug: 'ultra-smooth', desc: 'ultra-smooth ultra-bright-white premium card stock with a perfectly even modern surface' },
  { slug: 'metallic-specialty', desc: 'specialty metallic paper with a fine modern shimmer finish' },
  { slug: 'linen', desc: 'linen-embossed card stock with a woven cloth-like crosshatch texture' },
  { slug: 'pearlescent', desc: 'pearlescent coated card stock with a soft iridescent shimmer' },
  { slug: 'kraft', desc: 'natural brown kraft paper with a rustic uncoated recycled fiber texture' },
  { slug: 'synthetic-film', desc: 'slightly translucent waterproof white synthetic yupo film sheet with a smooth plastic-like surface' },
  { slug: 'woodfree', desc: 'uncoated white woodfree office paper with a natural matte writable surface' },
  { slug: 'cotton', desc: 'thick natural cotton card stock with a soft fibrous tactile texture, slightly off-white' },
  { slug: 'pvc-banner', desc: 'heavy white PVC vinyl banner material with a faint woven scrim texture' },
]

function fail(msg) {
  console.error(`\n✗ ${msg}\n`)
  process.exit(1)
}

async function resolveImageModel(apiKey) {
  if (process.env.GEMINI_IMAGE_MODEL) return process.env.GEMINI_IMAGE_MODEL.replace(/^models\//, '')
  const res = await fetch(`${GEMINI_BASE}/models?key=${apiKey}`)
  if (!res.ok) fail(`ListModels ${res.status} — 키가 유효한지/Generative Language API 활성인지 확인`)
  const data = await res.json()
  const models = data.models ?? []
  const imageCapable = models.filter(
    (m) =>
      (m.supportedGenerationMethods ?? []).includes('generateContent') &&
      /image/i.test(m.name) &&
      !/embedding/i.test(m.name),
  )
  console.log(`  이미지 출력 가능 후보: ${imageCapable.map((m) => m.name).join(', ') || '(없음)'}`)
  // gemini-*-image(나노바나나) 우선, 없으면 첫 후보.
  const pick =
    imageCapable.find((m) => /gemini.*image/i.test(m.name) && /pro/i.test(m.name)) ??
    imageCapable.find((m) => /gemini.*image/i.test(m.name)) ??
    imageCapable[0]
  if (!pick) {
    fail(
      '이미지 생성 가능한 Gemini 모델을 찾지 못함. 프로비저닝된 키가 텍스트 전용(chat)일 수 있음.\n' +
        '  → 보드: Google AI Studio 에서 이미지 모델(gemini-*-image / imagen-*) 접근이 켜진 키인지 확인 필요.',
    )
  }
  return pick.name.replace(/^models\//, '')
}

async function generateImage(apiKey, model, family) {
  const prompt = `${STYLE} The swatch is ${family.desc}.`
  if (DRY) {
    console.log(`  [dry] ${family.slug}: ${prompt.slice(0, 90)}…`)
    return null
  }
  const url = `${GEMINI_BASE}/models/${model}:generateContent?key=${apiKey}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'] },
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`generateContent ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = await res.json()
  const parts = data.candidates?.[0]?.content?.parts ?? []
  const img = parts.find((p) => p.inlineData?.data)?.inlineData
  if (!img) throw new Error('응답에 inlineData(이미지) 없음')
  return { buf: Buffer.from(img.data, 'base64'), mime: img.mimeType || 'image/png' }
}

const LOCAL_OUT = join(__dirname, '.paper-out')

async function uploadToStorage(buf, mime, slug) {
  // 로컬 사본 저장(눈검수/디버그용) — .gitignore 권장.
  mkdirSync(LOCAL_OUT, { recursive: true })
  writeFileSync(join(LOCAL_OUT, `${slug}.jpg`), buf)

  const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SR = process.env.SUPABASE_SERVICE_ROLE_KEY
  // URL 은 .jpg 로 고정하되 content-type 은 실제 mime(보통 image/png)로 설정 → 브라우저 정상 렌더.
  const path = `${STORAGE_PREFIX}/${slug}.jpg`
  const res = await fetch(`${SUPA}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SR}`,
      apikey: SR,
      'Content-Type': mime,
      'x-upsert': 'true',
    },
    body: buf,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`storage upload ${res.status}: ${body.slice(0, 200)}`)
  }
  return path
}

function updateConfig(slugs) {
  const cfgPath = join(ROOT, 'src/config/paper-images.ts')
  let src = readFileSync(cfgPath, 'utf8')
  const set = `new Set<string>([\n${slugs.map((s) => `  '${s}',`).join('\n')}\n])`
  src = src.replace(/new Set<string>\(\[[\s\S]*?\]\)/, set)
  writeFileSync(cfgPath, src)
  console.log(`  ✓ paper-images.ts 갱신 (${slugs.length} family)`)
}

async function main() {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY
  if (!DRY && (!apiKey || apiKey.length < 10))
    fail('GOOGLE_GEMINI_API_KEY 없음/마스킹됨 — .env.local 에 실제 값 필요(Vercel pull 은 sensitive 마스킹)')
  if (!DRY && (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY))
    fail('SUPABASE URL / SERVICE_ROLE_KEY 없음')

  const targets = FAMILIES.filter((f) => !ONLY || ONLY.has(f.slug))
  console.log(`\nOMO-3195 용지 샘플 이미지 생성 — ${targets.length} family${DRY ? ' (dry-run)' : ''}`)

  const model = DRY ? '(dry)' : await resolveImageModel(apiKey)
  if (!DRY) console.log(`  모델: ${model}\n`)

  const done = []
  for (const f of targets) {
    try {
      const out = await generateImage(apiKey, model, f)
      if (DRY) continue
      const path = await uploadToStorage(out.buf, out.mime, f.slug)
      done.push(f.slug)
      console.log(`  ✓ ${f.slug} → ${path} (${(out.buf.length / 1024).toFixed(0)}KB, ${out.mime})`)
    } catch (e) {
      console.error(`  ✗ ${f.slug}: ${e.message}`)
    }
  }

  if (!DRY && done.length) {
    // ONLY 모드면 기존 + 신규 합집합, 전체 모드면 done 그대로.
    updateConfig(done)
    console.log(`\n완료: ${done.length}/${targets.length} family 업로드.`)
    console.log('다음: tsc/lint → PR 프리뷰 → 보드 눈검수(이미지 적합성).')
  }
}

main()
