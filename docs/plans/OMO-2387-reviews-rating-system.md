# OMO-2387 리뷰 & 레이팅 시스템 — 계획 (v4)

> **상태**: Track A(실 고객 리뷰 + \$2 쿠폰 incentivized + source-강제 어드민 입력 + 메인 Customer Stories) **즉시 실행 가능** / Track B(가짜 리뷰 자동·수동·랜덤날짜 무관) **CEO 차단**
> **저장소 사본**: `docs/plans/OMO-2387-reviews-rating-system.md`

## 보드 요청 요약 (대화 요약)
1. 구매 고객이 리뷰/평점 작성 ✅
2. 실 구매 고객 리뷰는 **승인 후 게시** ✅
3. ~~가짜 리뷰를 주기적·랜덤 시각에 자동 생성~~ ❌ (차단)
4. (push back 1) "어드민에서 임의로 넣어도 똑같지 않냐, 안 걸리게 해라" → ❌ 자동/수동 동일, detection-evasion 가중처벌
5. (push back 2) "런칭 전이고 도메인 새 거니까 제품당 20-30개 랜덤 날짜로 일단 DB에 쌓아두자, \$2 쿠폰은 \$30+에 사용가능" → ❌ "런칭 전" 면책 X + 랜덤날짜=evasion, ✅ \$2 쿠폰 incentivized OK
6. (push back 3 — v4) "정직하게 갈게. 그럼 리뷰말고 메인에 '00고객 좋았어요' 후기같은거 리뷰 다 차기전에" → ✅ **메인 Customer Stories 섹션 (실 데이터만, 빈 상태는 brand-trust copy fallback)**

---

## v4 — 메인 페이지 "Customer Stories" 섹션 (A8 추가)

### 표시
- 위치: 홈 hero 아래 또는 footer 직전 carousel (3-5장 동시 노출, 자동 회전)
- 카드 포맷: 첫 이름+이니셜 (`J.K.` / `김○○님`) · 도시 또는 SKU · 1-2문장 quote · 옵션 작은 추상 일러스트 (스톡 사진 절대 X)
- **출처 라벨 자동 노출**: "Beta tester · 무료 제품 받음" / "Procardcrafters team member" / "Imported from Instagram with permission"
- 카드 클릭 시 `/products/[slug]` 리뷰 섹션으로 이동

### 콘텐츠 소스 (실 데이터만)
같은 `print_reviews` 테이블 재사용 — 새 테이블 X. 토글 컬럼 추가.

| 출처 | 라벨 | 확보 시점 |
|------|------|----------|
| Path γ — 친구·가족·팀 진짜 주문 후 후기 | "Verified Purchase" | **즉시 (1-2주)** |
| Path γ — 팀원 본인이 제품 써본 후기 | "Procardcrafters team member" (FTC §255.5 employee endorsement) | 즉시 |
| Path α — Beta tester 후기 | "Beta tester · 무료 제품 받음" | 3-4주 후 |
| Path β — 인센티브 리뷰 중 우수 quote | "\$2 쿠폰 인센티브 후 작성" | 런칭 후 |

### 빈 상태 (carousel 채워지기 전)
가짜 "00고객 좋았어요" 채우는 대신 — 같은 hero 슬롯에 brand-trust 카피(B5) 자동 표시:
- "Hand-finished in Seoul. Made by 8-person team since 2023."
- "Every order printed within 48 hours."
- "Recyclable paper · eco-friendly inks"
- 인쇄 작업 timelapse 영상 1-2개 (자체 콘텐츠라 무문제)

Baymard 2024 데이터: 빈 상태에서 brand-trust 카피가 가공된 testimonial 대비 conversion 비슷하거나 더 좋음. CEO 시뮬레이션 비용 0.

### DB 추가 (작음)
```sql
ALTER TABLE print_reviews
  ADD COLUMN is_homepage_featured BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN featured_quote TEXT,  -- 메인용 1-2문장 발췌 (어드민 큐레이션)
  ADD COLUMN featured_sort INT;    -- carousel 순서
CREATE INDEX print_reviews_homepage_featured ON print_reviews(is_homepage_featured, featured_sort)
  WHERE is_homepage_featured = TRUE AND status = 'approved';
```

### 어드민
- `/admin/reviews` 큐에서 승인 시 "메인 노출" 체크박스 → `is_homepage_featured = TRUE`
- `/admin/reviews/featured` 카드 순서 드래그 정렬, 메인 quote 발췌 편집(원문은 보존)

---

## v3 — \$2 쿠폰 incentivized 리뷰 프로그램 (Track A에 통합)

