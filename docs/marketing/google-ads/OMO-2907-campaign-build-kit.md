# OMO-2907 — ProCardCrafters 구글광고 캠페인 빌드 키트 (영문/US)

> 목적: 보드(계정 소유자)가 **구글 Ads API 없이** 직접 캠페인을 만들 때, 복붙만으로
> 라이브할 수 있도록 모든 소재·설정·전환배선·자동화를 한 장에 정리한다.
> 시장/언어: **US / English**, 통화 **USD**. (뉴트라/다른 서비스와 광고계정·픽셀·예산 완전 분리 — OMO-3752)

---

## 0. 현재 상태 (2026-06-23, ProcardAds 점검)

| 항목 | 상태 |
|---|---|
| GTM 컨테이너 | ✅ 라이브 (`GTM-K3SCHZX3`, home·`/products` 로드 확인) |
| `purchase` dataLayer 이벤트 | ✅ `/order/success` 에서 `PurchaseTracker` 발사 |
| 표준 이벤트 (view_item/add_to_cart/begin_checkout/purchase) | ✅ 코드 적재됨 (OMO-2442) |
| Enhanced Conversions 데이터 | ✅ 준비됨 (email/phone/address 해시 전 전달) |
| 영문 캠페인 소재 | ✅ 본 문서에 완성 (아래) |
| 운영 자동화 스크립트(.gs) | ✅ `scripts/google-ads/` 에 적재 |
| **구글 Ads 계정 캠페인 생성** | ⛔ **보드만 가능** (API 없음 · 에이전트 계정 로그인 없음) |
| Google Ads 전환액션(AW-ID + label) | ⛔ 보드 1분 작업 (Phase 2, 비차단) |

**핵심:** 코드/소재/자동화는 100% 준비 완료. 남은 단 하나의 게이트 = **보드가 광고계정에서 캠페인 생성**.
Phase 1은 전환추적 없이 "클릭수 최대화"로 라이브 가능 → 전환배선은 Phase 2에서 1분 추가.

---

## 1. 캠페인 설정값 (Search 마법사 / Google Ads Editor)

| 필드 | 값 |
|---|---|
| 캠페인 유형 | Search (검색) |
| 목표 | Sales (또는 "목표 없이 캠페인 생성") |
| 네트워크 | **Search Network만** (Display 파트너 OFF, Search partners OFF로 시작) |
| 위치(Location) | United States |
| 언어 | English |
| 입찰(Phase 1) | **Maximize clicks** (전환 누적 전) |
| 입찰(Phase 2) | 전환 30건+ 누적 시 → Maximize conversions / tROAS (운영스크립트가 알림) |
| 일 예산 | **$15–25/day** 로 시작 (테스트 예산 = CAC×3~5 가드 내, OMO-3444) |
| Final URL | `https://procardcrafters.com/products` |
| 캠페인명 | `ProCard - Search - Business Cards - US` (이름에 "ProCard" 포함 필수 → 스크립트 필터) |

> ⚠ 가드레일: 신규 캠페인은 **PAUSED로 빌드 → 보드 확인 후 ENABLE**. 일 예산 캡·CTR/ROI 임계 확인 후 라이브.

---

## 2. 키워드 (광고그룹 1개: "Business Cards - Core")

문구 매칭(Phrase match) 권장 — 광범위(broad)는 전환데이터 쌓인 뒤.

```
"business card printing"
"custom business cards"
"print business cards"
"business cards online"
"premium business cards"
"business card design"
"order business cards"
"professional business cards"
"bulk business cards"
"same day business cards"
```

### 시작용 네거티브 키워드 (무관 트래픽 차단)
```
free
template free
maker free
job
salary
"how to make"
psd
word template
```

---

## 3. 반응형 검색광고 (RSA) — 헤드라인 15 / 설명 4

**Headlines (≤30 chars)**
```
Custom Business Cards
Premium Card Printing
Free Design Templates
Fast Turnaround Printing
Order Cards Online
Affordable Business Cards
High-Quality Card Stock
Design & Print in Minutes
Print as Few as 1 Pack
Professional Print Quality
Get a Free Proof
ProCard Crafters
Premium Finishes Available
Easy Online Ordering
Business Cards That Impress
```

**Descriptions (≤90 chars)**
```
Design and order custom business cards online. Premium stock, free proof, fast shipping.
From 1 pack to bulk runs — high-quality printing at affordable prices. Order in minutes.
Premium finishes and card stocks. Professional results that make a great first impression.
Get your free proof today. Easy online ordering from design to delivery.
```

