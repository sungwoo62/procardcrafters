-- =============================================================
-- print_portfolio 테이블 — 포트폴리오/작업사례 갤러리
-- Procardcrafters (procardcrafters.com)
-- =============================================================

CREATE TABLE IF NOT EXISTS print_portfolio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  -- 카테고리 (상품 종류)
  category TEXT NOT NULL CHECK (category IN ('business_cards', 'stickers', 'flyers', 'postcards', 'posters', 'other')),
  -- 이미지 (Supabase Storage URL)
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  -- 태그 (콤마 구분 없이 배열로 저장)
  tags TEXT[] DEFAULT '{}',
  -- 공개 여부
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_published BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_print_portfolio_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_print_portfolio_updated_at
  BEFORE UPDATE ON print_portfolio
  FOR EACH ROW EXECUTE FUNCTION update_print_portfolio_updated_at();

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_print_portfolio_category ON print_portfolio(category);
CREATE INDEX IF NOT EXISTS idx_print_portfolio_published ON print_portfolio(is_published, sort_order);
CREATE INDEX IF NOT EXISTS idx_print_portfolio_featured ON print_portfolio(is_featured, is_published);

-- RLS 활성화
ALTER TABLE print_portfolio ENABLE ROW LEVEL SECURITY;

-- 공개 포트폴리오는 누구나 읽기 가능
CREATE POLICY "print_portfolio_public_read"
  ON print_portfolio FOR SELECT
  USING (is_published = true);

-- 서비스 롤만 수정 가능 (관리자 API 경유)
CREATE POLICY "print_portfolio_service_write"
  ON print_portfolio FOR ALL
  USING (auth.role() = 'service_role');

-- 샘플 데이터 삽입
INSERT INTO print_portfolio (title, description, category, image_url, thumbnail_url, tags, is_featured, sort_order) VALUES
(
  'Minimalist Business Card — Law Firm',
  'Clean single-color letterpress effect on 400gsm soft-touch matte.',
  'business_cards',
  'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=1200&q=80',
  'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600&q=80',
  ARRAY['minimalist', 'matte', 'letterpress'],
  true, 1
),
(
  'Holographic Sticker Pack — Brand Kit',
  'Custom die-cut holographic stickers for product packaging.',
  'stickers',
  'https://images.unsplash.com/photo-1527049214551-1b7ea6a8c9d3?w=1200&q=80',
  'https://images.unsplash.com/photo-1527049214551-1b7ea6a8c9d3?w=600&q=80',
  ARRAY['holographic', 'die-cut', 'packaging'],
  true, 2
),
(
  'Event Flyer — Music Festival',
  'Full-bleed CMYK flyer with vibrant gradient on glossy stock.',
  'flyers',
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&q=80',
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&q=80',
  ARRAY['event', 'glossy', 'full-bleed'],
  true, 3
),
(
  'Luxury Postcard — Real Estate',
  'Double-sided matte postcard with UV spot coating on key elements.',
  'postcards',
  'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1200&q=80',
  'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=600&q=80',
  ARRAY['luxury', 'UV coating', 'real estate'],
  false, 4
),
(
  'Retail Poster — Coffee Shop',
  'A2 poster printed on 200gsm coated paper. Perfect wall art.',
  'posters',
  'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=1200&q=80',
  'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&q=80',
  ARRAY['retail', 'A2', 'coffee'],
  false, 5
),
(
  'Foil Business Card — Jewelry Brand',
  'Gold foil stamping on soft-touch laminate. Ultra premium feel.',
  'business_cards',
  'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=1200&q=80',
  'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=600&q=80',
  ARRAY['foil', 'premium', 'luxury'],
  true, 6
),
(
  'Round Sticker Set — Food Brand',
  'Circular kiss-cut stickers on a sheet. Water-resistant vinyl.',
  'stickers',
  'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1200&q=80',
  'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=600&q=80',
  ARRAY['round', 'vinyl', 'food'],
  false, 7
),
(
  'Double-sided Flyer — Gym Promo',
  'Bold typography, spot UV on front, info-dense back panel.',
  'flyers',
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&q=80',
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&q=80',
  ARRAY['double-sided', 'spot UV', 'fitness'],
  false, 8
);
