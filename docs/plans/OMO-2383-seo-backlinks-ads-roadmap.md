# OMO-2383 SEO + 백링크 + Google Ads 로드맵 — Procardcrafters Phase 2 (CEO 제안)

작성일 2026-06-05 · CEO · 캐비닛 6에이전트 (Tech SEO / Content&pSEO / AEO / Backlinks / Paid Media / Challenger-Strategy)

## TL;DR — 보드 결정 필요 사항

이 이슈는 [OMO-2299](/OMO/issues/OMO-2299) **하루 20건 목표 성장 플랜의 Phase 2 (30~60일)** 전략 문서입니다.
캐비닛 6명이 5렌즈 + 1챌린저로 검토한 결과 **세 가지 즉시 결정**이 필요합니다.

### 🚨 BLOCKING — Week 0 신뢰성 게이트 (Challenger 발견)
**홈페이지의 "10,000+ Orders Delivered / 40+ Countries / 4.9★ Average Rating" 표기가 procardcrafters 도메인 실데이터와 불일치한다.**
DB 실측 (2026-06-05): `print_orders` 29건 (paid 15 / processing 12 / pending 2), **delivered 0건**, 기간 2026-05-13 ~ 2026-06-04, 별점 없음.
- 이 상태에서 `AggregateRating` JSON-LD를 박으면 Google 매뉴얼 액션
- Trustpilot/BBB/G2 프로필에 동일 수치 표기 시 프로필 정지 + 리뷰 사기 신고 리스크
- Google Ads RSA 카피 "4.9★ from 10K+ orders" → misleading-claims 정책 스트라이크
- FTC misrepresentation 노출

**→ 모든 schema/광고/디렉토리 작업의 선결 조건. 보드 결정 옵션**:
1. **(권장) 카피 재작성**: 홈페이지 stats 섹션을 "Powered by Sungwon Adpia — Korea's premier print factory since 2003, serving 10,000+ orders worldwide"로 부모 브랜드 명시 + procardcrafters 본인 KPI 별도 표기 (e.g. "29 US orders shipped from LA since May 2026")
2. 모든 fake stat 제거 후 신규 reviews 모일 때까지 trust signal 없이 운영
3. (위험) 현 상태 유지 — 단, schema/광고/디렉토리 작업은 전면 보류

### 결정 ②: Phase 2 우선순위 — 캐비닛은 평행 작업을 제안했으나 챌린저는 직렬 (drip publish) 권장
DR<10 신규 도메인의 Google 샌드박스 효과 고려 시, 평행 push는 thin-content 페널티 리스크. Challenger 권고에 따라 **Q1 = foundation + 1개 콘텐츠 클러스터 + tracking** 으로 축소.

### 결정 ③: Phase 1 SEO (OMO-2308) 미완성 deliverable 회수
OMO-2308 "Core Web Vitals + 기본 SEO 메타 태그" 는 `done` 처리됐으나 체크리스트 중 **구조화 데이터 (Product/LocalBusiness)** 와 **sitemap.xml 생성** 이 실제로는 미완성:
- `src/app/sitemap.ts` 는 5개 슬러그만 하드코딩 — 라이브 9개 중 brochures/premium-business-cards/die-cut-stickers/banners 누락
- `src/app/` 전역에 `application/ld+json` 0건
- Phase 2 시작 전 회수 필수

---

## 사이트 현황 감사 (2026-06-05)

| 영역 | 상태 | 갭 |
|------|------|----|
| 도메인 / 배포 | procardcrafters.com 라이브 (OMO-2306/2315 완료) | — |
| GA4 / Search Console / Ads 전환 픽셀 | OMO-2307 done — layout.tsx 에 gtag/GTM/Meta/TikTok/Clarity 와이어드 | `NEXT_PUBLIC_GOOGLE_ADS_ID` env 미설정 (gtag 발사 안 됨) |
| Core Web Vitals | OMO-2308 done | `/products/[slug]` 에 `export const dynamic = 'force-dynamic'` → TTFB 페널티 |
| sitemap.xml | 하드코딩 5/9 (drift) | DB 기반 동적 생성 필요 |
| robots.txt | `/admin`, `/api` disallow — 정확 | AI 크롤러 명시적 allow 미설정 |
| 메타 (title/description/OG/Twitter) | 12개 페이지 generateMetadata 적용 | canonical / hreflang=en-US 미설정 |
| JSON-LD | **0건** | Organization / Product / BreadcrumbList / FAQPage / WebSite+SearchAction 전무 |
| 블로그 / Content surface | 없음 | /learn or /guides 신설 필요 |
| 실주문 수 (Trust signal source) | 29건 (delivered 0) | 홈페이지 "10K+ / 40+ countries / 4.9★" 와 불일치 |

