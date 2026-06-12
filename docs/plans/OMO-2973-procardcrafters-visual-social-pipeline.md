# OMO-2973 — ProCardCrafters 비주얼 SNS 콘텐츠 자동화 파이프라인 (C3)

작성 2026-06-12 · Media 담당 · 부모 [OMO-2970](/OMO/issues/OMO-2970) 플랜 #3 · 선결 [OMO-2971](/OMO/issues/OMO-2971) `done`(랜딩 인프라)

> 목적: 프리미엄 인쇄의 비주얼 강점("오묘하게 만족스러운" 마감)을 인스타·틱톡·**핀터레스트**로 양산하고,
> 핀터레스트 핀을 **직업별 니치 랜딩페이지로 환류**시켜 미국 명함 디자인 검색 트래픽(낮은 CAC)을 전환으로 잇는다.

이 문서는 채널 셋업 + 콘텐츠 필러 + 핀→랜딩 링크 구조 + 반복 생산 루틴(사람 승인 게이트)을 정의한다.
실제 첫 2주 배치는 동봉 산출물 참조:
- `docs/social/OMO-2973-week1-2-content-batch.md` — IG/TikTok 캡션·해시태그·에셋 브리프 14일치
- `docs/social/OMO-2973-pinterest-pins-batch1.csv` — 핀터레스트 벌크업로드 CSV(핀→랜딩 매핑)

---

## 0. 선결 인프라(OMO-2971 실배포 확인)

핀의 목적지가 실재함을 검증함(`origin/main` 머지 완료):
- 라우트: `src/app/business-cards/for/[profession]/page.tsx` + 인덱스 `for/page.tsx`
- 라이브 시드 직업 2종:
  - `https://procardcrafters.com/business-cards/for/realtors`
  - `https://procardcrafters.com/business-cards/for/photographers`
  - 마감 인덱스: `https://procardcrafters.com/business-cards/for`
- 확장: `src/lib/niche/professions.ts` SEED 추가(PR) **또는** Supabase `print_niche_pages` row 발행(코드배포 불필요) → C2([OMO-2972](/OMO/issues/OMO-2972)) 콘텐츠가 직업을 늘릴 때마다 핀 타깃도 자동 증가.
- 프리미엄 마감 6종(`src/lib/niche/finishes.ts`): `foil-stamping` · `letterpress` · `painted-edges` · `spot-uv` · `textured-stock` · `nfc-smart`.

> 핀 링크 구조는 위 URL 컨벤션에 1:1로 고정한다. C2가 직업을 추가하면 동일 패턴으로 핀을 양산한다.

---

## 1. 가드레일 (필수 — 모든 에셋·캡션에 적용)

| # | 규칙 | 근거 |
|---|------|------|
| G1 | **AI 합성 "우리 공장/직원/인쇄기" 절대 금지.** 추상 종이·잉크·마감 텍스처, 실제 제품 촬영, 에디터 실제 렌더만 허용. | 회사정책 [[ai-factory-footage-blocked]], OMO-2381 |
| G2 | 대외 게시는 **사람 승인 게이트** 경유. 자동 직접 발송/예약 발행 금지. | OMO-1908 |
| G3 | **가짜 후기·가짜 stat·실시간 ticker 금지.** "10,000+ orders/4.9★" 류 미검증 수치 캡션 금지. | OMO-2760, 신뢰게이트 OMO-2975 |
| G4 | 고객 노출 전화번호 금지. CTA는 랜딩페이지 링크/견적·디자인 시작. | OMO-2760 |
| G5 | 내부 임계값(수량 임계 등) 표면 노출 금지. | 회사 코어 |

에셋 분류 태그(미디어 라이브러리 메타데이터에 필수 기록):
- `source:real-capture` (실촬영 영상/매크로) · `source:editor-render` (제품 실렌더) · `source:abstract-texture` (추상 종이·잉크·포일 텍스처) · `source:licensed-stock` (라이선스 스톡, 출처 기록)
- ❌ 금지 태그가 필요한 합성물(공장/직원/장비 사칭)은 **생성·업로드 자체를 하지 않는다.**

---

## 2. 채널 셋업

