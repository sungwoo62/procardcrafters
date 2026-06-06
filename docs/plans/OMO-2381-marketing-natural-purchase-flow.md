# OMO-2381 — procardcrafters 자연 구매 흐름 + Meta Ads 자동개선 + 제품 이미지 판정

**상태**: 보드 승인 대기
**합성 방법**: 6 마케팅 렌즈 × 46 전술 → 3 시각(skeptic/brand_legal/conversion_truth) 138회 적대적 검증 → 우선순위 15 추출
**워크플로우**: 145 subagents, 19분

---

## 1. 자연 구매 흐름 (7 단계)

| # | Stage | 풀어야 할 마찰 | 적용 전술 ID | 성공 지표 |
|---|---|---|---|---|
| 1 | Landing/Awareness (Home·Category) | Generic VP, 빈 social proof, 사실 근거 없는 trust badge | COPY-01, TRUST-03, COPY-02, TRUST-01 | Home→PDP CTR, bounce |
| 2 | Consideration (PDP) | 옵션 가격 불투명, 도착일 부재, generic trust badge | CRO-1, CRO-4, COPY-03, BEH-01, BEH-06, TRUST-05 | PDP→AddToCart |
| 3 | Design/Editor | 비로그인 진척 손실, sticky CTA 부재 | CRO-6 | Editor→AddToCart, draft resume |
| 4 | Cart/Checkout | 가입강제 의심, 할인코드 hunt 이탈, 시안 약속 없음 | CRO-5, COPY-04, BEH-03, BEH-04 | Cart→Checkout→Paid |
| 5 | Email Capture/Exit | Exit 시 영구손실 | CRO-3, BEH-02, EMAIL-W1, EMAIL-INFRA | Capture→30d 1st order |
| 6 | Post-Purchase | Buyer's remorse, 시안 anxiety, FedEx 분실 | COPY-06, EMAIL-PP1, EMAIL-PP2 | NPS, review, photo 동의 |
| 7 | Repeat/Advocacy | 재주문 마찰, 침묵 후 영구이탈 | EMAIL-RO, EMAIL-CA1/2, EMAIL-WB180, TRUST-04 | 60d reorder, 120d winback |

**자연 흐름의 핵심 원칙 — "Truth Consistency"**: 홈에서 본 약속(예: "2영업일 제작")이 PDP·체크아웃·confirmation 이메일·송장 추적 페이지에서 동일 수치로 표시되도록 강제. 단계 간 약속이 깨지는 순간 자연 흐름이 끊긴다.

---

## 2. 우선순위 15 전술 (자식 이슈 후보)

| # | ID | Title | Specialty | Size | Blockers |
|---|---|---|---|---|---|
| 1 | META-001 | Add fbclid/utm cols to print_orders + print_meta_ads_insights_daily migration | backend | S | — |
| 2 | META-003 | Capture fbclid/fbp/utm on landing → propagate to print_orders + event_id | fullstack | M | META-001 |
| 3 | META-002 | Daily Meta Insights API ingestion cron (campaign+adset level) | backend | M | META-001 |
| 4 | COPY-06 | Rewrite /order/success + confirmation email with real prod/ETD + reorder CTA | fullstack | M | — |
| 5 | COPY-04 | Checkout 결제버튼 total + "proof email within 2 biz hours" microcopy | frontend | S | — |
| 6 | CRO-1 | PDP mobile sticky CTA (state-aware: 디자인하기 vs 장바구니) | frontend | M | — |
| 7 | EMAIL-INFRA | Email V1 — SPF/DKIM/DMARC split + Resend webhook → suppression + 1-click unsub | backend | M | — |
| 8 | EMAIL-PP1 | Order confirmation email with timeline + FedEx + proof-change CTA | backend | S | EMAIL-INFRA |
| 9 | EMAIL-CA1 | Cart abandonment email #1 (2-3h delay, no discount) + /checkout?resume= | fullstack | M | EMAIL-INFRA |
| 10 | BEH-02 | Footer + checkout sidebar email capture (10% first-order, unique-per-email) | fullstack | M | EMAIL-INFRA, EMAIL-W1 |
| 11 | EMAIL-W1 | Welcome email #1 — unique coupon + 1-line proof/FedEx/file-check promises | backend | S | EMAIL-INFRA |
| 12 | CRO-4 | PDP trust+ETD stack — "Production: 2 biz days · FedEx: 2-5 days to {country}" | frontend | S | — |
| 13 | TRUST-03 | /about lifetime counter (orders, countries) from print_lifetime_stats view | fullstack | S | — |
| 14 | EMAIL-PP2 | print_reviews table + post-purchase review email (delivered+48h) | fullstack | M | EMAIL-INFRA |
| 15 | META-009 | Half-day product+hand-model shoot (6 SKU × 3 hand × 9:16/1:1/4:5) | marketing | M | — |

