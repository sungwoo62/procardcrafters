-- 발신지(원산지) 회사 정보를 print_shipping_config 로 이전
-- 이전: 패킹슬립 페이지에 하드코딩 ("서울시 (주소 보드 설정)")
-- 변경: DB config 에서 읽어 표시 (보드가 admin UI 에서 한번 입력하면 끝)

ALTER TABLE print_shipping_config ADD COLUMN IF NOT EXISTS origin_company_ko    TEXT NOT NULL DEFAULT '오뭉뭉';
ALTER TABLE print_shipping_config ADD COLUMN IF NOT EXISTS origin_company_en    TEXT NOT NULL DEFAULT 'Omoongmoo';
ALTER TABLE print_shipping_config ADD COLUMN IF NOT EXISTS origin_address_line1 TEXT NOT NULL DEFAULT '';
ALTER TABLE print_shipping_config ADD COLUMN IF NOT EXISTS origin_address_line2 TEXT;
ALTER TABLE print_shipping_config ADD COLUMN IF NOT EXISTS origin_city          TEXT NOT NULL DEFAULT 'BUCHEON';
ALTER TABLE print_shipping_config ADD COLUMN IF NOT EXISTS origin_state         TEXT;
ALTER TABLE print_shipping_config ADD COLUMN IF NOT EXISTS origin_postal_code   TEXT NOT NULL DEFAULT '14488';
ALTER TABLE print_shipping_config ADD COLUMN IF NOT EXISTS origin_phone         TEXT;
ALTER TABLE print_shipping_config ADD COLUMN IF NOT EXISTS origin_email         TEXT;

-- 계약서(PricingAgreement) 에 명시된 주소로 시드 (실제 라벨 인쇄에 사용)
UPDATE print_shipping_config
SET origin_company_ko = 'ALLPACKMEISTER CO., LTD.',
    origin_company_en = 'ALLPACKMEISTER CO., LTD.',
    origin_address_line1 = '20, GILJU-RO 411BEON-GIL, 618HO',
    origin_city = 'BUCHEON',
    origin_state = 'WONMI-GU',
    origin_postal_code = '14488',
    updated_at = NOW()
WHERE id = 1
  AND (origin_address_line1 IS NULL OR origin_address_line1 = '');
