# OMO-3240 — 성원 가격 매트릭스 크롤러 + 적재(+qty 보간)

부모 OMO-3239 스파이크(3 게이트 PASS). 본구현 항목 4·5.
보드 그린라이트(OMO-3238): "성원에서 천천히 다 읽어서 DB화, 라이브 금지" — 오프라인 배치 크롤 모델.

## 산출물
- `scripts/omo3240-crawl-matrix.mjs` — Playwright 로그인 → 제품별 size·paper·side 전수
  enumerate → 조합당 qty 표집(hidden `total_price` 독취) → qty 보간 → 아티팩트 JSON 적재.
- `scripts/omo3240-load-matrix.mjs` — 아티팩트 → `print_swadpia_price_matrix` upsert +
  `print_swadpia_price_crawl_runs` 로그. 멱등(on-conflict). 표 미배포면 graceful skip.
- 스키마: `supabase/migrations/20260616000010_omo3239_price_matrix.PROPOSED.sql`.

## 결정론 근거 (스파이크 재확인)
페이지 hidden `total_price`(order_form 직렬화 대상) = 실제 장바구니 등록가. OCR/LLM 미사용.
select 변경 후 **networkidle + settle(1.2s)** 강제 — 게이트2 교훈(recompute AJAX 정착 전 스냅 금지).

## 제품군별 수량/사이즈 필드 (라이브 검증 완료)
| 제품 | group | sizeField | paperField | qtyField | 비고 |
|---|---|---|---|---|---|
| CPR2000 포스터 | multisize | `paper_size` | `paper_code` | `order_count` | qty 선형(부수 배수) |
| CPR3000/CPR4000/CLF2000 | multisize | `paper_size` | `paper_code` | `order_count` | (CPR2000 패턴 동형) |
| CDP3000 디지털엽서 | digital | `size_type` | `paper_code` | `order_count` | size 분기(SZT10 7,700 vs SZT20 6,200) |
| COD1000/COD1100 토너 | toner | `paper_size` | `paper_type`(폴백) | `order_count` | **수량 구간 할인(sub-linear)** — 보간 다점 필수 |

- **고객 노출 수량 = `order_count`(부수)**. `paper_qty`(용지 매수)는 종속 → 표집 대상 아님(게이트2).
- 필드 discover 폴백 내장: config 부재 시 size=/size/(≠basis), paper=paper_code→paper_type,
  qty=order_count→paper_qty 순으로 자동 탐지. COD1100 의 `paper_type` 폴백이 라이브로 동작 확인.

## qty 조합폭발 억제 = 표본 + piecewise-linear 보간
- size·paper·side 는 카디널리티 낮아 전수(`source='sampled'`).
- qty 는 양 끝점 + 내부 균등 N점만 표집(`pickQtySamples`), 나머지 선택가능 qty 는
  인접 표집점 선형보간(`source='interpolated'`, 외삽 금지). 단위테스트 통과.
- ⚠️ **토너는 수량할인 곡선(볼록)** → 보간오차 발생 가능. 전체 크롤은 `--qty-points 6`
  권장. 보간값 vs 재표집 실측 오차 임계 초과 곡선은 전수표집 승격 = **parity 게이트(자식 C
  OMO-3242 cron)**. 본 이슈(child A)는 표집+보간 적재까지.

## 안전 (이슈 주의 준수)
- **라이브-퍼-리퀘스트 아님** — 오프라인 배치 표집만. 고객 가격경로는 DB 매트릭스 룩업(자식 B).
- **실주문/장바구니 등록 금지** — `goods_action=regist`/`goods_mode=cart`/`/cart`/`/order` POST 는
  `page.route` 단계에서 abort(json_data 재계산 XHR 만 통과). 크롤러는 select 변경+hidden 독취만.
- **천천히 원칙** — select 변경 사이 throttle(기본 700ms) + settle 1.2s.
- `.mjs`(npx tsx __name 함정 회피).

## 라이브 검증 (2026-06-15, 바운드 스모크)
- CPR2000: 2 size × 1 paper × 3 qty = 6 sampled + 234 interp. 가격 실측·size별 distinct·qty 단조↑.
- CDP3000(디지털)+COD1100(토너): 24 sampled + 1456 interp. **토너 hidden total_price 실측**
  (OMO-3238 "토너 불가" 재반증). 아티팩트 `scripts/test-artifacts/omo3240/matrix-*.json`.

## 전체 크롤 실행 (표 배포 후)
```bash
# 전수(8 타깃) + qty 6점 + DB 적재
node scripts/omo3240-crawl-matrix.mjs --qty-points 6 --load
# 특정 제품만 / 아티팩트만(적재 보류)
node scripts/omo3240-crawl-matrix.mjs --products CPR2000,COD1100 --qty-points 6
node scripts/omo3240-load-matrix.mjs scripts/test-artifacts/omo3240/matrix-latest.json
```

## 블로커
`print_swadpia_price_matrix`/`_crawl_runs` 마이그 배포 = **CEO 게이트(OMO-1292)**. 표 배포 전에는
loader 가 graceful skip(준비행 수만 보고). 배포 후 위 전체 크롤 `--load` 1회로 적재 완료.
