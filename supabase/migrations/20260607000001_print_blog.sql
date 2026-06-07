-- =============================================================
-- 블로그 플랫폼 — print_blog_categories / print_blog_posts
-- Procardcrafters (procardcrafters.com) — OMO-2569
-- prefix `print_` 준수. RLS: public read(is_published), service_role write.
-- print_portfolio 정책 패턴 재사용.
-- =============================================================

-- -------------------------------------------------------------
-- 카테고리 (블로그 아카이브 그룹핑)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS print_blog_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------------
-- 글
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS print_blog_posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT NOT NULL UNIQUE,
  category_id     UUID REFERENCES print_blog_categories(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  excerpt         TEXT,
  -- 본문은 마크다운 원문으로 저장 → 서버에서 HTML/next-image 로 렌더.
  body_md         TEXT NOT NULL DEFAULT '',
  cover_image_url TEXT,
  -- 본문 인라인 이미지 메타(예: [{ "url": "...", "alt": "...", "caption": "..." }]).
  body_images     JSONB NOT NULL DEFAULT '[]'::jsonb,
  tags            TEXT[] NOT NULL DEFAULT '{}',
  -- SEO 오버라이드 (없으면 title/excerpt/cover 로 폴백).
  seo_title       TEXT,
  seo_description TEXT,
  og_image_url    TEXT,
  is_published    BOOLEAN NOT NULL DEFAULT false,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_print_blog_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_print_blog_posts_updated_at ON print_blog_posts;
CREATE TRIGGER trg_print_blog_posts_updated_at
  BEFORE UPDATE ON print_blog_posts
  FOR EACH ROW EXECUTE FUNCTION update_print_blog_posts_updated_at();

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_print_blog_posts_published
  ON print_blog_posts(is_published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_print_blog_posts_category
  ON print_blog_posts(category_id, is_published);
CREATE INDEX IF NOT EXISTS idx_print_blog_categories_sort
  ON print_blog_categories(sort_order);

-- -------------------------------------------------------------
-- RLS — print_portfolio 패턴 재사용
-- -------------------------------------------------------------
ALTER TABLE print_blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_blog_posts ENABLE ROW LEVEL SECURITY;

-- 카테고리: 공개 읽기 (아카이브 네비게이션용 — 항상 노출).
DROP POLICY IF EXISTS "print_blog_categories_public_read" ON print_blog_categories;
CREATE POLICY "print_blog_categories_public_read"
  ON print_blog_categories FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "print_blog_categories_service_write" ON print_blog_categories;
CREATE POLICY "print_blog_categories_service_write"
  ON print_blog_categories FOR ALL
  USING (auth.role() = 'service_role');

-- 글: 발행된 글만 공개 읽기.
DROP POLICY IF EXISTS "print_blog_posts_public_read" ON print_blog_posts;
CREATE POLICY "print_blog_posts_public_read"
  ON print_blog_posts FOR SELECT
  USING (is_published = true);

DROP POLICY IF EXISTS "print_blog_posts_service_write" ON print_blog_posts;
CREATE POLICY "print_blog_posts_service_write"
  ON print_blog_posts FOR ALL
  USING (auth.role() = 'service_role');
