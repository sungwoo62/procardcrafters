var Postpress=Class.create(Print,{
initialize:function($super){
$super()
}

}
);
var ppMissing=Class.create(Postpress,{
initialize:function($super){
$super();
this.unit_price=0;
this.mock_price=0
}
,dataLoad:function(){
new Ajax.Request('/estimate/estimate_goods/pp_missing_json_data',{
asynchronous:false,method:"post",parameters:{
"t":timestamp,"product":"name"
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
return parseInt($('save_missing_num').value)
}
else{
return parseInt($('missing_num').value)
}

}
,setMissingAmt:function(price){
$('missing_amt').value=price
}
,getMissingType:function(){
if($('missing_type').value==""){
return $('save_missing_type').value
}
else{
return $('missing_type').value
}

}
,getMissingNum:function(){
if($('missing_num').value==""){
return $('save_missing_num').value
}
else{
return $('missing_num').value
}

}
,settingMissingType:function(){
var cut_x_size=$('cut_x_size').value;
var cut_y_size=$('cut_y_size').value;
var cut_max_size=Math.max(cut_x_size,cut_y_size);
var cut_jelsu=parseInt(Math.floor(cut_max_size/100));
this_missing_num=this.getMissingNum();
print1.initSelectOptions('missing_num');
var j=1;
for(i=0;
i<cut_jelsu;
i++){
$('missing_num').options[i]=new Option(j+"줄",j,false);
j++
}
print1.thisPositionSelectOptions("missing_num",this_missing_num);
$('missing_num2').value=$('missing_num').value;
this_binding_unit_type=$('binding_unit_type').value;
this_missing_type=this.getMissingType();
print1.initSelectOptions('missing_type');
if(this_binding_unit_type=='2'){
$('missing_type').options[0]=new Option("상지/하지","NCE22",false);
$('missing_type').options[1]=new Option("상지","NCE20",false);
$('missing_type').options[2]=new Option("하지","NCE21",false)
}
else if(this_binding_unit_type=='3'){
$('missing_type').options[0]=new Option("상지/중지/하지","NCE35",false);
$('missing_type').options[1]=new Option("상지","NCE30",false);
$('missing_type').options[2]=new Option("중지","NCE31",false);
$('missing_type').options[3]=new Option("하지","NCE32",false)
}
else if(this_binding_unit_type=='4'){
$('missing_type').options[0]=new Option("상지/중지/중지/하지","NCE47",false);
$('missing_type').options[1]=new Option("상지","NCE40",false);
$('missing_type').options[2]=new Option("중지1","NCE41",false);
$('missing_type').options[3]=new Option("중지2","NCE42",false);
$('missing_type').options[4]=new Option("하지","NCE43",false)
}
print1.thisPositionSelectOptions("missing_type",this_missing_type);
this_missing_type=this.getMissingType();
var missing_type_unit=0;
if(this_missing_type=='NCE22'){
missing_type_unit=2
}
else if(this_missing_type=='NCE20'){
missing_type_unit=1
}
else if(this_missing_type=='NCE21'){
missing_type_unit=1
}
else if(this_missing_type=='NCE35'){
missing_type_unit=3
}
else if(this_missing_type=='NCE30'){
missing_type_unit=1
}
else if(this_missing_type=='NCE31'){
missing_type_unit=1
}
else if(this_missing_type=='NCE32'){
missing_type_unit=1
}
else if(this_missing_type=='NCE47'){
missing_type_unit=4
}
else if(this_missing_type=='NCE40'){
missing_type_unit=1
}
else if(this_missing_type=='NCE41'){
missing_type_unit=1
}
else if(this_missing_type=='NCE42'){
missing_type_unit=1
}
else if(this_missing_type=='NCE43'){
missing_type_unit=1
}
return missing_type_unit
}
,calcuMissingPrice:function(){
var this_missing_type_unit=this.settingMissingType();
this_cut_x_size=print1.getCutXSize();
this_cut_y_size=print1.getCutYSize();
this_cut_max_size=Math.max(this_cut_x_size,this_cut_y_size);
missing_price_1=this_cut_max_size*0.015;
this_bundle_qty=print1.getBundleQty();
missing_price_2=Math.max(1-(this_bundle_qty/3000),0.7);
 this_missing_num=this.getMissingNum();
this_binding_qty=print1.getBindingQty();
this_binding_unit_type=print1.getBindingUnitType();
if(this_missing_num&&$('chk_is_missing').checked){
missing_price_3=Math.max((this_binding_qty*this_bundle_qty*this_missing_type_unit*missing_price_1)+(this_missing_type_unit*7000),(this_missing_type_unit*7000))*missing_price_2;
missing_price_3=Math.ceil(missing_price_3/1000)*1000;
missing_price_3=Math.max(missing_price_3,20000)
}
else{
missing_price_3=0
}
this.setMissingAmt(missing_price_3)
}

}
);
var ppNumbering=Class.create(Postpress,{
initialize:function($super){
$super()
}
,getNumberingNum:function(){
if($('numbering_num').value==""){
return $('save_numbering_num').value
}
else{
return $('numbering_num').value
}

}
,setNumberingPrice:function(price){
$('numbering_amt').value=price
}
,getNumberingType:function(){
if($('numbering_type').value==""){
return $('save_numbering_type').value
}
else{
return $('numbering_type').value
}

}
,getPaperQty:function(){
if($('paper_qty').value==""){
return parseInt($('save_paper_qty').value)
}
else{
return parseInt($('paper_qty').value)
}

}
,settingNumberingType:function(){
this_binding_unit_type=$('binding_unit_type').value;
this_numbering_type=this.getNumberingType();
print1.initSelectOptions('numbering_type');
if(this_binding_unit_type=='2'){
$('numbering_type').options[0]=new Option("상지/하지","NCE22",false);
$('numbering_type').options[1]=new Option("상지","NCE20",false);
$('numbering_type').options[2]=new Option("하지","NCE21",false)
}
else if(this_binding_unit_type=='3'){
$('numbering_type').options[0]=new Option("상지/중지/하지","NCE35",false);
$('numbering_type').options[1]=new Option("상지","NCE30",false);
$('numbering_type').options[2]=new Option("중지","NCE31",false);
$('numbering_type').options[3]=new Option("하지","NCE32",false)
}
else if(this_binding_unit_type=='4'){
$('numbering_type').options[0]=new Option("상지/중지/중지/하지","NCE47",false);
$('numbering_type').options[1]=new Option("상지","NCE40",false);
$('numbering_type').options[2]=new Option("중지1","NCE41",false);
$('numbering_type').options[3]=new Option("중지2","NCE42",false);
$('numbering_type').options[4]=new Option("하지","NCE43",false)
}
print1.thisPositionSelectOptions("numbering_type",this_numbering_type);
this_numbering_type=this.getNumberingType();
var numbering_type_unit=0;
if(this_numbering_type=='NCE22'){
numbering_type_unit=2
}
else if(this_numbering_type=='NCE20'){
numbering_type_unit=1
}
else if(this_numbering_type=='NCE21'){
numbering_type_unit=1
}
else if(this_numbering_type=='NCE35'){
numbering_type_unit=3
}
else if(this_numbering_type=='NCE30'){
numbering_type_unit=1
}
else if(this_numbering_type=='NCE31'){
numbering_type_unit=1
}
else if(this_numbering_type=='NCE32'){
numbering_type_unit=1
}
else if(this_numbering_type=='NCE47'){
numbering_type_unit=4
}
else if(this_numbering_type=='NCE40'){
numbering_type_unit=1
}
else if(this_numbering_type=='NCE41'){
numbering_type_unit=1
}
else if(this_numbering_type=='NCE42'){
numbering_type_unit=1
}
else if(this_numbering_type=='NCE43'){
numbering_type_unit=1
}
return numbering_type_unit
}
,calcuNumberingPrice:function(){
var this_numbering_type_unit=this.settingNumberingType();
this_cut_x_size=print1.getCutXSize();
this_cut_y_size=print1.getCutYSize();
this_cut_max_size=Math.max(this_cut_x_size,this_cut_y_size);
numbering_price_1=this_cut_max_size*0.035;
paper_price_1=$('paper_price_1').value;
numbering_price_2=Math.max(1-(paper_price_1/20),0.7)*1.11;
 this_numbering_type=this.getNumberingNum();
this_bundle_qty=print1.getBundleQty();
this_binding_qty=print1.getBindingQty();
this_binding_unit_type=print1.getBindingUnitType();
if(this_numbering_type=='1'){
numbering_extra=1
}
else{
numbering_extra=1.2
}
if(this_numbering_type&&$('chk_is_numbering').checked){
numbering_price_3=(numbering_price_1*(this_bundle_qty*this_binding_qty*this_numbering_type_unit)+(this_numbering_type_unit*15000))*numbering_price_2*numbering_extra;
numbering_price_3=Math.ceil(numbering_price_3/1000)*1000;
numbering_price_3=Math.max(numbering_price_3,47000)
}
else{
numbering_price_3=0
}
this.setNumberingPrice(numbering_price_3)
}
,calcuNumberingNo:function(){
$j('#numbering_end').css('background','#CCCCCC');
var numbering_start=Number($('numbering_start').value);
var numbering_start2=Number($('numbering_start2').value);
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
var numbering_end=this_bundle_qty*this_binding_qty+numbering_start-1;
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
$('numbering_end2').value=numbering_end
}

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
"t":timestamp,"product":"name"
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
,getTagongNum:function(){
return parseInt($('tagong_num').value)
}
,setTagongPrice:function(price){
$('tagong_amt').value=price
}
,calcuTagongPrice:function(){
this_tagong_num=this.getTagongNum();
this_binding_qty=print1.getBindingQty();
this_binding_unit_type=print1.getBindingUnitType();
this_bundle_qty=print1.getBundleQty();
tagong_price_1=this_tagong_num*this_binding_qty*this_binding_unit_type*this_bundle_qty;
tagong_price_2=Math.max(1-(tagong_price_1/100),0.7);
 if(this_tagong_num&&$('chk_is_tagong').checked){
tagong_price_3=this_tagong_num*(this_bundle_qty*this_binding_qty*this_binding_unit_type)*2*tagong_price_2;
tagong_price_3=Math.ceil(tagong_price_3/1000)*1000;
tagong_price_3=Math.max(tagong_price_3,10000)
}
else{
tagong_price_3=0
}
this.setTagongPrice(tagong_price_3)
}

}
);
