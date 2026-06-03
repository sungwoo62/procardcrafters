-- ProCardCrafters Seed Data
-- Run against Supabase SQL Editor

-- ============================================
-- Categories
-- ============================================
INSERT INTO product_categories (id, name, slug, description, parent_id, sort_order)
VALUES
  ('cat-printing', 'Printing', 'printing', 'All printing products', NULL, 1),
  ('cat-business-cards', 'Business Cards', 'business-cards', 'Professional business cards for every occasion', 'cat-printing', 1),
  ('cat-flyers', 'Flyers & Leaflets', 'flyers-leaflets', 'High-quality flyers and leaflets', 'cat-printing', 2),
  ('cat-banners', 'Banners & Displays', 'banners-displays', 'Large format banners and display stands', 'cat-printing', 3),
  ('cat-stickers', 'Stickers & Labels', 'stickers-labels', 'Custom stickers and labels', 'cat-printing', 4),
  ('cat-packaging', 'Packaging', 'packaging', 'Custom boxes and packaging solutions', 'cat-printing', 5),
  ('cat-lanyards', 'Lanyards & Accessories', 'lanyards-accessories', 'Lanyards, badges, and event accessories', 'cat-printing', 6)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Products
-- ============================================
INSERT INTO products (id, name, slug, category_id, description, base_price, is_active)
VALUES
  (
    'prod-standard-bc',
    'Standard Business Cards',
    'standard-business-cards',
    'cat-business-cards',
    'Classic 90×50mm business cards. Choose from a range of premium papers and finishes to make a lasting first impression.',
    7.50,
    true
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Option Groups
-- ============================================
INSERT INTO option_groups (id, product_id, name, label, sort_order)
VALUES
  ('og-paper', 'prod-standard-bc', 'paper_type', 'Paper Type', 1),
  ('og-finish', 'prod-standard-bc', 'finish', 'Finish', 2),
  ('og-qty', 'prod-standard-bc', 'quantity', 'Quantity', 3)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Option Values
-- ============================================
INSERT INTO option_values (id, group_id, name, label, sort_order)
VALUES
  -- Paper Type
  ('ov-art250', 'og-paper', 'Art 250gsm', 'Art 250gsm', 1),
  ('ov-snow250', 'og-paper', 'Snow White 250gsm', 'Snow White 250gsm', 2),
  ('ov-prem300', 'og-paper', 'Premium 300gsm', 'Premium 300gsm', 3),
  -- Finish
  ('ov-uncoated', 'og-finish', 'Uncoated', 'Uncoated', 1),
  ('ov-glossy', 'og-finish', 'Glossy', 'Glossy', 2),
  ('ov-matte', 'og-finish', 'Matte', 'Matte', 3),
  -- Quantity
  ('ov-q100', 'og-qty', '100', '100', 1),
  ('ov-q250', 'og-qty', '250', '250', 2),
  ('ov-q500', 'og-qty', '500', '500', 3),
  ('ov-q1000', 'og-qty', '1000', '1000', 4)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Price Rules (Art 250gsm + Uncoated as base)
-- Other combos marked with multipliers
-- ============================================

-- Art 250gsm + Uncoated
INSERT INTO price_rules (product_id, option_combination, price) VALUES
  ('prod-standard-bc', '{"paper_type": "Art 250gsm", "finish": "Uncoated", "quantity": "100"}', 7.50),
  ('prod-standard-bc', '{"paper_type": "Art 250gsm", "finish": "Uncoated", "quantity": "250"}', 12.00),
  ('prod-standard-bc', '{"paper_type": "Art 250gsm", "finish": "Uncoated", "quantity": "500"}', 18.00),
  ('prod-standard-bc', '{"paper_type": "Art 250gsm", "finish": "Uncoated", "quantity": "1000"}', 28.00),

-- Art 250gsm + Glossy
  ('prod-standard-bc', '{"paper_type": "Art 250gsm", "finish": "Glossy", "quantity": "100"}', 9.00),
  ('prod-standard-bc', '{"paper_type": "Art 250gsm", "finish": "Glossy", "quantity": "250"}', 14.50),
  ('prod-standard-bc', '{"paper_type": "Art 250gsm", "finish": "Glossy", "quantity": "500"}', 22.00),
  ('prod-standard-bc', '{"paper_type": "Art 250gsm", "finish": "Glossy", "quantity": "1000"}', 34.00),

-- Art 250gsm + Matte
  ('prod-standard-bc', '{"paper_type": "Art 250gsm", "finish": "Matte", "quantity": "100"}', 9.50),
  ('prod-standard-bc', '{"paper_type": "Art 250gsm", "finish": "Matte", "quantity": "250"}', 15.00),
  ('prod-standard-bc', '{"paper_type": "Art 250gsm", "finish": "Matte", "quantity": "500"}', 23.00),
  ('prod-standard-bc', '{"paper_type": "Art 250gsm", "finish": "Matte", "quantity": "1000"}', 35.50),

-- Snow White 250gsm + Uncoated
  ('prod-standard-bc', '{"paper_type": "Snow White 250gsm", "finish": "Uncoated", "quantity": "100"}', 8.50),
  ('prod-standard-bc', '{"paper_type": "Snow White 250gsm", "finish": "Uncoated", "quantity": "250"}', 13.50),
  ('prod-standard-bc', '{"paper_type": "Snow White 250gsm", "finish": "Uncoated", "quantity": "500"}', 20.50),
  ('prod-standard-bc', '{"paper_type": "Snow White 250gsm", "finish": "Uncoated", "quantity": "1000"}', 32.00),

-- Snow White 250gsm + Glossy
  ('prod-standard-bc', '{"paper_type": "Snow White 250gsm", "finish": "Glossy", "quantity": "100"}', 10.00),
  ('prod-standard-bc', '{"paper_type": "Snow White 250gsm", "finish": "Glossy", "quantity": "250"}', 16.00),
  ('prod-standard-bc', '{"paper_type": "Snow White 250gsm", "finish": "Glossy", "quantity": "500"}', 25.00),
  ('prod-standard-bc', '{"paper_type": "Snow White 250gsm", "finish": "Glossy", "quantity": "1000"}', 38.50),

-- Snow White 250gsm + Matte
  ('prod-standard-bc', '{"paper_type": "Snow White 250gsm", "finish": "Matte", "quantity": "100"}', 10.50),
  ('prod-standard-bc', '{"paper_type": "Snow White 250gsm", "finish": "Matte", "quantity": "250"}', 16.50),
  ('prod-standard-bc', '{"paper_type": "Snow White 250gsm", "finish": "Matte", "quantity": "500"}', 26.00),
  ('prod-standard-bc', '{"paper_type": "Snow White 250gsm", "finish": "Matte", "quantity": "1000"}', 40.00),

-- Premium 300gsm + Uncoated
  ('prod-standard-bc', '{"paper_type": "Premium 300gsm", "finish": "Uncoated", "quantity": "100"}', 10.00),
  ('prod-standard-bc', '{"paper_type": "Premium 300gsm", "finish": "Uncoated", "quantity": "250"}', 16.00),
  ('prod-standard-bc', '{"paper_type": "Premium 300gsm", "finish": "Uncoated", "quantity": "500"}', 24.00),
  ('prod-standard-bc', '{"paper_type": "Premium 300gsm", "finish": "Uncoated", "quantity": "1000"}', 37.50),

-- Premium 300gsm + Glossy
  ('prod-standard-bc', '{"paper_type": "Premium 300gsm", "finish": "Glossy", "quantity": "100"}', 12.00),
  ('prod-standard-bc', '{"paper_type": "Premium 300gsm", "finish": "Glossy", "quantity": "250"}', 19.00),
  ('prod-standard-bc', '{"paper_type": "Premium 300gsm", "finish": "Glossy", "quantity": "500"}', 29.00),
  ('prod-standard-bc', '{"paper_type": "Premium 300gsm", "finish": "Glossy", "quantity": "1000"}', 45.00),

-- Premium 300gsm + Matte
  ('prod-standard-bc', '{"paper_type": "Premium 300gsm", "finish": "Matte", "quantity": "100"}', 12.50),
  ('prod-standard-bc', '{"paper_type": "Premium 300gsm", "finish": "Matte", "quantity": "250"}', 20.00),
  ('prod-standard-bc', '{"paper_type": "Premium 300gsm", "finish": "Matte", "quantity": "500"}', 30.00),
  ('prod-standard-bc', '{"paper_type": "Premium 300gsm", "finish": "Matte", "quantity": "1000"}', 46.50);
