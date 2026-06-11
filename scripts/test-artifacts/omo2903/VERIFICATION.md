# OMO-2903 런칭점검 ① — 옵션연동·후가공 E2E 검증 보고

생성: 2026-06-11 · 검증자: Dev-Print · 부모: OMO-2902(파리티 감사 d34cc60)

## 요약 (verdict)

| 범위 | 방법 | 결과 |
|---|---|---|
| ① 옵션 선택연동 (대표 6종) | 생산 가격경로 DB 감사 | **6/6 ✅** paper/size/qty 가격 이동 정상 |
| ② 후가공 변환 정합성 (9종) | expandFinishingToSwadpiaFields 정적 검증 | **9/9 ✅** mapped 5 확장정상 + runtime 4 스킵정상 |
| ⑤ 비교 웹페이지 | OrderVerificationPanel 재사용 | ✅ `/admin/qa/swadpia-parity` 신설 |
| ③ 테스트주문 3건 + ④ 성원 dry-run 스샷 | Playwright 필요 | ⚠️ 본 환경 미설치 → 로컬 러너 자식 이슈로 위임 |

**중요 아키텍처 발견(런칭 정정):** 이슈 범위가 가정한 `/api/swadpia-price`(실시간 가격
엔드포인트)는 **프론트엔드 어디서도 호출되지 않는다**(라우트 정의만 존재). 실제 고객
가격은 DB 기반이다 — 아래 ① 참조. 따라서 옵션연동 검증은 swadpia 라이브 호출이 아니라
`print_product_options.extra_price_krw` 경로로 수행했다.

---

## ① 옵션 선택연동 — 생산 가격경로 검증

### 가격 공식 (src/lib/pricing.ts · src/app/order/page.tsx)
```
고객가(USD) = (base_price_krw + Σ print_product_options.extra_price_krw) × margin_multiplier × 환율
```
- `base_price_krw`: 상품별 단일 대표값 (sync-prices/cron 이 swadpia `extractBasePrice` 로 동기화)
- `extra_price_krw`: 옵션값(용지/사이즈/수량)별 가산금 — **옵션 선택이 가격을 움직이는 실제 레버**
- `/api/swadpia-price`(calculateSwadpiaPriceKrw): UI 미사용. base_price 동기화 전용 라이브러리 경로.

### DB 감사 결과 (artifact: db-option-linkage-result.json)
| 카테고리 | base₩ | 옵션타입 | 가격이동 옵션 | 판정 |
|---|---|---|---|---|
| 명함 business-cards | 4000 | finishing,paper_code,paper_qty,paper_size,print_color_type | 11 | ✅ |
| 브로슈어 brochures | 64000 | paper_code,paper_qty,paper_size | 9 | ✅ |
| 책자 saddle-stitch-booklet | 64000 | paper_code,paper_qty,paper_size,print_color_type | 6 | ✅ |
| 포스터 posters | 64000 | paper_code,paper_qty,paper_size | 13 | ✅ |
| 배너 banners | 64000 | paper_code,paper_qty,paper_size | 5 | ✅ |
| 캘린더 wall-calendars | 8000 | paper_code,paper_qty,paper_size,print_color_type | 9 | ✅ |

- **수량 연동 정상:** 6종 모두 `paper_qty` 가격이동 옵션 보유(예 명함 ₩0~95k, 캘린더 ₩0~130k).
- 경미 관찰: 명함 `paper_size` 4종 전부 extra=0(명함은 사이즈 무관 가격, 정상 가능). 배너
  `paper_size` 옵션 1종뿐 → 사이즈 가격연동 사실상 없음(런칭 전 의도 확인 권장).

### swadpia 라이브 경로 부가검증 (artifact: option-linkage-result.json)
- 미사용 경로지만 무결성 점검: `calculateSwadpiaPriceKrw` 는 printEntries 가 `paper_code` 를
  보유한 명함류(CNC*)만 수량 티어 매칭(✅). CLF/CPR/CCD 카테고리는 printEntries.paper_code 가
  비어 lookupPrintCost=null → 용지단가 폴백 → **수량 무반응**. UI 미연결이라 고객영향 없음이나,
  추후 이 엔드포인트를 에디터에 연결할 경우 copy-count 키 분기 필요.

