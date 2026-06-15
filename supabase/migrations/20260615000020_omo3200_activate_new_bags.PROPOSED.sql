-- OMO-3200: 쇼핑백 수량별 가격 연동 검증 후 신규 2종 활성화.
--
-- 선행조건(반드시 먼저 적용):
--   20260615000010_omo3197_shopping_bags_4types.sql (OMO-3197)
--   ← handleless-bags / small-batch-bags 제품행 + 옵션을 is_active=FALSE 로 생성.
--
-- 가격연동: 수량별 도매원가는 src/config/bag-pricing.ts (calcuEstimate 추출 매트릭스)에서
--   코드경로(fetchSwadpiaCategoryDataByCode → synthesizeBagPrintEntries)로 주입되므로
--   별도 가격 시드 테이블은 불필요. 본 마이그레이션은 활성화 플래그만 전환한다.
--
-- ⚠️ 적용 게이트: OMO-3197 마이그레이션 라이브 적용 + 스테이징 가격검증 통과 후에만 실행.
BEGIN;

UPDATE print_products
   SET is_active = TRUE
 WHERE slug IN ('handleless-bags', 'small-batch-bags');

-- 검증: 2행이 활성화되어야 한다.
DO $$
DECLARE n INT;
BEGIN
  SELECT COUNT(*) INTO n FROM print_products
   WHERE slug IN ('handleless-bags', 'small-batch-bags') AND is_active = TRUE;
  IF n <> 2 THEN
    RAISE EXCEPTION 'OMO-3200 활성화 실패: 활성 신규 쇼핑백 % 행 (기대 2). OMO-3197 선행 마이그레이션 미적용 가능성.', n;
  END IF;
END $$;

COMMIT;
