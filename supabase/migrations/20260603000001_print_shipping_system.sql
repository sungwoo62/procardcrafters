-- 물류 시스템: FedEx 권역 / 요금표 / 송장(shipment) 관리
-- 원산지: 한국(KR), 기본 통화: USD

-- 1) 배송 권역 (Zone)
--    name = 'A','B','C',...  또는 'Zone 1' 처럼 자유롭게
--    countries = ISO-2 국가 코드 배열
CREATE TABLE IF NOT EXISTS print_shipping_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name_ko TEXT NOT NULL,
  name_en TEXT NOT NULL,
  countries TEXT[] NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_print_shipping_zones_countries
  ON print_shipping_zones USING GIN (countries);

-- 2) FedEx 서비스 (International Priority / Economy / 등)
CREATE TABLE IF NOT EXISTS print_shipping_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name_ko TEXT NOT NULL,
  name_en TEXT NOT NULL,
  carrier TEXT NOT NULL DEFAULT 'fedex',
  est_days_min INT,
  est_days_max INT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3) 요금표: zone × weight bracket × service
--    weight_kg_max 까지의 요율 (예: 0.5, 1.0, 1.5, ..., 30, 40, 50)
--    rate_usd 는 그 무게 구간의 요금 (이미 USD로 변환된 값)
CREATE TABLE IF NOT EXISTS print_shipping_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES print_shipping_services(id) ON DELETE CASCADE,
  zone_id UUID NOT NULL REFERENCES print_shipping_zones(id) ON DELETE CASCADE,
  weight_kg_max NUMERIC(8, 3) NOT NULL,
  rate_usd NUMERIC(12, 2) NOT NULL,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (service_id, zone_id, weight_kg_max, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_print_shipping_rates_lookup
  ON print_shipping_rates (zone_id, service_id, weight_kg_max);

-- 4) 부가세/마진 설정 (10% 가산)
CREATE TABLE IF NOT EXISTS print_shipping_config (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  vat_markup_percent NUMERIC(5, 2) NOT NULL DEFAULT 10.00,
  origin_country TEXT NOT NULL DEFAULT 'KR',
  default_weight_kg NUMERIC(8, 3) NOT NULL DEFAULT 1.0,
  fallback_rate_usd NUMERIC(12, 2) NOT NULL DEFAULT 35.00,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO print_shipping_config (id, vat_markup_percent, origin_country, default_weight_kg, fallback_rate_usd)
VALUES (1, 10.00, 'KR', 1.0, 35.00)
ON CONFLICT (id) DO NOTHING;

-- 5) 송장(shipment): 한 주문이 여러 박스로 나뉠 수 있으므로 N개 허용
CREATE TABLE IF NOT EXISTS print_shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES print_orders(id) ON DELETE CASCADE,
  service_id UUID REFERENCES print_shipping_services(id),
  zone_id UUID REFERENCES print_shipping_zones(id),
  carrier TEXT NOT NULL DEFAULT 'fedex',
  tracking_number TEXT,
  weight_kg NUMERIC(8, 3),
  length_cm NUMERIC(8, 2),
  width_cm NUMERIC(8, 2),
  height_cm NUMERIC(8, 2),
  cost_usd NUMERIC(12, 2),                    -- FedEx 원가
  charged_usd NUMERIC(12, 2),                 -- 고객에게 청구한 금액 (원가 + 10%)
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'label_created', 'in_transit', 'delivered', 'returned', 'cancelled')),
  label_storage_path TEXT,                    -- 라벨 PDF 위치 (Supabase Storage)
  packing_slip_storage_path TEXT,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_print_shipments_order ON print_shipments (order_id);
CREATE INDEX IF NOT EXISTS idx_print_shipments_tracking ON print_shipments (tracking_number);
CREATE INDEX IF NOT EXISTS idx_print_shipments_status ON print_shipments (status);

