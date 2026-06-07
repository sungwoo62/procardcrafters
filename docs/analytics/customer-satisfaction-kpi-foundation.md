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

## 2. CS 응답시간 — WebOps-Print → ✅ 계측 신설(OMO-2600)

**상태: `NOT_INSTRUMENTED` → `instrumented`.** `print_cs_threads` 테이블 신설·적용 완료.

| 구성요소 | 소스 | 상태 |
|---|---|---|
| 테이블 | `print_cs_threads` (마이그레이션 `20260607000030_print_cs_threads.sql`, DB 적용됨) | ✅ 가용 |
| 측정식 | `first_response_at − opened_at` | ✅ 정의 |
| 뷰 | `print_cs_response_metrics`(행별), `print_cs_response_kpi`(집계) | ✅ |
| 챗(CSAgent) 인입 | `/api/chat` → `recordCsThread()` (`src/lib/cs-threads.ts`), `is_automated=true` | ✅ 와이어링 |
| 문의폼 인입(사람) | `contact` 폼 → `POST /api/contact` → `recordCsThread({channel:'contact_form', is_automated=false, opened_at})` (OMO-2612) | ✅ 와이어링 |
| 인바운드 이메일 인입 | `mailto:` 정적 링크 제거·폼 대체. 이메일 직접 수신 캡처는 미연동 | ⚠️ 인바운드 이메일 웹훅 필요(보드/오너, 옵션 B) |
| 첫 회신 스탬프(`first_response_at`) | 어드민/CSAgent 회신 시 기록 — **2단계 미구현** | ⏳ 후속(분자) |

```
print_cs_threads(id, order_id?, channel, customer_email, external_ref,
                 is_automated, assignee, opened_at, first_response_at, resolved_at, status, ...)
  → CS 응답시간 = first_response_at − opened_at
```

**설계: 사람 SLA vs 자동 디플렉션 분리.** AI 견적챗(CSAgent)은 즉시(≈0초) 응답하는
셀프서비스라 `is_automated=true`로 분리 기록. 대시보드 **CS 응답시간 SLA는 사람 채널
(`is_automated=false`)만** 집계(자동 챗은 참고치). → 챗만으로는 사람 SLA가 `INSUFFICIENT_DATA`.

### 사람 채널 응답시간 — 분모 확보 완료(OMO-2612), 분자 후속
정적 `mailto:` 링크를 **문의폼(`POST /api/contact`)**으로 전환해 인입 시각(`opened_at`)을 코드가
캡처한다 → 사람 채널 **분모 확보**. 남은 작업:
1. **첫 회신 스탬프(분자)**: 어드민/CSAgent가 문의에 회신할 때 `recordCsThread()`(또는 직접 UPDATE)로
   `first_response_at` 기록. 이게 들어와야 `human_avg_first_response_seconds`가 실제 산출된다.
   - 문의폼은 `external_ref`가 없어 thread별 멱등 키가 없다 → 회신 스탬프용 어드민 CS 인박스/식별 키 설계 필요(후속 이슈).
2. **인바운드 이메일 웹훅**(옵션 B, 보드/오너): Resend Inbound / Postmark 등 외부 수신 서비스 provision →
   `/api/cs/inbound` → `recordCsThread({channel:'email', opened_at})`. 외부 자격증명 = 보드/오너 액션.
3. 카카오/네이버 톡톡 운영 시 WebOps-Print가 응대 타임스탬프를 `recordCsThread()`로 기록.
→ 분자(첫 회신)까지 들어오면 `print_cs_response_kpi.human_avg_first_response_seconds`가 즉시 산출.

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

### 가동 점검 결과 (2026-06-07, OMO-2601) — ✅ PASS

합성 테스트 주문 1건으로 E2E 점검(점검 후 삭제 → KPI 테이블 baseline 0 복귀, 오염 없음).
실행: [`scripts/launch-qa-review-tracking.mjs`](../../scripts/launch-qa-review-tracking.mjs)
(`setup`→실제 cron HTTP 호출→`verify`→`cleanup`). 아티팩트: `scripts/test-artifacts/launch-qa/review-tracking-e2e.json`.

| 점검 | 방법 | 결과 |
|---|---|---|
| 트리거 `print_set_delivered_at` | status→delivered 전이 후 `delivered_at` 조회 | ✅ 전이시각(NOW) ±5s 이내 자동 기록 |
| cron `/api/cron/review-requests` | 로컬 dev 서버에 실제 HTTP 호출(Bearer CRON_SECRET) | ✅ D+7 후보 1건 → `print_review_request_log`(d7) 1건 적재 |
| 측정식 ① 배송리드타임 | `delivered_at − created_at` | ✅ 산출 확인 (테스트 10.00일) |
| 측정식 ② 리뷰요청율 | 요청발송 ÷ 배송완료 | ✅ 산출 확인 (1/1 = 100%) |

