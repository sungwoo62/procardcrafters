// OMO-3026 [OMO-3019-1]: 제품 인쇄규격 데이터 모델 (foundation).
//
// 부모 OMO-3019(파일 프리플라이트/시안동의/제품별 PDF 템플릿)의 공통 토대.
// 두 후속 작업(템플릿 다운로드·업로드 프리플라이트)이 같은 규격 정보를 읽는다.
//
// 규격의 권위 소스는 DB: `print_products.print_spec JSONB`.
// 이 파일은 그 컬럼의 TS 형태(PrintSpec)와 표준 기본값·빌더만 정의한다(자체 산출, 타사 복제 금지 · OMO-2975).
//
// 주: 사내 템플릿 SSOT(OMO-2709 `src/config/printSpecs.ts`)와는 의도적으로 디커플링한다.
//     해당 모듈은 아직 origin/main 미머지(프로덕션 브랜치 선행)이므로, 본 토대를 거기에
//     하드 의존시키면 미완 조각을 끌고 온다. 두 모듈이 main 에서 만나면 빌더를 그쪽 치수에 연결한다.

/** 인쇄 색공간. 옵셋/디지털 인쇄 기본은 CMYK. */
export type ColorMode = 'CMYK' | 'RGB'

/** 입고 이미지 최소 해상도(ppi). 300 = 옵셋/디지털 표준 권장. */
export const STANDARD_MIN_DPI = 300

/** 기본 색공간(인쇄 = CMYK). */
export const STANDARD_COLOR_MODE: ColorMode = 'CMYK'

/**
 * `print_products.print_spec` 의 권위 형태(JSONB 직렬화 그대로, snake_case).
 * 트림(width/height) + 블리드/세이프(mm) + 입고 최소 해상도 + 색공간.
 */
export interface PrintSpec {
  width_mm: number
  height_mm: number
  /** 재단 바깥 여백(블리드). 트림 기준 사방 확장. */
  bleed_mm: number
  /** 재단 안쪽 안전선. 중요한 내용은 이 안쪽에 배치. */
  safe_mm: number
  /** 입고 이미지 최소 해상도(ppi). 미만이면 프리플라이트 경고. */
  min_dpi: number
  /** 인쇄 색공간. */
  color_mode: ColorMode
}

/** 빌더 입력: 치수만 받고 DPI·색공간은 표준값으로 채운다. */
export interface PrintSpecDimsInput {
  width_mm: number
  height_mm: number
  bleed_mm: number
  safe_mm: number
  /** 표준(300)과 다를 때만 지정. */
  min_dpi?: number
  /** 표준(CMYK)과 다를 때만 지정. */
  color_mode?: ColorMode
}

/**
 * 치수 + 표준 DPI·색공간으로 PrintSpec 을 자체 산출한다.
 * 마이그레이션 시드(`print_products.print_spec`)와 동일 산식 — 양쪽이 어긋나면 안 된다.
 */
export function buildPrintSpec(input: PrintSpecDimsInput): PrintSpec {
  return {
    width_mm: input.width_mm,
    height_mm: input.height_mm,
    bleed_mm: input.bleed_mm,
    safe_mm: input.safe_mm,
    min_dpi: input.min_dpi ?? STANDARD_MIN_DPI,
    color_mode: input.color_mode ?? STANDARD_COLOR_MODE,
  }
}

/** 규격 미시드 제품의 안전 폴백(국제 명함 85x55, 블리드/세이프 3mm). */
export const DEFAULT_PRINT_SPEC: PrintSpec = buildPrintSpec({
  width_mm: 85,
  height_mm: 55,
  bleed_mm: 3,
  safe_mm: 3,
})
