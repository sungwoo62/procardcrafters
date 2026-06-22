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

// OMO-3751(보드 재요청): "용지별 질감 디테일·텍스쳐를 상세하게, 실사진처럼."
// 핵심 변경 — ① 익스트림 매크로 + 측면 raking light(빗각 조명)로 표면 결/요철을 그림자로 드러냄
//   ② 스와치가 프레임을 가득 채워 표면 질감 자체가 주제(데스크 소품 사진 아님)
//   ③ 패밀리별 desc 를 실제 레퍼런스(성원/Takeo/Fedrigoni/Cordenons/Arjowiggins/Yupo)
//      에서 확인한 색조·결·광택·섬유 패턴으로 구체화(OMO-3751 레퍼런스 리서치).
const STYLE =
  'Ultra-detailed photorealistic extreme macro photograph of a single sheet of paper/card stock, ' +
  'the sheet filling the entire frame so its surface texture is the subject. Lit by soft grazing ' +
  'raking light from one side so the micro-relief, grain, fibers and finish are revealed through ' +
  'fine highlights and shadows, with one clean cut edge visible at the bottom showing the sheet ' +
  'thickness. Tack-sharp focus across the surface, true-to-life color, natural studio lighting, ' +
  'no glare blowout. Square 1:1 framing, no text, no logos, no print, no hands, no props. ' +
  'Looks like a real high-resolution product swatch photo, not an illustration or render.'

// 패밀리: slug 는 paper-display.ts 의 img 슬러그와 반드시 일치.
// desc = 매크로 사진에서 보여야 할 색조·결·광택·섬유/엠보스 패턴(레퍼런스 확인 기반).
const FAMILIES = [
  { slug: 'matte-coated', desc: 'bright neutral-white fully-coated matte stock with a flat micro-fine tooth, no visible fibers, a low diffuse non-glare sheen that softly scatters light with no specular hotspots, and a clean square-cut edge' },
  { slug: 'glossy-coated', desc: 'cool bright-white mirror-smooth clay-coated stock with high specular gloss and sharp light reflections, zero visible fiber or grain, a slick wet-look sheen and a crisp glossy cut edge' },
  { slug: 'rendezvous', desc: 'bright cool-white premium uncoated designer stock (Hansol Rendezvous) with a very faint smooth tooth and a matte glare-free surface, subtle soft microtexture rather than a pattern, no clay sheen, and a dense thick board edge with a slightly fuzzy cut' },
  { slug: 'vent-nouveau', desc: 'soft warm off-white cream uncoated fine paper (Takeo Vent Nouveau) with a delicate fine non-uniform grain, an airy bulky body, a low matte sheen and a thick lofty edge' },
  { slug: 'stardream', desc: 'pearlescent mica-infused metallic stock (Cordenons Stardream) in a soft silver-champagne tone, smooth with a luminous mother-of-pearl shimmer that travels and shifts with the angle, fine even grain and iridescent specular sparkle' },
  { slug: 'majestic', desc: 'luxury pearl-metallic card (Favini Majestic) with a rich saturated pulp color overlaid by a lustrous mica pearl sheen, a smooth satin-to-shimmer glow with a faint gold/silver cast, denser and more vivid than a pale shimmer' },
  { slug: 'felt-art', desc: 'warm soft-white ivory uncoated felt-marked art stock (Fedrigoni Tintoretto) with a pronounced hammered felt texture — irregular dimpled tooth and macro-porous random grain, fully matte and non-reflective with visible cottony fiber and a thick soft fibrous edge' },
  { slug: 'ultra-smooth', desc: 'very bright cool-white ultra-smooth uncoated wove premium stock with almost no visible tooth or fiber, a near-flat matte-to-low-satin sheen, perfectly even tone and a crisp sharp white cut edge' },
  { slug: 'metallic-specialty', desc: 'specialty metallic wove stock (Arjowiggins Curious Metallics) in a warm-to-cool white with a slightly rough natural tooth carrying an all-over fine iridescent metallic shimmer that glints over the wove grain on both sides' },
  { slug: 'linen', desc: 'soft white linen-embossed card with a regular fine evenly-spaced crosshatch weave mimicking woven cloth, matte and non-reflective with subtle shadow in the grooves and a thick stiff card edge' },
  { slug: 'pearlescent', desc: 'smooth pearlescent coated card with an even satin pearl sheen and a soft iridescent shimmer that brightens at glancing angles, no visible texture or fiber, a uniform lustrous glow and a clean coated edge' },
  { slug: 'kraft', desc: 'warm muted tan-brown uncoated kraft stock with a slightly rough natural surface showing flecks of darker wood-pulp fibers, fully matte with no sheen, a mottled fibrous grain and a thick fuzzy raw edge' },
  { slug: 'synthetic-film', desc: 'opaque bright neutral-white plastic-like polypropylene synthetic sheet (Yupo), perfectly ultra-smooth and non-porous with no fiber, grain or tooth, a soft even matte luster and a clean fused plastic edge with no fuzz' },
  { slug: 'woodfree', desc: 'plain warm-white slightly off-white uncoated woodfree office stock with a fine even tooth and faint fiber texture, a flat matte no-sheen surface, uniform mild grain and a thin clean cut edge' },
  { slug: 'cotton', desc: 'soft warm bright-white cotton card with a luxurious cottony fine tooth and visible short random fibers, a thick plush fully-matte non-reflective surface and a deep substantial fibrous edge with a slightly feathery cut' },
  { slug: 'pvc-banner', desc: 'bright matte-white flexible PVC vinyl banner material with a faint regular scrim weave of reinforcing threads showing through, a low even semi-matte sheen, a smooth wipeable plastic surface and a thick rubbery cut edge' },
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