**측정식 확정(이 문서가 컨트랙트):**
- 배송리드타임 = `print_orders.delivered_at − print_orders.created_at`
- 리뷰요청율 = `print_review_request_log` 발송수 ÷ `print_orders`(status=delivered) 수

**점검 중 발견한 결함 → [OMO-2614](/OMO/issues/OMO-2614)(Dev-Print):** cron 발송 루프의 `catch {}`가
예외를 무음 swallow → 런칭 위해 `RESEND_API_KEY` 설정 시 `UNSUBSCRIBE_SECRET` 누락이면 리뷰요청이
조용히 실패하면서 cron은 `ok:true` 보고 → KPI '조용한 공백'. 발송실패 가시화 패치 작성·검증 완료,
Dev-Print 머지/배포 대기. (현재 prod는 RESEND 미설정 → no-op로 로그는 정상 적재되어 파이프라인 가동.)
**런칭 전 env 게이트**: 실제 리뷰요청 이메일 발송엔 `RESEND_API_KEY`+`UNSUBSCRIBE_SECRET` 둘 다 필요.

---

## 4. Analytics 조인 컨트랙트 (대시보드 갱신용) — ✅ 구현됨

**구현:** [`scripts/analytics/customer-satisfaction-dashboard.mjs`](../../scripts/analytics/customer-satisfaction-dashboard.mjs)
- `node scripts/analytics/customer-satisfaction-dashboard.mjs [--days 30] [--json]`
  → 4개 KPI 조인 리포트 + `scripts/test-artifacts/customer-satisfaction-snapshot.json`.
- `export async function buildSnapshot({days})` 로 대시보드/리포트가 직접 import.
- CVR은 Marketing의 `computeCvr()`를 재사용(중복 구현 없음). 미가용 KPI는 `null` +
  `status`(INSUFFICIENT_DATA / NOT_INSTRUMENTED) + **unblock 액션(담당 child)** 으로 정직 표기.

**상태 구분:** `instrumented` 플래그로 *'인프라 가동, 데이터 공백'* 과 *'인프라 자체 부재'* 를 분리.
| status | 의미 | 해당 KPI(2026-06-07) |
|---|---|---|
| `INSUFFICIENT_DATA` | 계측됨, 값만 공백 | CVR(GA4 미연동) · 배송리드(배송완료 0) · 리뷰요청율(배송완료 0) · CS응답시간 사람채널(인바운드 0) |
| `NOT_INSTRUMENTED` | 인프라 자체 부재 | (해소됨) — OMO-2600으로 `print_cs_threads` 신설 |

**실측 스냅샷(2026-06-07):** CS 응답시간 계측 신설 완료(OMO-2600) → 4개 KPI 모두 `instrumented`.
값은 ⚠️ 데이터부족(런칭전 공백 + 사람채널 인바운드 미연동). 모두 추측 없이 unblock 액션 표기.
데이터/자격증명/웹훅 주입 시 코드 변경 없이 자동 산출(재실행만).

> 코드 보강: `cvr-join.mjs`의 `main()`을 `import.meta.url` 가드로 감싸 `computeCvr` import가
> CLI를 부작용으로 실행하지 않도록 수정(대시보드가 안전하게 재사용 가능).

### 조인 대상 (소스·조건)

북극성 고객만족 대시보드는 아래를 조인한다:

| KPI | 소스 | 현재 값 | 데이터 들어오는 조건 |
|---|---|---|---|
| CVR | `cvr-join.mjs` / `computeCvr()` | `null` (INSUFFICIENT_DATA) | GA4 Data API 자격증명 주입(§1) |
| CS 응답시간 | `print_cs_threads` / `print_cs_response_kpi` ✅ | 사람채널 `null` (INSUFFICIENT_DATA) | 인바운드 이메일 웹훅/문의폼(§2) |
| 배송리드타임 | `delivered_at − created_at` | 산출값 0 | 첫 배송완료 주문(§3) |
| 리뷰요청율/리뷰수 | `print_review_request_log` / `print_reviews` | 0 | 첫 배송완료 후 cron 발화(§3) |

각 KPI는 `null`/0 일 때 대시보드에 `데이터 부족 — <unblock 액션>`으로 정직 표기할 것.
