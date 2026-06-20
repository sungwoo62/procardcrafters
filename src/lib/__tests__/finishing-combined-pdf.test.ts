import { describe, it, expect } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import {
  FINISHING_REQUIRES_SPOT_PLATE,
  parseFinishingValues,
  listSpotPlateFinishings,
  requiresSpotPlate,
  getPdfPageCount,
  assertFinishingPlatePresent,
  expectedFinishingPageCount,
  buildCombinedFinishingPdf,
  mmToPt,
  type PlateImage,
} from '../finishing-combined-pdf'

// OMO-3568/OMO-3581: 별색 합본 PDF 파이프라인 — 교정 규격(위치보기용+인쇄[박제거]+박파일K100)
//   가드 + 합본 빌더 결정론 회귀.

// 1×1 투명 PNG (decode 가능한 최소 PNG)
const PNG_1x1 = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  ),
  (c) => c.charCodeAt(0),
)
const PNG_PLATE: PlateImage = { bytes: PNG_1x1, mime: 'image/png' }

async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pages; i++) doc.addPage([100, 100])
  return doc.save()
}

describe('FINISHING_REQUIRES_SPOT_PLATE — 별색판 요구 후가공 집합', () => {
  it('박/형압/도무송/에폭시/별색만 별색판을 요구한다', () => {
    expect([...FINISHING_REQUIRES_SPOT_PLATE].sort()).toEqual(
      ['deboss_emboss', 'die_cut', 'epoxy', 'foil_stamp', 'spot_color'].sort(),
    )
  })
  it('타공/넘버링/귀도리/오시/미싱/코팅은 별색판 불요', () => {
    for (const v of ['drilled_hole', 'numbering', 'round_corner', 'score_crease', 'perforation', 'coating']) {
      expect(FINISHING_REQUIRES_SPOT_PLATE.has(v)).toBe(false)
    }
  })
})

describe('parseFinishingValues / listSpotPlateFinishings / requiresSpotPlate', () => {
  it('finishing 없으면 빈 목록·요구 없음', () => {
    expect(parseFinishingValues({})).toEqual([])
    expect(requiresSpotPlate({})).toBe(false)
    expect(requiresSpotPlate(undefined)).toBe(false)
  })
  it('콤마 목록 파싱 + 별색판 후가공만 추출(순서·중복제거)', () => {
    const opts = { finishing: 'drilled_hole, foil_stamp ,die_cut,foil_stamp,coating' }
    expect(parseFinishingValues(opts)).toEqual(['drilled_hole', 'foil_stamp', 'die_cut', 'foil_stamp', 'coating'])
    expect(listSpotPlateFinishings(opts)).toEqual(['foil_stamp', 'die_cut'])
    expect(requiresSpotPlate(opts)).toBe(true)
  })
  it('별색판 불요 후가공만이면 요구 없음', () => {
    expect(requiresSpotPlate({ finishing: 'drilled_hole,numbering,coating' })).toBe(false)
  })
  // OMO-3578 회귀 가드: 자동발주 options_snapshot 은 finishing 키가 제거되고 성원
  // 필드코드(bak_·ap_·domusong_·epoxy_)만 남는다 → finishing value 만 보면 가드가
  // dead code 가 된다(별색판 없이 발주=손해). 확장 필드 prefix 로도 반드시 검출돼야 한다.
  it('확장 폼 필드 prefix(finishing 키 없는 실주문)에서 별색판 요구 검출', () => {
    expect(listSpotPlateFinishings({ bak_type_1: 'BKT01', bak_side_1: 'BKD10' })).toEqual(['foil_stamp'])
    expect(requiresSpotPlate({ bak_type_1: 'BKT01' })).toBe(true)
    expect(requiresSpotPlate({ ap_type_1: 'X' })).toBe(true)
    expect(requiresSpotPlate({ domusong_type: 'X' })).toBe(true)
    expect(requiresSpotPlate({ epoxy_type: 'X' })).toBe(true)
    // 후가공과 무관한 필드는 오검출 금지.
    expect(requiresSpotPlate({ tagong_num: '1', paper_size: 'A' })).toBe(false)
  })
})

describe('expectedFinishingPageCount (OMO-3581)', () => {
  it('단면=3, 양면 동일박=4, 양면 distinct=5', () => {
    expect(expectedFinishingPageCount()).toBe(3)
    expect(expectedFinishingPageCount({ doubleSided: false })).toBe(3)
    expect(expectedFinishingPageCount({ doubleSided: true, sameSpotBothSides: true })).toBe(4)
    expect(expectedFinishingPageCount({ doubleSided: true })).toBe(5)
  })
})

