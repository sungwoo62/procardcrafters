-- OMO-2314: ProCardCrafters 카탈로그를 성원애드피아(Swadpia) 매핑 9 슬러그로 제한.
-- OMO-2273 catalog overhaul 로 추가된 비-성원 제품(-v2 / 신규 라인) 을 일괄 비활성화.
-- 데이터는 보존 — is_active = false 만 토글, 추후 정책 변경 시 재활성화 가능.

UPDATE print_products
   SET is_active = false,
       updated_at = NOW()
 WHERE is_active = true
   AND slug NOT IN (
     'business-cards',
     'premium-business-cards',
     'stickers',
     'die-cut-stickers',
     'flyers',
     'brochures',
     'postcards',
     'posters',
     'banners'
   );

COMMENT ON TABLE print_products IS
  'ProCardCrafters 제품 카탈로그. 활성 슬러그는 src/config/pccf-catalog.ts (PCCF_PRODUCT_SLUGS env) 와 일치해야 함. 비-성원 제품은 is_active=false 로 보존.';
