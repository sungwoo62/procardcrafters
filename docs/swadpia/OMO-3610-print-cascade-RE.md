# OMO-3610 — 전단·포스터·캘린더·책자 성원 인쇄단가 cascade RE

> 상태: **RE 완료 (READ-ONLY)**. 매트릭스 적재·구성기 연동은 자식 이슈로 분리.
> 라이브 고객가 변경(플래그 ON)은 **보드 가격 승인 게이트**.

## 1. 문제 (확정)

generic JSON endpoint `POST /estimate/estimate_goods/json_data` 는 아래 10종에서
"사이즈가격 그리드 garbage"를 반환한다 — `print_info1` 의 `unit_key=1` 행이
`print_unit=64000`(책자는 8000), `paper_code=""`. 현재 파서
(`extractMatrixBasePriceKrw`)는 최소 unit_key 를 잡아 64000 을 기준단가로 도출 →
무의미. 그래서 `swadpia-base-price.ts` 에서 전부 `quote-only` 로 폴백 중이다.

| slug | category_code | estimate class | generic endpoint |
|------|---------------|----------------|------------------|
| leaflets | CPR3000 | **CLF2000** | q1=64000 garbage |
| posters | CPR2000 | (확인필요) | q1=64000 garbage |
| brochures | CLF2000 | CLF2000 | q1=64000 garbage |
| menus | CLF2000 | CLF2000 | (collapse) |
| saddle-stitch-booklet | CPR4000 | (확인필요) | q1=8000 garbage |
| perfect-bound-booklet | CPR4000 | (collapse) | garbage |
| catalogs | CPR4000 | (collapse) | garbage |
| wall-calendars | CCD1000 | (확인필요) | q1=64000 garbage |
| desk-calendars | CCD2000 | (확인필요) | q1=64000 garbage |
| mini-calendars | CCD2000 | (collapse) | garbage |

> ⚠️ **estimate class ≠ category_code**: goods_view/CPR3000(leaflets)는
> `print_class_CLF2000.min.js` 를 로드한다. 빌드 시 카테고리→estimate-class
> 매핑을 goods_view HTML 에서 동적 추출해야 한다(하드코딩 금지).

`OMO-3142 probe`(`scripts/omo3142-probe.mjs`) 재실행으로 garbage 재확인됨
(2026-06-20). 명함류(CNC*)는 정상 매트릭스라 영향 없음.

## 2. 실가의 출처 — goods_view cascade

json_data 자체에 실가가 **있다**. 단, generic 파서가 보는 `print_info1.unit_key=1`
이 아니라, goods_view 의 클라이언트 JS `print_class_{CLASS}.min.js` 가
다음 cascade 로 조합한다 (Dean Edwards packer 로 패킹 → 언팩하면 평문):

```
total = paperPrice + platePrice + printPrice + cuttingPrice
        + postpress(후가공)  + boxPacking
```

핵심 입력: **paper_yeon_qty(연 수량)** = 주문수량을 size_info.cut_num /
parts_num 으로 환산한 "연"(전지 단위). 이것이 모든 단가의 곱셈 인자다.

### 2.1 paperPrice (`caluPaperPrice`)
```
price_unit = (PTK10 ? paper_info.price_unit1 : price_unit2)   // 전지 단가
margin_qty = round(ceil((yeon_qty + paper_margin_qty)*1e5)/1e5 *1000)/1000
paper_price = ceil(round(price_unit * margin_qty * sale_rate)/100)*100
// sale_rate = price_sale_rate - (ART/SNW/VLD/VLO & yeon>1 일 때 소량 할인)
```

### 2.2 platePrice (`caluPlatePrice`) — 판비
```
plate_unit_price = (PTM20 ? PLATE_UNIT2_PRICE
                   : A0100 ? PLATE_UNIT_PRICE : 8000)
plate_amount = plate_rate + spot_color_amount(앞/뒤 별색)
   // plate_rate = 양면이면 앞도수+뒤도수, 아니면 max(앞,뒤)
plate_price = plate_unit_price * plate_amount
```

### 2.3 printPrice (`caluPrintPrice` + `getPrintUnit`)
```
print_price_unit = print_info{1=PTM10|2=PTM20}[unit_key==yeon_tier]
                     .(PTK10 ? price_unit1 : price_unit2) * print_extra_rate
print_qty = max(yeon_qty, MAX_CUT_SIZE_FLAG==1 ? 0.9 : 1)
primary = primary_color_amount2 * (print_price_unit * full_bg_rate) * print_qty
spot    = spot_color_extra * (print_price_unit * spot_extra2) * print_qty_spot
print_price = ceil((primary + spot)/1000)*1000
// full_bg_rate=1.5(배경꽉참), spot_extra2=1.5(PTM10 별색)
```
공유인쇄(소량) 카테고리는 `caluSharePrintPrice` + `print_info4`(paper_code별
unit_key=yeon_qty) 경로를 탄다.

### 2.4 cuttingPrice (`getCuttingPrice`, line ~1969) / postpress
재단·후가공은 `postpress_class_{CLASS}.min.js`(235 메서드) 가 담당. 후가공은
이미 OMO-3511/finishing-fields 경로로 RE 됨 → 재사용. **박(箔)은 total 에
안 잡힘 → 별색 surcharge 분리 산정**(기존 규칙 유지).

## 3. 결정론 추출 전략 (권고)

JS cascade 를 TS 로 **재구현하지 않는다**(연 수량 옵션 생성·재단·도수 분기가
방대 → 드리프트 리스크). 대신 **성원 자기 코드를 그대로 실행**해 ground-truth
total_price 를 표집한다 (보드 절대규칙: "오프라인 크롤러가 hidden total_price 표집
→ print_swadpia_price_matrix 적재, parity 게이트"와 정합):

1. node 헤드리스 하니스: 언팩한 print/postpress/product class + jsonPath +
   최소 DOM 스텁을 로드하고, 대표 조합(size × paper × qty × print_method × 양/단면)
   을 세팅해 cascade total 을 산출.
2. parity 게이트: 산출값 ≠ 화면 표시 공급가면 **적재 차단**(크롤≠화면).
3. 적재: `print_swadpia_price_matrix`(빈 paper_code garbage 대체).
4. 표시·청구 일원화: `computeOrderItemPriceUsd` 경로가 동일 매트릭스 참조.

검증 ground-truth 는 goods_view 화면 표시가(hidden `total_price` 필드).
실주문/결제 금지 — 파일 업로드 직전 dry-run 까지만.

## 4. 재현

```bash
node scripts/omo3610-cascade-probe.mjs CPR3000 /tmp/omo3610-CPR3000
# → json_data.json + 언팩된 print/postpress/product class + SUMMARY.json
node scripts/omo3142-probe.mjs   # garbage 재확인
```

## 5. 거버넌스

- 본 작업은 **고객가 변경**을 수반 → 플래그 `SWADPIA_MATRIX_ROUTING` ON 전환은
  보드 승인 게이트. parity 큰 이동은 보드 확인 카드로 상신, 대리 수락 금지.
- 성원 도매가·매핑·URL 은 서버 전용, 클라이언트 비노출 유지.
