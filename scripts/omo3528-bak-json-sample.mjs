// OMO-3528 #2 선행 데이터: 박 카테고리별 함수 승격용 런타임 JSON 표집.
//
// 목적: finishing-surcharge 박 단가를 단일 ratePerMm2(명함 1점 근사)에서 카테고리별
//   함수(CNC/CST/CPR/CLF)로 승격하려면, 박 unit 의 런타임 의존값
//   (ppBakJsonOBJ: bak_type 별 material_unit2 / extra_rate / chk_size_low/high)을
//   카테고리별로 1회 표집해야 한다 (FINISHING-FORMULA-RE.md ④, 후속 1).
//
// 결정론/안전:
//   - 공개 GET/POST(json_data)만. 실주문/결제/파일업로드 0. (probe = omo3142 동일 패턴)
//   - 가격 OCR/추론 금지 — 응답 JSON 의 박 관련 키를 그대로 덤프(원천 그대로 적재 검수용).
//
// 산출물: scripts/test-artifacts/omo3528/bak-json-{CATEGORY}.json + SUMMARY.json
//
// 실행: node scripts/omo3528-bak-json-sample.mjs

import { writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const BASE = 'https://www.swadpia.co.kr'
const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, 'test-artifacts', 'omo3528')

// RE 문서 ④ 표의 대표 카테고리. CLF=전단(CNC계열), CST=스티커, CPR=포스터.
const CATEGORIES = [
  { code: 'CNC1000', label: '명함(회귀 기준)' },
  { code: 'CST1000', label: '스티커' },
  { code: 'CPR1000', label: '포스터' },
  { code: 'CLF2000', label: '전단/브로셔' },
]

// 박/형압/동판 단가에 관여하는 런타임 키 후보(존재하는 것만 덤프).
const BAK_KEYS = [
  'bak_info', 'ppBak', 'ppBakJson', 'pp_bak_info', 'bak_material_info',
  'bak_type_info', 'dongpan_info', 'ap_info', 'pp_info', 'postpress_info',
]

async function fetchJsonData(code) {
  const body = new URLSearchParams({
    t: String(Math.floor(Date.now() / 1000)),
    product: 'name',
    category_code: code,
  })
  const res = await fetch(`${BASE}/estimate/estimate_goods/json_data`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: `${BASE}/goods/goods_view/${code}`,
      'User-Agent': 'Mozilla/5.0 (compatible; ProcardcraftersPriceBot/1.0)',
    },
    body: body.toString(),
  })
  if (!res.ok) return { ok: false, status: res.status }
  const raw = await res.json()
  return { ok: true, raw }
}

// 응답에서 박 관련 키만 추려 덤프(전체 응답은 큼). 키 미발견 시 top-level 키 목록을 남겨
// 다음 패스에서 후보를 좁힌다(정직한 부분-표집).
function extractBak(raw) {
  const found = {}
  for (const k of BAK_KEYS) if (raw[k] !== undefined) found[k] = raw[k]
  return {
    bakKeysFound: Object.keys(found),
    topLevelKeys: Object.keys(raw),
    bak: found,
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const summary = []
  for (const { code, label } of CATEGORIES) {
    try {
      const r = await fetchJsonData(code)
      if (!r.ok) {
        summary.push({ code, label, ok: false, status: r.status })
        continue
      }
      const extracted = extractBak(r.raw)
      await writeFile(
        join(OUT_DIR, `bak-json-${code}.json`),
        JSON.stringify(extracted, null, 2),
      )
      summary.push({
        code, label, ok: true,
        bakKeysFound: extracted.bakKeysFound,
        topLevelKeys: extracted.topLevelKeys,
      })
    } catch (e) {
      summary.push({ code, label, ok: false, error: String(e?.message || e) })
    }
  }
  await writeFile(join(OUT_DIR, 'SUMMARY.json'), JSON.stringify(summary, null, 2))
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(summary, null, 2))
}

main()
