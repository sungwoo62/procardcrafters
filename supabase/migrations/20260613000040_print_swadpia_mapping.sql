-- OMO-3058: 성원(swadpia) 제품 맵핑 관리 + 드리프트 모니터링
--
-- 보드가 각 제품 옆에 성원 상품 링크를 직접 붙이면, 시스템이 그 링크를 검증해
-- category_code 를 세팅하고 옵션 핑거프린트를 스냅샷한다. 이후 성원쪽 링크/옵션이
-- 바뀌어 맵핑이 어긋나면(드리프트) drift_log 에 기록 → 보드 보고 + 개선책 제안.
--
-- prefix `print_` (종합인쇄 서비스). RLS: 쓰기는 service_role API 경로 전용.

-- ── 제품별 성원 맵핑 현황 ────────────────────────────────────────────
create table if not exists print_swadpia_mapping (
  slug             text primary key,
  label            text,
  group_key        text,
  -- 보드가 붙인 성원 상품 페이지 링크(원문). null = 미설정.
  swadpia_url      text,
  -- 링크/기본맵에서 도출된 성원 category_code (예: CNC1000).
  category_code    text,
  goods_code       text default '1',
  -- unmapped | mapped(코드만) | verified(라이브검증완료) | error | drift
  status           text not null default 'unmapped',
  last_verified_at timestamptz,
  -- 드리프트 비교용 옵션 핑거프린트 {paperCodes,printMethods,sizeCodes,counts,basePrice}
  fingerprint      jsonb,
  verify_error     text,
  updated_at       timestamptz not null default now()
);

comment on table print_swadpia_mapping is 'OMO-3058 우리 제품↔성원 category_code 맵핑(보드 편집 + 라이브 검증)';

-- ── 드리프트 감지 로그 ───────────────────────────────────────────────
create table if not exists print_swadpia_drift_log (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null,
  category_code      text,
  detected_at        timestamptz not null default now(),
  -- 변경 요약(한국어) + 제안 개선책
  change_summary     text,
  suggested_action   text,
  prev_fingerprint   jsonb,
  new_fingerprint    jsonb,
  -- 보드 보고(Paperclip 이슈/코멘트) 발송 여부
  reported           boolean not null default false,
  reported_at        timestamptz,
  paperclip_issue_id text
);

create index if not exists idx_print_swadpia_drift_unreported
  on print_swadpia_drift_log (detected_at)
  where reported = false;

comment on table print_swadpia_drift_log is 'OMO-3058 성원 맵핑/옵션 드리프트 감지 로그(미보고분은 Paperclip 루틴이 보드 보고)';

-- ── RLS ─────────────────────────────────────────────────────────────
alter table print_swadpia_mapping    enable row level security;
alter table print_swadpia_drift_log  enable row level security;

drop policy if exists print_swadpia_mapping_service on print_swadpia_mapping;
create policy print_swadpia_mapping_service on print_swadpia_mapping
  for all to service_role using (true) with check (true);

drop policy if exists print_swadpia_drift_service on print_swadpia_drift_log;
create policy print_swadpia_drift_service on print_swadpia_drift_log
  for all to service_role using (true) with check (true);
