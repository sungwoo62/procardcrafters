// 제품군별 추천옵션 카탈로그 — stickers / flyers / posters (OMO-3217, 부모 OMO-3214).
//
// finishes.ts(=business-cards 마감)의 신규 제품군 버전. 각 옵션은 니치 시드의
// recommendedOptions[] 와 photos[] 두 곳을 동시에 구동한다(단일 소스).
//
// ⚠️ 정직성 게이트(회사정책 OMO-2760 / OMO-2972):
//   - 사진은 전부 로컬 SVG 목업(`public/niche/{group}/*.svg`)이며 카드 카피에 "sample
//     mockup"으로 명시한다(실제 납품작 아님 → 허위표시 방지). Media 가 실물 사진으로
//     교체 예정(후속 이슈). 외부 자산/원격 호스트 의존 없음.
//   - 내부 임계값(수량 구간·할인 임계 등) 노출 금지. priceFrom 은 공개 offer 최저가만.
//
// 옵션 slug 는 컨피규레이터 프리셋 매핑이 정식화되면 configValue 로 확장 가능(현재는
// niche 태깅 딥링크만 — 깨진 프리셋 주입 회피).

import type { NichePhoto } from '@/lib/niche/content'

export type GroupOption = {
  /** 그룹 내 옵션 slug(recommendedOptions[] 참조 키). */
  slug: string
  /** 옵션 표시명. */
  name: string
  /** 1~2문장 블러브(en-US). */
  blurb: string
  /** 이모지 아이콘(외부 자산 의존 없는 시각 보조). */
  icon: string
  /** 로컬 목업 이미지 경로(`public/niche/{group}/{slug}.svg`). */
  image: string
}

const opt = (
  group: string,
  slug: string,
  name: string,
  icon: string,
  blurb: string,
): GroupOption => ({
  slug,
  name,
  icon,
  blurb,
  image: `/niche/${group}/${slug}.svg`,
})

export const GROUP_OPTIONS: Record<string, GroupOption[]> = {
  stickers: [
    opt('stickers', 'die-cut', 'Custom Die-Cut', '✂️',
      'Cut to the exact outline of your logo or character — no white border, just your shape.'),
    opt('stickers', 'holographic', 'Holographic Film', '🌈',
      'Rainbow-shift film that catches the light and makes a giveaway sticker worth keeping.'),
    opt('stickers', 'vinyl-matte', 'Durable Matte Vinyl', '🧊',
      'Waterproof, scratch- and UV-resistant matte vinyl that survives laptops, bottles and the outdoors.'),
    opt('stickers', 'clear', 'Clear / Transparent', '🪟',
      'See-through backing so your art floats directly on glass, packaging or a phone case.'),
    opt('stickers', 'kiss-cut-sheet', 'Kiss-Cut Sheets', '▫️',
      'Multiple stickers on one peel-friendly sheet — ideal for packs, kits and product inserts.'),
    opt('stickers', 'gloss-lam', 'Glossy UV Laminate', '✨',
      'A glossy protective laminate that makes colors pop and shrugs off scuffs and spills.'),
  ],
  flyers: [
    opt('flyers', 'premium-stock', 'Heavyweight Stock', '📄',
      'Thick 150–350gsm stock that feels like something worth reading, not something to toss.'),
    opt('flyers', 'silk-matte', 'Silk Matte Coating', '🪶',
      'A smooth, glare-free silk finish that keeps dense text and menus easy to read.'),
    opt('flyers', 'gloss-uv', 'High-Gloss UV', '✨',
      'A high-shine coating that makes food photography and promo colors leap off the page.'),
    opt('flyers', 'folded', 'Folded Formats', '📑',
      'Bi-fold and tri-fold layouts that turn a single flyer into a mini-brochure for menus and programs.'),
    opt('flyers', 'spot-uv', 'Spot UV Accents', '💧',
      'Selective gloss over a matte sheet — highlight a logo or headline so the eye lands there first.'),
    opt('flyers', 'recycled', 'Recycled Uncoated', '🌿',
      'Natural uncoated recycled stock for brands that want a tactile, sustainable feel.'),
  ],
  posters: [
    opt('posters', 'large-format', 'Large Format A1 / A0', '🖼️',
      'Big-wall sizes up to A0 with crisp, readable type from across the room.'),
    opt('posters', 'matte-fine-art', 'Matte Fine-Art', '🎨',
      'Glare-free archival matte stock that reads as gallery art, not a throwaway print.'),
    opt('posters', 'gloss-photo', 'Gloss Photo Finish', '📸',
      'High-gloss photo stock with deep blacks and saturated color for image-led posters.'),
    opt('posters', 'foamboard', 'Foamboard Mounted', '🧱',
      'Rigid foamboard mounting so the poster stands on an easel or hangs flat without curling.'),
    opt('posters', 'satin', 'Satin Finish', '🌙',
      'A soft satin sheen — richer than matte, calmer than gloss, flattering under retail lighting.'),
  ],
}

const BY_GROUP_SLUG = new Map<string, Map<string, GroupOption>>(
  Object.entries(GROUP_OPTIONS).map(([g, opts]) => [g, new Map(opts.map((o) => [o.slug, o]))]),
)

/** 추천옵션 slug 배열을 photos[] 로 변환(추천옵션 관련 목업 이미지, OMO-3211). */
export function buildGroupPhotos(group: string, optionSlugs: string[]): NichePhoto[] {
  const bySlug = BY_GROUP_SLUG.get(group)
  if (!bySlug) return []
  return optionSlugs
    .map((s) => bySlug.get(s))
    .filter((o): o is GroupOption => Boolean(o))
    .map((o) => ({
      src: o.image,
      alt: `${o.name} — custom ${group.replace(/s$/, '')} (sample mockup)`,
      title: o.name,
      blurb: o.blurb,
      icon: o.icon,
    }))
}