**합리적 시퀀스**: META-001 → (META-002, META-003) 병렬 → EMAIL-INFRA → (EMAIL-PP1, EMAIL-W1, EMAIL-CA1) 병렬 → BEH-02 → (COPY-04, COPY-06, CRO-1, CRO-4, TRUST-03) 병렬 → EMAIL-PP2 → META-009

---

## 3. Meta Ads 자동개선 루틴 (closed loop)

### 데이터 레이어
- **prefix 규칙 준수**: `print_meta_ads_*` (CLAUDE.md 공유 DB 규칙)
- Phase 1: `print_orders`에 컬럼 추가(fbclid/fbp/fbc/gclid/utm_*/landing_*) + `print_meta_ads_insights_daily` 생성 (campaign+adset+ad level, attribution_window 1d_click/7d_click 별 row, raw_payload JSONB)
- Phase 2 (spend $3k/mo + 50 purchases/wk 도달 후): `print_meta_ads_creative_snapshots`, `print_meta_ads_attribution_recon_daily`, `print_meta_ads_actions_queue`

### Ingestion Cron
- Paperclip routine 매일 21:00 UTC (KST 06:00) + 14:00 UTC 보정 run
- 어제 + 최근 7일 upsert, 월 1회 28일 full rewrite
- 실패 3회 재시도 → 그래도 실패 시 Paperclip 이슈 자동 생성

### Weekly Digest Email
- 매주 월 KST 10:00 → founder + marketing owner
- 도메인 `tx.omoongmoo.com` (transactional 분리)
- Lean 컨텐츠: topline 1줄 + recon delta + 최대 3 pending decisions + 1 open question
- 4주 연속 미열람 시 자동 일시정지

### Auto-Optimize Rules
| Tier | 액션 | 트리거 | 모드 |
|---|---|---|---|
| 1 | 예산 -15% (adset) | 7d spend >= $300 AND 14d CPA > target × 1.5, 계정 일일 변경 합계 25% 한도 | Auto |
| 1 | 예산 +scale | (현재 비활성화 — Meta CBO/Advantage+ 위임) | Observation only |
| 2 | Pause 추천 | CPA > target × 2.0 AND 3d 연속 spend >= $200 | Human 24h SLA |
| 2 | Creative refresh | frequency > 3.5 AND CTR < (전7d × 0.7) → ad-creative skill 2 variant 자동 생성, 라이브는 사람 승인 | Human |
| 2 | Budget scale | ROAS > target × 2.0 AND frequency < 1.5 AND 5d 연속 → +30~50% | Human |
| 3 | Campaign/audience/bid/conversion 변경 | — | 절대 자동화 금지 |

**Kill switch**: `META_AUTOMATION_ENABLED=false` env 한 줄로 모든 자동 write 중지. 4주 retro에서 Tier 1 precision <80% 또는 reverted_at rate >10% 시 룰 자동 비활성화.

### Manual Approval Gates
- Ad/Adset pause
- 신규 creative 라이브 (backlog 큐잉만 자동)
- Budget scale > +20% 또는 weekly +30%
- Audience/Lookalike 생성·수정
- Bid strategy / conversion event 변경
- 신규 campaign 런치
- Recon drift 7일 연속 ±25% 초과 시 자동 액션 전체 freeze
- 월간 5% experimental angle bucket 활성화

### Creative Rotation (현재 규모 lean)
- 1 campaign · 1-2 adset · 6 active creative max
- 한 번에 한 변수 (Angle: 가격/스피드/품질 OR Hook: 숫자/before-after)
- ad-creative skill로 2주마다 2 variant → backlog → 사람 승인 → 라이브
- 평가: 신규 ad 최소 50 link clicks AND $200 spend 도달 후
- Winner 후보: ROAS > campaign 평균 × 1.2
- Refresh trigger: frequency > 2.8 OR CPM 21d MA +25% OR CTR -25% (가장 빠른 것)
- 모든 creative에 `creative_source = ai | real_photo | ai_extended` 태그
- Spend > $10k/mo + 200 orders/mo 도달 시 full Angle×Hook×Format 매트릭스 확장

