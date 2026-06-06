# OMO-2411 — Pre-launch Beta Tester 캠페인 (Path α) 실행 플레이북

상위: [OMO-2387](/OMO/issues/OMO-2387) #9. 보드 승인: 2026-06-05 ("일단 다 진행해봐"). 예산 $1,400-2,500 일회성. 목표: 런칭 D-day까지 200-300개 진짜 disclosure-labeled 리뷰 (SKU당 20-30).

## 1. 목표 & KPI

| 지표 | 타겟 | 비고 |
|---|---|---|
| 모집 신청 | 400-500명 | 50% 선정률 가정 |
| 선정 (제품 발송) | 200명 | 응답률 30-40% 가정 → 60-80 리뷰 |
| SKU 커버리지 | SKU당 20-30 리뷰 | business-cards / flyers / postcards / eco-stickers 우선 |
| 캠페인 기간 | 3-4주 | 모집 1-2주 → 발송 2-3주 → 수확 3-4주 |
| 리뷰 평균 별점 | 4.2+ | 4.0 미만이면 product hold |

비-목표 (정지선): 가짜 리뷰 생성, 좋은 평점만 선별 게시, disclosure 라벨 누락. [[feedback_fake_reviews_blocked]] 참조.

## 2. 채널 & 인원 분배 (총 200명 선정)

| 채널 | 모집 N | 신청 → 선정 비율 | 예산 |
|---|---|---|---|
| 한인 디자이너 커뮤니티 (디스콰이엇·디비컷) | 80 | 1.5:1 | $300 (스폿 후원·이벤트) |
| 인스타 + Threads 공개 모집 (organic + boost) | 60 | 3:1 | $400 (Meta boost) |
| X (트위터) 디자이너 thread | 20 | 2:1 | $0 (organic) |
| 소상공인 협찬 (카페·스튜디오·1인 브랜드) | 30 | 1.2:1 | $0 (직접 outreach) |
| 친구·지인·팀 네트워크 | 10 | 1:1 | $0 |

**예산 합계 base = $1,400**
- 제품 COGS (200 × $4): $800
- 국내 배송 (200 × $3): $600
- Meta boost: $400
- 커뮤니티 후원: $300
- 컨틴전시: $0-400

**스트레치 $2,500** 시: 커뮤니티 이벤트 1회 ($500), 소상공인 협찬 5건 추가 ($200), Threads 인플루언서 1-2명 spot 협찬 ($400).

## 3. 운영 워크플로

1. `/beta-tester` 모집 페이지 오픈 — [OMO-2412]
2. 채널 캠페인 런칭 (D0 ~ D14) — [OMO-2415][OMO-2416]
3. 응답 → `print_beta_applications` 테이블 적재
4. 어드민이 `/admin/beta-applications` 큐에서 선정 → "comp 주문 생성" 클릭 — [OMO-2413]
   - 자동으로 `print_orders.is_complimentary = TRUE`, `total = 0`, `payment_status = 'comp'` 생성
   - 기존 factory queue로 발주 (`src/lib/factory-queue.ts`)
5. 발송 → tracking 번호 자동 메일 (기존 ship 메일 재사용)
6. **D+7 자동 메일** (beta tester 변형) — [OMO-2414]
   - 제목: "[procardcrafters] 제품 잘 받으셨나요? 베타 테스터 리뷰 부탁드려요"
   - CTA: `/reviews/new?order={token}&source=beta_tester` (서버에서 검증)
