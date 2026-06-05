-- OMO-2399: Vistaprint·MOO 대비 가격 비교 배지 인프라
-- 경쟁사 가격 수동 등록 → 7일 이내 데이터만 배지 노출

CREATE TABLE print_competitor_prices (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_slug       text NOT NULL,          -- print_products.slug 참조
  competitor     text NOT NULL CHECK (competitor IN ('vistaprint', 'moo')),
  sku_variant    text NOT NULL,          -- 예: "500 cards, 3.5×2in, 14pt matte"
  quantity       integer,               -- 수량 (null=spec 기반 비교)
  competitor_price_usd  numeric(10,2) NOT NULL CHECK (competitor_price_usd > 0),
  our_price_usd  numeric(10,2) NOT NULL CHECK (our_price_usd > 0),
  spec_notes     text,                  -- 추가 spec 차이 설명 (Option B)
  captured_at    timestamptz NOT NULL DEFAULT now(),
  source_url     text NOT NULL,
  captured_by    text NOT NULL DEFAULT 'manual',
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_competitor_prices_slug ON print_competitor_prices (sku_slug);
CREATE INDEX idx_competitor_prices_captured ON print_competitor_prices (captured_at DESC);

-- View: 신선한 데이터 + 실제로 저렴한 경우만, 절감률 포함
CREATE VIEW print_competitor_price_summary AS
SELECT
  cp.*,
  (cp.captured_at > now() - interval '7 days')                              AS is_fresh,
  ROUND(
    (cp.competitor_price_usd - cp.our_price_usd)
    / cp.competitor_price_usd * 100
  )::integer                                                                 AS savings_pct,
  to_char(cp.captured_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')                  AS captured_date
FROM print_competitor_prices cp
WHERE cp.competitor_price_usd > cp.our_price_usd   -- 실제로 우리가 저렴할 때만
ORDER BY cp.captured_at DESC;

-- RLS: anon read for fresh data only; service_role unrestricted
ALTER TABLE print_competitor_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_fresh_competitor_prices"
  ON print_competitor_prices FOR SELECT
  USING (
    captured_at > now() - interval '7 days'
    AND competitor_price_usd > our_price_usd
  );

CREATE POLICY "service_role_all"
  ON print_competitor_prices FOR ALL
  USING (auth.role() = 'service_role');
