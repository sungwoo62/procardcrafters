-- OMO-2365: PricingAgreement 2520066223-100 PDF 와 우리 시드 정합성 보정
--
-- 시드 v1 은 2.5kg 행에 0.5kg 행 (PDF "0.5-0.5kg") 의 값을 잘못 기재했었음.
-- 본 마이그레이션은 PDF "1.0-2.5kg" 행 값으로 교체.
-- 차이는 1~3%p 수준이지만 정확성 위해 보정.
--
-- 참고: PDF 적립할인(ED) 프로그램 (페이지 11) — 월별 후정산, 라이브 견적에 미반영.
-- 따라서 본 시드의 할인율은 contract base discount 만 반영, ED 는 별도 처리 필요.

-- 1) IP Export (fedex_ip): "1.0-2.5kg" 행 값
UPDATE print_shipping_rates SET discount_pct = 81.49 WHERE service_id = (SELECT id FROM print_shipping_services WHERE code='fedex_ip') AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='A') AND weight_kg_max = 2.5;
UPDATE print_shipping_rates SET discount_pct = 76.29 WHERE service_id = (SELECT id FROM print_shipping_services WHERE code='fedex_ip') AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='D') AND weight_kg_max = 2.5;
UPDATE print_shipping_rates SET discount_pct = 69.5  WHERE service_id = (SELECT id FROM print_shipping_services WHERE code='fedex_ip') AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='E') AND weight_kg_max = 2.5;
UPDATE print_shipping_rates SET discount_pct = 70.55 WHERE service_id = (SELECT id FROM print_shipping_services WHERE code='fedex_ip') AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='F') AND weight_kg_max = 2.5;
UPDATE print_shipping_rates SET discount_pct = 78.08 WHERE service_id = (SELECT id FROM print_shipping_services WHERE code='fedex_ip') AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='G') AND weight_kg_max = 2.5;
UPDATE print_shipping_rates SET discount_pct = 79.33 WHERE service_id = (SELECT id FROM print_shipping_services WHERE code='fedex_ip') AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='H') AND weight_kg_max = 2.5;
UPDATE print_shipping_rates SET discount_pct = 72.75 WHERE service_id = (SELECT id FROM print_shipping_services WHERE code='fedex_ip') AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='I') AND weight_kg_max = 2.5;
UPDATE print_shipping_rates SET discount_pct = 79.71 WHERE service_id = (SELECT id FROM print_shipping_services WHERE code='fedex_ip') AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='K') AND weight_kg_max = 2.5;
UPDATE print_shipping_rates SET discount_pct = 83.35 WHERE service_id = (SELECT id FROM print_shipping_services WHERE code='fedex_ip') AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='P') AND weight_kg_max = 2.5;

-- 2) IE Export (fedex_ie): "1.0-2.5kg" 행 값
UPDATE print_shipping_rates SET discount_pct = 81.53 WHERE service_id = (SELECT id FROM print_shipping_services WHERE code='fedex_ie') AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='A') AND weight_kg_max = 2.5;
UPDATE print_shipping_rates SET discount_pct = 77.76 WHERE service_id = (SELECT id FROM print_shipping_services WHERE code='fedex_ie') AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='D') AND weight_kg_max = 2.5;
UPDATE print_shipping_rates SET discount_pct = 68.38 WHERE service_id = (SELECT id FROM print_shipping_services WHERE code='fedex_ie') AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='E') AND weight_kg_max = 2.5;
UPDATE print_shipping_rates SET discount_pct = 69.56 WHERE service_id = (SELECT id FROM print_shipping_services WHERE code='fedex_ie') AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='K') AND weight_kg_max = 2.5;
UPDATE print_shipping_rates SET discount_pct = 82.15 WHERE service_id = (SELECT id FROM print_shipping_services WHERE code='fedex_ie') AND zone_id = (SELECT id FROM print_shipping_zones WHERE code='P') AND weight_kg_max = 2.5;

-- 3) FedEx 측 contact 메타데이터 보관
CREATE TABLE IF NOT EXISTS print_carrier_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier TEXT NOT NULL,
  account_number TEXT NOT NULL,
  contract_number TEXT,
  rep_name TEXT,
  rep_title TEXT,
  rep_employee_id TEXT,
  rep_email TEXT,
  rep_phone TEXT,
  note TEXT,
  effective_from DATE DEFAULT CURRENT_DATE,
  UNIQUE (carrier, account_number, contract_number)
);

INSERT INTO print_carrier_contacts (carrier, account_number, contract_number, rep_name, rep_title, rep_employee_id, note)
VALUES ('fedex', '210839884', '2520066223-100', 'Yoon-Seok Gil', 'Acct Exec-Snr', '3502633',
        'PA 발효일 2026-03-11. PDF p3 서명. Rate API 실측 할인이 PDF 명시 할인 (e.g. 76.29% D 1-2.5kg) 보다 낮음 — 활성화 상태 확인 필요')
ON CONFLICT (carrier, account_number, contract_number) DO UPDATE
SET rep_name = EXCLUDED.rep_name,
    rep_title = EXCLUDED.rep_title,
    rep_employee_id = EXCLUDED.rep_employee_id,
    note = EXCLUDED.note;