7. 고객 리뷰 제출 → 어드민이 `/admin/reviews` 에서 승인하며 `source='beta_tester'` + disclosure `"베타 테스터로 무료 제품을 받고 작성한 리뷰입니다"` 입력 ([OMO-2408 완료])
8. 메인 노출 후보 큐레이션 → [OMO-2387 #11]

## 4. 선정 기준 (어드민 사용)

- ✅ 명확한 사용 의도(예: "내 스튜디오 명함 100장")
- ✅ 인쇄물을 사진/스토리로 공유 의향
- ✅ D+7 ~ D+14 내 리뷰 작성 약속 체크 (모집 폼)
- ✅ 디자이너·1인 브랜드·소상공인 우대 (콘텐츠 가치 높음)
- ✅ 한국 국내 주소 (해외 배송 비용 차단)
- ❌ 이미 우리 제품 리뷰 작성한 이력 (중복 disclosure 위험)
- ❌ 익명·신원불명 신청 (FTC §255.5 evidence 트레일 부족)

## 5. 채널별 모집 카피 (안)

### 인스타·Threads (피드 + 스토리)
```
🎁 procardcrafters 베타 테스터 모집

서울에서 만드는 명함·스티커·엽서 — 런칭 전 100% 무료 샘플 보내드려요.
조건: 제품 받고 7일 안에 사진+짧은 리뷰 1개.
디자이너·소상공인·1인 사업자 우선.

신청 → procardcrafters.com/beta
모집 ~6/30 / 선정 200명 / 한국 국내 배송
※ FTC disclosure: 무료 제품 받고 작성한 리뷰임을 표기합니다.
```

### X (트위터)
```
런칭 전 procardcrafters 베타 테스터 200명 모집합니다.
명함 / 엽서 / 스티커 1종 무료 발송 → 7일 안에 리뷰만 부탁.
디자이너·자영업자 환영. 한국 배송 한정.
신청: procardcrafters.com/beta
```

### 디스콰이엇·디비컷 (커뮤니티 게시판)
```
[베타 테스터 모집] 인쇄 스타트업 procardcrafters

안녕하세요. 서울에서 인쇄 직영 + 직접 손마감하는 8인 팀입니다.
런칭 D-day 전 product feedback이 절실해 베타 테스터 200명을 모십니다.

제공: 명함 1팩 / 엽서 50장 / 스티커 50매 중 택1 (100% 무료)
조건: 받은 후 7일 내 사진 1장 + 리뷰 1개 (3분이면 충분)
대상: 디자인/브랜딩 분야 종사자, 1인 사업자, 소상공인

리뷰는 FTC §255.5에 따라 "무료 제품을 받고 작성한 리뷰" disclosure가 자동으로 붙습니다.
좋은 평점만 게시하는 cherry-picking은 하지 않습니다.

신청: procardcrafters.com/beta (5분)
모집 마감 6/30, 선정자 7월 초 안내
```

### 소상공인 협찬 (DM·이메일)
```
안녕하세요, [브랜드명]님.
procardcrafters라는 서울 기반 인쇄 스타트업에서 [브랜드명]님께 명함/스티커 무료 제작을 제안드리려 연락드립니다.

[브랜드명]의 [구체 칭찬: 매장/제품/콘텐츠 1줄] 보고 우리 베타 프로그램과 잘 맞을 것 같다고 판단했습니다.

조건: 받으신 후 7일 내 사진 1장 + 솔직한 리뷰 1개.
규모: 명함 100장 / 스티커 100매 중 택1, 디자인 파일은 보내주세요.
※ FTC disclosure 자동 표기. 평점 무관 모든 리뷰 게시.

관심 있으시면 procardcrafters.com/beta 폼 작성 부탁드리며, 메모에 "DM via [내 IG/X]" 적어주시면 우선 검토합니다.
```

## 6. 트래킹 스키마 (테이블 = [OMO-2412])

```sql
CREATE TABLE print_beta_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  shipping_address JSONB NOT NULL,
  channel TEXT NOT NULL,  -- 'instagram' | 'threads' | 'twitter' | 'disquiet' | 'dbcut' | 'business' | 'network' | 'other'
  channel_handle TEXT,    -- 인스타/X handle 등 검증용
  preferred_sku TEXT NOT NULL,  -- 'business-cards' | 'flyers' | 'postcards' | 'eco-stickers'
  use_case TEXT NOT NULL,       -- 자유 서술 (어디 쓸지)
  review_commitment BOOLEAN NOT NULL,  -- 7일 내 리뷰 작성 동의
  disclosure_acknowledged BOOLEAN NOT NULL,  -- disclosure 자동 표기 인지
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','fulfilled','reviewed','expired')),
  rejected_reason TEXT,
  approved_at TIMESTAMPTZ,
  fulfilled_order_id UUID REFERENCES print_orders(id),
  utm_source TEXT, utm_medium TEXT, utm_campaign TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX print_beta_applications_status ON print_beta_applications(status, created_at DESC);
CREATE UNIQUE INDEX print_beta_applications_email_uniq ON print_beta_applications(LOWER(email));
```

## 7. 타임라인 (D0 = 모집 시작일)

| 일자 | 활동 | 게이트 |
|---|---|---|
| D0 | `/beta-tester` 페이지 라이브, 채널 첫 포스트 | 인프라 ([OMO-2412][OMO-2413][OMO-2414]) 머지 |
| D1-D7 | organic 모집 + Meta boost 라이브 | 50 신청/주 페이스 확인 |
| D7-D14 | 추가 채널 (디스콰이엇·디비컷·소상공인 outreach) | 200 신청 도달 |
| D7-D21 | 어드민 선정 + 발송 (rolling) | 발송 페이스 25/일 |
| D14-D28 | D+7 리뷰 메일 자동 발송 | 응답률 모니터링 |
| D21-D28 | 미응답 reminder (1회) | 응답률 30% 미달 시 reminder |
| D28+ | 결과 정리 + 메인 노출 큐레이션 | OMO-2387 #11에 인계 |

## 8. 정지선

- ❌ "응답률 낮음" 핑계로 리뷰 자동 합성·AI 보강
- ❌ 좋은 별점만 메인에 노출 (전 별점 분포 표시)
- ❌ disclosure 누락 (어드민 승인 시 강제 NOT NULL CHECK 이미 적용)
- ❌ 평점 약속 대가 협찬 (조건은 "솔직한 리뷰", 평점 무관)
- ❌ 해외 배송 (예산 폭발 + 배송 사고 risk)
- ❌ 1인당 SKU 2개 이상 발송 (한 가구 → 한 SKU, comp 비용 controlable)

## 9. 자식 이슈 (이 캠페인을 가동하기 위한 인프라 + 채널 작업)

| ID | 제목 | 종속 | specialty |
|---|---|---|---|
| OMO-2412 | `/beta-tester` 모집 페이지 + `print_beta_applications` 테이블 + API | OMO-2411 | frontend+backend |
| OMO-2413 | 어드민 `/admin/beta-applications` 큐 + comp 주문 생성 (`print_orders.is_complimentary`) | OMO-2412 | backend+admin |
| OMO-2414 | D+7 리뷰 요청 메일 cron + Beta tester 변형 템플릿 (OMO-2387 #8) | OMO-2413 | backend |
| OMO-2415 | 채널별 모집 콘텐츠 (IG/X/Threads 카피·이미지·해시태그·일정) | OMO-2412 | marketing |
| OMO-2416 | 디스콰이엇·디비컷·소상공인 outreach 리스트 + DM 템플릿 실행 | OMO-2412 | marketing |

OMO-2411은 위 5개를 묶는 캠페인 코디네이터. 인프라가 머지되고 채널 자산이 준비되면 OMO-2411이 launch 게이트를 통과시키고 모집·선정·발송을 실행한다.

## 10. 메모리·블로커

- [[project_omo_2381_marketing]]: 자연 구매 흐름 흐름 일관성 — 베타 모집도 "discount·burner·trick" 카피 금지. 정직한 콜아웃 톤.
- [[feedback_fake_reviews_blocked]]: 가짜 리뷰 금지. 베타 캠페인 ROI는 disclosure-labeled 진짜 리뷰의 transparency value.
- 발송 SLA: 선정 D+0 → 인쇄 발주 D+1 → 발송 D+3 (factory queue). 미달 시 D+7 메일 자동 발송 트리거가 빨라져 부적절.
- 응답률 30% 미달 (D+21 기준) 시 옵션: (a) 인센티브 $2 쿠폰 추가 발송, (b) 모집 stretch (Path β로 보완), (c) reminder 횟수 1회 추가. 보드 알림 후 결정.
