-- OMO-3027: 배너/롤스티커 '준비중' 해소 — 표준 규격으로 템플릿 제공.
--
-- 보드 질문("이 준비중은 뭔말이야 — 배너/롤"): 배너는 성원 견적 API 가 cut_norm=null
-- (㎡단가·고객 입력 사이즈)이라 시드 못했으나, 우리가 실제 판매하는 표준 규격
-- (제품 카피 "Mini banner 60×160cm / 80×200cm")이 있으므로 표준 롤업/X배너 치수로
-- 템플릿을 제공한다. 롤스티커는 낱장 라벨 표준(50×50)로 단위 템플릿 제공.
-- (성원 고정 cut 이 없는 항목 → 업계 표준 규격 채택, 성원 자산 미복제 OMO-2975.)

-- 롤업/일반 배너 600×1600mm (60×160cm)
UPDATE print_products
SET print_spec = jsonb_build_object('width_mm',600,'height_mm',1600,'bleed_mm',10,'safe_mm',20,'min_dpi',150,'color_mode','CMYK')
WHERE slug IN ('banners','rollup-banners') AND is_active;

-- X배너 600×1800mm
UPDATE print_products
SET print_spec = jsonb_build_object('width_mm',600,'height_mm',1800,'bleed_mm',10,'safe_mm',20,'min_dpi',150,'color_mode','CMYK')
WHERE slug = 'x-banners' AND is_active;

-- 미니(탁상) 배너 250×360mm
UPDATE print_products
SET print_spec = jsonb_build_object('width_mm',250,'height_mm',360,'bleed_mm',5,'safe_mm',10,'min_dpi',300,'color_mode','CMYK')
WHERE slug = 'mini-banners' AND is_active;

-- 롤스티커: 낱장 라벨 표준 50×50mm (롤 자체가 아니라 낱장 아트워크 단위 템플릿)
UPDATE print_products
SET print_spec = jsonb_build_object('width_mm',50,'height_mm',50,'bleed_mm',2,'safe_mm',2,'min_dpi',300,'color_mode','CMYK')
WHERE slug = 'roll-stickers' AND is_active;

-- 주: 대형 배너는 입고 해상도 150dpi 권장(대형출력 표준; 300dpi 불요·파일과대).