---

## 5렌즈 캐비닛 종합 권고 (Challenger 필터 후)

### Lens 1 — Technical SEO
**유지** ✅
1. **Sitemap drift 수정** — `print_products.is_active=true` 기반 동적 sitemap + `lastModified = product.updated_at`. (S, 1주, **Engineer-Goods**)
2. **JSON-LD 번들** — Organization (layout) + WebSite+SearchAction (layout) + Product+Offer (products/[slug]) + BreadcrumbList (모든 비-홈) + FAQPage (faq). **`AggregateRating` 은 Week 0 신뢰 감사 통과 후에만**. (M, 2주, Engineer-Goods)
3. **Canonical + hreflang=en-US** — generateMetadata 패턴에 alternates.canonical 추가. (S, 1주, Engineer-Goods)
4. **`NEXT_PUBLIC_GOOGLE_ADS_ID` 세팅 + GSC/Bing Webmaster verify + IndexNow 1회 ping** — debounce 없는 webhook 은 over-engineering (Challenger), 수동 ping 만. (S, 1주, Analytics)

**조건부 보류 / 재설계** ⚠️
5. **force-dynamic → ISR (revalidate=3600)** — **선결조건**: KRW→USD + Swadpia 가격 path 를 client component 로 분리 + 가격 staleness 모니터링 (5분 간격, delta>1.5% 알람) 먼저 구축. 그 후에만 진행. (M+M, 4주, Engineer-Goods) — 캐비닛 Week 2 → **Week 8+** 로 연기

**컷** ✂️ (Challenger 권고)
6. ~~프로그래마틱 spec 서브페이지 (`/business-cards/matte`, `/linen`)~~ — 도어웨이 페이지 리스크, 산업별 클러스터 먼저 검증 후로 연기.

### Lens 2 — Content + Programmatic SEO
**유지** ✅
1. **산업별 Business Cards 페이지 — 1차 20개 drip-publish** (캐비닛은 40-60개 제안, Challenger 권고로 절반 축소): realtors, photographers, lawyers, contractors, electricians, plumbers, salons, tattoo artists, dentists, personal trainers, DJs, makeup artists, food trucks, nail techs, pet groomers, doulas, real estate agents, mortgage brokers, freelance designers, consultants. 주당 2-3개 publish, /portfolio 와 product page 에서 internal link 흘려보내기. (L, 8주, **Content**)
2. **비교 페이지 8-10개** — vs Vistaprint / MOO / GotPrint / UPrinting + "[Competitor] alternative" 페이지. 정직한 비교표, 광고 LP 겸용. (M, 4주, **Marketing**)
3. **교육 블로그 클러스터 1개만 (Specs) — 5 cornerstone pieces** (캐비닛 15 → Challenger 권고로 1/3): "business card size guide US", "CMYK vs RGB", "bleed and safe zone", "GSM vs pt paper weight", "matte vs gloss vs soft-touch". 각 글 → 산업/비교 페이지로 internal link. (M, 5주, **Content**)

**컷** ✂️ (Challenger 권고)
4. ~~Local "near me" 25 메트로 × 9 제품 = 225 페이지~~ — 도어웨이 페이지 위험. **LA / Long Beach / Anaheim / San Diego** 4개 도시만 유지 (실제 same-day handoff 가능 지역). 나머지 컷. (175 페이지 위험 절감)
5. ~~Use-case 페이지 (wedding/event/holiday) 15개~~ — Q1 보류, 산업 클러스터 트래픽 검증 후 Q2에 평가.
6. ~~AI-SEO retrofit pass~~ — 콘텐츠 볼륨 쌓인 후, Q2.