---

## 4. 제품 이미지 — 판정: **needs_improvement**

### 현재 상태
- OMO-2314 hero+4 angle 갤러리 + mega menu 4-col thumbnail grid → **PDP 브라우징은 충분**
- Meta Ads thumbnail (1:1, 4:5, 9:16) / carousel / UGC hand-held video는 **부재**
- → 광고 입구 thumb-stop rate 낮을 가능성 (자연 흐름 첫 1초의 약점)

### 권장 액션 (Week 1-4)
1. **Week 1**: 반나절 product+hand-model 실촬영 1회 — 6 핵심 SKU × 3 hand model × 9:16/1:1/4:5 raw 자산. 명함 개봉/사용/교환 시퀀스 포함.
2. **Week 2-3**: image skill로 실촬영 자산 기반 배경/씬 variation 확장 (cafe, office, meeting). **AI single-handed 생성 금지**. `creative_source = real_photo | ai_extended` 태그.
3. **Week 2-4**: AI mockup도 1:1/4:5 정적컷 한정 동시 생성. 실촬영 vs AI vs AI-extended **3-way thumb-stop / hook rate 측정**.
4. **Week 4 decision gate**: AI mockup CTR < 실촬영 × 0.7이면 즉시 매트릭스 제외하고 예산 재배분. AI-extended가 가장 높은 ROI일 가능성 큼.
5. PDP "실사용 photo wall" 모듈(TRUST-04) 시드로도 활용.

### AI 이미지 학습 (LoRA/fine-tune) 판정: **현 단계 ROI 없음**
1. **Training set 부족** — SKU당 30-50장 일관 reference 필요. 현재 hero+4 angle만으론 부족하고, 그 수집 자체가 실촬영 선행이 필요.
2. **ROI mismatch** — fine-tune은 product accuracy를 주지만 광고 thumb-stop은 "진짜 사람 손에 들린 authenticity"가 만듦. LoRA로 해결 불가.
3. **Brand consistency 대안 존재** — 색감(brand palette + tonemap LUT) + 타이포 + 레이아웃 grid만 강제해도 80% 컨시스턴시.

**재평가 트리거**: 월 spend $5k 이상 OR 검증된 winning angle 3개 이상 확보. 그 전 LoRA 투자는 premature optimization.

---

## 5. Killed / Modified 전술 요약

**Killed 0건** (모두 챌린저 통과) — 단, 다음은 "modify via challenge"로 사실상 원안 폐기:

1. 라이브 social proof ticker (COPY-02 / CRO-2 / TRUST-02): 트래픽 임계치 미달 — **lifetime counter (TRUST-03)로 대체**, ticker는 Phase 2 deferral
2. 가짜 deadline·urgency (COPY-05 'we will clear Friday', BEH-04 'capacity full'): **honest framing으로 rewriting**
3. Exit-intent popup mobile (CRO-3 / BEH-02): mobile beforeunload 신뢰성 낮음 → **desktop only**, 모바일은 sticky footer로 우회
4. Loss-aversion 강압 카피 (BEH-01 'You will lose: X'): **중립 비교 프레이밍으로 교체**
5. Magic-link return, 풀 referral program, Trustpilot API sync, Meta Tier 1 auto-scale, 7-toggle preference center: **traffic/spend gate 뒤로 연기**
6. GDPR/PIPA 미준수 mechanic (소도시 노출, 사전동의 없는 마케팅 이메일, fbclid 무동의 캡처): **consent gate 추가** 또는 city→country fallback

**결론**: 원안 그대로 ship 가능한 surviving tactic은 거의 없음 — 모두 챌린저 수정 거쳐야 ship.

---

## 6. 다음 액션

1. 보드가 `suggest_tasks` interaction에서 우선순위 픽업 선택
2. 픽업 시 자동 생성된 자식 이슈를 즉시 PATCH로 assignee/priority/blockers 채움 (OMO-1256 unowned drift 방지)
3. META-001 → META-002 → META-003 → EMAIL-INFRA가 가장 먼저 가도록 dependency 강제
4. META-009(촬영)은 spec/모델 섭외 board 결정 필요 → 별도 RFI 코멘트로 분리
