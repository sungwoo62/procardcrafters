-- FedEx 계약 운임 v2: 할인 기반 모델
--
-- 계약서(PricingAgreement)에서 받은 데이터는 절대 금액이 아니라 **할인율**.
-- 실제 청구액 = FedEx Service Guide 게시 list rate × (1 - 할인율) × (1 - 자동발송시스템 보너스%) / KRW→USD
-- 또한 fedex_account_number 등 계약 메타데이터를 config 에 보관한다.

-- 1) print_shipping_rates 에 할인/list price 컬럼 추가
ALTER TABLE print_shipping_rates ADD COLUMN IF NOT EXISTS discount_pct      NUMERIC(5, 2);
ALTER TABLE print_shipping_rates ADD COLUMN IF NOT EXISTS list_rate_krw     NUMERIC(12, 2);
ALTER TABLE print_shipping_rates ADD COLUMN IF NOT EXISTS automation_bonus_pct NUMERIC(5, 2) NOT NULL DEFAULT 0;
-- rate_usd 는 기존대로 유지되며, 다음 우선순위로 계산된다:
--   1순위: list_rate_krw + discount_pct 가 모두 있으면 그것으로 동적 계산
--   2순위: rate_usd 가 직접 채워졌으면 그 값
--   3순위: config.fallback_rate_usd

-- 2) config 확장
ALTER TABLE print_shipping_config ADD COLUMN IF NOT EXISTS fedex_account_number  TEXT;
ALTER TABLE print_shipping_config ADD COLUMN IF NOT EXISTS fedex_contract_number TEXT;
ALTER TABLE print_shipping_config ADD COLUMN IF NOT EXISTS krw_per_usd_override  NUMERIC(10, 4);
ALTER TABLE print_shipping_config ADD COLUMN IF NOT EXISTS auto_pick_service     BOOLEAN NOT NULL DEFAULT TRUE;

-- 본 계약 계정 시드
UPDATE print_shipping_config
SET fedex_account_number = '210839884',
    fedex_contract_number = '2520066223-100',
    updated_at = NOW()
WHERE id = 1;

-- 3) 서비스 정리: 계약서에 등장한 서비스 (Export 중심) 모두 등록
INSERT INTO print_shipping_services (code, name_ko, name_en, carrier, est_days_min, est_days_max, sort_order)
VALUES
  ('fedex_ipe_env',  'FedEx Intl Priority Express Envelope', 'IPE Envelope Export',  'fedex', 1, 2, 1),
  ('fedex_ipe_pak',  'FedEx Intl Priority Express Pak',      'IPE Pak Export',       'fedex', 1, 2, 2),
  ('fedex_ipe',      'FedEx Intl Priority Express',          'IPE Export',           'fedex', 1, 2, 3),
  ('fedex_ip_env',   'FedEx Intl Priority Envelope',         'IP Envelope Export',   'fedex', 2, 3, 4),
  ('fedex_ip_pak',   'FedEx Intl Priority Pak',              'IP Pak Export',        'fedex', 2, 3, 5),
  ('fedex_ie',       'FedEx Intl Economy',                   'IE Export',            'fedex', 4, 6, 7),
  ('fedex_ip_freight_ata', 'IP Freight ATA',                 'IP Freight ATA Export','fedex', 2, 4, 8),
  ('fedex_ip_freight_atd', 'IP Freight ATD',                 'IP Freight ATD Export','fedex', 2, 4, 9),
  ('fedex_ip_freight_dta', 'IP Freight DTA',                 'IP Freight DTA Export','fedex', 2, 4, 10),
  ('fedex_ip_freight_dtd', 'IP Freight DTD',                 'IP Freight DTD Export','fedex', 2, 4, 11),
  ('fedex_ie_freight_ata', 'IE Freight ATA',                 'IE Freight ATA Export','fedex', 5, 8, 12),
  ('fedex_ie_freight_dtd', 'IE Freight DTD',                 'IE Freight DTD Export','fedex', 5, 8, 13)