### Lens 3 — AEO / AI-Search 최적화
**유지** ✅
1. **FAQPage + Product + Organization + BreadcrumbList JSON-LD** (Lens 1 #2와 통합).
2. **`/llms.txt` + `/llms-full.txt` 루트 publish** — Anthropic/Perplexity 채택 가속. 제품 9종 + USD 가격 tier + production 7-10d + FedEx 5-8d + LA fulfillment + 경쟁사 포지셔닝. Next.js 16 라우트 핸들러로. (S, 1주, Engineer-Goods)
3. **AI 크롤러 명시적 allow** in robots.ts — GPTBot/ClaudeBot/PerplexityBot/Google-Extended/Bingbot. 5-line fix. (S, 1주, Engineer-Goods)
4. **Q&A LP 8-10개** — "GSM vs lb", "die-cut vs kiss-cut", "CMYK vs RGB for print files", "how to print business cards in 3 days in LA", "FedEx Ground vs Express for print". 직접 답변 40단어 → HowTo/FAQPage schema → 비교표 → 심층 explainer. (M, 4주, **Content**)
5. **Print Glossary `/glossary` — 40+ DefinedTerm schema**. (M, 4주, **Content**)

**컷 / 연기** ✂️
6. ~~분기별 original-data 리포트 "State of US SMB Print 2026"~~ — Q3 이후로 연기. 실제 procardcrafters 데이터 누적 + legal/privacy 검토 + 신뢰 감사 통과 필요.
7. ~~Listicle inclusion 90일 캠페인~~ — Q2, Trustpilot 50+ 리뷰 + DR15+ 도달 후로 연기.

### Lens 4 — Backlinks + Directory Submissions
**유지** ✅
1. **Trustpilot + BBB 클레임** — **단, 신뢰 감사 통과 + 리뷰 요청 플로우 라이브 후**. (M, 2주, **Marketing**) → Week 4+ 시작
2. **POD/Print 디렉토리 sweep** — G2 / Capterra / AlternativeTo / GoodFirms / Sortlist / Crozdesk. (M, 3주, **Marketing**)
3. **디자이너 + 프리랜서 툴킷 디렉토리** — Awwwards Resources / Designer News / Toolify / Sidebar.io / Designer Toolbox / Sidebar / Indie Hackers Tools / Hey Designer / Print Magazine resources. 12-15 placements 목표, 비용 0~저비용. (M, 4주, **Marketing**)
4. **Unlinked brand mention reclamation** + 경쟁사 broken-link reclamation. (S, 6주, **Marketing**)

**컷** ✂️ (Challenger 권고)
5. ~~Google Business Profile (LA fulfillment 주소)~~ — GBP 가이드라인 위반 (walk-in 카운터 없음), 30-90일 내 정지 + 향후 재신청 poison. 실제 walk-in 카운터 운영 결정 시까지 컷.
6. ~~Product Hunt launch~~ — 커머스는 PH 에서 underperform. 컷.
7. ~~원조 데이터 PR (HARO/Qwoted/Featured + Fast Company/Inc 피치)~~ — Q2 이후. 신뢰 감사 + 리뷰 베이스 라인 + 실데이터 누적 후.
8. ~~Co-marketing 파트너십 (Canva/Notion/Linktree/Stripe Atlas)~~ — 12주 sales cycle × no-name 사이트 = 낮은 적중률. Q2 평가.

### Lens 5 — Google Ads / Paid Media
**유지** ✅ (단, 전체 일정 후행)
1. **`NEXT_PUBLIC_GOOGLE_ADS_ID` 세팅 + Enhanced Conversions (해시 이메일/폰) + GA4 'purchase' 1차 전환 import + Offline Conversion Import (>$200 AOV)** — 광고 비용 한 푼 쓰기 전 필수. (M, 1주, **Analytics + Engineer-Goods**)
2. **브랜드 방어 캠페인만 Month 1** — "procardcrafters" exact match $0.50 CPC cap, 일 $10 ($300/월). (S, 1주, **Media**)
3. **공격 negative keyword list** Day 1 — "free", "template", "design", "maker", "generator", "app", "software", "mockup", "psd", "canva", "jobs", "salary", "wholesale", "bulk supplier", "machine", "printer ink", "staples", "fedex office", "ups store". (S, 1주, **Media**)

**연기** ⏳ (Challenger 권고로 Month 1 $2-3K 비-브랜드 spend 보류)
4. **카테고리별 Exact/Phrase Search 캠페인** — Schema/Quality Score 베이스라인 + Trustpilot 리뷰 50+ 이후 (Month 2-3). (L, 2주 setup, Media)
5. **Google Shopping** — 실제 product photography 사진 슛 완료 후 (현재 이모지 플레이스홀더). Defer to Q2. (L, 3주, Engineer-Goods + Media)
6. **Manual CPC → Maximize Conversions → tROAS 진행** — 비-브랜드 launch 후 9주.
7. **Remarketing audiences 즉시 populate** — Customer Match list + RLSA + Demand Gen 리타겟. (M, 1주, Analytics + Media)
8. **Geo + audience signals** — US-only, LA metro +20~30% bid, 18-24 demo 제외. (S, 1주, Media)

**컷** ✂️
9. ~~Month 1 $2,000-3,000 비-브랜드 spend~~ — QS 베이스라인 없음, force-dynamic TTFB, 0 schema, 0 remarketing pool, 0 review moat. 브랜드 방어 $300/월 만 유지.
10. ~~PMax, Broad Match~~ — 캐비닛도 컷 권고함.

### Lens 6 — Challenger-Strategy 핵심 추가 권고 (모두 채택)
1. **Week 0 신뢰 감사 게이트** — 위 TL;DR ①.
2. **Baseline observability** — GSC verify + 30일 데이터 + Ahrefs/SEMrush 7일 trial ($99) — DR/referring domains/indexed pages/Top 100 rank/competitor gap 베이스라인. Week 1.
3. **리뷰 요청 플로우** — Trustpilot/G2 클레임 전 first-class deliverable. 배송 완료 NPS≥8 자동 이메일 + one-click 리뷰. Week 1-2.
4. **Pricing isolation refactor** — ISR 마이그레이션 전 KRW→USD + Swadpia path 분리, staleness 모니터링. (Week 6-8)
5. **/shipping + /returns 명료한 정책 + 제품 페이지 ETA 계산기 + "Not for rush orders" 배지** — 12-18일 delivery vs Vistaprint 3-day rush. 광고 전 필수. (Week 2-3)
6. **AI 크롤러 robots.txt 명시 allow** — Lens 3 #3과 통합.
7. **디자인 파일 업로드 client-side validator** — 블리드/safe zone/CMYK/300dpi 즉시 green/red 피드백. **Vistaprint 대비 진짜 moat**. AEO/비교/HARO 스토리 모두 강화. (별도 OMO 이슈로 분리 — design editor 작업과 연결)

---

## 시퀀싱 (Challenger 권고 채택)

### Week 0 (BLOCKING — 보드 결정)
- 신뢰 카피 감사 + 옵션 1/2/3 결정
- (옵션 1 선택 시) 홈페이지 stats 섹션 카피 재작성 PR

### Week 1 — Foundation 최소 셋
- Sitemap drift 수정 (DB 기반)
- Canonical + hreflang=en-US
- robots.txt AI 크롤러 명시 allow
- `/llms.txt` + `/llms-full.txt` 배포
- `NEXT_PUBLIC_GOOGLE_ADS_ID` 세팅 + Enhanced Conversions + Offline Conversion Import
- GSC + Bing Webmaster verify + 베이스라인 캡처 (Ahrefs trial)
- 브랜드 방어 캠페인 $300/월 launch

### Week 2-3 — JSON-LD + 정책 페이지
- Organization / WebSite+SearchAction / Product+Offer / BreadcrumbList / FAQPage schema (AggregateRating 제외)
- `/shipping` + `/returns` 명료화 + ETA 계산기 + "Not for rush orders" 배지
- 리뷰 요청 자동 이메일 플로우 라이브 (배송 완료 후 NPS 분기)

### Week 4-8 — Content cluster #1
- 산업별 Business Cards LP **20개 drip-publish** (Content owner) — 주당 2-3개
- 비교 페이지 8개 (Marketing)
- Trustpilot/BBB 클레임 (리뷰 50+ 누적 후)
- POD/Print 디렉토리 sweep (G2/Capterra/AlternativeTo/GoodFirms/Sortlist)
- 디자이너 디렉토리 sweep
- Q&A LP 4개 (Content)

### Week 6-8 — Pricing isolation + ISR migration
- Client component 분리 + staleness 모니터링 → force-dynamic 제거 → revalidate=3600

### Week 8-12 — Scale on signal
- 산업 클러스터 20→40 (검증된 카테고리만)
- 교육 블로그 cornerstone 5개
- Glossary 40 terms
- Q&A LP 4개 추가
- 비-브랜드 Google Ads Search 캠페인 (Quality Score ≥5 도달한 카테고리부터, 카테고리별 $50-100/day)
- 본격적 tROAS 진행은 30 conversions/캠페인 도달 후

### Q2+ (deferred until Q1 결과 검증)
- 원조 데이터 PR + HARO 캠페인
- Listicle inclusion campaign
- Co-marketing 파트너십
- Google Shopping (real product photography 완료 후)
- City programmatic 4개 → 추가 확장 검토
- AI-SEO retrofit pass

---

## 비용 (Q1 90일)

| 항목 | 비용 |
|------|------|
| Engineer-Goods (foundation + JSON-LD + ISR) | 인하우스 |
| Content (산업 20 + 비교 8 + 블로그 5 + Q&A 4 + Glossary 40) | 인하우스 + 필요시 freelance copywriter $1,500-3,000 |
| Ahrefs 7-day trial → 베이스라인 1회 | $99 |
| 브랜드 방어 Ads | $300/월 × 3 = $900 |
| 디렉토리 (Trustpilot Pro 결정시 옵션) | $0 ~ $300/월 |
| **총 Q1 marketing cash spend** | **약 $1,000~$4,500** |

→ 캐비닛 원안 ($2-3K/월 비-브랜드 ads × 3개월 = $6-9K + 원조 PR + Listicle 캠페인) 대비 **70% 절감**, 동시에 폭격형 spend 위험 회피.

## 성공 지표 (90일)

| 지표 | 베이스 | 90일 목표 |
|------|--------|-----------|
| Trustpilot 리뷰 수 | 0 | 50+ |
| GSC indexed pages | 미측정 | 50+ (foundation) → 80+ (content cluster) |
| Top 50 commercial-intent 키워드 avg position | 미측정 | top 30 진입 30%+ |
| Referring domains (Ahrefs) | 미측정 | +20 (디렉토리/디자이너 toolkit) |
| Organic-to-checkout CVR | 미측정 | 1%+ |
| AI Overview / Perplexity citation (20 seed query 수동 체크) | 0 | 5+ |
| 월 주문량 | 29 (5월~6월 부분) | **150-200건** (OMO-2299 Phase 2 목표 일치) |

---

## 자식 이슈 분해 (보드 승인 후)

Week 0 결정 → 본 문서 승인 후 다음 자식 이슈 일괄 생성:

1. **[OMO-2383 Child] 홈페이지 trust copy 재작성** (assignee: Content + Engineer-Goods) — BLOCKING gate
2. **[OMO-2383 Child] Sitemap DB-driven 마이그레이션 + Canonical + hreflang** (Engineer-Goods)
3. **[OMO-2383 Child] JSON-LD 번들 (Org/Product/Breadcrumb/FAQ/WebSite) — AggregateRating 제외** (Engineer-Goods)
4. **[OMO-2383 Child] `/llms.txt` + AI 크롤러 robots allow** (Engineer-Goods)
5. **[OMO-2383 Child] GA4 Search Console + Bing Webmaster + Ads ID + Enhanced Conv + Offline Import** (Analytics + Engineer-Goods)
6. **[OMO-2383 Child] `/shipping` + `/returns` + ETA 계산기 + Not-for-rush 배지** (Content + Engineer-Goods)
7. **[OMO-2383 Child] 리뷰 요청 자동 이메일 (배송완료 NPS 분기)** (Engineer-Goods)
8. **[OMO-2383 Child] 산업별 Business Cards LP 20개 drip-publish** (Content)
9. **[OMO-2383 Child] 비교 페이지 8개 (vs Vistaprint/MOO/GotPrint/UPrinting)** (Marketing)
10. **[OMO-2383 Child] 교육 블로그 cornerstone 5편** (Content)
11. **[OMO-2383 Child] Q&A LP 8개 + Print Glossary 40개** (Content)
12. **[OMO-2383 Child] Trustpilot/BBB 프로필 클레임 (50+ 리뷰 누적 후)** (Marketing)
13. **[OMO-2383 Child] POD + 디자이너 디렉토리 submission sweep** (Marketing)
14. **[OMO-2383 Child] Pricing isolation refactor + ISR migration** (Engineer-Goods)
15. **[OMO-2383 Child] 브랜드 방어 Google Ads ($300/월)** (Media)
16. **[OMO-2383 Child] 비-브랜드 Search 캠페인 Week 8+ (Quality Score 게이트)** (Media)
17. **[OMO-2383 Child] Design file client-side validator (디자이너 moat)** — 별도 design editor 트랙 (참조: OMO-2319)

OMO-2309 (Google Ads Phase 1)는 본 로드맵의 Week 8+ 비-브랜드 캠페인과 통합되거나 scope down (브랜드 방어만) 으로 재정의.

---

## 캐비닛 어트리뷰션

이 제안은 다음 6명의 평행 검토를 종합한 결과:
- **Technical SEO lens** — sitemap/JSON-LD/ISR/canonical/IndexNow 권고
- **Content + Programmatic SEO lens** — 산업/스펙/비교/도시/use-case 클러스터 설계
- **AEO / AI-Search lens** — JSON-LD/llms.txt/Q&A/Glossary/listicle/original data
- **Backlinks + Directory lens** — Trustpilot/BBB/G2/디자이너 디렉토리/HARO/co-marketing
- **Google Ads lens** — conversion tracking/Search 구조/negative/budget bands/PMax 회피
- **Challenger-Strategy** — 신뢰 게이트 / 시퀀싱 비판 / 컷 권고 / Q2-deferred 항목

원본 캐비닛 출력은 workflow `wf_9e0cb5fb-500` transcript 에 보존됨.
