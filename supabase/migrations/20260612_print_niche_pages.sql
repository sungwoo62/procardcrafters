-- print_niche_pages (OMO-2971)
-- 직업별 니치 랜딩 콘텐츠의 DB 홈. C2 Content(OMO-2972) 가 코드 배포 없이 직업 페이지를
-- 양산(insert)할 수 있게 한다. TS SEED(src/lib/niche/professions.ts)와 loader 에서
-- slug 기준 병합되며 DB row 가 우선. 테이블 부재 시 loader 는 SEED 로 폴백(비치명적).
--
-- content jsonb 는 ProfessionContent 타입과 동일 shape:
--   { slug, profession, professionSingular, h1, metaTitle, metaDescription,
--     heroSubhead, intro, useCases[], recommendedFinishes[], faqs[], internalLinks[], priceFrom }
-- ⚠️ AggregateRating/리뷰 stat 금지 (신뢰 게이트 OMO-2383).

create table if not exists public.print_niche_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  content jsonb not null,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_print_niche_pages_published
  on public.print_niche_pages (is_published) where is_published = true;

alter table public.print_niche_pages enable row level security;

-- 발행분만 공개 읽기(anon). 쓰기는 service role 전용(정책 미생성 = 기본 거부).
drop policy if exists "print_niche_pages public read published" on public.print_niche_pages;
create policy "print_niche_pages public read published"
  on public.print_niche_pages for select
  using (is_published = true);
