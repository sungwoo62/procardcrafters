-- ============================================================================
-- OMO-2636 (OMO-2633-B): 배너 4종 성원 카테고리 코드 정정 + 옵션 재시드
-- ============================================================================
-- 배경:
--   기존 배너 4종(banners/x-banners/rollup-banners/mini-banners)은 모두 성원
--   CPR5000 으로 매핑돼 있었으나, CPR5000 라이브 검증 결과 이 카테고리는
--   "종이홀더"(포켓홀더/책커버, 모조지·아트지 A1~A4)로 배너/현수막이 아님.
--   또한 표시용 옵션이 실재하지 않는 가짜 코드(BNR510W00 / SZT20 / XBS1 등)로
--   시드돼 있어 가격조회·자동발주가 정상 동작 불가.
--
-- 정정(성원 실사출력 CRP 계열 라이브 검증, 2026-06-08 / json_data 실측):
--   banners        → CRP5100  현수막 150denier        · 사이즈 CRP05 5000×900mm
--   x-banners      → CRP4000  실사배너 페트 210µ       · 사이즈 CRP03/CRP04
--   rollup-banners → CRP3000  페트 210µ / 메쉬 1000d   · 사이즈 CRP01/CRP02
--   mini-banners   → COD1100  종이미니배너(팬시지)     · 사이즈 N0110/N0120
--
-- 본 마이그레이션은 4종의 paper_code / paper_size 옵션을 실측 성원 코드로
-- 교체한다. 수량(paper_qty) 사다리와 base_price 는 변경하지 않는다(가격 정책은
-- 별도 이슈). is_default 1개·sort_order 유지.
-- ============================================================================

-- ── 1. 기존 가짜 paper_code / paper_size 옵션 제거 (4종) ──────────────────────
DELETE FROM print_product_options
WHERE product_id IN (
  'ad59df6c-1752-468c-81d3-89fc5c488d50', -- banners
  'de32c75e-8b1a-46ca-9d9d-74c9c3aefe94', -- x-banners
  '7f25550a-e7f0-4fa9-a367-d80ae4011a43', -- rollup-banners
  '8a15d89f-ff21-4a6e-ae9f-fabb362540ac'  -- mini-banners
)
AND option_type IN ('paper_code', 'paper_size');

-- ── 2. banners (현수막) — CRP5100 ────────────────────────────────────────────
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('ad59df6c-1752-468c-81d3-89fc5c488d50', 'paper_code', 'BAN150W00', '현수막 150denier', 'PVC Banner 150denier', 0, true, 1),
('ad59df6c-1752-468c-81d3-89fc5c488d50', 'paper_size', 'CRP05', '5000×900mm (표준 현수막)', '5000×900mm (Standard Banner)', 0, true, 1)
ON CONFLICT (product_id, option_type, value) DO UPDATE
  SET label_ko = EXCLUDED.label_ko, label_en = EXCLUDED.label_en,
      extra_price_krw = EXCLUDED.extra_price_krw, is_default = EXCLUDED.is_default,
      sort_order = EXCLUDED.sort_order;

-- ── 3. x-banners (X배너/탁상) — CRP4000 (페트 210µ) ──────────────────────────
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('de32c75e-8b1a-46ca-9d9d-74c9c3aefe94', 'paper_code', 'PTB210PE0', '페트 210µ', 'PET 210µm', 0, true, 1),
('de32c75e-8b1a-46ca-9d9d-74c9c3aefe94', 'paper_size', 'CRP03', '150×300mm', '150×300mm', 0, true, 1),
('de32c75e-8b1a-46ca-9d9d-74c9c3aefe94', 'paper_size', 'CRP04', '180×420mm', '180×420mm', 0, false, 2)
ON CONFLICT (product_id, option_type, value) DO UPDATE
  SET label_ko = EXCLUDED.label_ko, label_en = EXCLUDED.label_en,
      extra_price_krw = EXCLUDED.extra_price_krw, is_default = EXCLUDED.is_default,
      sort_order = EXCLUDED.sort_order;

-- ── 4. rollup-banners (롤업배너) — CRP3000 (페트/메쉬 대형) ───────────────────
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('7f25550a-e7f0-4fa9-a367-d80ae4011a43', 'paper_code', 'PTB210PE0', '페트 210µ', 'PET 210µm', 0, true, 1),
('7f25550a-e7f0-4fa9-a367-d80ae4011a43', 'paper_code', 'MEH000D01', '메쉬 1000denier', 'Mesh 1000denier', 0, false, 2),
('7f25550a-e7f0-4fa9-a367-d80ae4011a43', 'paper_size', 'CRP01', '600×1600mm', '600×1600mm', 0, true, 1),
('7f25550a-e7f0-4fa9-a367-d80ae4011a43', 'paper_size', 'CRP02', '600×1800mm', '600×1800mm', 0, false, 2)
ON CONFLICT (product_id, option_type, value) DO UPDATE
  SET label_ko = EXCLUDED.label_ko, label_en = EXCLUDED.label_en,
      extra_price_krw = EXCLUDED.extra_price_krw, is_default = EXCLUDED.is_default,
      sort_order = EXCLUDED.sort_order;

-- ── 5. mini-banners (종이미니배너) — COD1100 (팬시지) ────────────────────────
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('8a15d89f-ff21-4a6e-ae9f-fabb362540ac', 'paper_code', 'CFT25000N', '뉴크라프트보드 250g', 'New Kraft Board 250g', 0, true, 1),
('8a15d89f-ff21-4a6e-ae9f-fabb362540ac', 'paper_code', 'RDV240N00', '랑데뷰 내츄럴 240g', 'Rendezvous Natural 240g', 0, false, 2),
('8a15d89f-ff21-4a6e-ae9f-fabb362540ac', 'paper_code', 'BLA300W01', '블랑 순백색 300g', 'Blanc Pure White 300g', 0, false, 3),
('8a15d89f-ff21-4a6e-ae9f-fabb362540ac', 'paper_code', 'STD240SV0', '스타드림 실버 240g', 'Stardream Silver 240g', 0, false, 4),
('8a15d89f-ff21-4a6e-ae9f-fabb362540ac', 'paper_code', 'STD240QZ0', '스타드림 쿼츠 240g', 'Stardream Quartz 240g', 0, false, 5),
('8a15d89f-ff21-4a6e-ae9f-fabb362540ac', 'paper_code', 'KYC250GD0', '키칼라 아이스골드 250g', 'Keycolor Ice Gold 250g', 0, false, 6),
('8a15d89f-ff21-4a6e-ae9f-fabb362540ac', 'paper_size', 'N0110', '150×300mm', '150×300mm', 0, true, 1),
('8a15d89f-ff21-4a6e-ae9f-fabb362540ac', 'paper_size', 'N0120', '180×420mm', '180×420mm', 0, false, 2)
ON CONFLICT (product_id, option_type, value) DO UPDATE
  SET label_ko = EXCLUDED.label_ko, label_en = EXCLUDED.label_en,
      extra_price_krw = EXCLUDED.extra_price_krw, is_default = EXCLUDED.is_default,
      sort_order = EXCLUDED.sort_order;
