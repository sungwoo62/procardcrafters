-- OMO-3058: 제품별 무료배송 플래그.
-- 패키지처럼 "배송비를 단가에 녹이고 무료배송으로 표시"하는 제품용(PackMojo/Packlane 방식).
-- true 면 배송 견적이 $0(무료)로 잡힌다. 단가(margin)에 운임을 흡수해 손실 없게 세팅한다.
alter table print_products
  add column if not exists free_shipping boolean not null default false;

comment on column print_products.free_shipping is
  'OMO-3058 true=배송비 단가포함·무료배송 표시(패키지류). 운임은 margin_multiplier 로 흡수.';
