# PCCF 인바운드 메일 AI 1차 자동회신 (OMO-2774)

ProCardCrafters(`hello@procardcrafters.com`)로 들어온 고객 문의 메일을 받아
AI가 영어 1차 회신 초안을 만들고, **가드레일(첫 N건 승인 모드 + 고관여 에스컬레이션)**
을 거쳐 승인 큐에 넣거나 자동 발송한다.

## 흐름

```
고객 메일 → Resend Inbound webhook → POST /api/support/inbound
   → 멱등성 체크(pccf_support_messages.message_id)
   → 스레드 upsert(pccf_support_threads) + 인바운드 적재
   → 휴리스틱 분류(classify.ts) + AI 초안(ai.ts, Anthropic)
   → 가드레일 판정:
        · 환불/법적/대량/불만 키워드 OR AI needs_human → 에스컬레이션(텔레그램, 승인 큐)
        · 첫 N건(기본 10) 또는 autosend OFF → 승인 큐(/admin/support)
        · autosend ON + 임계 초과 + 비에스컬레이션 → 자동 발송(Resend) + outbound 적재
```

## 구성 파일

| 파일 | 역할 |
|---|---|
| `supabase/migrations/20260609_pccf_support_inbox.sql` | `pccf_support_threads/messages/drafts` 테이블 + RLS |
| `src/lib/support/context.ts` | POD 카탈로그/FAQ 지식 베이스(AI grounding) |
| `src/lib/support/classify.ts` | 고관여 휴리스틱 분류기(결정적 가드레일) |
| `src/lib/support/ai.ts` | Anthropic Messages API 호출(JSON 초안) |
| `src/lib/support/telegram.ts` | 에스컬레이션 알림(allpackmeister_bot) |
| `src/lib/support/inbox.ts` | 파이프라인 오케스트레이션(주입식, 테스트 가능) |
| `src/lib/support/repo.ts` | SupportRepo 의 Supabase(service_role) 구현 |
| `src/app/api/support/inbound/route.ts` | Resend/Postmark 호환 webhook 핸들러 |
| `src/app/admin/support/page.tsx` + `actions.ts` | 승인 큐 UI(승인&발송/반려/종료) |
| `scripts/support-e2e-demo.mts` | 키 없이 전 구간 추적 데모(`npx tsx`) |

## 환경변수 (Vercel Production)

| 변수 | 기본값 | 설명 |
|---|---|---|
| `PCCF_INBOUND_SECRET` | (필수) | webhook 공유 시크릿. 미설정 시 fail-closed(전부 401) |
| `ANTHROPIC_API_KEY` | — | 없으면 AI 초안 생략 → 전부 사람 검토로(안전) |
| `PCCF_SUPPORT_MODEL` | `claude-haiku-4-5` | 초안 생성 모델 |
| `PCCF_SUPPORT_AUTOSEND` | `false` | `true` 일 때만 자동발송 활성(MVP 기본 OFF=전부 승인 큐) |
| `PCCF_SUPPORT_APPROVAL_THRESHOLD` | `10` | 첫 N건은 무조건 승인 큐(오발송 방지) |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_OWNER_CHAT_ID` | — | 에스컬레이션 알림. 없으면 알림만 생략 |
| `RESEND_API_KEY` / `BETA_FROM_EMAIL` | (기존) | 발송(이미 존재, `src/lib/email.ts`) |

## 가드레일

1. **첫 N건 승인 모드**: `pccf_support_drafts` 중 `sent/auto_sent` 누적이
   `PCCF_SUPPORT_APPROVAL_THRESHOLD` 미만이면 autosend 가 켜져 있어도 승인 큐로.
2. **고관여 에스컬레이션**: 환불/chargeback·법적·대량/도매·불만·언론 키워드 →
   AI 판단과 무관하게 사람 검토 + 사장님 텔레그램 알림.
3. **AI 불확실/키 없음**: `needs_human=true` 또는 초안 생성 실패 → 사람 검토.
4. **autosend 마스터 스위치 기본 OFF**: 운영 안정 확인 전까지 전부 사람 승인.
5. **발송 실패 강등**: 자동발송 중 Resend 실패 → draft `failed` + 텔레그램 경보.

## 라이브 배포 시 남은 작업(블로커)

- [ ] Supabase migration `20260609_pccf_support_inbox.sql` 적용(Dashboard/PAT)
- [ ] Resend Inbound 도메인/라우팅 설정 → webhook = `https://procardcrafters.com/api/support/inbound?secret=<PCCF_INBOUND_SECRET>`
- [ ] Vercel env 6종 주입(위 표) + `ANTHROPIC_API_KEY` 발급
- [ ] Telegram `TELEGRAM_OWNER_CHAT_ID` 핸드셰이크(allpackmeister_bot)
- [ ] 테스트 메일 1건 실수신 E2E 확인 후 `PCCF_SUPPORT_AUTOSEND` 단계적 ON

## 측정 (회신율/만족도)

- 회신 SLA: `pccf_support_threads.last_inbound_at` → 첫 outbound `last_outbound_at` 간격.
- 자동화율: `pccf_support_drafts` 중 `auto_sent / (sent+auto_sent)` 비율.
- 에스컬레이션율: `escalate=true` 비율(가드레일 작동 점검).
