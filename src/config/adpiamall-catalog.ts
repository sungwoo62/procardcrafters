// OMO-3027: 애드피아몰(성원애드피아) 대형출력·실사 제품 구성 데이터.
//
// 출처: 2026-06-13 애드피아몰(www.adpiamall.com) 로그인 라이브 크롤(Playwright)로
//   메뉴 전체구성을 직접 확인. 회사=(주)성원애드피아몰(대표 정창희, 호스팅 ㈜성원애드피아)
//   → swadpia.co.kr(성원, 상업/디지털 인쇄)과 같은 성원애드피아 그룹의 **대형출력·실사 부문**.
//   따라서 우리 배너/실사출력 제품의 실생산 공급원은 애드피아몰이다.
//
// 본 데이터는 제품 '구성(카테고리·하위제품)'이다. 제품별 상세 규격(사이즈/단가)은
// 각 상품 페이지를 추가 크롤해야 하며(딥 크롤), 필요 시 후속 작업으로 시드한다.
// (성원/타사 디자인·자산 복제 아님 — 구성/규격은 우리 발주처의 운영 사실. OMO-2975 준수.)

export interface AdpiaCategory {
  /** 최상위 메뉴명(한국어). */
  name: string
  /** 영문 라벨(리포트 표기용). */
  nameEn: string
  /** 하위 제품군. */
  items: string[]
  /** 우리(PCCF) 카탈로그와의 연관도. */
  relevance: 'core' | 'related' | 'other'
  /** 비고(우리 매핑/템플릿 연관). */
  note?: string
}

export const ADPIAMALL_SOURCE = {
  site: 'www.adpiamall.com',
  company: '(주)성원애드피아몰',
  group: '성원애드피아',
  crawledAt: '2026-06-13',
  siblingOffsetSite: 'swadpia.co.kr',
} as const

export const ADPIAMALL_CATALOG: AdpiaCategory[] = [
  {
    name: '실사출력', nameEn: 'Large-format / Photo printing', relevance: 'core',
    note: '우리 포스터·시트지·천소재 등 대형 인쇄 공급. 템플릿 규격 소스 후보.',
    items: ['포스터', '종이류', '인화지', '보드지', '스티커/시트지', 'PET/특수소재', '천소재',
      '통자석시트지', '시트지컷팅', '패브릭스티커', 'DTF(판박이)스티커', '에폭시스티커', '띠부스티커'],
  },
  {
    name: '현수막', nameEn: 'Vinyl banners', relevance: 'core',
    note: '대형 현수막. ㎡단가·고객 입력 사이즈(고정 cut 없음).',
    items: ['일반현수막', '대량현수막', '초대형현수막', '어깨띠'],
  },
  {
    name: '배너', nameEn: 'Banner stands', relevance: 'core',
    note: '우리 banners/rollup/x/mini-banners 직접 대응. 실내/실외/와이드/미니/초대형/백월/LED.',
    items: ['실내용배너', '실외용배너', '와이드배너', '미니배너', '초대형배너', '배너출력',
      '백월배너', 'LED 벽걸이형 실내용배너', 'LED 스탠드형 실외용배너'],
  },
  {
    name: '간판', nameEn: 'Signage', relevance: 'related',
    items: ['후렉스조명', '백릿조명', '철제입간판', '우드입간판', 'LED 3D사인간판', '우드현판',
      '스텐입간판', '스텐현판', 'LED 아크릴간판', 'LED 라운드 입간판', '돌출간판',
      '알루미늄인쇄', '알루미늄명함', '알루미늄명찰', '신주인쇄', '신주마킹', '우드인쇄'],
  },
  {
    name: '액자', nameEn: 'Frames', relevance: 'related',
    items: ['원목액자', '알루미늄 액자', '캔버스 액자', '아크릴디아섹 액자', '초슬림 아트룩스 액자',
      '베젤 액자', '자작나무 액자'],
  },
  {
    name: 'LED', nameEn: 'LED displays', relevance: 'related',
    items: ['LED 원형입간판', '윈도우부착 LED패널', 'LED 3D사인간판', 'LED 벽걸이형 실내용배너',
      'LED 스탠드형 실외용배너', 'LED A형 철제입간판', 'LED 아크릴간판'],
  },
  {
    name: '아크릴', nameEn: 'Acrylic', relevance: 'related',
    items: ['아크릴판', '아크릴인쇄', '아크릴컷팅', '아크릴무드등', '아크릴가림막', '아크릴톡', '아크릴키링',
      '아크릴명찰', '아크릴비츠', '아크릴화병', '아크릴트레이', '아크릴박스', '아크릴절곡', '아크릴다보액자',
      '아크릴시계', '아크릴집게', '아크릴등신대'],
  },
  {
    name: '금속/우드', nameEn: 'Metal / Wood', relevance: 'related',
    items: ['알루미늄인쇄', '알루미늄명함', '알루미늄명찰', '신주인쇄', '신주마킹', '우드인쇄',
      '우드입간판', '우드현판', '스텐인쇄', '스텐입간판', '스텐현판'],
  },
  {
    name: 'POP/등신대', nameEn: 'POP / Standees', relevance: 'core',
    note: '합지/포맥스/폼보드 POP·등신대. 우리 POP 제품 공급원.',
    items: ['합지POP', '포맥스POP', '폼보드POP', '합지등신대', '포맥스등신대', '폼보드등신대', '포맥스절곡'],
  },
  {
    name: '대량주문/굿즈·판촉물', nameEn: 'Bulk order / Promo goods', relevance: 'other',
    note: '판촉물·굿즈 다수(포장백/우산/텀블러/의류/버튼/테이프/폰케이스 등). 우리 굿즈 라인 참고.',
    items: ['포장백', '판촉물', '야외활동', '우산', '미니선풍기', '의류', '텀블러', '버튼', '마스킹테이프',
      'OPP/크라프트테이프', '클립펜/퓨어젤펜', '폰케이스', '에어팟/버즈케이스', '말랑/쿠션/LED 키링',
      '포토카드 홀더', '맥세이프 카드지갑', '패브릭 포스터', '다이어리', '점착메모지', '캘린더(기성/대량/소량)',
      '메뉴판', '사원증/신분증/명찰'],
  },
  {
    name: '셀프디자인', nameEn: 'Self-design tool', relevance: 'other',
    items: ['온라인 셀프 디자인 에디터'],
  },
]
