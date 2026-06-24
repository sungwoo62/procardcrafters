# OMO-3764 — 프로카드 인스타그램 콘텐츠 자동화 키트

> **목표(보드 지시):** 인스타 콘텐츠 **하루 2건** 자동 발행 + 첫 1건 즉시 발행.
> **북극성 정렬:** 마케팅 성과측정·개선 / 고객 만족도 향상 (OMO-2582).

## 핵심 원칙 — 왜 "완전 무인 자동발행"이 아닌가
대외 채널(고객 노출) 발행은 회사 정책상 **사람 승인 게이트 필수**다.
- **OMO-1908** 외부 발송 게이트: 고객 대상 자동 직접 발송 금지 → 사장님 업무 계정/승인 경유.
- **OMO-2760 / OMO-3444:** 대외 콘텐츠는 사람 승인 게이트, 가짜 후기 금지, 내부 임계값(수량 200/500 등) 카피 노출 금지.

→ 그래서 본 키트는 OMO-2907(구글광고 키트)과 동일 패턴이다: **자동화는 "초안 생성 + 스케줄 + 발행 메커니즘"까지, 발행 스위치(`IG_AUTO_PUBLISH`)는 기본 OFF, `status:"approved"` 항목만 발행.** 승인은 사람(보드)이 큐에서 한다.

## 파이프라인 구성
| 파일 | 역할 |
|------|------|
| `scripts/instagram/content-queue.json` | 콘텐츠 큐. `draft → approved → published` 상태머신. 단일 진실원천. |
| `scripts/instagram/omo3764-ig-publish.mjs` | Meta Graph API 발행기. dry-run 기본, `IG_AUTO_PUBLISH=1`+`approved`만 실제 발행, 실행당 `IG_MAX_PER_RUN`(기본 1)건. |

## 발행 메커니즘 (Meta Graph API — IG Content Publishing)
1. `POST /{IG_USER_ID}/media` (`image_url` + `caption`) → `creation_id`
2. `POST /{IG_USER_ID}/media_publish` (`creation_id`) → 발행
- **요구 자산:** 페이스북 페이지에 연결된 IG **비즈니스** 계정.
- **요구 권한:** `instagram_content_publish`, `pages_read_engagement`, `business_management`.
- **요구 env** (`.env.local`, gitignored): `IG_USER_ID`, `IG_GRAPH_TOKEN`(장기 페이지 토큰). 미설정 시 발행 단계에서 차단.
- **이미지 호스팅:** `image_url`은 공개 접근 URL이어야 함 → `print_products.hero_image_url` 또는 Supabase Storage 사용.

## 하루 2건 스케줄
런처(크론)는 **09:00 / 18:00 (US Eastern, 타깃 시장)** 각 1건 발행:
```
0 13 * * *  IG_AUTO_PUBLISH=1 node scripts/instagram/omo3764-ig-publish.mjs   # 09:00 ET ≈ 13:00 UTC
0 22 * * *  IG_AUTO_PUBLISH=1 node scripts/instagram/omo3764-ig-publish.mjs   # 18:00 ET ≈ 22:00 UTC
```
※ Paperclip 루틴 또는 Vercel Cron으로 운영. **`IG_AUTO_PUBLISH=1`은 보드가 자격 제공 + 운영 승인한 뒤에만 켠다.**

## 콘텐츠 필러 로테이션 (2/일 = 14/주, 다양성 보장)
1. **Product spotlight** — 명함/스티커/포스터 등 제품·피니시 클로즈업
2. **Use-case / audience** — 창업자·프리랜서·이벤트 등 타깃 시나리오
3. **Material / finish education** — soft-touch matte vs foil vs spot UV 차이
4. **Quality / behind-the-scenes** — 인증 생산시설·FedEx 글로벌 배송
5. **Offer / CTA** — "초 단위 정확 견적 + 전세계 배송" (가격 임계값 노출 금지)
6. **Social proof** — **실제·승인된** 고객 사례만. 가짜 후기 절대 금지.

## 첫 게시물 초안 (omo3764-001 · 즉시 발행 후보)
- **필러:** product_spotlight
- **캡션:**
  > Your card is the handshake that stays in their pocket. 🤝
  >
  > Premium business cards — soft-touch matte, high-gloss, and real foil — printed at certified global facilities and delivered worldwide via FedEx.
  >
  > Configure yours and see your exact price in seconds. Link in bio. 🔗
- **해시태그:** #businesscards #printondemand #smallbusiness #branding #entrepreneur #graphicdesign #stationery #luxuryprint #foilcards #startup #freelancer #networking
- **첫 댓글:** ✨ Worldwide FedEx delivery · certified print facilities · exact USD pricing up front.
- **이미지:** 프리미엄 명함 클로즈업(45도, 손에 든 구도). **보드가 실제 제품사진 URL 제공** 또는 `print_products.hero_image_url` 지정 필요.
- **정책 체크:** ✅ 전화번호 미노출 ✅ 내부 수량 임계값 미노출 ✅ 가짜 후기 없음 ✅ 긍정 프레이밍.

## 보드 승인 체크리스트 (이게 풀리면 자동화 가동)
- [ ] **첫 게시물 omo3764-001 발행 승인** (캡션 OK? 이미지 URL 제공)
- [ ] **Meta Graph 자격 제공:** IG 비즈니스 계정 연결 + `IG_USER_ID` + 장기 `IG_GRAPH_TOKEN`
- [ ] 09:00/18:00 ET 2건/일 스케줄 승인 → `IG_AUTO_PUBLISH=1` 활성화 + 크론 등록
- [ ] 일일 콘텐츠 초안 생성 루프(CEO가 큐에 draft 적재 → 보드 승인) 운영 합의

## 현재 차단 사유 (CEO가 직접 풀 수 없음)
1. **Meta Graph 자격 부재** — IG 비즈니스 토큰/계정 ID는 보드 자산. 발행 불가.
2. **승인 게이트** — 대외 콘텐츠 발행은 정책상 보드 승인 필수(OMO-1908/2760/3444).
→ 두 게이트는 **보드 결정 항목**이지 작업 미완이 아니다. 키트·파이프라인·첫 초안은 완성되어 승인 즉시 발행 가능 상태.
