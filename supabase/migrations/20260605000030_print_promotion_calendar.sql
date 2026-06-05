-- 시즌 프로모션 캘린더 마스터 테이블 + 9개 시즌 시드
-- OMO-2390: 프로모션 DB migration 5종 중 1/5

-- ============================================================
-- UP
-- ============================================================

CREATE TABLE IF NOT EXISTS print_promotion_calendar (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key                     TEXT        NOT NULL UNIQUE,
  name_ko                 TEXT        NOT NULL,
  name_en                 TEXT        NOT NULL,
  -- EVERY_YEAR: 매년 반복, ALWAYS_ON: 상시, ONE_TIME: 단회
  recurring_pattern       TEXT        NOT NULL DEFAULT 'EVERY_YEAR'
                            CHECK (recurring_pattern IN ('EVERY_YEAR', 'ALWAYS_ON', 'ONE_TIME')),
  -- 피크 전 캠페인 오픈 리드타임 (일수)
  default_lead_days       INT         NOT NULL DEFAULT 30,
  -- 피크 구간 길이 (일수)
  default_peak_days       INT         NOT NULL DEFAULT 7,
  -- 피크 종료 이후 주문 마감까지 버퍼 (일수, 0 = rolling/없음)
  default_cutoff_days     INT         NOT NULL DEFAULT 0,
  -- top/standard/always_on/bestseller
  default_discount_tier   TEXT        NOT NULL DEFAULT 'standard'
                            CHECK (default_discount_tier IN ('top', 'standard', 'always_on', 'bestseller')),
  applicable_product_groups TEXT[]    NOT NULL DEFAULT '{}',
  is_active               BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  print_promotion_calendar IS '시즌 프로모션 마스터 캘린더 — 반복 패턴과 기본값 정의';
COMMENT ON COLUMN print_promotion_calendar.key IS '프로그램 식별자 (소문자_언더스코어). ex) black_friday';
COMMENT ON COLUMN print_promotion_calendar.default_lead_days IS '피크 시작 기준 캠페인 오픈 리드타임(일). 0이면 상시 오픈.';
COMMENT ON COLUMN print_promotion_calendar.default_peak_days IS '피크 구간 길이(일수). 0이면 rolling.';
COMMENT ON COLUMN print_promotion_calendar.default_cutoff_days IS '주문 마감까지 버퍼(일수). 0=rolling/없음.';

-- 자동 updated_at 갱신 트리거
CREATE OR REPLACE FUNCTION print_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS print_promotion_calendar_updated_at ON print_promotion_calendar;
CREATE TRIGGER print_promotion_calendar_updated_at
  BEFORE UPDATE ON print_promotion_calendar
  FOR EACH ROW EXECUTE FUNCTION print_set_updated_at();

-- RLS
ALTER TABLE print_promotion_calendar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "print_promotion_calendar_public_read" ON print_promotion_calendar;
CREATE POLICY "print_promotion_calendar_public_read"
  ON print_promotion_calendar FOR SELECT
  USING (is_active = TRUE);

DROP POLICY IF EXISTS "print_promotion_calendar_service_role_all" ON print_promotion_calendar;
CREATE POLICY "print_promotion_calendar_service_role_all"
  ON print_promotion_calendar FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- SEED: 9개 시즌 캘린더
-- ============================================================

INSERT INTO print_promotion_calendar
  (key, name_ko, name_en, recurring_pattern,
   default_lead_days, default_peak_days, default_cutoff_days,
   default_discount_tier, applicable_product_groups)
VALUES
  -- 1. 발렌타인 (D-30 = 1/15, peak 2/1~2/7 = 7일, cutoff 2/3 = peak+2일)
  ('valentine',
   '발렌타인데이', 'Valentine''s Day', 'EVERY_YEAR',
   30, 7, 2,
   'top',
   ARRAY['greeting_cards','postcards','stickers']),

  -- 2. 웨딩 부스트 (4/1 ~ 상시, always_on tier)
  ('wedding_boost',
   '웨딩 시즌', 'Wedding Season', 'ALWAYS_ON',
   0, 120, 0,
   'always_on',
   ARRAY['business-cards','postcards','brochures','invitations']),

  -- 3. 어버이날/어린이날 (D-45 = 3/26, peak 4/22~5/2 = 10일, cutoff 5/2)
  ('mothers_day',
   '어버이날', 'Mother''s Day', 'EVERY_YEAR',
   45, 10, 3,
   'standard',
   ARRAY['postcards','greeting_cards','flyers']),

  -- 4. 졸업/입학 시즌 (D-30~45 = 4/15, peak 5/15~6/15 = 31일, rolling cutoff)
  ('graduation',
   '졸업·입학 시즌', 'Graduation Season', 'EVERY_YEAR',
   37, 31, 0,
   'standard',
   ARRAY['business-cards','postcards','banners','flyers']),

  -- 5. 아버지날 (D-45 = 5/3, peak 5/27~6/9 = 13일, cutoff 6/9)
  ('fathers_day',
   '아버지날', 'Father''s Day', 'EVERY_YEAR',
   45, 13, 3,
   'standard',
   ARRAY['postcards','greeting_cards','flyers']),

  -- 6. 개학 시즌 (D-30~45 = 7/15, peak 8/1~8/25 = 24일, rolling)
  ('back_to_school',
   '개학 시즌', 'Back to School', 'EVERY_YEAR',
   37, 24, 0,
   'standard',
   ARRAY['business-cards','flyers','stickers','brochures']),

  -- 7. 할로윈 (D-41 = 9/20, peak 10/10~10/24 = 14일, cutoff 10/20 = peak-4일)
  ('halloween',
   '할로윈', 'Halloween', 'EVERY_YEAR',
   41, 14, 6,
   'standard',
   ARRAY['stickers','die-cut-stickers','postcards','flyers']),

  -- 8. 블랙프라이데이 (D-45 = 10/10, peak 11/22~12/1 = 9일, cutoff 11/27 = peak+5일)
  --    BF 당일 25% 단일 — 구체적 할인율은 campaign 레벨에서 관리
  ('black_friday',
   '블랙프라이데이', 'Black Friday', 'EVERY_YEAR',
   45, 9, 4,
   'top',
   ARRAY['business-cards','premium-foil-cards','brochures','flyers','stickers']),

  -- 9. 크리스마스·신년 (D-60 = 10/26, peak 11/25~12/15 = 20일, cutoff 12/12 = peak-3일)
  ('christmas_new_year',
   '크리스마스·신년', 'Christmas & New Year', 'EVERY_YEAR',
   60, 20, 13,
   'top',
   ARRAY['postcards','greeting_cards','premium-foil-cards','business-cards','stickers'])

ON CONFLICT (key) DO UPDATE SET
  name_ko                 = EXCLUDED.name_ko,
  name_en                 = EXCLUDED.name_en,
  recurring_pattern       = EXCLUDED.recurring_pattern,
  default_lead_days       = EXCLUDED.default_lead_days,
  default_peak_days       = EXCLUDED.default_peak_days,
  default_cutoff_days     = EXCLUDED.default_cutoff_days,
  default_discount_tier   = EXCLUDED.default_discount_tier,
  applicable_product_groups = EXCLUDED.applicable_product_groups,
  updated_at              = NOW();

-- ============================================================
-- DOWN (롤백 시 순서 주의: 자식 테이블 먼저 삭제 필요)
-- DROP TABLE IF EXISTS print_promotion_calendar CASCADE;
-- DROP FUNCTION IF EXISTS print_set_updated_at();
-- ============================================================
