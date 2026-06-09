-- OMO-2736 RLS 하드닝: RLS 미적용 print_* 테이블 deny-by-default 봉인.
--
-- 배경: 아래 4개 테이블은 CREATE 되었으나 ENABLE ROW LEVEL SECURITY 가 누락되어
-- anon/authenticated 키로 직접 조회 시 노출 위험이 있었다.
-- 코드상 모든 접근은 service_role(createServerClient)로만 이루어지며 service_role 은
-- RLS 를 우회하므로, RLS 를 켜고 정책을 두지 않으면(deny-by-default) 기존 동작은
-- 그대로 유지되고 anon/authenticated 직접 접근만 차단된다.
--
-- 검증(2026-06-09):
--   print_design_proofs      → mypage(RSC) + /api/(admin/)orders/.../proof : 전부 service_role
--   print_price_history      → /api/admin/sync-prices + /api/cron/update-prices : service_role
--   print_option_price_history → 코드 참조 없음
--   print_carrier_contacts   → 코드 참조 없음

ALTER TABLE IF EXISTS print_design_proofs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS print_price_history        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS print_option_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS print_carrier_contacts     ENABLE ROW LEVEL SECURITY;

-- 정책 없음 = anon/authenticated 전면 거부. service_role 은 RLS 우회로 정상 동작.
-- (향후 고객이 자기 proof 를 anon 키로 직접 읽어야 할 요건이 생기면 별도 SELECT 정책 추가)
