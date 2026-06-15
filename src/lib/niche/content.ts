// 니치 랜딩 엔진 — 제품군 일반화 코어 (OMO-3215 / 부모 OMO-3214).
//
// 명함 전용이던 니치 랜딩 엔진을 product group(business-cards / stickers / flyers /
// posters / labels …)으로 파라미터화한다. 단일 `NicheContent` 타입이 라우트
// (generateStaticParams/Metadata), 공유 템플릿(NicheLanding), JSON-LD, sitemap 을
// 모두 구동한다. 새 제품군은 아래 NICHE_GROUPS 에 config 한 줄 추가로 자동 생성된다.
//
// 콘텐츠 운영(C2/C3) 두 경로:
//   1) 각 그룹 SEED(코드) 에 추가 — PR 머지 즉시 정적 생성.
//   2) Supabase `print_niche_pages`(product_group 컬럼) 에 row insert — 배포 없이 추가.
//      (loader 가 product_group 기준 DB row 를 slug 로 병합, 컬럼/테이블 부재 시 SEED 폴백)
//
// ⚠️ business-cards 콘텐츠는 기존 `professions.ts`(ProfessionContent SEED + 레거시 DB
//    병합)를 단일 소스로 재사용한다. ProfessionContent → NicheContent 어댑터로 하위호환.

import {
  getAllProfessions,
  type ProfessionContent,
  type FaqItem,
  type InternalLink,
} from '@/lib/niche/professions'
import { getFinishes, presetFinishingValues } from '@/lib/niche/finishes'

export type { FaqItem, InternalLink }

/** 추천옵션 관련 실사진(SEO alt 필수). business-cards 는 마감 카탈로그 이미지에서 파생. */
export type NichePhoto = {
  /** 이미지 URL(`public/niche/{group}/*` 로컬 자산 또는 next.config 허용 원격 호스트). */
  src: string
  /** SEO·접근성 alt(필수). */
  alt: string
  /** 카드 제목(예: 마감 이름). */
  title?: string
  /** 1~2문장 설명. */
  blurb?: string
  /** 이모지 아이콘(외부 자산 의존 없는 시각 보조). */
  icon?: string
}

/**
 * 전 제품군 공유 니치 콘텐츠 타입.
 * ProfessionContent(business-cards) 는 professionToNiche 어댑터로 이 타입에 매핑된다.
 */
export type NicheContent = {
  /** 제품군 URL 세그먼트. 예: 'business-cards' | 'stickers' | 'flyers' | 'posters' | 'labels'. */
  productGroup: string
  /** 그룹 내 URL slug, 복수형 권장. 예: 'realtors' → /business-cards/for/realtors */
  slug: string
  /** 복수형 표기(제목/그리드 카드용). 예: 'Realtors', 'Die-Cut Stickers'. */
  title: string
  /** 단수형 표기(문장 삽입용). 예: 'Realtor', 'Die-Cut Sticker'. */
  titleSingular: string
  h1: string
  metaTitle: string
  metaDescription: string
  heroSubhead: string
  /** 니치 맥락 단락(왜 이 제품/직업에 프리미엄이 통하는가). */
  intro: string
  /** 유스케이스 불릿. */
  useCases: string[]
  /** 추천 옵션 slug(business-cards=finishes.ts 마감 slug, 타 그룹=그룹별 옵션 slug). */
  recommendedOptions: string[]
  /** 추천옵션 관련 사진 섹션(보드 지시 OMO-3211). */
  photos: NichePhoto[]
  faqs: FaqItem[]
  /** 관련 내부링크(다른 니치·허브로 흐름). */
  internalLinks: InternalLink[]
  /** Offer 최저가(USD). */
  priceFrom: number
  /**
   * "이 옵션으로 만들기" 프리셋 딥링크 — 컨피규레이터로 추천옵션을 실어 보낸다.
   * 예: /products/premium-business-cards?niche=realtors&finishing=foil_stamp,deboss_emboss
   * 수신측(ProductConfigurator)이 `finishing`/`preset` 쿼리를 파싱해 초기 state 주입.
   */
  ctaPresetHref: string
}

// ── business-cards 어댑터 (ProfessionContent → NicheContent) ────────────────

