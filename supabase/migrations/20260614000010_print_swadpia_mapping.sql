-- OMO-3156 (OMO-3058 복원): 성원(swadpia) 제품 맵핑 관리 + 드리프트 모니터링
--
-- 배경: 이 테이블/엔드포인트는 OMO-3058/3059 에서 구현됐으나 main 승격 과정에서 누락됐다.
-- OMO-3156 으로 맵핑 리포트의 "성원 링크 부착 → 라이브 검증" 기능을 복원하면서
-- 의존 테이블도 함께 복원한다. (OMO-3059 의 040/050 마이그레이션은 main 에서 동일
-- 타임스탬프가 다른 파일에 선점되어 충돌 → 단일 파일·신규 타임스탬프로 재작성.)
--
-- 보드가 각 제품 옆에 성원 상품 링크를 직접 붙이면, 시스템이 그 링크를 검증해
-- category_code 를 세팅하고 옵션 핑거프린트를 스냅샷한다. 이후 성원쪽 링크/옵션이
-- 바뀌어 맵핑이 어긋나면(드리프트) drift_log 에 기록 → 보드 보고 + 개선책 제안.
--
-- prefix `print_` (종합인쇄 서비스). RLS: 쓰기는 service_role API 경로 전용
-- (공개 prod 페이지의 쓰기는 추가로 requireAdmin 게이트가 보호 — OMO-3156).

-- ── 제품별 성원 맵핑 현황 ────────────────────────────────────────────
create table if not exists print_swadpia_mapping (
  slug                 text primary key,
  label                text,
  group_key            text,
  -- 보드가 붙인 성원 상품 페이지 링크(원문). null = 미설정.
  swadpia_url          text,
  -- 링크/기본맵에서 도출된 성원 category_code (예: CNC1000).
  category_code        text,
  goods_code           text default '1',
  -- unmapped | mapped(코드만) | verified(라이브검증완료) | error | drift
  status               text not null default 'unmapped',
  last_verified_at     timestamptz,
  -- 드리프트 비교용 옵션 핑거프린트 {paperCodes,printMethods,sizeCodes,counts,basePrice}
  fingerprint          jsonb,
  verify_error         text,
  -- true 면 고객 제품목록/PDP 에서 숨김(맵핑 없는 미판매 제품용). product-visibility.ts 가 존중.
  -- 주의: print_products.is_active 는 라이브 prod 가 직접 읽으므로 토글이 즉시 노출을 바꾼다.
  -- 별도 플래그로 분리해 prod 무손상으로 숨김 동작을 검증한다.
  hidden_from_customer boolean not null default false,
  updated_at           timestamptz not null default now()
);

comment on table print_swadpia_mapping is 'OMO-3058/3156 우리 제품↔성원 category_code 맵핑(보드 편집 + 라이브 검증)';
comment on column print_swadpia_mapping.hidden_from_customer is
  'OMO-3058 true 면 고객 제품목록/PDP 에서 숨김(맵핑 없는 미판매 제품용). product-visibility.ts 가 존중.';

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
