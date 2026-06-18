#!/usr/bin/env node
// OMO-3457 (보드 OMO-3452 지시 2026-06-18): printcity 명함 16제품의 후가공(addwork) 결선.
//
// 진실원천: price-api.dtp21.com/v2/addwork/all (1007건). 각 addwork:
//   - productId[] : 이 후가공이 직접 링크된 제품 id (우리 명함 16제품과 매칭)
//   - workTypeKO / workType / groupCode : 후가공 명/코드/그룹(박·형압·오시·미싱·타공·엠보싱·귀도리·넘버링…)
//   - price[] : { code:[옵션코드], value:[{min,max,value,calcValue}] } 수량 브래킷
//
// 가격 모델(전수 관찰):
//   - per_order(고정 셋업비): 박/박동판/형압/압동판/오시/미싱/넘버링/점자 — value 가 수량브래킷별로 증가.
//   - per_unit(매당): 타공/귀도리/엠보싱 — value 가 매당 단가(수량↑ 시 감소). surcharge = value × qty.
//   calcValue 는 전수 0 → value 가 해당 브래킷의 산출 금액.
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

// 옵션 코드 → 한국어 라벨(가격 아님, 표시용 큐레이션). printcity addwork/all 의 selecter.types 가
// 비어 있어(클라이언트 정적 사전) 코드 의미를 직접 매핑한다. 가격은 100% API 직독.
const CODE_LABEL = {
  'APS:1F': '앞면', 'APS:1B': '뒷면',
  'BKS:1F': '앞면', 'BKS:1B': '뒷면', 'BKS:2': '양면',
  'BKK:GOLD-GS': '금박(유광)', 'BKK:GOLD-MT': '금박(무광)',
  'BKK:SILVER-GS': '은박(유광)', 'BKK:SILVER-MT': '은박(무광)',
  'BKK:RED': '적박', 'BKK:BLUE': '청박', 'BKK:GREEN': '녹박', 'BKK:BLACK': '먹박',
  'BKK:PEARL3': '펄박', 'BKK:HOLOGRAM3': '홀로그램박', 'BKK:DONG': '동박', 'BKK:REDGOLD': '로즈골드박',
  'EBS:1F': '앞면', 'EBS:1B': '뒷면', 'EBS:2': '양면',
  'EBK:BLACK': '흑색', 'EBK:TRANSPARENT': '투명(무색)',
  'GDR:4': '라운드 R4', 'GDR:6': '라운드 R6',
  'OSL:1': '1선', 'OSL:2': '2선', 'OSL:3': '3선', 'OSL:C1': '곡선',
  'MSL:1': '1선', 'MSL:2': '2선', 'MSL:3': '3선', 'MSL:C1': '곡선',
  'TGR:3': '⌀3mm', 'TGR:4': '⌀4mm', 'TGR:5': '⌀5mm', 'TGR:7': '⌀7mm',
  'TGH:1': '1개', 'TGH:2': '2개',
  'NBC:1': '1개소', 'NBC:2': '2개소',
  'LESS-250': '250매 이하', 'OVER-250': '250매 초과', 'LESS-300': '300매 이하', 'OVER-300': '300매 초과',
}

function optionLabel(codes) {
  if (!codes || codes.length === 0) return '기본'
  return codes.map((c) => CODE_LABEL[c] || c).join(' · ')
}

function compactBrackets(value = []) {
  return value
    .map((v) => ({ min: v.min ?? 0, max: v.max ?? 0, v: v.value }))
    .filter((b) => typeof b.v === 'number')
}

async function main() {
  const pricing = JSON.parse(readFileSync(new URL('../src/data/printcity-namecard-pricing.json', import.meta.url)))
  const namecards = pricing.products.map((p) => ({ id: p.id, nameKO: p.nameKO }))
  const idSet = new Set(namecards.map((n) => n.id))

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
      const options = (a.price || [])
        .map((pr) => ({ codes: pr.code || [], label: optionLabel(pr.code), brackets: compactBrackets(pr.value) }))
        .filter((o) => o.brackets.length > 0)
      if (options.length === 0) continue
      // 표시명: workTypeKO 의 적용제품 접미사 제거(예 "박-명함_안내장"→"박", "박동판-명함_안내장"→"박동판").
      const name = String(a.workTypeKO || '').split('-')[0].trim() || a.workTypeKO
      works.push({
        workType: a.workType,
        group: a.groupCode || a.workTypeKO,
        name,
        label: a.workTypeKO,
        pricing: PER_UNIT.has(a.workType) ? 'per_unit' : 'per_order',
        options,
      })
    }
    totalLinks += works.length
    products.push({ id: nc.id, nameKO: nc.nameKO, works })
    console.log(`  ${nc.nameKO}: ${works.length} works -> ${works.map((w) => w.group).join(', ') || '(없음)'}`)
  }

  const out = {
    issue: 'OMO-3457',
    source: 'printcity 후가공 — price-api.dtp21.com/v2/addwork/all (productId 직접 링크 매칭)',
    method: 'addwork.productId[] ∋ 명함제품id 인 항목만. 가격=price[].value 브래킷 직독. per_unit(타공/귀도리/엠보싱)=매당, 그외=주문당 고정. OCR/LLM 미사용, 읽기전용.',
    capturedAt: '__STAMP__',
    productCount: products.length,
    totalWorkLinks: totalLinks,
    products,
  }
  const path = new URL('../src/data/printcity-namecard-finishing.json', import.meta.url)
  writeFileSync(path, JSON.stringify(out))
  console.log(`\n✅ ${products.length}제품 / ${totalLinks} work-links → src/data/printcity-namecard-finishing.json`)
}
main()