/** 추천 마감 카탈로그에서 사진 카드 배열 생성(추천옵션 관련 이미지). */
function buildFinishPhotos(recommendedFinishes: string[]): NichePhoto[] {
  return getFinishes(recommendedFinishes).map((f) => ({
    src: f.image,
    alt: `${f.name} on a premium business card`,
    title: f.name,
    blurb: f.blurb,
    icon: f.icon,
  }))
}

/** business-cards 프리셋 딥링크 대상 제품(프리미엄 명함 구성기). */
const BUSINESS_CARD_PRESET_PRODUCT = 'premium-business-cards'

/** 추천 마감 중 주문 가능한 후가공만 추출해 컨피규레이터 딥링크 생성. */
function businessCardPresetHref(p: ProfessionContent): string {
  // presetFinishingValues 는 finishes.ts 의 configValue(foil_stamp/deboss_emboss/die_cut)만 추출.
  const values = presetFinishingValues(p.recommendedFinishes)
  const params = new URLSearchParams({ niche: p.slug })
  if (values.length > 0) params.set('finishing', values.join(','))
  return `/products/${BUSINESS_CARD_PRESET_PRODUCT}?${params.toString()}`
}

export function professionToNiche(p: ProfessionContent): NicheContent {
  return {
    productGroup: 'business-cards',
    slug: p.slug,
    title: p.profession,
    titleSingular: p.professionSingular,
    h1: p.h1,
    metaTitle: p.metaTitle,
    metaDescription: p.metaDescription,
    heroSubhead: p.heroSubhead,
    intro: p.intro,
    useCases: p.useCases,
    recommendedOptions: p.recommendedFinishes,
    photos: buildFinishPhotos(p.recommendedFinishes),
    faqs: p.faqs,
    internalLinks: p.internalLinks,
    priceFrom: p.priceFrom,
    ctaPresetHref: businessCardPresetHref(p),
  }
}

// ── 제품군 레지스트리 ────────────────────────────────────────────────────────

export type NicheGroupConfig = {
  /** URL 세그먼트(productGroup). */
  group: string
  /** 사람용 라벨(브레드크럼/허브 제목). 예: 'Business Cards'. */
  label: string
  /** 허브(/[group]/for) 메타·히어로. */
  hubH1: string
  hubMetaTitle: string
  hubMetaDescription: string
  hubSubhead: string
  /** 정적 SEED 콘텐츠(이미 DB 병합 완료분 포함 가능). */
  loadSeed: () => Promise<NicheContent[]>
  /**
   * 제너릭 DB 병합 여부.
   * business-cards 는 loadSeed(=professions) 가 레거시 DB 를 이미 병합하므로 false.
   * 신규 그룹은 print_niche_pages.product_group=eq.{group} 를 추가 병합(true).
   */
  mergeDb: boolean
}

