-- =============================================================
-- OMO-2573 · print_* 라이브 스키마 드리프트 일괄 정합 (repair)
-- 마이그레이션 히스토리엔 적용됨으로 기록됐으나 실제 컬럼/오브젝트가
-- 부재한 드리프트를 idempotent 하게 복구한다.
-- information_schema 전수 대조로 확인된 누락분만 포함(컬럼 단위 정합).
--
-- 발견된 드리프트(기대=마이그레이션, 실제=라이브):
--   A. 20260603000007_print_upload_security  → print_files.file_hash 외 다수 미적용
--      (★ /api/files/upload 500 의 직접 근인 = file_hash 부재 → 체크아웃 전체 불능)
--   B. 20260605000004_print_shipping_service_descriptions → 설명/배송기간 컬럼 4종 부재
--   C. 20260606000010_print_marketing_email  → 두 테이블이 구(舊) 트랜잭션 스키마로 선존재,
--      CREATE TABLE IF NOT EXISTS 가 no-op 되어 코드가 기대하는 컬럼 부재(마케팅/수신거부 깨짐)
-- =============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- A. 업로드 보안(20260603000007) 드리프트 — 체크아웃 차단 근인
-- ─────────────────────────────────────────────────────────────

-- A1. file_hash (SHA-256, 중복 업로드 방지) — 부재 시 upload INSERT 가 500
ALTER TABLE print_files
  ADD COLUMN IF NOT EXISTS file_hash TEXT;

CREATE INDEX IF NOT EXISTS print_files_file_hash_idx
  ON print_files(file_hash)
  WHERE file_hash IS NOT NULL;

-- A2. rate limit 원자적 증가 함수 (부재 시 rate limit fail-open 으로 무력화)
CREATE OR REPLACE FUNCTION increment_upload_rate_limit(
  p_ip_hash      TEXT,
  p_window_start TIMESTAMPTZ,
  p_limit        INT DEFAULT 5
) RETURNS BOOLEAN AS $$
DECLARE
  v_count INT;
BEGIN
  INSERT INTO print_upload_rate_limits (ip_hash, window_start, upload_count)
  VALUES (p_ip_hash, p_window_start, 1)
  ON CONFLICT (ip_hash, window_start)
  DO UPDATE SET upload_count = print_upload_rate_limits.upload_count + 1
  RETURNING upload_count INTO v_count;

  RETURN v_count <= p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- A3. rate-limit 테이블 service_role 전용 정책 (guarded)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'print_upload_rate_limits'
      AND policyname = 'print_upload_rate_limits_service_only'
  ) THEN
    CREATE POLICY "print_upload_rate_limits_service_only"
      ON print_upload_rate_limits FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- A4. Storage: print-assets 버킷 anon/authenticated 직접 INSERT 차단 (guarded)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'print_assets_deny_direct_insert'
  ) THEN
    CREATE POLICY "print_assets_deny_direct_insert" ON storage.objects
      FOR INSERT TO anon, authenticated
      WITH CHECK (bucket_id != 'print-assets');
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- B. 배송 서비스 설명/배송기간(20260605000004) 드리프트 — 체크아웃 배송단계
-- ─────────────────────────────────────────────────────────────
ALTER TABLE print_shipping_services
  ADD COLUMN IF NOT EXISTS description_en TEXT,
  ADD COLUMN IF NOT EXISTS description_ko TEXT,
  ADD COLUMN IF NOT EXISTS transit_time_label_en TEXT,
  ADD COLUMN IF NOT EXISTS transit_time_label_ko TEXT;

UPDATE print_shipping_services SET
  description_en = 'Fast, reliable delivery with a date-certain commitment to more than 220 countries and territories.',
  description_ko = '220개 이상의 국가·지역에 날짜를 보장하는 빠르고 안정적인 배송 서비스.',
  transit_time_label_en = '1–3 business days',
  transit_time_label_ko = '1–3 영업일'
