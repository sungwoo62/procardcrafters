-- ============================================================
-- OMO-2634: 자동발주 미지원 23개 제품군에 성원(Seongwon) 옵션 템플릿 적용
--
-- 부모: OMO-2633 / 선행: 20260603000010_print_swadpia_options_sync.sql
--
-- 성원 goods_view 라이브 조사(2026-06-08, playwright 렌더 후 select 추출)로
-- 제품군별 실제 paper_code / 사이즈 / 색상·인쇄방식 / 수량 옵션값을 추출하여 시드.
--
-- ⚠ 폼 필드명 차이(라이브 검증됨):
--   - 카드형(스티커 CST5000/CST7000)만 paper_code/print_color_type/paper_size/paper_qty 1:1.
--   - 그 외 제품군은 성원 select name 이 다름. print_product_options.option_type 은
--     CHECK 제약상 canonical 4종만 허용되므로 canonical 타입에 실제 성원 value 를 저장하고,
--     자동발주 시 swadpia-order.ts 의 fieldAlias 가 canonical→실제 select name 으로 변환한다.
--   - 봉투 CEV1000:  print_color_type→fside_color_amount, paper_size→bongto_type
--   - 라벨 CLP1000:  print_color_type→fside_color_amount1, paper_size→small_size_type, paper_qty→paper_qty_select
--   - 책자 CPR4000:  paper_code→cover_paper_code, print_color_type→binding_type, paper_qty→bundle_qty
--   - 캘린더 CCD1000/CCD2000: print_color_type→print_method, paper_qty→paper_qty_select
--   - 서식 CNR2000:  print_color_type→fside_color_amount, paper_size→code_size_type
--   - 리플렛/메뉴 CPR3000/CLF2000: print_color_type→print_method
--   - 배너 CPR5000:  ⚠ 라이브 CPR5000 폼이 '포켓홀더'로 보임(현수막 아님). 카테고리 코드
--     재확인 필요 — 부모 OMO-2633 로 에스컬레이션. 표시용 값은 기존 'banners' 제품과 동일 패턴 유지.
-- ============================================================

-- 기존(비-성원) 옵션 제거 후 재시드 (멱등)
DELETE FROM print_product_options WHERE product_id IN (
  '85c1850a-fa64-496c-abcc-895038c3277d', -- admin-envelopes
  '7fd35660-cd5c-48a8-89e3-072eec8dae7f', -- standard-envelopes
  'ba1a1416-8454-450b-887e-cd2516848eba', -- gusset-envelopes
  'c5bf627d-4969-4f66-bd2f-118fdd18bd79', -- barcode-labels
  '39cc1116-0216-419f-ada6-0ca46d8ffb11', -- food-labels
  'cdd21533-9483-4baa-938f-83e11d465b79', -- price-labels
  '90001d30-eeae-4bd4-9163-4b1ba6b2eca6', -- catalogs
  'f1c5541b-45d8-4d2b-9424-76f58f3a99ce', -- perfect-bound-booklet
  'b9b2a844-9e42-4f31-bb55-1d4fe0d5838f', -- saddle-stitch-booklet
  'c8790fc6-d41e-4b8a-9802-886f0e96dd9f', -- wall-calendars
  'e1a545b2-4db9-4a72-921e-8125901f8c97', -- desk-calendars
  '6095f57c-c4c6-435c-bedb-9b82b852b9da', -- mini-calendars
  '4480d72b-6047-4960-9984-13b5d922e27c', -- invoice-forms
  '0e4935b6-bf26-4484-a25b-1d50658d0de5', -- ncr-forms
  'd18906bc-b840-48b4-afe6-97e744433057', -- quotation-forms
  'cd611fb9-1ef5-424f-9d4e-73a5ee8fc4e5', -- receipts
  '17198d31-4264-4cbb-8a06-44b550bf08f0', -- leaflets
  '5c8f988f-6150-4279-a3fc-44ffdfe786bb', -- menus
  'a08d3ca7-35e5-4b91-a17a-3da7997cb290', -- holographic-stickers
  '94a0d223-1a6b-470c-a5a8-9a46aa4c5362', -- roll-stickers
  '8a15d89f-ff21-4a6e-ae9f-fabb362540ac', -- mini-banners
  '7f25550a-e7f0-4fa9-a367-d80ae4011a43', -- rollup-banners
  'de32c75e-8b1a-46ca-9d9d-74c9c3aefe94'  -- x-banners
);

