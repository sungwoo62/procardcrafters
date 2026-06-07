# OMO-2572 — procardcrafters prod 스키마 드리프트 감사 결과

- 대상 DB: 공유 prod `ilcfemvqommqyoohfoxw` (`public` 스키마)
- 감사 일자: 2026-06-07
- 방법: `information_schema` / `pg_catalog` 실재 대조 + `supabase_migrations.schema_migrations` 히스토리 대조 + PostgREST 라이브 스모크

## 요약
마이그레이션 히스토리와 실 스키마가 **양방향으로 불일치**했다. 핵심 발견은 이슈에 적힌 것보다
범위가 컸다 — 프로모션/프로모코드 서브시스템 전체(`20260605000030~000037`)가 **히스토리상 적용으로
기록되어 있으나 실 객체가 부재**했다(런타임 500 잠재). 모두 멱등 복구 + 히스토리 정합화 완료.

## 발견 및 조치

### A. 히스토리상 "적용"이나 실 객체 부재 (ghost-applied) → 정본 마이그레이션 재실행
| 버전 | 객체 | 조치 |
|------|------|------|
| 20260605000030 | `print_promotion_calendar`(+시드) | 재실행 |
| 20260605000031 | `print_promotion_campaigns` | 재실행 |
| 20260605000032 | `print_promotion_products` | 재실행 |
| 20260605000033 | `print_promo_codes` | 재실행 |
| 20260605000034 | `print_promo_code_redemptions` | 재실행 |
| 20260605000035 | `print_products.is_bestseller / margin_pct` | 재실행 |
| 20260605000036 | `print_redeem_promo_code()` 함수 | 재실행 |
| 20260605000037 | `print_orders.promo_discount_usd` | 재실행 |

> 참고: `print_orders.shipping_service_code / _name_en`는 OMO-2567 핫픽스(`20260607000001`)로 선복구됨.

### B. 미적용(local-only) + 실 객체 부재 → 재실행 + 히스토리 추가
| 버전 | 객체 |
|------|------|
| 20260605000050 | `print_promo_abuse_events`, `print_promo_code_lock_history` (circuit breaker) |
| 20260606000001 | `print_promotion_calendar.peak_anchor_month / _day` |
| 20260606000011 | `print_promotion_events` (프로모 funnel) |

### C. 미적용(local-only)이나 실 객체는 이미 존재 → 히스토리만 정합화
`20260605000041`(competitor_prices), `20260606000002`(reviews), `…000003`(coupon_discount_usd/review_coupon_id),
`…000004`(reviews.photos), `…000005`(review-photos storage 버킷), `…000010`(marketing_email),
`…000012`(review_request_infra), `…000020`(social_proof/share), `…000021`(email_subscribers),
`…000030`(all_missing_options 옵션시드) — 모두 실재 확인 후 히스토리 행만 추가.

### D. 중복 버전번호 → 리네이밍 (히스토리 미기록 파일을 신규 버전으로 분리)
| 기존(중복) | 변경 후 | 비고 |
|------------|---------|------|
| 20260603000010_print_swadpia_options_sync | **20260603000012** | 옵션 데이터 이미 존재(재실행 안 함) |
| 20260605000001_print_fedex_pdf_rate_correction | **20260605000042** | carrier_contacts + 2.5kg FedEx PA 할인율 보정 적용 |
| 20260606000003_print_review_helpful | **20260606000006** | 객체 이미 존재 |
| 20260606000030_print_bc_large_qty | **20260606000031** | 옵션시드(ON CONFLICT 멱등) |

리네이밍 후 `supabase migration list --linked` 결과 **Local ↔ Remote 63건 전 항목 일치**(불일치/중복 0).

## 라이브 스모크 (PostgREST, service_role)
복구 대상 테이블 전부 `200`(`print_promotion_*`, `print_promo_*`, `print_carrier_contacts` 등),
`print_orders`의 `promo_discount_usd/coupon_discount_usd/shipping_service_code` 조회 정상,
abuse-event write 경로 insert 정상(테스트행 정리 완료), `print_redeem_promo_code()` 시그니처 callable,
복구 테이블 RLS 정책 전부 존재.

## 후속/주의
- 본 작업은 실 prod 객체를 repo 기준으로 멱등 복구한 것. **repo 마이그레이션 파일 내용은 정본 유지**(중복 4건만 리네이밍).
- 향후 `supabase db push`는 no-op이어야 정상(히스토리 63건 정합).
- ghost-applied 재발 방지를 위해 배포 파이프라인에서 `db push` 실패 시 히스토리 롤백 보장 여부 점검 권장(별도 이슈 후보).