const NICHE_GROUPS: Record<string, NicheGroupConfig> = {
  'business-cards': {
    group: 'business-cards',
    label: 'Business Cards',
    hubH1: 'Business Cards Built for Your Profession',
    hubMetaTitle: 'Premium Business Cards by Profession | ProCardCrafters',
    hubMetaDescription:
      'Metallic foil, embossing, raised-gloss and QR smart business cards designed for your line of work. Find the premium card built for your profession.',
    hubSubhead: 'Premium finishes, designed around how you actually hand out a card.',
    loadSeed: async () => (await getAllProfessions()).map(professionToNiche),
    mergeDb: false,
  },
  // ── 신규 제품군: 엔진/라우트는 즉시 활성, 콘텐츠는 C2(라벨)/C3(스티커·전단·포스터)가 채운다.
  //    SEED 가 비어도 print_niche_pages(product_group) DB row 로 페이지 자동 생성된다.
  stickers: {
    group: 'stickers',
    label: 'Stickers',
    hubH1: 'Custom Stickers for Every Use',
    hubMetaTitle: 'Custom Stickers by Use Case | ProCardCrafters',
    hubMetaDescription:
      'Die-cut, kiss-cut, vinyl and holographic stickers built for your brand, product or event. Find the sticker designed for how you use it.',
    hubSubhead: 'Durable, vivid stickers — tuned for how you actually use them.',
    loadSeed: async () => [],
    mergeDb: true,
  },
  flyers: {
    group: 'flyers',
    label: 'Flyers',
    hubH1: 'Flyers That Get Noticed',
    hubMetaTitle: 'Custom Flyers by Use Case | ProCardCrafters',
    hubMetaDescription:
      'Promotional, event and menu flyers on premium stock with finishes that make them worth keeping. Find the flyer built for your campaign.',
    hubSubhead: 'Premium stock and finishes, designed around how you hand a flyer out.',
    loadSeed: async () => [],
    mergeDb: true,
  },
  posters: {
    group: 'posters',
    label: 'Posters',
    hubH1: 'Posters That Command the Room',
    hubMetaTitle: 'Custom Posters by Use Case | ProCardCrafters',
    hubMetaDescription:
      'Large-format event, retail and art posters on premium stock with vivid color. Find the poster built for where it hangs.',
    hubSubhead: 'Large-format, vivid color — tuned for where the poster hangs.',
    loadSeed: async () => [],
    mergeDb: true,
  },
  labels: {
    group: 'labels',
    label: 'Labels',
    hubH1: 'Labels Built for Your Product',
    hubMetaTitle: 'Custom Labels by Use Case | ProCardCrafters',
    hubMetaDescription:
      'Product, packaging and bottle labels on durable stocks with premium finishes. Find the label built for your product.',
    hubSubhead: 'Durable stocks and premium finishes, tuned to your product.',
    loadSeed: async () => [],
    mergeDb: true,
  },
}

export function getNicheGroups(): NicheGroupConfig[] {
  return Object.values(NICHE_GROUPS)
}

export function getNicheGroupConfig(group: string): NicheGroupConfig | null {
  return NICHE_GROUPS[group] ?? null
}

/** 그룹 라벨 조회(브레드크럼/허브용). 미등록 그룹은 slug 를 Title Case 폴백. */
export function getGroupLabel(group: string): string {
  return (
    NICHE_GROUPS[group]?.label ??
    group
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  )
}

// ── DB 로더(제너릭, product_group 필터) ──────────────────────────────────────

type DbNicheRow = {
  slug: string
  content: NicheContent | null
}

/**
 * print_niche_pages 에서 발행된 그룹 콘텐츠를 읽는다.
 * - product_group 컬럼 존재 시 해당 그룹만 필터.
 * - 컬럼/테이블 부재(400/404) 또는 조회 실패 시 빈 배열 폴백(비치명적).
 */
async function loadDbNiche(group: string): Promise<NicheContent[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return []
  try {
    const res = await fetch(
      `${url}/rest/v1/print_niche_pages?select=slug,content&is_published=eq.true&product_group=eq.${encodeURIComponent(group)}`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        // 하루 단위 재생성 — 신규 발행분 반영하되 매 요청 DB 부하 방지.
        next: { revalidate: 86400 },
      },
    )
    if (!res.ok) return [] // 컬럼 부재(400) 포함 — SEED 폴백
    const data = (await res.json()) as DbNicheRow[]
    if (!Array.isArray(data)) return []
    return data
      .map((r) => r.content)
      .filter(
        (c): c is NicheContent =>
          Boolean(c && c.slug && c.productGroup === group),
      )
  } catch {
    return []
  }
}

/** 그룹의 전체 니치 콘텐츠(SEED + DB 병합, DB 우선). */
export async function getNicheByGroup(group: string): Promise<NicheContent[]> {
  const cfg = NICHE_GROUPS[group]
  if (!cfg) return []
  const seed = await cfg.loadSeed()
  const bySlug = new Map<string, NicheContent>()
  for (const c of seed) bySlug.set(c.slug, c)
  if (cfg.mergeDb) {
    for (const c of await loadDbNiche(group)) bySlug.set(c.slug, c)
  }
  return Array.from(bySlug.values())
}

/** 그룹+slug 단일 콘텐츠 조회. */
export async function getNicheItem(
  group: string,
  slug: string,
): Promise<NicheContent | null> {
  const all = await getNicheByGroup(group)
  return all.find((c) => c.slug === slug) ?? null
}
