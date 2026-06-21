# OMO-3690 · 광고 실사/AI 이미지 프로덕션 스펙

OMO-3684(Ad Studio) 후속 키작업. `/studio` 컨셉 프레임 60종(IG 30 + 메타광고 30)의 in-browser CSS 목업을
실사 제품촬영 + AI 배경 합성 이미지로 교체한다. **본 문서는 보드 GO 이후 즉시 실행 가능한 프로덕션 런북이다.**

## 0. 현재 상태(이 헤어트비트에 완료된 비차단 작업)
- ✅ `InstagramPost.imageUrl?` 필드 추가(`src/config/adStudio.ts`). 비면 기존 CSS 컨셉 목업 폴백.
- ✅ `CreativeFrame`가 `imageUrl` 적재 시 `object-cover` 실이미지 + 상하 스크림(헤드라인/CTA 가독성) 렌더.
- ✅ backward-compatible: 컨셉 프레임 60종 무손상. **이미지 파이프라인 GO 후 URL만 채우면 즉시 교체.**
- 브랜치: `omo-3690-image-url-plumbing` (commit 7d6d652).

## 1. 입력 SSOT
각 IG 프레임의 `visualDirection`(`src/config/adStudio.ts`)이 비주얼 가이드 = 이미지 생성 프롬프트 시드.
SSOT는 adStudio.ts이며 본 문서는 그것을 중복하지 않는다(드리프트 방지). 생성 시 해당 항목의
`visualDirection` + `productLabel` + `theme`(브랜드 팔레트) + `ratio`를 묶어 프롬프트화.

## 2. 산출물 규격
- 포맷: PNG, RGB, sRGB.
- 비율/해상도: 프레임 native `ratio` 사용. `4:5` = 1080×1350, `1:1` = 1080×1080(메타/IG 권장 업로드 해상도).
- 네이밍: `procard/{IG-id}_{ratio}.png` (예: `procard/IG-01_4x5.png`, `procard/IG-03_1x1.png`).
- 캐러셀/카드뉴스 프레임(format ≠ single, IG-09~16 등): v1은 **hero 1장**만 생성(슬라이드별 이미지는 후속).
- 저장소: Supabase **mkt-uploads (private 버킷)** `procard/` 하위. 공유 DB `ilcfemvqommqyoohfoxw`.
- 참조: `imageUrl`에는 signed URL 또는 서버 프록시 경로 저장(private 버킷이므로 공개 URL 직접노출 금지).

## 3. 대상 인벤토리(IG 30프레임)
| 그룹 | 프레임 | 성격 | 비고 |
|------|--------|------|------|
| 제품 finish 매크로 | IG-01~06 | 단일, 제품 클로즈업 | 실사 제품샷 적합도 최상 |
| 스티커/다이컷 | IG-07,08,16 | 라이프스타일 | AI 합성 또는 실사 |
| 교육형 카드뉴스/캐러셀 | IG-09~15 | 멀티슬라이드 | v1 hero만, 슬라이드 후속 |
| 업종별 유즈케이스 플랫레이 | IG-17~24 | 라이프스타일 합성 | AI 배경 합성 최적 |
| 퍼널/신뢰/공정 | IG-25~30 | 목업·BTS | 일부 UI 목업은 합성 |
> 메타광고 30종(AD-01~30)은 `creativeRef`로 IG 크리에이티브를 재사용 → **신규 이미지 생성 불필요**.
> 즉 v1 생성 대상은 **IG 30프레임**(single 우선, 캐러셀 hero 포함).

## 4. 파이프라인 옵션(보드 GO 대상)
| 옵션 | 도구 | 제품 표현 | 비용(추정) | 비고 |
|------|------|-----------|-----------|------|
| **A (권장)** | nutrabiovis 레시피 = Mac-Studio 로컬 ChatGPT/OpenClaw | AI 생성 제품+배경 | 마진비용≈전기료(0) | 보드 레시피 기검증, 반복 빠름, 외부발송 게이트 무관 |
| B | 보드 지정 외부 생성 API | AI 생성 | ~$0.04–0.08/img × 30 ≈ $1–3 | 도구 보드 지정 시 |
| C | 실사 제품촬영(샘플 명함 촬영) + AI 배경 | 진짜 제품 사진 | 촬영 인력/시간 | 신뢰도 최상, 리드타임 김 |

## 5. 컴플라이언스 가드(필수)
- 가짜 후기/평점/근거불명 stat 금지(OMO-2975) — 이미지에 텍스트 stat 합성 금지.
- 내부 수량 임계값·전화번호 노출 금지(OMO-2760).
- 대외 콘텐츠 사람 승인 게이트(OMO-1908) — 생성물은 보드/사장님 승인 후 라이브.
- 제품 AI 생성은 "실제 인쇄 가능 사양"과 괴리 없도록(과장 foil/불가능 die-cut 금지).

## 6. 실행 절차(GO 이후)
1. IG-01~06 단일 제품샷부터 배치 생성(파이프라인 검증 6장).
2. 보드 1차 승인(품질/브랜드 핏) → 나머지 24프레임 생성.
3. Supabase mkt-uploads `procard/` 업로드(private) + signed URL/프록시 경로 확보.
4. adStudio.ts 각 IG 항목 `imageUrl` 채움 → `/studio`에서 실이미지 렌더 확인.
5. 메타광고 AD-xx는 creativeRef로 자동 반영(추가 작업 무).

## 7. 보드 결정 게이트(BLOCKED ON = 보드)
- ① **이미지 생성 파이프라인 GO**: 옵션 A/B/C 중 택 + 비용 승인.
- ② **제품 표현 승인**: 실사 제품샷(C) vs AI 생성 제품(A/B) 중 택.
