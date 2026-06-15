-- print_niche_pages 제품군 일반화 (OMO-3215 / 부모 OMO-3214)
-- 니치 랜딩 엔진을 product group(business-cards/stickers/flyers/posters/labels)으로
-- 파라미터화함에 따라, DB 콘텐츠 행도 그룹을 구분한다.
--
-- 하위호환: 기존 행은 전부 business-cards 였으므로 default 'business-cards'.
-- 컬럼 부재 시에도 loader 는 SEED 폴백(비치명적)이라 코드/배포 순서 무관.
--
-- content jsonb 는 NicheContent 타입 shape(src/lib/niche/content.ts):
--   { productGroup, slug, title, titleSingular, h1, metaTitle, metaDescription,
--     heroSubhead, intro, useCases[], recommendedOptions[], photos[], faqs[],
--     internalLinks[], priceFrom, ctaPresetHref }
--   ※ business-cards 레거시 행(ProfessionContent shape)은 professions.ts loader 가
--     계속 병합하므로 이 컬럼 추가만으로 기존 데이터는 무영향.
-- ⚠️ AggregateRating/리뷰 stat 금지 (신뢰 게이트 OMO-2383).

alter table public.print_niche_pages
  add column if not exists product_group text not null default 'business-cards';

create index if not exists idx_print_niche_pages_group
  on public.print_niche_pages (product_group, is_published)
  where is_published = true;

-- PostgREST schema cache 갱신(컬럼 추가 후 'could not find column' 방지).
notify pgrst, 'reload schema';