ON CONFLICT (code) DO NOTHING;

-- Update existing fedex_ip → IP Export 으로 통일 (서비스 가이드 표준명)
UPDATE print_shipping_services
SET name_ko = 'FedEx Intl Priority',
    name_en = 'IP Export',
    sort_order = 6
WHERE code = 'fedex_ip';

-- 자동 발송 시스템 보너스 (계약서 13페이지): 서비스별
-- 우리 시스템은 자동 운임 입력이므로 자동발송시스템 보너스 자동 적용 가능
CREATE TABLE IF NOT EXISTS print_shipping_service_bonuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES print_shipping_services(id) ON DELETE CASCADE,
  bonus_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
  note TEXT,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE (service_id, effective_from)
);

ALTER TABLE print_shipping_service_bonuses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shipping_service_bonuses_read" ON print_shipping_service_bonuses;
CREATE POLICY "shipping_service_bonuses_read" ON print_shipping_service_bonuses FOR SELECT USING (TRUE);

-- 자동발송시스템 보너스 시드 (계약서 13페이지)
INSERT INTO print_shipping_service_bonuses (service_id, bonus_pct, note)
SELECT s.id, b.bonus_pct, '자동발송시스템 보너스 (계약서 13p)'
FROM (VALUES
  ('fedex_ipe_env', 3.4),
  ('fedex_ipe_pak', 3.8),
  ('fedex_ipe',     3.8),
  ('fedex_ip_env',  3.4),
  ('fedex_ip_pak',  3.8),
  ('fedex_ip',      3.8),
  ('fedex_ie',      4.6),
  ('fedex_ip_freight_ata', 5.0),
  ('fedex_ip_freight_atd', 5.0),
  ('fedex_ip_freight_dta', 5.0),
  ('fedex_ip_freight_dtd', 5.0),
  ('fedex_ie_freight_ata', 4.5),
  ('fedex_ie_freight_dtd', 4.5)
) AS b(code, bonus_pct)
JOIN print_shipping_services s ON s.code = b.code
ON CONFLICT (service_id, effective_from) DO NOTHING;

-- 4) FedEx 한국 발송 권역 시드 재구성
--    계약서에는 A~Y, 1~9 권역 코드가 등장. PDF 에는 국가-권역 매핑이 빠져있으므로
--    공개된 FedEx 한국 export zone 기준(가장 일반적인 매핑)으로 시드한다.
--    보드가 정식 매핑 표 전달 시 admin UI 에서 country 리스트 수정 가능.

-- 기존 A~H placeholder 권역 삭제 후 정식 권역으로 재시드
DELETE FROM print_shipping_zones WHERE code IN ('A','B','C','D','E','F','G','H')
  AND id NOT IN (SELECT DISTINCT zone_id FROM print_shipping_rates WHERE zone_id IS NOT NULL);

