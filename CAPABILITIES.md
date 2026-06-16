---
schemaVersion: 1
service: procard
serviceType: us_pod
score: 80
lastCommit: e390f22
lastCommitDate: 2026-06-16T16:32:11+09:00
capabilities:
  quote_pdf: present
  consent_signature: partial
  phone_removal_cta: na
  ai_chatbot: present
  reviews: present
  reorder: present
  payment_pg: present
  jeju_shipping: na
  north_star_env: absent
  supabase_rls: present
  seo: present
  admin_backend: partial
---

# procard 고도화 현황 (자동생성 · 직접수정 금지)

**serviceType:** us_pod · **고도화 점수:** 80% · **기준 커밋:** e390f22 (2026-06-16T16:32:11+09:00)

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
| NorthStar env | ❌ | - | NEXT_PUBLIC_NORTH_STAR 미설정/부분 — .env.local.example + Vercel 주입 필요(전역 North Star 표준) |
| prefix+RLS | ✅ | - |  |
| SEO | ✅ | - |  |
| 어드민백엔드 | ⚠️ | - |  |

> 갱신: 기능 출시 시 `capabilities.config.json` 수정 → 커밋/푸시하면 본 문서 자동 재생성(pre-push hook).
> 최근 변경 파일(HEAD~1..HEAD): package-lock.json, package.json, public/fonts/NotoSansKR-Bold.otf, public/fonts/NotoSansKR-Regular.otf, scripts/omo3302-korean-quote-smoke.mts, src/lib/quote-pdf.ts
