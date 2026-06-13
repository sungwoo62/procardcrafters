# 성원(swadpia) CATEGORY_MAP 잔여 정정 — 라이브 전수 검증 (OMO-3097)

> OMO-3095 후속. 단일출처 audit `docs/swadpia/swadpia_mapping_audit_OMO-3095.md`(printing-site, commit cb94a1b)의
> `?격자확인`/공란/미취급 항목을 성원 라이브 endpoint(`POST /estimate/estimate_goods/json_data`, category_code별
> `paper_info` 격자) 로 전수 덤프하여 확정. **추정 매핑 금지 게이트 준수** — 모든 코드는 2026-06-13 라이브 응답 근거.

## ⚠️ audit(OMO-3095) 결론을 라이브가 뒤집은 2건

### 1. `CNC8000` 은 실재한다 (audit "없음/깨진 라우팅" = 오류)
- 라이브: `CNC8000` → `paper_info` **9종**(아르미 울트라화이트 230/310g, 아쿠아사틴256g, 인버코트350g, 스노우지백색300g, 반누보화이트204/250g, 반누보스노우화이트227g, 랑데뷰내츄럴310g).
- 신뢰성 대조: 존재하지 않는 코드 `ZZZ9999` → `paper_info` **0종**. 즉 9종 반환은 실재 카테고리 증거.
- 단, CNC8000 격자에 **펄지 없음**. 펄 용지 `다이니티 골드펄 250g` 는 `CNC2000`(고급지명함)에만 존재.
- → **`pearl-business-cards`: CNC8000 → CNC2000** 로 정정(깨짐 수리가 아니라 제품-격자 정합 정정).

### 2. 대형 배너는 성원 미취급이 아니다 (audit "미취급" = 오류, CPR↔CRP 오타)
- 기존 `banners/x/rollup → CPR5000`. 라이브 `CPR5000` = **종이홀더**(모조지·아트지 등) — 배너 아님.
- 라이브 `CRP`(C**R**P, 기존 코드의 CPR 오타) 계열 실재:
  - `CRP5100` → **현수막 150denier**
  - `CRP4000` → 페트 210µ (배너/거치형)
  - `CRP3000` → 페트 210µ + 메쉬 1000denier
  - `COD1100` → 종이미니배너 (블랑/스타드림/랑데뷰 등 6종)
- → `banners→CRP5100`, `x-banners·rollup-banners→CRP4000`, `mini-banners→COD1100` 정정. (KNOWN_MISMATCH의 OMO-2636 힌트와 일치)

## 라이브 격자 확정표 (공란 채움 / B)
| 우리 slug | 확정 코드 | 라이브 격자 근거(발췌) |
|---|---|---|
| transparent-stickers | CST1000 | 재단형 · 투명데드롱 25 |
| kraft-stickers | CST1000 | 재단형 · 크라프트 57g |
| eco-stickers | CST1000 | 재단형 · 모조지 80g |
| invitation-cards | CVS1000 | 초대장/상품권 일반 · 스노우지 250/300g (에폭시형=CVS6000) |
| wedding-cards | CDP2000 | 디지털청첩장/초대장 · 52종 용지 |
| greeting-cards-general | CCM2000 | 디자인연하장 · 디자인 30종 (연하장=CCM4000) |
| memo-pads-general | CNR3000 | 떡메모지 · 매직칼라/모조지 13종 |
| sticky-notes | CPS7000 | 사각포스트잇 · 모조지 80/100g (모양=CPS7100) |
| general/corrugated/gift/cake/tube-boxes | CHI3000 | 판지/박스 · 양면마닐라·메탈팩보드 32종 (디지털소량=CDP1600) |
| paper-shopping-bags | CPK4000 | 일반쇼핑백 · 15종 |
| kraft-bags | CPK3000 | 손잡이쇼핑백 · 9종 |
| gift-bags | CPK2000 | 리본&브레이드 쇼핑백 · 15종 |

## 명함(A) 라이브 재확인 — 유지 결정
| slug | 코드 | 라이브 격자 | 결정 |
|---|---|---|---|
| premium-foil-cards | CNC3000 | 카드명함 · Luxury 화이트/실버/골드 200μ (메탈·포일 스톡 실재) | 유지 |
| uv-business-cards | CNC6000 | 디지털박/에폭시명함 · 11종 (특수후가공 명함 최적군) | 유지 |
| letterpress-business-cards | CNC4000 | 하이브리드명함 · 아트지 백색 300g 단일 (활판 전용 격자 부재 → 최근접) | 유지 |
| pearl-business-cards | CNC2000 | 고급지명함 · 다이니티 골드펄 250g | **정정**(←CNC8000) |

## 미취급 명시 (C) — 공란≠미취급 구분 (리포트 SWADPIA_UNSUPPORTED)
- `hangtag-cards`: 성원 택 전용 카테고리/격자 부재
- `paper-pop`, `foam-pop`: 성원 POP 카테고리 부재 — 타공장
- `general-notebooks`, `spring-notebooks`, `diaries`: 대량 노트/다이어리 성원 미취급 — 타공장

## 영향 범위
- `CATEGORY_MAP` 은 가격조회(`swadpia.ts`) + 자동발주 라우팅(`swadpia-order.ts` `SWADPIA_GOODS_MAP` 이 파생)의 단일 소스 → 본 정정은 표시버그가 아니라 **실라우팅 정정**.
- 매핑 수 38 → 54종. 신규 12 slug 연동 + 배너 4 정정 + 펄 1 정정.
- `SWADPIA_CATEGORY_LABEL` 에 CST3000·CRP5100/4000/3000·COD1100·CVS1000/6000·CCM2000/4000·CDP2000·CNR3000·CPS7000/7100·CHI3000·CDP1600·CPK2000~5000 라벨 추가(누락이 공란 원인이던 것 해소).

> 라이브 덤프 원본 응답은 OMO-3097 작업 세션 `/tmp/sw_*.json` (2026-06-13). 재현: `POST {SWADPIA_BASE}/estimate/estimate_goods/json_data` body `t={epoch}&product=name&category_code={code}`.
