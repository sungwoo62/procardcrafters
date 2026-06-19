# OMO-3528 #2 선행 표집 — 박 런타임 단가 소스 위치 확인 (2026-06-19)

박 카테고리별 함수 승격(#2)의 선행 데이터 = `ppBakJsonOBJ`(bak_type 별 `material_unit2`/
`extra_rate`/`chk_size_low/high`). 어디서 표집 가능한지 공개 GET/POST 로 확인했다.

## 표집 결과 (실주문 0, 공개 GET/POST only)

| 소스 | 박 단가 키 존재? | 비고 |
|---|---|---|
| `POST /estimate/estimate_goods/json_data` (omo3142 패턴) | ✗ | paper/print/size/print_info1~4 만. 박 키 없음. (`bak-json-*.json` 참조) |
| `GET /goods/goods_view/{CNC,CST,CPR}` 정적 HTML | ✗ | `ppBakJsonOBJ`/`material_unit2`/`chk_size` 미발견. CPR 만 `extra_rate` 1회(무관 컨텍스트) |

## 결론

`ppBakJsonOBJ` 는 **정적 소스에 없다 → 런타임 populate**. 사이즈/용지 선택 후 폼 JS
(postpress/product class)가 AJAX 또는 인라인 계산으로 글로벌에 채운다. 따라서 표집은
**Playwright READ-ONLY 런타임 추출**이 필요하다 — OMO-2961 runtime-probe 패턴과 동일
(`page.evaluate(() => window.ppBakJsonOBJ)` 를 사이즈 선택 후 호출).

## #2 자식 이슈 시작점

1. OMO-2961 의 goods_view 활성화 하니스 재사용 → 카테고리(CNC/CST/CPR/CLF)별:
   - 대표 사이즈/용지 선택 → `setIsPostpress('bak')` → `window.ppBakJsonOBJ` 덤프.
   - bak_type 별 `material_unit2`/`extra_rate`/`chk_size_low/high` 표 작성.
2. `swadpia-finishing-formula.ts` 의 `getBakPriceUnit` 카테고리별 분기 수치 확정.
3. `finishing-surcharge.ts` 박 단가를 단일 ratePerMm2 → 카테고리별 함수 매트릭스로 승격
   (보드 가격 게이트는 OMO-3512 에서 통과 — 적재만, 단 명함 8종 회귀 불변 필수).
4. 동판 면제(BKS20)의 surcharge-side 금액 분리는 카테고리 함수가 동판 컴포넌트를 분리
   적재한 뒤 의미를 가진다(현 ratePerMm2 모델엔 별도 동판 항이 없음).
