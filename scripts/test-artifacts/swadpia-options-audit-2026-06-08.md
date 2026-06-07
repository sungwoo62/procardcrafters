# 성원애드피아 자동발주 옵션 검증 — OMO-2634 (2026-06-08)

자동발주 미지원이던 23개 제품군의 `print_product_options`(DB) 값을 성원 estimate
JSON 실제 코드와 대조. 도구: `scripts/swadpia-validate-options.mjs`.

## 1. 라우팅 근본원인 수정 (완료, commit 762fe30)
- `swadpia-order.ts` 의 `SWADPIA_GOODS_MAP`(자동발주 라우팅, 기존 15종)을
  `swadpia.ts` 의 `CATEGORY_MAP`(가격조회 38종)에서 **파생**하도록 변경.
- 결과: 23종 포함 38종 전부가 동일 goods_view URL 로 자동발주 라우팅됨.
  이중 관리(가격맵 ≠ 발주맵)로 23종이 누락되던 근본원인 제거.

## 2. 옵션값 검증 결과 (2회 반복 안정)
- **검증 통과 14종** — paper_code + paper_size 모두 성원 실제 코드와 일치.
  catalogs, desk-calendars, holographic-stickers, invoice-forms, leaflets,
  menus, mini-calendars, ncr-forms, perfect-bound-booklet, quotation-forms,
  receipts, roll-stickers, saddle-stitch-booklet, wall-calendars.
  → 라우팅 수정과 합쳐져 paper/size 기준 자동발주 적용 가능.
- **불일치 6종 (수정 필요)** — DB 코드가 매핑된 카테고리 라이브값에 없음.
  - 라벨류 CLP1000: barcode-labels, food-labels, price-labels (DB: LBL*/SZ* 코드)
  - 배너류 CPR5000: mini-banners, rollup-banners, x-banners (DB: BNR510W00/MBS/RBS/XBS)
  - 원인 추정: 한 카테고리코드에 여러 제품(현수막/미니/롤업/X배너, 라벨 3종)이
    매핑돼, estimate `product=name` 쿼리가 **대표 goods** 데이터(예: CPR5000=
    포스터지 ART300 계열)를 반환 → 실제 제품 goods 와 다름. DB 코드가 틀린 게
    아니라 **카테고리 매핑/대표 goods 불일치**일 가능성. 제품별 goods_code 단위
    재확인 필요.
- **검증 불가 3종 (봉투, CEV1000)** — estimate JSON 빈 응답/실패.
  standard/admin/gusset-envelopes. 봉투는 JSON 엔드포인트가 데이터를 주지 않음.

## 3. 검증 한계 (중요)
estimate `json_data` 의 `product=name` 쿼리는 카테고리 대표 goods 만 반환하고,
일부 카테고리는 빈 응답. 제품별 정확 검증의 **권위 있는 소스는 런타임 goods_view
페이지**(JS로 동적 구성되는 옵션, swadpia-order.ts 의 selectOrderOptions 와 동일
DOM). 따라서 불일치 6종 + 봉투 3종의 확정 수정은 Playwright 런타임 추출이 필요
(swadpia-order 자동화는 설계상 VPS/로컬 전용).

## 4. 남은 작업 (9종)
제품별 goods_view 런타임 추출 → 정확한 paper_code/paper_size/paper_qty/
print_color_type 확정 → CATEGORY_MAP 매핑 정정(필요 시) + print_product_options
재시드. 후가공 실옵션 와이어링은 [OMO-2635] 소관.
