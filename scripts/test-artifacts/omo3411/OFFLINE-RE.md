# OMO-3411 박(foil) 가격 공식 — 오프라인 RE (라이브 측정 전 확정 사실)

작성 2026-06-17 / 근거: OMO-2647 캡처 아티팩트(`scripts/test-artifacts/omo2647/re-flow.json`,
`SUMMARY.md`) + `swadpia-finishing-fields.ts` + `finishing-surcharge.ts` 코드.
**라이브 측정 없이** 캡처된 함수 본문/함수 인벤토리/필드 정의만으로 확정한 내용.

## 1. 공식 구조 (확정)
- **공식 REST JSON 없음** (OMO-2647 재확인). `bak_amt` 는 goods_view 클라이언트 JS 가 계산.
- 캡처된 글로벌 함수는 **위임자(delegator)** 일 뿐, 실제 산식은 `product1.*` 메서드 안:
  - `addBak(seq)` → `product1.setPPBakAmtSum()` + `product1.calcuEstimate()`
  - `chgBakType(seq)` → `if(chk_is_bak.checked) product1.ppBak(seq)`
  - 즉 **레이어별 단가** = `product1.ppBak(seq)`, **합산** = `product1.setPPBakAmtSum()`.
- ⚠️ `product1.ppBak` / `setPPBakAmtSum` **본문은 OMO-2647 아티팩트에 미캡처** (글로벌만 100자 슬라이스로 떴음).
  → 산식 직접 확인은 라이브 RE 필수. 본 이슈의 sweep 하니스가 `product1.ppBak.toString()` 을 덤프하도록 작성됨.

## 2. 변수 인벤토리 (필드 정의에서 전수 확정 — `swadpia-finishing-fields.ts`)
레이어 1세트당 필드(`_1`, 최대 `_3`):

| 필드 | 코드 | 의미 | 가격영향(가설) |
|------|------|------|----------------|
| `bak_section_N` | **BKS10 신규 / BKS20 보유동판** | **동판(die plate) 보유여부** | 신규=동판 setup-fee 포함 / 보유=면제 → **intercept 항** |
| `bak_side_N` | BKD10 전 / BKD20 후 / BKD30 양 | 인쇄 면 | 양면=2× 추정 |
| `bak_type_N` | BKT01~16 (금/은/청/적/녹/먹/홀로그램3종/로즈골드…) | 박 종류 | 종류별 단가 델타 |
| `bak_x_size_N`×`bak_y_size_N` | mm | **박 면적** | 면적 비례(선형 vs 구간 미확정) |
| `bak_compare_N` | BAC10 같음 / BAC11 틀림 | 레이어간 내용 동일성 | 양면동판 공유 영향 가능 |
| seq 1/2/3 | — | **레이어** | setPPBakAmtSum 으로 합산 |
| 수량 | paper_amount 등 | 발주 매수 | 미측정 |

**핵심 발견:** 이슈의 "변수 후보" 목록에 없던 **`bak_section`(동판 신규/보유)** 이 1차 가격변수다.
OMO-2647 의 단일 측정점(22,300 KRW @ 50×30mm)은 `BKS10(신규)` 로 측정됨 → **동판 setup-fee 가 포함**된 값.

## 3. 현행 모델의 리스크 (검증 대상)
`finishing-surcharge.ts`: `foil_stamp` 를 **원점통과 선형** `ratePerMm2 = 22300/1500 = 14.87 KRW/mm²` 로 근사.
- 만약 실제가 `bak_amt = 동판비(고정) + 면적단가·mm²` (intercept≠0) 라면:
  - 작은 면적은 **과대청구**, 큰 면적은 **과소청구**.
  - `BKS20(보유동판)` 재주문은 동판비가 빠져야 하는데 현행은 동일 단가 → **과대청구**.
- 면적이 **구간(step/bracket)** 이면 선형근사 자체가 부정확.
→ sweep 하니스의 면적곡선이 `intercept`/`slope` 를 분리 추정하여 이 가설을 판정한다.

## 4. 라이브 측정 계획 (`scripts/omo3411-bak-formula-sweep.mjs`)
1. `product1.ppBak`/`setPPBakAmtSum`/관련 getter **본문 덤프** (산식 직접 확인).
2. 면적 7점 스윕(10×10 … 150×100) → 선형 vs 구간 + intercept 추정.
3. 종류 6종(BKT02/01/06/11/12/16) 델타.
4. 면 3종(BKD10/20/30), section 2종(BKS10/20=동판게이트), 레이어 1/2/3, 수량 4점.
5. 결과로 `finishing-surcharge.ts` 박 모델을 실측 공식/테이블로 교체 또는 선형근사 검증.

## 5. 블로커
라이브 성원 로그인 세션 필요: `.env.local` 의 `SWADPIA_USERNAME`/`SWADPIA_PASSWORD`.
**현재 파일시스템에 자격 부재** (`.env.local` 없음, `.env.local.example` 에도 swadpia 키 없음).
Playwright 는 설치됨(`/Users/william/node_modules/playwright`). → 자격만 발급되면 1커맨드로 실행.
**언블록 오너/액션:** 보드/CEO 가 SWADPIA 자격을 `.env.local` 에 발급(가격 RE 는 읽기전용, 실주문 없음).