INSERT INTO print_shipping_zones (code, name_ko, name_en, countries, sort_order) VALUES
  ('A', 'A: 일본',                        'Zone A: Japan',                 ARRAY['JP'], 1),
  ('D', 'D: 미국·캐나다',                 'Zone D: US & Canada',           ARRAY['US','CA'], 4),
  ('E', 'E: 중국 본토',                   'Zone E: China',                 ARRAY['CN'], 5),
  ('F', 'F: 홍콩·마카오',                 'Zone F: Hong Kong & Macao',     ARRAY['HK','MO'], 6),
  ('G', 'G: 대만',                        'Zone G: Taiwan',                ARRAY['TW'], 7),
  ('H', 'H: 동남아 1 (싱가포르)',         'Zone H: SEA 1 (Singapore)',     ARRAY['SG'], 8),
  ('I', 'I: 동남아 2 (말레이/태국)',      'Zone I: SEA 2 (MY/TH)',         ARRAY['MY','TH'], 9),
  ('J', 'J: 동남아 3 (필리핀/인도네시아/베트남)', 'Zone J: SEA 3 (PH/ID/VN)', ARRAY['PH','ID','VN'], 10),
  ('K', 'K: 서유럽 주요국',               'Zone K: Western Europe',        ARRAY['GB','DE','FR','IT','ES','NL','BE','IE','LU'], 11),
  ('M', 'M: 북유럽',                      'Zone M: Northern Europe',       ARRAY['SE','NO','DK','FI','IS'], 13),
  ('N', 'N: 동·중부 유럽',                'Zone N: E/C Europe',            ARRAY['PL','CZ','HU','RO','SK','SI','HR','BG','EE','LV','LT'], 14),
  ('O', 'O: 남유럽·기타 EU',              'Zone O: S Europe & other EU',   ARRAY['PT','AT','CH','GR','MT','CY','LI','MC','SM','VA'], 15),
  ('P', 'P: 호주·뉴질랜드',               'Zone P: Australia & NZ',        ARRAY['AU','NZ'], 16),
  ('Q', 'Q: 인도',                        'Zone Q: India',                 ARRAY['IN'], 17),
  ('R', 'R: 중동·터키',                   'Zone R: Middle East & Turkey',  ARRAY['AE','SA','QA','KW','BH','OM','IL','TR','JO','LB'], 18),
  ('S', 'S: 남미',                        'Zone S: Latin America',         ARRAY['BR','AR','CL','CO','PE','MX','EC','UY','VE'], 19),
  ('T', 'T: 남아시아',                    'Zone T: South Asia',            ARRAY['PK','BD','LK','NP','BT','MV'], 20),
  ('U', 'U: 아프리카',                    'Zone U: Africa',                ARRAY['ZA','EG','NG','KE','MA','TN','GH','TZ','ET','UG','DZ','SN','CI'], 21),
  ('V', 'V: 러시아·CIS',                  'Zone V: Russia & CIS',          ARRAY['RU','UA','BY','KZ','UZ','GE','AZ','AM'], 22),
  ('W', 'W: 오세아니아·태평양',           'Zone W: Pacific',               ARRAY['FJ','PG','NC','PF','GU','WS'], 23),
  ('X', 'X: 카리브해',                    'Zone X: Caribbean',             ARRAY['CU','DO','HT','JM','TT','PR'], 24),
  ('Y', 'Y: 기타 국가',                   'Zone Y: Other',                 ARRAY[]::TEXT[], 25)
ON CONFLICT (code) DO UPDATE
SET name_ko = EXCLUDED.name_ko,
    name_en = EXCLUDED.name_en,
    countries = EXCLUDED.countries,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

-- 5) 계약서 (PricingAgreement 2520066223-100) 의 export 할인 시드
--    각 행 = (서비스, 권역, 무게_kg_max, 할인%)
--    list_rate_krw 는 NULL → 보드 또는 FedEx Service Guide URL 에서 추후 채움.
--    rate_usd 는 NULL (동적 계산용)

