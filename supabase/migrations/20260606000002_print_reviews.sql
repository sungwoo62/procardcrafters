-- =====================================================================
-- OMO-2403: print_reviews 리뷰·레이팅 시스템
--   - print_reviews (source enum, disclosure CHECK, admin fields, featured)
--   - print_review_admin_audit (감사 로그)
--   - print_review_coupons (review_id 1:1, $2 쿠폰, 30일 만료)
--   - view print_product_review_stats
--   - RLS: 공개 SELECT approved 한정, INSERT = 배송완료/배송중 주문 보유
--   - CHECK: verified_purchase → order_id NOT NULL AND created_by_admin=false
-- =====================================================================

-- ─────────────────────────────────────────────
-- ENUM 타입
-- ─────────────────────────────────────────────
CREATE TYPE print_review_source AS ENUM (
  'verified_purchase',
  'beta_tester',
  'incentivized',
  'imported',
  'team_member'
);

CREATE TYPE print_review_status AS ENUM (
  'pending',
  'approved',
  'rejected',
  'hidden'
);

CREATE TYPE print_review_coupon_status AS ENUM (
  'pending',
  'sent',
  'used',
  'expired'
);

-- ─────────────────────────────────────────────
-- print_reviews
-- ─────────────────────────────────────────────
CREATE TABLE print_reviews (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id           UUID        NOT NULL REFERENCES print_products(id) ON DELETE RESTRICT,
  order_id             UUID        REFERENCES print_orders(id) ON DELETE SET NULL,
  -- 작성자 (Supabase Auth 사용자; 비회원 주문은 NULL 허용)
  user_id              UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_name        TEXT        NOT NULL,
  -- 리뷰 내용
  rating               SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title                TEXT,
  body                 TEXT        NOT NULL,
  -- 출처
  source               print_review_source NOT NULL DEFAULT 'verified_purchase',
  -- 비구매 리뷰(인센티브·임포트·팀멤버·베타)는 공개 의무 텍스트 필수
  disclosure_note      TEXT,
  -- 어드민 증거/노트 (admin_evidence_url: 스크린샷·주문확인서 링크 등)
  admin_evidence_url   TEXT,
  admin_note           TEXT,
  created_by_admin     BOOLEAN     NOT NULL DEFAULT false,
  -- 홈페이지 피처드
  is_homepage_featured BOOLEAN     NOT NULL DEFAULT false,
  featured_quote       TEXT,        -- 발췌 인용문 (원문 일부 발췌)
  featured_sort        INT         NOT NULL DEFAULT 0,
  -- 상태
  status               print_review_status NOT NULL DEFAULT 'pending',
  -- 타임스탬프
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 비구매 출처는 공개 의무 텍스트 필수
  CONSTRAINT chk_disclosure_note CHECK (
    source = 'verified_purchase'
    OR disclosure_note IS NOT NULL
  ),
  -- verified_purchase: order_id 필수 + 어드민 직접 생성 불가
  CONSTRAINT chk_verified_purchase CHECK (
    source <> 'verified_purchase'
    OR (order_id IS NOT NULL AND created_by_admin = false)
  )
);