-- ──────────────────────────────────────────────────────────
-- 봉투 (CEV1000) — paper_size=bongto_type, print_color_type=fside_color_amount
-- standard / admin / gusset-envelopes
-- ──────────────────────────────────────────────────────────
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
-- standard-envelopes
('7fd35660-cd5c-48a8-89e3-072eec8dae7f','paper_code','VLD12001E','백색 120g','White 120gsm',0,true,1),
('7fd35660-cd5c-48a8-89e3-072eec8dae7f','paper_code','VLD15001E','백색 150g','White 150gsm',3000,false,2),
('7fd35660-cd5c-48a8-89e3-072eec8dae7f','paper_code','VLD18001E','백색 180g','White 180gsm',6000,false,3),
('7fd35660-cd5c-48a8-89e3-072eec8dae7f','print_color_type','BDD11','컬러 4도','Color 4C',0,true,1),
('7fd35660-cd5c-48a8-89e3-072eec8dae7f','print_color_type','BDD12','컬러 4도 + 베다','Color 4C + Full BG',3000,false,2),
('7fd35660-cd5c-48a8-89e3-072eec8dae7f','print_color_type','BDD16','컬러 4도 (UV인쇄)','Color 4C (UV)',5000,false,3),
('7fd35660-cd5c-48a8-89e3-072eec8dae7f','paper_size','CE102','소봉투 220×105','Small 220×105',0,true,1),
('7fd35660-cd5c-48a8-89e3-072eec8dae7f','paper_size','CE103','중봉투 260×190','Medium 260×190',2000,false,2),
('7fd35660-cd5c-48a8-89e3-072eec8dae7f','paper_size','CE101','대봉투 330×245','Large 330×245',4000,false,3),
('7fd35660-cd5c-48a8-89e3-072eec8dae7f','paper_qty','500','500매','500 pcs',0,true,1),
('7fd35660-cd5c-48a8-89e3-072eec8dae7f','paper_qty','1000','1000매','1,000 pcs',15000,false,2),
('7fd35660-cd5c-48a8-89e3-072eec8dae7f','paper_qty','2000','2000매','2,000 pcs',28000,false,3),
('7fd35660-cd5c-48a8-89e3-072eec8dae7f','paper_qty','5000','5000매','5,000 pcs',60000,false,4),
-- admin-envelopes
('85c1850a-fa64-496c-abcc-895038c3277d','paper_code','VLD12001E','백색 120g','White 120gsm',0,true,1),
('85c1850a-fa64-496c-abcc-895038c3277d','paper_code','VLD15001E','백색 150g','White 150gsm',3000,false,2),
('85c1850a-fa64-496c-abcc-895038c3277d','paper_code','VLD18001E','백색 180g','White 180gsm',6000,false,3),
('85c1850a-fa64-496c-abcc-895038c3277d','print_color_type','BDD11','컬러 4도','Color 4C',0,true,1),
('85c1850a-fa64-496c-abcc-895038c3277d','print_color_type','BDD12','컬러 4도 + 베다','Color 4C + Full BG',3000,false,2),
('85c1850a-fa64-496c-abcc-895038c3277d','paper_size','CE101','대봉투 330×245','Large 330×245',0,true,1),
('85c1850a-fa64-496c-abcc-895038c3277d','paper_size','CE103','중봉투 260×190','Medium 260×190',-2000,false,2),
('85c1850a-fa64-496c-abcc-895038c3277d','paper_qty','500','500매','500 pcs',0,true,1),
('85c1850a-fa64-496c-abcc-895038c3277d','paper_qty','1000','1000매','1,000 pcs',15000,false,2),
('85c1850a-fa64-496c-abcc-895038c3277d','paper_qty','2000','2000매','2,000 pcs',28000,false,3),
-- gusset-envelopes
('ba1a1416-8454-450b-887e-cd2516848eba','paper_code','VLD15001E','백색 150g','White 150gsm',0,true,1),
('ba1a1416-8454-450b-887e-cd2516848eba','paper_code','VLD18001E','백색 180g','White 180gsm',5000,false,2),
('ba1a1416-8454-450b-887e-cd2516848eba','print_color_type','BDD11','컬러 4도','Color 4C',0,true,1),
('ba1a1416-8454-450b-887e-cd2516848eba','print_color_type','BDD12','컬러 4도 + 베다','Color 4C + Full BG',3000,false,2),
('ba1a1416-8454-450b-887e-cd2516848eba','paper_size','CE101','대봉투 330×245','Large 330×245',0,true,1),
('ba1a1416-8454-450b-887e-cd2516848eba','paper_size','CE103','중봉투 260×190','Medium 260×190',-2000,false,2),
('ba1a1416-8454-450b-887e-cd2516848eba','paper_qty','500','500매','500 pcs',0,true,1),
('ba1a1416-8454-450b-887e-cd2516848eba','paper_qty','1000','1000매','1,000 pcs',15000,false,2),
('ba1a1416-8454-450b-887e-cd2516848eba','paper_qty','2000','2000매','2,000 pcs',28000,false,3);

