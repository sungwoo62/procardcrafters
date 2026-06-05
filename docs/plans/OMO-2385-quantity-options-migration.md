# OMO-2385 — 수량 옵션 마이그레이션 (전단지 / 포스터 / 기타 카테고리)

## 보드 원문

> 전단지 최소 2000매 너무 높음 → 500/1000 추가, 포스터 250 시작도 100/250로 재검토.

## 전제

- 가격 산정은 `lookupSwadpiaCost`(≥quantity 검색) + DB `extra_price_krw` 폴백.
- [OMO-2384](/OMO/issues/OMO-2384) 에서 "동일가격 프로모션 배지"가 이미 노출 — 새 소량 옵션이 Swadpia 최소수량과 동일가격이어도 UX 정상 (배지로 표기).
- `paper_qty` 옵션값은 기존 주문 `print_order_items.quantity` 와 FK 관계 없음 → 추가/삭제는 호환 깨짐 없음.
- 결제 URL · 이메일 템플릿에 quantity 직접 포함 안 됨 → 링크 깨짐 없음.

## 현행 vs 제안 매트릭스

| Slug | Swadpia 카테고리 | 현재 paper_qty | 제안 paper_qty | 변경 사유 | 동일가격 배지 자동 노출 |
|------|------------------|----------------|-----------------|-----------|------------------------|
| **flyers** | CLF1000 | 2000 / 4000 / 8000 / 12000 | **500 / 1000 / 2000 / 4000 / 8000** | 보드 지시. 2000 진입장벽 완화. | 500·1000 은 Swadpia 매트릭스 없음 → DB 폴백 동일가격 → [OMO-2384] 배지 자동 |
| **posters** | CPR2000 | 250 / 500 / 1000 / 1500 / 2000 | **100 / 250 / 500 / 1000 / 2000** | 보드 지시. 1500 제거(중간단계 무의미). | 100·250 동일가격 가능성 — 배지 자동 |
| stickers | CST1000 | 500 / 1000 / 2000 / 3000 | (옵션 A) 변경 없음<br>(옵션 B) 100 / 200 / 500 / 1000 / 2000 / 3000 | A: Swadpia 최소 500 → 100/200 발주 시 재단 손실 비효율<br>B: 소량 트라이얼 고객 흡수 효과 | B 선택 시 100·200 배지 |
| die-cut-stickers | CST2000 | 100 / 200 / 500 / 1000 | 변경 없음 | 이미 100 시작 — 양호 | — |
| postcards | CDP3000 | 100 / 200 / 300 / 400 / 500 | 변경 없음 | 100 시작 + 100 단위 — 양호 | — |
| brochures | CLF2000 | 1000 / 2000 / 4000 / 6000 | (옵션 A) 변경 없음<br>(옵션 B) 500 / 1000 / 2000 / 4000 | A: 브로셔는 통상 1000+ 캠페인용<br>B: 소량 사내 인쇄 흡수 | B 선택 시 500 배지 |
| banners | CPR5000 | 1 / 2 / 3 / 5 / 10 | 변경 없음 | 1장부터 — 양호 | — |
| eco-stickers | (Swadpia 미연동) | 100 / 500 / 1000 / 2000 | 변경 없음 | 100 시작 — 양호 | — |
| business-cards | CNC1000 | 100 / 200 / 500 / 1000 / 2000 | 변경 없음 ([OMO-2384] 완료) | 100·200 = 500 동일가격 → 배지로 처리 | 자동 |
| premium-business-cards | CNC2000 | 200 / 500 / 1000 | 변경 없음 ([OMO-2384] 완료) | — | — |

## 보드 결정 필요 (3개 옵션)

> 권장 기본값은 ✅ — 별다른 지시 없이 Accept 하면 이 조합으로 진행.
> 다른 조합을 원하시면 Reject + 사유에 "Q1=B, Q2=B, Q3=다음 PR" 같이 적어주시면 재작성.

### Q1. 스티커 (stickers) 최소수량
- ✅ **A. 변경 없음 (500 유지)** — Swadpia 발주 최소수량 정합성 우선, 시안 출력 손실 회피
- B. 100/200 추가 — 소량 트라이얼 고객 흡수 (동일가격 배지로 마진 보호)

### Q2. 브로셔 (brochures) 최소수량
- ✅ **A. 변경 없음 (1000 유지)** — 캠페인용 포지셔닝 유지, 1000 단가가 이미 합리적 진입가
- B. 500 추가 — 사내·소규모 행사용 흡수

### Q3. 마이그레이션 시점
- ✅ **즉시** — 보드 지시 사항, 지연 사유 없음
- 다음 PR과 함께 — 다음 카탈로그 정비 시 묶음 배포

### 권장 최종 변경 (Accept 시)
- flyers: 2000/4000/8000/12000 → **500/1000/2000/4000/8000** (보드 지시)
- posters: 250/500/1000/1500/2000 → **100/250/500/1000/2000** (보드 지시)
- stickers / brochures / 기타: 변경 없음

## 실행 계획 (승인 후)

1. SQL 마이그레이션 작성: `supabase/migrations/202606XXXXXXXX_print_quantity_options_rebalance.sql`
   - flyers / posters 필수
   - stickers / brochures: Q1/Q2 결과에 따라
   - 기존 row UPDATE + 신규 row INSERT (ON CONFLICT DO NOTHING)
   - 제거된 옵션은 `DELETE FROM print_product_options WHERE product_id=... AND option_type='paper_qty' AND value IN (...)` (e.g. posters 1500, flyers 12000)
2. `extra_price_krw` 재계산: 최소수량 옵션을 base 로 두고 상위 옵션 차액 재정렬
3. `/products/[slug]` 페이지 시각 확인 — 동일가격 배지 노출 검증
4. 변경 카테고리에 대해 sitemap.xml 재생성 트리거 (Next.js ISR)
5. 회귀 테스트: 기존 주문 1건 reorder 시 quantity 옵션 표시 정상

## 영향도 / 리스크

| 항목 | 평가 |
|------|------|
| 기존 주문 호환성 | ✅ FK 없음 — 안전 |
| URL / 이메일 깨짐 | ✅ quantity 직접 노출 없음 |
| SEO | ⚠️ 옵션값 변경 → product page 의 schema.org Offer 변동 가능 — Google 재크롤 1~2주 |
| 매출 영향 | 🟢 양(+) — 소량 진입장벽 완화 → 신규 고객 conversion ↑ |
| 마진 영향 | 🟡 동일가격 발주 시 마진 ↓ — [OMO-2384] 배지가 자연스러운 upsell 유도 |
| Swadpia 발주 정합 | ✅ `lookupSwadpiaCost` 가 최소수량 fallback 이미 처리 |

## 변경 파일 (승인 후)

- `supabase/migrations/202606XXXXXXXX_print_quantity_options_rebalance.sql` (신규)
- (필요 시) `src/components/ProductConfigurator.tsx` — 동일가격 배지 임계값 fine-tuning

## 블로커

- **보드 승인 — Q1 / Q2 / Q3 답변** (수량 옵션 변경은 비즈니스 의사결정 영역)

## 참고

- 1차 조치 PR: commit `0fe9aa9` (OMO-2384)
- 분석 문서: `docs/plans/OMO-2384-quantity-options-audit.md`
- 관련 마이그레이션: `supabase/migrations/20260605000010_print_options_swadpia_constraint.sql`
- 관련 파일: `src/components/ProductConfigurator.tsx`