-- print_order_events.event_type 체크 확장: 송장 라이프사이클 이벤트 추가
ALTER TABLE print_order_events DROP CONSTRAINT IF EXISTS print_order_events_event_type_check;
ALTER TABLE print_order_events ADD CONSTRAINT print_order_events_event_type_check CHECK (event_type IN (
  'status_change',
  'email_sent',
  'payment_received',
  'payment_failed',
  'fraud_alert',
  'file_uploaded',
  'file_approved',
  'file_rejected',
  'shipment_created',
  'shipped',
  'delivered'
));

-- 6) 제품 기본 무게 (kg) — 배송비 견적용
ALTER TABLE print_products ADD COLUMN IF NOT EXISTS default_weight_kg NUMERIC(8, 3) NOT NULL DEFAULT 0.5;

-- 7) RLS
ALTER TABLE print_shipping_zones    ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_shipping_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_shipping_rates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_shipping_config   ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_shipments         ENABLE ROW LEVEL SECURITY;

-- 누구나 읽기 (체크아웃에서 요율 조회 필요)
DROP POLICY IF EXISTS "shipping_zones_read"    ON print_shipping_zones;
DROP POLICY IF EXISTS "shipping_services_read" ON print_shipping_services;
DROP POLICY IF EXISTS "shipping_rates_read"    ON print_shipping_rates;
DROP POLICY IF EXISTS "shipping_config_read"   ON print_shipping_config;

CREATE POLICY "shipping_zones_read"    ON print_shipping_zones    FOR SELECT USING (TRUE);
CREATE POLICY "shipping_services_read" ON print_shipping_services FOR SELECT USING (TRUE);
CREATE POLICY "shipping_rates_read"    ON print_shipping_rates    FOR SELECT USING (TRUE);
CREATE POLICY "shipping_config_read"   ON print_shipping_config   FOR SELECT USING (TRUE);

-- shipments 는 service_role 만 읽기/쓰기 (관리자 API 경유)
DROP POLICY IF EXISTS "shipments_service" ON print_shipments;
CREATE POLICY "shipments_service" ON print_shipments
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- 8) FedEx Korea International Priority 표준 권역 시드 (요율은 0 = 추후 보드에서 임포트)
INSERT INTO print_shipping_services (code, name_ko, name_en, carrier, est_days_min, est_days_max, sort_order)
VALUES
  ('fedex_ip', 'FedEx International Priority', 'FedEx International Priority', 'fedex', 1, 3, 1),
  ('fedex_ie', 'FedEx International Economy', 'FedEx International Economy', 'fedex', 4, 6, 2)
ON CONFLICT (code) DO NOTHING;

INSERT INTO print_shipping_zones (code, name_ko, name_en, countries, sort_order) VALUES
  ('A', '권역 A - 일본',              'Zone A - Japan',                ARRAY['JP'],                                                                                         1),
  ('B', '권역 B - 동아시아',          'Zone B - East Asia',            ARRAY['CN','HK','TW','MO'],                                                                          2),
  ('C', '권역 C - 동남아시아',        'Zone C - Southeast Asia',       ARRAY['SG','TH','MY','PH','ID','VN','BN','KH','LA','MM'],                                            3),
  ('D', '권역 D - 미주',              'Zone D - Americas',             ARRAY['US','CA','MX','BR','AR','CL','CO','PE'],                                                      4),
  ('E', '권역 E - 유럽',              'Zone E - Europe',               ARRAY['GB','DE','FR','IT','ES','NL','BE','SE','NO','DK','FI','PL','PT','AT','CH','IE','CZ','HU','RO','GR','BG','HR','SK','SI','LU','EE','LV','LT','MT','CY','IS'], 5),
  ('F', '권역 F - 오세아니아',        'Zone F - Oceania',              ARRAY['AU','NZ','FJ','PG'],                                                                          6),
  ('G', '권역 G - 중동/남아시아',     'Zone G - Middle East/S.Asia',   ARRAY['AE','SA','QA','KW','BH','OM','IL','TR','IN','PK','BD','LK','NP'],                              7),
  ('H', '권역 H - 아프리카/기타',     'Zone H - Africa/Other',         ARRAY['ZA','EG','NG','KE','MA','TN','GH','TZ','ET','RU','UA','KZ'],                                   8)
ON CONFLICT (code) DO NOTHING;
