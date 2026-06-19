# OMO-3488 — 후가공 surcharge 비명함 카테고리 라이브 검증 (계획·도구)

부모: OMO-3483 전수검사. surcharge(공급가) 모델의 **비명함 카테고리 유효성** 검증.

## 검증 대상 모델 (현행 `src/config/finishing-surcharge.ts`)
| finishing | 모델 | 기대 amt(명함 CNC1000 기준) | hidden 필드 |
|---|---|---|---|
| foil_stamp(박) | 면적 | ₩22,300 @50×30mm → ratePerMm2 ≈ 14.8667 | `bak_amt` |
| deboss_emboss(형압) | 면적 | ₩22,300 @50×30mm | `ap_amt` |
| die_cut(도무송) | 정액 | ₩21,500 | `domusong_amt` |
| drilled_hole(타공) | 정액 | ₩3,800 | `tagong_amt` |
| round_corner(귀도리) | 정액 | ₩3,000 (OMO-3485) | `guidori_amt` |
| epoxy(에폭시) | 정액 | ₩22,500 (OMO-3485) | `epoxy_amt` |
| score_crease(오시) | 정액 | ₩7,000 (OMO-3485) | `osi_amt` |
| perforation(미싱) | 정액 | ₩7,000 (OMO-3485) | `missing_amt` |

위 값은 **명함 CNC1000(1,000매)에서만 라이브 검증**됨(OMO-2647/2961/3485). 비명함 미검증.

## 검증 대상 카테고리 (allcat-summary.json 2026-06-12 기준 실재 코드)
| code | label | goods | 지원 surcharge 후가공 |
|---|---|---|---|
| CST1000 | 스티커 | GST1001 | bak |
| CLF1000 | 전단 | GLF1001 | ap, bak, domusong, tagong, epoxy, osi, missing |
| CPR4000 | 책자 | GPR4001 | ap, bak, domusong, epoxy, guidori, osi |
| CPR5000 | 배너 | GPR5001 | ap, bak, domusong, epoxy |
| CNC1000 | 명함(control) | GNC1001 | 전체 |

goods_code = `'G' + code.slice(1,-1) + '1'` (swadpia.ts `swadpiaGoodsCode`).

## 도구
`scripts/omo3488-noncard-surcharge.mjs` — omo2647 검증 경로를 카테고리 일반화.
- 후가공 필드 선호코드(명함 검증값)를 설정, **카테고리별 코드 상이 시 첫 유효옵션 fallback**.
- hidden `{type}_amt` + `pay_amt` 델타 + `total_price` 직독(화면 추론 금지).
- 결제 직전 dry-run, 제출/파일업로드 없음(실발주 금지).

### 실행
```bash
# 사전: .env.local 에 SWADPIA_USERNAME / SWADPIA_PASSWORD (READ-ONLY dry-run 계정)
#       npx playwright install chromium
node scripts/omo3488-noncard-surcharge.mjs
# → scripts/test-artifacts/omo3488/noncard-surcharge.json
```

## parity 게이트 (판정 로직)
카테고리×후가공별로:
- **결정론 게이트(드리프트 차단)**: `amt ≈ payDelta`(hidden amt 가 실제 가격영향과 일치). 불일치 → `DRIFT` = 적재 차단.
- **모델 parity**: `amt ≈ expected(명함값)` → `MATCH`. 벗어나면 `DIVERGE` + 카테고리 계수 `coefficient = amt / expected` 산출.
- 면적모델은 카테고리별 `ratePerMm2 = amt / 1500`(@50×30) 도출 → 구간단가 여부 판정.

## 결과 → 적재 정책
1. 전부 `MATCH` → 현행 단일 단가가 비명함에도 유효. 문서 한계문구만 갱신(보드 게이트 불필요, 가격 무변).
2. 일부 `DIVERGE` → `finishing-surcharge.ts` 에 카테고리별 계수(`categoryCoefficients`) 도입.
   라이브 고객가를 바꾸므로 **보드 승인 게이트**(컷오버) 필요. parity 큰 이동은 보드 확인 카드로 상신.
3. `DRIFT` 건은 적재 금지(데이터 신뢰 불가) → 재조사.

## 상태 (2026-06-19 갱신)
- **크레덴셜 차단 해소**: 보드(OMO-643)가 `SWADPIA_USERNAME`/`SWADPIA_PASSWORD` 를 Vercel env + 로컬 `.env.local` 에 주입 완료.
- **라이브 실행 통합**: 비명함 라이브 검증은 박-RE 동일방식의 **OMO-3511**(성원 후가공 가격공식 면밀 RE)로 통합되어, 본 검증도구를 재사용한다. 따라서 OMO-3488 은 OMO-3511 에 first-class blocked.
- **도구 커버리지**: 박/형압/도무송/타공 + 귀도리/에폭시/오시/미싱 + **넘버링(SAMPLED, 현행 미적재라 expected=null 비교없이 표집)** — OMO-3511 RE 전 항목 포함.
- OMO-3511 완료(라이브 데이터 적재) 시 본 이슈는 MATCH(문서갱신) / DIVERGE(카테고리계수 도입 — 보드 컷오버) 판정·적재로 마무리한다.
