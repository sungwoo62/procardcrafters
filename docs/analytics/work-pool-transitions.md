# work-pool 상태전이 영속화 파이프라인 (OMO-2592 · 북극성 축2)

## 왜 필요한가
Paperclip activity API(`/companies/{id}/activity`)는 `offset`/`before`가 무시되고 항상 최근
**~500건(실측 ≈4.2시간, 평균 119이벤트/h)** 만 반환한다. 따라서 상태전이에 기반한
MTTR·재작업률·재오픈율 같은 지표를 **전기간** 산출하려면 전이를 주기적으로 스냅샷해
공유DB에 누적해야 한다.

## 구성요소

| 요소 | 경로 | 역할 |
|------|------|------|
| 테이블 | `supabase/migrations/20260607000010_ops_workpool_transitions.sql` | 공유DB(`ilcfemvqommqyoohfoxw`) `ops_workpool_transitions`. 전이 1건=1행. |
| 적재 | `scripts/analytics/ingest-workpool-transitions.mjs` | activity 피드 → 전이 추출 → `activity_id` 유니크 dedup upsert (멱등). |
| 소비 | `scripts/analytics/work-pool-dashboard.mjs` | 테이블에서 MTTR/재작업률/재오픈율 계산·출력 (`--json`, `--days N`). |
| 스케줄 | Paperclip routine `67f95f1b-1aa3-46fa-a411-93b582d6748a` | cron `0 */2 * * *` (UTC). 2시간 주기 적재. |

## 테이블 스키마
`id, activity_id(unique dedup), issue_id, identifier, from_status, to_status, at, actor_agent_id, run_id, ingested_at`.
RLS: ops_ 운영 도메인 정책 — 인증 사용자 읽기 / 쓰기는 service_role(적재 스크립트)만.

## 적재 주기가 2시간인 이유 (중요)
피드 시간폭이 ≈4.2시간이므로 "주 1회" 적재는 전이의 ~99%를 유실한다. 2시간 주기는 4.2시간
윈도우에 2배 안전마진을 둔다(버스트 대비). 더 잦게 해도 멱등이라 안전하다.
`PAPERCLIP_API_KEY`는 만료 JWT(≈2일)이므로 standalone host cron으로는 activity API 인증이
불가하다 → 반드시 heartbeat/routine 컨텍스트(harness가 fresh 토큰 주입)에서 실행해야 한다.

## 지표 계산 규칙 (데이터 함정 주의)
activity의 `from_status`(`_previous.status`)는 **누락·stale가 잦다**(예: `blocked`→`done`인데
from이 `in_progress`로 기록). 그래서 모든 지표는 from_status가 아니라 **권위 있는 `to_status`
시퀀스**로 계산한다(이슈별 시간순 스캔):

- **Blocker MTTR**: `to=blocked` 진입 → 다음 `to≠blocked` 전이까지의 구간. 평균/중앙값. 미해소는 별도 집계.
- **재작업률**: 도달했던 최고 활성 랭크(todo<in_progress<in_review<done)보다 낮은 활성 상태로 회귀한 이슈 비율.
- **재오픈율**: `done` 도달 이슈 중, 이후 활성 상태(todo/in_progress/in_review)로 복귀한 이슈 비율.

## 사용법
```bash
node scripts/analytics/ingest-workpool-transitions.mjs           # 적재 (멱등)
node scripts/analytics/ingest-workpool-transitions.mjs --dry-run # 미적재 미리보기
node scripts/analytics/work-pool-dashboard.mjs                   # 전기간 리포트
node scripts/analytics/work-pool-dashboard.mjs --days 7 --json   # 최근 7일 JSON
```
환경변수: Paperclip(`PAPERCLIP_API_URL/COMPANY_ID/API_KEY`, 적재만) · Supabase(`.env.local`의
`NEXT_PUBLIC_SUPABASE_URL`+`SUPABASE_SERVICE_ROLE_KEY`).
