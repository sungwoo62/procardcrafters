# LEARNINGS — Procardcrafters (project_key: `procardcrafters`)

> **프로젝트 학습원장 (Project Learning Ledger).** 이 프로젝트의 단일 진실 소스다.
> 작업 에이전트는 heartbeat 시작 시 이 파일을 우선 읽는다 (CEO가 `MEMORY.md` 읽는 것과 동일 패턴).
> 구조화·임베딩 미러: Supabase 공유DB `ilcfemvqommqyoohfoxw` · `ops_project_learnings` (`project_key='procardcrafters'`, 활성=`superseded_by IS NULL`).
> 컨벤션: `omoongmoo/docs/learnings/LEARNINGS_CONVENTION.md` (OMO-2578). 설계: OMO-2576. 소비 와이어링: OMO-2580.
>
> **항목 스키마(원자적):** `id` · `db_id`(DB 동기화 후) · `source_type`(issue|board|order|cs|analytics|repo) · `source_ref` · `confidence`(0~1) · `tags` · 본문 1문장. **supersede**: 덮어쓰기 금지, 새 항목 추가 후 옛 항목 `~~취소선~~`+`superseded_by`. **decay**: 주 1회 `confidence*0.95^weeks`(market 빠르게, concept 느리게).

---

## 1. 컨셉·의도층 (Concept) — `layer=concept`