WITH agg AS (
  SELECT s.id AS service_id, s.code AS service_code, z.id AS zone_id, z.code AS zone_code
  FROM print_shipping_services s
  CROSS JOIN print_shipping_zones z
)
INSERT INTO print_shipping_rates (service_id, zone_id, weight_kg_max, discount_pct, rate_usd, effective_from)
SELECT a.service_id, a.zone_id, x.weight_kg_max, x.discount_pct, 0, '2026-03-11'
FROM agg a
JOIN (
  VALUES
    -- ===== FedEx International Priority Export (fedex_ip) =====
    -- 권역 D (미국·캐나다)
    ('fedex_ip', 'A',  2.5,  82.22),
    ('fedex_ip', 'A',  5.0,  81.49),
    ('fedex_ip', 'A',  10.0, 82.26),
    ('fedex_ip', 'A',  20.5, 80.6),
    ('fedex_ip', 'A',  44.5, 80.28),
    ('fedex_ip', 'A',  70.5, 80.17),
    ('fedex_ip', 'A',  99.0, 81.51),
    ('fedex_ip', 'A',  299.0, 81.13),
    ('fedex_ip', 'A',  499.0, 81.0),
    ('fedex_ip', 'A',  999.0, 81.69),
    ('fedex_ip', 'A',  9999.0, 81.69),
    -- Zone D (US/CA)
    ('fedex_ip', 'D',  2.5,  77.41),
    ('fedex_ip', 'D',  5.0,  76.29),
    ('fedex_ip', 'D',  10.0, 74.36),
    ('fedex_ip', 'D',  20.5, 70.99),
    ('fedex_ip', 'D',  44.5, 66.66),
    ('fedex_ip', 'D',  70.5, 62.39),
    ('fedex_ip', 'D',  99.0, 61.97),
    ('fedex_ip', 'D',  299.0, 61.1),
    ('fedex_ip', 'D',  499.0, 60.61),
    ('fedex_ip', 'D',  999.0, 61.4),
    ('fedex_ip', 'D',  9999.0, 61.4),
    -- Zone E (CN)
    ('fedex_ip', 'E',  2.5,  71.2),
    ('fedex_ip', 'E',  5.0,  69.5),
    ('fedex_ip', 'E',  10.0, 68.25),
    ('fedex_ip', 'E',  20.5, 73.7),
    ('fedex_ip', 'E',  44.5, 66.73),
    ('fedex_ip', 'E',  70.5, 66.77),
    ('fedex_ip', 'E',  99.0, 67.11),
    ('fedex_ip', 'E',  299.0, 67.15),
    ('fedex_ip', 'E',  9999.0, 66.93),
    -- Zone F (HK/MO)
    ('fedex_ip', 'F',  2.5,  75.37),
    ('fedex_ip', 'F',  5.0,  70.55),
    ('fedex_ip', 'F',  10.0, 68.54),
    ('fedex_ip', 'F',  20.5, 73.24),
    ('fedex_ip', 'F',  44.5, 66.55),
    ('fedex_ip', 'F',  70.5, 66.5),
    ('fedex_ip', 'F',  99.0, 66.84),
    ('fedex_ip', 'F',  299.0, 67.14),
    ('fedex_ip', 'F',  9999.0, 66.66),
    -- Zone G
    ('fedex_ip', 'G',  2.5,  80.2),
    ('fedex_ip', 'G',  5.0,  78.08),
    ('fedex_ip', 'G',  10.0, 75.04),
    ('fedex_ip', 'G',  20.5, 73.7),
    ('fedex_ip', 'G',  44.5, 73.25),
    ('fedex_ip', 'G',  70.5, 73.23),
    ('fedex_ip', 'G',  99.0, 73.81),
    ('fedex_ip', 'G',  299.0, 73.85),
    ('fedex_ip', 'G',  9999.0, 73.61),
    -- Zone H
    ('fedex_ip', 'H',  2.5,  79.45),
    ('fedex_ip', 'H',  5.0,  79.33),
    ('fedex_ip', 'H',  10.0, 76.02),
    ('fedex_ip', 'H',  20.5, 75.0),
    ('fedex_ip', 'H',  44.5, 74.31),
    ('fedex_ip', 'H',  70.5, 72.42),
    ('fedex_ip', 'H',  99.0, 71.98),
    ('fedex_ip', 'H',  299.0, 71.99),
    ('fedex_ip', 'H',  9999.0, 71.27),
    -- Zone I
    ('fedex_ip', 'I',  2.5,  72.33),
    ('fedex_ip', 'I',  5.0,  72.75),
    ('fedex_ip', 'I',  10.0, 74.03),
    ('fedex_ip', 'I',  20.5, 73.37),
    ('fedex_ip', 'I',  44.5, 75.31),
    ('fedex_ip', 'I',  70.5, 73.76),
    ('fedex_ip', 'I',  99.0, 74.14),
    ('fedex_ip', 'I',  299.0, 74.18),
    ('fedex_ip', 'I',  9999.0, 74.47),
    -- Zone K (Western Europe)
    ('fedex_ip', 'K',  2.5,  80.81),
    ('fedex_ip', 'K',  5.0,  79.71),
    ('fedex_ip', 'K',  10.0, 80.16),
    ('fedex_ip', 'K',  20.5, 77.52),
    ('fedex_ip', 'K',  44.5, 80.41),
    ('fedex_ip', 'K',  70.5, 79.5),
    ('fedex_ip', 'K',  99.0, 78.45),
    ('fedex_ip', 'K',  299.0, 78.17),
    ('fedex_ip', 'K',  9999.0, 78.17),
    -- Zone P (AU/NZ)
    ('fedex_ip', 'P',  2.5,  82.85),
    ('fedex_ip', 'P',  5.0,  83.35),
    ('fedex_ip', 'P',  10.0, 82.2),
    ('fedex_ip', 'P',  20.5, 79.11),
    ('fedex_ip', 'P',  44.5, 78.38),
    ('fedex_ip', 'P',  70.5, 76.1),
    ('fedex_ip', 'P',  99.0, 76.08),
    ('fedex_ip', 'P',  299.0, 75.76),
    ('fedex_ip', 'P',  9999.0, 76.27),
    -- ===== FedEx International Economy Export (fedex_ie) =====
    ('fedex_ie', 'D',  2.5,  76.74),
    ('fedex_ie', 'D',  5.0,  77.27),
    ('fedex_ie', 'D',  10.0, 75.26),
    ('fedex_ie', 'D',  20.5, 70.99),
    ('fedex_ie', 'D',  44.5, 66.27),
    ('fedex_ie', 'D',  70.5, 62.17),
    ('fedex_ie', 'D',  99.0, 62.12),
    ('fedex_ie', 'D',  299.0, 61.13),
    ('fedex_ie', 'D',  9999.0, 61.62),
    ('fedex_ie', 'A',  2.5,  80.76),
    ('fedex_ie', 'A',  5.0,  81.53),
    ('fedex_ie', 'A',  10.0, 80.81),
    ('fedex_ie', 'A',  20.5, 78.96),
    ('fedex_ie', 'A',  44.5, 77.31),
    ('fedex_ie', 'A',  9999.0, 78.91),
    ('fedex_ie', 'E',  2.5,  70.1),
    ('fedex_ie', 'E',  5.0,  68.38),
    ('fedex_ie', 'E',  10.0, 67.23),
    ('fedex_ie', 'E',  20.5, 75.0),
    ('fedex_ie', 'E',  9999.0, 62.81),
    ('fedex_ie', 'K',  2.5,  74.19),
    ('fedex_ie', 'K',  5.0,  69.56),
    ('fedex_ie', 'K',  10.0, 67.72),
    ('fedex_ie', 'K',  9999.0, 62.57),
    ('fedex_ie', 'P',  2.5,  82.35),
    ('fedex_ie', 'P',  5.0,  82.15),
    ('fedex_ie', 'P',  10.0, 81.0),
    ('fedex_ie', 'P',  9999.0, 72.35)
) AS x(service_code, zone_code, weight_kg_max, discount_pct)
  ON x.service_code = a.service_code AND x.zone_code = a.zone_code
ON CONFLICT (service_id, zone_id, weight_kg_max, effective_from) DO UPDATE
SET discount_pct = EXCLUDED.discount_pct,
    rate_usd = 0;

-- 6) 인덱스: zone × service × weight 조회 가속
CREATE INDEX IF NOT EXISTS idx_print_shipping_rates_zone_service_weight
  ON print_shipping_rates (zone_id, service_id, weight_kg_max);
