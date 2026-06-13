-- OMO-3027 [OMO-3019-2]: 활성 제품 인쇄규격(print_spec) 시드 확대.
--
-- 배경: OMO-3026 토대 마이그레이션은 명함·스티커 2종만 시드했다. 템플릿 갤러리
--       (/print-templates) 가 "전체 템플릿" 을 보여줄 수 있도록, SSOT 치수
--       (src/config/printSpecs.ts PRINT_SPEC_DIMS = EditorClient PRODUCT_DIMS 미러)가
--       정의된 카테고리의 활성 제품에 표준 규격을 자체 산출로 시드한다.
--
-- 정직성(OMO-2975): 치수는 표준 인쇄 규격 자체 산출(사내 SSOT). 성원/타사 자산 미사용.
--   min_dpi=300(인쇄 표준), color_mode='CMYK'(인쇄 색공간) 일괄.
--
-- 물리적으로 모호한 카테고리(posters 안의 롤업/X배너 등 비A4 제품)는 카테고리 일괄
--   시드 대신 canonical 슬러그만 시드해 엉뚱한 치수가 붙는 것을 막는다.
-- 멱등: print_spec 이 이미 있으면 건드리지 않는다(COALESCE 미사용, WHERE print_spec IS NULL).

-- 헬퍼: 카테고리 → 표준 규격(JSONB). (PRINT_SPEC_DIMS 와 동일 수치)
WITH spec_by_category(category, spec) AS (
  VALUES
    ('business_cards',         jsonb_build_object('width_mm',85, 'height_mm',55, 'bleed_mm',3,'safe_mm',3, 'min_dpi',300,'color_mode','CMYK')),
    ('premium_business_cards', jsonb_build_object('width_mm',85, 'height_mm',55, 'bleed_mm',3,'safe_mm',3, 'min_dpi',300,'color_mode','CMYK')),
    ('premium_foil_cards',     jsonb_build_object('width_mm',85, 'height_mm',55, 'bleed_mm',3,'safe_mm',3, 'min_dpi',300,'color_mode','CMYK')),
    ('stickers',               jsonb_build_object('width_mm',70, 'height_mm',70, 'bleed_mm',3,'safe_mm',3, 'min_dpi',300,'color_mode','CMYK')),
    ('die_cut_stickers',       jsonb_build_object('width_mm',70, 'height_mm',70, 'bleed_mm',3,'safe_mm',5, 'min_dpi',300,'color_mode','CMYK')),
    ('eco_stickers',           jsonb_build_object('width_mm',70, 'height_mm',70, 'bleed_mm',3,'safe_mm',3, 'min_dpi',300,'color_mode','CMYK')),
    ('postcards',              jsonb_build_object('width_mm',152,'height_mm',102,'bleed_mm',3,'safe_mm',3, 'min_dpi',300,'color_mode','CMYK')),
    ('flyers',                 jsonb_build_object('width_mm',148,'height_mm',210,'bleed_mm',3,'safe_mm',5, 'min_dpi',300,'color_mode','CMYK')),
    ('brochures',              jsonb_build_object('width_mm',148,'height_mm',210,'bleed_mm',3,'safe_mm',5, 'min_dpi',300,'color_mode','CMYK'))
)
UPDATE print_products p
SET print_spec = s.spec
FROM spec_by_category s
WHERE p.category = s.category
  AND p.is_active = true
  AND p.print_spec IS NULL;

-- posters: canonical 슬러그만(롤업/X/미니 배너 제외 — 비A4 물리치수).
UPDATE print_products
SET print_spec = jsonb_build_object('width_mm',210,'height_mm',297,'bleed_mm',3,'safe_mm',5,'min_dpi',300,'color_mode','CMYK')
WHERE slug = 'posters' AND is_active = true AND print_spec IS NULL;

-- banners: canonical 슬러그만.
UPDATE print_products
SET print_spec = jsonb_build_object('width_mm',200,'height_mm',300,'bleed_mm',5,'safe_mm',10,'min_dpi',300,'color_mode','CMYK')
WHERE slug = 'banners' AND is_active = true AND print_spec IS NULL;
