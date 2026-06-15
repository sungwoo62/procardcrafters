-- OMO-3239: 성원 브라우저-구동 결정론 가격 매트릭스 오라클
--
-- 스파이크(3 게이트 PASS)로 확인: 페이지 hidden `total_price`(order_form 직렬화 대상)가
-- size/qty/paper 조합별 실제 장바구니 등록가다(멀티사이즈·디지털·토너 포함). OCR/LLM 미사용.
-- 오프라인 크롤러가 조합을 표집(+qty 보간)해 이 매트릭스에 적재 → 고객 가격경로는 라이브
-- 호출 없이 매트릭스를 룩업한다(라이브-퍼-리퀘스트 금지).
--
-- prefix `print_swadpia_` (종합인쇄 + 성원 연동). RLS: 쓰기는 service_role 경로 전용.
-- 단일포맷(명함/스티커/봉투/캘린더)의 기존 json_data 경로는 회귀 금지 — 본 테이블은
-- 멀티사이즈/디지털/토너 라우팅에만 추가(additive)로 쓰인다.

-- ── 해소된 가격 오라클(룩업 대상) ────────────────────────────────────
create table if not exists print_swadpia_price_matrix (
  id              uuid primary key default gen_random_uuid(),
  category_code   text not null,                 -- 성원 category_code (예: CPR2000)
  product_slug    text,                          -- 우리 제품 슬러그(역참조 편의, CATEGORY_MAP)
  size_code       text not null default '',      -- paper_size/size_type 등 사이즈 코드
  paper_code      text not null default '',      -- 용지 코드(없으면 '')
  side            smallint not null default 1,   -- 1=단면 2=양면
  qty             integer not null,              -- 고객 수량(제품군별 표준 수량 필드 기준)
  -- hidden input 직렬화 값(원화). total = 장바구니 등록가(게이트 1 동치).
  total_price_krw integer not null,
  paper_price     integer,
  plate_price     integer,
  print_price     integer,
  -- sampled = 라이브 직접 표집 / interpolated = 표본 사이 qty 보간(piecewise-linear)
  source          text not null default 'sampled'
                  check (source in ('sampled','interpolated')),
  -- 표집 시 선택한 옵션 조합 원본(감사/재현용)
  option_combo    jsonb,
  crawl_run_id    uuid,
  sampled_at      timestamptz not null default now(),
  unique (category_code, size_code, paper_code, side, qty)
);

create index if not exists idx_print_price_matrix_lookup
  on print_swadpia_price_matrix (category_code, size_code, paper_code, side, qty);
create index if not exists idx_print_price_matrix_slug
  on print_swadpia_price_matrix (product_slug);

comment on table print_swadpia_price_matrix is
  'OMO-3239 성원 결정론 가격 오라클 — hidden total_price 표집/보간(멀티사이즈·디지털·토너). 룩업 전용';

-- ── 크롤 실행 로그(드리프트 + parity 추적) ───────────────────────────
create table if not exists print_swadpia_price_crawl_runs (
  id              uuid primary key default gen_random_uuid(),
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  -- partial | success | failed
  status          text not null default 'partial'
                  check (status in ('partial','success','failed')),
  category_codes  text[],                        -- 이번 런이 다룬 카테고리
  sampled_count   integer not null default 0,    -- 라이브 표집 셀 수
  interpolated_count integer not null default 0, -- 보간 생성 셀 수
  -- parity: 보간값 vs 재표집 실측 오차 요약(드리프트 경보 판정용)
  parity_summary  jsonb,
  drift_detected  boolean not null default false,
  error           text
);

create index if not exists idx_print_price_crawl_runs_recent
  on print_swadpia_price_crawl_runs (started_at desc);

comment on table print_swadpia_price_crawl_runs is
  'OMO-3239 가격 매트릭스 크롤 실행 로그 — 재크롤 cron/parity 검증 추적';

-- ── RLS ─────────────────────────────────────────────────────────────
alter table print_swadpia_price_matrix     enable row level security;
alter table print_swadpia_price_crawl_runs enable row level security;

drop policy if exists print_price_matrix_service on print_swadpia_price_matrix;
create policy print_price_matrix_service on print_swadpia_price_matrix
  for all to service_role using (true) with check (true);

drop policy if exists print_price_crawl_runs_service on print_swadpia_price_crawl_runs;
create policy print_price_crawl_runs_service on print_swadpia_price_crawl_runs
  for all to service_role using (true) with check (true);
