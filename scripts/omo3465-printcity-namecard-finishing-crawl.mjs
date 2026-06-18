#!/usr/bin/env node
// OMO-3465 (보드 OMO-3452/OMO-3452 지시 2026-06-18): printcity 명함 후가공(addwork) **정밀 복제** 크롤.
//
// OMO-3457 v1 은 price[] 조합만 평탄화(side+color 한 줄 select)했다. 이 v2 는 printcity 실제 구동방식대로
// 각 addwork 의 **전 selecter**(codeCategory + select[{code,title,isHide}])와 price 조합(+calcValue)을
// 그대로 적재하여, 구성기에서 후가공별 다축 상세패널·isHide·의존성·면적가격을 재현할 수 있게 한다.
//
// 진실원천: price-api.dtp21.com/v2/addwork/all (1007건). 각 addwork:
//   - productId[]   : 이 후가공이 직접 링크된 제품 id(명함 16제품과 매칭)
//   - workTypeKO / workType / groupCode : 후가공 명/코드/그룹
//   - selecters[]   : { title, codeCategory, select:[{code,title,isHide?}] }  ← v1 에서 누락한 핵심
//   - price[]       : { code:[옵션코드 조합], value:[{min,max,value,calcValue}] } 수량 브래킷
//
// 관찰(명함 16제품 전수):
//   - calcValue 는 전 브래킷 0 → 명함 후가공은 면적종속 가격이 없다(박 사이즈는 생산스펙 입력, 가격 무영향).
//     calcValue≠0 인 타 제품을 대비해 스키마엔 calc 를 보존한다(가격식: v + calc×area).
//   - isHide:true = 숨김 옵션(예 embo EBK:BLACK '먹') → UI 비노출. 가격조합엔 남아있을 수 있다.
//   - 가격키: 어떤 selecter 가 가격에 참여하는지는 title 접미사(OnlySelect/OnlyPrice)가 아니라
//     "그 selecter 의 옵션코드가 price 조합에 실제 등장하는가"로 데이터 기반 판정(priceKeying).
//   - per_unit(매당): 타공/귀도리/엠보싱 — value=매당단가. 그외 per_order(주문당 고정 셋업비).
//
// 공개 GET·읽기전용. OCR/LLM 미사용, 실주문 없음. 헤더 Referer/Origin=printcity.co.kr.
import { writeFileSync, readFileSync } from 'node:fs'

const BASE = 'https://price-api.dtp21.com/v2'
const H = { Referer: 'https://printcity.co.kr/', Origin: 'https://printcity.co.kr' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function get(path) {
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(`${BASE}/${path}`, { headers: H })
      if (r.status === 200) return await r.json()
      if (r.status >= 500) { await sleep(600); continue }
      return { _httpError: r.status }
    } catch { await sleep(600) }
  }
  return { _httpError: 'retry-exhausted' }
}

// 매당 과금(per_unit) workType — 전수 관찰 기반 명시 분류.
const PER_UNIT = new Set(['tagong', 'guido', 'embo'])
// 박 사이즈(생산 스펙 입력: 박 면적 width×height mm)를 상세패널에서 받는 workType.
// printcity 박/형압/엠보 클릭 시 하단패널에 도안 사이즈 입력 → 생산용. 명함은 calcValue=0(가격 무영향).
const FOIL_SIZE_SPEC = new Set(['bak', 'ap', 'embo'])

// codeCategory title 의 가격/선택 접미사 제거(표시 정리용).
function cleanTitle(t) {
  return String(t || '').replace(/-?Only(Price|Select)/g, '').replace(/-+$/, '').trim()
}

function compactBrackets(value = []) {
  return value
    .map((v) => ({ min: v.min ?? 0, max: v.max ?? 0, v: v.value, calc: v.calcValue ?? 0 }))
    .filter((b) => typeof b.v === 'number')
}

async function main() {
  const pricing = JSON.parse(readFileSync(new URL('../src/data/printcity-namecard-pricing.json', import.meta.url)))
  const namecards = pricing.products.map((p) => ({ id: p.id, nameKO: p.nameKO }))

  const all = await get('addwork/all')
  const arr = all?.data || all
  if (!Array.isArray(arr)) { console.error('addwork/all 응답 이상:', all?._httpError); process.exit(1) }
  console.log(`addwork/all ${arr.length}건 로드`)

  const products = []
  let totalLinks = 0
  for (const nc of namecards) {
    const works = []
    for (const a of arr) {
      if (!(a.productId || []).includes(nc.id)) continue
      const priceCombos = (a.price || [])
        .map((pr) => ({ codes: pr.code || [], brackets: compactBrackets(pr.value) }))
        .filter((c) => c.brackets.length > 0)
      if (priceCombos.length === 0) continue

      // price 조합에 등장하는 모든 코드 → 가격키 판정용 집합.
      const pricedCodes = new Set(priceCombos.flatMap((c) => c.codes))

      const selecters = (a.selecters || []).map((s) => {
        const select = (s.select || [])
          .filter((o) => o.isHide !== true) // 숨김 옵션 제외(printcity 비노출)
          .map((o) => ({ code: o.code, titleKO: o.title }))
        // 이 selecter 의 (표시되는) 옵션 코드가 price 조합에 등장하면 가격키.
        const priceKeying = select.some((o) => pricedCodes.has(o.code))
        return { codeCategory: s.codeCategory, titleKO: cleanTitle(s.title), priceKeying, select }
      }).filter((s) => s.select.length > 0)

      const name = String(a.workTypeKO || '').split('-')[0].trim() || a.workTypeKO
      works.push({
        workType: a.workType,
        group: a.groupCode || a.workTypeKO,
        name,
        label: a.workTypeKO,
        pricing: PER_UNIT.has(a.workType) ? 'per_unit' : 'per_order',
        foilSizeSpec: FOIL_SIZE_SPEC.has(a.workType),
        selecters,
        priceCombos,
      })
    }
    totalLinks += works.length
    products.push({ id: nc.id, nameKO: nc.nameKO, works })
    console.log(`  ${nc.nameKO}: ${works.length} works -> ${works.map((w) => w.group).join(', ') || '(없음)'}`)
  }

  const out = {
    issue: 'OMO-3465',
    source: 'printcity 후가공 정밀복제 — price-api.dtp21.com/v2/addwork/all (productId 직접 링크 + 전 selecter)',
    method: 'addwork.productId[] ∋ 명함제품id. selecters[](codeCategory·select·isHide) + price[](code조합→수량브래킷+calcValue) 직독. priceKeying=옵션코드가 price조합 등장 여부. isHide:true 옵션 제외. OCR/LLM 미사용, 읽기전용.',
    schemaVersion: 2,
    capturedAt: '__STAMP__',
    productCount: products.length,
    totalWorkLinks: totalLinks,
    products,
  }
  const path = new URL('../src/data/printcity-namecard-finishing.json', import.meta.url)
  writeFileSync(path, JSON.stringify(out))
  console.log(`\n✅ v2 ${products.length}제품 / ${totalLinks} work-links → src/data/printcity-namecard-finishing.json`)
}
main()
