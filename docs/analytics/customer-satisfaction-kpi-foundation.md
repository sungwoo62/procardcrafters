# 고객만족 KPI 계측 토대 (OMO-2593 · 북극성 축2→3)

부모: OMO-2586(성과측정·평가). 북극성: **조직의 성장 + 고객 만족도 향상**.

대시보드 북극성 고객만족 조인에서 **CVR·CS응답시간·배송/리뷰**가 전부 `데이터 부족`으로
표시되던 원인을 실측으로 규명하고, 정량화 가능한 조인 경로를 구축한다.
추측 금지 — 미가용 지표는 `데이터 부족` + 정확한 unblock 액션으로 정직 표기(OMO-2587 패턴).

---

## 0. 실측 현황 (2026-06-07 기준, service_role 직접 집계)

| 데이터 | 값 | 해석 |
|---|---|---|
| `print_orders` 전체 | 29건 | pending 2 · paid 15 · processing 12 · **delivered 0 · shipped 0** |
| 주문 일자 범위 | 2026-05-13 ~ 2026-06-04 | 테스트/런칭전 주문(PayPal sandbox, OMO-2582 NO-GO 상태) |
| `delivered_at` 채워진 주문 | 0건 | 배송완료 주문이 0 → 트리거가 찍을 대상 없음 |
| `print_review_request_log` | 0건 | D+7/D+14 리뷰요청 — 배송완료 0이라 발송 대상 없음 |
| `print_reviews` | 0건 | 리뷰 0 |
| `print_shipments` | 0건 | 배송건 0 |

**결론: '데이터 부족'은 계측 누락이 아니라 (대부분) 런칭전 데이터 공백이다.** 인프라는
대체로 깔려 있고, 실주문(특히 배송완료)이 흐르기 시작하면 채워진다. 단, **CVR 분자(세션)**
만은 인프라 자체가 빠져 있다(아래 §1).

---

## 1. CVR(전환율) — Marketing 담당 ✅ 토대 구축

```
CVR(%) = 전환주문수(print_orders) ÷ 세션수(GA4) × 100
```

| 구성요소 | 소스 | 상태 |
|---|---|---|
| 분모 — 전환주문수 | Supabase `print_orders` (status ∈ paid·processing·shipped·delivered·completed, pending 제외) | ✅ **가용** — service_role 직접 집계, 일자별 조인 가능 |
| 분자 — 세션수 | GA4 Data API `runReport` (sessions by date) | ⚠️ **데이터 부족** — Data API 미연동 |

- 구현: [`scripts/analytics/cvr-join.mjs`](../../scripts/analytics/cvr-join.mjs)
  - `node scripts/analytics/cvr-join.mjs --days 30` → 일자별 표 + JSON 스냅샷
    (`scripts/test-artifacts/cvr-snapshot-<endDate>.json`).
  - `export async function computeCvr({days})` 로 Analytics가 직접 import/호출 가능.
- 현재 출력: 전환주문 27건 / 세션 **null** → `overall_cvr_pct=null`, `status=INSUFFICIENT_DATA`.

### CVR 분자(세션) unblock 액션 — 보드/오너
클라이언트측은 `NEXT_PUBLIC_GA_MEASUREMENT_ID`(G-…)로 세션을 **수집 중**이나, 서버에서
세션을 끌어와 주문과 조인하려면 GA4 **Data API** 자격증명이 필요하다(측정ID와 별개):

1. `GA4_PROPERTY_ID` — GA4 관리 > 속성 설정 > 속성 ID(숫자).
2. `GOOGLE_APPLICATION_CREDENTIALS` — GCP 서비스계정 JSON 경로. **해당 서비스계정 이메일을
   GA4 속성에 '뷰어'로 추가**(계정 권한 부여라 코드로 불가 → 보드/오너 액션).
3. 두 값을 `.env.local`(로컬) + Vercel Production env에 주입.

→ 주입되면 `cvr-join.mjs`가 즉시 세션을 채워 CVR을 산출한다(코드 변경 불필요).
이는 결제 Live creds(OMO-2574)와 같은 **외부 자격증명 의존**이며, 코드 결함이 아니다(원장 t010).

### (후속) 채널별 CVR
`print_orders`에 UTM/gclid 귀속 컬럼이 머지되면(OMO-2587 PR#8 / OMO-2594 캡처) 채널별 CVR도
산출 가능. 현재 브랜치엔 미존재 → total CVR만. `attribution.ts deriveChannel`과 정합.

---

## 2. CS 응답시간 — WebOps-Print 협업 → child 분리

문의→첫응답 타임스탬프를 적재할 테이블/로그가 **현재 없음**(`print_cs_*` 부재).
정량화하려면 신설 또는 기존 CS 채널 로그 적재 필요. → **child 이슈로 분리**(WebOps-Print).

권장 스키마(초안):
```
print_cs_threads(id, order_id?, channel, customer_email, opened_at, first_response_at, resolved_at, status)
  → CS 응답시간 = first_response_at − opened_at
```

---

## 3. 배송리드/리뷰요청율 — WebOps-Print 협업 → child 분리(가동 점검)

인프라는 **이미 가동 상태**다(데이터만 없음):

| 항목 | 상태 |
|---|---|
| `print_orders.delivered_at` + 자동 트리거 | ✅ 존재(OMO-2410) — status→delivered 시 NOW() 기록 |
| `print_review_request_log` (D+7/D+14) | ✅ 존재 |
| `/api/cron/review-requests` cron | ✅ vercel.json 등록됨 |
| 배송리드타임 = `delivered_at − created_at` | 측정식 정의 완료, **delivered 주문 0이라 산출값 없음** |
| 리뷰요청율 = 요청발송 ÷ 배송완료 | 동일 — 분모(배송완료) 0 |

→ 신규 구축이 아니라 **첫 실배송 발생 시 트리거/cron이 실제로 발화하는지 가동 점검**이 핵심.
→ **child 이슈로 분리**(WebOps-Print): delivered 전이 1건으로 E2E 점검(trigger→delivered_at,
cron→review_request_log).

---

## 4. Analytics 조인 컨트랙트 (대시보드 갱신용)

북극성 고객만족 대시보드는 아래를 조인한다:

| KPI | 소스 | 현재 값 | 데이터 들어오는 조건 |
|---|---|---|---|
| CVR | `cvr-join.mjs` / `computeCvr()` | `null` (INSUFFICIENT_DATA) | GA4 Data API 자격증명 주입(§1) |
| CS 응답시간 | `print_cs_*` (신설 예정) | 미계측 | child(§2) 완료 |
| 배송리드타임 | `delivered_at − created_at` | 산출값 0 | 첫 배송완료 주문(§3) |
| 리뷰요청율/리뷰수 | `print_review_request_log` / `print_reviews` | 0 | 첫 배송완료 후 cron 발화(§3) |

각 KPI는 `null`/0 일 때 대시보드에 `데이터 부족 — <unblock 액션>`으로 정직 표기할 것.