-- ──────────────────────────────────────────────────────────
-- 라벨 (CLP1000) — print_color_type=fside_color_amount1, paper_size=small_size_type, paper_qty=paper_qty_select
-- barcode / food / price-labels
-- ──────────────────────────────────────────────────────────
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
-- barcode-labels
('c5bf627d-4969-4f66-bd2f-118fdd18bd79','paper_code','STR080ABN','아트지 80g','Art 80gsm',0,true,1),
('c5bf627d-4969-4f66-bd2f-118fdd18bd79','paper_code','STR080AKN','아트지 80g (강접)','Art 80gsm Strong',1000,false,2),
('c5bf627d-4969-4f66-bd2f-118fdd18bd79','paper_code','STR080YP1','유포지 80µ','Vinyl 80µm',3000,false,3),
('c5bf627d-4969-4f66-bd2f-118fdd18bd79','print_color_type','CMK40','4도 컬러 (CMYK)','4C (CMYK)',0,true,1),
('c5bf627d-4969-4f66-bd2f-118fdd18bd79','print_color_type','CMK10','1도 (CMYK)','1C',-5000,false,2),
('c5bf627d-4969-4f66-bd2f-118fdd18bd79','print_color_type','CMK51','별색 1도','Spot 1C',-3000,false,3),
('c5bf627d-4969-4f66-bd2f-118fdd18bd79','paper_size','SST01','실사이즈 100%','Actual 100%',0,true,1),
('c5bf627d-4969-4f66-bd2f-118fdd18bd79','paper_size','SST50','50% 축소','50% Reduced',0,false,2),
('c5bf627d-4969-4f66-bd2f-118fdd18bd79','paper_qty','1000','1,000매','1,000 pcs',0,true,1),
('c5bf627d-4969-4f66-bd2f-118fdd18bd79','paper_qty','2000','2,000매','2,000 pcs',8000,false,2),
('c5bf627d-4969-4f66-bd2f-118fdd18bd79','paper_qty','5000','5,000매','5,000 pcs',20000,false,3),
('c5bf627d-4969-4f66-bd2f-118fdd18bd79','paper_qty','10000','10,000매','10,000 pcs',38000,false,4),
-- food-labels
('39cc1116-0216-419f-ada6-0ca46d8ffb11','paper_code','STR080YP1','유포지 80µ (내수)','Vinyl 80µm (Waterproof)',0,true,1),
('39cc1116-0216-419f-ada6-0ca46d8ffb11','paper_code','STR080ABN','아트지 80g','Art 80gsm',-2000,false,2),
('39cc1116-0216-419f-ada6-0ca46d8ffb11','print_color_type','CMK40','4도 컬러 (CMYK)','4C (CMYK)',0,true,1),
('39cc1116-0216-419f-ada6-0ca46d8ffb11','print_color_type','CMK10','1도 (CMYK)','1C',-5000,false,2),
('39cc1116-0216-419f-ada6-0ca46d8ffb11','paper_size','SST01','실사이즈 100%','Actual 100%',0,true,1),
('39cc1116-0216-419f-ada6-0ca46d8ffb11','paper_size','SST50','50% 축소','50% Reduced',0,false,2),
('39cc1116-0216-419f-ada6-0ca46d8ffb11','paper_qty','1000','1,000매','1,000 pcs',0,true,1),
('39cc1116-0216-419f-ada6-0ca46d8ffb11','paper_qty','2000','2,000매','2,000 pcs',8000,false,2),
('39cc1116-0216-419f-ada6-0ca46d8ffb11','paper_qty','5000','5,000매','5,000 pcs',20000,false,3),
-- price-labels
('cdd21533-9483-4baa-938f-83e11d465b79','paper_code','STR080ABN','아트지 80g','Art 80gsm',0,true,1),
('cdd21533-9483-4baa-938f-83e11d465b79','paper_code','STR070VL0','모조지 70g','Woodfree 70gsm',-1000,false,2),
('cdd21533-9483-4baa-938f-83e11d465b79','print_color_type','CMK40','4도 컬러 (CMYK)','4C (CMYK)',0,true,1),
('cdd21533-9483-4baa-938f-83e11d465b79','print_color_type','CMK10','1도 (CMYK)','1C',-5000,false,2),
('cdd21533-9483-4baa-938f-83e11d465b79','print_color_type','CMK51','별색 1도','Spot 1C',-3000,false,3),
('cdd21533-9483-4baa-938f-83e11d465b79','paper_size','SST01','실사이즈 100%','Actual 100%',0,true,1),
('cdd21533-9483-4baa-938f-83e11d465b79','paper_size','SST20','20% 축소','20% Reduced',0,false,2),
('cdd21533-9483-4baa-938f-83e11d465b79','paper_qty','1000','1,000매','1,000 pcs',0,true,1),
('cdd21533-9483-4baa-938f-83e11d465b79','paper_qty','2000','2,000매','2,000 pcs',8000,false,2),
('cdd21533-9483-4baa-938f-83e11d465b79','paper_qty','5000','5,000매','5,000 pcs',20000,false,3);

