// OMO-3684 · 제품별 레퍼런스 이미지 SSOT.
// 보드 지시(2026-06-21): "각 제품별로 제품에 알맞게 이미지 생성해서 고객들이 레퍼런스 가지게끔".
// 각 제품 슬러그마다 카테고리에 맞는 다각도 photoreal 레퍼런스 컷을 생성한다.
// - 이미지 생성 파이프라인은 OMO-3690 의 /api/studio/gen 라우트를 재사용(id+prompt).
// - 생성 결과 URL 은 product-references.json(slug → URL[]) 에 적재되고,
//   제품 상세 페이지의 ProductGallery(슬라이드/썸네일) galleryUrls 로 합류한다.
// 컴플라이언스(OMO-2760/2975): 텍스트/로고/스탯/전화번호 합성 금지 — buildReferencePrompt 가드.
import { PRODUCT_GROUPS } from './product-nav'
import GENERATED_REFS from './product-references.json'
import SCENE_DATA from './reference-scenes.json'

export interface ReferenceScene {
  key: string // angle key: hero / inuse / flatlay / detail
  label: string // 스튜디오 UI 라벨(한국어)
  scene: string // 비주얼 디렉션(영문 프롬프트에 합류)
}

// 그룹(카테고리)별 장면 프리셋 + 제품당 컷 수는 reference-scenes.json(공유 SSOT)에서 로드.
// 생성 스크립트(scripts/omo3684-refs-gen.mjs)도 동일 JSON 을 읽어 드리프트를 방지한다.
// 추천안: 4컷 = 스튜디오 히어로 / 실사용(in-use) / 스타일링 플랫레이 / 마감 디테일 매크로.
export const REFERENCES_PER_PRODUCT = (SCENE_DATA as { perProduct: number }).perProduct
const GROUP_SCENES = (SCENE_DATA as { groups: Record<string, ReferenceScene[]> }).groups

const DEFAULT_SCENES = GROUP_SCENES.cards

export interface ProductReference {
  id: string // ref-{slug}-{n}
  slug: string
  label: string // 제품 라벨(영문)
  groupKey: string
  sceneKey: string
  sceneLabel: string // 한국어 라벨
  visualDirection: string // 영문 장면(프롬프트 합류)
}

// 슬러그 → 그룹 라벨 역인덱스.
const SLUG_META: Record<string, { label: string; groupKey: string }> = Object.fromEntries(
  PRODUCT_GROUPS.flatMap((g) => g.items.map((i) => [i.slug, { label: i.label, groupKey: g.key }])),
)

// 전체 제품의 레퍼런스 스펙(생성 대상 목록).
export const PRODUCT_REFERENCES: ProductReference[] = PRODUCT_GROUPS.flatMap((g) => {
  const scenes = (GROUP_SCENES[g.key] ?? DEFAULT_SCENES).slice(0, REFERENCES_PER_PRODUCT)
  return g.items.flatMap((item) =>
    scenes.map((sc, idx) => ({
      id: `ref-${item.slug}-${idx + 1}`,
      slug: item.slug,
      label: item.label,
      groupKey: g.key,
      sceneKey: sc.key,
      sceneLabel: sc.label,
      visualDirection: sc.scene,
    })),
  )
})

// 이미지 생성 프롬프트 빌더(레퍼런스 전용). buildImagePrompt 와 동일한 컴플라이언스 가드.
export function buildReferencePrompt(ref: ProductReference): string {
  return [
    `Ultra-realistic commercial product photography of ${ref.label.toLowerCase()} for a premium American print shop.`,
    `Scene direction: ${ref.visualDirection}.`,
    `Beautiful styled background, soft directional studio lighting, shallow depth of field, true-to-life paper texture and print finish, crisp macro detail, magazine-quality, modern and elegant.`,
    `IMPORTANT: the product surface is blank or shows only abstract non-readable decorative marks. Absolutely no real text, no readable words, no letters, no numbers, no logos, no brand names, no statistics, no phone numbers, no QR codes.`,
    `Square 1:1 composition. No watermark, no border, no UI, photoreal only.`,
  ].join(' ')
}

// 생성된 레퍼런스 매니페스트(slug → 생성 URL 배열). 생성 스크립트가 적재.
const REFS = GENERATED_REFS as Record<string, string[]>

// 제품 슬러그의 생성된 레퍼런스 이미지 URL 목록(없으면 빈 배열).
export function getProductReferenceUrls(slug: string): string[] {
  return REFS[slug] ?? []
}

// 레퍼런스 보유 제품 수(스튜디오/리포트 통계용).
export const PRODUCTS_WITH_REFERENCES = Object.keys(REFS).filter((s) => (REFS[s]?.length ?? 0) > 0).length
