# OMO-3557 비명함 surcharge 카테고리 공식표 (라이브 수량스윕 fit)

측정 raw: `noncard-surcharge.json` (2026-06-19T05:28:28.858Z) · 후처리 `noncard-surcharge-formulas.json`
방법: production activateFinishings 1:1 재현 + base-config 자동선택 → hidden `{type}_amt` 직독(OCR/추론 금지). READ-ONLY, 실주문 없음.

## parity/결정론 게이트
라이브 `payΔ/amt = 1.100`(부가세 10%) 일관 확인 → hidden amt 는 결정론적 wholesale surcharge.
- LOADABLE: COUPLED_OK(payΔ=amt×1.1) ≥2점 → 적재가능 · LOADABLE_1PT: 1점만(slope 미확정)
- HOLD_UNCOUPLED: amt 계산되나 payΔ=0(가격 미반영, 시퀀스 재확인 필요) · BLOCK_NODATA: amt=0

## 공식표 (amt ≈ base + rate·수량, 수량단위=카테고리별)

| 카테고리 | 단위 | 후가공 | 게이트 | 측정점(수량:amt) | fit base | rate | R²(n) | CNC대비 |
|---|---|---|---|---|---:|---:|---:|---|
| CLF1000 | 매(sheet) | die_cut | LOADABLE | 2000:70000 4000:113000 8000:199000 | 27000 | 21.5 | 1(3) | DIVERGE coef 1.421 |
| CLF1000 | 매(sheet) | drilled_hole | LOADABLE | 2000:10000 4000:15000 8000:25000 | 5000 | 2.5 | 1(3) | DIVERGE coef 1.058 |
| CLF1000 | 매(sheet) | epoxy | LOADABLE | 2000:150000 4000:180000 8000:350000 | 65000 | 34.6429 | 0.9629(3) | DIVERGE coef 1.492 |
| CLF1000 | 매(sheet) | score_crease | BLOCK_NODATA | 2000:0 4000:0 8000:0 | - | - | - | - |
| CLF1000 | 매(sheet) | perforation | LOADABLE | 2000:36000 4000:36000 8000:60000 | 24000 | 4.2857 | 0.8929(3) | DIVERGE coef 1.82 |
| CLF1000 | 매(sheet) | numbering | LOADABLE | 2000:90000 4000:160000 8000:330000 | 5000 | 40.3571 | 0.9979(3) | NEW_DATA |
| CPR4000 | bundle(묶음) | die_cut | BLOCK_NODATA | 50:0 1200:0 5000:0 | - | - | - | bundle(비교불가) |
| CPR4000 | bundle(묶음) | epoxy | LOADABLE | 50:150000 1200:150000 5000:435000 | 115972 | 61.9334 | 0.9507(3) | bundle(비교불가) |
| CPR4000 | bundle(묶음) | round_corner | LOADABLE | 50:40000 1200:720000 5000:3000000 | 6490 | 598.485 | 1(3) | bundle(비교불가) |
| CPR4000 | bundle(묶음) | score_crease | HOLD_UNCOUPLED | 50:20000 1200:28000 5000:81000 | 16480 | 12.7294 | 0.9895(3) | bundle(비교불가) |
| CPR5000 | 매(sheet) | die_cut | HOLD_UNCOUPLED | 400:40000 2800:50000 4800:74000 | 34374 | 7.6099 | 0.9205(3) | MATCH 1.007 |
| CPR5000 | 매(sheet) | epoxy | BLOCK_NODATA | 400:0 2800:0 4800:0 | - | - | - | - |
| CNC1000 | 매(sheet) | die_cut | LOADABLE | 500:21500 2000:49000 5000:106000 | 11810 | 18.8095 | 0.9999(3) | MATCH 1.003 |
| CNC1000 | 매(sheet) | drilled_hole | LOADABLE | 500:3800 2000:10100 5000:19500 | 2538 | 3.4381 | 0.9941(3) | MATCH 0.996 |
| CNC1000 | 매(sheet) | round_corner | LOADABLE | 500:3000 2000:11200 5000:24000 | 1210 | 4.6095 | 0.9959(3) | MATCH 0.998 |
| CNC1000 | 매(sheet) | epoxy | LOADABLE | 500:22500 2000:90000 5000:225000 | 0 | 45 | 1(3) | MATCH 1 |
| CNC1000 | 매(sheet) | score_crease | LOADABLE | 500:7000 2000:19000 5000:38000 | 4310 | 6.8095 | 0.9963(3) | MATCH 1.002 |
| CNC1000 | 매(sheet) | perforation | LOADABLE | 500:7000 2000:19000 5000:38000 | 4310 | 6.8095 | 0.9963(3) | MATCH 1.002 |
| CNC1000 | 매(sheet) | numbering | BLOCK_NODATA | 500:0 2000:0 5000:0 | - | - | - | - |

## 비명함 측정 한계(정직 명시)
- **박/형압(foil/ap, 면적모델)**: 비명함은 add-to-list UI(`addBak()`+`chgBakSection/Side/Type/Size`+`bak_exist_dongpan` AJAX populate, `bakSizeReadonly`). 동기 이벤트로 동판옵션 미populate → 본 스윕서 미측정(amt=0). 별도 add-to-list RE 필요(자식이슈).
- **CLF1000**: qty 래더 최소 2,000·간격 2,000 → cap 5,000 에서 2점만(slope 신뢰 낮음). 3점 확보엔 8,000 포함 재측정 권장.
- **CPR4000(책자)**: 수량=bundle(묶음) 단위라 매수기준 CNC 공식과 직접 비교 불가(단위 환산 필요).
- **CPR5000/die_cut·score_crease 등 UNCOUPLED**: amt 계산되나 payΔ=0 — 가격 반영 시퀀스 재확인 후 적재.
