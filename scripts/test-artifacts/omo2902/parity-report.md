# OMO-2902 성원↔우리사이트 파리티 감사
생성: 2026-06-11T06:16:55.682Z

## 요약
- 제품 슬러그: **38종** (성원 카테고리 23종)
- 표준 가격매트릭스 정상: **22종** · 비표준구조(별도조사): **13종** · 성원무응답(차단): **3종**
- 후가공: 총 16 (자동발주 5 / 런타임 4 / 미감사 7)

## 1) 제품·옵션 파리티 (성원 라이브 조회)
| 슬러그 | 카테고리 | 용지 | 사이즈 | 인쇄행 | 판정 |
|---|---|---|---|---|---|
| business-cards | CNC1000 | 2 | 4 | 174 | ✅ |
| premium-business-cards | CNC2000 | 23 | 3 | 180 | ✅ |
| premium-foil-cards | CNC3000 | 3 | 4 | 80 | ✅ |
| metallic-business-cards | CNC3000 | 3 | 4 | 80 | ✅ |
| letterpress-business-cards | CNC4000 | 1 | 3 | 57 | ✅ |
| transparent-business-cards | CNC5000 | 1 | 3 | 24 | ✅ |
| uv-business-cards | CNC6000 | 11 | 3 | 112 | ✅ |
| pearl-business-cards | CNC8000 | 9 | 3 | 100 | ✅ |
| stickers | CST1000 | 11 | 0 | 0 | 🟡 비표준 |
| die-cut-stickers | CST2000 | 11 | 0 | 0 | 🟡 비표준 |
| holographic-stickers | CST5000 | 9 | 4 | 0 | 🟡 비표준 |
| roll-stickers | CST7000 | 1 | 1 | 0 | 🟡 비표준 |
| price-labels | CLP1000 | 11 | 1 | 0 | 🟡 비표준 |
| barcode-labels | CLP1000 | 11 | 1 | 0 | 🟡 비표준 |
| food-labels | CLP1000 | 11 | 1 | 0 | 🟡 비표준 |
| flyers | CLF1000 | 9 | 8 | 0 | 🟡 비표준 |
| brochures | CLF2000 | 269 | 10 | 100 | ✅ |
| leaflets | CPR3000 | 126 | 10 | 100 | ✅ |
| menus | CLF2000 | 269 | 10 | 100 | ✅ |
| saddle-stitch-booklet | CPR4000 | 144 | 4 | 100 | ✅ |
| perfect-bound-booklet | CPR4000 | 144 | 4 | 100 | ✅ |
| catalogs | CPR4000 | 144 | 4 | 100 | ✅ |
| postcards | CDP3000 | 74 | 1 | 0 | 🟡 비표준 |
| posters | CPR2000 | 67 | 6 | 100 | ✅ |
| banners | CPR5000 | 10 | 24 | 100 | ✅ |
| x-banners | CPR5000 | 10 | 24 | 100 | ✅ |
| rollup-banners | CPR5000 | 10 | 24 | 100 | ✅ |
| mini-banners | CPR5000 | 10 | 24 | 100 | ✅ |
| standard-envelopes | CEV1000 | 0 | 0 | 0 | ❌ 무응답 |
| admin-envelopes | CEV1000 | 0 | 0 | 0 | ❌ 무응답 |
| gusset-envelopes | CEV1000 | 0 | 0 | 0 | ❌ 무응답 |
| receipts | CNR2000 | 12 | 11 | 0 | 🟡 비표준 |
| quotation-forms | CNR2000 | 12 | 11 | 0 | 🟡 비표준 |
| invoice-forms | CNR2000 | 12 | 11 | 0 | 🟡 비표준 |
| ncr-forms | CNR2000 | 12 | 11 | 0 | 🟡 비표준 |
| wall-calendars | CCD1000 | 17 | 22 | 100 | ✅ |
| desk-calendars | CCD2000 | 9 | 4 | 100 | ✅ |
| mini-calendars | CCD2000 | 9 | 4 | 100 | ✅ |

### ❌ 표준 estimate 엔드포인트 0응답 (별도 가격경로 필요 — 카테고리 코드는 유효)
엔드포인트는 200 응답하나 paper_info=0. 봉투(CEV1000)는 print_info2/3/4·paper_extra_cost 등 별도 estimate 구조 사용 → 우리 자동 가격/발주 경로 미커버. 매핑 오류 아님.
- **standard-envelopes** (CEV1000): 표준 paper_info 0건
- **admin-envelopes** (CEV1000): 표준 paper_info 0건
- **gusset-envelopes** (CEV1000): 표준 paper_info 0건

### 🟡 비표준 가격구조 (용지는 수신되나 print_info1 비어있음 — 별도 조사)
스티커·라벨·봉투·양식·일부 카테고리는 표준 인쇄 매트릭스 대신 면적/롤/세트 기반 가격을 쓸 수 있음. 우리 가격경로가 print_info1 에 의존하는지 카테고리별 확인 필요.
- **stickers** (CST1000): 용지 11, 사이즈 0
- **die-cut-stickers** (CST2000): 용지 11, 사이즈 0
- **holographic-stickers** (CST5000): 용지 9, 사이즈 4
- **roll-stickers** (CST7000): 용지 1, 사이즈 1
- **price-labels** (CLP1000): 용지 11, 사이즈 1
- **barcode-labels** (CLP1000): 용지 11, 사이즈 1
- **food-labels** (CLP1000): 용지 11, 사이즈 1
- **flyers** (CLF1000): 용지 9, 사이즈 8
- **postcards** (CDP3000): 용지 74, 사이즈 1
- **receipts** (CNR2000): 용지 12, 사이즈 11
- **quotation-forms** (CNR2000): 용지 12, 사이즈 11
- **invoice-forms** (CNR2000): 용지 12, 사이즈 11
- **ncr-forms** (CNR2000): 용지 12, 사이즈 11

## 2) 후가공 자동반영 파리티
발주 시 고객 후가공 선택이 성원 폼에 자동 반영되는지 분류.
- **자동발주(mapped)**: 박, 형압, 도무송, 타공, 넘버링
- **런타임추출(runtime)**: 귀도리, 에폭시, 오시, 미싱 — 사이즈 선택 후 JS 동적, 발주 러너 런타임 추출 필요
- **미감사(needs_audit)**: 코팅, 별색, 접착, 문어발, 제본, 복권, 창문 — ⚠️ 자동 반영 미보장, 수동 처리/추가 조사 필요

## 남은 검증 (수동/E2E)
- [ ] 옵션 선택연동 E2E: 에디터에서 용지/사이즈/수량 선택 → 가격 갱신 (per 카테고리 샘플)
- [ ] 테스트 주문 3건 → 고객주문 스샷 ↔ 성원 발주 스샷 대조 (OrderVerificationPanel 활용)