- **`procardcrafters-c001`** · src=board · conf=0.95 · tags=[전략,타겟] — 해외(미국) 타겟 인쇄물 커머스: 명함·청첩장·브로셔 등을 영어 사이트로 판매한다. 모든 페이지는 영어로 제작.
- **`procardcrafters-c002`** · src=board · conf=0.9 · tags=[공급,가격] — 성원애드피아(공급사) 제품을 전량 리스팅하고, 성원 단가에 일정 마진율을 붙여 고시한다. 성원 가격 변동을 하루 1회 확인한다(가격은 성원 페이지 내 JSON 옵션조합 형태).
- **`procardcrafters-c003`** · src=issue · source_ref=OMO-2274/OMO-2275 · conf=0.9 · tags=[주문,발주,결제] — 결정/교정: 주문 수량(quantity)이 1로 하드코딩되던 버그 수정(결제 금액·공장 발주 일치), 에디터→발주 파일이 PNG인데 application/pdf로 거짓 신고되던 문제 수정. 발주 정합성이 P0 리스크 영역.
- **`procardcrafters-c004`** · src=issue · source_ref=OMO-2568~2571 · conf=0.85 · tags=[SEO,콘텐츠] — 결정: 블로그 섹션 신설 + 인쇄 SEO 글 ~50편(본문 이미지·카테고리) 퍼블리싱으로 오가닉 유입 확보 전략.
- **`procardcrafters-c005`** · src=issue · source_ref=OMO-2442/OMO-2562/OMO-2364 · conf=0.8 · tags=[마케팅,런칭] — GTM+Google Ads 전환추적 고도화, 홈/포트폴리오 스톡사진 허위표시 및 next/image 렌더 깨짐 교정, 도메인 procardcrafters.com → Vercel 전환.
- **`procardcrafters-c006`** · db_id=`fa875ece-fc37-4d1d-8f79-d4b8b1151332` · src=issue · source_ref=OMO-2481 · conf=0.85 · tags=[가격,UX,에디터] — OMO-2481 결정: ProductConfigurator에서 각 수량 옵션에 '$0.09/pc -45%' 형식으로 개당 단가+할인율 표시, Price Summary에 'Unit price' 행 추가. 최소수량(최고단가) 대비 할인율 계산, 프로모 수량에도 반영. 직관적 가격 비교가 전환 UX 핵심.
- **`procardcrafters-c007`** · db_id=`da4ff24e-af2c-4e5a-8d8a-a38965f72497` · src=issue · source_ref=OMO-2482 · conf=0.85 · tags=[카피,신뢰성] — OMO-2482 결정: 실제 공급은 글로벌 공장(성원애드피아 등)이므로 'LA distribution center' 같은 미국 로컬 위치 허위 표현을 제거하고 'Global Factory Network / Produced at the optimal factory worldwide'로 통일. 제품·About 페이지 카피 일관성.
- **`procardcrafters-c008`** · db_id=`d02b45f9-3991-4ab1-a484-5a4200187d78` · src=issue · source_ref=OMO-2486 · conf=0.9 · tags=[현지화,영어,주문] — OMO-2486 결정: 해외(미국) 타겟이므로 주문창에서 한글 및 'Exchange rate: 1 KRW ≈ $' 환율 표시 제거. 배송 '추천'→'Recommended', 라벨/설명 폴백을 영어 우선(descriptionEn ?? descriptionKo)으로 전환. 사용자 화면에 KRW·한글 노출 금지.
- **`procardcrafters-c009`** · db_id=`bac13616-fe03-46b8-b485-f839ec10078b` · src=issue · source_ref=OMO-2478 · conf=0.8 · tags=[에디터,템플릿,product] — OMO-2478 결정: 에디터를 일러스트레이터식으로 고도화 — 페이스트보드 24mm(대지 밖 오브젝트도 표시), 줌/팬(Space+드래그, Ctrl +/-/0), 플로팅 정렬툴바. 명함 템플릿은 수기 대신 조합 생성(직군30×레이아웃8×팔레트15=240+)으로 284개 확보. moo.com 스타일 템플릿 브라우저(/templates) 제공.
- **`procardcrafters-c010`** · db_id=`b037de79-e346-4893-8d8c-c883fc592b39` · src=issue · source_ref=OMO-2560 · conf=0.85 · tags=[SEO,sitemap] — OMO-2560 결정: 자연검색 상위노출을 위해 활성 제품 88개 중 하드코딩 5개만 있던 sitemap을 전 제품 등재로 수정, 구조화데이터(JSON-LD) 전무 → 도입(SERP 별점·가격 리치결과). top1-3는 보장 불가(색인→콘텐츠→백링크→시간의 함수)임을 보드와 합의.
- **`procardcrafters-c011`** · db_id=`b44b1094-5a5f-42cb-ac1c-5802c57da5a3` · src=issue · source_ref=OMO-2562 · conf=0.85 · tags=[신뢰성,카피,런칭] — OMO-2562 결정(런칭 게이트1): 홈/포트폴리오 print_portfolio 8건이 전부 Unsplash 스톡+가짜 클라 타이틀인데 'Real work delivered to clients worldwide'로 허위표시 → 'Sample Designs & Finishes'로 카피 정직화. 동시에 next/image remotePatterns 미허용으로 썸네일 8/8 HTTP400 깨짐을 200으로 수정.
- **`procardcrafters-c012`** · src=issue · source_ref=OMO-2582 · conf=0.9 · tags=[전략,런칭,거버넌스] — OMO-2582 CEO 런칭점검(2026-06-07): **NO-GO**. 런칭을 막는 유일 외부의존=[OMO-2574] PayPal 프로덕션이 SANDBOX(런타임 확정)→실결제 불가. 보드가 Live creds 적용하면 보안패치(OMO-2564)+E2E(OMO-2563) 병행으로 반나절~1일 내 GO. 보드 directive로 회사 북극성 '조직 성장+고객 만족도 향상'을 `NEXT_PUBLIC_NORTH_STAR(_PILLARS)` env로 전 프로젝트 적용(`src/lib/northStar.ts`+Vercel+글로벌 CLAUDE.md). 3대축: 업무풀 자동화(OMO-2585)/성과측정·평가(OMO-2586)/마케팅 성과측정·개선(OMO-2587).
- **`procardcrafters-c013`** · src=issue · source_ref=OMO-2587 · conf=0.85 · tags=[마케팅,측정,ROAS,스키마] — OMO-2587(북극성 축3) 결정: 마케팅 `측정→평가→개선` 루프의 **측정 계층**부터 실데이터로 구축. 핵심 통찰 — 채널별 매출기여·ROAS·CPA는 데이터 캡처가 선행돼야 함(없으면 추측). 따라서 ① `print_orders`에 UTM/gclid/fbclid/referrer 귀속 컬럼(additive) ② `print_ad_spend`(채널×캠페인×일자) 테이블 ③ `src/lib/attribution.ts` deriveChannel(신호없으면 direct, 추측금지) ④ `/api/admin/marketing/performance`+`/admin/marketing` 대시보드 출하. 미가용 지표는 notes로 정직 표기. 라이브 baseline: 주문 전량 direct(캡처 wiring 전)·광고비 0(적재 전). 후속 분해: OMO-2594(캡처)·2595(광고비)·2596(A/B+자동최적화)·2597(주간리뷰). PR #8.

## 2. 시장층 (Market) — `layer=market`

