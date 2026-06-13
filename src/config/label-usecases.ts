// OMO-3090: 제너릭 라벨 4종 use-case 랜딩 콘텐츠 (PrintSpecialist 저작).
//
// 근거: OMO-3085 머천다이징 사인오프 B-2 예외 조항.
//   제너릭 4종(food-info/cosmetic-ingredient/health-food/barcode-qr)은 art-roll-label
//   (아트지 STR080ABN)과 가격·소재가 완전 동일 → 독립 priced SKU 신설 금지.
//   대신 art-roll 가격엔진 위 use-case 프리셋/랜딩 변형으로만 노출하며,
//   "고유 use-case 콘텐츠(규격 프리셋·표시사항 가이드·샘플)가 갖춰진 변형만" is_active 허용.
//   빈 껍데기 중복노출 금지 → 각 변형은 `contentReady: true` 게이트를 만족해야 한다.
//
// 소비처: Dev-Print(OMO-3089)의 art-roll use-case 프리셋 엔진.
//   - 가격: art-roll-label(STR080ABN) 실측 그리드 참조 (본 파일은 가격을 정의하지 않는다).
//   - print_spec 호환 필드(width_mm/height_mm/bleed_mm/safe_mm/min_dpi/color_mode)로
//     프리셋 사이즈를 제공하므로 print_products.print_spec 매핑에 그대로 사용 가능.
//
// 표시사항 가이드 상세·법적근거 본문: docs/label-usecase-content.md

/** print_products.print_spec jsonb 와 동일 형태(블리드·세이프·DPI·색상). */
export interface LabelPrintSpec {
  width_mm: number
  height_mm: number
  /** 재단여백(블리드). 롤라벨 다이컷 표준 2mm. */
  bleed_mm: number
  /** 안전여백(중요 요소 최소 이격). */
  safe_mm: number
  /** 입고 파일 최소 해상도. 일반 라벨 300, 바코드/미세선 600 권장. */
  min_dpi: number
  color_mode: 'CMYK'
  /** 다이컷 형상. 미지정 시 사각. */
  shape?: 'rect' | 'round-rect' | 'circle' | 'oval'
}

export interface LabelPresetSize {
  /** 안정적 식별자 — 엔진/URL/주문옵션 키. */
  key: string
  label_ko: string
  label_en: string
  /** 어떤 용기·용도에 맞는 규격인지. */
  usage_ko: string
  spec: LabelPrintSpec
  /** 변형의 기본 프리셋(주문 폼 디폴트). 변형당 정확히 1개. */
  is_default?: boolean
}

export interface LabelGuideSection {
  heading_ko: string
  /** 의무/권고 표시항목 — 랜딩의 체크리스트로 렌더. */
  items_ko: string[]
  note_ko?: string
}

export type LabelUseCaseKey =
  | 'food-info'
  | 'cosmetic-ingredient'
  | 'health-food'
  | 'barcode-qr'

export interface LabelUseCase {
  key: LabelUseCaseKey
  /** 가격엔진 부모 제품 슬러그. 가격은 이 그리드를 참조. */
  parentSlug: 'art-roll-label'
  /** 성원 용지 코드(아트지 80g). 부모와 동일 — 가격·소재 패리티. */
  paperCode: 'STR080ABN'
  /** 랜딩 URL 슬러그(롱테일 SEO). */
  slug: string
  nameKo: string
  nameEn: string
  tagline_ko: string
  /** 롱테일 SEO 키워드(메타·H1·본문). */
  seoKeywords: string[]
  /** 표시사항 가이드의 법적/표준 근거. */
  legalBasis_ko: string[]
  /** 규격 프리셋 사이즈(엔진이 print_spec 으로 매핑). */
  presetSizes: LabelPresetSize[]
  /** 표시사항 가이드(use-case 고유 콘텐츠 ②). */
  guide: LabelGuideSection[]
  /** 면책/주의 — 표시 의무는 고객(영업자) 책임임을 명시. */
  disclaimer_ko: string
  /** 샘플 이미지(use-case 고유 콘텐츠 ③). 다이라인 규격 템플릿 SVG. */
  sampleImage: { src: string; alt_ko: string }
  /**
   * 노출 게이트(OMO-3085 B-2). 4종 모두 본 파일에서 콘텐츠가 완성되어 true.
   * Dev-Print 엔진은 이 플래그가 true 인 변형만 is_active 노출한다.
   */
  contentReady: true
}

/** 롤라벨(아트지) 다이컷 공통 베이스 — 변형 프리셋이 width/height/shape 만 차등. */
const ART_ROLL_BASE = {
  bleed_mm: 2,
  safe_mm: 2,
  min_dpi: 300,
  color_mode: 'CMYK',
} as const

