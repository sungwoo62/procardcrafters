# OMO-3623 — 성원 인쇄단가 headless 추출 + 10종 total_price 표집 (READ-ONLY)

> 상태: **표집·검증 완료 (READ-ONLY)**. 매트릭스 적재·구성기 연동·플래그 ON 은
> 후속 자식(블로커). 라이브 고객가 변경은 **보드 가격 승인 게이트**.
> 선행: [OMO-3610 cascade RE](./OMO-3610-print-cascade-RE.md).

## 1. 방법 — 성원 자기 코드를 그대로 실행 (TS 재구현 금지)

generic JSON endpoint 가 garbage(unit_key=1 → print_unit=64000)라 결정적 기준단가를
못 뽑는 10종에 대해, cascade 를 TS 로 재구현하지 않고 **성원 goods_view 페이지를
headless chromium 으로 로드해 성원 자기 cascade 코드(print_class/postpress_class/
product_class)를 그대로 실행**시킨 뒤 hidden 가격 필드를 직독한다.

- 하니스: `scripts/omo3623-print-price-harness.mjs` (playwright chromium).
- 흐름: `goods_view/{category_code}` 로드 → 엔진이 `json_data` AJAX + cascade 자체
  실행 → 기본조합 가격 산출 → 대표 옵션 select 세팅 후 성원 inline `onchange`
  (`chgPaperQty`/`chgOrderCount`/`chgPaperType` 등) 호출 → 재계산값 표집.
- READ-ONLY: 견적 데이터 공개라 실주문/결제/로그인 불필요. 화면 OCR/LLM 추론 없음
  (보드 절대규칙: hidden 필드 직독).
- 증분 저장 + 페이지당 1로드(독립) 로 라이브 세션 kill 내성 확보.

## 2. 핵심 발견 — 가격필드 의미가 카테고리군별로 다름

| 필드 | 의미 |
|------|------|
| `total_price` (hidden) | CPR/CLF: 라인 합계. **CCD(디지털/토너)**: **부수당 단가** |
| `supply_amt` (hidden) | 공급가 = 라인 합계(= 화면 표시 공급가) |

- **CPR/CLF (전단·포스터·브로셔·책자)**: `total_price === supply_amt` (`line-total`).
- **CCD (캘린더, 디지털/토너)**: `supply_amt = total_price × order_count` (`unit×count`).
  → 부수>1 일 때 `total_price`(단가) ≠ `supply_amt`(합계). 멀티사이즈/디지털/토너가
  json_data size 를 무시한다는 기존 관찰과 정합.

⇒ **적재 대상 = `supply_amt`(공급가)**. `total_price` 는 부수단가로 별도 보존.
구성기는 단가×수량으로 스케일하므로 후속 자식이 두 값을 함께 적재해야 한다.

## 3. parity 게이트 (크롤 ≠ 화면 차단)

각 표집은 다음 3조건을 모두 만족해야 적재 후보(`gate=pass`):
1. `supply_amt > 0`,
2. `supply_amt` == 화면 표시 공급가(`.price` 텍스트) — 크롤≠화면이면 차단,
3. `unit×count` 일관성: `total_price == supply_amt` 또는 `supply_amt == total_price × order_count`.

게이트 실패 표집은 산출물에 `gate=block` + 사유로 남고 적재 후보에서 제외된다
(초기 구현에서 캘린더 부수변형이 미정착 transient 로 차단된 것을 발견 → 가격모델
보정 후 정착, 현재 0 block).

## 4. 표집 결과 (2026-06-20, 13 samples / 10 slugs / 6 pages, 13 pass · 0 block)

산출물(서버 전용, 클라 비노출): `scripts/data/omo3623-print-price-samples.json`

| category_code | slugs | 대표 표집 (공급가 KRW) | price_model |
|---------------|-------|----------------------|-------------|
| CPR3000 | leaflets | 1000매 119,800 · 2000매 136,400 · 부수2 239,600 | line-total |
| CPR2000 | posters | 250매 87,200 · 500매 103,900 | line-total |
| CLF2000 | brochures, menus | 1000매 119,800 · 2000매 136,400 | line-total |
| CPR4000 | saddle-stitch-booklet, perfect-bound-booklet, catalogs | 200부 823,000 · 500부 936,000 | line-total |
| CCD1000 | wall-calendars | 100부 375,000 · 부수2 750,000(단가375,000) | unit×count |
| CCD2000 | desk-calendars, mini-calendars | 1부 7,500 · 부수5 37,500(단가7,500) | unit×count |

대표 조합(`size × paper × qty tier × print_method × 양/단면`)은 각 표집의
`selection` 스냅샷에 증거로 기록. estimate-class(예: CPR3000→CLF2000)는 goods_view
HTML 에서 동적 확인(하드코딩 금지) — OMO-3610 RE 와 동일.

## 5. 제약 / 후속

- **박(箔)**: `total_price`/`supply_amt` 에 미포함 → 별색 surcharge 분리 산정
  (기존 `finishing-surcharge`/`finishing-catalog` 규칙 유지). 본 하니스 범위 외.
- **고객가 변경 없음** (표집·검증만). 매트릭스 적재(`print_swadpia_price_matrix`)·
  `swadpia-base-price` quote-only→matrix 재분류·구성기 연동·`SWADPIA_MATRIX_ROUTING`
  ON 은 후속 자식(블로커). parity 큰 이동은 보드 확인 카드로 상신, 대리 수락 금지.
- 성원 도매가·매핑·URL 은 서버 전용, 클라 비노출 유지.

## 6. 재현

```bash
node scripts/omo3623-print-price-harness.mjs            # 13 표집 → data/omo3623-*.json
node scripts/omo3623-print-price-harness.mjs --out /tmp/x.json
```
