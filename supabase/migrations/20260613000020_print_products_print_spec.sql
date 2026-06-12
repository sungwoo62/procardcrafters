-- OMO-3026 [OMO-3019-1]: 제품 인쇄규격 데이터 모델 + 시드 (foundation)
--
-- 배경: 부모 OMO-3019(파일 프리플라이트/시안동의/제품별 PDF 템플릿)의 공통 토대.
--       템플릿 다운로드·업로드 프리플라이트 두 후속 작업이 같은 규격 정보를 읽어야 한다.
--
-- 결정: print_products 에 인쇄규격을 단일 JSONB 컬럼(print_spec)으로 추가한다.
--   형태(snake_case = src/config/printSpecs.ts 의 PrintSpec 타입과 동일):
--     { width_mm, height_mm, bleed_mm, safe_mm, min_dpi, color_mode }
--
-- 규격 값은 표준 인쇄 규격에서 자체 산출했다(성원/타사 템플릿 복제 금지, OMO-2975 정직성 가드).
--   · 치수(mm)는 사내 SSOT(src/config/printSpecs.ts PRINT_SPEC_DIMS = EditorClient PRODUCT_DIMS 미러)와 동일.
--     에디터 캔버스·다운로드 템플릿·DB 규격이 트림/블리드/세이프에서 어긋나면 안 되므로 같은 값을 쓴다.
--   · min_dpi=300 : 옵셋/디지털 인쇄 표준 권장 입고 해상도.
--   · color_mode='CMYK' : 인쇄 색공간 표준.
--
-- 단일 서비스(print_) 테이블, 읽기용 컬럼 추가라 RLS 영향 없음
-- (print_products_public_read 가 이미 행 전체 SELECT 허용).
-- 기존 행 영향 없음(NULL 허용 추가 컬럼; 시드 전 제품은 print_spec=NULL).

ALTER TABLE print_products
  ADD COLUMN IF NOT EXISTS print_spec JSONB;

COMMENT ON COLUMN print_products.print_spec IS
  'OMO-3026 제품 인쇄규격 { width_mm, height_mm, bleed_mm, safe_mm, min_dpi, color_mode }. '
  '표준 규격 자체 산출(SSOT: src/config/printSpecs.ts). 프리플라이트/템플릿 다운로드 공통 토대.';

-- 시드: 명함·스티커 2종(표준 규격 자체 산출).
-- 명함 85x55(국제 명함 표준), 블리드 3mm, 세이프 3mm.
UPDATE print_products
SET print_spec = jsonb_build_object(
  'width_mm',   85,
  'height_mm',  55,
  'bleed_mm',   3,
  'safe_mm',    3,
  'min_dpi',    300,
  'color_mode', 'CMYK'
)
WHERE slug = 'business-cards';

-- 스티커 70x70(정사각 표준), 블리드 3mm, 세이프 3mm.
UPDATE print_products
SET print_spec = jsonb_build_object(
  'width_mm',   70,
  'height_mm',  70,
  'bleed_mm',   3,
  'safe_mm',    3,
  'min_dpi',    300,
  'color_mode', 'CMYK'
)
WHERE slug = 'stickers';