### 2.1 핀터레스트 (1순위 — 검색 트래픽·낮은 CAC·랜딩 환류)
- 비즈니스 계정 + **Claimed website** `procardcrafters.com`(Rich Pins/도메인 신뢰).
- 보드 구조(검색 의도 = 보드명):
  | 보드 | slug | 의도 |
  |------|------|------|
  | Realtor Business Cards | `realtor-business-cards` | 직업 검색 → `/for/realtors` |
  | Photographer Business Cards | `photographer-business-cards` | 직업 검색 → `/for/photographers` |
  | Foil & Metallic Business Cards | `foil-business-cards` | 마감 검색 → `/for` (foil) |
  | Painted Edge Cards | `painted-edge-business-cards` | 마감 검색 → `/for` (edges) |
  | Letterpress & Textured Cards | `letterpress-business-cards` | 마감 검색 → `/for` (letterpress/texture) |
  | NFC / QR Smart Cards | `nfc-smart-business-cards` | 신기능 검색 → `/for` (nfc) |
  | Business Card Design Ideas | `business-card-design-ideas` | 광범위 상단퍼널 → `/for` |
- 모든 핀은 **destination link = 직업/마감 랜딩 URL**(아래 §4). 핀 = 영구 SEO 자산(핀터레스트는 검색엔진).

### 2.2 인스타그램 (브랜드 빌드 + 릴스)
- 비즈니스 프로필. 링크인바이오 = `/business-cards/for`(마감 허브). 직업 캠페인 주간엔 해당 `/for/{직업}`으로 스왑.
- 포맷: 릴스(포일/언박싱/마감 클로즈업) + 캐러셀(교육: "What is a painted edge card?").

### 2.3 틱톡 (숏폼 도달 — "oddly satisfying")
- 비즈니스 계정. 바이오 링크 = 마감 허브. ASMR/oddly-satisfying 결로 도달 극대화.
- IG 릴스와 동일 소스 영상 리퍼포징(9:16).

> 셋업 자체(계정 생성·도메인 클레임·보드 생성)는 **사람 운영 작업**이다. 본 문서는 보드/링크 구조를 규정하고, 계정 핸들·자산 URL이 확정되면 CSV의 `Pinterest board`/`Media URL` 컬럼이 채워진다(승인 게이트).

---

## 3. 콘텐츠 필러 ("오묘하게 만족스러운" 6축)

| 필러 | 결 | 주 채널 | 에셋 소스 | 가드 |
|------|----|---------|-----------|------|
| P1 포일 스트라이크 | 포일이 눌리는 순간 클로즈업 | TikTok/Reels | `real-capture` | 실 마감 촬영 필요 |
| P2 언박싱 | 카드 묶음 개봉·정렬 ASMR | TikTok/Reels | `real-capture` | 실 제품 촬영 |
| P3 마감 매크로 | 스팟UV/페인티드엣지/레터프레스/텍스처 접사 | Pinterest/Reels | `real-capture` 또는 `abstract-texture` | 합성 장비 금지 |
| P4 직업 맥락 | "당신이 건네는 카드"(리얼터/포토그래퍼 손에) | Pinterest | `licensed-stock` 또는 `editor-render` | 인물=라이선스/연출, 공장 사칭 금지 |
| P5 디자인 아이디어 | 에디터 실제 템플릿 렌더 카드 | Pinterest/IG | `editor-render` | 실제 제품 렌더만 |
| P6 교육 캐러셀 | "NFC 카드란?" "페인티드 엣지란?" | IG/Pinterest | `editor-render`+`abstract-texture` | 정직 설명, 과장 stat 금지 |

> **Ready-now vs Needs-capture:** P5/P6와 P3의 추상-텍스처 변형은 에디터 렌더·텍스처 스틸로 *지금* 생산 가능.
> P1/P2/P3의 실촬영 변형은 **실제 마감 샘플 촬영 소스**가 1급 입력(성원 마감 샘플 생산 의존). 첫 배치는 ready-now를 채우고, 실촬영분은 shotlist 브리프로 대기(§6).

---

## 4. 핀터레스트 핀 → 랜딩 링크 구조 (환류 코어)

규칙: **모든 핀의 destination link는 직업 또는 마감 랜딩이며, UTM으로 채널 귀속.**

```
직업 핀  → https://procardcrafters.com/business-cards/for/{slug}?utm_source=pinterest&utm_medium=social&utm_campaign=niche_{slug}
마감 핀  → https://procardcrafters.com/business-cards/for?utm_source=pinterest&utm_medium=social&utm_campaign=finish_{finishSlug}
허브 핀  → https://procardcrafters.com/business-cards/for?utm_source=pinterest&utm_medium=social&utm_campaign=ideas
```

- `{slug}` = `professions.ts`/`print_niche_pages`의 직업 slug(현재 `realtors`, `photographers`; C2 확장 시 자동 증가).
- `{finishSlug}` = `finishes.ts` 6종.
- UTM은 OMO-2383/2907 전환추적(GTM/GA4)과 호환 — `utm_medium=social`로 유료(`cpc`)와 분리.
- IG/TikTok은 클릭 링크가 1개(링크인바이오)이므로, 직업 캠페인 주에 바이오 링크를 해당 `/for/{slug}`로 스왑하고 동일 UTM(`utm_source=instagram|tiktok`) 적용.

