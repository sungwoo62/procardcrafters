-- 시즌 캘린더 피크 기준일 컬럼 추가
-- OMO-2391: cron job이 EVERY_YEAR 시즌의 promo_start를 자동 계산하기 위해
--           각 시즌의 피크 시작 기준 월/일이 필요하므로 두 컬럼을 추가한다.

-- ============================================================
-- UP
-- ============================================================

ALTER TABLE print_promotion_calendar
  ADD COLUMN IF NOT EXISTS peak_anchor_month INT NOT NULL DEFAULT 0
    CHECK (peak_anchor_month BETWEEN 0 AND 12),
  ADD COLUMN IF NOT EXISTS peak_anchor_day   INT NOT NULL DEFAULT 0
    CHECK (peak_anchor_day   BETWEEN 0 AND 31);

COMMENT ON COLUMN print_promotion_calendar.peak_anchor_month IS
  '피크 시작 기준 월 (1~12). ALWAYS_ON/ONE_TIME은 0.';
COMMENT ON COLUMN print_promotion_calendar.peak_anchor_day IS
  '피크 시작 기준 일 (1~31). ALWAYS_ON/ONE_TIME은 0.';

-- EVERY_YEAR 시즌별 앵커 날짜 (시드 데이터의 peak 범위 시작일 기준)
UPDATE print_promotion_calendar SET peak_anchor_month = 2,  peak_anchor_day = 1  WHERE key = 'valentine';
UPDATE print_promotion_calendar SET peak_anchor_month = 4,  peak_anchor_day = 22 WHERE key = 'mothers_day';
UPDATE print_promotion_calendar SET peak_anchor_month = 5,  peak_anchor_day = 15 WHERE key = 'graduation';
UPDATE print_promotion_calendar SET peak_anchor_month = 5,  peak_anchor_day = 27 WHERE key = 'fathers_day';
UPDATE print_promotion_calendar SET peak_anchor_month = 8,  peak_anchor_day = 1  WHERE key = 'back_to_school';
UPDATE print_promotion_calendar SET peak_anchor_month = 10, peak_anchor_day = 10 WHERE key = 'halloween';
UPDATE print_promotion_calendar SET peak_anchor_month = 11, peak_anchor_day = 22 WHERE key = 'black_friday';
UPDATE print_promotion_calendar SET peak_anchor_month = 11, peak_anchor_day = 25 WHERE key = 'christmas_new_year';
-- wedding_boost: ALWAYS_ON → peak_anchor 0/0 유지

-- ============================================================
-- DOWN
-- ALTER TABLE print_promotion_calendar
--   DROP COLUMN IF EXISTS peak_anchor_month,
--   DROP COLUMN IF EXISTS peak_anchor_day;
-- ============================================================