WHERE code = 'fedex_ip' AND description_en IS NULL;

UPDATE print_shipping_services SET
  description_en = 'Cost-effective international delivery to more than 215 countries and territories.',
  description_ko = '215개 이상의 국가·지역으로 보내는 경제적인 국제 배송 서비스.',
  transit_time_label_en = '2–5 business days',
  transit_time_label_ko = '2–5 영업일'
WHERE code = 'fedex_ie' AND description_en IS NULL;

UPDATE print_shipping_services SET
  description_en = 'FedEx International Priority® Express — premium speed with next-business-day service to select locations.',
  description_ko = 'FedEx International Priority® Express — 선택 지역에 익일 배송이 가능한 프리미엄 서비스.',
  transit_time_label_en = '1–2 business days',
  transit_time_label_ko = '1–2 영업일'
WHERE code = 'fedex_ipe' AND description_en IS NULL;

UPDATE print_shipping_services SET
  description_en = 'FedEx International Priority® service in a standardised pak — ideal for lightweight documents and merchandise.',
  description_ko = '표준 Pak 패키징으로 경량 서류·상품을 보내는 FedEx International Priority® 서비스.',
  transit_time_label_en = '1–3 business days',
  transit_time_label_ko = '1–3 영업일'
WHERE code = 'fedex_ip_pak' AND description_en IS NULL;

UPDATE print_shipping_services SET
  description_en = 'FedEx International Priority® service in an envelope — best for documents and flat items.',
  description_ko = '서류·평면 물품에 최적화된 봉투형 FedEx International Priority® 서비스.',
  transit_time_label_en = '1–3 business days',
  transit_time_label_ko = '1–3 영업일'
WHERE code = 'fedex_ip_env' AND description_en IS NULL;

UPDATE print_shipping_services SET
  description_en = 'FedEx International Priority® Express service in a pak — fastest option for lightweight shipments.',
  description_ko = '경량 화물에 대한 가장 빠른 Pak 배송 서비스.',
  transit_time_label_en = '1–2 business days',
  transit_time_label_ko = '1–2 영업일'
WHERE code = 'fedex_ipe_pak' AND description_en IS NULL;

UPDATE print_shipping_services SET
  description_en = 'FedEx International Priority® Express service in an envelope — fastest option for documents.',
  description_ko = '서류에 대한 가장 빠른 봉투형 배송 서비스.',
  transit_time_label_en = '1–2 business days',
  transit_time_label_ko = '1–2 영업일'
WHERE code = 'fedex_ipe_env' AND description_en IS NULL;

-- ─────────────────────────────────────────────────────────────
-- C. 마케팅 이메일(20260606000010) 드리프트 — 비(非)체크아웃, 코드와 스키마 불일치 복구
--    라이브엔 구 트랜잭션 스키마(customer_email 등)로 선존재 → CREATE IF NOT EXISTS no-op.
--    코드가 기대하는 컬럼을 보강하고, 코드가 채우지 않는 레거시 NOT NULL 을 완화.
--    (두 테이블 모두 행수 0 — 보강/제약완화 안전)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE print_marketing_email_log
  ADD COLUMN IF NOT EXISTS email              TEXT,
  ADD COLUMN IF NOT EXISTS campaign_id        UUID REFERENCES print_promotion_campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sent_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS subject            TEXT,
  ADD COLUMN IF NOT EXISTS resend_message_id  TEXT;

-- 코드 insert 는 customer_email 을 채우지 않음 → 레거시 NOT NULL 완화
ALTER TABLE print_marketing_email_log ALTER COLUMN customer_email DROP NOT NULL;

ALTER TABLE print_email_unsubscribes
  ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS campaign_id     UUID REFERENCES print_promotion_campaigns(id) ON DELETE SET NULL;

COMMIT;

-- PostgREST 스키마 캐시 리로드 (schema cache 미반영 시 'could not find column' 재발 방지)
NOTIFY pgrst, 'reload schema';