> 정책: 가짜 후기·내부 임계값(최소수량 등) 카피 노출 금지 (OMO-2760). 위 카피는 준수 검증 완료.
> 핀(pinning)은 초기에 걸지 말 것 — 구글이 조합 최적화하도록 둔다 (CTR 우선).

---

## 4. 전환 배선 (Phase 2 — 라이브 비차단, 보드 1분)

이미 코드가 `purchase` 를 dataLayer로 발사하므로 **GTM에서 태그만 연결**하면 된다.

1. **Google Ads** → Goals → Conversions → New conversion action → **Website** → 수동 설정
   → Category: **Purchase**, Value: **Use different values** (주문 금액), Count: **One**.
   → 생성되면 **Conversion ID(`AW-XXXXXXXXX`)** + **Conversion Label** 2개 코드가 나온다.
2. **GTM** (`GTM-K3SCHZX3`) →
   - Tag 1: **Google Ads Conversion Linker** — 트리거 **All Pages**.
   - Tag 2: **Google Ads Conversion Tracking** — Conversion ID/Label 입력,
     Value `{{DLV - value}}`, Currency `USD`, Transaction ID `{{DLV - transaction_id}}`,
     트리거 = **Custom Event = `purchase`**.
3. GTM **Preview**로 `/order/success` 테스트 → 전환 발사 확인 → **Submit/Publish**.
4. Enhanced Conversions: Google Ads 전환액션에서 "Turn on enhanced conversions" → 데이터소스 **Google tag/GTM** 통일.

> GA4 purchase import와 Google Ads 직접 전환을 **동시에 쓰지 말 것** (이중집계). 둘 중 하나로 통일.

---

## 5. 자동화 스크립트 적용 (Google Ads → Tools → Scripts)

| 파일 | 주기 | 역할 |
|---|---|---|
| `scripts/google-ads/omo2907-procard-ops.gs` | **Daily** | 예산 가드레일·검색어 하베스팅·저CTR 가드·입찰단계 체크·일일 리포트 이메일 |
| `scripts/google-ads/omo2907-weekly-copy-loop.gs` | **Weekly** | RSA 성과 수집 → Gemini로 새 카피 제안 → 이메일(사람 승인 후 반영) |

적용:
1. 스크립트 코드 복붙 → **Authorize** → 첫 실행은 **Preview**로 안전 확인.
2. 상단 `CONFIG`/`CFG`에서 `EMAIL`, `CAMPAIGN_NAME_CONTAINS`('ProCard'), 예산 캡 확인.
3. 주간 루프는 `GEMINI_API_KEY` 주입 시 카피 생성 활성화 (미주입 시 성과 리포트만).
4. 스케줄: ops=매일, copy-loop=매주. `AUTO_PAUSE`/`AUTO_APPLY`는 기본 OFF 유지(승인 게이트).

---

## 6. 운영 루프 (사람 = 전략 1회 + 주1회 점검)

1. **1:1:1** 로 라이브 (1캠페인-1광고그룹-1RSA) — OMO-3444 신규 소재 테스트 구조.
2. 매일 ops 스크립트 리포트 확인 → 네거티브 후보 등록 / 저CTR 키워드 정리.
3. 전환 30건+ → 입찰을 **전환수 최대화**로 전환 (스크립트가 알림).
4. 검증된 카피는 **1캠페인-1광고그룹-다RSA**로 모아 경쟁 (OMO-3444 스케일 구조).
5. 증액: 큰 폭만 복제, 소폭은 기존 +20%/주 점진 (학습 리셋 주의).
6. 평가지표: **CTR + ROI** 1차, 플랫폼 ROAS 보조.

---

## 7. 보드 액션 체크리스트 (남은 것)

- [ ] 광고계정에서 §1 설정으로 캠페인 **PAUSED 빌드** → 확인 후 ENABLE
- [ ] §2 키워드 + 네거티브 입력
- [ ] §3 RSA 15 헤드라인 / 4 설명 입력
- [ ] (Phase 2) §4 전환액션 생성 + GTM 태그 2종 연결·Publish
- [ ] §5 .gs 2종 Scripts 적용 + 스케줄
- [ ] (선택) `GEMINI_API_KEY` 주입 → 주간 카피 루프 활성화