-- ──────────────────────────────────────────────────────────
-- 책자 (CPR4000) — paper_code=cover_paper_code, print_color_type=binding_type, paper_qty=bundle_qty
-- catalogs / perfect-bound-booklet / saddle-stitch-booklet
-- ──────────────────────────────────────────────────────────
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
-- catalogs
('90001d30-eeae-4bd4-9163-4b1ba6b2eca6','paper_code','ARE160W00','표지 울트라화이트 160g','Cover UltraWhite 160gsm',0,true,1),
('90001d30-eeae-4bd4-9163-4b1ba6b2eca6','paper_code','ARE190W00','표지 울트라화이트 190g','Cover UltraWhite 190gsm',5000,false,2),
('90001d30-eeae-4bd4-9163-4b1ba6b2eca6','paper_code','ARE210W00','표지 울트라화이트 210g','Cover UltraWhite 210gsm',10000,false,3),
('90001d30-eeae-4bd4-9163-4b1ba6b2eca6','print_color_type','BDT6','PUR 무선제본','PUR Perfect Binding',0,true,1),
('90001d30-eeae-4bd4-9163-4b1ba6b2eca6','print_color_type','BDT2','중철제본','Saddle Stitch',-5000,false,2),
('90001d30-eeae-4bd4-9163-4b1ba6b2eca6','print_color_type','BDT4','스프링제본','Spiral Binding',8000,false,3),
('90001d30-eeae-4bd4-9163-4b1ba6b2eca6','paper_size','CPR11','A4','A4',0,true,1),
('90001d30-eeae-4bd4-9163-4b1ba6b2eca6','paper_size','CPR12','A5','A5',-5000,false,2),
('90001d30-eeae-4bd4-9163-4b1ba6b2eca6','paper_size','CPR13','B5 (16절)','B5',-3000,false,3),
('90001d30-eeae-4bd4-9163-4b1ba6b2eca6','paper_qty','50','50부','50 sets',0,true,1),
('90001d30-eeae-4bd4-9163-4b1ba6b2eca6','paper_qty','100','100부','100 sets',30000,false,2),
('90001d30-eeae-4bd4-9163-4b1ba6b2eca6','paper_qty','200','200부','200 sets',70000,false,3),
('90001d30-eeae-4bd4-9163-4b1ba6b2eca6','paper_qty','500','500부','500 sets',150000,false,4),
-- perfect-bound-booklet
('f1c5541b-45d8-4d2b-9424-76f58f3a99ce','paper_code','ARE160W00','표지 울트라화이트 160g','Cover UltraWhite 160gsm',0,true,1),
('f1c5541b-45d8-4d2b-9424-76f58f3a99ce','paper_code','ARE190W00','표지 울트라화이트 190g','Cover UltraWhite 190gsm',5000,false,2),
('f1c5541b-45d8-4d2b-9424-76f58f3a99ce','paper_code','ARE210W00','표지 울트라화이트 210g','Cover UltraWhite 210gsm',10000,false,3),
('f1c5541b-45d8-4d2b-9424-76f58f3a99ce','print_color_type','BDT6','PUR 무선제본','PUR Perfect Binding',0,true,1),
('f1c5541b-45d8-4d2b-9424-76f58f3a99ce','print_color_type','BDT4','스프링제본','Spiral Binding',8000,false,2),
('f1c5541b-45d8-4d2b-9424-76f58f3a99ce','paper_size','CPR11','A4','A4',0,true,1),
('f1c5541b-45d8-4d2b-9424-76f58f3a99ce','paper_size','CPR12','A5','A5',-5000,false,2),
('f1c5541b-45d8-4d2b-9424-76f58f3a99ce','paper_size','CPR13','B5 (16절)','B5',-3000,false,3),
('f1c5541b-45d8-4d2b-9424-76f58f3a99ce','paper_qty','50','50부','50 sets',0,true,1),
('f1c5541b-45d8-4d2b-9424-76f58f3a99ce','paper_qty','100','100부','100 sets',30000,false,2),
('f1c5541b-45d8-4d2b-9424-76f58f3a99ce','paper_qty','200','200부','200 sets',70000,false,3),
-- saddle-stitch-booklet
('b9b2a844-9e42-4f31-bb55-1d4fe0d5838f','paper_code','ARE160W00','표지 울트라화이트 160g','Cover UltraWhite 160gsm',0,true,1),
('b9b2a844-9e42-4f31-bb55-1d4fe0d5838f','paper_code','ARE190W00','표지 울트라화이트 190g','Cover UltraWhite 190gsm',5000,false,2),
('b9b2a844-9e42-4f31-bb55-1d4fe0d5838f','print_color_type','BDT2','중철제본','Saddle Stitch',0,true,1),
('b9b2a844-9e42-4f31-bb55-1d4fe0d5838f','print_color_type','BDT6','PUR 무선제본','PUR Perfect Binding',5000,false,2),
('b9b2a844-9e42-4f31-bb55-1d4fe0d5838f','paper_size','CPR11','A4','A4',0,true,1),
('b9b2a844-9e42-4f31-bb55-1d4fe0d5838f','paper_size','CPR12','A5','A5',-5000,false,2),
('b9b2a844-9e42-4f31-bb55-1d4fe0d5838f','paper_size','CPR13','B5 (16절)','B5',-3000,false,3),
('b9b2a844-9e42-4f31-bb55-1d4fe0d5838f','paper_qty','50','50부','50 sets',0,true,1),
('b9b2a844-9e42-4f31-bb55-1d4fe0d5838f','paper_qty','100','100부','100 sets',30000,false,2),
('b9b2a844-9e42-4f31-bb55-1d4fe0d5838f','paper_qty','200','200부','200 sets',70000,false,3);

-- ──────────────────────────────────────────────────────────
-- 벽걸이 캘린더 (CCD1000) — print_color_type=print_method, paper_qty=paper_qty_select
-- ──────────────────────────────────────────────────────────
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('c8790fc6-d41e-4b8a-9802-886f0e96dd9f','paper_code','ART180W00','아트지 백색 180g','Art White 180gsm',0,true,1),
('c8790fc6-d41e-4b8a-9802-886f0e96dd9f','paper_code','ART250W00','아트지 백색 250g','Art White 250gsm',3000,false,2),
('c8790fc6-d41e-4b8a-9802-886f0e96dd9f','paper_code','RDV160N00','랑데뷰 내츄럴 160g','Rendezvous Natural 160gsm',8000,false,3),
('c8790fc6-d41e-4b8a-9802-886f0e96dd9f','print_color_type','PTC10','양면 8도','Double-sided 8C',0,true,1),
('c8790fc6-d41e-4b8a-9802-886f0e96dd9f','print_color_type','PTC20','양면 8도 (UV인쇄)','Double-sided 8C (UV)',5000,false,2),
('c8790fc6-d41e-4b8a-9802-886f0e96dd9f','print_color_type','PTC30','양면 8도 + 금박','Double-sided 8C + Gold Foil',15000,false,3),
('c8790fc6-d41e-4b8a-9802-886f0e96dd9f','paper_size','CCD01','삼각대 230×165','Easel 230×165',0,true,1),
('c8790fc6-d41e-4b8a-9802-886f0e96dd9f','paper_size','CCD02','삼각대 260×190','Easel 260×190',3000,false,2),
('c8790fc6-d41e-4b8a-9802-886f0e96dd9f','paper_size','CCD03','삼각대 297×210','Easel 297×210',6000,false,3),
('c8790fc6-d41e-4b8a-9802-886f0e96dd9f','paper_qty','100','100부','100 sets',0,true,1),
('c8790fc6-d41e-4b8a-9802-886f0e96dd9f','paper_qty','300','300부','300 sets',45000,false,2),
('c8790fc6-d41e-4b8a-9802-886f0e96dd9f','paper_qty','500','500부','500 sets',70000,false,3),
('c8790fc6-d41e-4b8a-9802-886f0e96dd9f','paper_qty','1000','1000부','1,000 sets',130000,false,4);

