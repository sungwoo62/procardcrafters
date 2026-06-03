-- FedEx Korea Service Guide list_rate_krw 시드
--
-- 보드 확인 데이터: 미국(Zone D) IP 0.5kg = 20,000 KRW 최종 청구
-- 역산: 20,000 / (1 - 0.7741) / (1 - 0.038) = 92,047 KRW list price
-- 다른 권역/무게는 FedEx Korea Service Guide 표준 progression 패턴으로 시드.
-- 정확값 차이 시 /admin/shipping > 요금표 탭에서 셀 단위 수정 가능.

-- list_rate_krw 업데이트: IP Export 서비스 (fedex_ip)
DO $$
DECLARE
  ip_id UUID := (SELECT id FROM print_shipping_services WHERE code = 'fedex_ip');
  ie_id UUID := (SELECT id FROM print_shipping_services WHERE code = 'fedex_ie');
BEGIN
  -- =========== Zone D (US/CA): 앵커 = 0.5kg 20K KRW final ============
  -- list = 20K / (1-0.7741) / (1-0.038) ≈ 92K KRW
  UPDATE print_shipping_rates SET list_rate_krw =  92000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='D') AND weight_kg_max = 2.5;
  UPDATE print_shipping_rates SET list_rate_krw = 240000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='D') AND weight_kg_max = 5.0;
  UPDATE print_shipping_rates SET list_rate_krw = 420000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='D') AND weight_kg_max = 10.0;
  UPDATE print_shipping_rates SET list_rate_krw = 760000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='D') AND weight_kg_max = 20.5;
  UPDATE print_shipping_rates SET list_rate_krw = 1500000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='D') AND weight_kg_max = 44.5;
  UPDATE print_shipping_rates SET list_rate_krw = 2300000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='D') AND weight_kg_max = 70.5;
  UPDATE print_shipping_rates SET list_rate_krw = 3100000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='D') AND weight_kg_max = 99.0;
  UPDATE print_shipping_rates SET list_rate_krw = 8500000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='D') AND weight_kg_max = 299.0;
  UPDATE print_shipping_rates SET list_rate_krw = 13800000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='D') AND weight_kg_max = 499.0;
  UPDATE print_shipping_rates SET list_rate_krw = 27000000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='D') AND weight_kg_max = 999.0;
  UPDATE print_shipping_rates SET list_rate_krw = 54000000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='D') AND weight_kg_max = 9999.0;

  -- =========== Zone A (JP): Zone D × 0.65 ============
  UPDATE print_shipping_rates SET list_rate_krw =  60000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='A') AND weight_kg_max = 2.5;
  UPDATE print_shipping_rates SET list_rate_krw = 156000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='A') AND weight_kg_max = 5.0;
  UPDATE print_shipping_rates SET list_rate_krw = 273000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='A') AND weight_kg_max = 10.0;
  UPDATE print_shipping_rates SET list_rate_krw = 494000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='A') AND weight_kg_max = 20.5;
  UPDATE print_shipping_rates SET list_rate_krw =  975000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='A') AND weight_kg_max = 44.5;
  UPDATE print_shipping_rates SET list_rate_krw = 1495000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='A') AND weight_kg_max = 70.5;
  UPDATE print_shipping_rates SET list_rate_krw = 2015000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='A') AND weight_kg_max = 99.0;
  UPDATE print_shipping_rates SET list_rate_krw = 5525000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='A') AND weight_kg_max = 299.0;
  UPDATE print_shipping_rates SET list_rate_krw = 8970000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='A') AND weight_kg_max = 499.0;
  UPDATE print_shipping_rates SET list_rate_krw = 17550000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='A') AND weight_kg_max = 999.0;
  UPDATE print_shipping_rates SET list_rate_krw = 35100000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='A') AND weight_kg_max = 9999.0;

  -- =========== Zone E (CN): Zone D × 0.85 ============
  UPDATE print_shipping_rates SET list_rate_krw =  78000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='E') AND weight_kg_max = 2.5;
  UPDATE print_shipping_rates SET list_rate_krw = 204000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='E') AND weight_kg_max = 5.0;
  UPDATE print_shipping_rates SET list_rate_krw = 357000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='E') AND weight_kg_max = 10.0;
  UPDATE print_shipping_rates SET list_rate_krw = 646000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='E') AND weight_kg_max = 20.5;
  UPDATE print_shipping_rates SET list_rate_krw = 1275000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='E') AND weight_kg_max = 44.5;
  UPDATE print_shipping_rates SET list_rate_krw = 1955000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='E') AND weight_kg_max = 70.5;
  UPDATE print_shipping_rates SET list_rate_krw = 9999000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='E') AND weight_kg_max = 9999.0;

  -- =========== Zone F (HK/MO): Zone D × 0.85 ============
  UPDATE print_shipping_rates SET list_rate_krw =  78000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='F') AND weight_kg_max = 2.5;
  UPDATE print_shipping_rates SET list_rate_krw = 204000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='F') AND weight_kg_max = 5.0;
  UPDATE print_shipping_rates SET list_rate_krw = 357000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='F') AND weight_kg_max = 10.0;
  UPDATE print_shipping_rates SET list_rate_krw = 646000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='F') AND weight_kg_max = 20.5;
  UPDATE print_shipping_rates SET list_rate_krw = 1275000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='F') AND weight_kg_max = 44.5;
  UPDATE print_shipping_rates SET list_rate_krw = 1955000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='F') AND weight_kg_max = 70.5;
  UPDATE print_shipping_rates SET list_rate_krw = 9999000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='F') AND weight_kg_max = 9999.0;

  -- =========== Zone G (TW): Zone D × 0.80 ============
  UPDATE print_shipping_rates SET list_rate_krw =  74000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='G') AND weight_kg_max = 2.5;
  UPDATE print_shipping_rates SET list_rate_krw = 192000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='G') AND weight_kg_max = 5.0;
  UPDATE print_shipping_rates SET list_rate_krw = 336000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='G') AND weight_kg_max = 10.0;
  UPDATE print_shipping_rates SET list_rate_krw = 608000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='G') AND weight_kg_max = 20.5;
  UPDATE print_shipping_rates SET list_rate_krw = 1200000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='G') AND weight_kg_max = 44.5;
  UPDATE print_shipping_rates SET list_rate_krw = 1840000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='G') AND weight_kg_max = 70.5;
  UPDATE print_shipping_rates SET list_rate_krw = 9999000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='G') AND weight_kg_max = 9999.0;

  -- =========== Zone H (SG): Zone D × 1.0 ============
  UPDATE print_shipping_rates SET list_rate_krw =  92000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='H') AND weight_kg_max = 2.5;
  UPDATE print_shipping_rates SET list_rate_krw = 240000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='H') AND weight_kg_max = 5.0;
  UPDATE print_shipping_rates SET list_rate_krw = 420000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='H') AND weight_kg_max = 10.0;
  UPDATE print_shipping_rates SET list_rate_krw = 760000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='H') AND weight_kg_max = 20.5;
  UPDATE print_shipping_rates SET list_rate_krw = 1500000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='H') AND weight_kg_max = 44.5;
  UPDATE print_shipping_rates SET list_rate_krw = 9999000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='H') AND weight_kg_max = 9999.0;

  -- =========== Zone I (TH/MY): Zone D × 1.05 ============
  UPDATE print_shipping_rates SET list_rate_krw =  97000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='I') AND weight_kg_max = 2.5;
  UPDATE print_shipping_rates SET list_rate_krw = 252000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='I') AND weight_kg_max = 5.0;
  UPDATE print_shipping_rates SET list_rate_krw = 441000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='I') AND weight_kg_max = 10.0;
  UPDATE print_shipping_rates SET list_rate_krw = 798000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='I') AND weight_kg_max = 20.5;
  UPDATE print_shipping_rates SET list_rate_krw = 1575000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='I') AND weight_kg_max = 44.5;
  UPDATE print_shipping_rates SET list_rate_krw = 9999000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='I') AND weight_kg_max = 9999.0;

  -- =========== Zone K (EU): Zone D × 1.2 ============
  UPDATE print_shipping_rates SET list_rate_krw = 110000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='K') AND weight_kg_max = 2.5;
  UPDATE print_shipping_rates SET list_rate_krw = 288000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='K') AND weight_kg_max = 5.0;
  UPDATE print_shipping_rates SET list_rate_krw = 504000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='K') AND weight_kg_max = 10.0;
  UPDATE print_shipping_rates SET list_rate_krw = 912000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='K') AND weight_kg_max = 20.5;
  UPDATE print_shipping_rates SET list_rate_krw = 1800000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='K') AND weight_kg_max = 44.5;
  UPDATE print_shipping_rates SET list_rate_krw = 9999000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='K') AND weight_kg_max = 9999.0;

  -- =========== Zone P (AU/NZ): Zone D × 1.15 ============
  UPDATE print_shipping_rates SET list_rate_krw = 106000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='P') AND weight_kg_max = 2.5;
  UPDATE print_shipping_rates SET list_rate_krw = 276000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='P') AND weight_kg_max = 5.0;
  UPDATE print_shipping_rates SET list_rate_krw = 483000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='P') AND weight_kg_max = 10.0;
  UPDATE print_shipping_rates SET list_rate_krw = 874000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='P') AND weight_kg_max = 20.5;
  UPDATE print_shipping_rates SET list_rate_krw = 1725000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='P') AND weight_kg_max = 44.5;
  UPDATE print_shipping_rates SET list_rate_krw = 9999000 WHERE service_id = ip_id AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='P') AND weight_kg_max = 9999.0;

  -- ========================================================================
  -- IE Export (fedex_ie): IP 와 같은 list price (서비스 구분은 할인%로 결정)
  -- ========================================================================
  UPDATE print_shipping_rates r SET list_rate_krw = ip_rate.list_rate_krw
  FROM print_shipping_rates ip_rate
  WHERE r.service_id = ie_id
    AND ip_rate.service_id = ip_id
    AND r.zone_id = ip_rate.zone_id
    AND r.weight_kg_max = ip_rate.weight_kg_max
    AND r.list_rate_krw IS NULL;
END $$;

-- 시드 출처 메모: 첫 권역 코드에 코멘트 남김
COMMENT ON COLUMN print_shipping_rates.list_rate_krw IS
  'FedEx Service Guide 공시 기본요금 (KRW). 보드 앵커: 미국 0.5kg 20K 청구. '
  '권역별 list price 는 표준 progression 으로 추정 시드. 정확값은 admin UI 에서 셀 단위 수정 권장.';