벌크 매핑 실파일: `docs/social/OMO-2973-pinterest-pins-batch1.csv` (핀터레스트 *Bulk create Pins* 스키마).

---

## 5. 사람 승인 게이트 워크플로 (OMO-1908)

```
[Media] 에셋 생성/분류 + 캡션·해시태그·핀 메타 작성(이 배치)
   │  산출물 = 리뷰 가능한 docs/social/* (CSV + 캡션시트)
   ▼
[Content Lead] 리뷰 — 카피 정직성/브랜드/가드레일 체크 → 승인 or 수정요청
   ▼
[사람(사장님 업무계정)] 최종 발행 승인 — 핀터레스트 벌크업로드 / IG·TikTok 게시
   ▼
[Media] 게시 후 에셋 URL·핀 ID를 미디어 라이브러리 메타데이터에 기록(귀속 추적)
```

- **자동 직접 발행 금지.** 본 파이프라인의 자동화 범위 = 캡션/해시태그 AI 보조 생성 + 핀 메타 CSV 양산 + 에셋 분류/업로드. **발행 트리거는 항상 사람.**
- 에셋이 `source:real-capture`를 요구하면, 촬영 소스 확보 전까지 해당 핀은 `Publish date` 공란 + `media_brief`만 채워 대기.

---

## 6. 반복 생산 루틴 제안 (주간 사이클)

| 요일 | 작업 | 담당 | 산출 |
|------|------|------|------|
| 월 | 다음주 직업/마감 테마 선정(C2 신규 랜딩 동기화) | Media←Content | 테마 1직업 + 2마감 |
| 화 | 에셋 생산: ready-now(에디터 렌더·텍스처 매크로) + 실촬영분 shotlist 발주 | Media | 7~10 에셋 |
| 수 | 캡션·해시태그 AI 보조 생성 + 핀 메타 CSV(직업/마감 매핑) | Media | 캡션시트 + CSV |
| 목 | 에셋 분류·메타태깅·Supabase Storage 업로드(WebP, alt텍스트) | Media | 업로드 URL |
| 금 | Content Lead 리뷰 → 사람 발행 승인 게이트 | Content→사람 | 승인배치 |
| (상시) | 게시 후 핀 ID/에셋 URL 라이브러리 기록 + UTM 성과 모니터 | Media | 귀속로그 |

- **AI 보조 범위(허용):** 캡션 변형, 해시태그 후보, 핀 Title/Description SEO 카피, alt 텍스트. → 전부 사람 리뷰 후 발행.
- **AI 금지 범위:** 제품/공장/인물 이미지 합성(G1). 영상은 실촬영 필수.
- 주간 산출 목표(첫 배치 기준): 핀터레스트 12~16핀, IG/TikTok 릴스+캐러셀 7건/주. C2 직업 추가 시 직업당 핀터레스트 3핀(직업1+마감2) 자동 증분.

---

## 7. 완료 기준 대비 (이슈 DoD)

- [x] 채널 셋업 정의 — 핀터레스트 보드 7개 + IG/TikTok 포맷·링크인바이오 규칙(§2)
- [x] 첫 2주 콘텐츠 배치 — `docs/social/OMO-2973-week1-2-content-batch.md`(14일) + `…pinterest-pins-batch1.csv`
- [x] 핀→랜딩 링크 구조 — UTM 포함 URL 컨벤션(§4) + 실 CSV 매핑(라이브 랜딩 2직업·마감6)
- [x] 반복 생산 루틴 제안 — 주간 사이클 + 승인 게이트(§5–6)
- [ ] (사람 게이트) 계정 핸들 확정·도메인 클레임·자산 URL 주입 → 발행 — 운영 승인 대기

## 8. 의존성·핸드오프

- **사람/운영(사장님 업무계정):** 핀터레스트/IG/TikTok 비즈니스 계정 생성·도메인 클레임, 최종 발행 승인. → Media는 트리거 권한 없음(G2).
- **실촬영 소스:** 포일/언박싱/마감 매크로 실영상. 성원 마감 샘플 생산과 연계(미확보 시 ready-now 배치만 즉시 가동).
- **C2([OMO-2972](/OMO/issues/OMO-2972)):** 직업 랜딩 추가 발행 시 핀 타깃 slug 동기화(자동 증분 규칙 §4).
- **전환추적(OMO-2383/2907):** UTM이 GA4/GTM과 호환 — 핀→랜딩→견적/주문 귀속.