-- ──────────────────────────────────────────────────────────
-- 탁상/미니 캘린더 (CCD2000) — print_color_type=print_method, paper_qty=paper_qty_select
-- desk / mini-calendars
-- ──────────────────────────────────────────────────────────
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
-- desk-calendars
('e1a545b2-4db9-4a72-921e-8125901f8c97','paper_code','ART180W00','아트지 백색 180g','Art White 180gsm',0,true,1),
('e1a545b2-4db9-4a72-921e-8125901f8c97','paper_code','SNW180W00','스노우지 백색 180g','Snow White 180gsm',0,false,2),
('e1a545b2-4db9-4a72-921e-8125901f8c97','paper_code','RDV240N00','랑데뷰 내츄럴 240g','Rendezvous Natural 240gsm',8000,false,3),
('e1a545b2-4db9-4a72-921e-8125901f8c97','print_color_type','DPF12','단면 컬러 12P','Single-sided 12 page',0,true,1),
('e1a545b2-4db9-4a72-921e-8125901f8c97','print_color_type','DPB24','양면 컬러 24P','Double-sided 24 page',8000,false,2),
('e1a545b2-4db9-4a72-921e-8125901f8c97','paper_size','CCD60','삼각대 230×165','Easel 230×165',0,true,1),
('e1a545b2-4db9-4a72-921e-8125901f8c97','paper_size','CCD61','삼각대 260×190','Easel 260×190',3000,false,2),
('e1a545b2-4db9-4a72-921e-8125901f8c97','paper_size','CCD62','삼각대 297×210','Easel 297×210',6000,false,3),
('e1a545b2-4db9-4a72-921e-8125901f8c97','paper_qty','10','10부','10 sets',0,true,1),
('e1a545b2-4db9-4a72-921e-8125901f8c97','paper_qty','30','30부','30 sets',25000,false,2),
('e1a545b2-4db9-4a72-921e-8125901f8c97','paper_qty','50','50부','50 sets',40000,false,3),
('e1a545b2-4db9-4a72-921e-8125901f8c97','paper_qty','100','100부','100 sets',75000,false,4),
-- mini-calendars
('6095f57c-c4c6-435c-bedb-9b82b852b9da','paper_code','SNW180W00','스노우지 백색 180g','Snow White 180gsm',0,true,1),
('6095f57c-c4c6-435c-bedb-9b82b852b9da','paper_code','ART180W00','아트지 백색 180g','Art White 180gsm',0,false,2),
('6095f57c-c4c6-435c-bedb-9b82b852b9da','print_color_type','DPF12','단면 컬러 12P','Single-sided 12 page',0,true,1),
('6095f57c-c4c6-435c-bedb-9b82b852b9da','print_color_type','DPB24','양면 컬러 24P','Double-sided 24 page',8000,false,2),
('6095f57c-c4c6-435c-bedb-9b82b852b9da','paper_size','CCD63','삼각대 180×200','Easel 180×200',0,true,1),
('6095f57c-c4c6-435c-bedb-9b82b852b9da','paper_size','CCD60','삼각대 230×165','Easel 230×165',2000,false,2),
('6095f57c-c4c6-435c-bedb-9b82b852b9da','paper_qty','10','10부','10 sets',0,true,1),
('6095f57c-c4c6-435c-bedb-9b82b852b9da','paper_qty','30','30부','30 sets',25000,false,2),
('6095f57c-c4c6-435c-bedb-9b82b852b9da','paper_qty','50','50부','50 sets',40000,false,3);

