-- OMO-3752: procard 광고 = 뉴트라 공용 KRW 광고계정 "분리 집행"
-- pccf_ads_* 가드레일 금액 컬럼의 단위를 USD cents → KRW 최소단위(원, offset 0)로 재정의한다.
-- 데이터 마이그레이션 없음(값 그대로) — 의미(단위)만 KRW로 전환 + 일일 캡 기본값 보정.
-- 멱등(IF EXISTS / 재실행 안전).

-- 1) 일일 지출 스냅샷: 캡 기본값 2000(=$20 cents) → 30000(=₩30,000)
ALTER TABLE pccf_ads_daily_spend
  ALTER COLUMN cap_cents SET DEFAULT 30000;

COMMENT ON TABLE pccf_ads_daily_spend IS
  'procard 일일 지출 스냅샷 — PROCARD 네이밍 캠페인만 집계(뉴트라 제외). 단위: KRW 원(offset 0). OMO-3752';
COMMENT ON COLUMN pccf_ads_daily_spend.spend_cents IS 'procard 당일 지출(KRW 원). 컬럼명은 grandfather, 의미는 원 단위.';
COMMENT ON COLUMN pccf_ads_daily_spend.cap_cents  IS 'procard 일일 캡(KRW 원). 기본 ₩30,000.';

-- 2) ROAS 스냅샷: 금액 단위 KRW로 명시(roas 비율은 단위 무관)
COMMENT ON TABLE pccf_ads_roas_snapshot IS
  'procard ROAS 15분 시계열 — PROCARD 캠페인만 대상. 금액 단위: KRW 원(offset 0). OMO-3752';
COMMENT ON COLUMN pccf_ads_roas_snapshot.spend_cents   IS 'procard 지출(KRW 원).';
COMMENT ON COLUMN pccf_ads_roas_snapshot.revenue_cents IS 'procard 매출(KRW 원).';
