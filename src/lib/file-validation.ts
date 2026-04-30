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

// Minimum DPI for print
const MIN_PRINT_DPI = 300
// Minimum bleed (mm)
const MIN_BLEED_MM = 3

// Convert PDF points to mm (1pt = 0.352778mm)
function ptToMm(pt: number): number {
  return pt * 0.352778
}

/**
 * Analyze a PDF file and validate print suitability
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
      errors.push('PDF has no pages')
      return { isValid: false, warnings, errors, details }
    }

    const firstPage = pages[0]
    const { width, height } = firstPage.getSize()
    details.widthMm = Math.round(ptToMm(width) * 10) / 10
    details.heightMm = Math.round(ptToMm(height) * 10) / 10

    // TrimBox / BleedBox check
    const mediaBox = firstPage.getMediaBox()
    const trimBox = firstPage.getTrimBox()
    const bleedBox = firstPage.getBleedBox()

    // Bleed detection: bleed exists if BleedBox is larger than TrimBox
    if (trimBox && bleedBox) {
      const bleedLeft = trimBox.x - bleedBox.x
      const bleedBottom = trimBox.y - bleedBox.y
      const bleedRight = (bleedBox.x + bleedBox.width) - (trimBox.x + trimBox.width)
      const bleedTop = (bleedBox.y + bleedBox.height) - (trimBox.y + trimBox.height)
      const minBleedPt = Math.min(bleedLeft, bleedBottom, bleedRight, bleedTop)
      const minBleedMm = ptToMm(minBleedPt)

      details.hasBleed = minBleedMm >= MIN_BLEED_MM
      if (!details.hasBleed) {
        warnings.push(`Bleed is ${minBleedMm.toFixed(1)}mm. A minimum of ${MIN_BLEED_MM}mm bleed is recommended for print`)
      }
    } else if (mediaBox) {
      // Cannot verify bleed without TrimBox/BleedBox
      details.hasBleed = false
      warnings.push('TrimBox/BleedBox not set. Content may be cropped during trimming')
    }

    // Color space detection (check /ColorSpace in PDF resources)
    details.colorSpace = detectPdfColorSpace(pdfDoc)
    if (details.colorSpace === 'RGB') {
      warnings.push('File is in RGB color space. CMYK is recommended for print. Colors may shift')
    }

    // Multi-page warning
    if (pages.length > 2) {
      warnings.push(`PDF has ${pages.length} pages. Please verify the page count matches your print order`)
    }
  } catch {
    errors.push('Unable to read PDF file. The file may be corrupted or have security restrictions')
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
 * Basic image file validation (PNG, JPEG, TIFF)
 */
export function validateImageFile(buffer: ArrayBuffer, mimeType: string): FileValidationResult {
  const warnings: string[] = []
  const errors: string[] = []
  const details: FileValidationResult['details'] = { fileFormatValid: true }

  const bytes = new Uint8Array(buffer)

  // Magic bytes validation
  if (mimeType === 'image/png') {
    if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4E || bytes[3] !== 0x47) {
      errors.push('Invalid PNG file header')
      details.fileFormatValid = false
    } else {
      // Read dimensions from PNG IHDR chunk
      const w = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19]
      const h = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23]
      if (w < 300 || h < 300) {
        warnings.push(`Image resolution is ${w}×${h}px, which may be too low for print`)
      }
      // PNG bit depth, color type
      const colorType = bytes[25]
      details.colorSpace = colorType === 0 ? 'Grayscale' : 'RGB'
      if (colorType === 2 || colorType === 6) {
        warnings.push('Image is in RGB color space. It will be converted to CMYK for printing')
      }
    }
  } else if (mimeType === 'image/jpeg') {
    if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) {
      errors.push('Invalid JPEG file header')
      details.fileFormatValid = false
    } else {
      details.colorSpace = 'RGB'
      warnings.push('JPEG files are in RGB color space. They will be converted to CMYK for printing')
    }
  } else if (mimeType === 'image/tiff') {
    const tiffMagic = (bytes[0] === 0x49 && bytes[1] === 0x49) || (bytes[0] === 0x4D && bytes[1] === 0x4D)
    if (!tiffMagic) {
      errors.push('Invalid TIFF file header')
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
 * Basic AI/PSD file validation
 */
export function validateDesignFile(buffer: ArrayBuffer, mimeType: string): FileValidationResult {
  const warnings: string[] = []
  const details: FileValidationResult['details'] = { fileFormatValid: true }
  const bytes = new Uint8Array(buffer)

  if (mimeType === 'image/vnd.adobe.photoshop' || mimeType === 'application/photoshop') {
    // PSD magic bytes: "8BPS"
    if (bytes[0] !== 0x38 || bytes[1] !== 0x42 || bytes[2] !== 0x50 || bytes[3] !== 0x53) {
      return { isValid: false, warnings, errors: ['Invalid PSD file header'], details: { ...details, fileFormatValid: false } }
    }
    // PSD color mode (offset 25, 2 bytes): 0=Bitmap, 1=Grayscale, 3=RGB, 4=CMYK
    const colorMode = (bytes[25] << 8) | bytes[26]
    details.colorSpace = colorMode === 4 ? 'CMYK' : colorMode === 3 ? 'RGB' : colorMode === 1 ? 'Grayscale' : 'unknown'
    if (details.colorSpace === 'RGB') {
      warnings.push('PSD file is in RGB mode. CMYK mode is recommended for print')
    }
  }

  if (mimeType === 'application/illustrator' || mimeType === 'application/postscript') {
    // AI files are often PDF-based
    const header = new TextDecoder().decode(bytes.slice(0, 5))
    if (header === '%PDF-') {
      warnings.push('AI file is in PDF-compatible mode. Analysis will proceed normally')
    }
  }

  return { isValid: true, warnings, errors: [], details }
}

/**
 * Detect PDF color space (simple heuristic)
 */
function detectPdfColorSpace(_pdfDoc: PDFDocument): 'CMYK' | 'RGB' | 'Grayscale' | 'unknown' {
  try {
    // Search for color space keywords in PDF binary (heuristic)
    const pages = _pdfDoc.getPages()
    if (pages.length === 0) return 'unknown'

    // Instead of traversing pdf-lib internals directly,
    // search for color space keywords in saved PDF bytes
    const saved = _pdfDoc.context.enumerateIndirectObjects()
    for (const [, obj] of saved) {
      const str = String(obj)
      if (str.includes('DeviceCMYK')) return 'CMYK'
      if (str.includes('DeviceRGB')) return 'RGB'
      if (str.includes('DeviceGray')) return 'Grayscale'
    }
  } catch {
    // Return unknown if color space detection fails
  }
  return 'unknown'
}

/**
 * Route to the appropriate validation function based on file type
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
    warnings: ['Detailed validation is not supported for this file format'],
    errors: [],
    details: { fileFormatValid: true },
  }
}
