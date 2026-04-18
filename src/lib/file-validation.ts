import { PDFDocument } from 'pdf-lib'

export interface FileValidationResult {
  isValid: boolean
  warnings: string[]
  errors: string[]
  details: {
    pageCount?: number
    widthMm?: number
    heightMm?: number
    colorSpace?: 'CMYK' | 'RGB' | 'Grayscale' | 'unknown'
    hasBleed?: boolean
    estimatedDpi?: number
    fileFormatValid: boolean
  }
}

// 인쇄용 최소 DPI
const MIN_PRINT_DPI = 300
// 최소 블리드 (mm)
const MIN_BLEED_MM = 3

// PDF 포인트를 mm로 변환 (1pt = 0.352778mm)
function ptToMm(pt: number): number {
  return pt * 0.352778
}

/**
 * PDF 파일을 분석하여 인쇄 적합성 검증
 */
export async function validatePdfFile(buffer: ArrayBuffer): Promise<FileValidationResult> {
  const warnings: string[] = []
  const errors: string[] = []
  const details: FileValidationResult['details'] = { fileFormatValid: true }

  try {
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true })
    const pages = pdfDoc.getPages()
    details.pageCount = pages.length

    if (pages.length === 0) {
      errors.push('PDF에 페이지가 없습니다')
      return { isValid: false, warnings, errors, details }
    }

    const firstPage = pages[0]
    const { width, height } = firstPage.getSize()
    details.widthMm = Math.round(ptToMm(width) * 10) / 10
    details.heightMm = Math.round(ptToMm(height) * 10) / 10

    // TrimBox / BleedBox 체크
    const mediaBox = firstPage.getMediaBox()
    const trimBox = firstPage.getTrimBox()
    const bleedBox = firstPage.getBleedBox()

    // 블리드 감지: BleedBox가 TrimBox보다 크면 블리드 있음
    if (trimBox && bleedBox) {
      const bleedLeft = trimBox.x - bleedBox.x
      const bleedBottom = trimBox.y - bleedBox.y
      const bleedRight = (bleedBox.x + bleedBox.width) - (trimBox.x + trimBox.width)
      const bleedTop = (bleedBox.y + bleedBox.height) - (trimBox.y + trimBox.height)
      const minBleedPt = Math.min(bleedLeft, bleedBottom, bleedRight, bleedTop)
      const minBleedMm = ptToMm(minBleedPt)

      details.hasBleed = minBleedMm >= MIN_BLEED_MM
      if (!details.hasBleed) {
        warnings.push(`블리드가 ${minBleedMm.toFixed(1)}mm입니다. 인쇄용은 최소 ${MIN_BLEED_MM}mm 블리드가 권장됩니다`)
      }
    } else if (mediaBox) {
      // TrimBox/BleedBox가 없으면 블리드 확인 불가
      details.hasBleed = false
      warnings.push('TrimBox/BleedBox가 설정되지 않았습니다. 재단 시 콘텐츠가 잘릴 수 있습니다')
    }

    // 색상 공간 감지 (PDF 리소스에서 /ColorSpace 확인)
    details.colorSpace = detectPdfColorSpace(pdfDoc)
    if (details.colorSpace === 'RGB') {
      warnings.push('파일이 RGB 색상 공간입니다. 인쇄용은 CMYK가 권장됩니다. 색상 차이가 발생할 수 있습니다')
    }

    // 다중 페이지 경고
    if (pages.length > 2) {
      warnings.push(`${pages.length}페이지 PDF입니다. 인쇄 주문에 맞는 페이지 수인지 확인해 주세요`)
    }
  } catch {
    errors.push('PDF 파일을 읽을 수 없습니다. 파일이 손상되었거나 보안 설정이 있을 수 있습니다')
    details.fileFormatValid = false
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
    details,
  }
}

/**
 * 이미지 파일 기본 검증 (PNG, JPEG, TIFF)
 */