> 자동 축적 대기 — 주문(`quotes`/주문 테이블)·CS챗·애널리틱스 신호를 OMO-2579 루틴이 채운다. 추측성 시장 데이터를 임의로 채우지 말 것(verbatim 고객언어·전환수치만).
- **`procardcrafters-m001`** · db_id=`0e56ea0b-9812-46fe-b96e-ec39913d5900` · src=issue · source_ref=OMO-2478,OMO-2481 · conf=0.75 · tags=[경쟁사,벤치마크] — 보드가 제품페이지/에디터/템플릿 브라우저 UX를 moo.com(특히 /us/business-cards/original 및 디자인 템플릿) 기준으로 벤치마킹 지시. 미국 프리미엄 명함 인쇄 시장의 사실상 기준점.
- **`procardcrafters-m002`** · db_id=`88908d0f-b970-4ca3-b63e-8f788bc264aa` · src=issue · source_ref=OMO-2560 · conf=0.8 · tags=[SEO,색인,가시성] — OMO-2560 라이브 확인: 구글에 홈페이지 1개만 색인되고 제품 88개 페이지는 색인 전 → 현재 제품 키워드 순위 자체가 안 잡히는 상태. SEO 토대(sitemap+JSON-LD) 배포 후 색인 진입 대기. 시장 가시성 baseline 신호.


## 3. 암묵지·피드백층 (Tacit) — `layer=tacit`

> 무엇이 통했고 무엇이 실패했나, 함정. 에이전트 간 공유.

