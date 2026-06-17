// OMO-3417: printcity(dtp21) 명함 base 가격 매트릭스 — 클린 추출.
//
// 왜 별도 크롤러인가:
//   OMO-3414 census 의 baseByQty 는 product/{id}.productTypes[].price 를 수량축으로 병합하며
//   서로 다른 combo(용지×사이즈×도수×코팅)를 한 사다리에 뒤섞어 잡음(예 400→23600, 500→2500,
//   다수 0)이 끼었다. 라이브 고객가에 쓸 수 없다.
//   여기서는 productTypes[i] = "한 combo + 깨끗한 price[{quantity,value}] 사다리" 를 그대로 보존해
//   (용지 × 단/양면) canonical 사다리를 추출한다. 공개 GET·읽기전용, 가격 JSON 직독(OCR/LLM 금지).
//
// 출력: src/data/printcity-namecard-base-matrix.json
//   products[]: { id, ourSlug, defaultSize, defaultCoating, sizes[], papers[]{code,title,single{qty:v},double{qty:v}} }
//
// 실행: node scripts/omo3417-printcity-namecard-base-matrix.mjs
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const BASE = 'https://price-api.dtp21.com/v2'
const H = { Referer: 'https://printcity.co.kr/', Origin: 'https://printcity.co.kr' }
const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'src', 'data', 'printcity-namecard-base-matrix.json')

// PRODUCT_MAPPING(printcity-namecard.ts) 중 ourSlug 매핑된 + 가격표 적재된 제품(draft 제외).
const TARGETS = [
  { id: '61de7e13a36b0ec358946de3', ourSlug: 'business-cards', name: '일반지 명함' },
  { id: '63e4abde3374d8d1dc54458d', ourSlug: 'business-cards', name: '통합 명함' },
  { id: '690d5723122978358a481644', ourSlug: 'business-cards', name: '일반지 명함(이벤트)' },
  { id: '61d7e6ff4618a211d2069c9a', ourSlug: 'premium-business-cards', name: '수입지 명함' },
  { id: '6879cc61a67a79397627ad3c', ourSlug: 'premium-business-cards', name: '특가 수입지 명함' },
  { id: '61db8d7fb2fd4166089fa04d', ourSlug: 'premium-business-cards', name: 'VIP 명함' },
  { id: '61de95b8241774a67e60074f', ourSlug: 'premium-business-cards', name: '옵셋 카드명함' },
  { id: '6a05875bd6dd07b8536a14f8', ourSlug: 'premium-business-cards', name: '수입지 명함(이벤트)' },
  { id: '63db173890953943cfdafc94', ourSlug: 'premium-foil-cards', name: '엣지명함' },
  { id: '61e52abfabaed95eaaf08cb0', ourSlug: 'premium-foil-cards', name: '에폭엠보 명함' },
  { id: '61ef5b679b270074d7f1e369', ourSlug: 'uv-business-cards', name: '부분코팅 명함' },
  { id: '61de9be4241774a67e601af8', ourSlug: 'transparent-business-cards', name: 'PET카드 명함' },
]

async function getJson(path) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(`${BASE}/${path}`, { headers: H })
      if (r.ok) return r.json()
    } catch { /* retry */ }
    await new Promise((res) => setTimeout(res, 400 * (i + 1)))
  }
  throw new Error(`fetch failed: ${path}`)
}