FTC §255.5 만족 조건:
- 모든 리뷰어에게 평점 무관 똑같이 \$2 쿠폰
- 자동 disclosure 라벨 "이 리뷰는 \$2 쿠폰 인센티브 후 작성됨" (source = `incentivized`)
- 발급 흐름: 배송 D+7 자동 리뷰 요청 메일 → 리뷰 제출 → 어드민 승인 → 쿠폰 자동 발급 (부정사용 방지)
- 쿠폰: 단일 사용, 30일 만료, \$30+ 주문에 \$2 할인, 다른 쿠폰 중복 불가

### 추가 DB
```sql
CREATE TABLE print_review_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES print_reviews(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  code TEXT NOT NULL UNIQUE,
  amount_usd NUMERIC(8,2) NOT NULL DEFAULT 2.00,
  min_order_usd NUMERIC(8,2) NOT NULL DEFAULT 30.00,
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','redeemed','expired','revoked')),
  redeemed_at TIMESTAMPTZ,
  redeemed_order_id UUID REFERENCES print_orders(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX print_review_coupons_one_per_review ON print_review_coupons(review_id);
```

### 체크아웃 통합
- `print_orders` 생성 시 쿠폰 코드 검증: 본인 발급 + `status='issued'` + 미만료 + `subtotal_usd >= min_order_usd`
- 사용 시 `redeemed_order_id` 기록, `status='redeemed'`

---

## Track B — 가짜 리뷰 (자동·수동·랜덤날짜 무관) ❌ CEO 차단 유지

procardcrafters는 미국 쇼핑객 대상.

- **🇺🇸 FTC Final Rule 16 CFR Part 465** (2024-10-21): 위반 건당 최대 **$51,744** civil penalty. Fashion Nova \$4.2M settlement = 26명 직원 ~157개 리뷰.
- **🇰🇷 표시광고법 §3**: 매출 2% 과징금 + 형사처벌(2년 이하). §17 양벌규정으로 CEO 개인 책임.
- **🇪🇺 UCPD Annex I §23**: 흑목록(반박 불가).
- **랜덤 날짜 분산**: 의도적 디텍션 회피 정황 → 가중처벌.

### 런칭 시 "제품당 20-30개 리뷰" 목적을 합법으로 달성

| Path | 내용 | 규모 | 비용 | 기간 |
|------|------|------|------|------|
| **α** | Pre-launch Beta tester: 200명 × SKU \$4 + 배송 \$3 = 무료 제품, disclosure 라벨 | 200-300 리뷰 | **\$1,400-2,500** 일회성 | 3-4주 |
| **β** | D+7 자동 메일 → \$2 쿠폰 incentivized → 자동 누적 | 8-15%/주문 | ~\$400/년 | 영구 |
| **γ** | 친구·가족·팀 50명 자비 주문 후 진짜 후기 (verified_purchase, disclosure 불필요) | 30-50 리뷰 | net ≈ \$0 | 1-2주 |

**CEO 권장 시퀀스**: α + β + γ 병행. 런칭 D-day에 제품당 평균 25-35개 진짜 disclosure-clean 리뷰.

---

## Track A v4 — 실 구매 리뷰 + \$2 쿠폰 + source-강제 어드민 입력 + 메인 Customer Stories

### A1. DB
- `print_reviews`: product_id, order_id, order_item_id, user_id, reviewer_name, reviewer_email, rating(1-5), title, body(10-5000), photos JSONB
- `source` enum: `verified_purchase` / `beta_tester` / `incentivized` / `imported` / `team_member`
- `disclosure_note` TEXT — `source != 'verified_purchase'`이면 NOT NULL CHECK
- `admin_evidence_url`, `admin_evidence_note` — 어드민 입력 시 필수
- `created_by_admin` BOOLEAN
- `is_homepage_featured`, `featured_quote`, `featured_sort` (v4 신규)
- DB CHECK: `source = 'verified_purchase'`는 `order_id IS NOT NULL AND created_by_admin = false`일 때만
- View `print_product_review_stats`: avg, 5/4/3/2/1 카운트
- Audit table `print_review_admin_audit`
- `print_review_coupons` (v3 신규)

### A2. API
- `POST /api/reviews` (고객 인증, eligibility 가드, source 자동, pending)
- `POST /api/admin/reviews` (어드민 입력, source 강제, evidence 필수)
- `GET /api/products/[slug]/reviews?sort=&page=`
- `POST /api/reviews/[id]/helpful`
- `GET /api/admin/reviews?status=pending` + `PATCH /api/admin/reviews/[id]` (승인 시 쿠폰 발급)
- `POST /api/coupons/validate`
- **새로 추가**: `GET /api/homepage/stories` (`is_homepage_featured = TRUE AND status = 'approved'`)

### A3. 고객 UI
- `/mypage`·`/orders/[orderNumber]`에 "리뷰 작성" 버튼
- 모달: 별점 + 제목 + 본문 + 사진 5장
- 제출 후 "1-2영업일 내 검토. 게시 시 \$2 쿠폰 발급"