-- ──────────────────────────────────────────────────────────
-- 서식/양식 (CNR2000) — print_color_type=fside_color_amount, paper_size=code_size_type
-- receipts / quotation / invoice / ncr-forms
-- ──────────────────────────────────────────────────────────
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
-- receipts
('cd611fb9-1ef5-424f-9d4e-73a5ee8fc4e5','paper_code','VLD08001E','모조지 백색 80g','Woodfree 80gsm',0,true,1),
('cd611fb9-1ef5-424f-9d4e-73a5ee8fc4e5','paper_code','VLD10001E','모조지 백색 100g','Woodfree 100gsm',2000,false,2),
('cd611fb9-1ef5-424f-9d4e-73a5ee8fc4e5','print_color_type','NCC10','먹 1도','Black 1C',0,true,1),
('cd611fb9-1ef5-424f-9d4e-73a5ee8fc4e5','print_color_type','NCC30','금적 1도','Red 1C',3000,false,2),
('cd611fb9-1ef5-424f-9d4e-73a5ee8fc4e5','print_color_type','NCC40','먹 1도 + 금적 1도','Black 1C + Red 1C',6000,false,3),
('cd611fb9-1ef5-424f-9d4e-73a5ee8fc4e5','paper_size','CNR22','A4','A4',0,true,1),
('cd611fb9-1ef5-424f-9d4e-73a5ee8fc4e5','paper_size','CNR21','A5','A5',-3000,false,2),
('cd611fb9-1ef5-424f-9d4e-73a5ee8fc4e5','paper_size','CNR20','A6','A6',-5000,false,3),
('cd611fb9-1ef5-424f-9d4e-73a5ee8fc4e5','paper_qty','4000','4,000매','4,000 pcs',0,true,1),
('cd611fb9-1ef5-424f-9d4e-73a5ee8fc4e5','paper_qty','8000','8,000매','8,000 pcs',18000,false,2),
('cd611fb9-1ef5-424f-9d4e-73a5ee8fc4e5','paper_qty','16000','16,000매','16,000 pcs',34000,false,3),
-- quotation-forms
('d18906bc-b840-48b4-afe6-97e744433057','paper_code','VLD08001E','모조지 백색 80g','Woodfree 80gsm',0,true,1),
('d18906bc-b840-48b4-afe6-97e744433057','paper_code','VLD10001E','모조지 백색 100g','Woodfree 100gsm',2000,false,2),
('d18906bc-b840-48b4-afe6-97e744433057','print_color_type','NCC10','먹 1도','Black 1C',0,true,1),
('d18906bc-b840-48b4-afe6-97e744433057','print_color_type','NCC30','금적 1도','Red 1C',3000,false,2),
('d18906bc-b840-48b4-afe6-97e744433057','paper_size','CNR22','A4','A4',0,true,1),
('d18906bc-b840-48b4-afe6-97e744433057','paper_size','CNR21','A5','A5',-3000,false,2),
('d18906bc-b840-48b4-afe6-97e744433057','paper_qty','4000','4,000매','4,000 pcs',0,true,1),
('d18906bc-b840-48b4-afe6-97e744433057','paper_qty','8000','8,000매','8,000 pcs',18000,false,2),
-- invoice-forms
('4480d72b-6047-4960-9984-13b5d922e27c','paper_code','VLD08001E','모조지 백색 80g','Woodfree 80gsm',0,true,1),
('4480d72b-6047-4960-9984-13b5d922e27c','paper_code','VLD10001E','모조지 백색 100g','Woodfree 100gsm',2000,false,2),
('4480d72b-6047-4960-9984-13b5d922e27c','print_color_type','NCC10','먹 1도','Black 1C',0,true,1),
('4480d72b-6047-4960-9984-13b5d922e27c','print_color_type','NCC40','먹 1도 + 금적 1도','Black 1C + Red 1C',6000,false,2),
('4480d72b-6047-4960-9984-13b5d922e27c','paper_size','CNR22','A4','A4',0,true,1),
('4480d72b-6047-4960-9984-13b5d922e27c','paper_size','CNR21','A5','A5',-3000,false,2),
('4480d72b-6047-4960-9984-13b5d922e27c','paper_qty','4000','4,000매','4,000 pcs',0,true,1),
('4480d72b-6047-4960-9984-13b5d922e27c','paper_qty','8000','8,000매','8,000 pcs',18000,false,2),
-- ncr-forms (낱장 양식 — 모조지)
('0e4935b6-bf26-4484-a25b-1d50658d0de5','paper_code','VLD08001E','모조지 백색 80g','Woodfree 80gsm',0,true,1),
('0e4935b6-bf26-4484-a25b-1d50658d0de5','paper_code','VLD10001E','모조지 백색 100g','Woodfree 100gsm',2000,false,2),
('0e4935b6-bf26-4484-a25b-1d50658d0de5','print_color_type','NCC10','먹 1도','Black 1C',0,true,1),
('0e4935b6-bf26-4484-a25b-1d50658d0de5','print_color_type','NCC30','금적 1도','Red 1C',3000,false,2),
('0e4935b6-bf26-4484-a25b-1d50658d0de5','paper_size','CNR22','A4','A4',0,true,1),
('0e4935b6-bf26-4484-a25b-1d50658d0de5','paper_size','CNR21','A5','A5',-3000,false,2),
('0e4935b6-bf26-4484-a25b-1d50658d0de5','paper_qty','4000','4,000매','4,000 pcs',0,true,1),
('0e4935b6-bf26-4484-a25b-1d50658d0de5','paper_qty','8000','8,000매','8,000 pcs',18000,false,2);

