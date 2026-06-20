# OMO-3627 — 성원 인쇄단가 매트릭스 적재 + quote-only→matrix 재분류 + 구성기 일원화

> 라이브 고객가 변경 = **보드 가격 승인 게이트**. 본 변경은 기본 **dormant**(플래그 OFF)로 적재되며,
> 컷오버(`--apply` + `SWADPIA_MATRIX_ROUTING=on`)는 보드 승인 후에만 진행한다.

## 배경

전단·포스터·브로셔·책자·캘린더 10종은 generic JSON 가격엔드포인트가 '사이즈가격 그리드 garbage'
(q1=64000 등)를 반환해 base_price 자동 sync 에서 제외(quote-only, last-good 보존)돼 있었다(OMO-3142).
성원 goods_view(실주문폼)에는 옵션별 실가가 cascade 로 존재한다 — OMO-3623 하니스가 성원 자기
cascade 코드를 headless 로 그대로 실행해 hidden 가격필드를 parity-게이트로 직독·표집했다(13 표집 / 10 slug,
parity 13 pass · 0 block).

## 적재 (load)

- 데이터원: `scripts/data/omo3623-print-price-samples.json` (OMO-3623, 서버 전용)
- 코드 적재: `src/lib/swadpia-print-matrix.ts` — slug → 대표 MOQ 공급가(`baseSupplyKrw`) + 가격모델·근거.
  - 적재값 = `sample_index=0, order_count=1, gate=pass` 대표 구성의 `supply_amt`.
  - 가격모델(OMO-3623 발견): CPR/CLF 는 `total_price===supply_amt`(라인합계), CCD(캘린더, 디지털/토너)는
    `supply_amt = unit × order_count` → 적재값은 order_count=1 의 unit 이라 base 로 직접 사용.
- DB 적재 스크립트: `scripts/omo3627-load-print-matrix.mjs` — 기본 DRY-RUN(델타 리포트), `--apply` 시에만
  `print_products.base_price_krw` 갱신(service_role 필요).

## 재분류 (reclassify)

`src/lib/swadpia-base-price.ts` `deriveProductBasePriceKrw`:
- 10종은 `SWADPIA_MATRIX_ROUTING` 활성(`on`/`1`/`true`) 시에만 표집 base(`mode: 'print-matrix'`)를 채택.
- 기본 OFF(dormant)면 기존 `quote-only`(null, last-good 보존) 경로로 떨어져 **현행 동작 100% 유지**(회귀 안전).
- 표집값은 항상 양수 → garbage(64000) 재오염 위험 없음. 테스트 `swadpia-base-price.test.ts` (OMO-3627 describe) 가
  OFF/ON 양쪽 + 미커버 slug 격리를 가드.

## 구성기 일원화 (configurator)

`ProductConfigurator` 는 비-useSwadpia 제품에서 이미 `product.base_price_krw` 를 base 로 사용한다
(표시·청구 동일 경로). 따라서 적재 스크립트가 base_price_krw 를 표집 실가로 갱신하면 표시==청구가
자동 일원화된다 — 별도 구성기 코드 변경 불필요.

## 보드 가격 게이트 — 델타 (DRY-RUN, 라이브 DB 2026-06-20)

| slug | current(last-good) | sampled | Δ% |
|---|---:|---:|---:|
| leaflets | 45,000 | 119,800 | +166% |
| posters | 64,000 | 87,200 | +36% |
| brochures | 64,000 | 119,800 | +87% |
| menus | 55,000 | 119,800 | +118% |
| saddle-stitch-booklet | 64,000 | 823,000 | +1186% |
| perfect-bound-booklet | 95,000 | 823,000 | +766% |
| catalogs | 120,000 | 823,000 | +586% |
| wall-calendars | 8,000 | 375,000 | +4588% |
| desk-calendars | 6,500 | 7,500 | +15% |
| mini-calendars | 4,500 | 7,500 | +67% |

KRW base. 고객가 = (base + Σextra) × margin × FX.

### ⚠️ 보드 검토 포인트 (대리 수락 금지)

1. **대형 이동의 성격**: 책자·캘린더 표집값은 *대표 구성*(예: 책자 200부 32p, 벽걸이 100부)의 공급가다.
   `base_price_krw` 는 구성기의 *최소 대표가*로 쓰이므로, 표집 구성이 구성기 최소 옵션보다 크면 최소 주문가가
   과대표시될 수 있다. 책자/벽걸이는 컷오버 전 **구성기 최소구성 기준 표집 재확인** 필요(후속 자식 권장).
2. **반대로 현재값이 garbage**: wall-calendars 8,000 / booklet 64,000 등 현행 last-good 은 q1 floor garbage
   잔재로 실제보다 현저히 낮다 → 현 라이브가 손해 구간일 가능성. 즉 양방향 리스크 존재.
3. 컷오버는 per-slug 승인 가능(스크립트는 변경 대상만 적재). 박(箔)은 별색 surcharge 분리(범위 외).
