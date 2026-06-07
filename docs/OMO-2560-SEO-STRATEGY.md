# OMO-2560 — 제품 페이지 구글 상위노출 SEO 전략

> 목표: 메인페이지/구글광고와 별개로, 사용자가 "business cards", "brochure printing",
> "custom stickers" 같은 **제품 키워드를 검색했을 때 개별 제품 페이지가 자연검색(organic)
> 상위에 노출**되도록 한다. (procardcrafters.com — 영어권 글로벌 타깃, USD 결제, FedEx 배송)

본 문서는 전략 + 이번 작업에서 **이미 구현한 기술 SEO 토대** + 보드/후속 작업이 처리해야 할
콘텐츠·오프페이지 액션을 정리한다.

---

## 0. 현황 진단 (작업 전)

| 항목 | 상태 | 비고 |
|------|------|------|
| `robots.ts` | ✅ 정상 | admin/api disallow, sitemap 링크 |
| `sitemap.ts` | ⚠️ **치명적 결함** | 하드코딩 5개 슬러그만 등록 → **활성 제품 88개 중 83개가 sitemap 누락** |
| root `metadata` | ✅ 양호 | metadataBase·OG·twitter·keywords 존재 |
| 제품 상세 `generateMetadata` | ⚠️ 최소 | title+description 만, canonical/OG/keywords 없음 |
| 구조화 데이터(JSON-LD) | ❌ 전무 | Product/Review/Breadcrumb 스키마 없음 → 리치 결과(별점·가격) 노출 불가 |
| GA4 / GTM / Ads 트래킹 | ✅ 구축됨 | OMO-2431/2442/2551/2557 |

가장 큰 누수는 **sitemap 누락(83개)** 과 **구조화 데이터 부재** 두 가지였다.

---

## 1. 이번 작업에서 구현 완료 (코드)

### 1-1. 동적 sitemap — `src/app/sitemap.ts`
- 하드코딩 5개 → **DB(`print_products`, is_active) 전체 조회**로 전환. 현재 88개 제품 + 88개 템플릿 랜딩 + 정적 7페이지 모두 색인 대상.
- `updated_at`을 `lastModified`로 노출 → 크롤 신선도 신호.
- DB 조회 실패 시 핵심 6개 슬러그 폴백, `revalidate: 86400`(1일) 캐시.

### 1-2. 제품 상세 구조화 데이터 — `src/app/products/[slug]/page.tsx`
- **Product 스키마**: name, description, image, brand, sku, category, `AggregateOffer`(lowPrice USD, InStock).
- **AggregateRating**: 승인 리뷰가 있을 때만(`total_reviews>0`) 별점/리뷰수 노출 → SERP 별점 리치 결과.
- **BreadcrumbList**: Home › Products › 제품명 → SERP 브레드크럼.
- 공용 컴포넌트 `src/components/JsonLd.tsx` 신설.

### 1-3. 메타데이터 강화
- 제품 상세: canonical, OG(hero 이미지), twitter, 제품별 keywords(`custom X`, `X printing`, `order X online`) 추가. 타이틀을 `제품명 | Custom 제품명 Printing` 형태로 키워드 전진 배치.
- 제품 목록(`/products`): canonical, OG, keywords 추가 + 타이틀 키워드 강화.

### 1-4. 사이트 전역 구조화 데이터 — `src/app/layout.tsx`
- **Organization** (브랜드 지식패널용) + **WebSite + SearchAction**(사이트링크 검색창용) JSON-LD.

> ⚠️ 검증: 배포 후 [Google Rich Results Test](https://search.google.com/test/rich-results)로
> 제품 URL을 넣어 Product/Breadcrumb 스키마가 valid로 잡히는지 확인할 것.

---

## 2. 키워드 전략 (타깃 맵)

영어권 구매의도(transactional) 키워드 중심. 제품 카테고리별 1차 타깃:

| 카테고리 | 핵심 키워드 | 롱테일 |
|----------|-------------|--------|
| business_cards | business cards, custom business cards | metallic / transparent / UV business cards, foil business cards |
| brochures | brochure printing, custom brochures | tri-fold brochure printing |
| flyers | flyer printing, custom flyers | a5 flyer printing, leaflet printing |
| stickers | custom stickers, sticker printing | die-cut / holographic / kraft stickers |
| labels | custom labels, label printing | waterproof / barcode / food labels (롱테일 다수, 라벨만 30+ SKU) |
| postcards/posters/banners | postcard/poster/banner printing | roll-up banner, x-banner |

- 제품명 자체가 키워드 → 이미 메타/H1/슬러그에 반영됨.
- **라벨 카테고리**가 SKU 30개+로 롱테일 점유 잠재력이 가장 큼 → 콘텐츠 우선순위 높음.

---

## 3. 보드/후속 작업 필요 (코드 외 — 본 heartbeat 범위 밖)

### A. Google Search Console 등록 (최우선, 보드 액션)
1. GSC에서 procardcrafters.com 도메인 속성 등록 + 소유권 인증(DNS TXT 또는 기존 GA4 연동).
2. `https://procardcrafters.com/sitemap.xml` 제출.
3. URL 검사 → 주요 제품 5~10개 색인 요청.
→ **이게 없으면 위 기술 작업 효과가 측정/촉진되지 않음.** 별도 child 이슈로 위임 권장.

### B. 제품 설명(description_en) 콘텐츠 보강
- 현재 일부 제품 description_en이 짧거나 비어 있을 수 있음 → 200~300자, 키워드 자연 포함, 용도/스펙/배송 포함으로 보강. (제품 데이터 작업 → 별도 이슈)

### C. 리뷰 적재
- AggregateRating은 승인 리뷰가 있어야 별점 노출. 제품별 실제 리뷰 확보/마이그레이션 필요.

### D. 백링크/오프페이지 (장기)
- 디렉터리 등록, 콘텐츠(블로그: "how to design business cards" 류)로 정보성 키워드 진입.

---

## 4. 측정 (KPI)

- GSC: 색인된 페이지 수(목표 88+ 전 제품), 노출수(impressions), 평균 게재순위, CTR.
- GA4: organic 세션 → 제품 페이지 view_item → 전환.
- 리치 결과: 제품 SERP에 별점/가격 노출 여부.
- 점검 주기: GSC 색인 반영 2~4주 소요 → 4주 후 1차 리뷰.

---

## 5. 우선순위 요약

1. ✅ (완료) sitemap 88개 전체 + 구조화 데이터 + 메타데이터 — **배포 필요**
2. ⏭ GSC 등록 + sitemap 제출 (보드)
3. ⏭ 제품 description 보강 + 리뷰 적재
4. ⏭ 정보성 콘텐츠/백링크 (장기)

배포 경로: Vercel(authenticated CLI 접근 보유 — [[vercel-deploy-access]]). 머지 후 프로덕션 반영
시 sitemap/구조화 데이터 자동 적용.
