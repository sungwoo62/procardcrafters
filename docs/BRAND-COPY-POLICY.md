# 브랜드 카피 정책 — 고객 노출 카피에 타사/모회사 브랜드명 금지

> 보드 지시 (OMO-2975, 2026-06-12, local-board). **위반 시 빌드 실패.**

## 규칙

ProCardCrafters 고객 노출 카피(홈·제품·견적·메타데이터·OG·광고 랜딩, `src/app`·`src/components`)에는
**모회사·타사 브랜드명을 절대 표기하지 않는다.**

- ❌ 금지: `Powered by Sungwon Adpia`, `Sungwon Adpia`, `Sungwon`, `Adpia`, `성원애드피아` 등
- ✅ 허용: 브랜드 미명시 중립 카피 — 상업용 인쇄품질, 투명 가격, 3–5일 턴어라운드, 전세계 배송, 보안 결제 등 **검증 가능한 자사 운영 사실**.

### 배경
- OMO-2970 옵션1(모회사 실적을 `Sungwon Adpia` provenance로 분리표기)을 한 번 적용했으나,
  보드가 **"타사 이름 들어가는 건 절대 안 된다"**며 전면 거부.
- 동시에 회사정책상 **가짜 stat/평점/후기 금지**(주문 ~29·delivered 0·리뷰 0 → 출처불명 합산 수치·별점·조작 후기 0건).
- `AggregateRating` JSON-LD 는 **실 리뷰 0인 동안 출력 금지**(OMO-2971/2974 정합).

## 강제 메커니즘 (3중 고정)

1. **환경변수** — 금지어 목록을 `NEXT_PUBLIC_FORBIDDEN_BRAND_MENTIONS`(쉼표 구분)로 관리.
   - 위치: `.env.local`(로컬), `.env.production`(런타임), `.env.local.example`(커밋 템플릿), **Vercel Production env**.
   - 미설정 시 `src/lib/brandGuard.ts` 의 `DEFAULT_FORBIDDEN_BRAND_MENTIONS` 사용.
2. **코드 가드** — `src/lib/brandGuard.ts`
   - `findForbiddenBrandMentions(text)` / `assertNoForbiddenBrandMentions(text)` 로 카피 생성·렌더 파이프라인에서 차단.
3. **테스트(빌드 게이트)** — `src/lib/__tests__/brandGuard.test.ts`
   - `npm test`(vitest) 가 `src/app`·`src/components` 전수 스캔 → 금지어 발견 시 **실패**.

## 새 금지어 추가 절차
1. `NEXT_PUBLIC_FORBIDDEN_BRAND_MENTIONS` 에 용어 추가(모든 env + Vercel).
2. `DEFAULT_FORBIDDEN_BRAND_MENTIONS`(`brandGuard.ts`)에도 추가(env 미설정 환경 대비).
3. `npm test` 로 위반 0건 확인.

## 관련
- 회사정책: 가짜후기/stat 금지, OMO-2760(내부 임계값·과장 수치 노출 금지), OMO-2381, OMO-2383.
- 배포: 프로덕션 반영은 OMO-2849(자동배포 복구) 게이트.
