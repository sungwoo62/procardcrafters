-- OMO-3240: 가격 매트릭스에 print_color_type 가격축 추가
--
-- 발견(라이브): 일부 제품의 `print_color_type` 셀렉트는 단면/양면(side)이 아니라
-- **인쇄방식·제본방식 = 별도 가격축**이다:
--   leaflets/menus(CPR3000/CLF2000): PTM10=일반인쇄 / PTM20=UV인쇄
--   catalogs/booklets(CPR4000):      BDT6=PUR무선 / BDT2=중철 / BDT4=스프링제본
-- 기존 유니크키 (category,size,paper,side,qty)에는 이 축 슬롯이 없어 두 print_color_type
-- 값이 같은 side(=1)로 붕괴 → 중복키 충돌(ON CONFLICT cannot affect row twice).
--
-- 조치(additive·무손실): print_color_type 컬럼 추가 + 유니크키에 포함.
--  - 기존 행(side가 단면/양면을 담던 CDP3000 등)은 print_color_type='' 로 유지(side가 구분 유지).
--  - print_color_type 가격축 제품(leaflets/catalogs/menus 등)은 값(PTM10/BDT6...)으로 구분.
-- 배포 게이트: OMO-1292(CEO). 부모 OMO-3239 오라클 모델 보정.

alter table print_swadpia_price_matrix
  add column if not exists print_color_type text not null default '';

comment on column print_swadpia_price_matrix.print_color_type is
  '성원 print_color_type 코드(인쇄방식 PTM10/PTM20·제본 BDT* 등). 단면/양면은 side 컬럼이 담음. 가격축';

-- 기존 유니크 제약(category,size,paper,side,qty) → print_color_type 포함으로 교체
do $$
declare cname text;
begin
  select conname into cname
    from pg_constraint
   where conrelid = 'print_swadpia_price_matrix'::regclass and contype = 'u'
   limit 1;
  if cname is not null then
    execute format('alter table print_swadpia_price_matrix drop constraint %I', cname);
  end if;
end $$;

alter table print_swadpia_price_matrix
  add constraint print_swadpia_price_matrix_combo_key
  unique (category_code, size_code, paper_code, side, print_color_type, qty);

drop index if exists idx_print_price_matrix_lookup;
create index if not exists idx_print_price_matrix_lookup
  on print_swadpia_price_matrix (category_code, size_code, paper_code, side, print_color_type, qty);
