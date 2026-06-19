import { describe, it, expect } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import {
  FINISHING_REQUIRES_SPOT_PLATE,
  parseFinishingValues,
  listSpotPlateFinishings,
  requiresSpotPlate,
  getPdfPageCount,
  assertFinishingPlatePresent,
  buildCombinedFinishingPdf,
  mmToPt,
  type PlateImage,
} from '../finishing-combined-pdf'

// OMO-3568: 별색 합본 PDF 파이프라인 — 별색판 누락 가드 + 합본 빌더 결정론 회귀.

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
})

describe('assertFinishingPlatePresent — 결정론 가드', () => {
  it('별색 후가공 없음 → 페이지수 무관 통과', () => {
    expect(assertFinishingPlatePresent({ selectedOptions: { finishing: 'drilled_hole' }, pageCount: 1 }).ok).toBe(true)
    expect(assertFinishingPlatePresent({ selectedOptions: {}, pageCount: null }).ok).toBe(true)
  })
  it('별색 후가공 + 2페이지 → 통과', () => {
    const r = assertFinishingPlatePresent({ selectedOptions: { finishing: 'foil_stamp' }, pageCount: 2 })
    expect(r.ok).toBe(true)
    expect(r.spotPlateFinishings).toEqual(['foil_stamp'])
  })
  it('별색 후가공 + 1페이지(별색판 누락) → 차단', () => {
    const r = assertFinishingPlatePresent({ selectedOptions: { finishing: 'foil_stamp' }, pageCount: 1 })
    expect(r.ok).toBe(false)
    expect(r.errorMessage).toContain('2페이지')
  })
  it('별색 후가공 + 3페이지(과다) → 차단', () => {
    expect(assertFinishingPlatePresent({ selectedOptions: { finishing: 'die_cut' }, pageCount: 3 }).ok).toBe(false)
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

describe('buildCombinedFinishingPdf — 합본 빌더', () => {
  it('정확히 2페이지 PDF 생성 + 페이지 규격 mm→pt 정합 + 가드 통과', async () => {
    const bytes = await buildCombinedFinishingPdf({
      designPlate: PNG_PLATE,
      spotPlate: PNG_PLATE,
      pageWidthMm: 94,
      pageHeightMm: 54,
    })
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(2)
    const { width, height } = doc.getPage(0).getSize()
    expect(width).toBeCloseTo(mmToPt(94), 3)
    expect(height).toBeCloseTo(mmToPt(54), 3)
    // 빌더 산출물은 별색판 가드를 통과한다(2페이지).
    const r = assertFinishingPlatePresent({
      selectedOptions: { finishing: 'foil_stamp' },
      pageCount: await getPdfPageCount(bytes),
    })
    expect(r.ok).toBe(true)
  })
  it('규격 0 이하 → throw', async () => {
    await expect(
      buildCombinedFinishingPdf({ designPlate: PNG_PLATE, spotPlate: PNG_PLATE, pageWidthMm: 0, pageHeightMm: 54 }),
    ).rejects.toThrow()
  })
})
