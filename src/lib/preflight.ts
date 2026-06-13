// OMO-3028 [OMO-3019-3]: 제품 인쇄규격(print_spec) 대비 파일 프리플라이트.
//
// 범용 파일 검증(src/lib/file-validation.ts)이 산출한 details(치수/색공간/블리드/픽셀)를
// 제품 규격(PrintSpec, OMO-3026)에 비춰 항목별 통과/경고를 만든다.
//
// 설계 원칙: 프리플라이트는 "차단"하지 않는다. 규격 미달은 경고로만 표시하고,
//   최종 진행 책임은 고객 동의(print_design_consents)로 이전한다(인쇄업 표준).
//   판단 근거가 없는 항목(예: PDF 벡터의 DPI)은 'unknown' 으로 정직하게 표기한다.

import type { FileValidationResult } from './file-validation'
import type { PrintSpec } from './print-spec'

export type PreflightCheckStatus = 'pass' | 'warn' | 'unknown'

export interface PreflightCheck {
  key: 'resolution' | 'dimensions' | 'bleed' | 'color_mode'
  /** 고객 노출 라벨(한국어). */
  label: string
  status: PreflightCheckStatus
  /** 통과/경고/판단불가 사유 (한국어). */
  message: string
}

export interface PreflightResult {
  /** 전체 상태. 경고가 하나라도 있으면 'warn', 아니면 'pass'. */
  status: 'pass' | 'warn'
  checks: PreflightCheck[]
  /** 비교에 사용한 규격 스냅샷(분쟁 대비). */
  spec: PrintSpec
}

/** mm → inch. */
const MM_PER_INCH = 25.4

/** 치수 허용 오차(mm). 트림+블리드 합산 기준. */
const DIMENSION_TOLERANCE_MM = 1.5

/**
 * 범용 검증 결과 + 제품 규격으로 프리플라이트를 산출한다.
 * spec 이 없으면(미시드 제품) 규격 비교는 건너뛰고 일반 검증 경고만 반영한다.
 */
export function runPreflight(validation: FileValidationResult, spec: PrintSpec): PreflightResult {
  const d = validation.details
  const checks: PreflightCheck[] = []

  // ── 1. 해상도(min_dpi) ──────────────────────────────────────────
  // 래스터 이미지: 픽셀 / (목표 물리치수 inch). 목표치수는 트림+블리드(=full bleed size).
  const targetWmm = spec.width_mm + spec.bleed_mm * 2
  const targetHmm = spec.height_mm + spec.bleed_mm * 2
  if (d.widthPx && d.heightPx && targetWmm > 0 && targetHmm > 0) {
    const dpiW = d.widthPx / (targetWmm / MM_PER_INCH)
    const dpiH = d.heightPx / (targetHmm / MM_PER_INCH)
    const effectiveDpi = Math.floor(Math.min(dpiW, dpiH))
    if (effectiveDpi >= spec.min_dpi) {
      checks.push({
        key: 'resolution',
        label: '해상도',
        status: 'pass',
        message: `약 ${effectiveDpi}DPI — 권장 ${spec.min_dpi}DPI 이상입니다.`,
      })
    } else {
      checks.push({
        key: 'resolution',
        label: '해상도',
        status: 'warn',
        message: `약 ${effectiveDpi}DPI 로 권장 ${spec.min_dpi}DPI 미만입니다. 인쇄 시 흐릿하거나 계단현상이 보일 수 있습니다.`,
      })
    }
  } else {
    checks.push({
      key: 'resolution',
      label: '해상도',
      status: 'unknown',
      message: '이 파일 형식에서는 해상도를 자동 판정할 수 없습니다. 담당자가 검토합니다.',
    })
  }

  // ── 2. 사이즈(치수) ─────────────────────────────────────────────
  // PDF/벡터는 물리치수(widthMm/heightMm)를 읽는다. 트림+블리드 합산과 비교.
  if (typeof d.widthMm === 'number' && typeof d.heightMm === 'number') {
    // 가로/세로 스왑(회전) 허용: 정/역방향 중 더 잘 맞는 쪽으로 판정.
    const diffNormal = Math.abs(d.widthMm - targetWmm) + Math.abs(d.heightMm - targetHmm)
    const diffRotated = Math.abs(d.widthMm - targetHmm) + Math.abs(d.heightMm - targetWmm)
    const minDiff = Math.min(diffNormal, diffRotated)
    if (minDiff <= DIMENSION_TOLERANCE_MM * 2) {
      checks.push({
        key: 'dimensions',
        label: '사이즈',
        status: 'pass',
        message: `${d.widthMm}×${d.heightMm}mm — 규격(${targetWmm}×${targetHmm}mm, 블리드 포함)에 부합합니다.`,
      })
    } else {
      checks.push({
        key: 'dimensions',
        label: '사이즈',
        status: 'warn',
        message: `${d.widthMm}×${d.heightMm}mm 로 규격(${targetWmm}×${targetHmm}mm, 블리드 포함)과 다릅니다. 위치가 어긋나거나 잘릴 수 있습니다.`,
      })
    }
  } else {
    checks.push({
      key: 'dimensions',
      label: '사이즈',
      status: 'unknown',
      message: '이 파일 형식에서는 치수를 자동 판정할 수 없습니다. 담당자가 검토합니다.',
    })
  }

  // ── 3. 블리드 ──────────────────────────────────────────────────
  // PDF: TrimBox/BleedBox 로 판정한 hasBleed. 미설정/이미지는 unknown.
  if (typeof d.hasBleed === 'boolean') {
    if (d.hasBleed) {
      checks.push({
        key: 'bleed',
        label: '블리드',
        status: 'pass',
        message: `재단 여백(블리드 ${spec.bleed_mm}mm)이 설정되어 있습니다.`,
      })
    } else {
      checks.push({
        key: 'bleed',
        label: '블리드',
        status: 'warn',
        message: `블리드 ${spec.bleed_mm}mm 가 확인되지 않습니다. 재단 시 가장자리가 잘리거나 흰 여백이 보일 수 있습니다.`,
      })
    }
  } else {
    checks.push({
      key: 'bleed',
      label: '블리드',
      status: 'unknown',
      message: '이 파일 형식에서는 블리드를 자동 판정할 수 없습니다. 담당자가 검토합니다.',
    })
  }

  // ── 4. 색상모드 ─────────────────────────────────────────────────
  if (d.colorSpace && d.colorSpace !== 'unknown') {
    if (d.colorSpace === spec.color_mode || d.colorSpace === 'Grayscale') {
      checks.push({
        key: 'color_mode',
        label: '색상모드',
        status: 'pass',
        message: `${d.colorSpace} — 인쇄 색상모드(${spec.color_mode})에 부합합니다.`,
      })
    } else {
      checks.push({
        key: 'color_mode',
        label: '색상모드',
        status: 'warn',
        message: `${d.colorSpace} 색상모드입니다. 인쇄는 ${spec.color_mode} 기준이라 색상이 다소 변할 수 있습니다.`,
      })
    }
  } else {
    checks.push({
      key: 'color_mode',
      label: '색상모드',
      status: 'unknown',
      message: '색상모드를 자동 판정할 수 없습니다. 담당자가 검토합니다.',
    })
  }

  const status = checks.some((c) => c.status === 'warn') ? 'warn' : 'pass'
  return { status, checks, spec }
}