---

## ② 후가공 자동반영 — 변환 정합성 (artifact: finishing-transform-result.json)

`expandFinishingToSwadpiaFields(고객 selected_options)` → 성원 발주 폼 필드코드. 9종 검증:

| 후가공 | status | 확장 필드 | 판정 |
|---|---|---|---|
| 박 foil_stamp | mapped | bak_section/side/type/compare_1 + bak_x/y_size_1 | ✅ |
| 형압 deboss_emboss | mapped | ap_section/type/compare_1 + ap_x/y_size_1 | ✅ |
| 도무송 die_cut | mapped | domusong_section/type/num | ✅ |
| 타공 drilled_hole | mapped | tagong_num/size | ✅ |
| 넘버링 numbering | mapped | numbering_type/kind | ✅ |
| 귀도리/에폭시/오시/미싱 | runtime | (없음 — 자동발주 스킵) | ✅ |

- mapped 5종: 기본값이 매핑 정의(SWADPIA_FINISHING_FIELDS)의 실제 성원 name 으로만 확장. 미지정 필드 0.
- runtime 4종: DEFAULT 미보유 → 빈 확장(올바른 스킵). 성원 폼은 사이즈 선택 후 JS 로 옵션 채움 → 런타임 추출 필요.
- 복합(박+타공) 병합 ✅ · 명시 override(bak_type_1=BKT11 > 기본 BKT02) ✅
- 면적 의존(박/형압): 기본 50×30mm 채워짐(미입력 시 surcharge=0 방지) ✅
- needs_audit 7종(코팅/별색/접착/문어발/제본/복권/창문): 자동발주 미보장(카테고리별 재조사) — OMO-2902 와 동일.

**실제 폼 자동채움(activateFinishings)** 은 본 변환의 출력을 성원 페이지 select/radio 에 주입하는
런타임 단계로, Playwright dry-run(omo2647)에서 라이브 검증한다 → ④ 위임분.

---

## ⑤ 비교 웹페이지 — `/admin/qa/swadpia-parity`

기존 `OrderVerificationPanel`(OMO-2830) 재사용. 대표 3종(명함/포스터/책자) 테스트 스펙에 대해
고객 selected_options ↔ 우리 발주 options_snapshot(=동일 변환) 좌우 대조 + 스펙/수량/후가공/마진
자동 일치판정. 무브라우저로 "고객선택→성원폼 필드" 매핑 정합성을 증명. 실제 성원 폼 스크린샷은
④ 로컬 러너에서 캡처해 본 페이지 옆에 첨부 예정.

---

## ③④ 미완(위임) — 테스트주문 + 성원 dry-run 스크린샷

- 차단 사유: 본 헤드리스 환경에 **Playwright 미설치** + place-factory-orders/omo2647 러너는
  설계상 로컬/VPS 전용("Vercel serverless 실행 불가"). 성원 폼 스샷·실제 자동채움 캡처 불가.
- 비용가드 준수: 성원 실발주(유료) 금지 — dry-run(결제 직전 정지)만. 본 환경에선 미실행.
- → 자식 이슈로 로컬 Playwright 러너에 위임(아래 이슈 본문 참조).

## 아티팩트
- `option-linkage-result.json` — swadpia 라이브 경로 점검(부가)
- `db-option-linkage-result.json` — 생산 가격경로 옵션연동(주)
- `finishing-transform-result.json` — 후가공 변환 9종
- `option-linkage-raw.log` — 실행 로그
- 스크립트: `scripts/omo2903-{option-linkage-e2e,finishing-transform-verify,db-option-linkage,probe-matrix}.ts`
- 페이지: `src/app/admin/qa/swadpia-parity/page.tsx`
