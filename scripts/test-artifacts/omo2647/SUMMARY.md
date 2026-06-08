# OMO-2647 후가공 인터랙티브 발주 플로우 — 라이브 검증 결과

검증일: 2026-06-08 / 기준 상품: CNC1000 명함 GNC1001 (로그인) / ⚠️ 모달까지만, 실주문 미발생

## 확정된 인터랙티브 시퀀스 (RE)
성원 goods_view 후가공 select 는 숨김(visible=false)이며 값+change 만으로는 단가가 안 잡힌다.
실제 단가는 다음 시퀀스로만 잡힘 (omo2647-re-finishing-flow / product1 / debug 로 확정):
1. `chk_is_{type}` 체크 + `pnl_{type}` 노출 (활성화)
2. section/type 등 select 설정 → 사이즈 의존 런타임 옵션 populate 유발
3. 넘버링: `chgNumberingType()` → `product1.settingNumberingKind()` 가 numbering_kind 클라이언트 채움
4. `setIsPostpress(type)` → `product1.pp{Type}('1' for bak/ap)` → `{type}_amt` 산출
5. `product1.calcuEstimate()` → `pay_amt` 합산

핵심 함수: `chkPostPress(section,type)`(활성화 토글), `setIsPostpress(type)`(올바른 seq로 pp 호출),
`product1.calcuEstimate()`(각 `{type}_amt` 를 `chk_is_{type}` 게이트로 합산).

## 도매 surcharge (부가세 포함 pay 델타, 1,000매 기준)
| 후가공 | payΔ | wholesale amt | 비고 |
|--------|------|---------------|------|
| 타공(drilled_hole) | +4,180 | tagong_amt=3,800 | 4mm 1개 |
| 도무송(die_cut) | +23,650 | domusong_amt=21,500 | 전체도무송 라운드 |
| 박(foil_stamp) | +25,520 | bak_amt=22,300 | 금박유광 전면, **면적 50×30mm 기본값** |
| 형압(deboss_emboss) | +24,530 | ap_amt≈22,300 | 앞돌출, **면적 50×30mm 기본값** |
| 넘버링(numbering) | 0 | 0 | GNC1001 용지(스노우지250/300g) 넘버링 불가 — 성원 제약 |
| 복합(타공+박) | +29,700 | — | =4,180+25,520, 합성 정상 동작 ✓ |

## 구현 (commit 동봉)
- `src/lib/swadpia-order.ts`: `selectOrderOptions` 확장 — 후가공 필드는 평면 selectOption
  에서 제외하고 `activateFinishings()` 인터랙티브 시퀀스로 처리. 기존 단순옵션 동작 보존.
- `src/config/swadpia-finishing-fields.ts`: 박/형압 기본 면적(50×30mm) 주입(면적 UI 전 placeholder).

## 한계 / 후속
- **박/형압 면적**: 단가가 면적(가로×세로 mm)에 비례. 현재 보수적 기본값(50×30) 주입.
  정확 단가엔 고객 면적 입력 UI 필요(후속 이슈 후보). 고객이 selected_options 에
  bak_x_size_1/bak_y_size_1 직접 넣으면 우선 적용됨.
- **넘버링**: GNC1001 명함 용지가 넘버링 불가라 이 상품에선 0. 넘버링 가능 상품/용지에선
  동일 플로우로 settingNumberingKind 가 kind 채우고 단가 산출 (코드상 지원 완료).
- **귀도리/에폭시/오시/미싱**: status='runtime' (별도 카테고리/사이즈 의존) — 본 이슈 범위 외.

## 재현 스크립트
- `scripts/omo2647-re-finishing-flow.mjs` — 활성화 메커니즘 + 전역함수 RE
- `scripts/omo2647-probe-product1.mjs` — product1 계산 체인 본문
- `scripts/omo2647-extract-surcharge.mjs` — 후가공별 surcharge 추출
- `scripts/omo2647-dryrun-e2e.ts` — expandFinishing→활성화→모달 E2E (shipped 데이터 경로)
