-- OMO-3028 [OMO-3019-3]: 결제후 파일 업로드 프리플라이트 + 시안 동의/책임 고지
--
-- 배경: 부모 OMO-3019. 결제 후 고객이 인쇄 파일을 업로드하면
--   (1) 제품 인쇄규격(print_products.print_spec, OMO-3026)에 대한 서버사이드 프리플라이트
--       (해상도/사이즈·블리드/색공간)를 수행해 통과/경고를 산출하고,
--   (2) 고객이 "오탈자·내용 확인 완료, 이후 발생 이슈는 고객 책임" 동의를 명시적으로
--       기록하면 그 동의 텍스트/버전/타임스탬프를 영속화한다.
--
-- ⚠️ 동의에 사용되는 법적 책임 고지 문구는 보드 승인 게이트(OMO-2760) 필수.
--    승인 전에는 placeholder 버전으로 기록되며, 라이브 게시 문구는 승인 후 교체한다.
--    consent_version 컬럼으로 어떤 문구 버전에 동의했는지 추적한다.

-- ── 1. print_files: 프리플라이트 결과 컬럼 ────────────────────────────
-- validation_result(범용 파일 검증, OMO-2603/419)와 별개로, 제품 규격 대비
-- 프리플라이트 결과(통과/경고 + 항목별 체크)를 저장한다.
ALTER TABLE print_files
  ADD COLUMN IF NOT EXISTS preflight_result JSONB DEFAULT NULL;

COMMENT ON COLUMN print_files.preflight_result IS
  'OMO-3028 제품 규격(print_spec) 대비 프리플라이트 결과 '
  '{ status: pass|warn, checks: [{ key, label, status, message }] }. validation_result(범용)와 구분.';

-- ── 2. print_design_consents: 시안 동의/책임 고지 기록 ────────────────
-- 한 업로드 파일(file_id)당 고객 동의 1건. 동의 텍스트 전문/버전/시각/IP해시를
-- 그대로 영속화해 분쟁 시 "어떤 문구에, 언제, 어떤 규격 경고 상태에서 동의했는지"를 입증한다.
CREATE TABLE IF NOT EXISTS print_design_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES print_orders(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES print_order_items(id) ON DELETE SET NULL,
  file_id UUID REFERENCES print_files(id) ON DELETE SET NULL,
  -- 동의 시점의 문구 전문/버전 (분쟁 대비 스냅샷)
  consent_text TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  -- 동의 시점의 프리플라이트 결과 스냅샷 (통과/경고 어떤 상태에서 동의했는지)
  preflight_snapshot JSONB,
  -- 감사 메타 (IP는 해시로만 저장 — 개인정보 최소화)
  ip_hash TEXT,
  user_agent TEXT,
  agreed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_print_design_consents_order_id
  ON print_design_consents(order_id);
CREATE INDEX IF NOT EXISTS idx_print_design_consents_file_id
  ON print_design_consents(file_id);

COMMENT ON TABLE print_design_consents IS
  'OMO-3028 결제후 업로드 시안 동의/책임 고지 기록. 동의 문구 전문+버전+프리플라이트 스냅샷 영속화.';

-- ── 3. RLS: 쓰기/읽기 모두 service_role 전용 ─────────────────────────
-- 동의 기록은 서버 API(service_role)만 INSERT 한다. 클라이언트 직접 위변조 차단.
ALTER TABLE print_design_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "print_design_consents_service_only"
  ON print_design_consents FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
