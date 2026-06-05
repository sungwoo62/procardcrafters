-- print_shipping_services 테이블에 FedEx 공식 설명 문구 컬럼 추가
-- 출처: https://www.fedex.com/ko-kr/shipping/international.html

ALTER TABLE print_shipping_services
  ADD COLUMN IF NOT EXISTS description_en TEXT,
  ADD COLUMN IF NOT EXISTS description_ko TEXT,
  ADD COLUMN IF NOT EXISTS transit_time_label_en TEXT,
  ADD COLUMN IF NOT EXISTS transit_time_label_ko TEXT;

-- FedEx International Priority® (IP Export)
UPDATE print_shipping_services SET
  description_en = 'Fast, reliable delivery with a date-certain commitment to more than 220 countries and territories.',
  description_ko = '220개 이상의 국가·지역에 날짜를 보장하는 빠르고 안정적인 배송 서비스.',
  transit_time_label_en = '1–3 business days',
  transit_time_label_ko = '1–3 영업일'
WHERE code = 'fedex_ip';

-- FedEx International Economy® (IE Export)
UPDATE print_shipping_services SET
  description_en = 'Cost-effective international delivery to more than 215 countries and territories.',
  description_ko = '215개 이상의 국가·지역으로 보내는 경제적인 국제 배송 서비스.',
  transit_time_label_en = '2–5 business days',
  transit_time_label_ko = '2–5 영업일'
WHERE code = 'fedex_ie';

-- FedEx International Priority Express® (IPE Export)
UPDATE print_shipping_services SET
  description_en = 'FedEx International Priority® Express — premium speed with next-business-day service to select locations.',
  description_ko = 'FedEx International Priority® Express — 선택 지역에 익일 배송이 가능한 프리미엄 서비스.',
  transit_time_label_en = '1–2 business days',
  transit_time_label_ko = '1–2 영업일'
WHERE code = 'fedex_ipe';

-- FedEx International Priority® Pak
UPDATE print_shipping_services SET
  description_en = 'FedEx International Priority® service in a standardised pak — ideal for lightweight documents and merchandise.',
  description_ko = '표준 Pak 패키징으로 경량 서류·상품을 보내는 FedEx International Priority® 서비스.',
  transit_time_label_en = '1–3 business days',
  transit_time_label_ko = '1–3 영업일'
WHERE code = 'fedex_ip_pak';

-- FedEx International Priority® Envelope
UPDATE print_shipping_services SET
  description_en = 'FedEx International Priority® service in an envelope — best for documents and flat items.',
  description_ko = '서류·평면 물품에 최적화된 봉투형 FedEx International Priority® 서비스.',
  transit_time_label_en = '1–3 business days',
  transit_time_label_ko = '1–3 영업일'
WHERE code = 'fedex_ip_env';

-- FedEx International Priority Express® Pak
UPDATE print_shipping_services SET
  description_en = 'FedEx International Priority® Express service in a pak — fastest option for lightweight shipments.',
  description_ko = '경량 화물에 대한 가장 빠른 Pak 배송 서비스.',
  transit_time_label_en = '1–2 business days',
  transit_time_label_ko = '1–2 영업일'
WHERE code = 'fedex_ipe_pak';

-- FedEx International Priority Express® Envelope
UPDATE print_shipping_services SET
  description_en = 'FedEx International Priority® Express service in an envelope — fastest option for documents.',
  description_ko = '서류에 대한 가장 빠른 봉투형 배송 서비스.',
  transit_time_label_en = '1–2 business days',
  transit_time_label_ko = '1–2 영업일'
WHERE code = 'fedex_ipe_env';
