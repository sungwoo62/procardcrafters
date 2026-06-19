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
this.BASIC_ADD_PRICE=2000;
this.IS_OSI_PAPER_WEIGHT=121;
this.save_osi_num=$("save_osi_num").value
}
,dataLoad:function(){
var json_type='pp_osi_json_data';
if(category_code=='CLF1000'||category_code=='CLF3000'||category_code=="CLF4000"||category_code=="CLF5000"){
json_type='pp_osi_missing_json_data'
}
new Ajax.Request('/estimate/estimate_goods/'+json_type,{
asynchronous:false,method:"post",parameters:{
"t":timestamp,"category_code":this.getCategoryCode()
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
,getOsiNum2:function(){
if($('osi_num2').value==""){
return this.save_osi_num
}
else{
return $('osi_num2').value
}

}
,getCutNum:function(){
return parseInt($('cut_num').value)
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
,getOsiType:function(){
return $('osi_type').value
}
,getFoldingType:function(){
if($('folding_type').value==""){
return this.save_folding_type
}
else{
return $('folding_type').value
}

}
,getIsPPFolding:function(){
if($('chk_is_folding').checked==true){
return true
}
else{
return false
}

}
,getOsiKind:function(){
if($('osi_kind').value==""){
return $("save_osi_kind").value
}
else{
return $('osi_num').value
}

}
,settingOsiNum:function(){
var paper_weight=this.getPaperWeight();
var paper_size=this.getPaperSize();
var this_osi_num=this.getOsiNum();
var this_osi_kind=this.getOsiKind();
this.initSelectOptions('osi_num');
var thisValSeq=0;
if(this_osi_num=='OSN04'){
this_osi_num=this_osi_kind
}
if(paper_weight>=this.IS_OSI_PAPER_WEIGHT){
this_folding_type=this.getFoldingType();
if(this.getIsPPFolding()&&this_folding_type=="FDT10"){
$('osi_num').options[0]=new Option("2줄(십자)","OSN04",false);
$('osi_num').options[0].selected=true;
$('osi_num2').value=2;
$('osi_kind').value='OSK01'
}
else{
for(i=0;
i<4;
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
$('osi_num2').value=thisValSeq+1;
$('osi_num').options[thisValSeq].selected=true;
this.checkMsg("osi","","")
}

}
else{
$('osi_num').options[0]=new Option("없음","0",false);
this.setOsiPrice(0);
this.checkMsg("osi","오시는 용지평량이 121g부터 가능합니다.","paper_code")
}

}
,settingOsiType:function(){
var size_type=this.getSizeType();
var cut_x_size=this.getCutXSize();
var cut_y_size=this.getCutYSize();
var osi_num=this.getOsiNum();
if(size_type=="SZT20"&&osi_num==3&&cut_x_size>=836&&cut_y_size==297){
$('osi_type').style.visibility='visible'
}
else{
$('osi_type').style.visibility='hidden'
}
if($('osi_type').value=='1'){
$('pnl_btn_swguide_folding').style.visibility='visible'
}
else{
$('pnl_btn_swguide_folding').style.visibility='hidden'
}

}
,calcuOsiPrice:function(){
if(this.getIsPPOsi()){
this.settingOsiNum();
this.settingOsiType()
}
osi_num=this.getOsiNum();
this_folding_type=this.getFoldingType();
if(this.getIsPPFolding()&&this_folding_type=="FDT10"){
osi_num=this.getOsiNum2()
}
osi_type=this.getOsiType();
if(this.getIsPPOsi()&&osi_num>0){
paper_yeon_qty=this.getPaperYeonQty();
paper_weight=this.getPaperWeight();
qty_unit_rate=Math.max(paper_yeon_qty,0.8);
qty_unit_rate=parseFloat(qty_unit_rate);
if(paper_weight>=400){
osi_extra_rate2=1.3
}
else{
osi_extra_rate2=1
}
this.getOsiPriceUnit();
if(category_code=='CLF1000'||category_code=='CLF3000'||category_code=="CLF4000"||category_code=="CLF5000"){
osi_price=this.unit_price;
osi_price=osi_price*1.2
}
else{
osi_price=Math.max((this.unit_price*qty_unit_rate),20000)+this.BASIC_ADD_PRICE;
osi_price=osi_price*osi_extra_rate2;
if(osi_type=="1"&&osi_num==3){
osi_price=osi_price-0
}
osi_price=osi_price*1.4
}
if(paper_weight>300){
osi_price=0;
chkPostPress('0','osi');
$('chk_is_osi').checked=false;
alert("일반오시는 300g 까지만 가능합니다.\n301g 부터는 도무송으로 접수하시기 바랍니다.\n\n예)오시1~2줄 도무송A형 오시3~4줄 도무송B형 오시5~6줄 도무송C형 오시7~8 도무송D형")
}
osi_price=osi_price+this.mock_price;
paper_qty=this.getPaperQty();
add_rate_unit_cost=osi_price/paper_qty;
 var cnt_add_rate=1;
if(add_rate_unit_cost<3.7){
cnt_add_rate=1.14
}
else{
cnt_add_rate=1
}
osi_price=osi_price*cnt_add_rate;
osi_price=Math.ceil(osi_price/1000)*1000;
this.setOsiPrice(osi_price)
}
else{
this.setOsiPrice(0)
}

}
,getOsiPriceUnit:function(){
paper_yeon_qty=this.getPaperYeonQty();
osi_num=this.getOsiNum();
paper_size=this.getPaperSize();
paper_weight=this.getPaperWeight();
if(paper_weight>=260){
osi_extra_rate=1.3
}
else if(paper_weight>=400){
osi_extra_rate=1.6
}
else{
osi_extra_rate=1
}
var osi_num_code=osi_num;
this_folding_type=this.getFoldingType();
if(this.getIsPPFolding()&&this_folding_type=="FDT10"){
osi_num=$('osi_num2').value
}
if(osi_num>0){
if(category_code=='CLF1000'||category_code=='CLF3000'||category_code=="CLF4000"||category_code=="CLF5000"){
if(paper_yeon_qty>20){
alert("해당 연수는 별도견적으로 문의해 주십시요.");
this.unit_price=0;
this.mock_price=0;
return
}
else{
paper_yeon_qty_num=Math.max(paper_yeon_qty,0.5);
cut_num=this.getCutNum();
osi_O12=cut_num*osi_num;
if(osi_O12>=128){
osi_P12=2
}
else if(osi_O12>=96){
osi_P12=1.5
}
else if(osi_O12>=48){
osi_P12=1.3
}
else{
osi_P12=1
}
if(paper_yeon_qty=='0.25'){
paper_yeon_qty_num=0.5
}
else if(paper_yeon_qty=='0.75'){
paper_yeon_qty_num=1
}
else if(paper_yeon_qty=='1.25'){
paper_yeon_qty_num=1
}
else if(paper_yeon_qty=='1.5'){
paper_yeon_qty_num=2
}
else if(paper_yeon_qty=='1.75'){
paper_yeon_qty_num=2
}
else if(paper_yeon_qty=='2.25'){
paper_yeon_qty_num=2
}
else if(paper_yeon_qty=='2.5'){
paper_yeon_qty_num=3
}
else if(paper_yeon_qty=='2.75'){
paper_yeon_qty_num=3
}
else if(paper_yeon_qty=='3.25'){
paper_yeon_qty_num=3
}
else if(paper_yeon_qty=='3.5'){
paper_yeon_qty_num=4
}
else if(paper_yeon_qty=='3.75'){
paper_yeon_qty_num=4
}
else if(paper_yeon_qty=='4.25'){
paper_yeon_qty_num=4
}
else if(paper_yeon_qty=='4.5'){
paper_yeon_qty_num=5
}
else if(paper_yeon_qty=='4.75'){
paper_yeon_qty_num=5
}
var pp_osi_info=jsonPath(ppOsiJsonOBJ,"$.pp_osi_missing_info[?(@.num=='"+paper_yeon_qty_num+"')][?(@.paper_size=='"+paper_size+"')]");
this.unit_price=parseInt(pp_osi_info[0].unit_price)*parseFloat(osi_P12)
}

}
else{
var pp_osi_info=jsonPath(ppOsiJsonOBJ,"$.pp_osi_info[?(@.num=='"+osi_num_code+"')][?(@.paper_size=='"+paper_size+"')]");
this.unit_price=parseInt(pp_osi_info[0].unit_price)*parseFloat(osi_extra_rate)
}
this.getOsiMockPriceUnit()
}
if(isNaN(this.mock_price)==true){
this.mock_price=0
}

}
,getOsiMockPriceUnit:function(){
osi_num=this.getOsiNum();
paper_size=this.getPaperSize();
this.mock_price=0;
if(osi_num=='1'){
if(paper_size=='A0200'){
this.mock_price=0
}
else if(paper_size=='A0100'){
this.mock_price=0
}
else if(paper_size=='B0300'){
this.mock_price=0
}
else if(paper_size=='B0200'){
this.mock_price=0
}

}
else if(osi_num=='2'||osi_num=='OSN04'){
if(paper_size=='A0500'){
this.mock_price=5000
}
else if(paper_size=='A0200'){
this.mock_price=10000
}
else if(paper_size=='A0100'){
this.mock_price=10000
}
else if(paper_size=='B0600'){
this.mock_price=5000
}
else if(paper_size=='B0300'){
this.mock_price=5000
}
else if(paper_size=='B0200'){
this.mock_price=10000
}

}
else if(osi_num=='3'){
if(paper_size=='A0500'){
this.mock_price=10000
}
else if(paper_size=='A0400'){
this.mock_price=5000
}
else if(paper_size=='A0300'){
this.mock_price=5000
}
else if(paper_size=='A0200'){
this.mock_price=15000
}
else if(paper_size=='A0100'){
this.mock_price=15000
}
else if(paper_size=='B0600'){
this.mock_price=10000
}
else if(paper_size=='B0500'){
this.mock_price=5000
}
else if(paper_size=='B0400'){
this.mock_price=5000
}
else if(paper_size=='B0300'){
this.mock_price=10000
}
else if(paper_size=='B0200'){
this.mock_price=15000
}

}
else if(osi_num=='4'){
if(paper_size=='A0500'){
this.mock_price=10000
}
else if(paper_size=='A0400'){
this.mock_price=10000
}
else if(paper_size=='A0300'){
this.mock_price=10000
}
else if(paper_size=='A0200'){
this.mock_price=20000
}
else if(paper_size=='A0100'){
this.mock_price=20000
}
else if(paper_size=='B0600'){
this.mock_price=10000
}
else if(paper_size=='B0500'){
this.mock_price=10000
}
else if(paper_size=='B0400'){
this.mock_price=10000
}
else if(paper_size=='B0300'){
this.mock_price=20000
}
else if(paper_size=='B0200'){
this.mock_price=20000
}

}
else if(osi_num=='5'){
if(paper_size=='A0200'||paper_size=='A0100'||paper_size=='B0300'||paper_size=='B0200'){
this.mock_price=30000
}

}
else if(osi_num=='6'){
if(paper_size=='A0200'||paper_size=='A0100'||paper_size=='B0300'||paper_size=='B0200'){
this.mock_price=40000
}

}
else if(osi_num=='7'){
if(paper_size=='A0200'||paper_size=='A0100'||paper_size=='B0300'||paper_size=='B0200'){
this.mock_price=50000
}

}
else if(osi_num=='8'){
if(paper_size=='A0200'||paper_size=='A0100'||paper_size=='B0300'||paper_size=='B0200'){
this.mock_price=60000
}

}
else{
this.mock_price=0
}

}

}
);
var ppMissing=Class.create(Postpress,{
initialize:function($super){
$super();
this.unit_price=0;
this.mock_price=0;
this.BASIC_ADD_PRICE=2000;
this.IS_MISSING_PAPER_WEIGHT=80;
this.save_missing_num=$("save_missing_num").value
}
,dataLoad:function(){
var json_type='pp_missing_json_data';
if(category_code=='CLF1000'||category_code=='CLF3000'||category_code=="CLF4000"||category_code=="CLF5000"){
json_type='pp_osi_missing_json_data'
}
new Ajax.Request('/estimate/estimate_goods/'+json_type,{
asynchronous:false,method:"post",parameters:{
"t":timestamp,"category_code":this.getCategoryCode()
}
,onSuccess:function(jsonData){
ppMissingJsonOBJ=jsonData.responseText.evalJSON(true)
}
,onFailure:function(){
alert('Loading Failed for Missing Json Data')
}

}
)
}
,getMissingNum:function(){
if($('missing_num').value==""){
return this.save_missing_num
}
else{
return $('missing_num').value
}

}
,getCutNum:function(){
return parseInt($('cut_num').value)
}
,setMissingPrice:function(price){
$('missing_amt').value=price
}
,getMissingPrice:function(){
return $('missing_amt').value
}
,getIsPPMissing:function(){
if($('chk_is_missing').checked==true){
return true
}
else{
return false
}

}
,settingMissingNum:function(){
var paper_weight=this.getPaperWeight();
var paper_size=this.getPaperSize();
var this_missing_num=this.getMissingNum();
this.initSelectOptions('missing_num');
if(paper_weight>=this.IS_MISSING_PAPER_WEIGHT){
thisValSeq=0;
for(i=0;
i<4;
i++){
num=i+1;
$('missing_num').options[i]=new Option(num+"줄",num,false);
if(this_missing_num==num){
thisValSeq=i
}

}
if(paper_size=="A0100"||paper_size=="A0200"||paper_size=="B0300"||paper_size=="B0200"){
for(i=4;
i<8;
i++){
num=i+1;
$('missing_num').options[i]=new Option(num+"줄",num,false);
if(this_missing_num==num){
thisValSeq=i
}

}

}
$('missing_num2').value=thisValSeq+1;
$('missing_num').options[thisValSeq].selected=true;
this.checkMsg("missing","","")
}
else{
$('missing_num').options[0]=new Option("없음","0",false);
this.setMissingPrice(0);
this.checkMsg("missing","미싱이 가능한 평량은 80g 초과이어야 합니다.","paper_code")
}

}
,calcuMissingPrice:function(){
if(this.getIsPPMissing()){
this.settingMissingNum()
}
missing_num=this.getMissingNum();
if(this.getIsPPMissing()&&missing_num>0){
paper_yeon_qty=this.getPaperYeonQty();
qty_unit_rate=Math.max(paper_yeon_qty,0.8);
qty_unit_rate=parseFloat(qty_unit_rate);
this.getMissingPriceUnit();
if(category_code=='CLF1000'||category_code=='CLF3000'||category_code=="CLF4000"||category_code=="CLF5000"){
missing_price=this.unit_price;
missing_price=missing_price*1.2
}
else{
missing_price=Math.max((this.unit_price*qty_unit_rate),20000)+this.BASIC_ADD_PRICE;
missing_price=missing_price*1.4
}
missing_price=missing_price+this.mock_price;
missing_price=Math.ceil(missing_price/1000)*1000;
this.setMissingPrice(missing_price);
this.outputDebugMsg("[calcuMissingPrice]unit_price:"+this.unit_price+",paper_yeon_qty:"+paper_yeon_qty+",mock_price:"+this.mock_price+",missing_price:"+missing_price)
}
else{
this.setMissingPrice(0);
this.outputDebugMsg("[calcuMissingPrice]missing_price:0")
}

}
,getMissingPriceUnit:function(){
paper_yeon_qty=this.getPaperYeonQty();
missing_num=this.getMissingNum();
paper_size=this.getPaperSize();
paper_weight=this.getPaperWeight();
if(paper_weight>=260){
missing_extra_rate=1.3
}
else if(paper_weight>=400){
missing_extra_rate=1.6
}
else{
missing_extra_rate=1
}
if(category_code=='CLF1000'||category_code=='CLF3000'||category_code=="CLF4000"||category_code=="CLF5000"){
if(paper_yeon_qty>20){
alert("해당 연수는 별도견적으로 문의해 주십시요.");
this.unit_price=0;
this.mock_price=0;
return
}
else{
paper_yeon_qty_num=Math.max(paper_yeon_qty,0.5);
cut_num=this.getCutNum();
missing_O13=cut_num*missing_num;
if(missing_O13>=128){
missing_P13=2
}
else if(missing_O13>=96){
missing_P13=1.5
}
else if(missing_O13>=48){
missing_P13=1.3
}
else{
missing_P13=1
}
if(paper_yeon_qty=='0.25'){
paper_yeon_qty=0.5
}
else if(paper_yeon_qty=='0.75'){
paper_yeon_qty=1
}
else if(paper_yeon_qty=='1.25'){
paper_yeon_qty=1
}
else if(paper_yeon_qty=='1.5'){
paper_yeon_qty=2
}
else if(paper_yeon_qty=='1.75'){
paper_yeon_qty=2
}
else if(paper_yeon_qty=='2.25'){
paper_yeon_qty=2
}
else if(paper_yeon_qty=='2.5'){
paper_yeon_qty=3
}
else if(paper_yeon_qty=='2.75'){
paper_yeon_qty=3
}
else if(paper_yeon_qty=='3.25'){
paper_yeon_qty=3
}
else if(paper_yeon_qty=='3.5'){
paper_yeon_qty=4
}
else if(paper_yeon_qty=='3.75'){
paper_yeon_qty=4
}
else if(paper_yeon_qty=='4.25'){
paper_yeon_qty=4
}
else if(paper_yeon_qty=='4.5'){
paper_yeon_qty=5
}
else if(paper_yeon_qty=='4.75'){
paper_yeon_qty=5
}
var pp_missing_info=jsonPath(ppMissingJsonOBJ,"$.pp_osi_missing_info[?(@.num=='"+paper_yeon_qty+"')][?(@.paper_size=='"+paper_size+"')]");
this.unit_price=parseInt(pp_missing_info[0].unit_price)*parseFloat(missing_P13)
}

}
else{
var pp_missing_info=jsonPath(ppMissingJsonOBJ,"$.pp_missing_info[?(@.num=='"+missing_num+"')][?(@.paper_size=='"+paper_size+"')]");
this.unit_price=parseInt(pp_missing_info[0].unit_price)*parseFloat(missing_extra_rate)
}
this.getMissingMockPriceUnit();
if(isNaN(this.mock_price)==true){
this.mock_price=0
}

}
,getMissingMockPriceUnit:function(){
missing_num=this.getMissingNum();
paper_size=this.getPaperSize();
this.mock_price=0;
if(missing_num=='1'){
if(paper_size=='A0200'){
this.mock_price=0
}
else if(paper_size=='A0100'){
this.mock_price=0
}
else if(paper_size=='B0300'){
this.mock_price=0
}
else if(paper_size=='B0200'){
this.mock_price=0
}
else if(paper_size=='A0400'){
this.mock_price=0
}

}
else if(missing_num=='2'){
if(paper_size=='A0500'){
this.mock_price=5000
}
else if(paper_size=='A0200'){
this.mock_price=10000
}
else if(paper_size=='A0100'){
this.mock_price=10000
}
else if(paper_size=='B0600'){
this.mock_price=5000
}
else if(paper_size=='B0300'){
this.mock_price=5000
}
else if(paper_size=='B0200'){
this.mock_price=10000
}

}
else if(missing_num=='3'){
if(paper_size=='A0500'){
this.mock_price=10000
}
else if(paper_size=='A0400'){
this.mock_price=5000
}
else if(paper_size=='A0300'){
this.mock_price=5000
}
else if(paper_size=='A0200'){
this.mock_price=15000
}
else if(paper_size=='A0100'){
this.mock_price=15000
}
else if(paper_size=='B0600'){
this.mock_price=10000
}
else if(paper_size=='B0500'){
this.mock_price=5000
}
else if(paper_size=='B0400'){
this.mock_price=5000
}
else if(paper_size=='B0300'){
this.mock_price=10000
}
else if(paper_size=='B0200'){
this.mock_price=15000
}

}
else if(missing_num=='4'){
if(paper_size=='A0500'){
this.mock_price=10000
}
else if(paper_size=='A0400'){
this.mock_price=10000
}
else if(paper_size=='A0300'){
this.mock_price=10000
}
else if(paper_size=='A0200'){
this.mock_price=20000
}
else if(paper_size=='A0100'){
this.mock_price=20000
}
else if(paper_size=='B0600'){
this.mock_price=10000
}
else if(paper_size=='B0500'){
this.mock_price=10000
}
else if(paper_size=='B0400'){
this.mock_price=10000
}
else if(paper_size=='B0300'){
this.mock_price=20000
}
else if(paper_size=='B0200'){
this.mock_price=20000
}

}
else if(missing_num=='5'){
if(paper_size=='A0200'||paper_size=='A0100'||paper_size=='B0300'||paper_size=='B0200'){
this.mock_price=30000
}

}
else if(missing_num=='6'){
if(paper_size=='A0200'||paper_size=='A0100'||paper_size=='B0300'||paper_size=='B0200'){
this.mock_price=40000
}

}
else if(missing_num=='7'){
if(paper_size=='A0200'||paper_size=='A0100'||paper_size=='B0300'||paper_size=='B0200'){
this.mock_price=50000
}

}
else if(missing_num=='8'){
if(paper_size=='A0200'||paper_size=='A0100'||paper_size=='B0300'||paper_size=='B0200'){
this.mock_price=60000
}

}
else{
this.mock_price=0
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
"t":timestamp,"category_code":this.getCategoryCode()
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
return $('coating_type').value
}
else{
return''
}

}
,setCoatingPrice:function(price){
$('coating_amt').value=price
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
,getIsPPNumbering:function(){
if($('chk_is_numbering').checked==true){
return true
}
else{
return false
}

}
,setNumberingPrice:function(price){
$('numbering_amt').value=price
}
,settingCoatingType:function(){
var paper_weight=this.getPaperWeight();
this_coating_type=this.getCoatingType();
this.initSelectOptions('coating_type');
if(paper_weight>=this.IS_COATING_PAPER_WEIGHT){
if($('chk_is_bak').checked==true&&paper_weight>=this.IS_COATING_PAPER_WEIGHT){
$('coating_type').options[0]=new Option("단면유광써멀코팅","COT10",false);
$('coating_type').options[1]=new Option("단면무광써멀코팅","COT20",false);
$('coating_type').options[2]=new Option("단면러버코팅","COT31",false);
$('coating_type').options[3]=new Option("양면유광써멀코팅","COT40",false);
$('coating_type').options[4]=new Option("양면무광써멀코팅","COT50",false);
$('coating_type').options[5]=new Option("양면러버코팅","COT41",false);
if(this_coating_type=='COT30'||this_coating_type=='COT60'){
this_coating_type='COT10'
}

}
else{
$('coating_type').options[0]=new Option("단면유광써멀코팅","COT10",false);
$('coating_type').options[1]=new Option("단면무광써멀코팅","COT20",false);
$('coating_type').options[2]=new Option("단면uv코팅","COT30",false);
$('coating_type').options[3]=new Option("단면러버코팅","COT31",false);
$('coating_type').options[4]=new Option("양면유광써멀코팅","COT40",false);
$('coating_type').options[5]=new Option("양면무광써멀코팅","COT50",false);
$('coating_type').options[6]=new Option("양면러버코팅","COT41",false);
if(paper_weight>this.IS_COATING_PAPER_WEIGHT){
$('coating_type').options[7]=new Option("양면uv코팅","COT60",false)
}

}
this.thisPositionSelectOptions("coating_type",this_coating_type);
this.checkMsg("coating","","")
}
else{
$('coating_type').options[0]=new Option("코팅없음","",false);
this.setCoatingPrice(0);
this.checkMsg("coating","코팅이 가능한 평량은 150g 이상이어야 합니다.","paper_code")
}
if(this.getIsPPNumbering()=="1"&&$('numbering_type').disabled==false){
$('numbering_type').disabled=true;
$('numbering_num').disabled=true;
this.checkMsg("numbering","코팅을 할 경우 넘버링이 불가능합니다.","numbering_type");
this.setNumberingPrice(0)
}

}
,calcuCoatingPrice:function(){
if(this.getIsPPCoating()){
this.settingCoatingType()
}
coating_type=this.getCoatingType();
if(this.getIsPPCoating()&&coating_type!=""){
paper_yeon_qty=this.getPaperYeonQty();
if(paper_yeon_qty<=0.9){
paper_yeon_qty=paper_yeon_qty+0.1
}
this.getCoatingPriceUnit();
coating_price=Math.max((this.unit_price*paper_yeon_qty),this.min_price);
coating_price=Math.ceil(coating_price/100)*100;
this.setCoatingPrice(coating_price)
}
else{
this.setCoatingPrice(0)
}

}
,getCoatingPriceUnit:function(){
coating_type=this.getCoatingType();
size_type_section_code=this.getSizeTypeSectionCode();
var pp_coating_info=jsonPath(ppCoatingJsonOBJ,"$.pp_coating_info[?(@.code=='"+coating_type+"')]");
if(size_type_section_code=="PTK10"){
this.unit_price=parseInt(pp_coating_info[0].unit_price1);
this.min_price=parseInt(pp_coating_info[0].min_price1)
}
else{
this.unit_price=parseInt(pp_coating_info[0].unit_price2);
this.min_price=parseInt(pp_coating_info[0].min_price2)
}

}

}
);
var ppDomusong=Class.create(Postpress,{
initialize:function($super){
$super();
this.DOMUSONG_MIN_PRICE=30000;
this.DOMUSONG_BASIC_PRICE=5000;
this.DOMUSONG_MIN_QTY=1000;
this.save_domusong_type=$('save_domusong_type').value;
this.save_domusong_num=$('save_domusong_num').value
}
,dataLoad:function(){
new Ajax.Request('/estimate/estimate_goods/pp_domusong_json_data',{
asynchronous:false,method:"post",parameters:{
"t":timestamp,"category_code":this.getCategoryCode()
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
,getDomusongType:function(){
if($('domusong_type').value==""){
return this.save_domusong_type
}
else{
return $('domusong_type').value
}

}
,getDomusongNum:function(){
if($('domusong_num').value==""){
return this.save_domusong_num
}
else{
return $('domusong_num').value
}

}
,setMoghyeongPrice:function(price){
$('moghyeong_amt').value=price
}
,setDomusongPrice:function(price){
$('domusong_amt').value=price
}
,getDomusongPrice:function(){
return $('domusong_amt').value
}
,getDomusongFinishing:function(){
if($('domusong_finishing').value==""){
return $('save_domusong_finishing').value
}
else{
return $('domusong_finishing').value
}

}
,getIsPPDomusong:function(){
if($('chk_is_domusong').checked==true){
return true
}
else{
return false
}

}
,settingDomusongType:function(){
this_domusong_section=this.getDomusongSection();
this_domusong_type=this.getDomusongType();
this.initSelectOptions('domusong_type');
$('domusong_type').options[0]=new Option("A형-원,사각","DMT10",false);
$('domusong_type').options[1]=new Option("B형-꼭지점6개이하","DMT20",false);
$('domusong_type').options[2]=new Option("C형-2단홀더,봉투","DMT30",false);
$('domusong_type').options[3]=new Option("D형-3단홀더","DMT40",false);
$('domusong_type').options[4]=new Option("E형-박스","DMT50",false);
this.thisPositionSelectOptions("domusong_type",this_domusong_type);
this_domusong_num=this.getDomusongNum();
this.initSelectOptions('domusong_num');
$('domusong_num').options[0]=new Option("1개","1",false);
$('domusong_num').options[1]=new Option("2개","2",false);
$('domusong_num').options[2]=new Option("3개","3",false);
$('domusong_num').options[3]=new Option("4개","4",false);
$('domusong_num').options[4]=new Option("5개","5",false);
$('domusong_num').options[5]=new Option("6개","6",false);
$('domusong_num').options[6]=new Option("7개","7",false);
$('domusong_num').options[7]=new Option("8개","8",false);
$('domusong_num').options[8]=new Option("9개","9",false);
$('domusong_num').options[9]=new Option("10개","10",false);
$('domusong_num').options[10]=new Option("11개","11",false);
$('domusong_num').options[11]=new Option("12개","12",false);
$('domusong_num').options[12]=new Option("13개","13",false);
$('domusong_num').options[13]=new Option("14개","14",false);
$('domusong_num').options[14]=new Option("15개","15",false);
this.thisPositionSelectOptions("domusong_num",this_domusong_num);
var domusong_finishing=this.getDomusongFinishing();
this.initSelectOptions('domusong_finishing');
if(domusong_type==''||domusong_type=='DMT10'||domusong_type=='DMT20'){
$('domusong_finishing').options[0]=new Option("도무송후 여백종이 제거","DMF10",false);
$('domusong_finishing').options[1]=new Option("도무송후 여백종이 제거안함","DMF20",false);
this.thisPositionSelectOptions("domusong_finishing",domusong_finishing);
$('domusong_finishing').show()
}
else{
$('domusong_finishing').options[0]=new Option("도무송후 여백종이 제거","DMF10",false);
$('domusong_finishing').options[0].selected=true;
$('domusong_finishing').hide()
}

}
,calcuDomusongPrice:function(){
domusong_section=this.getDomusongSection();
domusong_type=this.getDomusongType();
if(this.getIsPPDomusong()&&domusong_section!='DMS30'){
this.settingDomusongType()
}
if(this.getIsPPDomusong()&&domusong_section!=""){
paper_yeon_qty=this.getPaperYeonQty();
paper_qty=this.getPaperQty();
extra_rate=this.getDomusongExtraRate();
qty_unit=Math.max(paper_yeon_qty,1);
domusong_finishing=this.getDomusongFinishing();
domusong_num=this.getDomusongNum();
cut_x_size=this.getCutXSize();
cut_y_size=this.getCutYSize();
max_size=Math.max(cut_x_size,cut_y_size);
unit_price=this.getDomusongPriceUnit();
mock_price=this.getDomusongMockPrice();
domusong_basic_unit=Math.max(max_size/20,15);
 domusong_qty_unit=Math.min((domusong_num-1)*0.2+1,1.5);
domusong_unit=domusong_basic_unit*domusong_qty_unit;
domusong_unit_price=domusong_unit*Math.max(paper_qty,this.DOMUSONG_MIN_QTY);
domusong_unit_price=Math.ceil((domusong_unit_price+5000)/1000)*1000;
domusong_min_unit_price=0;
if(domusong_type=='DMT10'){
domusong_min_unit_price=30000
}
else if(domusong_type=='DMT20'){
domusong_min_unit_price=30000
}
else if(domusong_type=='DMT30'){
domusong_min_unit_price=35000
}
else if(domusong_type=='DMT40'){
domusong_min_unit_price=40000
}
else if(domusong_type=='DMT50'){
domusong_min_unit_price=50000
}
domusong_unit_price=Math.max(domusong_unit_price,(domusong_min_unit_price+5000));
mock_price=mock_price;
if(domusong_finishing=="DMF10"){
finishing_price=this.getDomusongFinishingPrice()
}
else{
finishing_price=0
}
domusong_price=domusong_unit_price+mock_price+finishing_price;
this.setDomusongPrice(domusong_price);
this.setMoghyeongPrice(mock_price);
this.checkMsg("domusong","","")
}
else{
this.setDomusongPrice(0);
this.setMoghyeongPrice(0);
this.checkMsg("domusong","","")
}

}
,getDomusongPriceUnit:function(){
domusong_num=this.getDomusongNum();
paper_size=this.getPaperSize();
domusong_section=this.getDomusongSection();
var pp_domusong_info=jsonPath(ppDomusongJsonOBJ,"$.pp_domusong_info[?(@.num=='"+domusong_num+"')][?(@.paper_size=='"+paper_size+"')]");
if(pp_domusong_info){
unit_price=parseInt(pp_domusong_info[0].unit_price)
}
else{
unit_price=0
}
if(pp_domusong_info){
return unit_price
}
else{
return 0
}

}
,getDomusongMockPrice:function(){
domusong_section=this.getDomusongSection();
domusong_type=this.getDomusongType();
cut_x_size=this.getCutXSize();
cut_y_size=this.getCutYSize();
var paper_qty=this.getPaperQty();
var order_count=parseInt($('order_count').value);
max_size=Math.max(cut_x_size,cut_y_size);
if(max_size<200){
ref_key=1
}
else if(max_size>=200&&max_size<300){
ref_key=200
}
else if(max_size>=300&&max_size<400){
ref_key=300
}
else if(max_size>=400&&max_size<500){
ref_key=400
}
else if(max_size>=500&&max_size<600){
ref_key=500
}
else if(max_size>=600&&max_size<700){
ref_key=600
}
else if(max_size>=700&&max_size<800){
ref_key=700
}
else if(max_size>=800&&max_size<900){
ref_key=800
}
else if(max_size>=900&&max_size<1000){
ref_key=900
}
else{
ref_key=1000
}
if(domusong_type=="DMT10"){
mock_type_rate=0.4
}
else if(domusong_type=="DMT20"){
mock_type_rate=0.4
}
else if(domusong_type=="DMT30"){
mock_type_rate=0.4
}
else if(domusong_type=="DMT40"){
mock_type_rate=0.6
}
else if(domusong_type=="DMT50"){
mock_type_rate=0.6
}
else{
mock_type_rate=0.4
}
mock_rate=mock_type_rate*(domusong_num-1)+1;
var pp_domusong_mock=jsonPath(ppDomusongJsonOBJ,"$.pp_domusong_mock[?(@.ref_key=='"+ref_key+"' && @.type=='"+domusong_type+"')]");
if(domusong_section=="DMS20"){
mock_price=parseInt(pp_domusong_mock[0].unit_cost);
mock_paper_qty_rate=Math.ceil(Math.min((paper_qty/500),25)*(mock_price/30)/100)*100;
mock_order_count_rate=0;
mock_price=mock_price*mock_rate+mock_paper_qty_rate+mock_order_count_rate
}
else{
mock_price=0
}
mock_price=Math.round(mock_price/1000)*1000;
return mock_price
}
,getDomusongFinishingPrice:function(){
paper_qty=this.getPaperQty();
domusong_num=this.getDomusongNum();
cut_x_size=this.getCutXSize();
cut_y_size=this.getCutYSize();
max_size=Math.max(cut_x_size,cut_y_size);
if(domusong_num==1){
domusong_num_rate=1
}
else if(domusong_num==2){
domusong_num_rate=0.8
}
else if(domusong_num==3){
domusong_num_rate=0.76
}
else if(domusong_num==4){
domusong_num_rate=0.72
}
else if(domusong_num==5){
domusong_num_rate=0.68
}
else if(domusong_num==6){
domusong_num_rate=0.64
}
else if(domusong_num>=7){
domusong_num_rate=0.6
}
else{
domusong_num_rate=1
}
domusong_finishing_rate=Math.max((max_size/60),2);
domusong_finishing_rate=Math.round(domusong_finishing_rate*100)/100;
domusong_finishing_unit=domusong_finishing_rate*domusong_num*domusong_num_rate;
domusong_finishing_price=Math.ceil((paper_qty*domusong_finishing_unit)/1000)*1000;
return domusong_finishing_price
}
,getDomusongExtraRate:function(){
domusong_type=this.getDomusongType();
var extraRate=1;
if(domusong_type=="DMT10"){
extraRate=1
}
else if(domusong_type=="DMT20"){
extraRate=1.2
}
else if(domusong_type=="DMT30"){
extraRate=1.5
}
else if(domusong_type=="DMT40"){
extraRate=1.7
}
else if(domusong_type=="DMT50"){
extraRate=1.7
}
return parseFloat(extraRate)
}

}
);
var ppBak=Class.create(Postpress,{
initialize:function($super,seq){
$super();
this.seq=0;
this.min_price=0;
this.min_unit=0
}
,dataLoad:function(){
new Ajax.Request('/estimate/estimate_goods/pp_bak_json_data',{
asynchronous:false,method:"post",parameters:{
"t":timestamp,"category_code":this.getCategoryCode()
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
,getBakType:function(){
return $('bak_type_'+this.seq).value
}
,getBakXSize:function(){
return $('bak_x_size_'+this.seq).value
}
,getBakYSize:function(){
return $('bak_y_size_'+this.seq).value
}
,setDongpanPrice:function(price){
$('etc1_'+this.seq).value=price
}
,setBakPrice:function(price){
$('bak_amt_'+this.seq).value=price
}
,getBakPrice:function(){
return $('bak_amt_'+this.seq).value
}
,getIsPPBak:function(){
if($('chk_is_bak').checked==true){
return true
}
else{
return false
}

}
,checkPrintSize:function(){
cut_x_size=this.getCutXSize();
cut_y_size=this.getCutYSize();
max_size=Math.max(cut_x_size,cut_y_size);
min_size=Math.min(cut_x_size,cut_y_size);
if(max_size<=780&&min_size<=530&&(max_size/min_size)<=5){
return true
}
else{
return false
}

}
,checkBakSize:function(){

}
,settingBakType:function(){
this_bak_section=this.getBakSection()
}
,calcuBakPrice:function(){
if(this.getIsPPBak()){
this.settingBakType();
if(this.checkPrintSize()){
var bak_section=this.getBakSection();
var bak_side=this.getBakSide();
var bak_x_size=this.getBakXSize();
var bak_y_size=this.getBakYSize();
var paper_weight=this.getPaperWeight();
var cut_x_size=this.getCutXSize();
var cut_y_size=this.getCutYSize();
if(this.getIsPPBak()&&bak_section!=""&&bak_x_size>0&&bak_y_size>0){
if(paper_weight>=120){
if((cut_x_size>=bak_x_size&&bak_x_size<=500)&&(cut_y_size>=bak_y_size&&bak_y_size<=500)){
work_price=this.getBakWorkPrice();
material_price=this.getBakMaterialPrice();
add_price=this.getBakAddPrice();
if(bak_section=="BKS10"){
dongpan_price=this.getDongpanPrice()
}
else{
dongpan_price=0
}
if(bak_side=="BKD30"){
bak_side_unit=2
}
else{
bak_side_unit=1
}
work_price=work_price+20000;
bak_price=(work_price+material_price+add_price)*bak_side_unit+dongpan_price;
this.setBakPrice(bak_price);
this.setDongpanPrice(dongpan_price);
this.checkMsg("bak","","");
$('bak_section_1').disabled=false;
$('bak_section_2').disabled=false;
$('bak_section_3').disabled=false;
$('bak_side_1').disabled=false;
$('bak_side_2').disabled=false;
$('bak_side_3').disabled=false;
$('bak_type_1').disabled=false;
$('bak_type_2').disabled=false;
$('bak_type_3').disabled=false
}
else{
this.setBakPrice(0);
this.setDongpanPrice(0);
alert('박 규격은 용지 규격보다 작아야 합니다. 최대크기(500mm)');
$('bak_section_1').disabled=true;
$('bak_section_2').disabled=true;
$('bak_section_3').disabled=true;
$('bak_side_1').disabled=true;
$('bak_side_2').disabled=true;
$('bak_side_3').disabled=true;
$('bak_type_1').disabled=true;
$('bak_type_2').disabled=true;
$('bak_type_3').disabled=true
}

}
else{
this.setBakPrice(0);
this.setDongpanPrice(0);
this.checkMsg("bak","용지평량이 120g 이하이면 박이 불가능합니다.","paper_code");
alert('용지평량이 120g 이하이면 박이 불가능합니다.');
$('bak_section_1').disabled=true;
$('bak_section_2').disabled=true;
$('bak_section_3').disabled=true;
$('bak_side_1').disabled=true;
$('bak_side_2').disabled=true;
$('bak_side_3').disabled=true;
$('bak_type_1').disabled=true;
$('bak_type_2').disabled=true;
$('bak_type_3').disabled=true
}

}
else{
this.setBakPrice(0);
this.setDongpanPrice(0);
this.checkMsg("bak","","");
$('bak_section_1').disabled=false;
$('bak_section_2').disabled=false;
$('bak_section_3').disabled=false;
$('bak_side_1').disabled=false;
$('bak_side_2').disabled=false;
$('bak_side_3').disabled=false;
$('bak_type_1').disabled=false;
$('bak_type_2').disabled=false;
$('bak_type_3').disabled=false
}

}
else{
this.setBakPrice(0);
this.setDongpanPrice(0);
this.checkMsg("bak","해당 규격은 박이 불가능합니다.","paper_size");
alert('해당 규격은 박이 불가능합니다.');
$('bak_section_1').disabled=true;
$('bak_section_2').disabled=true;
$('bak_section_3').disabled=true;
$('bak_side_1').disabled=true;
$('bak_side_2').disabled=true;
$('bak_side_3').disabled=true;
$('bak_type_1').disabled=true;
$('bak_type_2').disabled=true;
$('bak_type_3').disabled=true
}

}
else{
this.setBakPrice(0);
this.setDongpanPrice(0);
this.checkMsg("bak","","");
$('bak_section_1').disabled=false;
$('bak_section_2').disabled=false;
$('bak_section_3').disabled=false;
$('bak_side_1').disabled=false;
$('bak_side_2').disabled=false;
$('bak_side_3').disabled=false;
$('bak_type_1').disabled=false;
$('bak_type_2').disabled=false;
$('bak_type_3').disabled=false;
$('bak_x_size_1').disabled=false;
$('bak_y_size_1').disabled=false;
$('bak_x_size_2').disabled=false;
$('bak_y_size_2').disabled=false;
$('bak_x_size_3').disabled=false;
$('bak_y_size_3').disabled=false
}

}
,getBakAddPrice:function(){
bak_x_size=parseInt(this.getBakXSize());
bak_y_size=parseInt(this.getBakYSize());
bak_max_size=Math.max(bak_x_size,bak_y_size);
add_price=(bak_max_size-100)*100;
add_price=Math.ceil(add_price/1000)*1000;
if(add_price<0){
add_price=0
}
return add_price
}
,getBakWorkPrice:function(){
paper_qty=this.getPaperQty();
bak_price_unit=this.getBakPriceUnit();
cut_x_size=this.getCutXSize();
cut_y_size=this.getCutYSize();
cut_max_size=Math.max(cut_x_size,cut_y_size);
cut_min_size=Math.min(cut_x_size,cut_y_size);
if(cut_max_size<=310&&cut_min_size<=225){
bak_paper_rate=1
}
else{
bak_paper_rate=2
}
bak_qty_rate=Math.max((1-(paper_qty/30000)),1);
work_price1=bak_price_unit*paper_qty;
work_price2=cut_max_size*100*bak_paper_rate;
work_price=Math.max(work_price1,work_price2*bak_qty_rate)*bak_qty_rate;
work_price=Math.ceil(work_price/1000)*1000;
return work_price
}
,getBakPriceUnit:function(){
paper_size=this.getPaperSize();
bak_section=this.getBakSection();
paper_qty=this.getPaperQty();
cut_x_size=this.getCutXSize();
cut_y_size=this.getCutYSize();
cut_max_size=parseInt(Math.max(cut_x_size,cut_y_size));
cut_min_size=parseInt(Math.min(cut_x_size,cut_y_size));
if(cut_max_size<=310&&cut_min_size<=225){
work_size_rate=1
}
else{
work_size_rate=1.2
}
var bak_work_unit=Math.max((cut_max_size*0.12),17)*work_size_rate;
return bak_work_unit
}
,getBakMaterialPrice:function(){
bak_type=this.getBakType();
bak_x_size=parseInt(this.getBakXSize());
bak_y_size=parseInt(this.getBakYSize());
paper_qty=parseInt(this.getPaperQty());
var pp_bak_info=jsonPath(ppBakJsonOBJ,"$.pp_bak_info[?(@.type=='material_unit')][?(@.bak_type=='"+bak_type+"')]");
var material_unit=parseInt(pp_bak_info[0].material_unit2)*1.2;
var film_unit=((bak_x_size+30)*(bak_y_size+30)*material_unit)/100000000;
var film_price=film_unit*paper_qty;
film_price=Math.ceil(film_price/1000)*1000;
return film_price
}
,getDongpanPrice:function(){
bak_type=this.getBakType();
bak_x_size=parseInt(this.getBakXSize());
bak_y_size=parseInt(this.getBakYSize());
price1=((bak_x_size+10)*(bak_y_size+10))*1.6;
price2=5000;
dongpan_price=Math.max(price1,price2);
dongpan_price=Math.ceil(dongpan_price/1000)*1000;
bak_section=this.getBakSection();
if(bak_section=='BKS20'){
dongpan_price=0
}
this.outputDebugMsg("[getDongpanPrice]dongpan_price:"+dongpan_price);
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
"t":timestamp,"category_code":this.getCategoryCode()
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
,setAPDongpanPrice:function(price){
$('ap_dongpan_amt_'+this.seq).value=price
}
,setAPPrice:function(price){
$('ap_amt_'+this.seq).value=price
}
,getAPPrice:function(){
return $('ap_amt_'+this.seq).value
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
,checkApSize:function(){
ap_x_size=this.getAPXSize();
ap_y_size=this.getAPYSize();
cut_x_size=this.getCutXSize();
cut_y_size=this.getCutYSize();
ap_max_size=Math.max(ap_x_size,ap_y_size);
ap_min_size=Math.min(ap_x_size,ap_y_size);
var paper_weight=this.getPaperWeight();
var result=true;
if(paper_weight<=119){
result=false
}
else{
if(ap_max_size<=630&&ap_min_size<=460&&ap_x_size<=cut_x_size&&ap_y_size<=cut_y_size){
result=true
}
else{
result=false
}

}
return result
}
,checkPrintSize:function(){
cut_x_size=this.getCutXSize();
cut_y_size=this.getCutYSize();
max_size=Math.max(cut_x_size,cut_y_size);
min_size=Math.min(cut_x_size,cut_y_size);
if(max_size<=630&&min_size<=460&&(max_size/min_size)<=3){
return true
}
else{
return false
}

}
,calcuAPPrice:function(){
if(this.getIsPPAP()){
this.settingAPType()
}
ap_section=this.getAPSection();
ap_x_size=this.getAPXSize();
ap_y_size=this.getAPYSize();
this_check_print_size=this.checkPrintSize();
if(this_check_print_size==false){
this.checkMsg("ap","해당 규격은 형압이 불가능합니다.","paper_size");
this.setAPPrice(0);
this.setAPDongpanPrice(0);
$('ap_section_1').disabled=true;
$('ap_section_2').disabled=true;
$('ap_section_3').disabled=true;
$('ap_type_1').disabled=true;
$('ap_type_2').disabled=true;
$('ap_type_3').disabled=true;
$('ap_x_size_1').disabled=true;
$('ap_y_size_1').disabled=true;
$('ap_x_size_2').disabled=true;
$('ap_y_size_2').disabled=true;
$('ap_x_size_3').disabled=true;
$('ap_y_size_3').disabled=true;
return
}
if(this.getIsPPAP()&&ap_section!=""&&ap_x_size>0&&ap_y_size>0){
if(this.checkApSize()){
ap_work_price=this.getAPWorkPrice();
if(ap_section=="APS10"){
dongpan_price=this.getDongpanPrice()
}
else{
dongpan_price=0
}
suji_price=this.getAPSujiPrice();
ap_work_price=ap_work_price+20000;
ap_price=ap_work_price+dongpan_price+suji_price;
this.setAPPrice(ap_price);
this.setAPDongpanPrice(dongpan_price);
this.checkMsg("ap","","");
$('ap_section_1').disabled=false;
$('ap_section_2').disabled=false;
$('ap_section_3').disabled=false;
$('ap_type_1').disabled=false;
$('ap_type_2').disabled=false;
$('ap_type_3').disabled=false;
$('ap_x_size_1').disabled=false;
$('ap_y_size_1').disabled=false;
$('ap_x_size_2').disabled=false;
$('ap_y_size_2').disabled=false;
$('ap_x_size_3').disabled=false;
$('ap_y_size_3').disabled=false
}
else{
this.setAPPrice(0);
this.setAPDongpanPrice(0);
this.checkMsg("ap","형압 규격은 용지 규격보다 작아야 합니다.<br>형압 최대크기(500mm)입니다.","paper_size");
$('ap_section_1').disabled=true;
$('ap_section_2').disabled=true;
$('ap_section_3').disabled=true;
$('ap_type_1').disabled=true;
$('ap_type_2').disabled=true;
$('ap_type_3').disabled=true;
$('ap_x_size_1').disabled=true;
$('ap_y_size_1').disabled=true;
$('ap_x_size_2').disabled=true;
$('ap_y_size_2').disabled=true;
$('ap_x_size_3').disabled=true;
$('ap_y_size_3').disabled=true
}

}
else{
this.setAPPrice(0);
this.setAPDongpanPrice(0);
this.checkMsg("ap","","");
$('ap_section_1').disabled=false;
$('ap_section_2').disabled=false;
$('ap_section_3').disabled=false;
$('ap_type_1').disabled=false;
$('ap_type_2').disabled=false;
$('ap_type_3').disabled=false;
$('ap_x_size_1').disabled=false;
$('ap_y_size_1').disabled=false;
$('ap_x_size_2').disabled=false;
$('ap_y_size_2').disabled=false;
$('ap_x_size_3').disabled=false;
$('ap_y_size_3').disabled=false
}

}
,getAPWorkPrice:function(){
cut_x_size=this.getCutXSize();
cut_y_size=this.getCutYSize();
paper_qty=this.getPaperQty();
ap_add_price=this.getAPAddPrice();
cut_max_size=parseInt(Math.max(cut_x_size,cut_y_size));
cut_min_size=parseInt(Math.min(cut_x_size,cut_y_size));
if(cut_max_size<=310&&cut_min_size<=225){
ap_work_rate=1
}
else{
ap_work_rate=2
}
ap_work_unit=Math.max((cut_max_size*0.13),17)*ap_work_rate;
ap_qty_rate=Math.max((1-(paper_qty/30000)),1);
ap_work_price=(ap_work_unit*paper_qty*ap_qty_rate);
ap_work_price=Math.ceil(ap_work_price/1000)*1000;
ap_work_price=ap_work_price+ap_add_price;
ap_min_price=Math.ceil((cut_max_size*90*ap_work_rate)/1000)*1000;
 ap_work_price=Math.max(ap_work_price,ap_min_price);
return ap_work_price
}
,getAPAddPrice:function(){
ap_x_size=this.getAPXSize();
ap_y_size=this.getAPYSize();
ap_max_size=Math.max(ap_x_size,ap_y_size);
add_price=(ap_max_size-100)*100;
add_price=Math.ceil(add_price/1000)*1000;
if(add_price<0){
add_price=0
}
return add_price
}
,getAPSujiPrice:function(){
ap_x_size=parseInt(this.getAPXSize());
ap_y_size=parseInt(this.getAPYSize());
price1=((ap_x_size+10)*(ap_y_size+10))*1;
price2=5000;
suji_price=Math.max(price1,price2);
suji_price=Math.ceil(suji_price/1000)*1000;
return suji_price
}
,getAPPriceUnit:function(){
paper_size=this.getPaperSize();
var pp_ap_info=jsonPath(ppApJsonOBJ,"$.pp_ap_info[?(@.paper_size=='"+paper_size+"')]");
if(pp_ap_info){
this.min_price=parseInt(pp_ap_info[0].min_price);
this.min_unit=parseInt(pp_ap_info[0].min_unit)
}
else{

}
this.outputDebugMsg("[getAPPriceUnit]min_price:"+this.min_price+",min_unit:"+this.min_unit)
}
,getDongpanPrice:function(){
ap_x_size=parseInt(this.getAPXSize());
ap_y_size=parseInt(this.getAPYSize());
price1=((ap_x_size+10)*(ap_y_size+10))*1.6;
price2=5000;
dongpan_price=Math.max(price1,price2);
dongpan_price=Math.ceil(dongpan_price/1000)*1000;
this_ap_section=this.getAPSection();
if(this_ap_section=='APS20'){
dongpan_price=0
}
this.outputDebugMsg("[getDongpanPrice]dongpan_price:"+dongpan_price);
return dongpan_price
}

}
);
var ppNumbering=Class.create(Postpress,{
initialize:function($super){
$super()
}
,getNumberingType:function(){
return $('numbering_type').value
}
,getNumberingNum:function(){
return parseInt($('numbering_num').value)
}
,setNumberingPrice:function(price){
$('numbering_amt').value=price
}
,getNumberingPrice:function(){
return $('numbering_amt').value
}
,getIsPPCoating:function(){
if($('chk_is_coating').checked==true){
return true
}
else{
return false
}

}
,getIsPPLaminex:function(){
if($('chk_is_laminex').checked==true){
return true
}
else{
return false
}

}
,getIsPPNumbering:function(){
if($('chk_is_numbering').checked==true){
return true
}
else{
return false
}

}
,getNumberingStart:function(){
return $('numbering_start').value
}
,getNumberingEnd:function(){
return $('numbering_end').value
}
,getPaperWeight:function(){
return parseInt($('paper_weight').value)
}
,checkCutSize:function(){
var cut_x_size=this.getCutXSize();
var cut_y_size=this.getCutYSize();
max_size=Math.max(cut_x_size,cut_y_size);
min_size=Math.min(cut_x_size,cut_y_size);
if(max_size>=100&&max_size<=297&&min_size>=50&&min_size<=210){
is_cut_size=true
}
else{
is_cut_size=false
}
return is_cut_size
}
,checkNumber:function(){
$j('#numbering_end').css('background','#CCCCCC');
paper_qty=$('paper_qty').value;
numbering_start=Number($('numbering_start').value);
numbering_start2=Number($('numbering_start2').value);
if(numbering_start=='0'){
numbering_start=1
}
if($('chk_is_numbering').checked==true){
if($('numbering_start').value=='0'||$('numbering_start').value=='00'||$('numbering_start').value=='000'||$('numbering_start').value=='0000'||$('numbering_start').value=='00000'||$('numbering_start').value=='000000'||$('numbering_start').value==''){
alert("넘버링 최소 시작번호는 1입니다.");
$('numbering_start').value='000001'
}
else if(numbering_start==''){
alert("넘버링 시작번호를 입력해주세요.");
$('numbering_start').value='000001'
}
else{
if(category_code=='CLF1000'||category_code=='CLF3000'||category_code=="CLF4000"||category_code=="CLF5000"){
var numbering_end=paper_qty*0.9+numbering_start-1
}
else{
var numbering_end=paper_qty*1+numbering_start-1
}
var numbering_start_length=(numbering_start+"").length;
var new_numbering_start='';
if(numbering_start_length=='1'){
new_numbering_start='00000'
}
else if(numbering_start_length=='2'){
new_numbering_start='0000'
}
else if(numbering_start_length=='3'){
new_numbering_start='000'
}
else if(numbering_start_length=='4'){
new_numbering_start='00'
}
else if(numbering_start_length=='5'){
new_numbering_start='0'
}
$('numbering_start').value=new_numbering_start+numbering_start;
$('numbering_start2').value=numbering_start;
var numbering_end_length=(numbering_end+"").length;
var new_numbering_end='';
if(numbering_end_length=='1'){
new_numbering_end='00000'
}
else if(numbering_end_length=='2'){
new_numbering_end='0000'
}
else if(numbering_end_length=='3'){
new_numbering_end='000'
}
else if(numbering_end_length=='4'){
new_numbering_end='00'
}
else if(numbering_end_length=='5'){
new_numbering_end='0'
}
$('numbering_end').value=new_numbering_end+numbering_end;
$('numbering_end2').value=numbering_end;
if(category_code=='CLF1000'||category_code=='CLF3000'||category_code=="CLF4000"||category_code=="CLF5000"){
$('span_numbering_end').innerHTML=paper_qty*0.9
}
else{
$('span_numbering_end').innerHTML=paper_qty
}

}

}
return true
}
,calcuNumberingPrice:function(){
numbering_num=this.getNumberingNum();
if(this.getIsPPNumbering()&&this.checkNumber()&&numbering_num>0){
if(this.checkCutSize()){
paper_qty=this.getPaperQty();
paper_yeon_qty=this.getPaperYeonQty();
if(numbering_num=="1"){
numbering_extra_rate=1
}
else if(numbering_num=="2"){
numbering_extra_rate=1.4
}
else{
numbering_extra_rate=1
}
if(category_code=='CLF1000'||category_code=='CLF3000'||category_code=="CLF4000"||category_code=="CLF5000"){
numbering_extra_rate=numbering_extra_rate*2.2
}
qty_unit_price1=paper_qty*numbering_extra_rate*3.5+70000;
qty_unit_price2=paper_yeon_qty*75000*numbering_extra_rate;
qty_unit_price=Math.max(qty_unit_price1,qty_unit_price2);
if(paper_yeon_qty<0.4){
yeon_min_price=70000
}
else{
yeon_min_price=80000
}
if(paper_yeon_qty>1){
add_price=30000
}
else{
add_price=0
}
sale_rate=Math.max((1-(paper_yeon_qty/20)),0.7);
numbering_price=Math.max(qty_unit_price,yeon_min_price)+add_price;
numbering_price=numbering_price*sale_rate;
numbering_price=Math.ceil(numbering_price/10000)*10000;
this.setNumberingPrice(numbering_price);
$('numbering_type').disabled=false;
$('numbering_num').disabled=false;
this.checkMsg("numbering","","");
this.outputDebugMsg("[calcuNumberingPrice]numbering_price:"+numbering_price+",qty_unit_price:"+qty_unit_price+",yeon_min_price:"+yeon_min_price+",add_price:"+add_price)
}
else{
$('numbering_type').disabled=true;
$('numbering_num').disabled=true;
this.checkMsg("numbering","해당 사이즈는 넘버링이 불가능합니다.","paper_size");
alert('해당 사이즈는 넘버링이 불가능합니다.');
this.setNumberingPrice(0)
}
if(this.getIsPPCoating()=="1"){
$('numbering_type').disabled=true;
$('numbering_num').disabled=true;
this.checkMsg("numbering","코팅을 할 경우 넘버링이 불가능합니다.","coating_type");
this.setNumberingPrice(0)
}
else{
$('numbering_type').disabled=false;
$('numbering_num').disabled=false;
this.checkMsg("numbering","","")
}
if(this.getIsPPLaminex()=="1"){
$('numbering_type').disabled=true;
$('numbering_num').disabled=true;
this.checkMsg("numbering","라미넥스를 할 경우 넘버링이 불가능합니다.","laminex_num");
this.setNumberingPrice(0)
}
else{
$('numbering_type').disabled=false;
$('numbering_num').disabled=false;
this.checkMsg("numbering","","")
}
if(this.getPaperWeight()>=200){
$('numbering_type').disabled=true;
$('numbering_num').disabled=true;
this.checkMsg("numbering","용지평량이 200g 이상이면 넘버링이 불가능합니다.","paper_code");
this.setNumberingPrice(0)
}
else{
$('numbering_type').disabled=false;
$('numbering_num').disabled=false;
this.checkMsg("numbering","","")
}

}
else{
this.setNumberingPrice(0);
this.outputDebugMsg("[calcuNumberingPrice]numbering_price:0")
}

}

}
);
var ppTagong=Class.create(Postpress,{
initialize:function($super){
$super();
this.TAGONG_MIN_PRICE=10000
}
,dataLoad:function(){
new Ajax.Request('/estimate/estimate_goods/pp_tagong_json_data',{
asynchronous:false,method:"post",parameters:{
"t":timestamp,"category_code":this.getCategoryCode()
}
,onSuccess:function(jsonData){
ppTagongJsonOBJ=jsonData.responseText.evalJSON(true)
}
,onFailure:function(){
alert('Loading Failed for tagong Json Data')
}

}
)
}
,getTagongSize:function(){
return $('tagong_size').value
}
,getTagongNum:function(){
return parseInt($('tagong_num').value)
}
,setTagongPrice:function(price){
$('tagong_amt').value=price
}
,getTagongPrice:function(){
return $('tagong_amt').value
}
,getIsPPTagong:function(){
if($('chk_is_tagong').checked==true){
return true
}
else{
return false
}

}
,getIsPPCutting:function(){
if($('chk_is_cutting').checked==true){
return true
}
else{
return false
}

}
,calcuTagongPrice:function(){
cut_x_size=this.getCutXSize();
cut_y_size=this.getCutYSize();
cut_max_size=Math.max(cut_x_size,cut_y_size);
if(this.getIsPPCutting()||cut_max_size>=350){
this.setTagongPrice(0);
this.disableTagongOption();
if(this.getIsPPCutting()){
alert('추가재단이 있을 경우 별도견적 문의하세요.')
}
else if(cut_max_size>=350){
alert('해당 규격은 타공이 불가능합니다.')
}

}
else{
this.enabledTagongOption();
tagong_num=this.getTagongNum();
if(this.getIsPPTagong()&&tagong_num>0){
paper_qty=this.getPaperQty();
paper_yeon_qty=this.getPaperYeonQty();
paper_weight=this.getPaperWeight();
tagong_extra_rate=Math.max((paper_weight/150),1);
this.getTagongPriceUnit();
if(this.unit_price>0){
tagong_yeon_price=(this.unit_price*paper_yeon_qty*tagong_extra_rate)+5000;
tagong_qty_price=(paper_qty*tagong_num*1.5*tagong_extra_rate)+5000;
tagong_price=Math.max(tagong_yeon_price,tagong_qty_price);
tagong_price=Math.ceil(tagong_price/1000)*1000;
this.setTagongPrice(tagong_price)
}
else{
this.setTagongPrice(0)
}

}
else{
this.setTagongPrice(0)
}

}

}
,enabledTagongOption:function(){
$('tagong_num').disabled=false;
$('tagong_size').disabled=false
}
,disableTagongOption:function(){
$('tagong_num').disabled=true;
$('tagong_size').disabled=true
}
,getTagongPriceUnit:function(){
tagong_num=this.getTagongNum();
paper_size=this.getPaperSize();
if(tagong_num>0){
var pp_tagong_info=jsonPath(ppTagongJsonOBJ,"$.pp_tagong_info[?(@.num=='"+tagong_num+"')][?(@.paper_size=='"+paper_size+"')]");
if(pp_tagong_info){
this.unit_price=parseInt(pp_tagong_info[0].unit_price);
this.checkMsg("tagong","","")
}
else{
this.unit_price=0;
this.setTagongPrice(0);
this.disableTagongOption();
this.checkMsg("tagong","해당 규격은 타공이 불가능합니다.","paper_size")
}

}

}

}
);
var ppBinding=Class.create(Postpress,{
initialize:function($super){
$super();
this.unit_price=0;
this.BINDING_MIN_PRICE=12000;
this.IS_BINDING_PAPER_WEIGHT=120;
this.save_binding_type=$('save_binding_type').value;
this.save_bundle_type=$('save_bundle_type').value
}
,dataLoad:function(){
new Ajax.Request('/estimate/estimate_goods/pp_binding_json_data',{
asynchronous:false,method:"post",parameters:{
"t":timestamp,"category_code":this.getCategoryCode()
}
,onSuccess:function(jsonData){
ppBindingJsonOBJ=jsonData.responseText.evalJSON(true)
}
,onFailure:function(){
alert('Loading Failed for binding Json Data')
}

}
)
}
,getBindingType:function(){
if($('binding_type').value==""){
return this.save_binding_type
}
else{
return $('binding_type').value
}

}
,getBundleType:function(){
if($('bundle_type').value==""){
return this.save_bundle_type
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
,getIsPPBinding:function(){
if($('chk_is_binding').checked==true){
return true
}
else{
return false
}

}
,settingBundleType:function(){
var paper_weight=this.getPaperWeight();
var paper_size=this.getPaperSize();
var this_bundle_type=this.getBundleType();
this.initSelectOptions('bundle_type');
if(paper_weight<=this.IS_BINDING_PAPER_WEIGHT){
$('binding_type').disabled=false;
$('bundle_type').disabled=false;
$('bundle_type').options[0]=new Option("100매철","BDB11",false);
$('bundle_type').options[1]=new Option("200매철","BDB12",false);
this.thisPositionSelectOptions('bundle_type',this_bundle_type);
this.checkMsg("binding","","")
}
else{
$('bundle_type').options[0]=new Option("없음","",false);
$('binding_type').disabled=true;
$('bundle_type').disabled=true;
this.setBindingPrice(0);
this.checkMsg("binding","떡제본이 가능한 평량은 120g 이하이어야 합니다.","paper_code")
}

}
,calcuBindingPrice:function(){
if(this.getIsPPBinding()){
this.settingBundleType()
}
this.enabledBundleType();
bundle_type=this.getBundleType();
if(this.getIsPPBinding()&&bundle_type!=""){
paper_yeon_qty=this.getPaperYeonQty();
this.getBindingPriceUnit();
price1=paper_yeon_qty*this.unit_price;
price2=this.BINDING_MIN_PRICE;
if(this.unit_price>0){
binding_price=Math.max(price1,price2);
binding_price=Math.ceil(binding_price/1000)*1000;
this.setBindingPrice(binding_price)
}
else{
binding_price=0;
this.setBindingPrice(0)
}
this.outputDebugMsg("[calcuBindingPrice]binding_price:"+binding_price+",unit_price:"+this.unit_price)
}
else{
this.setBindingPrice(0);
this.outputDebugMsg("[calcuBindingPrice]binding_price:0")
}

}
,enabledBundleType:function(){
$('bundle_type').disabled=false
}
,disableBundleType:function(){
$('bundle_type').disabled=true
}
,getBindingPriceUnit:function(){
parts_num=this.getPartsNum();
paper_size=this.getPaperSize();
var pp_binding_info=jsonPath(ppBindingJsonOBJ,"$.pp_binding_info[?(@.num=='"+parts_num+"')][?(@.paper_size=='"+paper_size+"')]");
if(pp_binding_info){
this.unit_price=parseInt(pp_binding_info[0].unit_price);
this.unit_price=this.unit_price*1.4
}
else{
this.unit_price=0;
this.setBindingPrice(0);
this.disableBundleType();
this.checkMsg("binding","해당 규격은 제본이 불가능합니다.","paper_size")
}

}

}
);
var ppBonding=Class.create(Postpress,{
initialize:function($super){
$super();
this.unit_price=0;
this.BONDING_BASIC_PRICE=5000;
this.BONDING_MIN_PRICE=20000
}
,dataLoad:function(){
new Ajax.Request('/estimate/estimate_goods/pp_bonding_json_data',{
asynchronous:false,method:"post",parameters:{
"t":timestamp,"category_code":this.getCategoryCode()
}
,onSuccess:function(jsonData){
ppBondingJsonOBJ=jsonData.responseText.evalJSON(true)
}
,onFailure:function(){
alert('Loading Failed for bonding Json Data')
}

}
)
}
,getBondingType:function(){
if($('bonding_type').value==""){
return $('save_bonding_type').value
}
else{
return $('bonding_type').value
}

}
,getBondingNum:function(){
return $('bonding_num').value
}
,setBondingPrice:function(price){
$('bonding_amt').value=price
}
,getBondingPrice:function(){
return $('bonding_amt').value
}
,getIsPPBonding:function(){
if($('chk_is_bonding').checked==true){
return true
}
else{
return false
}

}
,getIsPPDomusong:function(){
if($('chk_is_domusong').checked==true){
return true
}
else{
return false
}

}
,getDomusongNum:function(){
return $('domusong_num').value
}
,getBondingXSize:function(){
return $('bonding_x_size').value
}
,getBondingYSize:function(){
return $('bonding_y_size').value
}
,settingBonding:function(){
var cut_x_size=this.getCutXSize();
var cut_y_size=this.getCutYSize();
var cut_min_size=Math.min(cut_x_size,cut_y_size);
var bonding_type=this.getBondingType();
this.initSelectOptions('bonding_type');
if(cut_min_size>=80){
$('bonding_type').options[0]=new Option('1면접착(손으로접착)','BOT10',false);
$('bonding_type').options[1]=new Option('2면접착(손으로접착)','BOT20',false);
$('bonding_type').options[2]=new Option('양면테잎1개','BOT50',false);
$('bonding_type').options[3]=new Option('양면테잎2개','BOT60',false);
if(cut_min_size>=125){
$('bonding_type').options[4]=new Option('1면접착(기계로접착)','BOT30',false);
$('bonding_type').options[5]=new Option('3면접착(기계로접착)','BOT40',false)
}

}
this.thisPositionSelectOptions("bonding_type",bonding_type)
}
,calcuBondingPrice:function(){
this.settingBonding();
bonding_type=this.getBondingType();
if(this.getIsPPBonding()&&bonding_type!=""){
var paper_qty=this.getPaperQty();
var min_price=this.getBondingMinPrice();
this.getBondingPriceUnit();
if(this.getIsPPDomusong()){
domusong_num=this.getDomusongNum()
}
else{
domusong_num=1
}
var bonding_unit_price2=0;
var bonding_unit_price3=0;
if(bonding_type=='BOT10'){
bonding_unit_price3=100;
bonding_unit_price2=10000;
bonding_unit_price4=15000
}
else if(bonding_type=='BOT20'){
bonding_unit_price3=100;
bonding_unit_price2=10000;
bonding_unit_price4=15000
}
else if(bonding_type=='BOT30'){
bonding_unit_price3=100;
bonding_unit_price2=20000;
bonding_unit_price4=15000
}
else if(bonding_type=='BOT40'){
bonding_unit_price3=100;
bonding_unit_price2=30000;
bonding_unit_price4=15000
}
else if(bonding_type=='BOT50'){
bonding_unit_price3=50;
bonding_unit_price2=10000;
bonding_unit_price4=0
}
else if(bonding_type=='BOT60'){
bonding_unit_price3=50;
bonding_unit_price2=10000;
bonding_unit_price4=0
}
bonding_cost=parseInt(paper_qty)*parseInt(domusong_num)*this.unit_price+bonding_unit_price2;
var paper_weight=this.getPaperWeight();
var cut_x_size=this.getCutXSize();
var cut_y_size=this.getCutYSize();
var cut_min_size=Math.min(cut_x_size,cut_y_size);
var cut_max_size=Math.max(cut_x_size,cut_y_size);
var package_unit_price=(paper_weight/1000)*(cut_x_size*cut_y_size/1000000)*paper_qty;
package_unit_price=package_unit_price.toFixed(1);
var package_price=bonding_unit_price3*package_unit_price;
package_price=Math.ceil(package_price/1000)*1000;
var add_price=0;
if(cut_min_size<159&&bonding_type=='BOT40'){
add_price=paper_qty*30
}
add_price2=0;
if(cut_max_size>=450){
add_price2=bonding_unit_price4
}
bonding_price=Math.max(Math.max(bonding_cost,min_price),30000)+package_price+add_price+add_price2;
bonding_price=Math.ceil(bonding_price/100)*100;
this.setBondingPrice(bonding_price);
this.checkMsg("bonding","","")
}
else{
this.setBondingPrice(0);
this.checkMsg("bonding","","")
}

}
,getBondingMinPrice:function(){
bonding_type_code=this.getBondingType();
var min_price=0;
if(bonding_type_code=="BOT30"){
min_price=60000
}
else if(bonding_type_code=="BOT40"){
min_price=70000
}
else{
min_price=10000
}
return min_price
}
,getBondingPriceUnit:function(){
bonding_type_code=this.getBondingType();
domusong_num=this.getDomusongNum();
if(domusong_num>=2){
bonding_max_size=Math.max(this.getBondingXSize(),this.getBondingYSize())
}
else{
bonding_max_size=Math.max(this.getCutXSize(),this.getCutYSize())
}
if(bonding_max_size<300){
bonding_ref_key=1
}
else if(bonding_max_size>=300&&bonding_max_size<400){
bonding_ref_key=300
}
else if(bonding_max_size>=400&&bonding_max_size<500){
bonding_ref_key=400
}
else if(bonding_max_size>=500&&bonding_max_size<600){
bonding_ref_key=500
}
else if(bonding_max_size>=600&&bonding_max_size<700){
bonding_ref_key=600
}
else if(bonding_max_size>=700&&bonding_max_size<800){
bonding_ref_key=700
}
else{
bonding_ref_key=800
}
var pp_bonding_info=jsonPath(ppBondingJsonOBJ,"$.pp_bonding_info[?(@.type=='"+bonding_type_code+"' && @.ref_key=='"+bonding_ref_key+"')]");
this.unit_price=parseInt(pp_bonding_info[0].unit_cost)*1.1
}

}
);
var ppCutting=Class.create(Postpress,{
initialize:function($super){
$super();
this.unit_price=0
}
,dataLoad:function(){
new Ajax.Request('/estimate/estimate_goods/pp_cutting_json_data',{
asynchronous:false,method:"post",parameters:{
"t":timestamp,"category_code":this.getCategoryCode()
}
,onSuccess:function(jsonData){
ppCuttingJsonOBJ=jsonData.responseText.evalJSON(true)
}
,onFailure:function(){
alert('Loading Failed for cutting Json Data')
}

}
)
}
,getCuttingType:function(){
return $('cutting_type').value
}
,getAddCutXSize1:function(){
return $('add_cut_x_size_1').value
}
,getAddCutYSize1:function(){
return $('add_cut_y_size_1').value
}
,getAddCutMargin1:function(){
return $('add_cut_margin_1').value
}
,getAddCutXSize2:function(){
return $('add_cut_x_size_2').value
}
,getAddCutYSize2:function(){
return $('add_cut_y_size_2').value
}
,getAddPartsNum1:function(){
return $('add_parts_num_1').value
}
,setAddPartsNum1:function(num){
$('add_parts_num_1').value=num
}
,getAddPartsNum2:function(){
return $('add_parts_num_2').value
}
,getAddCutXSize3:function(){
return $('add_cut_x_size_3').value
}
,getAddCutYSize3:function(){
return $('add_cut_y_size_3').value
}
,getAddPartsNum3:function(){
return $('add_parts_num_3').value
}
,getAddCutXSize4:function(){
return $('add_cut_x_size_4').value
}
,getAddCutYSize4:function(){
return $('add_cut_y_size_4').value
}
,getAddPartsNum4:function(){
return $('add_parts_num_4').value
}
,setAddPartsNum:function(num){
$('add_parts_num').value=num
}
,getAddPartsNum:function(){
return $('add_parts_num').value
}
,setCuttingPrice:function(price){
$('cutting_amt').value=price
}
,getCuttingPrice:function(){
return $('cutting_amt').value
}
,getIsPPCutting:function(){
if($('chk_is_cutting').checked==true){
return true
}
else{
return false
}

}
,settingCuttingType:function(){
var cut_type=this.getCuttingType();
if(cut_type=="CTT10"||cut_type=="CTT20"){
$('add_parts_num_1').readOnly=true
}
else{
$('add_parts_num_1').readOnly=false
}

}
,checkCuttingSize:function(){
cut_x_size=this.getCutXSize();
cut_y_size=this.getCutYSize();
add_cut_x_size1=this.getAddCutXSize1();
add_cut_y_size1=this.getAddCutYSize1();
max_add_cut_size1=Math.max(add_cut_x_size1,add_cut_y_size1);
min_add_cut_size1=Math.min(add_cut_x_size1,add_cut_y_size1);
if(add_cut_x_size1!=""&&add_cut_x_size1>0&&add_cut_y_size1!=""&&add_cut_y_size1>0){
if(cut_x_size>=add_cut_x_size1&&max_add_cut_size1>=90&&min_add_cut_size1>=40){

}
else{
alert("추가 재단 가로사이즈가 자동견적 범위를 벗어났습니다1.");
$('add_cut_x_size_1').value="";
$('add_cut_x_size_1').focus()
}
if(cut_y_size>=add_cut_y_size1&&max_add_cut_size1>=90&&min_add_cut_size1>=40){

}
else{
alert("추가 재단 세로사이즈가 자동견적 범위를 벗어났습니다1.");
$('add_cut_y_size_1').value="";
$('add_cut_y_size_1').focus()
}

}
add_cut_x_size2=this.getAddCutXSize2();
add_cut_y_size2=this.getAddCutYSize2();
max_add_cut_size2=Math.max(add_cut_x_size2,add_cut_y_size2);
min_add_cut_size2=Math.min(add_cut_x_size2,add_cut_y_size2);
if(add_cut_x_size2!=""&&add_cut_x_size2>0&&add_cut_y_size2!=""&&add_cut_y_size2>0){
if(cut_x_size>=add_cut_x_size2&&max_add_cut_size2>=90&&min_add_cut_size2>=40){

}
else{
alert("추가 재단 가로사이즈가 잘못 되었습니다2.");
$('add_cut_x_size_2').value="";
$('add_cut_x_size_2').focus()
}
if(cut_y_size>=add_cut_y_size2&&max_add_cut_size2>=90&&min_add_cut_size2>=40){

}
else{
alert("추가 재단 세로사이즈가 잘못 되었습니다2.");
$('add_cut_y_size_2').value="";
$('add_cut_y_size_2').focus()
}

}
add_cut_x_size3=this.getAddCutXSize3();
add_cut_y_size3=this.getAddCutYSize3();
max_add_cut_size3=Math.max(add_cut_x_size3,add_cut_y_size3);
min_add_cut_size3=Math.min(add_cut_x_size3,add_cut_y_size3);
if(add_cut_x_size3!=""&&add_cut_x_size3>0&&add_cut_y_size3!=""&&add_cut_y_size3>0){
if(cut_x_size>=add_cut_x_size3&&max_add_cut_size3>=90&&min_add_cut_size3>=40){

}
else{
alert("추가 재단 가로사이즈가 잘못 되었습니다3.");
$('add_cut_x_size_3').value="";
$('add_cut_x_size_3').focus()
}
if(cut_y_size>=add_cut_y_size3&&max_add_cut_size3>=90&&min_add_cut_size3>=40){

}
else{
alert("추가 재단 세로사이즈가 잘못 되었습니다3.");
$('add_cut_y_size_3').value="";
$('add_cut_y_size_3').focus()
}

}
add_cut_x_size4=this.getAddCutXSize4();
add_cut_y_size4=this.getAddCutYSize4();
max_add_cut_size4=Math.max(add_cut_x_size4,add_cut_y_size4);
min_add_cut_size4=Math.min(add_cut_x_size4,add_cut_y_size4);
if(add_cut_x_size4!=""&&add_cut_x_size4>0&&add_cut_y_size4!=""&&add_cut_y_size4>0){
if(cut_x_size>=add_cut_x_size4&&max_add_cut_size4>=90&&min_add_cut_size4>=40){

}
else{
alert("추가 재단 가로사이즈가 잘못 되었습니다4.");
$('add_cut_x_size_4').value="";
$('add_cut_x_size_4').focus()
}
if(cut_y_size>=add_cut_y_size4&&max_add_cut_size4>=90&&min_add_cut_size4>=40){

}
else{
alert("추가 재단 세로사이즈가 잘못 되었습니다4.");
$('add_cut_y_size_4').value="";
$('add_cut_y_size_4').focus()
}

}

}
,calcuCuttingPrice:function(){
if(this.getIsPPCutting()){
this.checkCuttingSize();
this.settingCuttingType();
var cutting_type=this.getCuttingType();
var size_type=this.getSizeType();
if(cutting_type!=""){
var paper_yeon_qty=this.getPaperYeonQty();
var paper_weight=this.getPaperWeight();
this.getCuttingPartsNum();
this.getCuttingPriceUnit();
weight_extra_rate=Math.max((paper_weight/120),1);
if($('chk_is_tagong').checked==true){
weight_extra_rate=weight_extra_rate*2
}
if(cutting_type=="CTT10"){
content_extra_rate=1
}
else{
content_extra_rate=1.5
}
cutting_price=Math.max(paper_yeon_qty,1)*this.unit_price*weight_extra_rate*content_extra_rate;
cutting_price=Math.ceil(cutting_price/100)*100;
if(cutting_price){
cutting_price=Math.max(cutting_price,1000)
}
this.setCuttingPrice(cutting_price);
$('cutting_type').disabled=false
}
else{
this.setCuttingPrice(0)
}

}
else{
this.setCuttingPrice(0)
}

}
,calcuCuttingPrice2:function(){
this.checkCuttingSize();
this.settingCuttingType();
var cutting_type=this.getCuttingType();
var size_type=this.getSizeType();
if(cutting_type!=""){
var paper_yeon_qty=this.getPaperYeonQty();
var paper_weight=this.getPaperWeight();
this.getCuttingPartsNum();
this.getCuttingPriceUnit();
weight_extra_rate=Math.max((paper_weight/120),1);
if($('chk_is_tagong').checked==true){
weight_extra_rate=weight_extra_rate*2
}
if(cutting_type=="CTT10"){
content_extra_rate=1
}
else{
content_extra_rate=1.5
}
cutting_price=Math.max(paper_yeon_qty,1)*this.unit_price*weight_extra_rate*content_extra_rate;
cutting_price=Math.ceil(cutting_price/100)*100;
if(cutting_price){
$('chk_is_cutting').checked=true
}
else{
$('chk_is_cutting').checked=false
}
this.setCuttingPrice(cutting_price);
$('cutting_type').disabled=false
}
else{
this.setCuttingPrice(0)
}

}
,getCuttingPartsNum:function(){
cutting_type=this.getCuttingType();
size_type=this.getSizeType();
cut_num=parseInt($("cut_num").value);
parts_num=parseInt($("parts_num").value);
if(cutting_type!=""){
var add_parts_num=0;
var add_parts_num1=0;
var add_parts_num2=0;
var add_parts_num3=0;
var add_parts_num4=0;
var cut_x_size=parseInt(this.getCutXSize());
var cut_y_size=parseInt(this.getCutYSize());
var work_x_size=parseInt(this.getWorkXSize());
var work_y_size=parseInt(this.getWorkYSize());
var add_cut_x_size_1=parseInt(this.getAddCutXSize1());
var add_cut_y_size_1=parseInt(this.getAddCutYSize1());
var add_cut_margin_1=parseInt(this.getAddCutMargin1());
if(cutting_type=="CTT10"||cutting_type=="CTT20"){
if(add_cut_x_size_1>0&&add_cut_y_size_1>0){
basis_x_size=(add_cut_margin_1==0)?cut_x_size:work_x_size;
basis_y_size=(add_cut_margin_1==0)?cut_y_size:work_y_size;
basis_add_cut_x_size_1=add_cut_x_size_1+(add_cut_margin_1*2);
basis_add_cut_y_size_1=add_cut_y_size_1+(add_cut_margin_1*2);
parts_num_regular1=Math.floor(basis_x_size/basis_add_cut_x_size_1);
parts_num_regular2=Math.floor(basis_y_size/basis_add_cut_y_size_1);
parts_num_cross1=Math.floor(basis_y_size/basis_add_cut_x_size_1);
parts_num_cross2=Math.floor(basis_x_size/basis_add_cut_y_size_1);
parts_num_regular=parts_num_regular1*parts_num_regular2;
parts_num_cross=parts_num_cross1*parts_num_cross2;
add_parts_num1=Math.max(parts_num_regular,parts_num_cross);
if(cut_num*parts_num>=32){

}
this.setAddPartsNum1(add_parts_num1*parts_num)
}

}
else{
if(this.getAddPartsNum1()!=""){
add_parts_num1=parseInt(this.getAddPartsNum1())
}
else{
add_parts_num1=0
}

}
if(this.getAddPartsNum2()!=""){
add_parts_num2=parseInt(this.getAddPartsNum2())
}
else{
add_parts_num2=0
}
if(this.getAddPartsNum3()!=""){
add_parts_num3=parseInt(this.getAddPartsNum3())
}
else{
add_parts_num3=0
}
if(this.getAddPartsNum4()!=""){
add_parts_num4=parseInt(this.getAddPartsNum4())
}
else{
add_parts_num4=0
}
if(cutting_type=="CTT10"||cutting_type=="CTT20"){
add_parts_num=add_parts_num+add_parts_num1
}
if(cutting_type=="CTT30"){
add_parts_num=add_parts_num+add_parts_num1+add_parts_num2
}
if(cutting_type=="CTT40"){
add_parts_num=add_parts_num+add_parts_num1+add_parts_num2+add_parts_num3
}
if(cutting_type=="CTT50"){
add_parts_num=add_parts_num+add_parts_num1+add_parts_num2+add_parts_num3+add_parts_num4
}

}
if($("size_type").value=="SZT20"){
add_parts_num=$("parts_num").value;
this.setAddPartsNum(add_parts_num)
}
else{
this.setAddPartsNum(add_parts_num)
}

}
,getCuttingPriceUnit:function(){
add_parts_num=this.getAddPartsNum();
paper_size=this.getPaperSize();
if(add_parts_num>1){
var pp_cutting_info=jsonPath(ppCuttingJsonOBJ,"$.pp_cutting_info[?(@.num=='"+add_parts_num+"')][?(@.size_type=='"+paper_size+"')]");
if(pp_cutting_info){
this.unit_price=parseInt(pp_cutting_info[0].unit_price);
this.checkMsg("cutting","","")
}
else{
this.unit_price=0;
this.setCuttingPrice(0);
this.checkMsg("cutting","재단이 불가능한 사이즈입니다.","")
}

}
else{
this.unit_price=0;
this.setCuttingPrice(0);
this.checkMsg("cutting","재단이 불가능한 사이즈입니다.","")
}
this.outputDebugMsg("[getCuttingPriceUnit]unit_price:"+this.unit_price+",add_parts_num:"+add_parts_num+",paper_size:"+paper_size)
}

}
);
var ppFolding=Class.create(Postpress,{
initialize:function($super){
$super();
this.unit_price=0;
this.pp_folding_cnt=1;
this.FOLDING_MIN_PRICE=new Array();
this.save_folding_type=$('save_folding_type').value
}
,dataLoad:function(){
new Ajax.Request('/estimate/estimate_goods/pp_folding_json_data',{
asynchronous:false,method:"post",parameters:{
"t":timestamp,"category_code":this.getCategoryCode()
}
,onSuccess:function(jsonData){
ppFoldingJsonOBJ=jsonData.responseText.evalJSON(true)
}
,onFailure:function(){
alert('Loading Failed for Folding Json Data')
}

}
)
}
,getFoldingType:function(){
if($('folding_type').value==""){
return this.save_folding_type
}
else{
return $('folding_type').value
}

}
,getIsCoating:function(){
if($('chk_is_coating').checked==true){
return true
}
else{
return false
}

}
,getCutNum:function(){
return parseInt($('cut_num').value)
}
,getCoatingType:function(){
return $('coating_type').value
}
,setFoldingPrice:function(price){
$('folding_amt').value=price
}
,getFoldingPrice:function(){
return $('folding_amt').value
}
,getIsPPFolding:function(){
if($('chk_is_folding').checked==true){
return true
}
else{
return false
}

}
,getIsPPOsi:function(){
if($('chk_is_osi').checked==true){
return true
}
else{
return false
}

}
,checkFoldingMsg:function(){
var is_pp_osi=this.getIsPPOsi();
var is_pp_coating=this.getIsCoating();
var paper_weight=parseInt(this.getPaperWeight());
if(paper_weight>=155&&!is_pp_osi&&!is_pp_coating&&$('chk_is_folding').checked==true){
alert('용지평량 155g 이상은 종이가 두꺼워서 접지를 하면 종이갈라짐이 많이 발생합니다.\n\n오시 선택 후 접지를 선택하시기 바랍니다.')
}

}
,settingFoldingType:function(){
var pp_folding_check=jsonPath(ppFoldingJsonOBJ,"$.pp_folding_check");
this_folding_type=this.getFoldingType();
size_type_name=$('size_type_name1').value;
size_type_name=size_type_name.substring(0,2);
this.initSelectOptions('folding_type');
var thisValSeq=0;
for(i=0;
i<pp_folding_check[0].length;
i++){
folding_type_code=pp_folding_check[0][i].code;
folding_type_name=pp_folding_check[0][i].name;
chk_size_min=pp_folding_check[0][i].chk_size_min;
chk_size_high=pp_folding_check[0][i].chk_size_high;
chk_size_low=pp_folding_check[0][i].chk_size_low;
chk_size_rate=pp_folding_check[0][i].chk_size_rate;
chk_weight_min=pp_folding_check[0][i].chk_weight_min;
chk_weight_max=pp_folding_check[0][i].chk_weight_max;
chk_price_min=pp_folding_check[0][i].chk_price_min;
chk_qty_min=pp_folding_check[0][i].chk_qty_min;
chk_is_coating=pp_folding_check[0][i].chk_is_coating;
this.FOLDING_MIN_PRICE[folding_type_code]=chk_price_min;
if(this.checkPaperWeight(chk_weight_min,chk_weight_max)&&this.checkSizeRate(chk_size_rate)&&this.checkIsCoating(folding_type_code,chk_is_coating)&&this.checkSize(chk_size_min,chk_size_high,chk_size_low)&&this.checkCuttingType()&&this.getPartsSize()!=""&&this.checkPaperCutNum(folding_type_code,size_type_name)){
num_folding_type=folding_type_code.substring(3,5);
$('folding_type').options[thisValSeq]=new Option(folding_type_name,folding_type_code,false);
thisValSeq++
}
else{

}

}
if(thisValSeq==0){
$('folding_type').options[0]=new Option('없음','');
this.setFoldingPrice(0)
}
else{
this.thisPositionSelectOptions('folding_type',this_folding_type)
}
this.foldingIsTemplet()
}
,foldingIsTemplet:function(){
folding_type=$('folding_type').value;
folding_stair_name='';
folding_stair_name2='';
if(folding_type=='FDT01'){
$('select_folding_stair').options[0]=new Option("중앙","FDO01",true);
$('select_folding_stair').options[1]=new Option("중앙아님(직접입력)","FDO02",true)
}
else if(folding_type=='FDT02'){
$('select_folding_stair').options[0]=new Option("안쪽작게(기본)","FDO03",true);
$('select_folding_stair').options[1]=new Option("안쪽길이(직접입력)","FDO04",true)
}
else if(folding_type=='FDT03'){
$('select_folding_stair').options[0]=new Option("바깥면길이(기본)","FDO05",true);
$('select_folding_stair').options[1]=new Option("바깥면길이(직접입력)","FDO06",true)
}
else if(folding_type=='FDT04'){
$('select_folding_stair').options[0]=new Option("3면길이같음","FDO07",true);
$('select_folding_stair').options[1]=new Option("앞쪽길이(직접입력)","FDO08",true)
}
else if(folding_type=='FDT08'){
$('select_folding_stair').options[0]=new Option("중앙벌림(기본)","FDO09",true);
$('select_folding_stair').options[1]=new Option("중앙벌림(직접입력)","FDO10",true)
}
if(folding_type=='FDT01'||folding_type=='FDT02'||folding_type=='FDT03'||folding_type=='FDT04'||folding_type=='FDT08'){
$('div_folding_templet').hide();
this.foldingDirection()
}
else{
$('div_folding_templet').hide()
}

}
,foldingDirection:function(){
cut_x_size=parseInt($('cut_x_size').value);
cut_y_size=parseInt($('cut_y_size').value);
$('folding_direction').options[0]=new Option("접지방향","",true);
if(cut_x_size>cut_y_size){
$('folding_direction').options[1]=new Option("가로길게","WL",true);
$('folding_direction').options[2]=new Option("세로짧게","HS",true)
}
else{
$('folding_direction').options[1]=new Option("가로짧게","WS",true);
$('folding_direction').options[2]=new Option("세로길게","HL",true)
}

}
,checkPaperCutNum:function(code,name){
var parts_num=parseInt($('parts_num').value);
var add_parts_num_1=parseInt($('add_parts_num_1').value);
var size_type=$('size_type').value;
var cutting_type=$('cutting_type').value;
if(size_type=='SZT10'){
if(cutting_type=='CTT10'||cutting_type=='CTT20'){
if(add_parts_num_1>=2&&add_parts_num_1<5){
name=this.checkAddPaperCutNum(name,add_parts_num_1)
}

}

}
else{
name=this.checkAddPaperCutNum(name,parts_num)
}
if((code=='FDT01'||code=='FDT02'||code=='FDT03'||code=='FDT04')&&name=='A1'){
is_cut_num=false
}
else if((code=='FDT05'&&name=='A1')||(code=='FDT05'&&name=='B6')){
is_cut_num=false
}
else if((code=='FDT06'&&name=='A1')||(code=='FDT06'&&name=='B6')){
is_cut_num=false
}
else if((code=='FDT07'&&name=='A1')||(code=='FDT07'&&name=='B6')){
is_cut_num=false
}
else if(code=='FDT08'&&name=='B6'){
is_cut_num=false
}
else if((code=='FDT09'&&name=='A1')||(code=='FDT09'&&name=='B6')){
is_cut_num=false
}
else if((code=='FDT11'&&name=='A1')||(code=='FDT11'&&name=='B6')){
is_cut_num=false
}
else if((code=='FDT12'&&name=='A1')||(code=='FDT12'&&name=='B6')){
is_cut_num=false
}
else if((code=='FDT13'&&name=='A1')||(code=='FDT13'&&name=='B6')){
is_cut_num=false
}
else if((code=='FDT14'&&name!='B2')&&(code=='FDT14'&&name!='A2')){
is_cut_num=false
}
else if((code=='FDT15'&&name!='B2')&&(code=='FDT15'&&name!='A2')){
is_cut_num=false
}
else if((code=='FDT16'&&name=='A1')||(code=='FDT16'&&name=='B6')){
is_cut_num=false
}
else if((code=='FDT17'&&name=='A1')||(code=='FDT17'&&name=='B6')){
is_cut_num=false
}
else if((code=='FDT18'&&name!='B5')){
is_cut_num=false
}
else if((code=='FDT19'&&name!='B2')&&(code=='FDT19'&&name!='A2')){
is_cut_num=false
}
else if((code=='FDT20'&&name!='B2')&&(code=='FDT20'&&name!='A2')){
is_cut_num=false
}
else{
is_cut_num=true
}
return is_cut_num
}
,checkAddPaperCutNum:function(cut_num,add_parts_num_1){
var add_cut_num='';
if(add_parts_num_1=='1'){
if(cut_num=='A5'){
add_cut_num='A5'
}
else if(cut_num=='A4'){
add_cut_num='A4'
}
else if(cut_num=='A3'){
add_cut_num='A3'
}
else if(cut_num=='A2'){
add_cut_num='A2'
}
else if(cut_num=='A1'){
add_cut_num='A1'
}
else if(cut_num=='B6'){
add_cut_num='B6'
}
else if(cut_num=='B5'){
add_cut_num='B5'
}
else if(cut_num=='B4'){
add_cut_num='B4'
}
else if(cut_num=='B3'){
add_cut_num='B3'
}
else if(cut_num=='B2'){
add_cut_num='B2'
}

}
else if(add_parts_num_1=='2'){
if(cut_num=='A5'){
add_cut_num=''
}
else if(cut_num=='A4'){
add_cut_num='A5'
}
else if(cut_num=='A3'){
add_cut_num='A4'
}
else if(cut_num=='A2'){
add_cut_num='A3'
}
else if(cut_num=='A1'){
add_cut_num='A2'
}
else if(cut_num=='B6'){
add_cut_num=''
}
else if(cut_num=='B5'){
add_cut_num='B6'
}
else if(cut_num=='B4'){
add_cut_num='B5'
}
else if(cut_num=='B3'){
add_cut_num='B4'
}
else if(cut_num=='B2'){
add_cut_num='B4'
}

}
else if(add_parts_num_1=='3'){
if(cut_num=='A5'){
add_cut_num=''
}
else if(cut_num=='A4'){
add_cut_num=''
}
else if(cut_num=='A3'){
add_cut_num='A5'
}
else if(cut_num=='A2'){
add_cut_num='A4'
}
else if(cut_num=='A1'){
add_cut_num='A3'
}
else if(cut_num=='B6'){
add_cut_num=''
}
else if(cut_num=='B5'){
add_cut_num=''
}
else if(cut_num=='B4'){
add_cut_num='B6'
}
else if(cut_num=='B3'){
add_cut_num='B5'
}
else if(cut_num=='B2'){
add_cut_num='B4'
}

}
else if(add_parts_num_1=='4'){
if(cut_num=='A5'){
add_cut_num=''
}
else if(cut_num=='A4'){
add_cut_num=''
}
else if(cut_num=='A3'){
add_cut_num=''
}
else if(cut_num=='A2'){
add_cut_num='A4'
}
else if(cut_num=='A1'){
add_cut_num='A3'
}
else if(cut_num=='B6'){
add_cut_num=''
}
else if(cut_num=='B5'){
add_cut_num=''
}
else if(cut_num=='B4'){
add_cut_num=''
}
else if(cut_num=='B3'){
add_cut_num='B5'
}
else if(cut_num=='B2'){
add_cut_num='B4'
}

}
if(add_cut_num==''){
add_cut_num=cut_num
}
return add_cut_num
}
,checkPaperWeight:function(chk_weight_min,chk_weight_max){
var paper_weight=this.getPaperWeight();
if(paper_weight>=chk_weight_min&&paper_weight<=chk_weight_max){
is_weight=true
}
else{
is_weight=false
}
return is_weight
}
,checkSizeRate:function(chk_size_rate){
var cut_x_size=this.getCutXSize();
var cut_y_size=this.getCutYSize();
var is_pp_cutting=this.getIsPPCutting();
var cutting_type=ppCutting.getCuttingType();
var add_cut_x_size1=ppCutting.getAddCutXSize1();
var add_cut_x_size2=ppCutting.getAddCutXSize2();
if(is_pp_cutting&&(cutting_type=="CTT10"||cutting_type=="CTT20")&&add_cut_x_size1>0&&add_cut_x_size2>0){
max_size=Math.max(add_cut_x_size1,add_cut_x_size2);
min_size=Math.min(add_cut_x_size1,add_cut_x_size2)
}
else{
max_size=Math.max(cut_x_size,cut_y_size);
min_size=Math.min(cut_x_size,cut_y_size)
}
cut_rate=parseFloat(max_size/min_size);
if(cut_rate>=chk_size_rate){
is_rate=false
}
else{
is_rate=true
}
return is_rate
}
,checkIsCoating:function(folding_type,chk_is_coating){
var is_coating=this.getIsPPCoating();
var coating_type=this.getCoatingType();
if(is_coating&&coating_type!=""){
if(chk_is_coating=="1"){
if(coating_type=="COT60"){
if(folding_type=="FDT05"||folding_type=="FDT06"||folding_type=="FDT07"||folding_type=="FDT08"||folding_type=="FDT09"){
is_coating=false
}
else{
is_coating=true
}

}
else if(coating_type=="COT40"){
if(folding_type=="FDT07"){
is_coating=false
}
else{
is_coating=true
}

}
else{
is_coating=true
}

}
else{
is_coating=false
}

}
else{
is_coating=true
}
return is_coating
}
,checkSize:function(chk_size_min,chk_size_high,chk_size_low){
var cut_x_size=this.getCutXSize();
var cut_y_size=this.getCutYSize();
var is_pp_cutting=this.getIsPPCutting();
var cutting_type=ppCutting.getCuttingType();
var add_cut_x_size1=ppCutting.getAddCutXSize1();
var add_cut_x_size2=ppCutting.getAddCutXSize2();
if(is_pp_cutting&&(cutting_type=="CTT10"||cutting_type=="CTT20")&&add_cut_x_size1>0&&add_cut_x_size2>0){
max_size=Math.max(add_cut_x_size1,add_cut_x_size2);
min_size=Math.min(add_cut_x_size1,add_cut_x_size2)
}
else{
max_size=Math.max(cut_x_size,cut_y_size);
min_size=Math.min(cut_x_size,cut_y_size)
}
if(max_size<=chk_size_high&&max_size>=chk_size_low&&min_size>=chk_size_min){
is_size=true
}
else{
is_size=false
}
return is_size
}
,getPartsSize:function(){
var parts_num=this.getPartsNum();
var add_parts_num=ppCutting.getAddPartsNum();
var is_add_cutting=this.getIsPPCutting();
var paper_size=this.getPaperSize();
if(is_add_cutting&&add_parts_num>0){
check_parts_num=add_parts_num
}
else{
check_parts_num=parts_num
}
if(check_parts_num>1){
if(paper_size=="A0500"||paper_size=="B0600"){
unit_paper_size=""
}
else if(paper_size=="A0400"){
if(check_parts_num==2){
unit_paper_size="A0500"
}
else{
unit_paper_size=""
}

}
else if(paper_size=="A0300"){
if(check_parts_num==2){
unit_paper_size="A0400"
}
else if(check_parts_num==3){
unit_paper_size="A0500"
}
else{
unit_paper_size=""
}

}
else if(paper_size=="A0200"){
if(check_parts_num==2){
unit_paper_size="A0300"
}
else if(check_parts_num==3){
unit_paper_size="A0400"
}
else if(check_parts_num==4){
unit_paper_size="A0400"
}
else{
unit_paper_size=""
}

}
else if(paper_size=="A0100"){
if(check_parts_num==2){
unit_paper_size="A0300"
}
else if(check_parts_num==3){
unit_paper_size="A0200"
}
else if(check_parts_num==4){
unit_paper_size="A0300"
}
else{
unit_paper_size=""
}

}
else if(paper_size=="B0500"){
if(check_parts_num==2){
unit_paper_size="B0600"
}
else{
unit_paper_size=""
}

}
else if(paper_size=="B0400"){
if(check_parts_num==2){
unit_paper_size="B0500"
}
else if(check_parts_num==3){
unit_paper_size="B0600"
}
else{
unit_paper_size=""
}

}
else if(paper_size=="B0300"){
if(check_parts_num==2){
unit_paper_size="B0400"
}
else if(check_parts_num==3){
unit_paper_size="B0500"
}
else if(check_parts_num==4){
unit_paper_size="B0500"
}
else{
unit_paper_size=""
}

}
else if(paper_size=="B0200"){
if(check_parts_num==2){
unit_paper_size="B0300"
}
else if(check_parts_num==3){
unit_paper_size="B0400"
}
else if(check_parts_num==4){
unit_paper_size="B0400"
}
else{
unit_paper_size=""
}

}

}
else{
unit_paper_size=paper_size
}
return unit_paper_size
}
,checkCuttingType:function(chk_size_rate){
var is_pp_cutting=this.getIsPPCutting();
var cutting_type=ppCutting.getCuttingType();
if(!is_pp_cutting){
is_cutting_type=true
}
else{
if(is_pp_cutting&&(cutting_type=="CTT10"||cutting_type=="CTT20")){
is_cutting_type=true
}
else{
is_cutting_type=false
}

}
return is_cutting_type
}
,checkPaperSize:function(folding_type){
var paper_size=this.getPaperSize();
if(paper_size=="A0100"){
disabled_list=new Array("FDT01","FDT02","FDT03","FDT04","FDT05","FDT06","FDT07","FDT09","FDT11","FDT12","FDT13","FDT14","FDT15","FDT16","FDT17")
}
else if(paper_size=="A0200"||paper_size=="A0300"||paper_size=="A0400"||paper_size=="A0500"){
disabled_list=new Array("FDT14","FDT15")
}
else if(paper_size=="B0600"){
disabled_list=new Array("FDT05","FDT06","FDT07","FDT08","FDT09","FDT11","FDT12","FDT13","FDT14","FDT15","FDT16","FDT17")
}
else if(paper_size=="B0300"||paper_size=="B0400"||paper_size=="B0500"){
disabled_list=new Array("FDT14","FDT15")
}
else{
disabled_list=new Array()
}
disabled_count=disabled_list.length;
if(disabled_count>0){
is_paper_size=true;
for(j=0;
j<disabled_count;
j++){
if(folding_type==disabled_list[j]){
is_paper_size=false;
break
}

}

}
else{
is_paper_size=true
}
return is_paper_size
}
,calcuFoldingPrice:function(){
if(this.getIsPPFolding()){
this.settingFoldingType()
}
paper_yeon_qty=this.getPaperYeonQty();
folding_type=this.getFoldingType();
parts_num=this.getPartsNum();
paper_size=this.getPaperSize();
if(this.getIsPPFolding()&&folding_type!=""){
this.getFoldingPriceUnit();
if(this.unit_price>0){
if(parts_num<3){
parts_extra_rate=1
}
else{
parts_extra_rate=1.2
}
if(paper_yeon_qty<=1){
qty_rate=paper_yeon_qty
}
else{
qty_rate=1
}
coating_extra_rate=this.getCoatingExtraRate();
qty_unit=Math.max(Math.ceil(paper_yeon_qty),1);
price1=this.unit_price*coating_extra_rate*parts_extra_rate*qty_rate;
if($('paper_size').value=="A0100"&&$("parts_num").value==3&&folding_type=="FDT02"){
folding_extra_rate=1.1
}
else if(folding_type=="FDT19"||folding_type=="FDT20"){
folding_extra_rate=1.1
}
else{
folding_extra_rate=1
}
price1=Math.floor(price1*folding_extra_rate);
price2=this.FOLDING_MIN_PRICE[folding_type];
price1=price1*1.1;
folding_price=Math.max(price1,price2);
folding_price=Math.ceil(folding_price/1000)*1000;
paper_qty=this.getPaperQty();
add_rate_unit_cost=folding_price/paper_qty;
 var cnt_add_rate=1;
if(add_rate_unit_cost<3.1){
cnt_add_rate=1.13
}
else{
cnt_add_rate=1
}
var folding_Unit_min_price=$('folding_unit_min_amt').value;
folding_Unit_min_price=folding_Unit_min_price*paper_qty;
folding_price=Math.max(folding_price,folding_Unit_min_price);
folding_price=folding_price*cnt_add_rate;
folding_price=Math.ceil(folding_price/1000)*1000;
var now=new Date();
var now_year=now.getFullYear();
var now_month=(now.getMonth()+1).toString().padStart(2,'0');
var today=now_year+now_month;
if(today>="202407"&&today<="202408"){
if(($('paper_size').value=="A0300"||$('paper_size').value=="A0400")&&(folding_type=="FDT02"||folding_type=="FDT01"||folding_type=="FDT03"||folding_type=="FDT05")){
folding_price=folding_price*0.9
}

}
this.setFoldingPrice(folding_price);
this.checkMsg("folding","","")
}
else{
this.setFoldingPrice(0);
this.outputDebugMsg("[calcuFoldingPrice]folding_price:0")
}

}
else{
this.setFoldingPrice(0);
this.outputDebugMsg("[calcuFoldingPrice]folding_price:0")
}

}
,getFoldingPriceUnit:function(){
folding_type=this.getFoldingType();
paper_size=this.getPartsSize();
paper_yeon_qty=this.getPaperYeonQty();
num_unit=Math.max(Math.ceil(paper_yeon_qty),1);
var margin_sale=0;
var margin_rate=1;
var work_filename='';
var folding_type_key="FDT01";
var folding_unit_min_amt=0;
if(folding_type=="FDT01"){
folding_type_key="FDT01";
work_filename='jeop_ji_ban_';
folding_unit_min_amt=2.5
}
else if(folding_type=="FDT02"){
folding_type_key="FDT01";
work_filename='jeop_ji_3dan_';
folding_unit_min_amt=3
}
else if(folding_type=="FDT03"){
folding_type_key="FDT01";
work_filename='jeop_ji_4dan_';
folding_unit_min_amt=3.5
}
else if(folding_type=="FDT04"){
folding_type_key="FDT01";
work_filename='jeop_ji_n_';
folding_unit_min_amt=3
}
else if(folding_type=="FDT05"){
folding_type_key="FDT05";
work_filename='jeop_ji_4dan_byeongpung_';
folding_unit_min_amt=7.5
}
else if(folding_type=="FDT06"){
folding_type_key="FDT05";
work_filename='jeop_ji_5dan_byeongpung_';
folding_unit_min_amt=11
}
else if(folding_type=="FDT07"){
folding_type_key="FDT05";
work_filename='jeop_ji_6dan_byeongpung_';
folding_unit_min_amt=12.5
}
else if(folding_type=="FDT08"){
folding_type_key="FDT09";
work_filename='jeop_ji_daemun_';
folding_unit_min_amt=6
}
else if(folding_type=="FDT09"){
folding_type_key="FDT09";
work_filename='jeop_ji_4dan_durumari_';
folding_unit_min_amt=8
}
else if(folding_type=="FDT10"){
folding_type_key="FDT10";
work_filename='jeop_ji_cross_';
folding_unit_min_amt=3.5
}
else if(folding_type=="FDT11"){
folding_type_key="FDT12";
work_filename='jeop_ji_4dan_ban_';
folding_unit_min_amt=12.5
}
else if(folding_type=="FDT12"){
folding_type_key="FDT12";
work_filename='jeop_ji_4dan_byeongpung_ban_';
folding_unit_min_amt=12.5
}
else if(folding_type=="FDT13"){
folding_type_key="FDT12";
work_filename='jeop_ji_3dan_ban_';
folding_unit_min_amt=10
}
else if(folding_type=="FDT14"){
folding_type_key="FDT15";
work_filename='jeop_ji_7dan_ban_byeongpung_';
folding_unit_min_amt=22
}
else if(folding_type=="FDT15"){
folding_type_key="FDT15";
work_filename='jeop_ji_6dan_ban_byeongpung_';
folding_unit_min_amt=22
}
else if(folding_type=="FDT16"){
folding_type_key="FDT12";
work_filename='jeop_ji_n_ban_';
folding_unit_min_amt=10
}
else if(folding_type=="FDT17"){
folding_type_key="FDT12";
work_filename='jeop_ji_ban_3dan_';
folding_unit_min_amt=10
}
else if(folding_type=="FDT18"){
folding_type_key="FDT18";
folding_unit_min_amt=5
}
else if(folding_type=="FDT19"){
folding_type_key="FDT15";
folding_unit_min_amt=24
}
else if(folding_type=="FDT20"){
folding_type_key="FDT15";
folding_unit_min_amt=24
}
else{
alert('고객이 선택한 접지 타입이 없습니다.\n\n개발실로 문의 해주세요.')
}
$('work_filename').value=work_filename;
$('folding_unit_min_amt').value=folding_unit_min_amt;
var pp_folding_price=jsonPath(ppFoldingJsonOBJ,"$.pp_folding_price[?(@.folding_type=='"+folding_type_key+"')][?(@.num=='"+num_unit+"')][?(@.size_type=='"+paper_size+"')]");
if(num_unit>100){
folding_unit_price=0
}
else{
folding_unit_price=parseInt(pp_folding_price[0].unit_price)
}
var paper_weight=this.getPaperWeight();
var folding_extra_rate=Math.max((paper_weight-150),1);
var folding_extra_rate2=folding_extra_rate/350+1;
folding_extra_rate2=Math.round(folding_extra_rate2*100)/100;
if(folding_type=="FDT01"||folding_type=="FDT02"||folding_type=="FDT03"||folding_type=="FDT04"){
var unit_price_FDT02=(folding_unit_price-1000)*folding_extra_rate2;
if(folding_type=="FDT01"){
this.unit_price=unit_price_FDT02
}
if(folding_type=="FDT02"){
this.unit_price=unit_price_FDT02
}
if(folding_type=="FDT03"){
this.unit_price=(unit_price_FDT02*1.05)
}
if(folding_type=="FDT04"){
this.unit_price=unit_price_FDT02
}

}
if(folding_type=="FDT05"||folding_type=="FDT06"||folding_type=="FDT07"){
if(folding_type=="FDT05"){
this.unit_price=folding_unit_price*0.96-8000
}
if(folding_type=="FDT06"){
this.unit_price=(folding_unit_price*0.96-8000)*1.2
}
if(folding_type=="FDT07"){
this.unit_price=(folding_unit_price*0.96-8000)*1.3
}

}
if(folding_type=="FDT08"||folding_type=="FDT09"){
if(folding_type=="FDT08"){
this.unit_price=Math.round(folding_unit_price/1.1)
}
if(folding_type=="FDT09"){
this.unit_price=folding_unit_price
}

}
if(folding_type=="FDT10"){
this.unit_price=folding_unit_price*0.81-4000
}
if(folding_type=="FDT12"||folding_type=="FDT11"||folding_type=="FDT13"||folding_type=="FDT16"||folding_type=="FDT17"){
if(folding_type=="FDT12"){
this.unit_price=folding_unit_price
}
if(folding_type=="FDT11"){
this.unit_price=folding_unit_price
}
if(folding_type=="FDT13"){
this.unit_price=folding_unit_price
}
if(folding_type=="FDT16"){
this.unit_price=folding_unit_price
}
if(folding_type=="FDT17"){
this.unit_price=folding_unit_price
}

}
if(folding_type=="FDT18"){
this.unit_price=folding_unit_price
}
if(folding_type=="FDT14"||folding_type=="FDT15"||folding_type=="FDT19"||folding_type=="FDT20"){
if(folding_type=="FDT14"){
this.unit_price=folding_unit_price
}
if(folding_type=="FDT15"){
this.unit_price=folding_unit_price
}
if(folding_type=="FDT19"){
this.unit_price=folding_unit_price
}
if(folding_type=="FDT20"){
this.unit_price=folding_unit_price
}

}
if(pp_folding_price){

}
else{
this.unit_price=0;
this.setFoldingPrice(0);
this.checkMsg("folding",paper_size+"는 접지가 불가능한 규격입니다.","paper_size");
if(this.pp_folding_cnt==1){
alert("별도문의 바랍니다.");
this.pp_folding_cnt++
}
else{
this.pp_folding_cnt=1
}

}

}
,getCoatingExtraRate:function(){
folding_type=this.getFoldingType();
coating_type=this.getCoatingType();
if(this.getIsCoating()){
var pp_folding_coating=jsonPath(ppFoldingJsonOBJ,"$.pp_folding_coating[?(@.folding_type=='"+folding_type+"')][?(@.coating_type=='"+coating_type+"')]");
if(pp_folding_coating){
extra_rate=parseFloat(pp_folding_coating[0].extra_rate)
}
else{
extra_rate=1
}

}
else{
extra_rate=1
}
return extra_rate
}

}
);
var ppLaminex=Class.create(Postpress,{
initialize:function($super){
$super();
this.save_laminex_num=$("save_laminex_num").value
}
,getLaminexNum:function(){
if($('laminex_num').value==""){
return this.save_laminex_num
}
else{
return $('laminex_num').value
}

}
,setLaminexPrice:function(price){
$('laminex_amt').value=price
}
,getLaminexPrice:function(){
return $('laminex_amt').value
}
,getIsPPLaminex:function(){
if($('chk_is_laminex').checked==true){
return true
}
else{
return false
}

}
,getIsPPNumbering:function(){
if($('chk_is_numbering').checked==true){
return true
}
else{
return false
}

}
,setNumberingPrice:function(price){
$('numbering_amt').value=price
}
,optionLaminexNum:function(){
thisLaminexNum=this.getLaminexNum();
this.initSelectOptions('laminex_num');
var thisQty=0;
thisSeq=0;
for(i=0;
i<9;
i++){
thisQty=thisQty+100;
if(thisLaminexNum==thisQty){
thisSeq=i
}
$('laminex_num').options[i]=new Option(thisQty+" 매",thisQty,false)
}
var thisQty2=500;
for(j=9;
j<28;
j++){
thisQty2=thisQty2+500;
if(thisLaminexNum==thisQty2){
thisSeq=j
}
$('laminex_num').options[j]=new Option(thisQty2+" 매",thisQty2,false)
}
$('laminex_num').options[thisSeq].selected=true
}
,checkIsLaminex:function(){
var paper_size=this.getPaperSize();
var size_type=this.getSizeType();
var paper_weight=this.getPaperWeight();
var is_pp_cutting=this.getIsPPCutting();
var is_laminex=true;
if(paper_size!="A0500"&&paper_size!="A0400"&&paper_size!="A0300"&&paper_size!="B0600"&&paper_size!="B0500"&&paper_size!="B0400"){
is_laminex=false;
this.checkMsg("laminex","라미넥스가 불가능한 규격입니다.","paper_size")
}
if(size_type=="SZT20"){
is_laminex=false;
this.checkMsg("laminex","별사이즈는 라미넥스가 불가능합니다.","size_type")
}
if(paper_weight<150){
is_laminex=false;
this.checkMsg("laminex","라미넥스는 용지평량이 150g 이상부터가능합니다.","paper_code")
}
if(is_pp_cutting){
is_laminex=false;
this.checkMsg("laminex","추가재단이 있을 경우 라미넥스는 불가능합니다.","cutting_type")
}
if(this.getIsPPNumbering()=="1"&&$('numbering_type').disabled==false){
is_laminex=true;
$('numbering_type').disabled=true;
$('numbering_num').disabled=true;
this.setNumberingPrice(0);
this.checkMsg("numbering","라미넥스를 할 경우 넘버링이 불가능합니다.","numbering_type")
}
return is_laminex
}
,calcuLaminexPrice:function(){
if(this.getIsPPLaminex()){
var laminex_num=this.getLaminexNum();
var is_laminex=this.checkIsLaminex();
var paper_size=this.getPaperSize();
if(is_laminex){
this.checkMsg("laminex","","");
this.optionLaminexNum();
if(laminex_num==''){
laminex_num=100
}
unit_price=0;
if(paper_size=="A0500"||paper_size=="B0600"){
if(laminex_num>=100&&laminex_num<200){
unit_price=180
}
else if(laminex_num>=200&&laminex_num<300){
unit_price=130
}
else if(laminex_num>=300&&laminex_num<400){
unit_price=120
}
else if(laminex_num>=400&&laminex_num<500){
unit_price=120
}
else if(laminex_num>=500){
unit_price=120
}

}
else if(paper_size=="A0400"||paper_size=="B0500"){
if(laminex_num>=100&&laminex_num<200){
unit_price=230
}
else if(laminex_num>=200&&laminex_num<300){
unit_price=230
}
else if(laminex_num>=300&&laminex_num<400){
unit_price=200
}
else if(laminex_num>=400&&laminex_num<500){
unit_price=180
}
else if(laminex_num>=500){
unit_price=160
}

}
else if(paper_size=="A0300"||paper_size=="B0400"){
if(laminex_num>=100&&laminex_num<200){
unit_price=400
}
else if(laminex_num>=200&&laminex_num<300){
unit_price=350
}
else if(laminex_num>=300&&laminex_num<400){
unit_price=340
}
else if(laminex_num>=400&&laminex_num<500){
unit_price=330
}
else if(laminex_num>=500){
unit_price=320
}

}
else{
unit_price=0
}
laminex_sale=Math.max(1-(laminex_num/10000),0.9);
 laminex_price1=unit_price*laminex_num+5000;
laminex_price2=25000;
laminex_price=Math.max(laminex_price1,laminex_price2)*laminex_sale;
laminex_price=Math.ceil(laminex_price/1000)*1000;
laminex_price=this.calcuLaminexPrice_new();
this.setLaminexPrice(laminex_price)
}
else{
this.setLaminexPrice(0);
this.initSelectOptions('laminex_num');
$('laminex_num').options[0]=new Option("없음","0",false)
}

}
else{
this.setLaminexPrice(0)
}

}
,calcuLaminexPrice_new:function(){
var laminex_num=this.getLaminexNum();
var is_laminex=this.checkIsLaminex();
var paper_size=this.getPaperSize();
var laminex_price=0;
if(paper_size=='A0300'){
var A3_cost500=(500-1)*Math.ceil(300/0.95)+1600;
A3_cost500=Math.ceil(A3_cost500/100)*100;
var A3_cost1000=327000;
var A3_cost10000=3415000;
if(laminex_num>0&&laminex_num<=500){
laminex_price=(laminex_num-1)*Math.ceil(300/0.95)+1600;
laminex_price=Math.ceil(laminex_price/100)*100
}
else if(laminex_num>500&&laminex_num<=1000){
laminex_price=A3_cost500-(A3_cost500-A3_cost1000)/500*(laminex_num-500);
laminex_price=Math.ceil(laminex_price/1000)*1000
}
else if(laminex_num>1000&&laminex_num<=10000){
laminex_price=A3_cost1000-(A3_cost1000-A3_cost10000)/9000*(laminex_num-1000);
laminex_price=Math.ceil(laminex_price/1000)*1000
}

}
else if(paper_size=='A0400'){
var A4_cost100=Math.floor(((100-1)*Math.floor(160/0.94)+1300)/1000)*1000;
var A4_cost1000=161000;
var A4_cost10000=1470000;
if(laminex_num>0&&laminex_num<=100){
laminex_price=(laminex_num-1)*Math.floor(160/0.94)+1300-100;
laminex_price=Math.floor(laminex_price/100)*100
}
else if(laminex_num>100&&laminex_num<=500){
laminex_price=A4_cost100-(A4_cost100-A4_cost1000)/900*(laminex_num-100);
laminex_price=Math.ceil(laminex_price/100)*100
}
else if(laminex_num>500&&laminex_num<=1000){
laminex_price=A4_cost100-(A4_cost100-A4_cost1000)/900*(laminex_num-100);
laminex_price=Math.ceil(laminex_price/1000)*1000
}
else if(laminex_num>1000&&laminex_num<=10000){
laminex_price=A4_cost1000-(A4_cost1000-A4_cost10000)/9000*(laminex_num-1000);
laminex_price=Math.ceil(laminex_price/1000)*1000
}

}
else if(paper_size=='A0500'){
var A5_cost100=17000;
var A5_cost1000=135000;
var A5_cost10000=1160000;
if(laminex_num>0&&laminex_num<=500){
laminex_price=A5_cost100-((A5_cost100-A5_cost1000)/900*(laminex_num-100));
laminex_price=Math.ceil(laminex_price/100)*100
}
else if(laminex_num>500&&laminex_num<=1000){
laminex_price=A5_cost100-((A5_cost100-A5_cost1000)/900*(laminex_num-100));
laminex_price=Math.ceil(laminex_price/1000)*1000
}
else if(laminex_num>1000&&laminex_num<=10000){
laminex_price=A5_cost1000-((A5_cost1000-A5_cost10000)/9000*(laminex_num-1000));
laminex_price=Math.ceil(laminex_price/1000)*1000
}

}
else if(paper_size=='B0400'){
var B4_cost1=1600;
var B4_cost500=151300;
var B4_cost1000=290000;
var B4_cost10000=2690000;
if(laminex_num>0&&laminex_num<=500){
laminex_price=(laminex_num-1)*Math.ceil(270/0.9)+B4_cost1;
laminex_price=Math.ceil(laminex_price/100)*100
}
else if(laminex_num>500&&laminex_num<=1000){
laminex_price=B4_cost500-(B4_cost500-B4_cost1000)/500*(laminex_num-500);
laminex_price=Math.ceil(laminex_price/1000)*1000
}
else if(laminex_num>1000&&laminex_num<=10000){
laminex_price=B4_cost1000-(B4_cost1000-B4_cost10000)/9000*(laminex_num-1000);
laminex_price=Math.ceil(laminex_price/1000)*1000
}

}
else if(paper_size=='B0500'){
var B5_cost1=1300;
var B5_cost100=(100-1)*Math.floor(160/0.95)+B5_cost1-100;
B5_cost100=Math.floor(B5_cost100/100)*100;
var B5_cost1000=157000;
var B5_cost10000=1350000;
if(laminex_num>0&&laminex_num<=100){
laminex_price=(laminex_num-1)*Math.floor(160/0.95)+B5_cost1-100;
laminex_price=Math.floor(laminex_price/100)*100
}
else if(laminex_num>100&&laminex_num<=500){
laminex_price=B5_cost100-((B5_cost100-B5_cost1000)/900*(laminex_num-100));
laminex_price=Math.ceil(laminex_price/100)*100
}
else if(laminex_num>500&&laminex_num<=1000){
laminex_price=B5_cost100-((B5_cost100-B5_cost1000)/900*(laminex_num-100));
laminex_price=Math.ceil(laminex_price/1000)*1000
}
else if(laminex_num>1000&&laminex_num<=10000){
laminex_price=B5_cost1000-((B5_cost1000-B5_cost10000)/9000*(laminex_num-1000));
laminex_price=Math.ceil(laminex_price/1000)*1000
}

}
else if(paper_size=='B0600'){
var B6_cost100=14000;
var B6_cost200=28300;
var B6_cost10000=1100000;
if(laminex_num==100){
laminex_price=B6_cost100
}
else if(laminex_num>100&&laminex_num<=500){
laminex_price=B6_cost200-(B6_cost200-B6_cost10000)/9800*(laminex_num-200);
laminex_price=Math.ceil(laminex_price/100)*100
}
else if(laminex_num>500&&laminex_num<=10000){
laminex_price=B6_cost200-(B6_cost200-B6_cost10000)/9800*(laminex_num-200);
laminex_price=Math.ceil(laminex_price/1000)*1000
}

}
return laminex_price
}

}
);
var ppStitching=Class.create(Postpress,{
initialize:function($super){
$super()
}
,getStitchingType:function(){
if($('stitching_type').value==""){
return $('save_stitching_type').value
}
else{
return $('stitching_type').value
}

}
,getStitchingDirection:function(){
return $('stitching_direction').value
}
,setStitchingPrice:function(price){
$('stitching_amt').value=price
}
,getStitchingPrice:function(){
return $('stitching_amt').value
}
,getIsPPStitching:function(){
if($('chk_is_stitching').checked==true){
return true
}
else{
return false
}

}
,settingStitchingType:function(){
paper_size=this.getPaperSize();
stitching_type=this.getStitchingType();
stitching_direction=this.getStitchingDirection();
this.initSelectOptions('stitching_type');
if(paper_size=="A0200"||paper_size=="A0100"||paper_size=="B0300"||paper_size=="B0200"){
if(paper_size=="A0200"){
$('stitching_type').options[0]=new Option("A4(국8절) 8page","SHT40",true)
}
else if(paper_size=="A0100"){
$('stitching_type').options[0]=new Option("A4(국8절) 12page","SHT50",false);
$('stitching_type').options[1]=new Option("A4(국8절) 16page","SHT60",false);
if(stitching_type=="SHT50"){
$('stitching_type').options[0].selected=true
}
else{
$('stitching_type').options[1].selected=true
}

}
else if(paper_size=="B0300"){
$('stitching_type').options[0]=new Option("B5(16절) 8page","SHT10",true)
}
else if(paper_size=="B0200"){
$('stitching_type').options[0]=new Option("B5(16절) 12page","SHT20",false);
$('stitching_type').options[1]=new Option("B5(16절) 16page","SHT30",false);
if(stitching_type=="SHT20"){
$('stitching_type').options[0].selected=true
}
else{
$('stitching_type').options[1].selected=true
}

}
$('stitching_type').disabled=false;
$('stitching_direction').disabled=false;
if(stitching_direction=="SHD10"){
$('stitching_direction')[1].selected=true
}
else if(stitching_direction=="SHD20"){
$('stitching_direction')[2].selected=true
}
else{
$('stitching_direction')[0].selected=true
}
this.checkMsg("stitching","","")
}
else{
$('stitching_type').options[0]=new Option("중철안됨","",true);
$('stitching_type').disabled=true;
$('stitching_direction')[0].selected=true;
$('stitching_direction').value='';
$('stitching_direction').disabled=true;
this.setStitchingPrice(0);
this.checkMsg("stitching","중철이 가능한 규격이 아닙니다.","paper_size")
}

}
,calcuStitchingPrice:function(){
if(this.getIsPPStitching()){
this.checkMsg("stitching","","");
this.settingStitchingType();
var stitching_type=this.getStitchingType();
if(stitching_type=="SHT10"){
stitching_summary=""
}
else if(stitching_type=="SHT20"){
stitching_summary=" 4P버리기"
}
else if(stitching_type=="SHT30"){
stitching_summary=""
}
else if(stitching_type=="SHT40"){
stitching_summary=""
}
else if(stitching_type=="SHT50"){
stitching_summary=" 4P버리기"
}
else if(stitching_type=="SHT60"){
stitching_summary=""
}
else{
stitching_summary=""
}
$('stitching_type_summary').update(stitching_summary);
var stitching_direction=this.getStitchingDirection();
var paper_qty=this.getPaperQty();
if(stitching_direction=="SHD10"){
unit_price=20
}
else if(stitching_direction=="SHD20"){
unit_price=30
}
else{
unit_price=0
}
if(stitching_direction!=""){
stitching_price=paper_qty*unit_price+30000
}
else{
stitching_price=0
}
this.setStitchingPrice(stitching_price)
}
else{
this.setStitchingPrice(0);
this.outputDebugMsg("[calcuLaminexPrice]laminex_price:0")
}

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
if($('chk_is_epoxy').checked==true){
var category_code=this.getCategoryCode();
var paper_code=this.getPaperCode();
var epoxy_type=this.getEpoxyType();
var paper_qty=parseInt($('paper_qty').value);
var order_count=parseInt($('order_count').value);
var cut_num=$('cut_num').value;
var parts_num=$("parts_num").value;
var size_M3=cut_num;
var ep_B3=0;
var ep_C3='';
var ep_D3='';
var ep_E3=parseFloat($('work_x_size').value);
var ep_F3=parseFloat($('work_y_size').value);
var ep_C4='A1';
var ep_C5='B2';
var ep_C6='A2';
var ep_D4='PTK10';
var ep_D5='PTK20';
var ep_D6='PTK10';
var ep_E4=900;
var ep_E5=760;
var ep_E6=450;
var ep_F4=610;
var ep_F5=525;
var ep_F6=610;
var ep_H4=Math.floor(ep_E4/ep_E3);
var ep_H5=Math.floor(ep_E5/ep_E3);
var ep_H6=Math.floor(ep_E6/ep_E3);
var ep_I4=Math.floor(ep_F4/ep_F3);
var ep_I5=Math.floor(ep_F5/ep_F3);
var ep_I6=Math.floor(ep_F6/ep_F3);
var ep_J4=Math.floor(ep_F4/ep_E3);
var ep_J5=Math.floor(ep_F5/ep_E3);
var ep_J6=Math.floor(ep_F6/ep_E3);
var ep_K4=Math.floor(ep_E4/ep_F3);
var ep_K5=Math.floor(ep_E5/ep_F3);
var ep_K6=Math.floor(ep_E6/ep_F3);
var ep_M4=ep_H4*ep_I4;
var ep_M5=ep_H5*ep_I5;
var ep_M6=ep_H6*ep_I6;
var ep_N4=ep_J4*ep_K4;
var ep_N5=ep_J5*ep_K5;
var ep_N6=ep_J6*ep_K6;
var ep_P4=Math.max(ep_M4,ep_N4);
var ep_P5=Math.max(ep_M5,ep_N5);
var ep_P6=Math.max(ep_M6,ep_N6);
var ep_R4=1;
var ep_R5=2;
var ep_R6=2;
var ep_B4=ep_E4*ep_F4*ep_P4;
var ep_B5=ep_E5*ep_F5*ep_P5;
var ep_B6=ep_E6*ep_F6*ep_P6;
if(ep_B4==0&&ep_B4==0&&ep_B4==0){
this.setEpoxyPrice(0);
return false
}
var ep_B3_arry=new Array(ep_B4,ep_B5,ep_B6);
ep_B3_arry.sort(function(a,b){
return a-b
}
);
for(var j=0;
ep_B3_arry.length;
j++){
if(parseInt(ep_B3_arry[j])>0){
ep_B3=ep_B3_arry[j];
break
}

}
var ep_B_arry=new Array(ep_B4,ep_B5,ep_B6);
var ep_C_arry=new Array(ep_C4,ep_C5,ep_C6);
var ep_D_arry=new Array(ep_D4,ep_D5,ep_D6);
var ep_R_arry=new Array(ep_R4,ep_R5,ep_R6);
for(var i=0;
i<ep_B_arry.length;
i++){
if(ep_B3==ep_B_arry[i]){
ep_C3=ep_C_arry[i];
ep_D3=ep_D_arry[i];
ep_R3=ep_R_arry[i]
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
ep_T2_arry.length;
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
i<ep_T_arry.length;
i++){
if(ep_T2==ep_T_arry[i]){
ep_U2=ep_U_arry[i];
ep_V2=ep_V_arry[i];
ep_W2=ep_W_arry[i];
ep_X2=ep_X_arry[i];
ep_Y2=ep_Y_arry[i]
}

}
epoxy_unit_cost=paper_qty/size_M3*ep_Y2;
epoxy_amt=epoxy_unit_cost*ep_W2;
epoxy_price=Math.max(epoxy_amt+10000,ep_V2)
}
this.setEpoxyPrice(epoxy_price)
}

}
);
