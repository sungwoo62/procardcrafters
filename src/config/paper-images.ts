// OMO-3195: 용지 선택 팝업의 재질 샘플 사진(Gemini 생성) 매니페스트.
// 사진은 용지 "패밀리"별 1장으로 Supabase Storage `products/paper/{slug}.jpg` 에 저장.
// gsm 만 다른 코드는 스와치 사진이 동일하므로 패밀리로 묶는다(paper-display.ts 의 img 슬러그).
//
// GENERATED_PAPER_IMAGES = 실제로 생성·업로드 완료된 패밀리 슬러그.
//   scripts/omo3195-gen-paper-images.mjs 가 업로드 성공 시 자동 갱신한다.
//   목록이 비어 있으면 PaperPopup 은 기존 인라인 SVG 질감으로 폴백 → 깨진 이미지 없음.

export const PAPER_IMAGE_BASE =
  'https://ilcfemvqommqyoohfoxw.supabase.co/storage/v1/object/public/products/paper'

// 업로드 완료된 family 슬러그(스크립트가 갱신).
export const GENERATED_PAPER_IMAGES = new Set<string>([
  'matte-coated',
  'glossy-coated',
  'rendezvous',
  'vent-nouveau',
  'stardream',
  'majestic',
  'felt-art',
  'ultra-smooth',
  'metallic-specialty',
  'linen',
  'pearlescent',
  'kraft',
  'synthetic-film',
  'woodfree',
  'cotton',
  'pvc-banner',
])

/** family 슬러그가 실제 업로드되어 있으면 그 사진 URL, 아니면 null(→ SVG 폴백). */
export function paperImageUrl(imgKey: string | null): string | null {
  if (!imgKey || !GENERATED_PAPER_IMAGES.has(imgKey)) return null
  return `${PAPER_IMAGE_BASE}/${imgKey}.jpg`
}
