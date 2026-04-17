-- =============================================================
-- print_price_history: 성원애드피아 가격 변동 이력 테이블
-- 공유 Supabase 프로젝트(ilcfemvqommqyoohfoxw)에 적용
-- =============================================================

-- 가격 변동 이력
CREATE TABLE IF NOT EXISTS print_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES print_products(id) ON DELETE CASCADE,
  -- 상품 슬러그 (조회 편의용 비정규화)
  product_slug TEXT NOT NULL,
  -- 이전 가격 (NULL = 첫 번째 기록)
  prev_price_krw NUMERIC(12, 2),
  -- 새 가격
  new_price_krw NUMERIC(12, 2) NOT NULL,
  -- 가격 변동 여부
  price_changed BOOLEAN NOT NULL DEFAULT false,
  -- 성원애드피아 스크래핑 원본 데이터 (JSON)
  source_data JSONB,
  -- 스크래핑 성공 여부
  fetch_success BOOLEAN NOT NULL DEFAULT true,
  -- 실패 시 에러 메시지
  error_message TEXT,
  -- 스크래핑 출처 ('cron' | 'manual' | 'seed')
  source TEXT NOT NULL DEFAULT 'cron' CHECK (source IN ('cron', 'manual', 'seed')),
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 옵션 조합별 가격 이력 (상세)
CREATE TABLE IF NOT EXISTS print_option_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_history_id UUID NOT NULL REFERENCES print_price_history(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES print_products(id) ON DELETE CASCADE,
  -- 옵션 조합 키 (예: "qty:100,paper:snow_350,coating:matte")
  option_key TEXT NOT NULL,
  -- 성원 기준 가격 (KRW)
  price_krw NUMERIC(12, 2) NOT NULL,
  -- 성원 상품 코드 (매핑용)
  swadpia_goods_code TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_print_price_history_product_id ON print_price_history(product_id);
CREATE INDEX IF NOT EXISTS idx_print_price_history_fetched_at ON print_price_history(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_print_price_history_price_changed ON print_price_history(price_changed) WHERE price_changed = true;
CREATE INDEX IF NOT EXISTS idx_print_option_price_history_product_id ON print_option_price_history(product_id);
CREATE INDEX IF NOT EXISTS idx_print_option_price_history_history_id ON print_option_price_history(price_history_id);