-- ──────────────────────────────────────────────────────────
-- 리플렛 (CPR3000) — print_color_type=print_method (paper_code/paper_size/paper_qty 1:1)
-- ──────────────────────────────────────────────────────────
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('17198d31-4264-4cbb-8a06-44b550bf08f0','paper_code','ART100W00','아트지 백색 100g','Art White 100gsm',0,true,1),
('17198d31-4264-4cbb-8a06-44b550bf08f0','paper_code','ART120W00','아트지 백색 120g','Art White 120gsm',2000,false,2),
('17198d31-4264-4cbb-8a06-44b550bf08f0','paper_code','ART150W00','아트지 백색 150g','Art White 150gsm',4000,false,3),
('17198d31-4264-4cbb-8a06-44b550bf08f0','paper_code','ART200W00','아트지 백색 200g','Art White 200gsm',8000,false,4),
('17198d31-4264-4cbb-8a06-44b550bf08f0','print_color_type','PTM10','일반인쇄','Standard Print',0,true,1),
('17198d31-4264-4cbb-8a06-44b550bf08f0','print_color_type','PTM20','UV인쇄','UV Print',5000,false,2),
('17198d31-4264-4cbb-8a06-44b550bf08f0','paper_size','A0400','A4 (210×297mm)','A4',0,true,1),
('17198d31-4264-4cbb-8a06-44b550bf08f0','paper_size','A0500','A5 (148×210mm)','A5',-3000,false,2),
('17198d31-4264-4cbb-8a06-44b550bf08f0','paper_size','A0300','A3 (297×420mm)','A3',8000,false,3),
('17198d31-4264-4cbb-8a06-44b550bf08f0','paper_size','B0500','B5 (16절)','B5',0,false,4),
('17198d31-4264-4cbb-8a06-44b550bf08f0','paper_qty','1000','1,000매','1,000 pcs',0,true,1),
('17198d31-4264-4cbb-8a06-44b550bf08f0','paper_qty','2000','2,000매','2,000 pcs',10000,false,2),
('17198d31-4264-4cbb-8a06-44b550bf08f0','paper_qty','4000','4,000매','4,000 pcs',25000,false,3),
('17198d31-4264-4cbb-8a06-44b550bf08f0','paper_qty','8000','8,000매','8,000 pcs',45000,false,4);

-- ──────────────────────────────────────────────────────────
-- 메뉴판 (CLF2000) — print_color_type=print_method (브로슈어와 동일 카테고리)
-- ──────────────────────────────────────────────────────────
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('5c8f988f-6150-4279-a3fc-44ffdfe786bb','paper_code','ART150W00','아트지 백색 150g','Art White 150gsm',0,true,1),
('5c8f988f-6150-4279-a3fc-44ffdfe786bb','paper_code','ART200W00','아트지 백색 200g','Art White 200gsm',3000,false,2),
('5c8f988f-6150-4279-a3fc-44ffdfe786bb','paper_code','ART250W00','아트지 백색 250g','Art White 250gsm',6000,false,3),
('5c8f988f-6150-4279-a3fc-44ffdfe786bb','paper_code','ART300W00','아트지 백색 300g','Art White 300gsm',10000,false,4),
('5c8f988f-6150-4279-a3fc-44ffdfe786bb','print_color_type','PTM10','일반인쇄','Standard Print',0,true,1),
('5c8f988f-6150-4279-a3fc-44ffdfe786bb','print_color_type','PTM20','UV인쇄','UV Print',5000,false,2),
('5c8f988f-6150-4279-a3fc-44ffdfe786bb','paper_size','A0400','A4 (210×297mm)','A4',0,true,1),
('5c8f988f-6150-4279-a3fc-44ffdfe786bb','paper_size','A0300','A3 (297×420mm)','A3',8000,false,2),
('5c8f988f-6150-4279-a3fc-44ffdfe786bb','paper_size','A0500','A5 (148×210mm)','A5',-3000,false,3),
('5c8f988f-6150-4279-a3fc-44ffdfe786bb','paper_size','B0400','B4 (8절)','B4',5000,false,4),
('5c8f988f-6150-4279-a3fc-44ffdfe786bb','paper_qty','1000','1,000매','1,000 pcs',0,true,1),
('5c8f988f-6150-4279-a3fc-44ffdfe786bb','paper_qty','2000','2,000매','2,000 pcs',10000,false,2),
('5c8f988f-6150-4279-a3fc-44ffdfe786bb','paper_qty','4000','4,000매','4,000 pcs',25000,false,3);

-- ──────────────────────────────────────────────────────────
-- 홀로그램 스티커 (CST5000) — 카드형 1:1 (alias 불필요)
-- ──────────────────────────────────────────────────────────
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('a08d3ca7-35e5-4b91-a17a-3da7997cb290','paper_code','STR050SL1','샤인실버 PET 50µ','Shine Silver PET 50µm',0,true,1),
('a08d3ca7-35e5-4b91-a17a-3da7997cb290','paper_code','STR060GD3','금지 무광 60µ','Gold Matte 60µm',2000,false,2),
('a08d3ca7-35e5-4b91-a17a-3da7997cb290','paper_code','STR060SD4','은지 무광 60µ','Silver Matte 60µm',2000,false,3),
('a08d3ca7-35e5-4b91-a17a-3da7997cb290','paper_code','STR090PC0','파스칼 백색 PVC 90µ','Pascal White PVC 90µm',3000,false,4),
('a08d3ca7-35e5-4b91-a17a-3da7997cb290','print_color_type','SPD10','단면 컬러 4도','Single-sided 4C',0,true,1),
('a08d3ca7-35e5-4b91-a17a-3da7997cb290','print_color_type','SPD40','단면 컬러 4도 + 백색','Single-sided 4C + White',3000,false,2),
('a08d3ca7-35e5-4b91-a17a-3da7997cb290','paper_size','STRA4','A4','A4',0,true,1),
('a08d3ca7-35e5-4b91-a17a-3da7997cb290','paper_size','STRA3','A3','A3',5000,false,2),
('a08d3ca7-35e5-4b91-a17a-3da7997cb290','paper_size','STRA5','A5','A5',-2000,false,3),
('a08d3ca7-35e5-4b91-a17a-3da7997cb290','paper_qty','100','100매','100 pcs',0,true,1),
('a08d3ca7-35e5-4b91-a17a-3da7997cb290','paper_qty','500','500매','500 pcs',15000,false,2),
('a08d3ca7-35e5-4b91-a17a-3da7997cb290','paper_qty','1000','1000매','1,000 pcs',28000,false,3),
('a08d3ca7-35e5-4b91-a17a-3da7997cb290','paper_qty','2000','2000매','2,000 pcs',50000,false,4);

