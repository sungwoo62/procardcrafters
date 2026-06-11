// OMO-2903 ② 후가공 자동반영 — 변환 정합성 정적 검증(브라우저 불필요)
//   expandFinishingToSwadpiaFields 가 고객 후가공 선택을 성원 발주 폼 필드코드로
//   정확히 확장하는지 검증. 자동발주(mapped) 5종 + 런타임(runtime) 4종.
//   ⚠️ 실제 폼 자동채움(activateFinishings/Playwright)은 런타임 검증(omo2647) 별도.
//   여기서는 "변환 일치"(transform correctness)만 검증:
//     - mapped: 기본값이 매핑 fields[] 의 실제 성원 name 으로만 확장되는가
//     - runtime/needs_audit: 자동발주에서 올바르게 스킵되는가
//
// 실행: node --experimental-strip-types scripts/omo2903-finishing-transform-verify.ts
import {
  expandFinishingToSwadpiaFields,
  SWADPIA_FINISHING_FIELDS,
  SWADPIA_FINISHING_BY_VALUE,
  DEFAULT_FINISHING_FIELD_VALUES,
} from '../src/config/swadpia-finishing-fields.ts'

const MAPPED = ['foil_stamp', 'deboss_emboss', 'die_cut', 'drilled_hole', 'numbering']
const RUNTIME = ['round_corner', 'epoxy', 'score_crease', 'perforation']

type Row = {
  finishing: string
  label_ko: string
  status: string
  expandedFields: string[]
  // 검증: 확장된 모든 필드가 매핑 정의(fields[])에 존재하는 성원 name 인가
  allFieldsKnown: boolean
  unknownFields: string[]
  // 면적 의존(박/형압) 기본값 채워졌는가
  sizeDefaultsOk: boolean | null
  verdict: '✅' | '⚠️' | '❌'
  note: string
}

// 매핑 정의에 등장하는 모든 성원 필드 name 집합(면적필드 *_x_size_* / *_y_size_* 는
// fields[] 에 없지만 DEFAULT 에 의도적으로 추가됨 → 별도 허용).
function knownNamesFor(value: string): Set<string> {
  const m = SWADPIA_FINISHING_BY_VALUE[value]
  const names = new Set<string>()
  if (m) for (const f of m.fields) names.add(f.name)
  // 면적 기반 단가 필드(박/형압)는 fields[] 외 정당한 확장
  for (const n of ['bak_x_size_1', 'bak_y_size_1', 'ap_x_size_1', 'ap_y_size_1']) names.add(n)
  return names
}

const rows: Row[] = []

// 1) mapped 5종: 단일 확장 + 필드 정합성
for (const value of MAPPED) {
  const m = SWADPIA_FINISHING_BY_VALUE[value]
  const out = expandFinishingToSwadpiaFields({ finishing: value })
  const expandedFields = Object.keys(out).filter(k => k !== 'finishing')
  const known = knownNamesFor(value)
  const unknown = expandedFields.filter(f => !known.has(f))
  const defaults = DEFAULT_FINISHING_FIELD_VALUES[value] ?? {}
  const defaultKeys = Object.keys(defaults)
  // 기본값이 빠짐없이 확장됐는가
  const allDefaultsApplied = defaultKeys.every(k => out[k] === defaults[k])
  const sizeNeeded = value === 'foil_stamp' || value === 'deboss_emboss'
  const sizeOk = sizeNeeded
    ? (value === 'foil_stamp' ? !!out.bak_x_size_1 && !!out.bak_y_size_1 : !!out.ap_x_size_1 && !!out.ap_y_size_1)
    : null
  let verdict: Row['verdict'] = '✅'
  let note = '변환 정상 — 기본값이 성원 필드로 확장'
  if (unknown.length > 0) { verdict = '❌'; note = `미지정 성원 필드 확장: ${unknown.join(',')}` }
  else if (!allDefaultsApplied) { verdict = '❌'; note = '기본값 일부 누락' }
  else if (sizeNeeded && !sizeOk) { verdict = '⚠️'; note = '면적 기본값 누락 → 박/형압 surcharge=0 위험' }
  rows.push({
    finishing: value, label_ko: m?.label_ko ?? value, status: m?.status ?? '?',
    expandedFields, allFieldsKnown: unknown.length === 0, unknownFields: unknown,
    sizeDefaultsOk: sizeOk, verdict, note,
  })
}

// 2) runtime 4종: 자동발주에서 스킵(빈 확장)되어야 함
for (const value of RUNTIME) {
  const m = SWADPIA_FINISHING_BY_VALUE[value]
  const out = expandFinishingToSwadpiaFields({ finishing: value })
  const expandedFields = Object.keys(out).filter(k => k !== 'finishing')
  // runtime 은 DEFAULT_FINISHING_FIELD_VALUES 에 없어 확장 0 이 정상(런타임 추출 필요)
  const verdict: Row['verdict'] = expandedFields.length === 0 ? '✅' : '⚠️'
  rows.push({
    finishing: value, label_ko: m?.label_ko ?? value, status: m?.status ?? '?',
    expandedFields, allFieldsKnown: true, unknownFields: [],
    sizeDefaultsOk: null, verdict,
    note: expandedFields.length === 0
      ? '런타임 추출 필요 — 자동발주에서 올바르게 스킵(폼 사이즈선택 후 JS 채움)'
      : `예상외 확장: ${expandedFields.join(',')}`,
  })
}

// 3) 복합 선택(박+타공) 병합 검증
const combo = expandFinishingToSwadpiaFields({ finishing: 'foil_stamp,drilled_hole' })
const comboFields = Object.keys(combo).filter(k => k !== 'finishing')
const comboOk = !!combo.bak_section_1 && !!combo.tagong_num && !!combo.tagong_size
const comboRow = {
  case: '복합(박+타공)', expandedFields: comboFields, verdict: comboOk ? '✅' : '❌',
  note: comboOk ? '두 후가공 필드 모두 병합됨' : '병합 누락',
}

// 4) 명시 override 우선 검증(서브 선택 UI 시뮬)
const override = expandFinishingToSwadpiaFields({ finishing: 'foil_stamp', bak_type_1: 'BKT11' })
const overrideOk = override.bak_type_1 === 'BKT11'
const overrideRow = {
  case: '명시 override(bak_type_1=BKT11)', verdict: overrideOk ? '✅' : '❌',
  note: overrideOk ? '명시값이 기본값보다 우선' : 'override 실패',
  value: override.bak_type_1,
}

const summary = {
  generatedAt: new Date().toISOString(),
  mappedTotal: MAPPED.length,
  runtimeTotal: RUNTIME.length,
  needsAuditTotal: SWADPIA_FINISHING_FIELDS.filter(m => m.status === 'needs_audit').length,
  pass: rows.filter(r => r.verdict === '✅').length,
  warn: rows.filter(r => r.verdict === '⚠️').length,
  fail: rows.filter(r => r.verdict === '❌').length,
  rows, comboRow, overrideRow,
}

for (const r of rows) console.log(`[${r.label_ko}/${r.finishing}] ${r.verdict} (${r.status}) fields=${r.expandedFields.join(',') || '(none)'} — ${r.note}`)
console.log(`[복합] ${comboRow.verdict} ${comboRow.note}`)
console.log(`[override] ${overrideRow.verdict} ${overrideRow.note} (=${overrideRow.value})`)
console.log('\n' + JSON.stringify(summary, null, 2))
