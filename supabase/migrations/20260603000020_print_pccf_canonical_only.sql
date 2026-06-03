-- OMO-2314: 이 migration 의 원래 의도(비-성원 62개 비활성화)는 보드 피드백에 따라 철회.
-- 활성화 정책은 코드(src/config/pccf-catalog.ts) + env(PCCF_PRODUCT_SLUGS) 로 제어하며,
-- DB 의 is_active 는 데이터 자체의 유효성만 표현하도록 유지.
-- no-op 으로 남겨두어 마이그레이션 히스토리 일관성만 보존.

SELECT 1;
