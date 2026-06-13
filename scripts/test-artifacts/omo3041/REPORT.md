# OMO-3041 — 책자 PUR무선(BDT6) 자동발주 in_page_qty 기본 ≥32 + 라이브 BDT6 재검증

조사일 2026-06-13 · WebOps-Print · 라이브 READ-ONLY (로그인 없음, 주문/결제 없음)
대상: `https://www.swadpia.co.kr/goods/goods_view/CPR4000/1`
증거: `scripts/test-artifacts/omo3041/{bdt6-reverify.json, bdt6-64p.png}`
스크립트: `scripts/omo3041-bdt6-reverify.mjs`

## 1. 코드 변경 — in_page_qty 기본값 ≥32 (권장 64p)

`src/lib/swadpia-order.ts`:
- `withBookletInPageQtyDefault(categoryCode, options)` 추가 — 책자(CPR4000) 자동발주에 한해
  `in_page_qty` 가 없으면 기본 **64p** 를 주입. 입력에 값이 있으면 그대로 존중(고객 의도 우선).
- `placeSwadpiaOrder` 가 `selectOrderOptions` 호출 직전 이 헬퍼를 적용.
- 사유: `print_product_options` 는 canonical 4종(paper_code/print_color_type/paper_size/paper_qty)만
  저장 가능(CHECK 제약)이라 `in_page_qty` 를 DB 시드로 둘 수 없음 → 코드 주입이 유일 경로.
- `<32` 입력은 OMO-3037 의 deferred 검증이 명확한 에러로 중단(오발주 방지). 여기서 조용히
  끌어올리지 않음.

## 2. 라이브 BDT6 재검증 (새 기본 표지 MGM200W01 + in_page_qty 스윕)

cover cascade 정상 해석: `cover_paper_kind=PKD30 → cover_paper_type=MGM(매직매칭) → cover_paper_code=MGM200W01 (백색 200g)` — Dev-Print 가 라이브 적용한 새 기본 표지와 일치.

| in_page_qty | binding_type 라이브 옵션 | BDT6 |
|---|---|---|
| 28 (게이트 미달) | BDT2 중철, BDT4 스프링 | ❌ 미노출 |
| **32** (PUR무선 최소) | BDT2 중철, **BDT6 pur무선**, BDT4 스프링 | ✅ 노출 |
| **64** (신규 기본) | BDT2 중철, **BDT6 pur무선**, BDT4 스프링 | ✅ 노출 |

- in_page_qty 옵션 수: 161개(32~640 등). binding default = BDT2(중철) → BDT6 는 명시 선택 필요.
  자동발주는 시드 `print_color_type` 기본=BDT6 → `binding_type` deferred 단계에서 BDT6 명시 선택(OMO-3033).
- 결론: 새 기본 표지(MGM200W01) + in_page_qty 기본 64p 조합에서 BDT6 가 라이브 노출되어
  자동발주 BDT6 검증(OMO-3033)을 통과한다. 28p(<32)는 정상적으로 미노출 → 게이트가 표지가 아닌
  내지 페이지수(≥32)임을 재확인(OMO-3037 정합).

## ⚠️ 외부 발송 게이트 (OMO-1908) 준수
재검증은 로그인조차 없는 공개 goods_view configurator READ-ONLY 조사. 주문/결제(paySubmit) 미실행.
