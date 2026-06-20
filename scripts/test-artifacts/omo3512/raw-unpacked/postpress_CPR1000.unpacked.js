var Postpress=Class.create(Print,{
initialize:function($super){
$super()
}

}
);
var ppOsi=Class.create(Postpress,{
initialize:function($super){
$super();
this.unit_price=0;
this.mock_price=0;
this.BASIC_ADD_PRICE=5000;
this.IS_OSI_PAPER_WEIGHT=160;
this.save_osi_num=$("save_osi_num").value
}
,dataLoad:function(){
new Ajax.Request('/estimate/estimate_goods/pp_osi_json_data',{
asynchronous:false,method:"post",parameters:{
"t":timestamp,"product":"name"
}
,onSuccess:function(jsonData){
ppOsiJsonOBJ=jsonData.responseText.evalJSON(true)
}
,onFailure:function(){
alert('Loading Failed for Osi Json Data')
}

}
)
}
,getOsiNum:function(){
if($('osi_num').value==""){
return this.save_osi_num
}
else{
return $('osi_num').value
}

}
,setOsiPrice:function(price){
$('osi_amt').value=price
}
,getOsiPrice:function(){
return $('osi_amt').value
}
,getIsPPOsi:function(){
if($('chk_is_osi').checked==true){
return true
}
else{
return false
}

}
,settingOsiNum:function(){
var paper_weight=this.getPaperWeight('cover_');
var paper_size=this.getPaperSize();
var this_osi_num=this.getOsiNum();
var binding_type=this.getBindingType();
this.initSelectOptions('osi_num');
var thisValSeq=0;
if(paper_weight>=this.IS_OSI_PAPER_WEIGHT){
for(i=0;
i<1;
i++){
if(this_osi_num==(i+1)){
thisValSeq=i
}
$('osi_num').options[i]=new Option(i+1+"줄",i+1,false)
}
if(paper_size=="A0100"||paper_size=="A0200"||paper_size=="B0300"||paper_size=="B0200"){
for(i=4;
i<8;
i++){
if(this_osi_num==(i+1)){
thisValSeq=i
}
$('osi_num').options[i]=new Option(i+1+"줄",i+1,false)
}

}
if(binding_type.match('BDT3')||binding_type.match('BDT6')){
$('osi_num').options[0]=new Option("2줄",2,false)
}
$('osi_num').options[thisValSeq].selected=true;
$('osi_num2').value=$('osi_num').value;
this.checkMsg("osi","","")
}
else{
$('osi_num').options[0]=new Option("없음","0",false);
this.setOsiPrice(0);
this.checkMsg("osi","오시는 용지평량이 150g부터 가능합니다.","cover_paper_code")
}

}
,calcuOsiPrice:function(){
if(this.getIsPPOsi()){
this.settingOsiNum()
}
var osi_price=0;
var osi_num=parseInt(this.getOsiNum());
var binding_type=$('binding_type').value;
if(this.getIsPPOsi()&&osi_num>0&&(binding_type=='BDT2'||binding_type=='BDT3'||binding_type=='BDT6')){
bundle_qty=this.getBundleQty();
qty_unit_rate=parseFloat(Math.max(1-(bundle_qty/100000),0.7));
osi_price=Math.max(15*bundle_qty+10000,20000)*qty_unit_rate;
osi_price=Math.ceil(osi_price/1000)*1000;
this.setOsiPrice(osi_price);
$('chk_is_osi').checked=true
}
else{
this.setOsiPrice(0);
$('chk_is_osi').checked=false
}

}
,getOsiPriceUnit:function(){
osi_num=this.getOsiNum();
paper_size=this.getPaperSize();
paper_weight=this.getPaperWeight('cover_');
if(paper_weight>=260){
osi_extra_rate=1.2
}
else{
osi_extra_rate=1
}
if(osi_num>0){
var pp_osi_info=jsonPath(ppOsiJsonOBJ,"$.pp_osi_info[?(@.num=='"+osi_num+"')][?(@.paper_size=='"+paper_size+"')]");
this.unit_price=parseInt(pp_osi_info[0].unit_price)*parseFloat(osi_extra_rate);
this.mock_price=parseInt(pp_osi_info[0].mock_price)
}

}

}
);
var ppCoating=Class.create(Postpress,{
initialize:function($super){
$super();
this.unit_price=0;
this.min_price=0;
this.IS_COATING_PAPER_WEIGHT=150
}
,dataLoad:function(){
new Ajax.Request('/estimate/estimate_goods/pp_coating_json_data',{
asynchronous:false,method:"post",parameters:{
"t":timestamp,"product":"name"
}
,onSuccess:function(jsonData){
ppCoatingJsonOBJ=jsonData.responseText.evalJSON(true)
}
,onFailure:function(){
alert('Loading Failed for Coating Json Data')
}

}
)
}
,getCoatingType:function(){
if($('chk_is_coating').checked==true){
if($('coating_type').value==""){
$save_coating_type=$('save_coating_type').value;
$('save_coating_type').value="";
return $save_coating_type
}
else{
return $('coating_type').value
}

}
else{
return''
}

}
,setCoatingPrice:function(price){
$('coating_amt').value=price;
$('cover_coating_amt').value=price
}
,getCoatingPrice:function(){
return $('coating_amt').value
}
,getIsPPCoating:function(){
if($('chk_is_coating').checked==true){
return true
}
else{
return false
}

}
,settingCoatingType:function(){
var paper_weight=this.getPaperWeight('cover_');
this_coating_type=this.getCoatingType();
this.initSelectOptions('coating_type');
if(paper_weight>=this.IS_COATING_PAPER_WEIGHT){
var binding_type=this.getBindingType();
$('coating_type').options[0]=new Option("단면유광써멀코팅","COT10",false);
$('coating_type').options[1]=new Option("단면무광써멀코팅","COT20",false);
$('coating_type').options[2]=new Option("단면uv코팅","COT30",false);
if(binding_type!='BDT3'&&binding_type!='BDT6'){
$('coating_type').options[3]=new Option("양면유광써멀코팅","COT40",false);
$('coating_type').options[4]=new Option("양면무광써멀코팅","COT50",false);
if(paper_weight>this.IS_COATING_PAPER_WEIGHT){
$('coating_type').options[5]=new Option("양면uv코팅","COT60",false)
}

}
this.thisPositionSelectOptions("coating_type",this_coating_type);
this.checkMsg("coating","","")
}
else{
$('coating_type').options[0]=new Option("코팅없음","",false);
this.setCoatingPrice(0);
this.checkMsg("coating","코팅이 가능한 평량은 150g 이상이어야 합니다.","cover_paper_code")
}

}
,calcuCoatingPrice:function(){
if(this.getIsPPCoating()){
this.settingCoatingType()
}
coating_type=this.getCoatingType();
if(this.getIsPPCoating()&&coating_type!=""){
paper_yeon_qty=parseFloat($('coating_cover_page_yeon_qty').value);
paper_yeon_qty=Math.max(paper_yeon_qty,0.9);
this.getCoatingPriceUnit();
coating_price=this.unit_price*paper_yeon_qty;
coating_price=Math.ceil(coating_price/100)*100;
this.setCoatingPrice(coating_price)
}
else{
this.setCoatingPrice(0)
}

}
,getCoatingPriceUnit:function(){
var coating_type=this.getCoatingType();
var cover_add_in_tmp=this.getCoverAddInTmp();
var pp_coating_info=jsonPath(ppCoatingJsonOBJ,"$.pp_coating_info[?(@.code=='"+coating_type+"')]");
if(cover_add_in_tmp=='0'){
var size_type_section_code=this.getSizeTypeSectionCode();
if(size_type_section_code=="PTK10"){
this.unit_price=parseInt(pp_coating_info[0].unit_price1)
}
else{
this.unit_price=parseInt(pp_coating_info[0].unit_price2)
}

}
else{
var cover_paper_margin_qty=this.getMarginQty('cover_');
if(cover_paper_margin_qty==0.4){
this.unit_price=parseInt(pp_coating_info[0].unit_price1)
}
else{
this.unit_price=parseInt(pp_coating_info[0].unit_price2)
}

}

}

}
);
var ppCoatingIn=Class.create(Postpress,{
initialize:function($super){
$super();
this.unit_price=0;
this.min_price=0;
this.IS_COATING_PAPER_WEIGHT=150
}
,dataLoad:function(){
new Ajax.Request('/estimate/estimate_goods/pp_coating_json_data',{
asynchronous:false,method:"post",parameters:{
"t":timestamp,"product":"name"
}
,onSuccess:function(jsonData){
ppCoatingJsonOBJ=jsonData.responseText.evalJSON(true)
}
,onFailure:function(){
alert('Loading Failed for Coating Json Data')
}

}
)
}
,getCoatingType:function(){
if($('chk_is_coating').checked==true){
if($('in_coating_type').value==""){
$save_coating_type=$('save_in_coating_type').value;
$('save_in_coating_type').value="";
return $save_coating_type
}
else{
return $('in_coating_type').value
}

}
else{
return''
}

}
,setCoatingPrice:function(price){
$('coating_amt').value=parseInt($('cover_coating_amt').value)+price;
$('in_coating_amt').value=price
}
,getCoatingPrice:function(){
return $('in_coating_amt').value
}
,getIsPPCoating:function(){
if($('chk_is_coating').checked==true){
return true
}
else{
return false
}

}
,settingCoatingType:function(){
var paper_weight=this.getPaperWeight('in_');
this_coating_type=this.getCoatingType();
this.initSelectOptions('in_coating_type');
if(paper_weight>=this.IS_COATING_PAPER_WEIGHT){
var binding_type=this.getBindingType();
$('in_coating_type').options[0]=new Option("코팅없음","",false);
if(binding_type!='BDT3'&&binding_type!='BDT6'){
$('in_coating_type').options[1]=new Option("양면유광써멀코팅","COT40",false);
$('in_coating_type').options[2]=new Option("양면무광써멀코팅","COT50",false);
if(paper_weight>this.IS_COATING_PAPER_WEIGHT){
$('in_coating_type').options[3]=new Option("양면uv코팅","COT60",false)
}

}
this.thisPositionSelectOptions("in_coating_type",this_coating_type);
this.checkMsg("coating","","")
}
else{
$('in_coating_type').options[0]=new Option("코팅없음","",false);
this.setCoatingPrice(0);
this.checkMsg("coating","코팅이 가능한 평량은 150g 이상이어야 합니다.","in_paper_code")
}

}
,calcuCoatingPrice:function(){
if(this.getIsPPCoating()){
this.settingCoatingType()
}
coating_type=this.getCoatingType();
if(this.getIsPPCoating()&&coating_type!=""){
paper_yeon_qty=this.getPaperYeonQty('in_');
paper_yeon_qty=Math.max(paper_yeon_qty,0.75);
this.getCoatingPriceUnit();
coating_price=this.unit_price*paper_yeon_qty;
coating_price=Math.ceil(coating_price/100)*100;
this.setCoatingPrice(coating_price)
}
else{
this.setCoatingPrice(0)
}

}
,getCoatingPriceUnit:function(){
var coating_type=this.getCoatingType();
var cover_add_in_tmp=this.getCoverAddInTmp();
var pp_coating_info=jsonPath(ppCoatingJsonOBJ,"$.pp_coating_info[?(@.code=='"+coating_type+"')]");
var size_type_section_code=this.getSizeTypeSectionCode();
if(size_type_section_code=="PTK10"){
this.unit_price=parseInt(pp_coating_info[0].unit_price1)
}
else{
this.unit_price=parseInt(pp_coating_info[0].unit_price2)
}

}

}
);
var ppPartialCoating=Class.create(Postpress,{
initialize:function($super){
$super();
this.unit_price=0;
this.min_price=0;
this.IS_COATING_PAPER_WEIGHT=150
}
,dataLoad:function(){
new Ajax.Request('/estimate/estimate_goods/pp_coating_json_data',{
asynchronous:false,method:"post",parameters:{
"t":timestamp,"product":"name"
}
,onSuccess:function(jsonData){
ppCoatingJsonOBJ=jsonData.responseText.evalJSON(true)
}
,onFailure:function(){
alert('Loading Failed for Coating Json Data')
}

}
)
}
,setPartialCoatingPrice:function(price){
$('partial_coating_amt').value=price
}
,getPartialCoatingPrice:function(){
return $('partial_coating_amt').value
}
,getIsPPPartialCoating:function(){
if($('chk_is_partial_coating').checked==true){
return true
}
else{
return false
}

}
,getPartialCoatingXSize:function(){
return $('partial_coating_x_size').value
}
,getPartialCoatingYSize:function(){
return $('partial_coating_y_size').value
}
,getCutNum:function(){
return $('cut_num').value
}
,getCoverCutNum:function(){
return $('cover_cut_num').value
}
,calcuPartialCoatingPrice:function(){
var partial_coating_x_size=this.getPartialCoatingXSize();
var partial_coating_y_size=this.getPartialCoatingYSize();
if(this.getIsPPPartialCoating()&&partial_coating_x_size>0&&partial_coating_y_size>0){
var cut_num=parseInt(this.getCutNum());
var cover_cut_num=parseInt(this.getCoverCutNum());
var bundle_qty=this.getBundleQty();
var cover_page_set=$('cover_page_set').value;
if(cover_page_set=='1'){
var chk_cut_num=cut_num
}
else{
var chk_cut_num=cover_cut_num
}
var last_bundle_qty=Math.max(bundle_qty,1000);
var partial_coating_D116=Math.max(1-(bundle_qty/40000),0.6);
 var coating_price=0;
if(chk_cut_num<=4){
coating_price=70*last_bundle_qty
}
else if(chk_cut_num<=15){
coating_price=50*last_bundle_qty
}
else{
coating_price=60*last_bundle_qty
}
if($('chk_is_coating').checked==false){
cover_coating_chk=2
}
else{
cover_coating_chk=1
}
last_coating_price=coating_price*partial_coating_D116;
last_coating_price=Math.ceil(last_coating_price/10000)*10000;
last_coating_price=last_coating_price*cover_coating_chk+40000;
var set_val=Math.max(chk_cut_num,8);
var sugi_price=Math.ceil(set_val/8)*(parseInt(partial_coating_x_size)+30)*(parseInt(partial_coating_y_size)+30)*100/100;
var last_sugi_price=Math.max(sugi_price,30000);
var partial_coating_price=Math.ceil((last_coating_price+last_sugi_price)/1000)*1000;
this.setPartialCoatingPrice(partial_coating_price)
}
else{
this.setPartialCoatingPrice(0)
}

}

}
);
var ppDomusong=Class.create(Postpress,{
initialize:function($super){
$super();
this.DOMUSONG_SET_MIN_PRICE=30000;
this.DOMUSONG_UNIT_MIN_PRICE=40000
}
,dataLoad:function(){
new Ajax.Request('/estimate/estimate_goods/pp_domusong_json_data',{
asynchronous:false,method:"post",parameters:{
"t":timestamp,"product":"name"
}
,onSuccess:function(jsonData){
ppDomusongJsonOBJ=jsonData.responseText.evalJSON(true)
}
,onFailure:function(){
alert('Loading Failed for Domusong Json Data')
}

}
)
}
,getDomusongSection:function(){
return $('domusong_section').value
}
,setDomusongPrice:function(price){
$('domusong_amt').value=price
}
,getDomusongPrice:function(){
return $('domusong_amt').value
}
,getIsPPDomusong:function(){
var cover_holder_status=this.getCoverHolderStatus();
var page_set_num=this.getCoverPageSet();
if(cover_holder_status==''){
return false
}
else{
return true
}

}
,setCkhDomusong:function(value){
$('chk_is_domusong').value=value
}
,calcuDomusongPrice:function(){
if(this.getIsPPDomusong()){
this.setCkhDomusong('1');
var domusong_mock_price=this.getDomusongMokPrice();
var domusong_unit_price=this.getDomusongUnitPrice();
domusong_unit_price=Math.max(domusong_unit_price,this.DOMUSONG_UNIT_MIN_PRICE);
var bundle_qty=this.getBundleQty();
var domusong_set_price=(bundle_qty*30)+10000;
domusong_set_price=Math.max(domusong_set_price,this.DOMUSONG_SET_MIN_PRICE);
domusong_price=domusong_set_price+domusong_unit_price+domusong_mock_price;
this.setDomusongPrice(domusong_price)
}
else{
this.setCkhDomusong('');
this.setDomusongPrice(0)
}

}
,getDomusongUnitPrice:function(){
var bundle_qty=this.getBundleQty();
var cover_add_in_tmp=this.getCoverAddInTmp();
var last_cut_num=this.getCutNum();
if(cover_add_in_tmp=='1'){
last_cut_num=this.getCoverCutNum()
}
var set_unit=0;
if(last_cut_num=='2'){
set_unit=30
}
else if(last_cut_num=='4'){
set_unit=18
}
else if(last_cut_num=='8'){
set_unit=13
}
else if(last_cut_num=='16'){
set_unit=10
}
var unit_price=set_unit*bundle_qty+20000;
return unit_price
}
,getDomusongMokPrice:function(){
var cover_add_in_tmp=this.getCoverAddInTmp();
var last_cut_num=this.getCutNum();
if(cover_add_in_tmp=='1'){
last_cut_num=this.getCoverCutNum()
}
var mok_price=0;
if(last_cut_num=='2'){
mok_price=80000
}
else if(last_cut_num=='4'){
mok_price=80000
}
else if(last_cut_num=='8'){
mok_price=60000
}
else if(last_cut_num=='16'){
mok_price=60000
}
return mok_price
}

}
);
var ppBak=Class.create(Postpress,{
initialize:function($super,seq){
$super();
this.seq=0;
this.material_price=0;
this.chk_x_size=0;
this.chk_y_size=0;
this.min_price=0
}
,dataLoad:function(){
new Ajax.Request('/estimate/estimate_goods/pp_bak_json_data',{
asynchronous:false,method:"post",parameters:{
"t":timestamp,"category_code":"CPR1000"
}
,onSuccess:function(jsonData){
ppBakJsonOBJ=jsonData.responseText.evalJSON(true)
}
,onFailure:function(){
alert('Loading Failed for bak Json Data')
}

}
)
}
,setBakSeq:function(seq){
this.seq=seq
}
,getBakSection:function(){
return $('bak_section_'+this.seq).value
}
,getBakSide:function(){
return $('bak_side_'+this.seq).value
}
,getBakSide:function(){
if($('bak_side_'+this.seq).value==""){
return $('save_bak_side_'+this.seq).value
}
else{
return $('bak_side_'+this.seq).value
}

}
,getBakType:function(){
if($('bak_type_'+this.seq).value==""){
return $('save_bak_type_'+this.seq).value
}
else{
return $('bak_type_'+this.seq).value
}

}
,getBakXSize:function(){
return $('bak_x_size_'+this.seq).value
}
,getBakYSize:function(){
return $('bak_y_size_'+this.seq).value
}
,setBakPrice:function(price){
$('bak_amt_'+this.seq).value=price
}
,getBakPrice:function(){
return $('bak_amt_'+this.seq).value
}
,setBakDongpanPrice:function(price){
$('etc1_'+this.seq).value=price
}
,getBakDongpanPrice:function(){
return $('etc1_'+this.seq).value
}
,getIsPPBak:function(){
if($('chk_is_bak').checked==true){
return true
}
else{
return false
}

}
,settingBakSide:function(){
var this_bak_side=this.getBakSide();
this.initSelectOptions('bak_side_'+this.seq);
$('bak_side_'+this.seq).options[0]=new Option('전면','BKD10',false);
$('bak_side_'+this.seq).options[1]=new Option('후면','BKD20',false);
this.thisPositionSelectOptions("bak_side_"+this.seq,this_bak_side)
}
,settingBakType:function(){
var this_bak_type=this.getBakType();
this.initSelectOptions('bak_type_'+this.seq);
var pp_bak_info=jsonPath(ppBakJsonOBJ,"$.pp_bak_info[?(@.type=='film_unit')][?(@.section=='UNIT5')]");
for(var i=0;
i<pp_bak_info.length;
i++){
material_name=pp_bak_info[i].material_name;
bak_type=pp_bak_info[i].bak_type;
$('bak_type_'+this.seq).options[i]=new Option(material_name,bak_type,false)
}
this.thisPositionSelectOptions("bak_type_"+this.seq,this_bak_type)
}
,calcuBakPrice:function(){
if(this.getIsPPBak()){
this.settingBakSide();
this.settingBakType()
}
bak_section=this.getBakSection();
bak_side=this.getBakSide();
bak_x_size=this.getBakXSize();
bak_y_size=this.getBakYSize();
if(this.getIsPPBak()&&bak_section!=""&&bak_x_size>0&&bak_y_size>0){
this_bak_section=this.getBakSection();
var dongpan_price=this.getDongpanPrice();
if(this_bak_section=='BKS20'){
dongpan_price=0
}
var bak_basic_price=this.getBakBasicPrice();
var bundle_qty=this.getBundleQty();
var bak_sale_rate=Math.max(1-(bundle_qty/30000),0.64);
var bak_price=(Math.ceil((bak_basic_price*bak_sale_rate)/1000)*1000)+dongpan_price;
bak_price=bak_price+20000;
this.setBakDongpanPrice(dongpan_price);
this.setBakPrice(bak_price)
}
else{
this.setBakDongpanPrice(0);
this.setBakPrice(0)
}

}
,getBakBasicPrice:function(){
this.getBakMaterialPrice();
var work_price=this.getBakWorkPrice();
var min_price=this.getBakMinPrice();
var basic_price=Math.max(work_price+this.material_price,min_price);
basic_price=Math.ceil(basic_price/100)*100;
return basic_price
}
,getBakWorkPrice:function(){
var bundle_qty=this.getBundleQty();
var work_x_size=this.getWorkXSize();
var work_y_size=this.getWorkYSize();
var binding_type=this.getBindingType();
var bundle_type=this.getBundleType();
var set_x_type=1;
var set_y_type=2;
if(bundle_type=='1'){
set_x_type=1;
set_y_type=2
}
else{
set_x_type=2;
set_y_type=1
}
this.chk_x_size=work_x_size*set_x_type;
this.chk_y_size=work_y_size*set_y_type;
var pp_bak_info=jsonPath(ppBakJsonOBJ,"$.pp_bak_info[?(@.type=='work_unit')][?(@.chk_size_low<='"+this.chk_x_size+"')]");
var limit_x_size=0;
var limit_y_size=0;
var unit_price=0;
for(var i=(pp_bak_info.length-1);
i>=0;
i--){
set_x_size=parseInt(pp_bak_info[i].chk_size_low);
set_y_size=parseInt(pp_bak_info[i].chk_size_high);
if(set_x_size<=this.chk_x_size&&set_y_size<=this.chk_y_size){
if(limit_x_size<=set_x_size&&limit_y_size<=set_y_size){
limit_x_size=set_x_size;
limit_y_size=set_y_size;
unit_price=pp_bak_info[i].unit_cost
}

}

}
var work_price=(parseInt(unit_price)+20)*bundle_qty;
return work_price
}
,getBakMaterialPrice:function(){
var bundle_qty=this.getBundleQty();
var bak_type=this.getBakType();
var bak_x_size=this.getBakXSize();
var bak_y_size=this.getBakYSize();
bak_x_size=Math.max(parseInt(bak_x_size),30);
bak_y_size=Math.max(parseInt(bak_y_size),30);
var pp_bak_info=jsonPath(ppBakJsonOBJ,"$.pp_bak_info[?(@.type=='film_unit')][?(@.bak_type=='"+bak_type+"')]");
var material_unit=parseInt(pp_bak_info[0].material_unit2);
var extra_rate=parseFloat(pp_bak_info[0].extra_rate);
var film_x_size=parseInt(pp_bak_info[0].chk_size_low);
var film_length=parseInt(pp_bak_info[0].chk_size_high);
var material_unit=material_unit/(film_x_size*film_length)*((bak_x_size+30)*(bak_y_size+30))*extra_rate;
this.material_price=Math.round(material_unit*bundle_qty)
}
,getBakMinPrice:function(){
var bak_x_size=this.getBakXSize();
var bak_y_size=this.getBakYSize();
var min_price=Math.ceil(((Math.max(this.chk_x_size,this.chk_y_size)-40)*100)/1000)*1000+this.material_price;
return min_price
}
,getDongpanPrice:function(){
bak_x_size=parseInt(this.getBakXSize());
bak_y_size=parseInt(this.getBakYSize());
price1=((bak_x_size+20)*(bak_y_size+20))*150/100;
price2=10000;
dongpan_price=Math.max(price1,price2);
dongpan_price=Math.ceil(dongpan_price/100)*100;
return dongpan_price
}

}
);
var ppAP=Class.create(Postpress,{
initialize:function($super,seq){
$super();
this.seq=0;
this.min_price=0;
this.min_unit=0
}
,dataLoad:function(){
new Ajax.Request('/estimate/estimate_goods/pp_ap_json_data',{
asynchronous:false,method:"post",parameters:{
"t":timestamp,"product":"name"
}
,onSuccess:function(jsonData){
ppApJsonOBJ=jsonData.responseText.evalJSON(true)
}
,onFailure:function(){
alert('Loading Failed for ap Json Data')
}

}
)
}
,setAPSeq:function(seq){
this.seq=seq
}
,getAPSection:function(){
return $('ap_section_'+this.seq).value
}
,getAPType:function(){
return $('ap_type_'+this.seq).value
}
,getAPXSize:function(){
return $('ap_x_size_'+this.seq).value
}
,getAPYSize:function(){
return $('ap_y_size_'+this.seq).value
}
,setAPPrice:function(price){
$('ap_amt_'+this.seq).value=price
}
,getAPPrice:function(){
return $('ap_amt_'+this.seq).value
}
,setAPDongpanPrice:function(price){
$('ap_dongpan_amt_'+this.seq).value=price
}
,getAPDongpanPrice:function(){
return $('ap_dongpan_amt_'+this.seq).value
}
,setAPSujiPrice:function(price){
$('ap_suji_amt_'+this.seq).value=price
}
,getAPSujiPrice:function(){
return $('ap_suji_amt_'+this.seq).value
}
,getIsPPAP:function(){
if($('chk_is_ap').checked==true){
return true
}
else{
return false
}

}
,settingAPType:function(){
this_ap_section=this.getAPSection()
}
,calcuAPPrice:function(){
if(this.getIsPPAP()){
this.settingAPType()
}
ap_section=this.getAPSection();
ap_x_size=this.getAPXSize();
ap_y_size=this.getAPYSize();
if(this.getIsPPAP()&&ap_section!=""&&ap_x_size>0&&ap_y_size>0){
var ap_basic_price=0;
var ap_sale_rate=0;
var suji_price=0;
var dongpan_price=0;
var suji_price=this.getAPSujiPrice();
var dongpan_price=this.getDongpanPrice();
this_ap_section=this.getAPSection();
if(this_ap_section=='APS20'){
dongpan_price=0
}
var ap_basic_price=this.getAPBasicPrice();
var bundle_qty=this.getBundleQty();
var ap_sale_rate=Math.max(1-(bundle_qty/30000),0.64);
var ap_price=Math.ceil((ap_basic_price*ap_sale_rate)/1000)*1000+suji_price+dongpan_price;
ap_price=ap_price+20000;
this.setAPDongpanPrice(dongpan_price);
this.setAPSujiPrice(suji_price);
this.setAPPrice(ap_price)
}
else{
this.setAPDongpanPrice(0);
this.setAPSujiPrice(0);
this.setAPPrice(0)
}

}
,getAPBasicPrice:function(){
var work_price=this.getAPWorkPrice();
var min_price=this.getAPMinPrice();
var basic_price=Math.max(work_price,min_price);
return basic_price
}
,getAPWorkPrice:function(){
var bundle_qty=this.getBundleQty();
var work_x_size=this.getWorkXSize();
var work_y_size=this.getWorkYSize();
var binding_type=this.getBindingType();
var bundle_type=this.getBundleType();
var set_x_type=1;
var set_y_type=2;
if(bundle_type=='1'){
set_x_type=1;
set_y_type=2
}
else{
set_x_type=2;
set_y_type=1
}
this.chk_x_size=work_x_size*set_x_type;
this.chk_y_size=work_y_size*set_y_type;
var pp_ap_info=jsonPath(ppApJsonOBJ,"$.pp_ap_info[?(@.type=='work_unit')][?(@.chk_size_low<='"+this.chk_x_size+"')]");
var limit_x_size=0;
var limit_y_size=0;
var unit_price=0;
for(var i=(pp_ap_info.length-1);
i>=0;
i--){
set_x_size=parseInt(pp_ap_info[i].chk_size_low);
set_y_size=parseInt(pp_ap_info[i].chk_size_high);
if(set_x_size<=this.chk_x_size&&set_y_size<=this.chk_y_size){
if(limit_x_size<=set_x_size&&limit_y_size<=set_y_size){
limit_x_size=set_x_size;
limit_y_size=set_y_size;
unit_price=pp_ap_info[i].unit_cost
}

}

}
var work_price=(parseInt(unit_price)+20)*bundle_qty;
return work_price
}
,getAPMinPrice:function(){
var min_price=Math.round(((Math.max(this.chk_x_size,this.chk_y_size)-40)*100)/1000)*1000;
return min_price
}
,getAPSujiPrice:function(){
ap_x_size=parseInt(this.getAPXSize());
ap_y_size=parseInt(this.getAPYSize());
price1=((ap_x_size+20)*(ap_y_size+20))*80/1000;
price2=10000;
suji_price=Math.max(price1,price2);
return suji_price
}
,getDongpanPrice:function(){
ap_x_size=parseInt(this.getAPXSize());
ap_y_size=parseInt(this.getAPYSize());
ap_x_size=Math.max(parseInt(ap_x_size),30);
ap_y_size=Math.max(parseInt(ap_y_size),30);
price1=((ap_x_size+20)*(ap_y_size+20))*150/100;
price2=10000;
dongpan_price=Math.max(price1,price2);
dongpan_price=Math.ceil(dongpan_price/100)*100;
return dongpan_price
}

}
);
var ppBindings=Class.create(Postpress,{
initialize:function($super){
$super();
this.unit_price=0;
this.BINDING_MIN_PRICE=12000;
this.IS_BINDING_PAPER_WEIGHT=120;
this.save_binding_type=$('save_binding_type').value;
this.save_bundle_type=$('save_bundle_type').value
}
,getEditingType:function(){
return $('editing_type').value
}
,getBindingType:function(){
if($('binding_type').value==""){
return $('save_binding_type').value
}
else{
return $('binding_type').value
}

}
,getBundleType:function(){
if($('bundle_type').value==""){
return this.save_binding_xy_set
}
else{
return $('bundle_type').value
}

}
,setBindingPrice:function(price){
$('binding_amt').value=price
}
,getBindingPrice:function(){
return $('binding_amt').value
}
,setChkBinding:function(value){
$('chk_is_binding').value=value
}
,getSpringColor:function(){
return $('spring_color').value
}
,setBindingType:function(){
var this_binding_type=this.getBindingType();
var cover_print_page=this.getCoverPrintPage();
var spine=parseFloat(this.settingSpine());
var bundle_qty=parseInt(this.getBundleQty());
this.initSelectOptions('binding_type');
var binding_status1=true;
var in_page_qty=parseInt(this.getPageQty('in_'));
var add_page_qty=parseInt(this.getPageQty('add_'));
var page_qty_sum=in_page_qty+add_page_qty;
var add_paper_status=this.getAddPaperStatus();
if(in_page_qty>0){
if((parseInt(in_page_qty)%4)!=0){
binding_status1=false
}

}
if(add_paper_status=='Y'&&add_page_qty>0){
if((parseInt(add_page_qty)%4)!=0){
binding_status1=false
}

}
if(spine>=this.binding_min_spine){
binding_status1=false
}
if(page_qty_sum>64){
binding_status1=false
}
var binding_status2=true;
if(spine<=this.binding_limit_spine){
binding_status2=false
}
var cover_paper_weight=this.getPaperWeight('cover_');
if(cover_paper_weight<=this.binding_limit_paper_weight){
binding_status2=false
}
var cover_holder_status=this.getCoverHolderStatus();
if(cover_holder_status=='b'){
binding_status2=false
}
if(cover_paper_weight<=120){
binding_status2=false
}
else{
if(cover_print_page=='2/2/4//b'&&cover_print_page=='2/1/2//b'){
binding_status2=false
}
else{
if(spine>this.binding_limit_spine){
binding_status2=true
}
else{
binding_status2=false
}

}

}
this_editing_type=this.getEditingType();
var binding_status3=false;
if(this_editing_type=='2/8'||this_editing_type=='2/6'){
binding_status3=true
}
var select_index=0;
if(binding_status3==true){
$('binding_type').options[0]=new Option("중철","BDT2",false)
}
else{
if(binding_status1==true){
$('binding_type').options[select_index]=new Option("중철","BDT2",false);
select_index++
}
if(binding_status2==true){
if(is_admin=="Y"&&this_binding_type=="BDT3"){
$('binding_type').options[select_index]=new Option("무선","BDT3",false);
select_index++
}

}
if(binding_status2==true&&spine>=this.binding_limit_spine_pur){
var cover_paper_kind=this.getPaperKind('cover_');
var in_paper_kind=this.getPaperKind('in_');
var add_paper_kind=this.getPaperKind('add_');
if(cover_paper_kind=='PKD40'||in_paper_kind=='PKD40'||add_paper_kind=='PKD40'){

}
else{
$('binding_type').options[select_index]=new Option("pur무선","BDT6",false);
select_index++
}

}
if(cover_print_page.substring(0,1)=='1'){
$('binding_type').options[select_index]=new Option("스프링","BDT4",false);
select_index++
}
if(binding_status1==false&&binding_status2==false&&binding_status3==false){
$('binding_type').options[select_index]=new Option("제본없음","BDT99",false);
select_index++
}

}
this.thisPositionSelectOptions("binding_type",this_binding_type);
var binding_type=$('binding_type').value;
var this_cover_print_page=print1.getCoverPrintPage();
var this_cover_print_page_arry=this_cover_print_page.split("/");
var page_set_num=print1.getCoverPageSet();
if(binding_type=='BDT3'||binding_type=='BDT6'||page_set_num=='2'){
if(this_cover_print_page_arry[0]=='1'){
$j("#cover_size_area").css("display","none");
$j("#cover_work_size_area").css("display","block")
}
else{
$j("#cover_size_area").css("display","block");
$j("#cover_work_size_area").css("display","block");
$j('#cover_x_size').css('background','#FFFF66');
$j('#cover_y_size').css('background','#FFFF66')
}

}
else{
$j("#cover_size_area").css("display","none");
$j("#cover_work_size_area").css("display","none")
}
print1.setCoverPageSize()
}
,calcuBindingPrice:function(){
this.setBindingType();
var binding_type=this.getBindingType();
var binding_xy_set=this.getBundleType();
var binding_price=0;
var bundle_qty=parseInt(this.getBundleQty());
var cover_add_in=this.getCoverAddIn();
var this_bundle_type=this.getBundleType();
var this_new_bundle_type=this.getNewBundleType();
var binding_Q67=0;
var xy_pan_add_price=0;
var xy_paper_add_price=0;
var xy_print_add_price=0;
if(binding_type=='BDT3'||binding_type=='BDT6'){
xy_pan_add_price=parseFloat($('xy_pan_add_price').value);
xy_paper_add_price=parseFloat($('xy_paper_add_price').value);
xy_print_add_price=parseFloat($('xy_print_add_price').value);
binding_Q67=Math.ceil((xy_pan_add_price+xy_paper_add_price+xy_print_add_price)/1000)*1000
}
if(binding_type=='BDT2'){
this.setChkBinding('1');
var sale_rate=Math.max(1-(bundle_qty/60000),0.75);
 var in_page_rate=0;
if(cover_add_in=='0'){
in_page_rate=4
}
var in_page_qty=this.getPageQty('in_');
in_sum=parseInt(in_page_rate)+parseInt(in_page_qty);
in_page_rate=Math.ceil(in_sum/8);
var add_page_qty=this.getPageQty('add_');
var add_page_rate=Math.ceil(add_page_qty/8);
 var basic_price=parseInt(cover_add_in)+parseInt(in_page_rate)+parseInt(add_page_rate)+0.5;
basic_price=Math.max(basic_price,2)*11;
var sale_price=basic_price*sale_rate;
var cover_page_set=this.getCoverPageSet();
var special_extra_charge=1;
if(cover_page_set=='2'){
special_extra_charge=2.5
}
var in_paper_weight=this.getPaperWeight('in_');
var add_paper_weight=this.getPaperWeight('add_');
var paper_extra_charge=1;
if(in_paper_weight>=250||add_paper_weight>=250){
paper_extra_charge=1.2
}
var coating_type=ppCoatingIn.getCoatingType();
var coating_extra_charge=1;
if(coating_type=='COT40'||coating_type=='COT50'||coating_type=='COT60'){
coating_extra_charge=1.5
}
bundle_qty=Math.max(bundle_qty,500);
var bundle_extra_rate=1;
if(this_new_bundle_type=='1^2'||this_new_bundle_type=='2^1'){
bundle_extra_rate=1.2
}
else{
bundle_extra_rate=1
}
binding_price=Math.ceil((sale_price*bundle_qty*special_extra_charge*bundle_extra_rate)/1000)*1000*paper_extra_charge*coating_extra_charge+50000
}
else if(binding_type=='BDT4'){
this.setChkBinding('1');
var in_paper_qty=this.getPageQty('in_');
var in_paper_weight=this.getPaperWeight('in_');
if(in_paper_weight<120){
in_paper_weight=120
}
var in_paper_lowst_qty=Math.ceil(10000/in_paper_weight);
 in_paper_qty=Math.min(Math.max(in_paper_qty,in_paper_lowst_qty),150);
var in_binding_price_rate=in_paper_weight/100*7.5;
 var in_lowst_bundle_qty=200;
in_lowst_bundle_qty=Math.max(in_lowst_bundle_qty,bundle_qty);
var in_sale_rate=Math.max(1-(bundle_qty/5000),0.8);
var cover_print_page=this.getPrintPage();
var cover_wing_status=cover_print_page[3];
var in_binding_add_price=0;
if(cover_wing_status!=''){

}
var spring_color=this.getSpringColor();
var spring_add_amt=0;
if(spring_color=="SCK30"){
spring_add_amt=60*bundle_qty
}
var in_binding_price=Math.ceil(((in_paper_qty*in_binding_price_rate*in_lowst_bundle_qty+100000)*in_sale_rate+spring_add_amt)/1000)*1000+in_binding_add_price;
var add_page_qty=this.getPageQty('add_');
var add_paper_weight=this.getPaperWeight('add_');
if(add_paper_weight<120){
add_paper_weight=120
}
var add_page_lowst_qty=Math.ceil(4000/add_paper_weight);
 if(add_page_qty>0){
add_page_qty=Math.max(add_page_qty,add_page_lowst_qty);
var add_binding_price_rate=add_paper_weight/100*7.5;
 var add_lowst_bundle_qty=Math.max(bundle_qty,300);
var add_sale_rate=Math.max(1-(bundle_qty/10000),0.8);
var add_binding_price=Math.ceil(((add_page_qty*add_binding_price_rate*add_lowst_bundle_qty)*add_sale_rate)/1000)*1000
}
else{
var add_binding_price=0
}
var binding_price=in_binding_price+add_binding_price
}
else if(binding_type=='BDT3'){
this.setChkBinding('1');
var cover_paper_weight=this.getPaperWeight('cover_');
var in_page_qty=parseInt(this.getPageQty('in_'));
var in_paper_weight=this.getPaperWeight('in_');
if(in_paper_weight<120){
in_paper_weight=120
}
var in_page_lowst_qty=Math.ceil(10000/in_paper_weight);
 if(in_page_qty<in_page_lowst_qty){
in_page_qty=in_page_lowst_qty
}
var in_binding_price_rate=in_paper_weight/100*1.05;
var in_lowst_bundle_qty=bundle_qty;
if(in_lowst_bundle_qty<700){
in_lowst_bundle_qty=700
}
var in_sale_rate=1-(bundle_qty/100000);
if(in_sale_rate<0.75){
in_sale_rate=0.75
}
var cover_print_page=this.getPrintPage();
var cover_wing_status=cover_print_page[3];
var in_binding_add_price=0;
if(cover_wing_status!=''){
in_binding_add_price=in_lowst_bundle_qty*1.5*60+80000
}
var in_binding_price=Math.ceil((in_page_qty*in_binding_price_rate*in_lowst_bundle_qty+100000)*in_sale_rate/1000)*1000+in_binding_add_price;
 var add_page_qty=parseInt(this.getPageQty('add_'));
if(add_page_qty>0){
var add_paper_weight=parseFloat(this.getPaperWeight('add_'));
if(add_paper_weight<120){
add_paper_weight=120
}
var add_page_lowst_qty=Math.ceil(4000/add_paper_weight);
 if(add_page_qty<add_page_lowst_qty){
add_page_qty=add_page_lowst_qty
}
var add_binding_price_rate=add_paper_weight/100;
var add_bundle_qty=bundle_qty;
if(add_bundle_qty<700){
add_bundle_qty=700
}
var add_sale_rate=1-(bundle_qty/80000);
if(add_sale_rate<0.75){
add_sale_rate=0.75
}
var add_binding_price=Math.ceil(((add_page_qty*add_binding_price_rate*add_bundle_qty)*add_sale_rate)/1000)*1000
}
else{
var add_binding_price=0
}
binding_price=in_binding_price+add_binding_price;
var bundle_extra_rate=1;
if(this_new_bundle_type=='1^2'||this_new_bundle_type=='2^1'){
bundle_extra_rate=1.2
}
else{
bundle_extra_rate=1
}
var cut_x_size=this.getCutXSize();
var cut_y_size=this.getCutYSize();
var cut_max_size=Math.max(cut_x_size,cut_y_size);
if(this_new_bundle_type=='2^1'){
cut_size=cut_y_size
}
else if(this_new_bundle_type=='1^2'){
cut_size=cut_x_size
}
else{
cut_size=0
}
var add_bundle_price=0;
if(cut_size>260){
add_bundle_price=100000
}
else if(cut_size>230){
add_bundle_price=50000
}
else{
add_bundle_price=0
}
var in_bundle_price=0;
if(in_paper_weight>200||add_paper_weight>200){
in_bundle_price=30000
}
else{
in_bundle_price=0
}
if(cut_x_size<148&&cut_y_size<148){
in_bundle_price+=binding_Q67
}
else if(cut_x_size<148||cut_y_size<148){
in_bundle_price+=Math.ceil((((in_page_qty+add_page_qty)/32)+1)/0.5)*0.5*10*in_lowst_bundle_qty
}
binding_price=(binding_price*bundle_extra_rate)+add_bundle_price;
binding_price=Math.max(binding_price,230000);
binding_price+=in_bundle_price;
binding_price=Math.max(binding_price,230000)
}
else if(binding_type=='BDT6'){
this.setChkBinding('1');
var cover_paper_weight=this.getPaperWeight('cover_');
var in_page_qty=parseInt(this.getPageQty('in_'));
var in_paper_weight=this.getPaperWeight('in_');
if(in_paper_weight<120){
in_paper_weight=120
}
var in_page_lowst_qty=Math.ceil(10000/in_paper_weight);
 if(in_page_qty<in_page_lowst_qty){
in_page_qty=in_page_lowst_qty
}
var in_binding_price_BDT3_rate=in_paper_weight/100*1.05;
var in_lowst_bundle_qty=bundle_qty;
if(in_lowst_bundle_qty<700){
in_lowst_bundle_qty=700
}
var in_sale_rate=1-(bundle_qty/100000);
if(in_sale_rate<0.75){
in_sale_rate=0.75
}
var cover_print_page=this.getPrintPage();
var cover_wing_status=cover_print_page[3];
var in_binding_add_price=0;
if(cover_wing_status!=''){
in_binding_add_price=in_lowst_bundle_qty*1.5*60+80000
}
var in_binding_price_BDT3=Math.ceil((in_page_qty*in_binding_price_BDT3_rate*in_lowst_bundle_qty+100000)*in_sale_rate/1000)*1000+in_binding_add_price;
 var add_page_qty=parseInt(this.getPageQty('add_'));
if(add_page_qty>0){
var add_paper_weight=parseFloat(this.getPaperWeight('add_'));
if(add_paper_weight<120){
add_paper_weight=120
}
var add_page_lowst_qty=Math.ceil(4000/add_paper_weight);
 if(add_page_qty<add_page_lowst_qty){
add_page_qty=add_page_lowst_qty
}
var add_binding_price_BDT3_rate=add_paper_weight/100;
var add_bundle_qty=bundle_qty;
if(add_bundle_qty<700){
add_bundle_qty=700
}
var add_sale_rate=1-(bundle_qty/80000);
if(add_sale_rate<0.75){
add_sale_rate=0.75
}
var add_binding_price_BDT3=Math.ceil(((add_page_qty*add_binding_price_BDT3_rate*add_bundle_qty)*add_sale_rate)/1000)*1000
}
else{
var add_binding_price_BDT3=0
}
binding_price_BDT3=in_binding_price_BDT3+add_binding_price_BDT3;
var bundle_extra_rate=1;
if(this_new_bundle_type=='1^2'||this_new_bundle_type=='2^1'){
bundle_extra_rate=1.2
}
else{
bundle_extra_rate=1
}
var cut_x_size=this.getCutXSize();
var cut_y_size=this.getCutYSize();
var cut_max_size=Math.max(cut_x_size,cut_y_size);
if(this_new_bundle_type=='2^1'){
cut_size=cut_y_size
}
else if(this_new_bundle_type=='1^2'){
cut_size=cut_x_size
}
else{
cut_size=0
}
var add_bundle_price=0;
if(cut_size>260){
add_bundle_price=100000
}
else if(cut_size>230){
add_bundle_price=50000
}
else{
add_bundle_price=0
}
var in_bundle_price=0;
if(in_paper_weight>200||add_paper_weight>200){
in_bundle_price=30000
}
else{
in_bundle_price=0
}
if(cut_x_size<148&&cut_y_size<148){
in_bundle_price+=binding_Q67
}
else if(cut_x_size<148||cut_y_size<148){
in_bundle_price+=Math.ceil((((in_page_qty+add_page_qty)/32)+1)/0.5)*0.5*10*in_lowst_bundle_qty
}
binding_price_BDT3=(binding_price_BDT3*bundle_extra_rate)+add_bundle_price;
binding_price_BDT3=Math.max(binding_price_BDT3,230000);
binding_price_BDT3+=in_bundle_price;
binding_price_BDT3=Math.max(binding_price_BDT3,230000);
this.setChkBinding('1');
var in_page_qty=parseInt(this.getPageQty('in_'));
var add_page_qty=parseInt(this.getPageQty('add_'));
var bundle_qty=parseInt(this.getBundleQty());
var spine=parseFloat(this.settingSpine());
var pur_C146=in_page_qty+add_page_qty;
var in_paper_weight=this.getPaperWeight('in_');
var add_paper_weight=0;
if(add_page_qty>0){
add_paper_weight=this.getPaperWeight('add_')
}
pur_paper_weight=Math.max(in_paper_weight,add_paper_weight);
pur_D146=Math.max(bundle_qty,600);
var pur_E146=0;
var cover_print_page=this.getPrintPage();
var cover_wing_status=cover_print_page[3];
if(cover_wing_status!=''){
pur_E146=pur_D146*1.5*60+80000
}
var cut_x_size=this.getCutXSize();
var cut_y_size=this.getCutYSize();
var cut_max_size=Math.max(cut_x_size,cut_y_size);
var in_bundle_price=0;
if(in_paper_weight>200||add_paper_weight>200){
in_bundle_price=30000
}
else{
in_bundle_price=0
}
if(cut_x_size<148&&cut_y_size<148){
in_bundle_price+=binding_Q67
}
else if(cut_x_size<148||cut_y_size<148){
in_bundle_price+=Math.ceil(((in_page_qty+add_page_qty)/32+1)/0.5)*0.5*10*pur_D146
}
pur_D148=Math.max(Math.max(pur_paper_weight,110)/120,1);
 pur_D148=Math.ceil(pur_D148*100)/100;
 pur_F146=50;
pur_F148=0.1;
pur_G146=14;
pur_G148=0.4;
pur_H146=165;
if((pur_C146/48)<1){
pur_H148=1
}
else if((pur_C146/120)<=1){
pur_H148=Math.min(pur_C146/2000+1,1.5);
pur_H148=Math.ceil(pur_H148*100)/100
}
else{
pur_H148=Math.min(pur_C146/100+1,3);
pur_H148=Math.ceil(pur_H148*100)/100
}
pur_I146=Math.ceil((30+(bundle_qty/20))/10)*10;
pur_I146=Math.min(pur_I146,150);
pur_I148=23400;
if(bundle_qty>300){
pur_J146=230000
}
else{
pur_J146=200000
}
pur_K146=Math.max(1-bundle_qty/80000,0.8);
pur_L146=(pur_D146*((pur_H146+pur_I146)+(pur_F146+pur_G146)+(pur_C146*pur_D148*(pur_F148+pur_G148)*pur_H148))+pur_I148)*pur_K146+pur_E146+in_bundle_price;
pur_L146=Math.ceil(pur_L146/1000)*1000;
pur_L146=Math.max(pur_L146,pur_J146);
binding_price_pur=pur_L146;
binding_price=Math.min(binding_price_BDT3,binding_price_pur)
}
else{
this.setChkBinding('0')
}
this.setBindingPrice(binding_price)
}
,getPurUnitCost:function(){
var puc_K5=parseInt(this.getBundleQty());
var puc_M_arry=new Array(1,50,100,300,500,1000,2000,100000);
var puc_N_arry=new Array();
var puc_O_arry=new Array(30000,1000,900,700,500,350,280,180);
var puc_P_arry=new Array();
var puc_ea=1;
var puc_P=0;
for(var i=0;
i<puc_M_arry.length;
i++){
if(i>0){
puc_ea=parseInt(puc_M_arry[i-1])
}
if(puc_K5<parseInt(puc_M_arry[i])&&puc_K5>puc_ea){
puc_N_arry[i]=puc_K5
}
else{
puc_N_arry[i]=puc_M_arry[i]
}
if(i==0){
puc_P=parseInt(puc_O_arry[i])*(parseInt(puc_N_arry[i])-0)
}
else{
puc_P=parseInt(puc_O_arry[i])*(parseInt(puc_N_arry[i])-parseInt(puc_N_arry[i-1]))
}
puc_P_arry[i]=puc_P
}
var pur_unit_cost_key=0;
for(var i=0;
i<puc_N_arry.length;
i++){
if(puc_K5==parseInt(puc_N_arry[i])){
pur_unit_cost_key=puc_N_arry[i]
}

}
var puc_K7=0;
for(var i=0;
i<puc_N_arry.length;
i++){
if(pur_unit_cost_key>=parseInt(puc_N_arry[i])){
puc_K7+=parseInt(puc_P_arry[i])
}

}
var pur_unit_cost=puc_K7;
return pur_unit_cost
}

}
);
var ppEpoxy=Class.create(Postpress,{
initialize:function($super){
$super()
}
,getEpoxyType:function(){
if($('epoxy_type').value==""){
return $('save_epoxy_type').value
}
else{
return $('epoxy_type').value
}

}
,getEpoxyKind:function(){
if($('epoxy_kind').value==""){
return $('save_epoxy_kind').value
}
else{
return $('epoxy_kind').value
}

}
,setEpoxyPrice:function(price){
$('epoxy_amt').value=price
}
,getEpoxyPrice:function(){
return $('epoxy_amt').value
}
,calcuEpoxyPrice:function(){
var epoxy_unit_cost=0;
var epoxy_amt=0;
var epoxy_price=0;
var partial_coating_price=0;
if($('chk_is_epoxy').checked==true||$('chk_is_partial_coating').checked==true){
var epoxy_type=this.getEpoxyType();
var paper_qty=parseInt($('paper_qty').value);
var order_count=parseInt($('order_count').value);
var cut_num=$('cut_num').value;
var parts_num=$("parts_num").value;
var size_M3=cut_num*parts_num;
var ep_B3=0;
var ep_C3='';
var ep_D3='';
var ep_E3=parseFloat($('cover_work_x_size').value);
var ep_F3=parseFloat($('cover_work_y_size').value);
var binding_type=$('binding_type').value;
if(binding_type=='BDT2'||binding_type=='BDT4'){
var cover_print_page_arry=$('cover_print_page').value.split('/');
if(cover_print_page_arry[0]=='1'){
ep_E3=ep_E3*2
}

}
var ep_C4='A1';
var ep_C5='B2';
var ep_C6='A2';
var ep_C7='B3';
var ep_C8='B4';
var ep_C9='A3';
var ep_D4='PTK10';
var ep_D5='PTK20';
var ep_D6='PTK10';
var ep_D7='PTK20';
var ep_D8='PTK20';
var ep_D9='PTK10';
var ep_E4=900;
var ep_E5=760;
var ep_E6=450;
var ep_E7=380;
var ep_E8=380;
var ep_E9=450;
var ep_F4=610;
var ep_F5=525;
var ep_F6=610;
var ep_F7=525;
var ep_F8=260;
var ep_F9=310;
var ep_H4=Math.floor(ep_E4/ep_E3);
var ep_H5=Math.floor(ep_E5/ep_E3);
var ep_H6=Math.floor(ep_E6/ep_E3);
var ep_H7=Math.floor(ep_E7/ep_E3);
var ep_H8=Math.floor(ep_E8/ep_E3);
var ep_H9=Math.floor(ep_E9/ep_E3);
var ep_I4=Math.floor(ep_F4/ep_F3);
var ep_I5=Math.floor(ep_F5/ep_F3);
var ep_I6=Math.floor(ep_F6/ep_F3);
var ep_I7=Math.floor(ep_F7/ep_F3);
var ep_I8=Math.floor(ep_F8/ep_F3);
var ep_I9=Math.floor(ep_F9/ep_F3);
var ep_J4=Math.floor(ep_F4/ep_E3);
var ep_J5=Math.floor(ep_F5/ep_E3);
var ep_J6=Math.floor(ep_F6/ep_E3);
var ep_J7=Math.floor(ep_F7/ep_E3);
var ep_J8=Math.floor(ep_F8/ep_E3);
var ep_J9=Math.floor(ep_F9/ep_E3);
var ep_K4=Math.floor(ep_E4/ep_F3);
var ep_K5=Math.floor(ep_E5/ep_F3);
var ep_K6=Math.floor(ep_E6/ep_F3);
var ep_K7=Math.floor(ep_E7/ep_F3);
var ep_K8=Math.floor(ep_E8/ep_F3);
var ep_K9=Math.floor(ep_E9/ep_F3);
var ep_M4=ep_H4*ep_I4;
var ep_M5=ep_H5*ep_I5;
var ep_M6=ep_H6*ep_I6;
var ep_M7=ep_H7*ep_I7;
var ep_M8=ep_H8*ep_I8;
var ep_M9=ep_H9*ep_I9;
var ep_N4=ep_J4*ep_K4;
var ep_N5=ep_J5*ep_K5;
var ep_N6=ep_J6*ep_K6;
var ep_N7=ep_J7*ep_K7;
var ep_N8=ep_J8*ep_K8;
var ep_N9=ep_J9*ep_K9;
var ep_P4=Math.max(ep_M4,ep_N4);
var ep_P5=Math.max(ep_M5,ep_N5);
var ep_P6=Math.max(ep_M6,ep_N6);
var ep_P7=Math.max(ep_M7,ep_N7);
var ep_P8=Math.max(ep_M8,ep_N8);
var ep_P9=Math.max(ep_M9,ep_N9);
var ep_R4=1;
var ep_R5=2;
var ep_R6=2;
var ep_R7=4;
var ep_R8=8;
var ep_R9=4;
var ep_B4=ep_E4*ep_F4*ep_P4;
var ep_B5=ep_E5*ep_F5*ep_P5;
var ep_B6=ep_E6*ep_F6*ep_P6;
var ep_B7=ep_E7*ep_F7*ep_P7;
var ep_B8=ep_E8*ep_F8*ep_P8;
var ep_B9=ep_E9*ep_F9*ep_P9;
var ep_B3_arry=new Array(ep_B4,ep_B5,ep_B6,ep_B7,ep_B8,ep_B9);
ep_B3_arry.sort(function(a,b){
return a-b
}
);
for(var j=0;
j<parseInt(ep_B3_arry.length);
j++){
if(parseInt(ep_B3_arry[j])>0){
ep_B3=ep_B3_arry[j];
break
}

}
var ep_B_arry=new Array(ep_B4,ep_B5,ep_B6,ep_B7,ep_B8,ep_B9);
var ep_C_arry=new Array(ep_C4,ep_C5,ep_C6,ep_C7,ep_C8,ep_C9);
var ep_D_arry=new Array(ep_D4,ep_D5,ep_D6,ep_D7,ep_D8,ep_D9);
var ep_R_arry=new Array(ep_R4,ep_R5,ep_R6,ep_R7,ep_R8,ep_R9);
for(var i=0;
i<parseInt(ep_B_arry.length);
i++){
if(ep_B3==ep_B_arry[i]){
ep_C3=ep_C_arry[i];
ep_D3=ep_D_arry[i];
ep_R3=ep_R_arry[i]*2
}

}
var ep_T2=0;
var ep_U2='';
var ep_V2=0;
var ep_W2=0;
var ep_X2=0;
var ep_Y2=0;
var ep_T4=ep_E4*ep_F4*ep_P4;
var ep_T5=ep_E5*ep_F5*ep_P5;
var ep_T6=ep_E6*ep_F6*ep_P6;
var ep_U4='A1';
var ep_U5='B2';
var ep_U6='A2';
var ep_V4=180000;
var ep_V5=150000;
var ep_V6=150000;
var ep_W4=290;
var ep_W5=200;
var ep_W6=170;
var ep_X4=500;
var ep_X5=500;
var ep_X6=500;
var ep_Y4=1;
var ep_Y5=2;
var ep_Y6=2;
var ep_T2_arry=new Array(ep_T4,ep_T5,ep_T6);
ep_T2_arry.sort(function(a,b){
return a-b
}
);
for(var j=0;
j<parseInt(ep_T2_arry.length);
j++){
if(parseInt(ep_T2_arry[j])>0){
ep_T2=ep_T2_arry[j];
break
}

}
var ep_T_arry=new Array(ep_T4,ep_T5,ep_T6);
var ep_U_arry=new Array(ep_U4,ep_U5,ep_U6);
var ep_V_arry=new Array(ep_V4,ep_V5,ep_V6);
var ep_W_arry=new Array(ep_W4,ep_W5,ep_W6);
var ep_X_arry=new Array(ep_X4,ep_X5,ep_X6);
var ep_Y_arry=new Array(ep_Y4,ep_Y5,ep_Y6);
for(var i=0;
i<parseInt(ep_T_arry.length);
i++){
if(ep_T2==ep_T_arry[i]){
ep_U2=ep_U_arry[i];
ep_V2=ep_V_arry[i];
ep_W2=ep_W_arry[i];
ep_X2=ep_X_arry[i];
ep_Y2=ep_Y_arry[i]
}

}
epoxy_unit_cost=paper_qty/(ep_R3/2)*ep_Y2;
epoxy_amt=epoxy_unit_cost*ep_W2;
epoxy_price=Math.max(epoxy_amt+10000,ep_V2);
partial_coating_price=epoxy_price
}
this.setEpoxyPrice(epoxy_price);
ppPartialCoating.setPartialCoatingPrice(partial_coating_price)
}

}
);
var ppGuidori=Class.create(Postpress,{
initialize:function($super){
$super()
}
,getGuidoriType:function(){
return $('guidori_type').value
}
,setGuidoriPrice:function(price){
$('guidori_amt').value=price
}
,getGuidoriPrice:function(){
return $('guidori_amt').value
}
,getIsPPGuidori:function(){
if($('chk_is_guidori').checked==true){
return true
}
else{
return false
}

}
,calcuGuidoriPosition:function(){
var save_guidori_etc1=$('save_guidori_etc1').value;
if(save_guidori_etc1!=''){
save_guidori_etc1_arry=save_guidori_etc1.split('|');
guidori_position1=save_guidori_etc1_arry[0];
guidori_position2=save_guidori_etc1_arry[1];
guidori_position3=save_guidori_etc1_arry[2];
guidori_position4=save_guidori_etc1_arry[3];
guidori_position=save_guidori_etc1_arry[4];
if(guidori_position1!=''){
$('guidori_position1').checked=true
}
else{
$('guidori_position1').checked=false
}
if(guidori_position2!=''){
$('guidori_position2').checked=true
}
else{
$('guidori_position2').checked=false
}
if(guidori_position3!=''){
$('guidori_position3').checked=true
}
else{
$('guidori_position3').checked=false
}
if(guidori_position4!=''){
$('guidori_position4').checked=true
}
else{
$('guidori_position4').checked=false
}
$('guidori_position_kind').value=guidori_position
}

}
,calcuGuidoriPrice:function(){
this.calcuGuidoriPosition();
guidori_type=this.getGuidoriType();
this_bundle_qty=parseInt(this.getBundleQty());
if(this.getIsPPGuidori()&&guidori_type!=""){
var guidori_price_unit=this.calcuGuidoriPriceUnit();
var guidori_price=guidori_price_unit*this_bundle_qty;
this.setGuidoriPrice(guidori_price)
}
else{
this.setGuidoriPrice(0)
}

}
,calcuGuidoriPriceUnit:function(){
this_bundle_qty=parseInt(this.getBundleQty());
if(this_bundle_qty<10){
guidori_price_unit=1000
}
else if(this_bundle_qty<20){
guidori_price_unit=900
}
else if(this_bundle_qty<100){
guidori_price_unit=800
}
else if(this_bundle_qty<200){
guidori_price_unit=750
}
else if(this_bundle_qty<300){
guidori_price_unit=700
}
else if(this_bundle_qty<400){
guidori_price_unit=650
}
else if(this_bundle_qty<10000){
guidori_price_unit=600
}
else{
guidori_price_unit=600
}
return guidori_price_unit
}

}
);