-- 인덱스
CREATE INDEX print_reviews_product_id       ON print_reviews(product_id);
CREATE INDEX print_reviews_status           ON print_reviews(status);
CREATE INDEX print_reviews_order_id         ON print_reviews(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX print_reviews_user_id          ON print_reviews(user_id)  WHERE user_id  IS NOT NULL;

-- 홈페이지 피처드 부분 인덱스 (이슈 요구사항)
CREATE INDEX print_reviews_homepage_featured
  ON print_reviews(featured_sort)
  WHERE is_homepage_featured = true AND status = 'approved';

-- updated_at 자동 갱신 (기존 update_updated_at() 재사용)
CREATE TRIGGER print_reviews_updated_at
  BEFORE UPDATE ON print_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────
-- print_review_admin_audit
-- ─────────────────────────────────────────────
CREATE TABLE print_review_admin_audit (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id     UUID        NOT NULL REFERENCES print_reviews(id) ON DELETE CASCADE,
  -- service_role 작업이면 NULL 가능 (JWT 없이 직접 실행)
  admin_user_id UUID,
  action        TEXT        NOT NULL CHECK (action IN (
    'created', 'approved', 'rejected', 'hidden',
    'featured', 'unfeatured', 'edited', 'deleted'
  )),
  old_status    print_review_status,
  new_status    print_review_status,
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX print_review_admin_audit_review_id ON print_review_admin_audit(review_id);
CREATE INDEX print_review_admin_audit_created_at ON print_review_admin_audit(created_at DESC);

-- ─────────────────────────────────────────────
-- print_review_coupons
-- 리뷰 1건당 1쿠폰 (UNIQUE review_id), 30일 만료
-- ─────────────────────────────────────────────
CREATE TABLE print_review_coupons (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id          UUID        NOT NULL UNIQUE REFERENCES print_reviews(id) ON DELETE CASCADE,
  code               TEXT        NOT NULL UNIQUE,
  amount_usd         NUMERIC(10, 2) NOT NULL DEFAULT 2.00,
  min_order_usd      NUMERIC(10, 2) NOT NULL DEFAULT 30.00,
  status             print_review_coupon_status NOT NULL DEFAULT 'pending',
  expires_at         TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  redeemed_at        TIMESTAMPTZ,
  redeemed_order_id  UUID        REFERENCES print_orders(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX print_review_coupons_code   ON print_review_coupons(code);
CREATE INDEX print_review_coupons_status ON print_review_coupons(status);

-- ─────────────────────────────────────────────
-- 통계 뷰: print_product_review_stats
-- approved 리뷰 기준 상품별 집계
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW print_product_review_stats AS
SELECT
  r.product_id,
  COUNT(*)::INT                                            AS total_reviews,
  ROUND(AVG(r.rating)::NUMERIC, 2)                        AS avg_rating,
  COUNT(*) FILTER (WHERE r.rating = 5)::INT               AS rating_5,
  COUNT(*) FILTER (WHERE r.rating = 4)::INT               AS rating_4,
  COUNT(*) FILTER (WHERE r.rating = 3)::INT               AS rating_3,
  COUNT(*) FILTER (WHERE r.rating = 2)::INT               AS rating_2,
  COUNT(*) FILTER (WHERE r.rating = 1)::INT               AS rating_1,
  COUNT(*) FILTER (WHERE r.is_homepage_featured)::INT     AS featured_count,
  MAX(r.created_at)                                       AS latest_review_at
FROM print_reviews r
WHERE r.status = 'approved'
GROUP BY r.product_id;

-- ─────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────
ALTER TABLE print_reviews          ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_review_admin_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_review_coupons   ENABLE ROW LEVEL SECURITY;

-- print_reviews: 공개 SELECT는 approved 한정
CREATE POLICY "print_reviews_public_select"
  ON print_reviews FOR SELECT
  USING (status = 'approved');

-- print_reviews: 인증 고객 INSERT — delivered/shipped 주문 보유 필수
-- (order_id 참조 주문의 customer_email = 로그인 사용자 email 확인)
CREATE POLICY "print_reviews_customer_insert"
  ON print_reviews FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
    AND order_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM print_orders po
      WHERE po.id = order_id
        AND po.customer_email = (auth.jwt() ->> 'email')
        AND po.status IN ('delivered', 'shipped')
    )
  );

-- print_reviews: 어드민 (service_role) 전체 접근
CREATE POLICY "print_reviews_admin_all"
  ON print_reviews FOR ALL
  USING (auth.role() = 'service_role');

-- print_review_admin_audit: 어드민 전체 접근
CREATE POLICY "print_review_admin_audit_admin_all"
  ON print_review_admin_audit FOR ALL
  USING (auth.role() = 'service_role');

-- print_review_coupons: 해당 리뷰 작성자(approved)만 자신의 쿠폰 조회
CREATE POLICY "print_review_coupons_owner_select"
  ON print_review_coupons FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM print_reviews r
      WHERE r.id = review_id
        AND r.user_id = auth.uid()
        AND r.status = 'approved'
    )
  );

-- print_review_coupons: 어드민 전체 접근
CREATE POLICY "print_review_coupons_admin_all"
  ON print_review_coupons FOR ALL
  USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────
-- DOWN (참고용)
-- DROP VIEW  IF EXISTS print_product_review_stats;
-- DROP TABLE IF EXISTS print_review_coupons;
-- DROP TABLE IF EXISTS print_review_admin_audit;
-- DROP TABLE IF EXISTS print_reviews;
-- DROP TYPE  IF EXISTS print_review_coupon_status;
-- DROP TYPE  IF EXISTS print_review_status;
-- DROP TYPE  IF EXISTS print_review_source;
-- ─────────────────────────────────────────────
