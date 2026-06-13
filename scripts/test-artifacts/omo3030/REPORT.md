# OMO-3030 — 후가공 5종 surcharge 확정 + 책자 BDT6 인쇄색 결함

조사일 2026-06-13 · WebOps-Print · READ-ONLY 라이브 dry-run (주문/결제 없음)
증거: `scripts/test-artifacts/omo3030/{probe,probe2,verify,bdt6,bdt6sub}.json`
진단 스크립트: `scripts/omo3030-{probe,probe2,verify,bdt6,bdt6sub}.mts`

## 핵심 결론

OMO-3022 에서 "미확정 5종"으로 남은 원인의 상당수는 **잘못된 테스트 카테고리**였다.
coating 을 엽서(CDP3000), partial_coating 을 배너(CPR5000)에서 검증했으나, 두 후가공은
각각 다른 카테고리에서만 과금된다. 올바른 카테고리에서 production 자동발주 경로(generic
`activateFinishings`)를 그대로 구동하니 정상 과금됐다.

| 후가공 | 올바른 카테고리 | chk_is ON | surcharge(generic 경로) | 처분 |
|---|---|---|---|---|
| **coating(코팅)** | CPR5000 배너 | ✅ | ₩38,000(COT10)~₩86,000(COT50) | **mapped 승격** |
| **partial_coating(부분코팅)** | CPR4000 책자 | ✅ | ₩150,000(100×100mm) | **mapped 승격** |
| cutting(가공재단) | CDP3000 엽서 | ❌(재OFF) | ₩1,500 잡히나 chk 풀림 | runtime 유지 |
| bonding(접착) | (미발굴) | ✅ | ₩0 (200×200mm·BOT10~60 전부) | runtime 유지 |
| laminex(라미넥스) | (미제공) | ✅ | ₩0 (laminex_num populate 안 됨) | runtime 유지 |

## 항목별 상세

### 1. coating → mapped ✅
- CPR5000(배너)에서 chk_is_coating 기본 ON, coating_type COT10~COT50 순회 시
  ₩38,000~₩86,000. autoPick 이 첫 유효옵션(COT10=₩38,000) 자동선택 → generic 경로로 과금.
- 코팅 미제공 카테고리(엽서 CDP3000·스티커 CST1000)에선 chk 가 JS 검증(`chkCoatingable`/
  `chgPaperCoatingChk`)으로 다시 풀려 amt=0 → **자동 스킵(미적용=정상)**. 위험 없음.
- DEFAULT: `{ __fin_coating: '1' }` (coating_type 은 autoPick).

### 2. partial_coating → mapped ✅
- CPR4000(책자)에서 chk_is_partial_coating ON, 면적 100×100mm 입력 후
  setIsPostpress+calcuEstimate 만으로 partial_coating_amt=₩150,000 (별도 recalc 불필요).
- 배너 CPR5000 엔 amt=0 (미제공) — OMO-3022 가 CPR5000 으로 테스트해 0 이었던 것.
- DEFAULT: `{ __fin_partial_coating:'1', partial_coating_x_size:'100', partial_coating_y_size:'100' }`.

### 3. cutting → runtime 유지 ⚠️
- 과금이 상품별. CST5000(홀로그램스티커)은 200×200mm·10조각에서도 cutting_amt=0(무료내장).
- 엽서 CDP3000 은 cutting_amt=₩1,500 잡히나, generic 활성화 직후 chk_is_cutting 가 다시
  OFF 로 풀린다(JS 검증). 발주 제출 시 미반영 → **자동발주 비안전**. 상품별 chk-유지
  핸들러 확정 전까지 보류.

### 4. bonding → runtime 유지 ❌
- CST5000 에서 BOT10~BOT60 전 옵션 × 200×200mm × chgBondingType() 재계산해도 amt=0.
- CEV1000/CNR2000 엔 bonding_type select 자체가 없음. 과금 카테고리 미발굴(접착 무료내장 추정).

### 5. laminex → runtime 유지 ❌
- CST5000/CST1000/CST7000/CLP1000 × 용지 12종 순회해도 laminex_num select 옵션 미populate.
- goods_view 경로로 라미넥스 사실상 미제공(성원 별도 상품 추정).

## 6. 책자 BDT6(PUR무선제본) 결함

### 근본 원인
- BDT6(PUR무선제본)은 CPR4000/1 **정적 HTML 엔 존재**(raw: BDT2/BDT6/BDT4)하나,
  표지/내지 용지 또는 내지 페이지수를 선택하는 순간 binding_type 이 재populate 되며
  **BDT6 가 필터링**된다.
- 조건부 노출: cover_paper(kind/type/code) + 내지 페이지수 조합에 따라 BDT6 등장 여부가
  달라진다(일부 고급지/특수지 조합에서만). 시드 표지(ARE160W00=고급지 PKD20)도 페이지수
  선택 시 BDT4/BDT99 로 바뀌어 BDT6 가 사라지는 경우 관측.

### 영향(자동발주 위험)
- DB 시드: `catalogs`(90001d30)·`perfect-bound-booklet`(f1c5541b)는 binding 기본값=**BDT6**
  (option_type='print_color_type', CPR4000 alias→binding_type). `saddle-stitch-booklet`
  (b9b2a844)는 BDT2 기본 → **결함 없음**.
- `selectOrderOptions` 의 `selectEl.selectOption('BDT6')` 는 live select 에 BDT6 가 없으면
  **예외를 던진다** → 무선제본 자동발주가 용지/페이지 조합에 따라 간헐 실패. (조용한
  오발주는 아니나, 발주 실패 자체가 SLA 리스크.)
  마이그레이션: `supabase/migrations/20260608000010_print_swadpia_options_23products.sql:141,155`

### 권고 수정(주문 시퀀스 — Dev-Print)
순수 mapping 보정으로 해결 불가. 주문 폼 시퀀싱 로직 필요:
1. 표지 용지(BDT6 호환 kind/type/code) + 내지 페이지수를 **binding_type 설정 전에** 적용.
2. binding 설정 직전 live select 에 BDT6 존재를 검증 → 없으면 명확한 에러 반환
   (조용한 스킵/오발주 금지).
3. (대안 불가) PUR무선 전용 goodsCode 는 없음 — CPR4000/1~8 모두 동일 상품(default BDT2,
   BDT6 조건부)으로 확인(bdt6sub.json). 따라서 `SWADPIA_GOODS_CODE_OVERRIDES` 보정으로는
   해결 불가, 위 1~2 의 시퀀싱/검증 로직이 필수.