- **`procardcrafters-t001`** · src=repo · conf=0.85 · tags=[스택,함정] — Next.js 16은 breaking change가 많다. 코드 작성 전 `node_modules/next/dist/docs/` 해당 가이드를 먼저 읽을 것(repo AGENTS.md 규칙).
- **`procardcrafters-t002`** · src=issue · source_ref=OMO-2274/OMO-2275 · conf=0.8 · tags=[함정,발주] — "주문 수량/파일 MIME" 같은 발주 파이프라인 정합성은 결제·공장 발주에 직접 영향 → 변경 시 수량·파일포맷 end-to-end 검증 필수.
- **`procardcrafters-t003`** · db_id=`cefe49d6-5d96-4d21-a1f0-44e15b551065` · src=issue · source_ref=OMO-2478,OMO-2481,OMO-2482 · conf=0.9 · tags=[배포,Vercel,함정] — OMO-2478/2481/2482 반복 발생: 로컬 커밋만 쌓이고 origin/main push를 안 해 라이브에 반영 안 됨(한 번은 10개 커밋이 로컬에만 존재). 보드의 강한 불만 유발. 교훈: 작업 완료 즉시 push + Vercel 배포 검증까지가 'done'. 미배포 상태로 완료 보고 금지.
- **`procardcrafters-t004`** · db_id=`05bc87a7-32e6-4b7d-8785-fe052f0b8014` · src=issue · source_ref=OMO-2482 · conf=0.8 · tags=[배포,Vercel] — OMO-2482: Vercel 자동 배포가 구버전 코드로 빌드돼 있어 변경이 라이브에 안 보이던 사례. `vercel --prod`로 현재 코드 기준 강제 재배포하면 해결. push='Everything up-to-date'여도 라이브 확인 필요.
- **`procardcrafters-t005`** · db_id=`53246df8-5791-4dc2-a687-2b9be1410f40` · src=board_comment · source_ref=OMO-2481,OMO-2482 · conf=0.8 · tags=[보드,운영,피드백] — 보드는 push 직후 즉시 라이브를 확인하는 경향 → 배포 반영(1~2분) 전 '확인해달라'고 하면 '안 보인다' 불만. 작업 에이전트는 배포 완료·라이브 검증까지 마친 뒤 보고할 것. 배포 지연 말고 완성 즉시 배포가 명시적 보드 지시.
- **`procardcrafters-t006`** · db_id=`59624cd5-2c20-4b01-9b7b-f70b40b75829` · src=issue · source_ref=OMO-2551 · conf=0.85 · tags=[GTM,함정,추적] — OMO-2551: GTM 컨테이너 JSON import 시 trigger/tag ID가 'T_view_item' 같은 문자열이면 '형식이 잘못됨' 거부. 전부 숫자 ID로 교체해야 함. Google Ads 전환 태그 conversionId도 숫자 필수 → 실제 AW ID 없으면 Ads 태그 3개를 import에서 분리.
- **`procardcrafters-t007`** · db_id=`2fd3b508-caea-4cb8-8ff1-f03466af0864` · src=issue · source_ref=OMO-2551 · conf=0.85 · tags=[GTM,배포,함정] — OMO-2551: 로컬 .env.local에만 NEXT_PUBLIC_GTM_ID 설정 시 라이브 사이트 HTML에 GTM 미주입(GA4만 로드, GTM 없음). Vercel Production env에 NEXT_PUBLIC_GTM_ID 주입 + 재배포해야 라이브에서 GTM 태그 감지됨.
- **`procardcrafters-t008`** · db_id=`e2bbfb7c-6b1c-4c74-9d2a-2a66eb956afb` · src=issue · source_ref=OMO-2571 · conf=0.8 · tags=[배포,worktree,안전] — OMO-2571: 공유 워킹트리에서 동시 체크아웃 시 잘못된 브랜치가 배포될 race 위험 → /tmp 격리 git worktree(detached)에 .vercel 복사 후 `vercel --prod --yes`로 배포, fix는 main에도 반영. 동시 작업 환경에서 배포 격리 패턴.
- **`procardcrafters-t009`** · db_id=`a218088a-a5b6-4b18-92b2-8cdaeb71df2b` · src=issue · source_ref=OMO-2442 · conf=0.8 · tags=[인수인계,검증,함정] — OMO-2442: 이전 담당자(MacBook-Worker, 이후 terminate)가 보고한 변경(layout GTM·표준 이벤트·PurchaseTracker)이 실제 코드베이스에 부재했고 참조 경로 자체가 리포에 없었음. 재배정 받으면 이전 보고를 신뢰하지 말고 코드 실측 후 처음부터 구현.
- **`procardcrafters-t010`** · src=issue · source_ref=OMO-2582,OMO-2564 · conf=0.85 · tags=[블로커,함정,런칭] — 함정: 결제 capture 보안 결함(금액·주문 바인딩/멱등성/쿠폰 소각 시점)은 **PayPal sandbox/live와 무관한 순수 코드 결함**인데 OMO-2564가 OMO-2574(Live creds, 보드액션)에 잘못 blocked로 묶여 임계경로를 직렬화시켰음. 교훈: blocker는 진짜 의존성일 때만 걸 것 — 코드 결함을 외부 creds에 묶으면 보드 대기 동안 에이전트가 할 수 있는 일이 멈춘다(unowned drift). CEO가 잘못된 의존 끊고 병렬화.
- **`procardcrafters-t011`** · src=issue · source_ref=OMO-2582,OMO-2609,OMO-2611 · conf=0.9 · tags=[Resend,이메일,DNS,함정,런칭] — 확인메일 미작동의 2중 원인: ① `RESEND_API_KEY`는 `.env.local`/prod env/git엔 없고 **shell env(`re_Q…`)에만** 존재(키 헌팅 시 shell env/.zshrc 필수 확인). ② 키가 있어도 `procardcrafters.com` **Resend 발신 도메인 미검증(`not_started`)**이면 발신 거부. 해결: Resend `GET /domains/{id}` 요구 레코드(DKIM `resend._domainkey` TXT + SPF `send` MX `feedback-smtp.ap-northeast-1.amazonses.com` + SPF `send` TXT `v=spf1 include:amazonses.com ~all`)를 **Vercel DNS(권한 NS)** 에 `vercel dns add`로 추가 → `POST /domains/{id}/verify`(`not_started→pending→verified`). 도메인 id=13a3ca81-…, Resend region ap-northeast-1. 전부 에이전트 자가수행(Vercel/Resend 둘 다 접근 가능).
- **`procardcrafters-t011`** · src=issue · source_ref=OMO-2586 · conf=0.85 · tags=[애널리틱스,API,함정] — OMO-2586: 조직 성과측정 시 Paperclip activity API(`/companies/{id}/activity`)는 `offset`·`before`가 **무시**되고 항상 최근 ~500건(≈수시간)만 반환 → MTTR·재작업률 등 상태전이 기반 지표는 전기간 산출 불가(영속화 OMO-2592 필요). 회피: 이슈 타임스탬프(`createdAt`/`completedAt`/`startedAt`)로 throughput·완료율·리드타임·적체는 전기간 정확. 회사 이슈 전수는 `/companies/{id}/issues?limit&offset`로 offset 페이지네이션됨(총 2125건). 산출물: `scripts/analytics/work-pool-dashboard.mjs` + `docs/analytics/work-pool-eval-criteria.md`.
