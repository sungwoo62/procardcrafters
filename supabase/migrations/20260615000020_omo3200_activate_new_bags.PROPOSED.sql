-- OMO-3200: 쇼핑백 수량별 가격 연동 완료 후 4종 일괄 활성화.
--
-- 선행조건(반드시 먼저 적용/배포):
--   1) 20260615000010_omo3197_shopping_bags_4types.sql (OMO-3197) — 라이브 적용 완료(psql).
--      4종 제품행 + 실측옵션 생성, 단 수량별 가격 미연동이라 4종 전부 is_active=FALSE 로 내려둠.
--   2) PR #90 (OMO-3197 코드: CATEGORY_MAP CPK3000/CPK5000 + product-nav) main 머지·배포.
--   3) PR #91 (OMO-3200 가격: src/config/bag-pricing.ts + swadpia.ts 합성) main 머지·배포.
--
-- 가격연동: 수량별 도매원가는 src/config/bag-pricing.ts(calcuEstimate 추출 매트릭스)에서
--   코드경로(fetchSwadpiaCategoryDataByCode → synthesizeBagPrintEntries)로 주입. 별도 가격 시드 불필요.
--
-- OMO-3197 이 손실리스크(flat 가격) 때문에 기존 활성 2종(paper-shopping-bags/gift-bags)도
--   draft 로 내렸으므로, 가격연동 완료된 지금 4종 전부 활성화한다.
--
-- ⚠️ 적용 게이트: 위 PR #90/#91 배포(가격 라이브) 확인 + 보드 go-live 승인 후에만 실행.
BEGIN;

UPDATE print_products
   SET is_active = TRUE
 WHERE slug IN ('paper-shopping-bags', 'gift-bags', 'handleless-bags', 'small-batch-bags');

-- 검증: 4행이 활성화되어야 한다.
DO $$
DECLARE n INT;
BEGIN
  SELECT COUNT(*) INTO n FROM print_products
   WHERE slug IN ('paper-shopping-bags', 'gift-bags', 'handleless-bags', 'small-batch-bags')
     AND is_active = TRUE;
  IF n <> 4 THEN
    RAISE EXCEPTION 'OMO-3200 활성화 실패: 활성 쇼핑백 % 행 (기대 4). OMO-3197 선행 마이그레이션 미적용 가능성.', n;
  END IF;
END $$;

COMMIT;