describe('assertFinishingPlatePresent — 결정론 가드(OMO-3581 교정)', () => {
  it('별색 후가공 없음 → 페이지수 무관 통과', () => {
    expect(assertFinishingPlatePresent({ selectedOptions: { finishing: 'drilled_hole' }, pageCount: 1 }).ok).toBe(true)
    expect(assertFinishingPlatePresent({ selectedOptions: {}, pageCount: null }).ok).toBe(true)
  })
  it('별색 후가공 + 단면 3페이지(위치보기용+인쇄+박파일) → 통과', () => {
    const r = assertFinishingPlatePresent({ selectedOptions: { finishing: 'foil_stamp' }, pageCount: 3 })
    expect(r.ok).toBe(true)
    expect(r.spotPlateFinishings).toEqual(['foil_stamp'])
    expect(r.expectedPageCount).toBe(3)
  })
  it('별색 후가공 + 2페이지(구 규격/위치보기용 누락) → 차단', () => {
    const r = assertFinishingPlatePresent({ selectedOptions: { finishing: 'foil_stamp' }, pageCount: 2 })
    expect(r.ok).toBe(false)
    expect(r.errorMessage).toContain('박파일(K100)')
  })
  it('별색 후가공 + 양면 distinct 5페이지 → 통과', () => {
    const r = assertFinishingPlatePresent({
      selectedOptions: { finishing: 'foil_stamp' },
      pageCount: 5,
      side: { doubleSided: true },
    })
    expect(r.ok).toBe(true)
    expect(r.expectedPageCount).toBe(5)
  })
  it('별색 후가공 + 비PDF(pageCount=null) → 차단(합본 PDF 필요)', () => {
    const r = assertFinishingPlatePresent({ selectedOptions: { finishing: 'epoxy' }, pageCount: null, fileExt: '.ai' })
    expect(r.ok).toBe(false)
    expect(r.errorMessage).toContain('합본 PDF')
  })
})

describe('getPdfPageCount', () => {
  it('실제 파싱 페이지수 반환', async () => {
    expect(await getPdfPageCount(await makePdf(2))).toBe(2)
    expect(await getPdfPageCount(await makePdf(1))).toBe(1)
  })
})

describe('mmToPt', () => {
  it('mm → pt (72/25.4)', () => {
    expect(mmToPt(25.4)).toBeCloseTo(72, 6)
    expect(mmToPt(0)).toBe(0)
  })
})

describe('buildCombinedFinishingPdf — 합본 빌더(OMO-3581 교정)', () => {
  it('단면 3페이지(위치보기용+인쇄+박파일) + 규격 mm→pt 정합 + 가드 통과', async () => {
    const bytes = await buildCombinedFinishingPdf({
      positionOverlay: PNG_PLATE,
      printPlate: PNG_PLATE,
      spotPlate: PNG_PLATE,
      pageWidthMm: 94,
      pageHeightMm: 54,
    })
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(3)
    const { width, height } = doc.getPage(0).getSize()
    expect(width).toBeCloseTo(mmToPt(94), 3)
    expect(height).toBeCloseTo(mmToPt(54), 3)
    const r = assertFinishingPlatePresent({
      selectedOptions: { finishing: 'foil_stamp' },
      pageCount: await getPdfPageCount(bytes),
    })
    expect(r.ok).toBe(true)
  })
  it('양면 distinct 5페이지 + 가드(side) 통과', async () => {
    const bytes = await buildCombinedFinishingPdf({
      positionOverlay: PNG_PLATE,
      printPlate: PNG_PLATE,
      backPrintPlate: PNG_PLATE,
      spotPlate: PNG_PLATE,
      backSpotPlate: PNG_PLATE,
      pageWidthMm: 94,
      pageHeightMm: 54,
    })
    expect(await getPdfPageCount(bytes)).toBe(5)
    const r = assertFinishingPlatePresent({
      selectedOptions: { finishing: 'foil_stamp' },
      pageCount: 5,
      side: { doubleSided: true },
    })
    expect(r.ok).toBe(true)
  })
  it('규격 0 이하 → throw', async () => {
    await expect(
      buildCombinedFinishingPdf({ positionOverlay: PNG_PLATE, printPlate: PNG_PLATE, spotPlate: PNG_PLATE, pageWidthMm: 0, pageHeightMm: 54 }),
    ).rejects.toThrow()
  })
})
