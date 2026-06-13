-- OMO-3027 [OMO-3019-2]: print_spec 시드를 성원(Swadpia) 실측 규격 기준으로 재정렬·확대.
--
-- 보드 지시("성원이 갖고있는 템플릿 기준으로 해, 저게 전부야?"): 템플릿 규격을
-- 성원 실제 생산 규격(estimate_goods size_info 의 cut_norm_x/y — 실재단 치수)에
-- 맞춘다. 우리 템플릿은 자체 생성하되(OMO-2975: 성원 디자인/자산 미복제), 치수는
-- 우리가 성원에 발주하는 제품의 실생산 규격(사실 데이터)을 따른다.
--
-- 근거: 2026-06-13 성원 estimate_goods/json_data 라이브 프로브.
--   · 명함(CNC*): 성원 목록에 85x55 포함(국제표준) → 85x55 채택.
--   · 엽서(CDP3000): 100x148 (성원 유일 규격) — 기존 152x102 오류 교정.
--   · 전단/리플렛(CLF1000/CPR3000): A4 210x297.
--   · 브로셔/메뉴(CLF2000): A4 210x297.  · 책자(CPR4000): A4 210x297(페이지 단위 템플릿).
--   · 서식(CNR2000): A4 210x297.  · 라벨(CLP1000): 60x50.
--   · 포스터(CPR2000): A2 420x594.  · 캘린더(CCD1000 230x165 / CCD2000 297x205).
--   · 스티커(CST1000/CST2000): 성원 size_info=커스텀(구조화 규격 없음) → 우리 기본 70x70 유지.
-- 평면 재단치수 없는 제품(성원 기준 템플릿 불가)은 명시적으로 NULL(준비중):
--   · 배너(CPR5000): cut_norm=null(절대규격 없음, ㎡ 단가).
--   · 롤스티커(CST7000): 롤(5m) — 평면 템플릿 비대상.
--
-- 멱등: 명시 슬러그만 갱신/NULL. min_dpi=300, color_mode='CMYK' 일괄.

CREATE OR REPLACE FUNCTION pg_temp.spec(w numeric, h numeric, b numeric, s numeric)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object('width_mm',w,'height_mm',h,'bleed_mm',b,'safe_mm',s,'min_dpi',300,'color_mode','CMYK')
$$;

-- 명함 85x55
UPDATE print_products SET print_spec = pg_temp.spec(85,55,3,3)
WHERE slug IN ('business-cards','premium-business-cards','premium-foil-cards',
  'metallic-business-cards','transparent-business-cards','uv-business-cards','pearl-business-cards')
  AND is_active;

-- 엽서 100x148 (교정)
UPDATE print_products SET print_spec = pg_temp.spec(100,148,3,3) WHERE slug='postcards' AND is_active;

-- 전단·리플렛·브로셔·메뉴·책자·서식 A4 210x297
UPDATE print_products SET print_spec = pg_temp.spec(210,297,3,5)
WHERE slug IN ('flyers','leaflets','brochures','menus',
  'saddle-stitch-booklet','perfect-bound-booklet','catalogs',
  'receipts','quotation-forms','invoice-forms','ncr-forms')
  AND is_active;

-- 라벨 60x50
UPDATE print_products SET print_spec = pg_temp.spec(60,50,2,2)
WHERE slug IN ('price-labels','barcode-labels','food-labels') AND is_active;

-- 포스터 A2 420x594
UPDATE print_products SET print_spec = pg_temp.spec(420,594,5,10) WHERE slug='posters' AND is_active;

-- 캘린더
UPDATE print_products SET print_spec = pg_temp.spec(230,165,3,5) WHERE slug='wall-calendars' AND is_active;
UPDATE print_products SET print_spec = pg_temp.spec(297,205,3,5) WHERE slug IN ('desk-calendars','mini-calendars') AND is_active;

-- 스티커 70x70 (성원 커스텀규격 → 우리 기본 유지)
UPDATE print_products SET print_spec = pg_temp.spec(70,70,3,3)
WHERE slug IN ('stickers','die-cut-stickers','holographic-stickers','kraft-stickers','transparent-stickers','eco-stickers')
  AND is_active;

-- 평면 재단치수 없는 제품 → NULL(준비중)로 명시
UPDATE print_products SET print_spec = NULL
WHERE slug IN ('banners','x-banners','rollup-banners','mini-banners','roll-stickers');
