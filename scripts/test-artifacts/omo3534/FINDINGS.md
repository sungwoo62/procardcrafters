# OMO-3534 — 박 카테고리별 단가 함수 승격: ppBakJsonOBJ 런타임 표집 + 검증 (2026-06-19)

부모 OMO-3528 #2. 현 박 surcharge 의 단일 `ratePerMm2`(22,300/1,500㎟ 선형, 명함 1점 근사)를
카테고리별 함수로 승격. 선행 OMO-3528 에서 `ppBakJsonOBJ` 는 정적 소스에 없고 **런타임 populate**
임을 확인 → 본 이슈에서 Playwright READ-ONLY 런타임 표집으로 수치 확정.

## 표집 방법 (실주문/결제 0)

- `scripts/omo3534-bak-runtime-sample.mjs` — 로그인 후 `goods_view/{CODE}` → 용지/사이즈 선택 →
  `chk_is_bak` + `setIsPostpress('bak')` → `window.ppBakJsonOBJ` 덤프.
- `scripts/omo3534-bak-cnc-groundtruth.mjs` — CNC 폼에 알려진 입력 세팅 → 성원 JS 가 채운 hidden
  `bak_amt` 직독(케이스별 페이지 새로고침으로 in-page carryover 제거).
- playwright = `projects/procardcrafters` clone, 크레덴셜 = 메인 repo `.env.local`(SWADPIA_*).
- 산출물: `bak-runtime-{CODE}.json`, `cnc-groundtruth.json`, `SUMMARY.json`.

## 핵심 발견 — 박 단가는 카테고리별로 **구조가 다른 함수** (RE ④ 확증)

| 카테고리 | ppBakJsonOBJ 유형 | 박 unit 모델 | 본 이슈 처리 |
|---|---|---|---|
| **CNC1000** 명함 | `material_unit`(16 bak_type) | `getBakPriceUnit` = work+film(material_unit2/(low·high)·면적·extra_rate) | ✅ 구현+검증(아래) |
| **CLF2000** 전단 | `material_unit`+`min_unit` (extra_rate=**1.3**) | 구조 상이: unit=work only, 별도 `getBakMaterialPrice`=면적·material_unit2·1.2/1e8·qty | ⏳ 데이터 표집·미검증 → 후속 |
| **CPR1000** 포스터 | `film_unit`+`work_unit` (material_unit **없음**) | RE ④: `ceil(basic·saleRate)+dongpan+20000` 별도 모델 | ⏳ 후속 |
| **CST1000** 스티커 | `ppBakJsonOBJ` **미populate**(hasObj=false) | 박 미제공 or 별도 활성화 경로 | ⚠️ 재조사 |

→ **단일 ratePerMm2 로 전 카테고리 parity 불가**가 런타임 데이터로 재확증됨.

## CNC1000 material_unit 표 (런타임 표집 — 전 bak_type 공통 `extra_rate=2, chk_size_low=640, chk_size_high=60000`)

| material_unit2 | bak_type |
|---|---|
| 26,000 | BKT01,02,03,04,05,09,10,16,17 (금/은/청/적/녹박 등 일반) |
| 30,000 | BKT06 (먹박) |
| 35,000 | BKT08 |
| 70,000 | BKT07, BKT11, BKT12, BKT13 (홀로그램박류) |
| 80,000 | BKT18 (백박 무광) |

## CNC1000 단가 함수 검증 (TS 재구현 = 성원 hidden bak_amt, 4/4 EXACT)

`getBakPriceUnit`/`calcuBakPrice`(RAW postpress_CNC1000 1474·1688) 직역 → `bakPriceUnitCnc`/`bakPriceCnc`.
그라운드트루스(cut 90×50, qty 500, oc 1, BKS10):

| bak_type | 박 사이즈 | bak_side | TS 재현 | 성원 bak_amt | 일치 |
|---|---|---|---|---|---|
| BKT01 (26,000) | 40×20 | 단면 | 20,200 | 20,200 | ✅ |
| BKT06 (30,000) | 50×30 | 단면 | 22,800 | 22,800 | ✅ |
| BKT18 (80,000) | 50×30 | 단면 | 29,000 | 29,000 | ✅ |
| BKT01 (26,000) | 40×20 | **양면 BKD30** | 37,200 | 37,200 | ✅ |

검증 스크립트: `scripts/omo3534-verify-formula.mjs`.

### 결정론·거버넌스 함의 (중요)

- **BKT01 50×30 박 + 90×50 명함 = 정확히 22,300** → 현 `ratePerMm2=22,300/1,500` 는 **CNC 기본
  픽스처에서 캘리브레이션**된 값이다. 즉 정확 함수로의 승격은 **기본점에서 parity 이동 ≈0**.
  divergence 는 (a) 면적이 50×30 에서 벗어날 때의 비선형(현 모델은 선형 4×), (b) bak_type/카테고리
  차이에서만 발생. → "큰 parity 이동"은 기본 주문엔 없음(보드 카드 불요), 비선형 형상 교정은 board-gated.
- **동판 분리(#4)**: `bakPriceCnc` 는 `{ unit, dongpan }` 분리 반환. 보유동판 BKS20 → dongpan=0
  (`bakDongpanPriceCnc` 기존). 카테고리 함수가 동판 항을 분리 적재 → BKS20 면제가 surcharge-side 에서 의미.

## 미해결 / 후속 (board-gated cutover 전 필요)

1. **CLF2000** 박 단가 풀 구현 + ground-truth 표집(현 데이터만 있고 검증 0). extra_rate=1.3, 별도 material 모델.
2. **CPR1000** film_unit/work_unit 모델 표집 + `+20,000` 고정항 검증.
3. **CST1000** 박 활성화 경로 재조사(ppBakJsonOBJ 미populate 원인).
4. order_count>1(다종 1주문) 박 합산 — in-page 표집이 불안정(carryover). dry-run 1회로 setPPBakAmtSum Σ 실측.
