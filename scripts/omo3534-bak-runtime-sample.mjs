// OMO-3534 #2: 박 카테고리별 단가 함수 승격 — ppBakJsonOBJ 런타임 표집.
//
// 목적: getBakPriceUnit(CNC1000 RAW 1688행)의 유일 런타임 의존값
//   ppBakJsonOBJ.pp_bak_info[type=='material_unit'][bak_type] →
//   { material_unit2, extra_rate, chk_size_low, chk_size_high }
//   를 카테고리(CNC/CST/CPR/CLF)별로 READ-ONLY 표집한다.
//   나머지 박 단가식(work_price/extra_unit/paper_max/dongpan)은 정적 RE 로 확정됨.
//
// 결정론/안전:
//   - 공개 GET + 폼 populate 만. 주문 제출/결제/파일업로드 0. (OMO-2961 probe 패턴)
//   - 가격 OCR/추론 금지 — ppBakJsonOBJ 원천 JSON 을 그대로 덤프(적재 검수용).
//
// 실행(playwright 는 projects/procardcrafters clone 에, 크레덴셜은 메인 repo .env.local):
//   cd /Users/william/projects/procardcrafters && \
//   node --env-file=/Users/william/procardcrafters/.env.local \
//     /Users/william/projects/pccf-omo3528/scripts/omo3534-bak-runtime-sample.mjs

import * as fs from 'node:fs'

const BASE = 'https://www.swadpia.co.kr'
const OUT = '/Users/william/projects/pccf-omo3528/scripts/test-artifacts/omo3534'

// RE ④ 표의 대표 카테고리. 박 단가식 계열: CNC/CLF=명함계열, CST=스티커, CPR=포스터.
const CATEGORIES = ['CNC1000', 'CST1000', 'CPR1000', 'CLF2000']

function pickFirstReal(page, name) {
  return page.evaluate((n) => {
    const el = document.querySelector(`select[name="${n}"]`)
    if (!el) return null
    const o = Array.from(el.options).find((x) => x.value && x.value !== '' && x.value !== '0')
    if (!o) return null
    el.value = o.value
    el.dispatchEvent(new Event('change', { bubbles: true }))
    return o.value
  }, name)
}

async function dumpBak(page) {
  return page.evaluate(() => {
    const w = window
    const out = { hasObj: false }
    try {
      const obj = w.ppBakJsonOBJ
      out.hasObj = obj != null
      out.raw = obj ?? null
      // pp_bak_info[type=='material_unit'] 만 추려 bak_type 별 핵심 4값 정리.
      if (obj && Array.isArray(obj.pp_bak_info)) {
        out.materialUnits = obj.pp_bak_info
          .filter((r) => r && r.type === 'material_unit')
          .map((r) => ({
            bak_type: r.bak_type,
            material_unit2: r.material_unit2,
            extra_rate: r.extra_rate,
            chk_size_low: r.chk_size_low,
            chk_size_high: r.chk_size_high,
          }))
        out.ppBakInfoTypes = [...new Set(obj.pp_bak_info.map((r) => r && r.type))]
      }
    } catch (e) {
      out.error = String(e)
    }
    // bak_type select 옵션(어떤 bak_type 코드가 존재하는지)
    const sel = document.querySelector('select[name="bak_type"], select[name="bak_type_1"]')
    if (sel) out.bakTypeOptions = Array.from(sel.options).map((o) => ({ value: o.value, label: (o.textContent || '').trim() }))
    return out
  })
}

async function probeCategory(page, code) {
  const res = { code, ok: false }
  await page.goto(`${BASE}/goods/goods_view/${code}/1`, { waitUntil: 'networkidle', timeout: 45000 })

  // 1) 용지/사이즈 대표값 선택(박 폼 populate 의존). 카테고리별 select 이름이 달라 후보 모두 시도.
  const selected = {}
  for (const f of ['paper_kind', 'paper_code', 'paper_type', 'paper_size', 'size_code', 'goods_size']) {
    const v = await pickFirstReal(page, f)
    if (v != null) selected[f] = v
    await page.waitForTimeout(400)
  }
  res.selected = selected

  // 2) 박 활성화 + 사이즈 입력(getBakPriceUnit 진입 조건: bak_x/y>0).
  res.bakActivation = await page.evaluate(() => {
    const w = window
    const log = []
    const chk = document.getElementById('chk_is_bak')
    if (chk) {
      chk.checked = true
      chk.dispatchEvent(new Event('click', { bubbles: true }))
      chk.dispatchEvent(new Event('change', { bubbles: true }))
      log.push('chk_is_bak clicked')
    } else log.push('no chk_is_bak')
    for (const fn of ['setIsPostpress', 'chgBak', 'setBak', 'settingBakType']) {
      try { if (typeof w[fn] === 'function') { w[fn]('bak'); log.push(`${fn}('bak') called`) } } catch (e) { log.push(`${fn} err`) }
    }
    // 박 사이즈 입력
    for (const [id, val] of [['bak_x_size_1', '40'], ['bak_y_size_1', '20'], ['bak_x_size', '40'], ['bak_y_size', '20']]) {
      const el = document.getElementById(id)
      if (el) { el.value = val; el.dispatchEvent(new Event('change', { bubbles: true })) }
    }
    try { w.product1 && w.product1.calcuEstimate && w.product1.calcuEstimate() } catch { /* */ }
    return log
  })
  await page.waitForTimeout(1500)

  const bak = await dumpBak(page)
  res.bak = bak
  res.ok = bak.hasObj === true
  return res
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const summary = []
  try {
    // 로그인(ppBakJsonOBJ 는 런타임 populate → 로그인 세션 필요할 수 있음)
    await page.goto(`${BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.fill('input[name="member_id"]', process.env.SWADPIA_USERNAME)
    await page.fill('input[name="member_pw"]', process.env.SWADPIA_PASSWORD)
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {}),
      page.click('#icon_member_login'),
    ])
    await page.waitForTimeout(2500)
    const loggedIn = !page.url().includes('/member/login')

    for (const code of CATEGORIES) {
      let r
      try { r = await probeCategory(page, code) } catch (e) { r = { code, ok: false, error: String(e) } }
      fs.writeFileSync(`${OUT}/bak-runtime-${code}.json`, JSON.stringify(r, null, 2))
      summary.push({
        code: r.code,
        ok: r.ok,
        hasObj: r.bak?.hasObj ?? false,
        materialUnitCount: r.bak?.materialUnits?.length ?? 0,
        bakTypes: (r.bak?.materialUnits ?? []).map((m) => m.bak_type),
        error: r.error,
      })
    }
    fs.writeFileSync(`${OUT}/SUMMARY.json`, JSON.stringify({ loggedIn, summary }, null, 2))
    console.log(JSON.stringify({ loggedIn, summary }, null, 2))
  } finally {
    await browser.close()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
