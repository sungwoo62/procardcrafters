-- OMO-2592 [북극성 축2] work-pool 상태전이 영속화
-- Paperclip activity API는 offset/before 무시 + 최근 ~500건만 반환(≈수시간) → 전기간 MTTR/재작업률 산출 불가.
-- 상태전이를 공유DB에 적재해 전기간 지표 계산 토대를 만든다.
-- prefix: ops_ (운영 도메인). 새 Supabase 프로젝트 금지 — 공유DB ilcfemvqommqyoohfoxw에 통합.

create table if not exists public.ops_workpool_transitions (
  id            uuid primary key default gen_random_uuid(),
  -- activity 피드 이벤트 id. 스냅샷이 겹치는 윈도우를 반복 적재해도 중복되지 않도록 유니크 dedup 키.
  activity_id   uuid unique,
  issue_id      uuid not null,
  identifier    text,
  from_status   text,             -- null = 최초 생성(issue.created)
  to_status     text not null,
  at            timestamptz not null,   -- 전이 발생 시각 (activity.createdAt)
  actor_agent_id uuid,
  run_id        uuid,
  ingested_at   timestamptz not null default now()
);

comment on table public.ops_workpool_transitions is
  'OMO-2592 work-pool 상태전이 로그. activity 피드 스냅샷을 적재해 전기간 MTTR/재작업률/재오픈율 산출 토대.';

-- 전기간 지표 계산은 이슈별 시간순 스캔이 핵심 → (issue_id, at) 복합 인덱스.
create index if not exists ops_workpool_transitions_issue_at_idx
  on public.ops_workpool_transitions (issue_id, at);
-- 기간 필터(최근 N일 MTTR 등) 가속.
create index if not exists ops_workpool_transitions_at_idx
  on public.ops_workpool_transitions (at);
-- 상태별 집계(blocked 진입/해소 등) 가속.
create index if not exists ops_workpool_transitions_to_status_idx
  on public.ops_workpool_transitions (to_status);

-- RLS: ops_ 운영 도메인 정책 (ops_project_learnings / ops_health_check_results 와 동일 패턴).
-- 인증 사용자 읽기 허용, 쓰기는 service_role(RLS 우회)만 — 적재 스크립트가 SERVICE_ROLE_KEY로 insert.
alter table public.ops_workpool_transitions enable row level security;

drop policy if exists ops_workpool_transitions_authenticated_select on public.ops_workpool_transitions;
create policy ops_workpool_transitions_authenticated_select
  on public.ops_workpool_transitions
  for select
  to authenticated
  using (true);