export function validateImageFile(buffer: ArrayBuffer, mimeType: string): FileValidationResult {
  const warnings: string[] = []
  const errors: string[] = []
  const details: FileValidationResult['details'] = { fileFormatValid: true }

  const bytes = new Uint8Array(buffer)

  // 매직 바이트 검증
  if (mimeType === 'image/png') {
    if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4E || bytes[3] !== 0x47) {
      errors.push('PNG 파일 헤더가 올바르지 않습니다')
      details.fileFormatValid = false
    } else {
      // PNG IHDR 청크에서 크기 읽기
      const w = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19]
      const h = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23]
      if (w < 300 || h < 300) {
        warnings.push(`이미지 해상도가 ${w}×${h}px로 인쇄용으로 낮을 수 있습니다`)
      }
      // PNG 비트뎁스, 컬러타입
      const colorType = bytes[25]
      details.colorSpace = colorType === 0 ? 'Grayscale' : 'RGB'
      if (colorType === 2 || colorType === 6) {
        warnings.push('이미지가 RGB 색상 공간입니다. 인쇄 시 CMYK로 변환됩니다')
      }
    }
  } else if (mimeType === 'image/jpeg') {
    if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) {
      errors.push('JPEG 파일 헤더가 올바르지 않습니다')
      details.fileFormatValid = false
    } else {
      details.colorSpace = 'RGB'
      warnings.push('JPEG 파일은 RGB 색상 공간입니다. 인쇄 시 CMYK로 변환됩니다')
    }
  } else if (mimeType === 'image/tiff') {
    const tiffMagic = (bytes[0] === 0x49 && bytes[1] === 0x49) || (bytes[0] === 0x4D && bytes[1] === 0x4D)
    if (!tiffMagic) {
      errors.push('TIFF 파일 헤더가 올바르지 않습니다')
      details.fileFormatValid = false
    }
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
    details,
  }
}

/**
 * AI/PSD 파일 기본 검증
 */
export function validateDesignFile(buffer: ArrayBuffer, mimeType: string): FileValidationResult {
  const warnings: string[] = []
  const details: FileValidationResult['details'] = { fileFormatValid: true }
  const bytes = new Uint8Array(buffer)

  if (mimeType === 'image/vnd.adobe.photoshop' || mimeType === 'application/photoshop') {
    // PSD 매직 바이트: "8BPS"
    if (bytes[0] !== 0x38 || bytes[1] !== 0x42 || bytes[2] !== 0x50 || bytes[3] !== 0x53) {
      return { isValid: false, warnings, errors: ['PSD 파일 헤더가 올바르지 않습니다'], details: { ...details, fileFormatValid: false } }
    }
    // PSD 색상 모드 (offset 25, 2 bytes): 0=Bitmap, 1=Grayscale, 3=RGB, 4=CMYK
    const colorMode = (bytes[25] << 8) | bytes[26]
    details.colorSpace = colorMode === 4 ? 'CMYK' : colorMode === 3 ? 'RGB' : colorMode === 1 ? 'Grayscale' : 'unknown'
    if (details.colorSpace === 'RGB') {
      warnings.push('PSD 파일이 RGB 모드입니다. 인쇄용은 CMYK 모드가 권장됩니다')
    }
  }

  if (mimeType === 'application/illustrator' || mimeType === 'application/postscript') {
    // AI 파일은 PDF 기반인 경우가 많음
    const header = new TextDecoder().decode(bytes.slice(0, 5))
    if (header === '%PDF-') {
      warnings.push('AI 파일이 PDF 호환 모드입니다. 분석이 정상적으로 진행됩니다')
    }
  }

  return { isValid: true, warnings, errors: [], details }
}

/**
 * PDF 내부 색상 공간 감지 (간단한 휴리스틱)
 */
function detectPdfColorSpace(_pdfDoc: PDFDocument): 'CMYK' | 'RGB' | 'Grayscale' | 'unknown' {
  try {
    // PDF 내부 바이너리에서 색상 공간 키워드 검색 (휴리스틱)
    const pages = _pdfDoc.getPages()
    if (pages.length === 0) return 'unknown'

    // pdf-lib의 내부 구조를 직접 탐색하는 대신,
    // 저장된 PDF 바이트에서 색상 공간 키워드를 검색
    const saved = _pdfDoc.context.enumerateIndirectObjects()
    for (const [, obj] of saved) {
      const str = String(obj)
      if (str.includes('DeviceCMYK')) return 'CMYK'
      if (str.includes('DeviceRGB')) return 'RGB'
      if (str.includes('DeviceGray')) return 'Grayscale'
    }
  } catch {
    // 색상 공간 감지 실패 시 unknown 반환
  }
  return 'unknown'
}

/**
 * 파일 타입에 따라 적절한 검증 함수 호출
 */
export async function validateFile(buffer: ArrayBuffer, mimeType: string): Promise<FileValidationResult> {
  if (mimeType === 'application/pdf') {
    return validatePdfFile(buffer)
  }
  if (mimeType.startsWith('image/png') || mimeType.startsWith('image/jpeg') || mimeType.startsWith('image/tiff')) {
    return validateImageFile(buffer, mimeType)
  }
  if (mimeType === 'application/illustrator' || mimeType === 'application/postscript' || mimeType === 'image/vnd.adobe.photoshop') {
    return validateDesignFile(buffer, mimeType)
  }
  return {
    isValid: true,
    warnings: ['이 파일 형식에 대한 상세 검증은 지원되지 않습니다'],
    errors: [],
    details: { fileFormatValid: true },
  }
}
