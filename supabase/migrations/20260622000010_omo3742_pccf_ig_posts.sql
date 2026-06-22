-- OMO-3742: procardcrafters IG organic 게시 큐 (보드 지정 컨셉 → @procard IG)
-- 공유 Supabase DB. prefix 규칙 준수: pccf_ (procardcrafters) — print_ 는 결제데이터 점유라
-- 신규 marketing 테이블은 서비스 식별 명확한 pccf_ 사용.
--
-- 고객접점 정책(OMO-2760): 대외 콘텐츠는 사람 승인 게이트 필수.
--   status 흐름: pending_approval → approved → publishing → published / failed
--   approved 이전에는 절대 IG 게시 트랜스포트로 넘어가지 않는다.

create table if not exists public.pccf_ig_posts (
  id uuid primary key default gen_random_uuid(),
  -- 보드가 지정한 컨셉/콘텐츠
  concept text not null,                       -- 보드 지정 컨셉(예: "메탈 명함 신제품 런칭")
  caption text not null,                       -- 게시 캡션(한국어/영어 혼용 가능)
  image_urls text[] not null default '{}',     -- 공개 https 이미지 URL(1장=단일, 2~10장=캐러셀)
  -- 승인 게이트
  status text not null default 'pending_approval'
    check (status in ('pending_approval','approved','publishing','published','failed','cancelled')),
  approved_by text,                            -- 사람 승인자(사장님 업무 계정 등)
  approved_at timestamptz,
  -- 게시 결과
  mode text check (mode in ('simulated','live')),
  creation_id text,
  media_id text,
  permalink text,
  publish_error text,
  published_at timestamptz,
  -- 메타
  created_by text,                             -- 입력 주체(보드/에이전트)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pccf_ig_posts_status on public.pccf_ig_posts (status, created_at desc);

-- updated_at 자동 갱신
create or replace function public.pccf_ig_posts_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_pccf_ig_posts_updated_at on public.pccf_ig_posts;
create trigger trg_pccf_ig_posts_updated_at
  before update on public.pccf_ig_posts
  for each row execute function public.pccf_ig_posts_touch_updated_at();

-- RLS: service_role(백그라운드 워커)만 접근. 클라이언트 직접 접근 차단(대외 게시 콘텐츠).
alter table public.pccf_ig_posts enable row level security;

drop policy if exists pccf_ig_posts_service_all on public.pccf_ig_posts;
create policy pccf_ig_posts_service_all on public.pccf_ig_posts
  for all to service_role using (true) with check (true);

comment on table public.pccf_ig_posts is
  'OMO-3742 procardcrafters @procard IG organic 게시 큐. 사람 승인 게이트(OMO-2760) 후 게시.';
