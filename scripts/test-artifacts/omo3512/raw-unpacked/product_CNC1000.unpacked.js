var Product=Class.create(Print,{
initialize:function($super){
$super();
ppOsi=new ppOsi();
ppMissing=new ppMissing();
ppDomusong=new ppDomusong();
ppBak=new ppBak();
ppAP=new ppAP();
ppNumbering=new ppNumbering();
ppTagong=new ppTagong();
ppGuidori=new ppGuidori();
ppEpoxy=new ppEpoxy();
ppDBak=new ppDBak()
}
,init:function(){
this.optionPaperCode();
this.optionPaperQty();
this.settingPaperSize();
this.saveDataLoad();
this.caluPrintPrice();
this.bakApCompare();
this.saveIsPostpress();
this.calcuEstimate()
}
,saveDataLoad:function(){
this.thisPositionSelectOptions("fside_color_amount",$('save_fside_color_amount').value);
this.thisPositionSelectOptions("bside_color_amount",$('save_bside_color_amount').value);
this.thisPositionSelectOptions("fside_spot_color",$('save_fside_spot_color').value);
this.thisPositionSelectOptions("bside_spot_color",$('save_bside_spot_color').value);
this.thisPositionSelectOptions("print_color_type",$('save_print_color_type').value);
this.thisPositionSelectOptions("size_type",$('save_size_type').value);
this.thisPositionSelectOptions("order_count",$('save_order_count').value);
this.thisPositionSelectOptions("osi_num",$('save_osi_num').value);
this.thisPositionSelectOptions("missing_num",$('save_missing_num').value);
this.thisPositionSelectOptions("domusong_section",$('save_domusong_section').value);
this.thisPositionSelectOptions("domusong_type",$('save_domusong_type').value);
this.thisPositionSelectOptions("domusong_num",$('save_domusong_num').value);
this.thisPositionSelectOptions("bak_section_1",$('save_bak_section_1').value);
this.thisPositionSelectOptions("bak_side_1",$('save_bak_side_1').value);
this.thisPositionSelectOptions("bak_type_1",$('save_bak_type_1').value);
this.thisPositionSelectOptions("bak_section_2",$('save_bak_section_2').value);
this.thisPositionSelectOptions("bak_side_2",$('save_bak_side_2').value);
this.thisPositionSelectOptions("bak_type_2",$('save_bak_type_2').value);
this.thisPositionSelectOptions("bak_section_3",$('save_bak_section_3').value);
this.thisPositionSelectOptions("bak_side_3",$('save_bak_side_3').value);
this.thisPositionSelectOptions("bak_type_3",$('save_bak_type_3').value);
this.thisPositionSelectOptions("ap_section_1",$('save_ap_section_1').value);
this.thisPositionSelectOptions("ap_type_1",$('save_ap_type_1').value);
this.thisPositionSelectOptions("ap_section_2",$('save_ap_section_2').value);
this.thisPositionSelectOptions("ap_type_2",$('save_ap_type_2').value);
this.thisPositionSelectOptions("ap_section_3",$('save_ap_section_3').value);
this.thisPositionSelectOptions("ap_type_3",$('save_ap_type_3').value);
this.thisPositionSelectOptions("numbering_type",$('save_numbering_type').value);
this.thisPositionSelectOptions("numbering_kind",$('save_numbering_kind').value);
this.thisPositionSelectOptions("tagong_num",$('save_tagong_num').value);
this.thisPositionSelectOptions("tagong_size",$('save_tagong_size').value);
this.thisPositionSelectOptions("guidori_type",$('save_guidori_type').value);
this.thisPositionSelectOptions("epoxy_type",$('save_epoxy_type').value);
this.thisPositionSelectOptions("epoxy_kind",$('save_epoxy_kind').value);
this.thisPositionSelectOptions("bak_compare_2",$('save_bak_compare_2').value);
this.thisPositionSelectOptions("bak_compare_3",$('save_bak_compare_3').value);
this.thisPositionSelectOptions("ap_compare_2",$('save_ap_compare_2').value);
this.thisPositionSelectOptions("ap_compare_3",$('save_ap_compare_3').value);
if(category_code=="CNC2000"){
this.thisPositionSelectOptions("dbak_section_1",$('save_dbak_section_1').value);
this.thisPositionSelectOptions("dbak_side_1",$('save_dbak_side_1').value);
this.thisPositionSelectOptions("dbak_type_1",$('save_dbak_type_1').value);
this.thisPositionSelectOptions("dbak_section_2",$('save_dbak_section_2').value);
this.thisPositionSelectOptions("dbak_side_2",$('save_dbak_side_2').value);
this.thisPositionSelectOptions("dbak_type_2",$('save_dbak_type_2').value);
this.thisPositionSelectOptions("dbak_section_3",$('save_dbak_section_3').value);
this.thisPositionSelectOptions("dbak_side_3",$('save_dbak_side_3').value);
this.thisPositionSelectOptions("dbak_type_3",$('save_dbak_type_3').value)
}
this.thisPositionSelectOptions("f_design_type",$('save_f_design_type').value);
this.thisPositionSelectOptions("f_design_edit",$('save_f_design_edit').value);
this.thisPositionSelectOptions("b_design_type",$('save_b_design_type').value);
this.thisPositionSelectOptions("b_design_edit",$('save_b_design_edit').value);
this.thisPositionSelectOptions("design_price_add1",$('save_design_price_add1').value);
this.thisPositionSelectOptions("design_price_add2",$('save_design_price_add2').value);
this.thisPositionSelectOptions("design_price_add3",$('save_design_price_add3').value);
this.thisPositionSelectOptions("design_price_add4",$('save_design_price_add4').value);
this.thisPositionSelectOptions("design_price_add5",$('save_design_price_add5').value);
this.thisPositionSelectOptions("f_cnt_type",$('save_f_cnt_type').value);
this.thisPositionSelectOptions("f_cnt_edit",$('save_f_cnt_edit').value);
this.thisPositionSelectOptions("b_cnt_type",$('save_b_cnt_type').value);
this.thisPositionSelectOptions("b_cnt_edit",$('save_b_cnt_edit').value);
this.thisPositionSelectOptions("d_cnt_add1",$('save_d_cnt_add1').value);
this.thisPositionSelectOptions("d_cnt_add2",$('save_d_cnt_add2').value);
this.thisPositionSelectOptions("d_cnt_add3",$('save_d_cnt_add3').value);
this.thisPositionSelectOptions("d_cnt_add4",$('save_d_cnt_add4').value);
this.thisPositionSelectOptions("d_cnt_add5",$('save_d_cnt_add5').value);
if($('save_cut_x_size').value!=''){
this.setCutXSize($('save_cut_x_size').value)
}
if($('save_cut_y_size').value!=''){
this.setCutYSize($('save_cut_y_size').value)
}
if($('save_work_x_size').value!=''){
this.setWorkXSize($('save_work_x_size').value)
}
if($('save_work_y_size').value!=''){
this.setWorkYSize($('save_work_y_size').value)
}
$('bak_size_over_1').value=$('save_bak_size_over_1').value;
$('bak_size_over_2').value=$('save_bak_size_over_2').value;
$('bak_size_over_3').value=$('save_bak_size_over_3').value;
if($('save_is_today').value==1){
document.getElementsByName('is_today')[1].checked=true;
calcuIsToday()
}
else{
document.getElementsByName('is_today')[0].checked=true
}
if($('save_is_sat').value==1){
document.getElementsByName('is_sat')[1].checked=true;
calcuIsSat()
}
else{
document.getElementsByName('is_sat')[0].checked=true
}

}
,saveIsPostpress:function(){
if($('save_is_pp_osi').value==1){
$('chk_is_osi').checked=true;
chkPostPress('1','osi')
}
if($('save_is_pp_missing').value==1){
$('chk_is_missing').checked=true;
chkPostPress('1','missing')
}
if($('save_is_pp_domusong').value==1){
$('chk_is_domusong').checked=true;
chkPostPress('1','domusong')
}
if($('save_is_pp_bak').value==1){
$('chk_is_bak').checked=true;
chkPostPress('1','bak');
if($('save_bak_x_size_2').value!=""&&$('save_bak_y_size_2').value!=""){
$j('#btn_add_bak2').hide();
$j('#pnl_bak2').show();
ppBak.setBakSeq(2);
ppBak.calcuBakPrice()
}
if($('save_bak_x_size_3').value!=""&&$('save_bak_y_size_3').value!=""){
$j('#btn_add_bak3').hide();
$j('#pnl_bak3').show();
ppBak.setBakSeq(3);
ppBak.calcuBakPrice()
}
this.setPPBakAmtSum();
this.caluPrintPrice();
this.calcuEstimate()
}
if($('save_is_pp_ap').value==1){
$('chk_is_ap').checked=true;
chkPostPress('1','ap');
if($('save_ap_x_size_2').value!=""&&$('save_ap_y_size_2').value!=""){
$j('#btn_add_ap2').hide();
$j('#pnl_ap2').show();
ppAP.setAPSeq(2);
ppAP.calcuAPPrice()
}
if($('save_ap_x_size_3').value!=""&&$('save_ap_y_size_3').value!=""){
$j('#btn_add_ap3').hide();
$j('#pnl_ap3').show();
ppAP.setAPSeq(3);
ppAP.calcuAPPrice()
}
this.setPPApAmtSum();
this.caluPrintPrice();
this.calcuEstimate()
}
if($('save_is_pp_numbering').value==1){
$('chk_is_numbering').checked=true;
chkPostPress('1','numbering')
}
if($('save_is_pp_tagong').value==1){
$('chk_is_tagong').checked=true;
chkPostPress('1','tagong')
}
if($('save_is_pp_guidori').value==1){
$('chk_is_guidori').checked=true;
guidori_etc1=$('save_guidori_etc1').value;
guidori_etc1_arry=guidori_etc1.split("|");
if(guidori_etc1_arry[0]){
$('guidori_position1').checked=true
}
if(guidori_etc1_arry[1]){
$('guidori_position2').checked=true
}
if(guidori_etc1_arry[2]){
$('guidori_position3').checked=true
}
if(guidori_etc1_arry[3]){
$('guidori_position4').checked=true
}
chkPostPress('1','guidori')
}
if($('save_is_pp_epoxy').value==1){
$('chk_is_epoxy').checked=true;
chkPostPress('1','epoxy')
}
if($('save_is_pp_dbak').value==1){
$('chk_is_dbak').checked=true;
chkPostPress('1','dbak');
if($('save_dbak_x_size_2').value!=""&&($('save_dbak_y_size_2').value!=""||category_code=="CNC8000")){
$j('#btn_add_dbak2').hide();
$j('#pnl_dbak2').show();
ppDBak.setDBakSeq(2);
ppDBak.calcuDBakPrice()
}
if($('save_dbak_x_size_3').value!=""&&($('save_dbak_y_size_3').value!=""||category_code=="CNC8000")){
$j('#btn_add_dbak3').hide();
$j('#pnl_dbak3').show();
ppDBak.setDBakSeq(3);
ppDBak.calcuDBakPrice()
}
this.setPPDBakAmtSum()
}
this.outputDebugMsg("[saveDataLoad]save_print_color_type:"+$('save_print_color_type').value)
}
,changePaper:function(){
this.optionPaperCode();
this.settingPaperSize();
this.optionPaperQty();
this.changePrintPrice();
this.changePPPrice()
}
,changePaperSize:function(){
this.settingPaperSize();
this.changePrintPrice();
this.changePPPrice()
}
,changePaperQty:function(){
this.optionPaperQty();
this.changePrintPrice();
this.changePPPrice()
}
,changeOrderCount:function(){
this.bakApCompare();
this.changePrintPrice();
this.changePPPrice()
}
,changePrintColor:function(){
this.changePrintPrice();
this.changePPPrice()
}
,changePrintPrice:function(){
this.caluPrintPrice();
this.calcuEstimate()
}
,ilarkEstimateSettingProduct:function(category_code){
this.ilarkEstimateSettingPrintHide(category_code);
this.changePaper();
this.changePaperQty();
this.ilarkEstimateSettingPrintHide(category_code)
}
,ppOsi:function(){
ppOsi.calcuOsiPrice();
this.calcuEstimate()
}
,ppMissing:function(){
ppMissing.calcuMissingPrice();
this.calcuEstimate()
}
,ppDomusong:function(){
ppDomusong.dataLoad();
settingExistDomusongMok();
ppDomusong.calcuDomusongPrice();
if(this_category_code=='CVS1000'||this_category_code=='CVS2000'){
this.optionPaperQty()
}
this.caluPrintPrice();
this.calcuEstimate()
}
,ppDomusongExistMok:function(type,num){
type_arry=type.split("^");
type_code=type_arry[0];
type_name=type_arry[1];
this.initSelectOptions('domusong_type');
$('domusong_type').options[0]=new Option(type_name,type_code,true);
this.initSelectOptions('domusong_num');
$('domusong_num').options[0]=new Option(num+"개",num,true);
ppDomusong.calcuDomusongPrice();
this.caluPrintPrice();
this.calcuEstimate()
}
,ppBak:function(seq){
ppBak.dataLoad();
ppBak.setBakSeq(seq);
settingExistBakDongpan(seq);
ppBak.calcuBakPrice();
if($('save_bak_x_size_2').value!=""&&$('save_bak_y_size_2').value!=""){
settingExistBakDongpan(2);
ppBak.calcuBakPrice()
}
if($('save_bak_x_size_3').value!=""&&$('save_bak_y_size_3').value!=""){
settingExistBakDongpan(3);
ppBak.calcuBakPrice()
}
this.setPPBakAmtSum();
this.setPPApAmtSum()
}
,setPPBakAmtSum:function(){
if($('chk_is_bak').checked==true){
$('bak_amt').value=parseInt($('bak_amt_1').value)+parseInt($('bak_amt_2').value)+parseInt($('bak_amt_3').value);
$('bak_dp_amt').value=parseInt($('etc1_1').value)+parseInt($('etc1_2').value)+parseInt($('etc1_3').value)
}
else{
$('bak_amt').value=0;
$('bak_dp_amt').value=0
}
this.changePrintPrice()
}
,ppBakExistDongpan:function(seq){
ppBak.setBakSeq(seq);
ppBak.calcuBakPrice();
this.caluPrintPrice();
this.setPPBakAmtSum();
this.calcuEstimate()
}
,ppDBak:function(seq){
ppDBak.setDBakSeq(seq);
ppDBak.calcuDBakPrice();
this.setPPDBakAmtSum();
this.changePrintPrice();
this.calcuEstimate()
}
,setPPDBakAmtSum:function(){
if($('chk_is_dbak').checked==true){
$('dbak_amt').value=parseInt($('dbak_amt_1').value)+parseInt($('dbak_amt_2').value)+parseInt($('dbak_amt_3').value)
}
else{
$('dbak_amt').value=0
}

}
,ppDBakExistDongpan:function(seq){
ppDBak.setDBakSeq(seq);
ppDBak.calcuDBakPrice();
this.setPPDBakAmtSum();
this.calcuEstimate()
}
,ppAP:function(seq){
ppAP.setAPSeq(seq);
ppAP.settingAPType(seq);
settingExistApDongpan(seq);
ppAP.calcuAPPrice();
if($('save_ap_x_size_2').value!=""&&$('save_ap_y_size_2').value!=""){
settingExistApDongpan(2);
ppAP.calcuAPPrice()
}
if($('save_ap_x_size_3').value!=""&&$('save_ap_y_size_3').value!=""){
settingExistApDongpan(3);
ppAP.calcuAPPrice()
}
this.setPPApAmtSum()
}
,setPPApAmtSum:function(){
if($('chk_is_ap').checked==true){
if(parseInt($('bak_add_unit_price').value)>0&&parseInt($('ap_add_unit_price').value)>0){
$('bak_ap_add_unit_price').value=1000;
$('ap_suji_amt_1').value=1000
}
else{
$('bak_ap_add_unit_price').value=0;
$('ap_suji_amt_1').value=0
}
$('ap_amt').value=parseInt($('ap_amt_1').value)+parseInt($('ap_amt_2').value)+parseInt($('ap_amt_3').value)+parseInt($('bak_ap_add_unit_price').value);
$('ap_dp_amt').value=parseInt($('ap_dongpan_amt_1').value)+parseInt($('ap_dongpan_amt_2').value)+parseInt($('ap_dongpan_amt_3').value)
}
else{
$('ap_amt').value=0;
$('ap_dp_amt').value=0
}
this.changePrintPrice()
}
,ppApExistDongpan:function(seq,name,code){
ppAP.setAPSeq(seq);
this.initSelectOptions('ap_type_'+seq);
$('ap_type_'+seq).options[0]=new Option(name,code,true);
ppAP.settingAPType(seq);
ppAP.calcuAPPrice();
this.setPPApAmtSum();
this.calcuEstimate()
}
,ppNumbering:function(){
ppNumbering.calcuNumberingPrice();
this.calcuEstimate()
}
,ppTagong:function(){
ppTagong.calcuTagongPrice();
this.calcuEstimate()
}
,ppGuidori:function(){
ppGuidori.calcuGuidoriPrice();
this.calcuEstimate()
}
,ppEpoxy:function(){
ppEpoxy.calcuEpoxyPrice();
this.calcuEstimate()
}
,changePPPrice:function(){
if($('chk_is_osi').checked==true){
ppOsi.calcuOsiPrice()
}
if($('chk_is_missing').checked==true){
ppMissing.calcuMissingPrice()
}
if($('chk_is_domusong').checked==true){
ppDomusong.calcuDomusongPrice()
}
if($('chk_is_bak').checked==true){
if($('bak_amt_1').value>0){
ppBak.setBakSeq(1);
ppBak.calcuBakPrice()
}
if($('bak_amt_2').value>0){
ppBak.setBakSeq(2);
ppBak.calcuBakPrice()
}
if($('bak_amt_3').value>0){
ppBak.setBakSeq(3);
ppBak.calcuBakPrice()
}
this.setPPBakAmtSum()
}
if($('chk_is_ap').checked==true){
if($('ap_amt_1').value>0){
ppAP.setAPSeq(1);
ppAP.calcuAPPrice()
}
if($('ap_amt_2').value>0){
ppAP.setAPSeq(2);
ppAP.calcuAPPrice()
}
if($('ap_amt_3').value>0){
ppAP.setAPSeq(3);
ppAP.calcuAPPrice()
}
this.setPPApAmtSum()
}
if($('chk_is_numbering').checked==true){
ppNumbering.calcuNumberingPrice()
}
if($('chk_is_tagong').checked==true){
ppTagong.calcuTagongPrice()
}
if($('chk_is_guidori').checked==true){
ppGuidori.calcuGuidoriPrice()
}
if($('chk_is_epoxy').checked==true){
ppEpoxy.calcuEpoxyPrice()
}
if($('chk_is_dbak').checked==true){
if($('dbak_amt_1').value>0){
ppDBak.setDBakSeq(1);
ppDBak.calcuDBakPrice()
}
if($('dbak_amt_2').value>0){
ppDBak.setDBakSeq(2);
ppDBak.calcuDBakPrice()
}
if($('dbak_amt_3').value>0){
ppDBak.setDBakSeq(3);
ppDBak.calcuDBakPrice()
}
this.setPPDBakAmtSum()
}
this.calcuEstimate()
}
,calcuEstimate:function(){
$('fun_chk').value='false';
var order_count=1;
var total_price=0;
var pp_price=0;
var tax_amt=0;
var order_amt=0;
var pay_amt=0;
var sale_amt=0;
var add_amt=0;
var sale_rate=0;
var agree_date_price=0;
order_count=parseInt($('order_count').value);
sale_rate=parseFloat($('sale_rate').value);
total_price=parseInt($('print_price').value);
if(parseInt($('design_price').value)){
total_price+=parseInt($('design_price').value)
}
if($('osi_amt').value>0&&$('chk_is_osi').checked)pp_price+=parseInt($('osi_amt').value);
if($('missing_amt').value>0&&$('chk_is_missing').checked)pp_price+=parseInt($('missing_amt').value);
if($('domusong_amt').value>0&&$('chk_is_domusong').checked)pp_price+=parseInt($('domusong_amt').value);
if($('bak_amt').value>0&&$('chk_is_bak').checked)pp_price+=parseInt($('bak_amt').value);
if($('ap_amt').value>0&&$('chk_is_ap').checked)pp_price+=parseInt($('ap_amt').value);
if($('numbering_amt').value>0&&$('chk_is_numbering').checked)pp_price+=parseInt($('numbering_amt').value);
if($('tagong_amt').value>0&&$('chk_is_tagong').checked)pp_price+=parseInt($('tagong_amt').value);
if($('guidori_amt').value>0&&$('chk_is_guidori').checked)pp_price+=parseInt($('guidori_amt').value);
if($('epoxy_amt').value>0&&$('chk_is_epoxy').checked)pp_price+=parseInt($('epoxy_amt').value);
if($('dbak_amt').value>0&&$('chk_is_dbak').checked)pp_price+=parseInt($('dbak_amt').value);
if($('agree_date_price').value>0)agree_date_price=parseInt($('agree_date_price').value);
total_price=parseInt(total_price)+parseInt(pp_price)+parseInt(agree_date_price);
origin_price=parseInt(total_price)+parseInt(pp_price)+parseInt(agree_date_price);
if(sale_rate>0){
sale_amt=total_price*(sale_rate/100);
total_price=total_price-parseInt(sale_amt)
}
supply_amt=total_price;
if(tax_type=="TXT20"){
tax_amt=0
}
else{
tax_amt=Math.round(total_price*0.1)
}
order_amt=parseInt(supply_amt);
pay_amt=parseInt(supply_amt)+parseInt(tax_amt);
$('total_price').value=total_price;
$('supply_amt').value=supply_amt;
$('tax_amt').value=tax_amt;
$('order_amt').value=order_amt;
$('pay_amt').value=pay_amt;
$('postpress_amt').value=pp_price;
$('sale_amt').value=sale_amt;
$('add_amt').value=add_amt;
$('lbl_pay_amt').update(numberFormat(pay_amt));
$('lbl_supply_amt').update(numberFormat(supply_amt));
$('lbl_tax_amt').update(numberFormat(tax_amt));
if(sale_rate>0){
sale_info="정상가 : <strike>"+numberFormat(origin_price)+"</strike>원,"+" 할인액(할인율) : "+numberFormat(sale_amt)+"원("+sale_rate+"%)";
$('pnl_sale_amt').update(sale_info)
}
this.printEstimate();
if($("print_estimate_list")){
this.printEstimatePrint();
this.printEstimateTotPrint();
this.printEstimateLeftPrint()
}

}
,printEstimate:function(){
var print_price_html="<tr id='estimate_print'><td class='item'>인쇄비 :</td><td class='price'>\\"+numberFormat($('print_price').value)+"</td></tr>";
var design_price_html="<tr id='estimate_design'><td class='item'>디자인비 :</td><td class='price'>\\"+numberFormat($('design_price').value)+"</td></tr>";
var bak_amt=parseInt($('bak_amt').value);
var bak_dp_amt=parseInt($('bak_dp_amt').value);
bak_amt=bak_amt-bak_dp_amt;
var ap_amt=parseInt($('ap_amt').value);
var ap_dp_amt=parseInt($('ap_dp_amt').value);
ap_amt=ap_amt-ap_dp_amt;
var dbak_amt=parseInt($('dbak_amt').value);
var domusong_amt=parseInt($('domusong_amt').value);
var make_price=$('total_price').value;
var make_price_html="<tr id='estimate_make'><td class='item'>제작비 :</td><td class='price'>\\"+numberFormat(make_price)+"</td></tr>";
var osi_price_html="<tr id='estimate_osi'><td class='item'>오시비 :</td><td class='price'>\\"+numberFormat($('osi_amt').value)+"</td></tr>";
var missing_price_html="<tr id='estimate_missing'><td class='item'>미싱비 :</td><td class='price'>\\"+numberFormat($('missing_amt').value)+"</td></tr>";
var domusong_price_html="<tr id='estimate_domusong'><td class='item'>도무송 :</td><td class='price'>\\"+numberFormat(domusong_amt)+"</td></tr>";
var bak_price_html="<tr id='estimate_bak'><td class='item'>박&nbsp;
&nbsp;
&nbsp;
비 :</td><td class='price'>\\"+numberFormat(bak_amt)+"</td></tr>";
var bak_dp_price_html="<tr id='estimate_bak_dp'><td class='item'>박동판 :</td><td class='price'>\\"+numberFormat(bak_dp_amt)+"</td></tr>";
var ap_price_html="<tr id='estimate_ap'><td class='item'>형압비 :</td><td class='price'>\\"+numberFormat(ap_amt)+"</td></tr>";
var ap_dp_price_html="<tr id='estimate_ap_dp'><td class='item'>형압동판:</td><td class='price'>\\"+numberFormat(ap_dp_amt)+"</td></tr>";
var numbering_price_html="<tr id='estimate_numbering'><td class='item'>넘버링 :</td><td class='price'>\\"+numberFormat($('numbering_amt').value)+"</td></tr>";
var tagong_price_html="<tr id='estimate_tagong'><td class='item'>타&nbsp;
&nbsp;
&nbsp;
공 :</td><td class='price'>\\"+numberFormat($('tagong_amt').value)+"</td></tr>";
var guidori_price_html="<tr id='estimate_guidori'><td class='item'>귀도리 :</td><td class='price'>\\"+numberFormat($('guidori_amt').value)+"</td></tr>";
var epoxy_price_html="<tr id='estimate_epoxy'><td class='item'>에폭시 :</td><td class='price'>\\"+numberFormat($('epoxy_amt').value)+"</td></tr>";
var dbak_price_html="<tr id='estimate_dbak'><td class='item'>디지털박비 :</td><td class='price'>\\"+numberFormat(dbak_amt)+"</td></tr>";
if(document.getElementsByName('is_today')[1].checked==true){
var agree_price_html="<tr id='estimate_print'><td class='item'>당일판 :</td><td class='price'>\\"+numberFormat($('agree_date_price').value)+"</td></tr>"
}
if(document.getElementsByName('is_sat')[1].checked==true){
var agree_price_html="<tr id='estimate_print'><td class='item'>토요판 :</td><td class='price'>\\"+numberFormat($('agree_date_price').value)+"</td></tr>"
}
if($('total_price').value>0){
this.printHtmlMsg('make','0',make_price_html)
}
order_count_html="<tr class='estimate_order_count'><td class='item'>주문건 :</td><td class='price'>"+numberFormat($('order_count').value)+"건</td></tr>";
$('tbl_estimate').insert(order_count_html);
total_supply_amt_html="<tr class='estimate_supply_amt'><td class='item'>합&nbsp;
&nbsp;
&nbsp;
계 :</td><td class='price'>\\"+numberFormat($('supply_amt').value)+"</td></tr>";
$('tbl_estimate').insert(total_supply_amt_html);
total_tax_amt_html="<tr class='estimate_tax_amt'><td class='item'>부가세 :</td><td class='price'>\\"+numberFormat($('tax_amt').value)+"</td></tr>";
$('tbl_estimate').insert(total_tax_amt_html);
total_pay_price_html="<tr class='estimate_pay_price'><td class='item'>결제액 :</td><td class='price'>\\"+numberFormat($('pay_amt').value)+"</td></tr>";
$('tbl_estimate').insert(total_pay_price_html);
$('fun_chk').value='true'
}
,settingDB:function(){
this_category_code=$('category_code').value;
this_paper_code=$('paper_code').value;
if(((this_category_code=='CNC1000'||this_category_code=='CVS1000'||this_category_code=='CET1000')&&this_paper_code=='SNW250W00')||((this_category_code=='CNC6000')&&this_paper_code=='SNW300W00')){
if(document.getElementsByName('paper_gloss2')[0].checked==true){
$('etc1').value='PAG10'
}
else{
$('etc1').value='PAG99'
}

}

}
,printHtmlMsg:function(el,is_pp,html){
if(is_pp=="1"){
if(el=='bak_dp'||el=='ap_dp'||el=='moghyeong'){
if($(el+"_amt").value>0){
is_enabled=true
}
else{
is_enabled=false
}

}
else{
if($("chk_is_"+el).checked&&$(el+"_amt").value>0){
is_enabled=true
}
else{
is_enabled=false
}

}

}
else{
is_enabled=true
}
if(is_enabled){
if($("estimate_"+el)!=null){
$('tbl_estimate').update(html)
}
else{
$('tbl_estimate').insert(html)
}

}

}
,printEstimatePrint:function(){
var make_price=parseInt($('total_price').value);
table_title_html="<tr id='print_estimate_title' class='tabletitle'><td height='26' class='gray' colspan='2'>인쇄세부항목</td></tr>";
this.printHtmlMsgPrint('title','0',table_title_html);
var make_price_html="<tr id='print_estimate_make' align='center'><td height='26'>제작비</td><td class='tr rightmargin10'>\\"+numberFormat(make_price)+"</td></tr>";
var print_price_html="<tr id='print_estimate_print' align='center'><td height='26' width='40%'>인쇄비</td><td class='tr rightmargin10' width='60%'>\\"+numberFormat($('print_price').value)+"</td></tr>";
var design_price_html="<tr id='print_estimate_design' align='center'><td height='26' width='40%'>디자인비</td><td class='tr rightmargin10' width='60%'>\\"+numberFormat($('design_price').value)+"</td></tr>";
var osi_price_html="<tr id='print_estimate_osi' align='center'><td height='26'>오시비</td><td class='tr rightmargin10'>\\"+numberFormat($('osi_amt').value)+"</td></tr>";
var missing_price_html="<tr id='print_estimate_missing' align='center'><td height='26'>미싱비</td><td class='tr rightmargin10'>\\"+numberFormat($('missing_amt').value)+"</td></tr>";
var domusong_price_html="<tr id='print_estimate_domusong' align='center'><td height='26'>도무송</td><td class='tr rightmargin10'>\\"+numberFormat($('domusong_amt').value)+"</td></tr>";
var bak_price_html="<tr id='print_estimate_bak' align='center'><td height='26'>박&nbsp;
&nbsp;
&nbsp;
비</td><td class='tr rightmargin10'>\\"+numberFormat($('bak_amt').value)+"</td></tr>";
var ap_price_html="<tr id='print_estimate_ap' align='center'><td height='26'>형압비</td><td class='tr rightmargin10'>\\"+numberFormat($('ap_amt').value)+"</td></tr>";
var numbering_price_html="<tr id='print_estimate_numbering' align='center'><td height='26'>넘버링</td><td class='tr rightmargin10'>\\"+numberFormat($('numbering_amt').value)+"</td></tr>";
var tagong_price_html="<tr id='print_estimate_tagong' align='center'><td height='26'>타&nbsp;
&nbsp;
&nbsp;
공</td><td class='tr rightmargin10'>\\"+numberFormat($('tagong_amt').value)+"</td></tr>";
var guidori_price_html="<tr id='print_estimate_guidori' align='center'><td height='26'>귀도리</td><td class='tr rightmargin10'>\\"+numberFormat($('guidori_amt').value)+"</td></tr>";
var epoxy_price_html="<tr id='print_estimate_epoxy' align='center'><td height='26'>에폭시</td><td class='tr rightmargin10'>\\"+numberFormat($('epoxy_amt').value)+"</td></tr>";
var dbak_price_html="<tr id='print_estimate_dbak' align='center'><td height='26'>디지털박비</td><td class='tr rightmargin10'>\\"+numberFormat($('dbak_amt').value)+"</td></tr>";
if(make_price>0){
this.printHtmlMsgPrint('make','0',make_price_html)
}
order_count_html="<tr align='center'><td height='26' bgcolor='#fafafa'>주문건</td><td class='tr rightmargin10' bgcolor='#fafafa'>"+numberFormat($('order_count').value)+"건</td></tr>";
$('print_estimate_list').insert(order_count_html);
total_supply_amt_html="<tr align='center'><td height='26' bgcolor='#fafafa'>합&nbsp;
&nbsp;
&nbsp;
계</td><td class='tr rightmargin10' bgcolor='#fafafa' id='print_supply'>\\"+numberFormat($('supply_amt').value)+"</td></tr>";
$('print_estimate_list').insert(total_supply_amt_html);
total_tax_amt_html="<tr align='center'><td height='26' bgcolor='#fafafa'>부가세</td><td class='tr rightmargin10' bgcolor='#fafafa' id='print_tax'>\\"+numberFormat($('tax_amt').value)+"</td></tr>";
$('print_estimate_list').insert(total_tax_amt_html);
estimatePostpressContent()
}
,printHtmlMsgPrint:function(el,is_pp,html){
if(is_pp=="1"){
if($("chk_is_"+el).checked&&$(el+"_amt").value>0){
is_enabled=true
}
else{
is_enabled=false
}

}
else{
is_enabled=true
}
if(is_enabled){
if($("print_estimate_"+el)!=null){
$('print_estimate_list').update(html)
}
else{
$('print_estimate_list').insert(html)
}

}

}
,printEstimateTotPrint:function(){
table_title_html="<tr id='print_estimate_title'><td height='26' colspan='6' bgcolor='#f2f2f2' style='padding:0 10px;
'><table width='100%' border='0' cellspacing='0' cellpadding='0'><tr><td >합계금액 \\"+numberFormat($('supply_amt').value)+"원 + 부가세 \\"+numberFormat($('tax_amt').value)+"원 + 배송비 별도</td><td class='tr fwb gray'>총 합계금액 : \\"+numberFormat($('pay_amt').value)+"원</td></tr></table></td></tr>";
this.printHtmlMsgTotPrint('title','0',table_title_html)
}
,printHtmlMsgTotPrint:function(el,is_pp,html){
if(is_pp=="1"){
if($("chk_is_"+el).checked&&$(el+"_amt").value>0){
is_enabled=true
}
else{
is_enabled=false
}

}
else{
is_enabled=true
}
if(is_enabled){
if($("print_estimate_"+el)!=null){
$('print_estimate_tot').update(html)
}
else{
$('print_estimate_tot').insert(html)
}

}

}
,printEstimateLeftPrint:function(){
table_title_html="<tr id='print_estimate_title' class='tabletitle'><td height='26' colspan='2' class='gray'>재질 및 규격</td></tr>";
this.printHtmlMsgLeftPrint('title','0',table_title_html);
var paper_name=$('paper_name').value;
if(category_code=='CNC2000'||category_code=='CVS2000'){
paper_name=$('paper_name').value.replace("아르떼 울트라화이트 230g","아르미 울트라화이트 230g")
}
var left_01_html="<tr id='print_01' align='center'><td height='26' width='40%'>품명</td><td width='60%'>"+$('category_name').value+"</td></tr>";
var left_02_html="<tr id='print_02' align='center'><td height='26'>재질</td><td>"+paper_name+"</td></tr>";
var left_03_html="<tr id='print_03' align='center'><td height='26'>규격</td><td>"+$('cut_x_size').value+"*"+$('cut_y_size').value+"</td></tr>";
var left_04_html="<tr id='print_04' align='center'><td height='26'>수량</td><td>"+$('paper_qty').value+" 매 * "+$('order_count').value+" 건</td></tr>";
if($('print_color_type').value=='CTN10'){
var left_05_html="<tr id='print_05' align='center'><td height='26'>인쇄도수</td><td>단면칼라</td></tr>"
}
else if($('print_color_type').value=='CTN40'){
var left_05_html="<tr id='print_05' align='center'><td height='26'>인쇄도수</td><td>양면칼라</td></tr>"
}
else if($('print_color_type').value=='CTN11'){
var left_05_html="<tr id='print_05' align='center'><td height='26'>인쇄도수</td><td>단면칼라+금별색</td></tr>"
}
else if($('print_color_type').value=='CTN41'){
var left_05_html="<tr id='print_05' align='center'><td height='26'>인쇄도수</td><td>양면칼라+금별색</td></tr>"
}
else if($('print_color_type').value=='CTN12'){
var left_05_html="<tr id='print_05' align='center'><td height='26'>인쇄도수</td><td>단면칼라+은별색</td></tr>"
}
else if($('print_color_type').value=='CTN42'){
var left_05_html="<tr id='print_05' align='center'><td height='26'>인쇄도수</td><td>양면칼라+은별색</td></tr>"
}
else if($('print_color_type').value=='CTN13'){
var left_05_html="<tr id='print_05' align='center'><td height='26'>인쇄도수</td><td>단면칼라+금별색+은별색</td></tr>"
}
else if($('print_color_type').value=='CTN43'){
var left_05_html="<tr id='print_05' align='center'><td height='26'>인쇄도수</td><td>양면칼라+금별색+은별색</td></tr>"
}
this.printHtmlMsgLeftPrint('left_01','0',left_01_html);
this.printHtmlMsgLeftPrint('left_02','0',left_02_html);
this.printHtmlMsgLeftPrint('left_03','0',left_03_html);
this.printHtmlMsgLeftPrint('left_04','0',left_04_html);
this.printHtmlMsgLeftPrint('left_05','0',left_05_html)
}
,printHtmlMsgLeftPrint:function(el,is_pp,html){
if(is_pp=="1"){
if($("chk_is_"+el).checked&&$(el+"_amt").value>0){
is_enabled=true
}
else{
is_enabled=false
}

}
else{
is_enabled=true
}
if(is_enabled){
if($("print_estimate_"+el)!=null){
$('print_estimate_list01').update(html)
}
else{
$('print_estimate_list01').insert(html)
}

}

}

}
);
