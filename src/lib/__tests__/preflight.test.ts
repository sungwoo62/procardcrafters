// OMO-3028: 제품 규격 대비 프리플라이트 산출 로직 검증.
import { describe, it, expect } from 'vitest'
import { runPreflight } from '@/lib/preflight'
import { buildPrintSpec } from '@/lib/print-spec'
import type { FileValidationResult } from '@/lib/file-validation'

// 명함 85x55 / 블리드 3mm → 트림+블리드 91x61mm, 300DPI, CMYK
const cardSpec = buildPrintSpec({ width_mm: 85, height_mm: 55, bleed_mm: 3, safe_mm: 3 })

function validation(details: Partial<FileValidationResult['details']>): FileValidationResult {
  return { isValid: true, warnings: [], errors: [], details: { fileFormatValid: true, ...details } }
}

describe('runPreflight', () => {
  it('규격에 부합하는 PDF 는 전체 통과', () => {
    const r = runPreflight(
      validation({ widthMm: 91, heightMm: 61, hasBleed: true, colorSpace: 'CMYK' }),
      cardSpec,
    )
    expect(r.status).toBe('pass')
    expect(r.checks.find((c) => c.key === 'dimensions')?.status).toBe('pass')
    expect(r.checks.find((c) => c.key === 'bleed')?.status).toBe('pass')
    expect(r.checks.find((c) => c.key === 'color_mode')?.status).toBe('pass')
  })

  it('회전(가로/세로 스왑)된 치수도 통과로 인정', () => {
    const r = runPreflight(validation({ widthMm: 61, heightMm: 91, hasBleed: true, colorSpace: 'CMYK' }), cardSpec)
    expect(r.checks.find((c) => c.key === 'dimensions')?.status).toBe('pass')
  })

  it('치수 불일치 / 블리드 없음 / RGB 는 경고', () => {
    const r = runPreflight(validation({ widthMm: 100, heightMm: 70, hasBleed: false, colorSpace: 'RGB' }), cardSpec)
    expect(r.status).toBe('warn')
    expect(r.checks.find((c) => c.key === 'dimensions')?.status).toBe('warn')
    expect(r.checks.find((c) => c.key === 'bleed')?.status).toBe('warn')
    expect(r.checks.find((c) => c.key === 'color_mode')?.status).toBe('warn')
  })

  it('저해상도 래스터(픽셀 부족)는 해상도 경고', () => {
    // 91mm ≈ 3.58inch → 300DPI 이려면 ~1075px 필요. 600px 는 미달.
    const r = runPreflight(validation({ widthPx: 600, heightPx: 400 }), cardSpec)
    expect(r.checks.find((c) => c.key === 'resolution')?.status).toBe('warn')
  })

  it('충분한 해상도 래스터는 해상도 통과', () => {
    const r = runPreflight(validation({ widthPx: 1200, heightPx: 800 }), cardSpec)
    expect(r.checks.find((c) => c.key === 'resolution')?.status).toBe('pass')
  })

  it('판단 근거 없는 항목은 unknown (차단하지 않음)', () => {
    const r = runPreflight(validation({}), cardSpec)
    const res = r.checks.find((c) => c.key === 'resolution')
    expect(res?.status).toBe('unknown')
    // unknown 만 있으면 전체는 pass (경고 없음)
    expect(r.status).toBe('pass')
  })
})