// selectors 배열에서 축별 코드 추출(prefix 규약: COT/SIZ/MAT/COL).
function axis(selectors, prefix) {
  const s = (selectors || []).find((x) => (x.code || '').startsWith(prefix))
  return s ? { code: s.code, title: s.title } : null
}
function ladder(price) {
  const out = {}
  for (const p of price || []) {
    if (p.quantity > 0 && p.value > 0) out[p.quantity] = p.value
  }
  return out
}
function mostCommon(arr) {
  const m = new Map()
  for (const v of arr) m.set(v, (m.get(v) || 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

async function buildProduct(t) {
  const j = await getJson(`product/${t.id}`)
  const d = j.data || j
  const pts = d.productTypes || []
  // combo 메타 추출
  const combos = pts.map((pt) => ({
    coating: axis(pt.selectors, 'COT:'),
    size: axis(pt.selectors, 'SIZ:'),
    material: axis(pt.selectors, 'MAT:'),
    color: axis(pt.selectors, 'COL:'),
    ladder: ladder(pt.price),
  })).filter((c) => Object.keys(c.ladder).length > 0)

  if (combos.length === 0) return { id: t.id, ourSlug: t.ourSlug, name: t.name, papers: [], sizes: [], empty: true }

  // canonical 축 선택: 90×50 사이즈 우선, 코팅없음(COT:NO) 우선.
  const sizeCodes = combos.map((c) => c.size?.code).filter(Boolean)
  const defaultSize =
    sizeCodes.find((c) => /90X50|90x50/i.test(c)) || mostCommon(sizeCodes)
  const coatCodes = combos.map((c) => c.coating?.code).filter(Boolean)
  const defaultCoating = coatCodes.includes('COT:NO') ? 'COT:NO' : mostCommon(coatCodes)

  // 사이즈 목록(중복 제거)
  const sizeMap = new Map()
  for (const c of combos) if (c.size) sizeMap.set(c.size.code, c.size.title)
  const sizes = [...sizeMap.entries()].map(([code, title]) => ({ code, title }))

  // 용지별 canonical 사다리(단면 COL:40 / 양면 COL:44), 기준 사이즈·코팅 고정.
  const matMap = new Map()
  for (const c of combos) if (c.material) matMap.set(c.material.code, c.material.title)
  const papers = []
  for (const [code, title] of matMap) {
    const forMat = combos.filter((c) => c.material?.code === code)
    const atCanon = forMat.filter(
      (c) => c.size?.code === defaultSize && c.coating?.code === defaultCoating,
    )
    const pool = atCanon.length > 0 ? atCanon : forMat // canonical 조합 없으면 해당 용지 전체에서 fallback
    const single = pool.find((c) => c.color?.code === 'COL:40')?.ladder
      || pool.find((c) => !c.color || c.color.code === 'COL:40')?.ladder || {}
    const double = pool.find((c) => c.color?.code === 'COL:44')?.ladder || {}
    if (Object.keys(single).length || Object.keys(double).length) {
      papers.push({ code, title, single, double })
    }
  }

  return {
    id: t.id,
    ourSlug: t.ourSlug,
    name: t.name,
    defaultSize,
    defaultCoating,
    comboCount: combos.length,
    sizes,
    papers,
  }
}

async function main() {
  const products = []
  for (const t of TARGETS) {
    process.stderr.write(`crawl ${t.name} (${t.id}) ... `)
    try {
      const p = await buildProduct(t)
      products.push(p)
      process.stderr.write(`papers=${p.papers.length} sizes=${p.sizes?.length ?? 0}\n`)
    } catch (e) {
      products.push({ id: t.id, ourSlug: t.ourSlug, name: t.name, papers: [], sizes: [], error: String(e.message) })
      process.stderr.write(`ERR ${e.message}\n`)
    }
  }
  const out = {
    issue: 'OMO-3417',
    source: 'price-api.dtp21.com/v2/product/{id}.productTypes[] (공개 GET, 읽기전용, 가격 JSON 직독)',
    method: 'per-combo clean price ladder, canonical(defaultSize×defaultCoating)별 용지×단/양면 추출',
    capturedAt: new Date().toISOString(),
    note: '박(foil) 단가는 census foilTable(수량브래킷) 사용 — 본 매트릭스는 base 전용.',
    productCount: products.length,
    products,
  }
  writeFileSync(OUT, JSON.stringify(out))
  process.stderr.write(`\nwrote ${OUT} (${products.length} products)\n`)
}
main()