-- ──────────────────────────────────────────────────────────
-- 롤 스티커 (CST7000) — 카드형 1:1 (alias 불필요)
-- ──────────────────────────────────────────────────────────
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
('94a0d223-1a6b-470c-a5a8-9a46aa4c5362','paper_code','STR050W03','투명 PP 50µ','Transparent PP 50µm',0,true,1),
('94a0d223-1a6b-470c-a5a8-9a46aa4c5362','print_color_type','SPD10','단면 컬러 4도','Single-sided 4C',0,true,1),
('94a0d223-1a6b-470c-a5a8-9a46aa4c5362','print_color_type','SPD40','단면 컬러 4도 + 백색','Single-sided 4C + White',3000,false,2),
('94a0d223-1a6b-470c-a5a8-9a46aa4c5362','paper_size','STR03','5m×50mm (롤)','5m×50mm (Roll)',0,true,1),
('94a0d223-1a6b-470c-a5a8-9a46aa4c5362','paper_qty','100','100매','100 pcs',0,true,1),
('94a0d223-1a6b-470c-a5a8-9a46aa4c5362','paper_qty','300','300매','300 pcs',12000,false,2),
('94a0d223-1a6b-470c-a5a8-9a46aa4c5362','paper_qty','500','500매','500 pcs',20000,false,3),
('94a0d223-1a6b-470c-a5a8-9a46aa4c5362','paper_qty','1000','1000매','1,000 pcs',35000,false,4);

-- ──────────────────────────────────────────────────────────
-- 배너류 (CPR5000) — ⚠ 카테고리 코드 재확인 필요 (라이브=포켓홀더). 표시용 값만 시드, 자동발주 보류.
-- mini / rollup / x-banners — 기존 'banners' 제품과 동일 패턴
-- ──────────────────────────────────────────────────────────
INSERT INTO print_product_options (product_id, option_type, value, label_ko, label_en, extra_price_krw, is_default, sort_order) VALUES
-- x-banners
('de32c75e-8b1a-46ca-9d9d-74c9c3aefe94','paper_code','BNR510W00','현수막 510g (표준)','PVC Banner 510gsm',0,true,1),
('de32c75e-8b1a-46ca-9d9d-74c9c3aefe94','paper_code','BNR440W00','현수막 440g','PVC Banner 440gsm',-5000,false,2),
('de32c75e-8b1a-46ca-9d9d-74c9c3aefe94','paper_size','SZT20','사이즈 직접 입력','Custom Size',0,true,1),
('de32c75e-8b1a-46ca-9d9d-74c9c3aefe94','paper_qty','1','1장','1 pc',0,true,1),
('de32c75e-8b1a-46ca-9d9d-74c9c3aefe94','paper_qty','2','2장','2 pcs',8000,false,2),
('de32c75e-8b1a-46ca-9d9d-74c9c3aefe94','paper_qty','5','5장','5 pcs',18000,false,3),
-- rollup-banners
('7f25550a-e7f0-4fa9-a367-d80ae4011a43','paper_code','BNR510W00','현수막 510g (표준)','PVC Banner 510gsm',0,true,1),
('7f25550a-e7f0-4fa9-a367-d80ae4011a43','paper_size','SZT20','사이즈 직접 입력','Custom Size',0,true,1),
('7f25550a-e7f0-4fa9-a367-d80ae4011a43','paper_qty','1','1장','1 pc',0,true,1),
('7f25550a-e7f0-4fa9-a367-d80ae4011a43','paper_qty','2','2장','2 pcs',8000,false,2),
('7f25550a-e7f0-4fa9-a367-d80ae4011a43','paper_qty','5','5장','5 pcs',18000,false,3),
-- mini-banners
('8a15d89f-ff21-4a6e-ae9f-fabb362540ac','paper_code','BNR510W00','현수막 510g (표준)','PVC Banner 510gsm',0,true,1),
('8a15d89f-ff21-4a6e-ae9f-fabb362540ac','paper_size','SZT20','사이즈 직접 입력','Custom Size',0,true,1),
('8a15d89f-ff21-4a6e-ae9f-fabb362540ac','paper_qty','1','1장','1 pc',0,true,1),
('8a15d89f-ff21-4a6e-ae9f-fabb362540ac','paper_qty','2','2장','2 pcs',8000,false,2),
('8a15d89f-ff21-4a6e-ae9f-fabb362540ac','paper_qty','5','5장','5 pcs',18000,false,3);
