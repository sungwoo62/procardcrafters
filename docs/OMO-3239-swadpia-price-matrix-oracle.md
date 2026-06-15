# OMO-3239 — 성원 브라우저-구동 결정론 가격 매트릭스 오라클

부모: OMO-3238 (HAR 결정론 검토). 본 이슈는 보드 제안(브라우저 조작 + 표본 + 역산)을
라이브로 검증하고, **멀티사이즈/디지털/토너까지** 무에러 결정론 가격을 커버하는 오라클을 구축한다.

---

## 1. 스파이크 결과 — 3 게이트 전부 PASS (라이브 검증, 2026-06-16)

재현 스크립트: `scripts/omo3239-spike.mjs`, `scripts/omo3239-gate1c.mjs`
아티팩트: `scripts/test-artifacts/omo3239/{spike,gate1}.json`

### 게이트 1 — hidden `total_price` == 실제 장바구니 등록가 (동치) ✅
- `total_price` 는 `order_form` **내부의 named·비-disabled hidden input** 이다
  (`totalPriceInsideForm=true`, `type=hidden`, `disabled=false`).
- `new FormData(order_form)` 직렬화 결과에 `total_price` 가 **포함**되며 값이 hidden 값과
  동일하다 (`serializedHasTotal=true`, `serializedTotalValue=110400 == hiddenTotal`).
- 장바구니 등록 경로 = `order_form` 의 self-POST(`action=/goods/goods_view/CPR2000`,
  `goods_mode=cart` / `goods_action=regist`). 이는 우리 **프로덕션 발주 코드
  `src/lib/swadpia-order.ts`** 가 이미 실주문에 쓰는 바로 그 폼 제출이다(실주문
  OSA…697962 등 성공 이력).
- **결론:** 장바구니에 등록되는 금액 = hidden `total_price`. 단일 샘플 인터셉트가 아니라
  **직렬화 구조로 보장**(더 강한 증거). OCR/LLM 미사용 = 결정론.

### 게이트 2 — 제품군별 수량 필드 ✅
- 포스터 CPR2000: `order_count` 와 `paper_qty` **둘 다** `total_price` 를 움직인다
  (각각 distinct=4). 즉 수량 분기 경로가 라이브로 동작.
- ⚠️ OMO-3238 의 "order_count 무반응" 관측은 recompute AJAX 정착(networkidle) 전 스냅이
  원인이었음 — 정정. 본구현 크롤러는 select 변경 후 **networkidle + settle** 를 강제한다.
- 주의: 두 필드가 모두 영향 → 제품군별로 **표준 수량 필드를 1개 확정**해야 한다
  (포스터는 `order_count`=부수가 고객 노출 수량, `paper_qty`=용지 매수는 종속). 본구현
  크롤러가 제품별로 "어느 필드가 고객 수량인지" 를 enumerate 단계에서 라벨로 확정.

### 게이트 3 — 디지털(CDP)·토너(COD) hidden 경로 ✅ (OMO-3238 "불가" 2건 철회)
- 디지털 CDP3000: `total_price` hidden **존재**, size 필드(`size_type`)로 분기(distinct=2).
- 토너 COD1100: `total_price` hidden **존재**, size 필드(`paper_size`)로 분기(distinct=2).
- **이것이 핵심 반전:** OMO-3238 은 json_data XHR 에 토너 매트릭스가 없어 "토너 불가"로
  종결했으나, **페이지 hidden `total_price` 는 토너·디지털·멀티사이즈 모두에서 size 분기**한다.
  json_data XHR 가 아니라 페이지가 클라이언트/별도 AJAX 로 계산해 hidden 에 박는다.
  → 브라우저-구동 오라클은 json_data 의 사각지대를 전부 커버한다.

---

## 2. 아키텍처 — 오프라인 표본 → DB 매트릭스 룩업 (라이브-퍼-리퀘스트 금지)

```
[크롤러(오프라인/cron)] → print_swadpia_price_matrix (DB) → [고객 가격경로 룩업]
   Playwright 로그인                    ↑                         (라이브 호출 0)
   제품별 select 열거          표본 + 역산(보간)
   조합 표본 hidden 독취
```

### 조합폭발 억제 — 표본 + 역산(보간)
- 가격 차원: `size × paper × side × qty`. 이 중 **qty 는 표본 몇 점 → 보간**으로 압축.
  성원 단가는 수량 구간 계단/준선형 → size·paper·side 조합당 qty 4~6점만 표집하고
  중간 qty 는 **piecewise-linear 보간**으로 산출(`source='interpolated'`).
- size·paper·side 는 카디널리티가 낮아 **전수 표집**(`source='sampled'`).
- 검증: 보간값 vs 실표집값 오차 임계 초과 시 해당 곡선 전수표집으로 승격(parity 게이트).

### 회귀 안전 (이슈 "회귀 금지")
- 단일포맷(명함/스티커/봉투/캘린더)은 기존 `json_data` 결정론 경로 **그대로 유지**.
  오라클은 **멀티사이즈/디지털/토너에만 추가 라우팅**(additive).
- 라우팅 전환(item 6)은 parity 게이트 통과 후에만, 보드 승인 하에 컷오버.

---

## 3. DB 스키마 (공유 Supabase, prefix `print_swadpia_`)

마이그레이션 초안: `supabase/migrations/20260616000010_omo3239_price_matrix.PROPOSED.sql`

- `print_swadpia_price_matrix` — 해소된 가격 오라클(룩업 대상).
  unique(`category_code`,`size_code`,`paper_code`,`side`,`qty`). `source` =
  `sampled|interpolated`. `total_price_krw`/`paper_price`/`plate_price`/`print_price`.
- `print_swadpia_price_crawl_runs` — 크롤 실행 로그(드리프트·parity 추적).

---

## 4. 본구현 로드맵 (자식 이슈)

| 항목 | 자식 | 의존 | 라이브 리스크 |
|---|---|---|---|
| 4·5 크롤러+매트릭스 적재(+보간) | OMO-3239 child A | — | 없음(additive) |
| 6 고객 가격경로 매트릭스 라우팅 | OMO-3239 child B | A | **있음**(parity+보드 게이트) |
| 7 드리프트 재크롤 cron + parity | OMO-3239 child C | A | 낮음 |

기존 자산 재사용: `/api/swadpia-price`, `/api/cron/swadpia-drift`,
`/admin/qa/swadpia-parity`, `src/lib/swadpia-order.ts`(로그인/폼 조작 패턴).
