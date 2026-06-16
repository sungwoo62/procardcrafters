---
schemaVersion: 1
service: procard
serviceType: us_pod
score: 90
lastCommit: 8a996d9
lastCommitDate: 2026-06-17T01:42:37+09:00
capabilities:
  quote_pdf: present
  consent_signature: partial
  phone_removal_cta: na
  ai_chatbot: present
  reviews: present
  reorder: present
  payment_pg: present
  jeju_shipping: na
  north_star_env: present
  supabase_rls: present
  seo: present
  admin_backend: partial
---

# procard 고도화 현황 (자동생성 · 직접수정 금지)

**serviceType:** us_pod · **고도화 점수:** 90% · **기준 커밋:** 8a996d9 (2026-06-17T01:42:37+09:00)

| 항목 | 상태 | 근거 | 비고 |
|---|:--:|---|---|
| 견적PDF | ✅ | - |  |
| 동의+자필서명 | ⚠️ | - |  |
| 전화제거+콜백 | N/A | - |  |
| AI챗봇 | ✅ | - |  |
| 후기/리뷰 | ✅ | - |  |
| 재주문 | ✅ | - |  |
| 결제/PG | ✅ | - |  |
| 제주배송 | N/A | - |  |
| NorthStar env | ✅ | .env.local.example 2종 + Vercel Production/Preview/Development 주입 완료(NEXT_PUBLIC_NORTH_STAR, NEXT_PUBLIC_NORTH_STAR_PILLARS, 표준 절대값) | 전역 North Star 표준값 주입(OMO-3377) |
| prefix+RLS | ✅ | - |  |
| SEO | ✅ | - |  |
| 어드민백엔드 | ⚠️ | - |  |

> 갱신: 기능 출시 시 `capabilities.config.json` 수정 → 커밋/푸시하면 본 문서 자동 재생성(pre-push hook).
> 최근 변경 파일(HEAD~1..HEAD): CAPABILITIES.md, capabilities.config.json, package.json, scripts/gen-capabilities.mjs
