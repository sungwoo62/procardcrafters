-- OMO-3058: 미연동/문제 제품을 고객에게 숨기는 플래그.
--
-- 주의: print_products.is_active 는 라이브 prod 고객사이트가 직접 읽으므로 테스트로
-- 토글하면 prod 노출이 즉시 바뀐다. 그래서 별도 플래그를 둬서 신규(프리뷰) 코드만
-- 이를 존중하게 한다 — prod 무손상으로 숨김 동작을 검증할 수 있다.
alter table print_swadpia_mapping
  add column if not exists hidden_from_customer boolean not null default false;

comment on column print_swadpia_mapping.hidden_from_customer is
  'OMO-3058 true 면 고객 제품목록/PDP 에서 숨김(맵핑 없는 미판매 제품용). product-visibility.ts 가 존중.';
