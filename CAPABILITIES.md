---
schemaVersion: 1
service: procard
serviceType: us_pod
score: 100
lastCommit: 10f085f
lastCommitDate: 2026-06-18T18:16:19+09:00
capabilities:
  quote_pdf: present
  consent_signature: present
  phone_removal_cta: na
  ai_chatbot: present
  reviews: present
  reorder: present
  payment_pg: present
  jeju_shipping: na
  north_star_env: present
  supabase_rls: present
  seo: present
  admin_backend: present
---

# procard 고도화 현황 (자동생성 · 직접수정 금지)

**serviceType:** us_pod · **고도화 점수:** 100% · **기준 커밋:** 10f085f (2026-06-18T18:16:19+09:00)

| 항목 | 상태 | 근거 | 비고 |
|---|:--:|---|---|
| 견적PDF | ✅ | src/lib/quote-consent-pdf.ts |  |
| 동의+자필서명 | ✅ | src/components/SignaturePad.tsx |  |
| 전화제거+콜백 | N/A | - | us_pod 전화 허용(미국 고객 콜센터) |
| AI챗봇 | ✅ | src/components/ChatWidget.tsx |  |
| 후기/리뷰 | ✅ | src/components/ProductReviews.tsx |  |
| 재주문 | ✅ | src/components/ReorderButton.tsx |  |
| 결제/PG | ✅ | src/lib/paypal.ts | PayPal(미국 결제) |
| 제주배송 | N/A | - | us_pod 국내배송 해당없음(FedEx ETD) |
| NorthStar env | ✅ | .env.local NEXT_PUBLIC_NORTH_STAR |  |
| prefix+RLS | ✅ | supabase/migrations |  |
| SEO | ✅ | src/app/sitemap.ts |  |
| 어드민백엔드 | ✅ | src/app/admin |  |

> 갱신: 기능 출시 시 `capabilities.config.json` 수정 → 커밋/푸시하면 본 문서 자동 재생성(pre-push hook).
> 최근 변경 파일(HEAD~1..HEAD): src/lib/__tests__/fedex-merge.test.ts, src/lib/fedex-api.ts, src/lib/shipping.ts