export const LABEL_USE_CASES: readonly LabelUseCase[] = [
  // ──────────────────────────────────────────────────────────────────────
  // 1) 식품 표시사항 라벨
  // ──────────────────────────────────────────────────────────────────────
  {
    key: 'food-info',
    parentSlug: 'art-roll-label',
    paperCode: 'STR080ABN',
    slug: 'food-info-labels',
    nameKo: '식품 표시사항 라벨',
    nameEn: 'Food Information Labels',
    tagline_ko: '가공식품 의무표시사항·소비기한·알레르기 정보를 한 장에 — 아트지 롤라벨.',
    seoKeywords: ['식품 라벨 인쇄', '식품 표시사항 라벨', '소비기한 스티커', '영양성분 라벨', '원재료명 라벨'],
    legalBasis_ko: [
      '식품 등의 표시·광고에 관한 법률 및 같은 법 시행규칙',
      '식품 등의 표시기준(식품의약품안전처 고시)',
    ],
    presetSizes: [
      {
        key: 'food-info-40x30',
        label_ko: '소형 정보 40×30mm',
        label_en: 'Compact 40×30mm',
        usage_ko: '소형 용기·낱개 포장 보조 표시',
        spec: { ...ART_ROLL_BASE, width_mm: 40, height_mm: 30, shape: 'round-rect' },
      },
      {
        key: 'food-info-50x40',
        label_ko: '표준 50×40mm',
        label_en: 'Standard 50×40mm',
        usage_ko: '일반 가공식품 일괄표시면 표준',
        spec: { ...ART_ROLL_BASE, width_mm: 50, height_mm: 40, shape: 'round-rect' },
        is_default: true,
      },
      {
        key: 'food-info-70x50',
        label_ko: '영양성분 포함 70×50mm',
        label_en: 'With nutrition 70×50mm',
        usage_ko: '영양성분표 + 원재료명 동시 표기',
        spec: { ...ART_ROLL_BASE, width_mm: 70, height_mm: 50, shape: 'round-rect' },
      },
      {
        key: 'food-info-90x40-band',
        label_ko: '원통 띠지형 90×40mm',
        label_en: 'Cylinder band 90×40mm',
        usage_ko: '병·캔 등 원통형 용기 둘레 부착',
        spec: { ...ART_ROLL_BASE, width_mm: 90, height_mm: 40, shape: 'rect' },
      },
    ],
    guide: [
      {
        heading_ko: '가공식품 의무표시사항',
        items_ko: [
          '제품명',
          '식품유형',
          '영업소(제조원) 명칭 및 소재지',
          '소비기한(2023년부터 유통기한 → 소비기한 의무 전환)',
          '내용량(및 해당 열량)',
          '원재료명',
          '영양성분(해당 식품)',
          '용기·포장 재질 및 분리배출 표시',
          '부정·불량식품 신고전화(1399)',
        ],
      },
      {
        heading_ko: '알레르기 유발물질 표시(22종)',
        items_ko: [
          '알류(가금류)·우유·메밀·땅콩·대두·밀·잣·호두',
          '게·새우·오징어·고등어·조개류(굴/전복/홍합 포함)',
          '돼지고기·쇠고기·닭고기·복숭아·토마토·아황산류',
        ],
        note_ko: '함유 또는 혼입 가능성 시 일괄표시면에 별도 강조 표시(예: "알레르기 유발물질: 밀, 대두 함유").',
      },
      {
        heading_ko: '인쇄·가독성 권고',
        items_ko: [
          '표시사항 활자 크기 10포인트 이상 권장(소비기한·내용량 등 핵심 정보)',
          '냉장·냉동·습기 환경이면 유포지(방수) 변형 검토 → yupo-waterproof-label 안내',
          '바탕/글자 고대비 — 본문 K100 권장',
        ],
      },
    ],
    disclaimer_ko:
      '표시사항의 내용·정확성은 식품 영업자(주문 고객)의 책임입니다. 본 가이드는 인쇄 규격 안내이며 법률 자문이 아닙니다. 최신 식약처 고시를 확인하세요.',
    sampleImage: {
      src: '/samples/labels/food-info.svg',
      alt_ko: '식품 표시사항 라벨 50×40mm 규격 템플릿(일괄표시면·소비기한·영양성분 영역 표기)',
    },
    contentReady: true,
  },

  // ──────────────────────────────────────────────────────────────────────
  // 2) 화장품 전성분 표시 라벨
  // ──────────────────────────────────────────────────────────────────────
  {
    key: 'cosmetic-ingredient',
    parentSlug: 'art-roll-label',
    paperCode: 'STR080ABN',
    slug: 'cosmetic-ingredient-labels',
    nameKo: '화장품 전성분 표시 라벨',
    nameEn: 'Cosmetic Ingredient Labels',
    tagline_ko: '화장품법 전성분·사용기한·책임판매업자 기재사항을 정확히 — 아트지 롤라벨.',
    seoKeywords: ['화장품 라벨 인쇄', '화장품 전성분 라벨', '전성분 표시 스티커', '화장품 용기 라벨', '책임판매업자 라벨'],
    legalBasis_ko: [
      '화장품법 제10조(화장품의 기재사항) 및 같은 법 시행규칙 제19조',
      '화장품 표시·광고 관리 가이드라인(식품의약품안전처)',
    ],
    presetSizes: [
      {
        key: 'cosmetic-30x40',
        label_ko: '소용량 본체 30×40mm',
        label_en: 'Small body 30×40mm',
        usage_ko: '앰플·샘플 등 소용량 1차 포장(생략 규정 적용)',
        spec: { ...ART_ROLL_BASE, width_mm: 30, height_mm: 40, shape: 'round-rect' },
      },
      {
        key: 'cosmetic-50x60',
        label_ko: '표준 전성분 50×60mm',
        label_en: 'Standard 50×60mm',
        usage_ko: '일반 화장품 본체 전성분 표시',
        spec: { ...ART_ROLL_BASE, width_mm: 50, height_mm: 60, shape: 'round-rect' },
        is_default: true,
      },
      {
        key: 'cosmetic-60x80',
        label_ko: '튜브·롱바디 60×80mm',
        label_en: 'Tube/long 60×80mm',
        usage_ko: '튜브·세럼 등 세로형 용기',
        spec: { ...ART_ROLL_BASE, width_mm: 60, height_mm: 80, shape: 'round-rect' },
      },
      {
        key: 'cosmetic-70x90-band',
        label_ko: '펌프보틀 띠 70×90mm',
        label_en: 'Pump bottle 70×90mm',
        usage_ko: '펌프형 보틀 둘레 전성분 띠',
        spec: { ...ART_ROLL_BASE, width_mm: 70, height_mm: 90, shape: 'round-rect' },
      },
    ],
    guide: [
      {
        heading_ko: '1차/2차 포장 기재사항',
        items_ko: [
          '화장품의 명칭',
          '영업자(화장품제조업자/책임판매업자) 상호 및 주소',
          '제조에 사용된 모든 성분(전성분) — 함량 순',
          '내용물의 용량 또는 중량',
          '제조번호',
          '사용기한 또는 개봉 후 사용기간(PAO 심볼 + 개월)',
          '가격',
          '기능성화장품 문구 및 사용 시 주의사항(해당 시)',
        ],
      },
      {
        heading_ko: '전성분 표시 규칙',
        items_ko: [
          '함량이 많은 순으로 기재(함량 순)',
          '1% 이하 성분·착향제·착색제는 순서 무관',
          "착향제는 '향료'로 표시 가능",
          '착향제 알레르기 유발성분 25종은 함량 초과 시 성분명 별도 표시',
        ],
        note_ko: '씻어내는 제품 0.01%·씻어내지 않는 제품 0.001% 초과 시 25종 알레르기 유발성분 개별 표시(2020.1.1 시행).',
      },
      {
        heading_ko: '소용량·인쇄 권고',
        items_ko: [
          '내용량 50ml(g) 이하 소용량은 일부 기재사항 생략 가능(명칭·상호·제조번호·사용기한 등 핵심은 유지)',
          '전성분은 글자수가 많음 → 50×60mm 이상 또는 가독 활자 확보 권장',
          '개봉 후 사용기간(PAO) 심볼은 벡터로 선명하게',
        ],
      },
    ],
    disclaimer_ko:
      '기재사항의 내용·정확성은 화장품 책임판매업자(주문 고객)의 책임입니다. 본 가이드는 인쇄 규격 안내이며 법률 자문이 아닙니다. 최신 식약처 고시·가이드라인을 확인하세요.',
    sampleImage: {
      src: '/samples/labels/cosmetic-ingredient.svg',
      alt_ko: '화장품 전성분 표시 라벨 50×60mm 규격 템플릿(명칭·전성분·사용기한·PAO 영역 표기)',
    },
    contentReady: true,
  },

  // ──────────────────────────────────────────────────────────────────────
  // 3) 건강기능식품 표시 라벨
  // ──────────────────────────────────────────────────────────────────────
  {
    key: 'health-food',
    parentSlug: 'art-roll-label',
    paperCode: 'STR080ABN',
    slug: 'health-functional-food-labels',
    nameKo: '건강기능식품 표시 라벨',
    nameEn: 'Health Functional Food Labels',
    tagline_ko: "'건강기능식품' 도안·기능성 정보·의약품 아님 문구까지 규격대로 — 아트지 롤라벨.",
    seoKeywords: ['건강기능식품 라벨 인쇄', '건기식 라벨', '건강기능식품 표시 스티커', '기능성 표시 라벨', '영양기능정보 라벨'],
    legalBasis_ko: [
      '건강기능식품에 관한 법률 및 같은 법 시행규칙',
      '건강기능식품의 표시기준(식품의약품안전처 고시)',
    ],
    presetSizes: [
      {
        key: 'health-food-40x60',
        label_ko: '소형 병 40×60mm',
        label_en: 'Small bottle 40×60mm',
        usage_ko: '소형 정/캡슐 병',
        spec: { ...ART_ROLL_BASE, width_mm: 40, height_mm: 60, shape: 'round-rect' },
      },
      {
        key: 'health-food-50x60',
        label_ko: '스틱·파우치 50×60mm',
        label_en: 'Stick/pouch 50×60mm',
        usage_ko: '분말 스틱·파우치 단위 포장',
        spec: { ...ART_ROLL_BASE, width_mm: 50, height_mm: 60, shape: 'round-rect' },
      },
      {
        key: 'health-food-70x90-band',
        label_ko: '정/캡슐 보틀 띠 70×90mm',
        label_en: 'Tablet bottle 70×90mm',
        usage_ko: '정·캡슐 보틀 둘레 일괄표시(영양·기능정보 포함)',
        spec: { ...ART_ROLL_BASE, width_mm: 70, height_mm: 90, shape: 'round-rect' },
        is_default: true,
      },
    ],
    guide: [
      {
        heading_ko: '의무표시사항',
        items_ko: [
          "'건강기능식품' 문자 또는 인증 도안(마크)",
          '제품명 / 영업소 명칭 및 소재지',
          '소비기한 및 보관방법',
          '내용량 / 원료명 및 함량',
          '영양·기능정보(1일 섭취량당 기능성분·지표성분 함량, % 영양성분 기준치)',
          '기능성 내용(인정받은 고시형/개별인정형 기능성)',
          '섭취량·섭취방법 및 섭취 시 주의사항',
        ],
      },
      {
        heading_ko: '필수 안전 문구',
        items_ko: [
          '"본 제품은 질병의 예방 및 치료를 위한 의약품이 아닙니다"',
          '이상사례 발생 시 신고 안내(건강기능식품 이상사례 1577-2488)',
          'GMP 적용업소 도안(해당 시)',
        ],
        note_ko: '질병의 예방·치료를 직접 표방하는 표현은 금지. 기능성은 인정 범위 내 문구만 사용.',
      },
      {
        heading_ko: '인쇄 권고',
        items_ko: [
          '영양·기능정보 표는 표 괘선 0.25pt 이상, 본문 활자 가독 확보',
          "'건강기능식품' 도안은 비율 왜곡 금지(원본 비율 유지)",
          '보틀 곡면 부착 → 좌우 안전여백 충분히',
        ],
      },
    ],
    disclaimer_ko:
      '기능성·표시 문구의 적법성은 건강기능식품 영업자(주문 고객)의 책임입니다. 본 가이드는 인쇄 규격 안내이며 법률 자문이 아닙니다. 인정받은 기능성 범위와 최신 식약처 고시를 확인하세요.',
    sampleImage: {
      src: '/samples/labels/health-food.svg',
      alt_ko: '건강기능식품 표시 라벨 70×90mm 규격 템플릿(건기식 도안·영양기능정보·의약품 아님 문구 영역 표기)',
    },
    contentReady: true,
  },

  // ──────────────────────────────────────────────────────────────────────
  // 4) 바코드/QR 라벨
  // ──────────────────────────────────────────────────────────────────────
  {
    key: 'barcode-qr',
    parentSlug: 'art-roll-label',
    paperCode: 'STR080ABN',
    slug: 'barcode-qr-labels',
    nameKo: '바코드/QR 라벨',
    nameEn: 'Barcode / QR Labels',
    tagline_ko: 'EAN-13·QR 스캔 인식률을 보장하는 여백·배율·고대비 규격 — 아트지 롤라벨.',
    seoKeywords: ['바코드 라벨 인쇄', 'QR 라벨', '바코드 스티커', 'EAN-13 라벨', '물류 라벨 인쇄'],
    legalBasis_ko: [
      'GS1 표준(EAN-13/GTIN) 심볼 규격',
      'QR Code 표준 ISO/IEC 18004',
    ],
    presetSizes: [
      {
        key: 'barcode-qr-25x25',
        label_ko: 'QR 정사각 25×25mm',
        label_en: 'QR square 25×25mm',
        usage_ko: '제품 QR(스마트폰 스캔)',
        spec: { ...ART_ROLL_BASE, width_mm: 25, height_mm: 25, min_dpi: 600, shape: 'rect' },
      },
      {
        key: 'barcode-qr-40x30',
        label_ko: 'EAN-13 표준 40×30mm',
        label_en: 'EAN-13 40×30mm',
        usage_ko: 'EAN-13 바코드 + quiet zone 여백 표준',
        spec: { ...ART_ROLL_BASE, width_mm: 40, height_mm: 30, min_dpi: 600, shape: 'rect' },
        is_default: true,
      },
      {
        key: 'barcode-qr-50x30',
        label_ko: '가격+바코드 50×30mm',
        label_en: 'Price+barcode 50×30mm',
        usage_ko: '소매 가격표시 + 바코드 병기',
        spec: { ...ART_ROLL_BASE, width_mm: 50, height_mm: 30, min_dpi: 600, shape: 'rect' },
      },
      {
        key: 'barcode-qr-100x50',
        label_ko: '물류 라벨 100×50mm',
        label_en: 'Logistics 100×50mm',
        usage_ko: '박스·물류 식별(바코드+텍스트)',
        spec: { ...ART_ROLL_BASE, width_mm: 100, height_mm: 50, min_dpi: 600, shape: 'rect' },
      },
    ],
    guide: [
      {
        heading_ko: 'EAN-13 바코드 규격',
        items_ko: [
          '표준 배율 100% = 약 37.29×25.93mm(quiet zone 포함). 80~200% 범위 권장',
          '최소 인쇄 배율 80% 이상(소매 POS 스캐너 호환)',
          'Quiet zone(여백): 좌측 ≥11모듈(약 3.6mm), 우측 ≥7모듈(약 2.3mm)',
          '막대 = K100 검정 / 배경 = 흰색. 빨강·노랑 계열 막대·배경 금지(미인식)',
        ],
      },
      {
        heading_ko: 'QR 코드 규격',
        items_ko: [
          '권장 최소 인쇄 크기 15×15mm 이상',
          'Quiet zone 4모듈 이상 확보',
          '오류정정레벨 M 이상(인쇄물 권장)',
          '코드/배경 고대비 — 반전(밝은 코드/어두운 배경) 지양',
        ],
      },
      {
        heading_ko: '인쇄·소재 권고',
        items_ko: [
          '바코드/QR은 벡터 또는 600dpi 이상으로 입고(막대 에지 선명도)',
          '광택 표면은 반사로 스캔 저하 → 무광/아트지 권장',
          '곡면·소형 용기는 모듈 폭(X-dimension) ≥ 0.264mm 유지',
        ],
        note_ko: '인쇄 전 검증용 스캔(그레이드 C 이상) 권장. 막대 위에 다른 요소를 겹치지 마세요.',
      },
    ],
    disclaimer_ko:
      'GTIN/바코드 번호의 발급·정확성은 주문 고객의 책임입니다(GS1 Korea 등록 번호 사용). 본 가이드는 인쇄 규격 안내이며, 인쇄 후 스캔 검증을 권장합니다.',
    sampleImage: {
      src: '/samples/labels/barcode-qr.svg',
      alt_ko: '바코드/QR 라벨 40×30mm 규격 템플릿(EAN-13 막대·quiet zone 여백·QR 영역 표기)',
    },
    contentReady: true,
  },
] as const

/** 키로 use-case 조회. */
export function getLabelUseCase(key: string): LabelUseCase | undefined {
  return LABEL_USE_CASES.find(u => u.key === key)
}

/** 랜딩 슬러그로 use-case 조회. */
export function getLabelUseCaseBySlug(slug: string): LabelUseCase | undefined {
  return LABEL_USE_CASES.find(u => u.slug === slug)
}

/**
 * 노출 게이트(OMO-3085 B-2): 콘텐츠가 완성된 변형만 반환.
 * Dev-Print 엔진은 이 목록에 한해 is_active 노출한다(빈 껍데기 중복노출 금지).
 */
export function getExposableLabelUseCases(): readonly LabelUseCase[] {
  return LABEL_USE_CASES.filter(u => u.contentReady)
}
