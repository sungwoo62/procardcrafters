-- 배송 정산 (Reconciliation) — Ettiang 등 같은 FedEx 어카운트 공유 케이스 분리
--
-- 문제: FedEx account 210839884 를 ALLPACKMEISTER 산하 여러 브랜드(PCCF, 에띠앙) 가 공유.
--       월별 FedEx 인보이스에 모든 발송이 섞여 들어옴.
-- 해법: 각 shipment 에 business_unit tag.  /admin/shipping/reconciliation 에서 필터링/CSV 추출.
--       FedEx 인보이스 import 시 tracking 으로 자동 매칭 → 매칭 안 된 행은 다른 사업부 (Ettiang 등).

-- 1) 송장에 business_unit 추가
ALTER TABLE print_shipments ADD COLUMN IF NOT EXISTS business_unit TEXT NOT NULL DEFAULT 'pccf';

CREATE INDEX IF NOT EXISTS idx_print_shipments_business_unit
  ON print_shipments (business_unit, created_at DESC);

COMMENT ON COLUMN print_shipments.business_unit IS
  '사업부 태그. pccf=Procardcrafters (이 시스템 발송분). 같은 FedEx account 를 쓰는 다른 사업부와 인보이스 분리용.';

-- 2) FedEx 인보이스 import 저장
CREATE TABLE IF NOT EXISTS print_fedex_invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number  TEXT NOT NULL,
  invoice_date    DATE NOT NULL,
  account_number  TEXT,
  total_usd       NUMERIC(14, 2),
  uploaded_by     TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (invoice_number)
);

-- 인보이스의 개별 행 (tracking 단위)
CREATE TABLE IF NOT EXISTS print_fedex_invoice_lines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID NOT NULL REFERENCES print_fedex_invoices(id) ON DELETE CASCADE,
  tracking_number TEXT NOT NULL,
  ship_date       DATE,
  service_code    TEXT,
  weight_kg       NUMERIC(8, 3),
  charged_usd     NUMERIC(12, 2) NOT NULL,
  currency        TEXT DEFAULT 'USD',
  destination_country TEXT,
  -- 매칭 결과
  matched_shipment_id UUID REFERENCES print_shipments(id) ON DELETE SET NULL,
  match_status    TEXT NOT NULL DEFAULT 'unmatched'
    CHECK (match_status IN ('matched', 'unmatched', 'discrepancy', 'manual')),
  cost_diff_usd   NUMERIC(12, 2),
  raw_data        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_print_fedex_invoice_lines_tracking
  ON print_fedex_invoice_lines (tracking_number);
CREATE INDEX IF NOT EXISTS idx_print_fedex_invoice_lines_invoice
  ON print_fedex_invoice_lines (invoice_id);
CREATE INDEX IF NOT EXISTS idx_print_fedex_invoice_lines_status
  ON print_fedex_invoice_lines (match_status);

-- RLS: service_role 만
ALTER TABLE print_fedex_invoices       ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_fedex_invoice_lines  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fedex_invoices_service"      ON print_fedex_invoices;
DROP POLICY IF EXISTS "fedex_invoice_lines_service" ON print_fedex_invoice_lines;
CREATE POLICY "fedex_invoices_service"      ON print_fedex_invoices      FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "fedex_invoice_lines_service" ON print_fedex_invoice_lines FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE print_fedex_invoices IS
  'FedEx 월별 인보이스 헤더. 인보이스 업로드 시 tracking 단위로 print_fedex_invoice_lines 에 분해.';
COMMENT ON COLUMN print_fedex_invoice_lines.match_status IS
  'matched=PCCF 발송과 매칭됨, unmatched=매칭 안됨 (=다른 사업부 가능성), discrepancy=금액 차이, manual=수동 확인됨';
