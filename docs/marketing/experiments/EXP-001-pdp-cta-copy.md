# EXP-001 · PDP 1차 CTA 카피 A/B (OMO-2610)

프레임워크: OMO-2596 / 실험 key: `pdp_cta_copy`

## 가설
PDP 우측 구성기의 1차 CTA 카피를 **기능 서술형("Design Online")**에서
**혜택·행동 유도형("Start Your Free Design")**으로 바꾸면, 방문자가 디자인 에디터로
진입하는 비율(클릭률)이 높아진다. 온라인 디자인 도구가 **무료**라는 점을 카피에서
명시해 진입 장벽을 낮추는 것이 핵심.

## 정의
| 항목 | 값 | 근거 |
|------|-----|------|
| surface | `product_page` (PDP 구성기) | 전환 퍼널 최상단, 트래픽 집중 |
| goal_metric | **ctr** (CTA 클릭/노출) | CTA 카피는 *클릭 의사결정*에 직접 작용 → 같은 화면에서 귀속 가능·잡음 적음·빠른 신호. CVR은 결제/가격 등 하류 요인에 오염되어 카피 효과 분리가 어려움 |
| min_sample_per_variant | 200 | CTR은 이벤트율이 높아 200 노출/변형으로 초기 신호 확보 |
| confidence_level | 0.95 | 표준 |
| auto_promote | true | 유의 승자 발견 시 cron이 자동 채택 |
| max_runtime_days | 30 | 미결 시 최고 성과 자동 종료 |

## 변형
| key | is_control | ctaLabel |
|-----|-----------|----------|
| control | ✅ | `Design Online` (현행) |
| benefit | | `Start Your Free Design` (혜택형) |

가중치 1:1 (균등 배정). 세션 sticky 배정으로 새로고침/재방문 일관성 유지.

## 계측 (wiring)
`src/components/ProductConfigurator.tsx`
- 마운트 시 `assignVariant('pdp_cta_copy')` → 배정 변형의 `config.ctaLabel` 로 1차 CTA 렌더
- 배정 직후 `trackImpression` 1회
- 1차 CTA 클릭 시 `trackClick`
- 미배정/오류/실험 비활성 시 현행 카피("Design Online") 폴백 — UX 무중단

## 운영
- 성과 확인: `GET /api/admin/marketing/experiments?status=running`
- 자동 채택: `GET /api/cron/optimize-experiments` (일 1회) — 게이트(min_sample + 0.95 유의) 통과 시 승자 채택, 패자 변형 `is_active=false`
- 시드: `supabase/seeds/20260607_exp_pdp_cta_copy.sql` (멱등)

## 다음 실험 후보 (백로그)
1. 히어로 가격표시 방식 A/B (goal: rpv) — "from $X" vs 수량별 단가 강조
2. PDP CTA 카피 — *전환(cvr)* 기준 후속 실험 (주문 성공 페이지 conversion 계측 추가 필요)
3. 1차 CTA 색상/아이콘 A/B