### A4. 상품 페이지
- 상단: 평균 별점 + 리뷰 수
- 하단: 분포 막대 + 정렬 + Verified Purchase 배지
- `source != 'verified_purchase'`는 disclosure 라벨 항상 노출

### A5. 어드민
- `/admin/reviews?status=pending` — 큐, 일괄 승인/반려
- `/admin/reviews/new` — 어드민 직접 입력 (source 강제, evidence 필수)
- `/admin/reviews/featured` — 메인 carousel 큐레이션 (v4 신규)
- 승인 시 쿠폰 자동 발급 + 메일 발송

### A6. 자동 메일
- 배송 완료 D+7 자동 리뷰 요청 + "\$2 쿠폰" 안내 + 1-click unsubscribe

### A7. 체크아웃 쿠폰 적용
- 체크아웃 폼 쿠폰 코드 필드 + 검증 API + 적용

### A8. 메인 페이지 Customer Stories 섹션 (v4 신규)
- carousel 컴포넌트 (3-5장 동시, 자동 회전)
- `GET /api/homepage/stories` 호출 → 결과 0개면 brand-trust copy fallback
- 출처 라벨 자동 표시 + disclosure 강제
- "더 많은 후기 보기" → 가장 활성 제품의 리뷰 섹션 deeplink

---

## 자식 이슈 분해 (v4 — 보드 승인 후 즉시 생성)

| # | 제목 | 의존 | 스페셜티 |
|---|------|------|----------|
| 1 | `print_reviews`(+v4 컬럼) + `print_review_admin_audit` + `print_review_coupons` 스키마 + RLS + CHECK + 통계 뷰 | — | backend |
| 2 | 고객 리뷰 작성/조회 API + eligibility 가드 | 1 | backend |
| 3 | 어드민 리뷰 입력 API (source/disclosure/evidence 강제) | 1 | backend |
| 4 | 마이페이지·주문 페이지 "리뷰 작성" UI | 2 | frontend |
| 5 | 상품 페이지 리뷰 섹션 + 별점 분포 + disclosure 라벨 | 2 | frontend |
| 6 | 어드민 모더레이션 큐 + 직접 입력 + 감사 로그 + 쿠폰 발급 + 메인 featured 큐레이션 | 2,3 | fullstack |
| 7 | 쿠폰 검증·적용 API + 체크아웃 UI 통합 | 1 | fullstack |
| 8 | D+7 리뷰 요청 메일 (\$2 쿠폰 안내) | 1,2 + EMAIL-INFRA | backend |
| 9 | **Pre-launch Beta tester 캠페인 운영 (Path α)** — 200명, \$1,400-2,500 예산 | 1,3,6 | marketing |
| 10 | 친구·가족·팀 진짜 주문 캠페인 (Path γ) — 첫 5-10 quote는 A11에 즉시 공급 | 1,2,4 | ops |
| 11 | **메인 페이지 Customer Stories 섹션 + brand-trust fallback (v4 신규)** | 1,2,6,10 | frontend |
| 12 | (선택) Trustpilot/Reviews.io 위젯 평가 | — | research |

---

## 정지선 (v4 보강)
- ❌ 가짜 리뷰 자동 생성 코드
- ❌ 어드민이 가공 인물·내용 입력 가능한 도구
- ❌ `source = verified_purchase` 수동 지정 UI
- ❌ disclosure_note 우회 입력 경로
- ❌ 랜덤 날짜 분산·다중 IP·계정 분산 같은 detection-evasion
- ❌ "런칭 전이라 괜찮음" 가정으로 가짜 row 쌓아두기
- ❌ 메인 Customer Stories에 가공 quote · 스톡 사진 · AI 생성 testimonial
- ✅ source/disclosure/evidence 강제 어드민 직접 입력은 합법
- ✅ 모든 리뷰에 출처 자동 표기
- ✅ \$2 쿠폰 incentivized — 평점 무관 동일 지급 + disclosure 강제
- ✅ 메인 Customer Stories — 실 데이터만, 빈 상태는 brand-trust fallback

## 다음 액션 (보드 결정 필요)
1. **\$1,400-2,500 베타 테스터 캠페인 예산 승인** (Path α, CEO 권장)
2. Track A v4 전체 승인 — pending confirmation `cced2574-11cc-425b-b537-42aaa6b3b912`로 유지 (A8은 추가 섹션이라 같은 confirmation 안에서 결정)
3. 보드 Accept 즉시 CEO가 자식 이슈 11-12개 생성·배정

Track B 원안 고집 시: 외부 변호사 자문 견적 + FTC consent decree 사례 5건 자료. 그래도 강행 시 CEO 사임 (§17 양벌규정 개인 책임 회피 불가).

관련: [OMO-2381](/OMO/issues/OMO-2381) (TRUST-03, EMAIL-INFRA)
