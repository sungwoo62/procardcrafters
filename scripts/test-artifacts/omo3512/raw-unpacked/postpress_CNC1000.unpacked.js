var Postpress=Class.create(Print,{
initialize:function($super){
$super()
}

}
);
var ppOsi=Class.create(Postpress,{
initialize:function($super){
$super();
this.save_osi_num=$("save_osi_num").value;
this.save_osi_num2=$("save_osi_num2").value
}
,getOsiNum:function(){
if($('osi_num').value==""){
return $("save_osi_num").value
}
else{
return $('osi_num').value
}

}
,getOsiDirection:function(){
if($('osi_direction').value==""){
return $("save_osi_direction").value
}
else{
return $('osi_direction').value
}

}
,getOsiNum2:function(){
if($('osi_num').value==""){
return $("save_osi_num2").value
}
else{
return $('osi_num2').value
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
,setMoghyeongPrice:function(price){
$('osi_mok_amt').value=price
}
,settingOsiNum:function(){
var this_osi_num=this.getOsiNum();
var this_osi_kind=this.getOsiKind();
this.initSelectOptions('osi_num');
$('osi_num').options[0]=new Option("1줄(중앙)","OSN01",false);
$('osi_num').options[1]=new Option("1줄(중앙아님)","OSN11",false);
if($('osi_direction').value==''||$('osi_direction').value=='OMD20'||$('osi_direction').value=='OMD30'){
$('osi_num').options[2]=new Option("2줄","OSN02",false);
$('osi_num').options[3]=new Option("3줄","OSN03",false);
$('osi_num').options[4]=new Option("2줄(십자)","OSN04",false);
$('osi_num').options[5]=new Option("오시2줄(양끝 10mm미만)","OSN05",false);
$('osi_num').options[6]=new Option("오시2줄(오시간격 30mm미만)","OSN06",false)
}
if(this_osi_num=='OSN01'||this_osi_num=='OSN11'){
this_osi_num=this_osi_kind
}
this.thisPositionSelectOptions("osi_num",this_osi_num);
if(this_osi_num=='OSN01'||this_osi_num==''){
$('osi_num2').value=1;
$('osi_kind').value='OSN01'
}
else if(this_osi_num=='OSN11'){
$('osi_num2').value=1;
$('osi_kind').value='OSN11'
}
else if(this_osi_num=='OSN02'){
$('osi_num2').value=2;
$('osi_kind').value='OSN02'
}
else if(this_osi_num=='OSN03'){
$('osi_num2').value=3;
$('osi_kind').value='OSN03'
}
else if(this_osi_num=='OSN04'){
$('osi_num2').value=2;
$('osi_kind').value='OSK01'
}
else if(this_osi_num=='OSN05'){
$('osi_num2').value=2;
$('osi_kind').value='OSK02'
}
else if(this_osi_num=='OSN06'){
$('osi_num2').value=2;
$('osi_kind').value='OSK03'
}

}
,settingOsiDirection:function(){
var this_osi_direction=this.getOsiDirection();
var cut_x_size=this.getCutXSize();
var cut_y_size=this.getCutYSize();
osi_direction_max=Math.max(cut_x_size,cut_y_size);
osi_direction_max=Math.ceil(osi_direction_max/100)*100;
 osi_direction_percent=Math.max(cut_x_size,cut_y_size)/Math.min(cut_x_size,cut_y_size);
osi_direction_percent=Math.round(osi_direction_percent,1);
this.initSelectOptions('osi_direction');
$('osi_direction').options[0]=new Option("오시방향선택","",false);
if(cut_x_size>cut_y_size){
$('osi_direction').options[1]=new Option("세로방향(짧게)","OMD20",false);
$('osi_direction').options[2]=new Option("가로방향(길게)","OMD10",false)
}
else if(cut_x_size<cut_y_size){
$('osi_direction').options[1]=new Option("가로방향(짧게)","OMD30",false);
$('osi_direction').options[2]=new Option("세로방향(길게)","OMD40",false)
}
else{
$('osi_direction').options[1]=new Option("세로방향(짧게)","OMD20",false);
$('osi_direction').options[2]=new Option("가로방향(길게)","OMD10",false);
$('osi_direction').options[3]=new Option("가로방향(짧게)","OMD30",false);
$('osi_direction').options[4]=new Option("세로방향(길게)","OMD40",false)
}
this.thisPositionSelectOptions("osi_direction",this_osi_direction);
if($('osi_direction').value=='OMD10'||$('osi_direction').value=='OMD40'){
osi_direction_unit=this.getOsiDirectionUnit(osi_direction_max,osi_direction_percent)
}
else{
osi_direction_unit=0
}
if(($('osi_num').value!='OSN01'&&$('osi_num').value!='')&&($('osi_num').value!='OSN11'&&$('osi_num').value!='')&&($('osi_direction').value=='OMD10'||$('osi_direction').value=='OMD40')){
alert('오시방향이 길게인 경우는 오시줄이 한줄만 선택가능 합니다.\n\n주문 사항이 다른 경우는 별도견적 문의 하세요.');
$('osi_num').focus()
}
return osi_direction_unit
}
,getOsiDirectionUnit:function(osi_direction_max,osi_direction_percent){
if(osi_direction_max=='100'&&osi_direction_percent=='2'){
osi_direction_unit=2000
}
else if(osi_direction_max=='100'&&osi_direction_percent=='3'){
osi_direction_unit=5000
}
else if(osi_direction_max=='100'&&osi_direction_percent=='4'){
osi_direction_unit=5000
}
else if(osi_direction_max=='100'&&osi_direction_percent=='5'){
osi_direction_unit=5000
}
else if(osi_direction_max=='100'&&osi_direction_percent=='6'){
osi_direction_unit=5000
}
else if(osi_direction_max=='100'&&osi_direction_percent=='7'){
osi_direction_unit=5000
}
else if(osi_direction_max=='100'&&osi_direction_percent=='8'){
osi_direction_unit=5000
}
else if(osi_direction_max=='100'&&osi_direction_percent=='9'){
osi_direction_unit=5000
}
else if(osi_direction_max=='100'&&osi_direction_percent=='10'){
osi_direction_unit=5000
}
else if(osi_direction_max=='200'&&osi_direction_percent=='2'){
osi_direction_unit=2000
}
else if(osi_direction_max=='200'&&osi_direction_percent=='3'){
osi_direction_unit=5000
}
else if(osi_direction_max=='200'&&osi_direction_percent=='4'){
osi_direction_unit=10000
}
else if(osi_direction_max=='200'&&osi_direction_percent=='5'){
osi_direction_unit=12000
}
else if(osi_direction_max=='200'&&osi_direction_percent=='6'){
osi_direction_unit=14000
}
else if(osi_direction_max=='200'&&osi_direction_percent=='7'){
osi_direction_unit=16000
}
else if(osi_direction_max=='200'&&osi_direction_percent=='8'){
osi_direction_unit=18000
}
else if(osi_direction_max=='200'&&osi_direction_percent=='9'){
osi_direction_unit=20000
}
else if(osi_direction_max=='200'&&osi_direction_percent=='10'){
osi_direction_unit=22000
}
else if(osi_direction_max=='300'&&osi_direction_percent=='2'){
osi_direction_unit=2000
}
else if(osi_direction_max=='300'&&osi_direction_percent=='3'){
osi_direction_unit=5000
}
else if(osi_direction_max=='300'&&osi_direction_percent=='4'){
osi_direction_unit=10000
}
else if(osi_direction_max=='300'&&osi_direction_percent=='5'){
osi_direction_unit=12000
}
else if(osi_direction_max=='300'&&osi_direction_percent=='6'){
osi_direction_unit=14000
}
else if(osi_direction_max=='300'&&osi_direction_percent=='7'){
osi_direction_unit=16000
}
else if(osi_direction_max=='300'&&osi_direction_percent=='8'){
osi_direction_unit=18000
}
else if(osi_direction_max=='300'&&osi_direction_percent=='9'){
osi_direction_unit=20000
}
else if(osi_direction_max=='300'&&osi_direction_percent=='10'){
osi_direction_unit=22000
}
else if(osi_direction_max=='400'&&osi_direction_percent=='2'){
osi_direction_unit=2000
}
else if(osi_direction_max=='400'&&osi_direction_percent=='3'){
osi_direction_unit=5000
}
else if(osi_direction_max=='400'&&osi_direction_percent=='4'){
osi_direction_unit=10000
}
else if(osi_direction_max=='400'&&osi_direction_percent=='5'){
osi_direction_unit=12000
}
else if(osi_direction_max=='400'&&osi_direction_percent=='6'){
osi_direction_unit=14000
}
else if(osi_direction_max=='400'&&osi_direction_percent=='7'){
osi_direction_unit=16000
}
else if(osi_direction_max=='400'&&osi_direction_percent=='8'){
osi_direction_unit=18000
}
else if(osi_direction_max=='400'&&osi_direction_percent=='9'){
osi_direction_unit=20000
}
else if(osi_direction_max=='400'&&osi_direction_percent=='10'){
osi_direction_unit=22000
}
else if(osi_direction_max=='500'&&osi_direction_percent=='2'){
osi_direction_unit=5000
}
else if(osi_direction_max=='500'&&osi_direction_percent=='3'){
osi_direction_unit=10000
}
else if(osi_direction_max=='500'&&osi_direction_percent=='4'){
osi_direction_unit=15000
}
else if(osi_direction_max=='500'&&osi_direction_percent=='5'){
osi_direction_unit=20000
}
else if(osi_direction_max=='500'&&osi_direction_percent=='6'){
osi_direction_unit=25000
}
else if(osi_direction_max=='500'&&osi_direction_percent=='7'){
osi_direction_unit=30000
}
else if(osi_direction_max=='500'&&osi_direction_percent=='8'){
osi_direction_unit=35000
}
else if(osi_direction_max=='500'&&osi_direction_percent=='9'){
osi_direction_unit=40000
}
else if(osi_direction_max=='500'&&osi_direction_percent=='10'){
osi_direction_unit=45000
}
else if(osi_direction_max=='600'&&osi_direction_percent=='2'){
osi_direction_unit=5000
}
else if(osi_direction_max=='600'&&osi_direction_percent=='3'){
osi_direction_unit=10000
}
else if(osi_direction_max=='600'&&osi_direction_percent=='4'){
osi_direction_unit=15000
}
else if(osi_direction_max=='600'&&osi_direction_percent=='5'){
osi_direction_unit=20000
}
else if(osi_direction_max=='600'&&osi_direction_percent=='6'){
osi_direction_unit=25000
}
else if(osi_direction_max=='600'&&osi_direction_percent=='7'){
osi_direction_unit=30000
}
else if(osi_direction_max=='600'&&osi_direction_percent=='8'){
osi_direction_unit=35000
}
else if(osi_direction_max=='600'&&osi_direction_percent=='9'){
osi_direction_unit=40000
}
else if(osi_direction_max=='600'&&osi_direction_percent=='10'){
osi_direction_unit=45000
}
else{
osi_direction_unit=0
}
return osi_direction_unit
}
,calcuOsiPrice:function(){
var osi_direction_unit=0;
if(this.getIsPPOsi()){
osi_direction_unit=this.settingOsiDirection();
this.settingOsiNum()
}
osi_num=this.getOsiNum();
if(this.getIsPPOsi()&&osi_num){
var osi_price_unit=this.calcuOsiPriceUnit();
var osi_extra_rate=this.calcuOsiExtraRate();
var osi_discount_rate=this.calcuOsiDiscountRate();
this_order_count=this.getOrderCount();
osi_price=Math.ceil((osi_price_unit*osi_extra_rate*osi_discount_rate-100)/1000)*1000*this_order_count;
osi_price=Math.max(osi_price,4500);
osi_price=osi_price+osi_direction_unit;
var osi_mock_price=0;
if(osi_num=="OSN03"||osi_num=="OSN04"||osi_num=="OSN05"||osi_num=="OSN06"){
osi_mock_price=7500
}
osi_price=osi_price+osi_mock_price;
this.setOsiPrice(osi_price);
this.setMoghyeongPrice(osi_mock_price)
}
else{
this.setOsiPrice(0);
this.setMoghyeongPrice(0)
}

}
,calcuOsiExtraRate:function(){
osi_num=this.getOsiNum();
var osi_extra_rate=1;
if(osi_num=='OSN01'||osi_num=='OSN11'||osi_num=='OSN02'){
osi_extra_rate=1
}
else if(osi_num=='OSN03'){
osi_extra_rate=1.5
}
else if(osi_num=='OSN04'){
osi_extra_rate=2
}
else if(osi_num=='OSN05'){
osi_extra_rate=2.2
}
else if(osi_num=='OSN06'){
osi_extra_rate=2.2
}
return osi_extra_rate
}
,calcuOsiDiscountRate:function(){
this_paper_qty=this.getPaperQty();
osi_discount_price=Math.max(1-(this_paper_qty/20000),0.75);
return osi_discount_price
}
,calcuOsiPriceUnit:function(){
this_paper_qty=this.getPaperQty();
var cut_x_size=this.getCutXSize();
var cut_y_size=this.getCutYSize();
var paper_length_price=0;
var cut_size_max=Math.max(cut_x_size,cut_y_size);
var cut_size_rate=(cut_size_max-100)*0.05+10;
if(cut_size_max<150){
paper_length_price=4500
}
else if(cut_size_max<200){
paper_length_price=5000
}
else if(cut_size_max<250){
paper_length_price=6000
}
else if(cut_size_max<300){
paper_length_price=8000
}
else if(cut_size_max<400){
paper_length_price=10000
}
else if(cut_size_max<500){
paper_length_price=20000
}
else if(cut_size_max<600){
paper_length_price=30000
}
else{
paper_length_price=35000
}
osi_price_unit=Math.max((cut_size_rate*this_paper_qty),paper_length_price);
return osi_price_unit
}

}
);
var ppMissing=Class.create(Postpress,{
initialize:function($super){
$super();
this.save_missing_num=$("save_missing_num").value
}
,getMissingNum:function(){
if($('missing_num').value==""){
return this.save_missing_num
}
else{
return $('missing_num').value
}

}
,getMissingKind:function(){
if($('missing_kind').value==""){
return $('save_missing_kind').value
}
else{
return $('missing_num').value
}

}
,getMissingDirection:function(){
if($('missing_direction').value==""){
return $('save_missing_direction').value
}
else{
return $('missing_direction').value
}

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
,setMoghyeongPrice:function(price){
$('missing_mok_amt').value=price
}
,settingMissingNum:function(){
var paper_weight=this.getPaperWeight();
var this_paper_size=this.getPaperSize();
var this_missing_num=this.getMissingNum();
var this_missing_kind=this.getMissingKind();
this.initSelectOptions('missing_num');
$('missing_num').options[0]=new Option("1줄(중앙)","MSN01",false);
$('missing_num').options[1]=new Option("1줄(중앙아님)","MSN11",false);
if($('missing_direction').value==''||$('missing_direction').value=='OMD20'||$('missing_direction').value=='OMD30'){
$('missing_num').options[2]=new Option("2줄","MSN02",false);
$('missing_num').options[3]=new Option("3줄","MSN03",false);
$('missing_num').options[4]=new Option("2줄(십자)","MSN04",false);
$('missing_num').options[5]=new Option("미싱2줄(양끝 10mm미만)","MSN05",false);
$('missing_num').options[6]=new Option("미싱2줄(미싱간격 30mm미만)","MSN06",false)
}
if(this_missing_num=='MSN01'||this_missing_num=='MSN11'){
this_missing_num=this_missing_kind
}
this.thisPositionSelectOptions("missing_num",this_missing_num);
if(this_missing_num=='MSN01'||this_missing_num==''){
$('missing_num2').value=1;
$('missing_kind').value='MSN01'
}
else if(this_missing_num=='MSN11'){
$('missing_num2').value=1;
$('missing_kind').value='MSN11'
}
else if(this_missing_num=='MSN02'){
$('missing_num2').value=2;
$('missing_kind').value='MSN02'
}
else if(this_missing_num=='MSN03'){
$('missing_num2').value=3;
$('missing_kind').value='MSN03'
}
else if(this_missing_num=='MSN04'){
$('missing_num2').value=2;
$('missing_kind').value='MSK01'
}
else if(this_missing_num=='MSN05'){
$('missing_num2').value=2;
$('missing_kind').value='MSK02'
}
else if(this_missing_num=='MSN06'){
$('missing_num2').value=2;
$('missing_kind').value='MSK03'
}

}
,settingMissingDirection:function(){
var this_missing_direction=this.getMissingDirection();
var cut_x_size=this.getCutXSize();
var cut_y_size=this.getCutYSize();
this.initSelectOptions('missing_direction');
$('missing_direction').options[0]=new Option("미싱방향선택","",false);
if(cut_x_size>cut_y_size){
$('missing_direction').options[1]=new Option("세로방향(짧게)","OMD20",false);
$('missing_direction').options[2]=new Option("가로방향(길게)","OMD10",false)
}
else if(cut_x_size<cut_y_size){
$('missing_direction').options[1]=new Option("가로방향(짧게)","OMD30",false);
$('missing_direction').options[2]=new Option("세로방향(길게)","OMD40",false)
}
else{
$('missing_direction').options[1]=new Option("세로방향(짧게)","OMD20",false);
$('missing_direction').options[2]=new Option("가로방향(길게)","OMD10",false);
$('missing_direction').options[3]=new Option("가로방향(짧게)","OMD30",false);
$('missing_direction').options[4]=new Option("세로방향(길게)","OMD40",false)
}
this.thisPositionSelectOptions("missing_direction",this_missing_direction);
missing_direction_max=Math.max(cut_x_size,cut_y_size);
missing_direction_max=Math.ceil(missing_direction_max/100)*100;
 missing_direction_percent=Math.max(cut_x_size,cut_y_size)/Math.min(cut_x_size,cut_y_size);
missing_direction_percent=Math.round(missing_direction_percent,1);
if($('missing_direction').value=='OMD10'||$('missing_direction').value=='OMD40'){
missing_direction_unit=this.getMissingDirectionUnit(missing_direction_max,missing_direction_percent)
}
else{
missing_direction_unit=0
}
if(($('missing_num').value!='MSN01'&&$('missing_num').value!='')&&($('missing_num').value!='MSN11'&&$('missing_num').value!='')&&($('missing_direction').value=='OMD10'||$('missing_direction').value=='OMD40')){
alert('미싱방향이 길게인 경우는 미싱줄이 한줄만 선택가능 합니다.\n\n주문 사항이 다른 경우는 별도견적 문의 하세요.');
$('missing_num').focus()
}
return missing_direction_unit
}
,getMissingDirectionUnit:function(osi_direction_max,osi_direction_percent){
if(osi_direction_max=='100'&&osi_direction_percent=='2'){
osi_direction_unit=2000
}
else if(osi_direction_max=='100'&&osi_direction_percent=='3'){
osi_direction_unit=5000
}
else if(osi_direction_max=='100'&&osi_direction_percent=='4'){
osi_direction_unit=5000
}
else if(osi_direction_max=='100'&&osi_direction_percent=='5'){
osi_direction_unit=5000
}
else if(osi_direction_max=='100'&&osi_direction_percent=='6'){
osi_direction_unit=5000
}
else if(osi_direction_max=='100'&&osi_direction_percent=='7'){
osi_direction_unit=5000
}
else if(osi_direction_max=='100'&&osi_direction_percent=='8'){
osi_direction_unit=5000
}
else if(osi_direction_max=='100'&&osi_direction_percent=='9'){
osi_direction_unit=5000
}
else if(osi_direction_max=='100'&&osi_direction_percent=='10'){
osi_direction_unit=5000
}
else if(osi_direction_max=='200'&&osi_direction_percent=='2'){
osi_direction_unit=2000
}
else if(osi_direction_max=='200'&&osi_direction_percent=='3'){
osi_direction_unit=5000
}
else if(osi_direction_max=='200'&&osi_direction_percent=='4'){
osi_direction_unit=10000
}
else if(osi_direction_max=='200'&&osi_direction_percent=='5'){
osi_direction_unit=12000
}
else if(osi_direction_max=='200'&&osi_direction_percent=='6'){
osi_direction_unit=14000
}
else if(osi_direction_max=='200'&&osi_direction_percent=='7'){
osi_direction_unit=16000
}
else if(osi_direction_max=='200'&&osi_direction_percent=='8'){
osi_direction_unit=18000
}
else if(osi_direction_max=='200'&&osi_direction_percent=='9'){
osi_direction_unit=20000
}
else if(osi_direction_max=='200'&&osi_direction_percent=='10'){
osi_direction_unit=22000
}
else if(osi_direction_max=='300'&&osi_direction_percent=='2'){
osi_direction_unit=2000
}
else if(osi_direction_max=='300'&&osi_direction_percent=='3'){
osi_direction_unit=5000
}
else if(osi_direction_max=='300'&&osi_direction_percent=='4'){
osi_direction_unit=10000
}
else if(osi_direction_max=='300'&&osi_direction_percent=='5'){
osi_direction_unit=12000
}
else if(osi_direction_max=='300'&&osi_direction_percent=='6'){
osi_direction_unit=14000
}
else if(osi_direction_max=='300'&&osi_direction_percent=='7'){
osi_direction_unit=16000
}
else if(osi_direction_max=='300'&&osi_direction_percent=='8'){
osi_direction_unit=18000
}
else if(osi_direction_max=='300'&&osi_direction_percent=='9'){
osi_direction_unit=20000
}
else if(osi_direction_max=='300'&&osi_direction_percent=='10'){
osi_direction_unit=22000
}
else if(osi_direction_max=='400'&&osi_direction_percent=='2'){
osi_direction_unit=2000
}
else if(osi_direction_max=='400'&&osi_direction_percent=='3'){
osi_direction_unit=5000
}
else if(osi_direction_max=='400'&&osi_direction_percent=='4'){
osi_direction_unit=10000
}
else if(osi_direction_max=='400'&&osi_direction_percent=='5'){
osi_direction_unit=12000
}
else if(osi_direction_max=='400'&&osi_direction_percent=='6'){
osi_direction_unit=14000
}
else if(osi_direction_max=='400'&&osi_direction_percent=='7'){
osi_direction_unit=16000
}
else if(osi_direction_max=='400'&&osi_direction_percent=='8'){
osi_direction_unit=18000
}
else if(osi_direction_max=='400'&&osi_direction_percent=='9'){
osi_direction_unit=20000
}
else if(osi_direction_max=='400'&&osi_direction_percent=='10'){
osi_direction_unit=22000
}
else if(osi_direction_max=='500'&&osi_direction_percent=='2'){
osi_direction_unit=5000
}
else if(osi_direction_max=='500'&&osi_direction_percent=='3'){
osi_direction_unit=10000
}
else if(osi_direction_max=='500'&&osi_direction_percent=='4'){
osi_direction_unit=15000
}
else if(osi_direction_max=='500'&&osi_direction_percent=='5'){
osi_direction_unit=20000
}
else if(osi_direction_max=='500'&&osi_direction_percent=='6'){
osi_direction_unit=25000
}
else if(osi_direction_max=='500'&&osi_direction_percent=='7'){
osi_direction_unit=30000
}
else if(osi_direction_max=='500'&&osi_direction_percent=='8'){
osi_direction_unit=35000
}
else if(osi_direction_max=='500'&&osi_direction_percent=='9'){
osi_direction_unit=40000
}
else if(osi_direction_max=='500'&&osi_direction_percent=='10'){
osi_direction_unit=45000
}
else if(osi_direction_max=='600'&&osi_direction_percent=='2'){
osi_direction_unit=5000
}
else if(osi_direction_max=='600'&&osi_direction_percent=='3'){
osi_direction_unit=10000
}
else if(osi_direction_max=='600'&&osi_direction_percent=='4'){
osi_direction_unit=15000
}
else if(osi_direction_max=='600'&&osi_direction_percent=='5'){
osi_direction_unit=20000
}
else if(osi_direction_max=='600'&&osi_direction_percent=='6'){
osi_direction_unit=25000
}
else if(osi_direction_max=='600'&&osi_direction_percent=='7'){
osi_direction_unit=30000
}
else if(osi_direction_max=='600'&&osi_direction_percent=='8'){
osi_direction_unit=35000
}
else if(osi_direction_max=='600'&&osi_direction_percent=='9'){
osi_direction_unit=40000
}
else if(osi_direction_max=='600'&&osi_direction_percent=='10'){
osi_direction_unit=45000
}
else{
osi_direction_unit=0
}
return osi_direction_unit
}
,calcuMissingPrice:function(){
if(this.getIsPPMissing()){
missing_direction_unit=this.settingMissingDirection();
this.settingMissingNum()
}
missing_num=this.getMissingNum();
if(this.getIsPPMissing()&&missing_num){
var missing_price_unit=this.calcuMissingPriceUnit();
var missing_extra_rate=this.calcuMissingExtraRate();
var missing_discount_rate=this.calcuMissingDiscountRate();
this_order_count=this.getOrderCount();
missing_price=Math.ceil((missing_price_unit*missing_extra_rate*missing_discount_rate-100)/1000)*1000*this_order_count;
missing_price=Math.max(missing_price,4500);
missing_price=missing_price+missing_direction_unit;
var missing_mock_price=0;
if(missing_num=="MSN03"||missing_num=="MSN04"||missing_num=="MSN05"||missing_num=="MSN06"){
missing_mock_price=7500
}
missing_price=missing_price+missing_mock_price;
this.setMissingPrice(missing_price);
this.setMoghyeongPrice(missing_mock_price)
}
else{
this.setMissingPrice(0);
this.setMoghyeongPrice(0)
}

}
,calcuMissingExtraRate:function(){
missing_num=this.getMissingNum();
var missing_extra_rate=1;
if(missing_num=='MSN01'||missing_num=='MSN02'){
missing_extra_rate=1
}
else if(missing_num=='MSN03'){
missing_extra_rate=1.5
}
else if(missing_num=='MSN04'){
missing_extra_rate=2
}
else if(missing_num=='MSN05'){
missing_extra_rate=2.2
}
else if(missing_num=='MSN06'){
missing_extra_rate=2.2
}
return missing_extra_rate
}
,calcuMissingDiscountRate:function(){
this_paper_qty=this.getPaperQty();
missing_discount_price=Math.max(1-(this_paper_qty/20000),0.75);
return missing_discount_price
}
,calcuMissingPriceUnit:function(){
this_paper_qty=this.getPaperQty();
var cut_x_size=this.getCutXSize();
var cut_y_size=this.getCutYSize();
var paper_length_price=0;
var cut_size_max=Math.max(cut_x_size,cut_y_size);
var cut_size_rate=(cut_size_max-100)*0.05+10;
if(cut_size_max<150){
paper_length_price=4500
}
else if(cut_size_max<200){
paper_length_price=5000
}
else if(cut_size_max<250){
paper_length_price=6000
}
else if(cut_size_max<300){
paper_length_price=8000
}
else if(cut_size_max<400){
paper_length_price=10000
}
else if(cut_size_max<500){
paper_length_price=20000
}
else if(cut_size_max<600){
paper_length_price=30000
}
else{
paper_length_price=35000
}
missing_price_unit=Math.max((cut_size_rate*this_paper_qty),paper_length_price);
this.outputDebugMsg("[calcuMissingPriceUnit]missing_price_unit:"+missing_price_unit);
return missing_price_unit
}

}
);
var ppDomusong=Class.create(Postpress,{
initialize:function($super){
$super();
this.domusong_unit_price=0;
this.domusong_mock_price=0;
this.DOMUSONG_MIN_PRICE=30000;
this.DOMUSONG_BASIC_PRICE=5000;
this.save_domusong_type=$('save_domusong_type').value
}
,dataLoad:function(){
new Ajax.Request('/estimate/estimate_goods/pp_domusong_json_data',{
asynchronous:false,method:"post",parameters:{
"t":timestamp,"product":"name","category_code":$('category_code').value
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
,setDomusongSection:function(section){
$('domusong_section').value=section
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
return $('domusong_num').value
}
,setDomusongXSize:function(xsize){
$('domusong_x_size').value=parseInt(xsize)
}
,getDomusongXSize:function(){
if($('domusong_x_size').value==""){
return 0
}
else{
return parseInt($('domusong_x_size').value)
}

}
,setDomusongYSize:function(ysize){
$('domusong_y_size').value=parseInt(ysize)
}
,getDomusongYSize:function(){
if($('domusong_y_size').value==""){
return 0
}
else{
return parseInt($('domusong_y_size').value)
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
,getIsPPDomusong:function(){
if($('chk_is_domusong').checked==true){
return true
}
else{
return false
}

}
,settingDomusongType:function(){
var this_domusong_section=this.getDomusongSection();
var this_domusong_type=this.getDomusongType();
var this_paper_size_domusong=this.getPaperSizeDomusong();
var this_category_code=this.getCategoryCode();
var this_size_type=this.getSizeType();
if(this_size_type=='SZT10'&&(this_category_code.match('CVS'))){
this.initSelectOptions('domusong_section');
$('domusong_section').options[0]=new Option("전체도무송","DMS50",false);
this_domusong_section="DMS50";
this.thisPositionSelectOptions("domusong_section",this_domusong_section);
$j("#domusong_type").css("width","180px");
var this_paper_size=this.getPaperSize();
var size_info=jsonOBJ.size_info;
this.initSelectOptions('domusong_type');
for(i=0;
i<size_info.length;
i++){
var arrCategoryCodeList=size_info[i].category_code_list.split(",");
for(j=0;
j<arrCategoryCodeList.length;
j++){
if(this_category_code==arrCategoryCodeList[j]){
size_type_code=size_info[i].size_type_code;
size_type_name2=size_info[i].size_type_name2;
$('domusong_type').options[i]=new Option(size_type_name2,size_type_code,false)
}

}

}
this.thisPositionSelectOptions("domusong_type",this_paper_size);
$j('#domusong_x_size').attr('readonly',true);
$j('#domusong_y_size').attr('readonly',true);
this.initSelectOptions('domusong_num');
$('domusong_num').options[0]=new Option("1개","1",false);
this_domusong_type="1";
this.thisPositionSelectOptions("domusong_num",this_domusong_type)
}
else{
$j("#domusong_type").css("width","140px");
this.initSelectOptions('domusong_type');
$('domusong_type').options[0]=new Option("라운드,사각,원","DMT51",false);
$('domusong_type').options[1]=new Option("꼭지점 6개이하","DMT52",false);
$('domusong_type').options[2]=new Option("사물모양","DMT53",false);
$('domusong_type').options[3]=new Option("미니홀더","DMT54",false);
$('domusong_type').options[4]=new Option("박스펼친면","DMT55",false);
if(this_domusong_type=='')this_domusong_type="DMT51";
this.thisPositionSelectOptions("domusong_type",this_domusong_type);
this_domusong_num=this.getDomusongNum();
this.initSelectOptions('domusong_num');
$('domusong_num').options[0]=new Option("1개","1",false);
$('domusong_num').options[1]=new Option("2개","2",false);
$('domusong_num').options[2]=new Option("3개","3",false);
$('domusong_num').options[3]=new Option("4개","4",false);
this.thisPositionSelectOptions("domusong_num",this_domusong_num)
}

}
,calcuDomusongPrice:function(){
if(this.getIsPPDomusong()){
if(this_domusong_section!="DMS30"&&this_domusong_section!="DMS31"){
this.settingDomusongType()
}

}
var this_domusong_section=this.getDomusongSection();
var this_paper_size_domusong=this.getPaperSizeDomusong();
var cut_x_size=this.getCutXSize();
var cut_y_size=this.getCutYSize();
var domusong_price=0;
this.domusong_mock_price=0;
var this_domusong_type=this.getDomusongType();
var this_domusong_num=this.getDomusongNum();
var this_paper_qty=this.getPaperQty();
var this_order_count=this.getOrderCount();
var domusong_x_size=this.getDomusongXSize();
var domusong_y_size=this.getDomusongYSize();
var add_domusong_size=0;
var this_size_type=this.getSizeType();
var this_category_code=this.getCategoryCode();
if(cut_x_size==0||cut_y_size==0){
alert('재단사이즈 가로, 세로 값을 숫자로 입력해 주세요.');
this.setDomusongPrice(0);
this.setMoghyeongPrice(0);
this.setDomusongXSize(0);
this.setDomusongYSize(0)
}
else{
if(this.getIsPPDomusong()&&this_domusong_section!=""){
if(this_domusong_section=='DMS20'||this_domusong_section=='DMS21'||this_domusong_section=='DMS30'){
add_domusong_size=20
}
if(domusong_x_size<=0){
domusong_x_size=cut_x_size-add_domusong_size;
this.setDomusongXSize(cut_x_size-add_domusong_size)
}
if(domusong_y_size<=0){
domusong_y_size=cut_y_size-add_domusong_size;
this.setDomusongYSize(cut_y_size-add_domusong_size)
}
vs_domusong_x_size=domusong_x_size+add_domusong_size;
vs_domusong_y_size=domusong_y_size+add_domusong_size;
if(vs_domusong_x_size>cut_x_size||domusong_x_size<10||vs_domusong_y_size>cut_y_size||domusong_y_size<10){
this.setDomusongPrice(0);
this.setMoghyeongPrice(0);
this.setDomusongXSize(0);
this.setDomusongYSize(0);
alert("전체도무송인경우 - 도무송규격은 용지규격보다 20mm이상 작아야 합니다 .\n\n가로세로 최소사이즈 - 10mm이상")
}
else{
if(this.getIsPPDomusong()&&this_domusong_type!=''){
if(this.getDomusongXSize()==0&&this.getDomusongYSize()==0){
this.setDomusongXSize(cut_x_size);
this.setDomusongYSize(cut_y_size)
}
this.getDomusongPriceUnit();
if(this_domusong_section=="DMS30"||this_domusong_section=="DMS31"){
this.domusong_mock_price=0
}
domusong_qty_discount=(this_order_count-1)*4000;
var domusong_work_amt=0;
var siyagi_amt=0;
if(this_domusong_type=="DMT51"){
siyagi_amt=2
}
else if(this_domusong_type=="DMT52"){
siyagi_amt=2.5
}
else if(this_domusong_type=="DMT53"){
siyagi_amt=3
}
else if(this_domusong_type=="DMT54"){
siyagi_amt=3.5
}
else if(this_domusong_type=="DMT55"){
siyagi_amt=3.5
}
domusong_work_amt=Math.max(siyagi_amt*this_domusong_num*this_paper_qty,2000);
if(this_category_code=="CNC5000"){
domusong_work_amt=domusong_work_amt*1.5
}
domusong_work_amt=domusong_work_amt*this_order_count;
domusong_price=this.domusong_unit_price+domusong_work_amt;
if(this_category_code.match('CVS')&&this_size_type.match('SZT10')){
var size_info=jsonPath(jsonOBJ,"$.size_info[?(@.size_type_code=='"+this_domusong_type+"')]");
var etc2=parseInt(size_info[0].etc2);
domusong_price=Math.max(etc2*this_paper_qty+10000,20000);
domusong_price=(Math.ceil(domusong_price/1000)*1000)*this_order_count
}
if(this_category_code=="CNC5000"){
domusong_price=domusong_price*1.3
}

}
else{
this.setDomusongPrice(0);
this.setMoghyeongPrice(0)
}

}

}
else{
this.setDomusongPrice(0);
this.setMoghyeongPrice(0)
}
domusong_price=domusong_price+this.domusong_mock_price;
this.setDomusongPrice(domusong_price);
this.setMoghyeongPrice(this.domusong_mock_price)
}

}
,getDomusongPriceUnit:function(){
this_paper_size_domusong=this.getPaperSizeDomusong();
this_paper_qty=this.getPaperQty();
this_order_count=this.getOrderCount();
this_domusong_type=this.getDomusongType();
this_domusong_num=this.getDomusongNum();
var domusong_x_size=this.getDomusongXSize();
var domusong_y_size=this.getDomusongYSize();
var domusong_max_size=Math.max(domusong_x_size,domusong_y_size);
var domusong_mock_price_unit=0;
var cut_x_size=this.getCutXSize();
var cut_y_size=this.getCutYSize();
var cut_size_max=Math.max(cut_x_size,cut_y_size);
var DOMUSONG_MOCK_RATE=1;
var domusong_mock_extra_rate=0;
if(this_paper_size_domusong=='2'){
DOMUSONG_MOCK_RATE=2;
this.mock_price=0;
this.domusong_price=0
}
else{
var pp_domusong_info=jsonPath(ppDomusongJsonOBJ,"$.pp_domusong_info[?(@.num=='"+this_domusong_num+"')][?(@.domusong_type=='"+this_domusong_type+"')]");
var this_category_code=this.getCategoryCode();
var this_size_type=this.getSizeType();
var this_domusong_section=this.getDomusongSection();
if(this_domusong_section=="DMS50"||((this_category_code=="CVS1000"||this_category_code=="CVS2000")&&(this_size_type=="SZT10"))){
domusong_mock_price_unit=6000;
domusong_mock_extra_rate=1
}
else{
domusong_mock_price_unit=parseInt(pp_domusong_info[0].mock_price);
domusong_mock_extra_rate=this.getDomusongMockExtraRate(domusong_max_size)
}
if((this_category_code=="CVS1000"||this_category_code=="CVS2000")&&this_size_type=="SZT10"&&this_domusong_section=="DMS50"){
domusong_mock_extra_rate=1
}
else{
domusong_mock_extra_rate=this.getDomusongMockExtraRate(domusong_max_size)
}
domusong_mock_price_unit=domusong_mock_price_unit*this_order_count
}
domusong_mock_extra_rate2=this.getDomusongMockExtraRate2(this_domusong_type,this_domusong_num);
domusong_qty_price=Math.max(cut_size_max/15,12)*domusong_mock_extra_rate2;
 domusong_qty_price=Math.round(domusong_qty_price*100)/100;
 domusong_paper_max_price=this.getDomusongPaperMaxPrice(cut_size_max);
domusong_mock_extra_rate_price=Math.min(this_paper_qty/120,100)*(domusong_mock_price_unit/10);
domusong_mock_extra_rate_price=Math.ceil(domusong_mock_extra_rate_price/100)*100;
if(category_code=="CNC5000"){
domusong_mock_extra_rate_price=domusong_mock_extra_rate_price+this_paper_qty*5*this_order_count
}
this.domusong_unit_price=Math.ceil((Math.max(domusong_qty_price*this_paper_qty,domusong_paper_max_price)+5000)/1000)*1000*this_order_count;
this.domusong_mock_price=domusong_mock_extra_rate*domusong_mock_price_unit+domusong_mock_extra_rate_price
}
,getDomusongMockExtraRate2:function(this_domusong_type,this_domusong_num){
var domusong_mock_extra_rate2=1;
if(this_domusong_type=='DMT51'){
if(this_domusong_num=='1'){
domusong_mock_extra_rate2=1.0
}
else if(this_domusong_num=='2'){
domusong_mock_extra_rate2=1.2
}
else if(this_domusong_num=='3'){
domusong_mock_extra_rate2=1.4
}
else if(this_domusong_num=='4'){
domusong_mock_extra_rate2=1.6
}

}
else if(this_domusong_type=='DMT52'){
if(this_domusong_num=='1'){
domusong_mock_extra_rate2=1.2
}
else if(this_domusong_num=='2'){
domusong_mock_extra_rate2=1.4
}
else if(this_domusong_num=='3'){
domusong_mock_extra_rate2=1.6
}
else if(this_domusong_num=='4'){
domusong_mock_extra_rate2=1.8
}

}
else if(this_domusong_type=='DMT53'){
if(this_domusong_num=='1'){
domusong_mock_extra_rate2=1.3
}
else if(this_domusong_num=='2'){
domusong_mock_extra_rate2=1.5
}
else if(this_domusong_num=='3'){
domusong_mock_extra_rate2=1.7
}
else if(this_domusong_num=='4'){
domusong_mock_extra_rate2=1.9
}

}
else if(this_domusong_type=='DMT54'){
if(this_domusong_num=='1'){
domusong_mock_extra_rate2=1.4
}
else if(this_domusong_num=='2'){
domusong_mock_extra_rate2=1.6
}
else if(this_domusong_num=='3'){
domusong_mock_extra_rate2=1.8
}
else if(this_domusong_num=='4'){
domusong_mock_extra_rate2=2.0
}

}
else if(this_domusong_type=='DMT55'){
if(this_domusong_num=='1'){
domusong_mock_extra_rate2=1.5
}
else if(this_domusong_num=='2'){
domusong_mock_extra_rate2=1.7
}
else if(this_domusong_num=='3'){
domusong_mock_extra_rate2=1.9
}
else if(this_domusong_num=='4'){
domusong_mock_extra_rate2=2.1
}

}
return parseFloat(domusong_mock_extra_rate2)
}
,getDomusongMockExtraRate:function(domusong_max_size){
var this_category_code=this.getCategoryCode();
var this_size_type=this.getSizeType();
if((this_category_code=="CVS1000"||this_category_code=="CVS2000")&&(this_size_type=="SZT10")){
this_domusong_type="DMT51"
}
else{
this_domusong_type=this.getDomusongType()
}
var extraRate=1.0;
if(this_domusong_type=="DMT51"){
if(domusong_max_size<150){
extraRate=1.0
}
else if(domusong_max_size<250){
extraRate=1.5
}
else if(domusong_max_size<300){
extraRate=2.0
}
else if(domusong_max_size<400){
extraRate=2.5
}
else if(domusong_max_size<500){
extraRate=3.0
}
else if(domusong_max_size<600){
extraRate=3.5
}
else{
extraRate=4.0
}

}
else if(this_domusong_type=="DMT52"){
if(domusong_max_size<150){
extraRate=1.0
}
else if(domusong_max_size<250){
extraRate=1.4
}
else if(domusong_max_size<300){
extraRate=1.7
}
else if(domusong_max_size<400){
extraRate=2.0
}
else if(domusong_max_size<500){
extraRate=2.3
}
else if(domusong_max_size<600){
extraRate=2.6
}
else{
extraRate=2.9
}

}
else if(this_domusong_type=="DMT53"){
if(domusong_max_size<150){
extraRate=1.0
}
else if(domusong_max_size<250){
extraRate=1.3
}
else if(domusong_max_size<300){
extraRate=1.5
}
else if(domusong_max_size<400){
extraRate=1.7
}
else if(domusong_max_size<500){
extraRate=1.9
}
else if(domusong_max_size<600){
extraRate=2.1
}
else{
extraRate=2.3
}

}
else if(this_domusong_type=="DMT54"){
if(domusong_max_size<150){
extraRate=1.0
}
else if(domusong_max_size<250){
extraRate=1.1
}
else if(domusong_max_size<300){
extraRate=1.3
}
else if(domusong_max_size<400){
extraRate=1.5
}
else if(domusong_max_size<500){
extraRate=1.7
}
else if(domusong_max_size<600){
extraRate=1.9
}
else{
extraRate=2.0
}

}
else if(this_domusong_type=="DMT55"){
if(domusong_max_size<150){
extraRate=1.0
}
else if(domusong_max_size<250){
extraRate=1.1
}
else if(domusong_max_size<300){
extraRate=1.2
}
else if(domusong_max_size<400){
extraRate=1.3
}
else if(domusong_max_size<500){
extraRate=1.4
}
else if(domusong_max_size<600){
extraRate=1.5
}
else{
extraRate=1.5
}

}
this.outputDebugMsg("[getDomusongMockExtraRate]this_domusong_type:"+this_domusong_type+",domusong_max_size:"+domusong_max_size+",extraRate:"+extraRate);
return parseFloat(extraRate)
}
,getDomusongPaperMaxPrice:function(domusong_max_size){
if(domusong_max_size<100){
paper_max_price=5000
}
else if(domusong_max_size<150){
paper_max_price=7000
}
else if(domusong_max_size<200){
paper_max_price=9000
}
else if(domusong_max_size<250){
paper_max_price=10000
}
else if(domusong_max_size<300){
paper_max_price=12000
}
else if(domusong_max_size<400){
paper_max_price=15000
}
else if(domusong_max_size<500){
paper_max_price=20000
}
else if(domusong_max_size<600){
paper_max_price=25000
}
else{
paper_max_price=30000
}
this_domusong_type=this.getDomusongType();
var mock_min_price=0;
if(this_domusong_type=="DMT51"){
mock_min_price=5000
}
else if(this_domusong_type=="DMT52"){
mock_min_price=7000
}
else if(this_domusong_type=="DMT53"){
mock_min_price=13000
}
else if(this_domusong_type=="DMT54"){
mock_min_price=20000
}
else if(this_domusong_type=="DMT55"){
mock_min_price=30000
}
paper_max_price=Math.max(paper_max_price,mock_min_price);
return parseFloat(paper_max_price)
}

}
);
var ppBak=Class.create(Postpress,{
initialize:function($super,seq){
$super();
this.seq=0
}
,dataLoad:function(){
new Ajax.Request('/estimate/estimate_goods/pp_bak_json_data',{
asynchronous:false,method:"post",parameters:{
"t":timestamp,"product":"name","category_code":$('category_code').value
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
,setBakXSize:function(size){
$('bak_x_size_'+this.seq).value=size
}
,getBakXSize:function(){
if($('bak_x_size_'+this.seq).value==""){
return 0
}
else{
return parseFloat($('bak_x_size_'+this.seq).value)
}

}
,setBakYSize:function(size){
$('bak_y_size_'+this.seq).value=size
}
,getBakYSize:function(){
if($('bak_y_size_'+this.seq).value==""){
return 0
}
else{
return parseFloat($('bak_y_size_'+this.seq).value)
}

}
,setBakSizeOver:function(msg){
$('bak_size_over_'+this.seq).value=msg
}
,getBakSizeOver:function(){
if($('bak_size_over_'+this.seq).value==""){
return''
}
else{
return $('bak_size_over_'+this.seq).value
}

}
,setDongpanPrice:function(price){
$('etc1_'+this.seq).value=price
}
,setBakPrice:function(price){
$('bak_amt_'+this.seq).value=price
}
,getBakPrice:function(){
if($('bak_amt_'+this.seq).value==""){
return 0
}
else{
return parseInt($('bak_amt_'+this.seq).value)
}

}
,getIsPPBak:function(){
if($('chk_is_bak').checked==true){
return true
}
else{
return false
}

}
,settingBakType:function(){
this_bak_section=this.getBakSection()
}
,calcuBakPrice:function(){
if(this.getIsPPBak()){
this.settingBakType()
}
else{
$('bak_compare_2').value='BAC10';
$('bak_compare_3').value='BAC10'
}
this_order_count=this.getOrderCount();
bak_section=this.getBakSection();
bak_side=this.getBakSide();
bak_x_size=this.getBakXSize();
bak_y_size=this.getBakYSize();
cut_x_size=this.getCutXSize();
cut_y_size=this.getCutYSize();
this.setBakXOverMsg('');
this.setBakYOverMsg('');
if(cut_x_size<bak_x_size||cut_y_size<bak_y_size){
this.setBakPrice(0);
this.setDongpanPrice(0);
this.setBakXSize(0);
this.setBakYSize(0);
alert("박 규격은 용지규격보다 작아야 합니다")
}
else{
if(this.getIsPPBak()&&bak_section!=""&&bak_x_size>0&&bak_y_size>0){
bak_price_unit=this.getBakPriceUnit();
var bak_size_over='';
if(cut_x_size<=(bak_x_size+20)){
this.setBakXOverMsg('가로크게');
bak_size_over='가로크게'
}
if(cut_y_size<=(bak_y_size+20)){
this.setBakYOverMsg('세로크게');
if(bak_size_over==''){
bak_size_over='세로크게'
}
else{
bak_size_over+=',세로크게'
}

}
this.setBakSizeOver(bak_size_over);
if(bak_section=="BKS10"){
bak_dongpan_price=this.getBakDongpanPrice()
}
else{
bak_dongpan_price=0
}
bak_price_unit=bak_price_unit*this_order_count;
bak_price_unit=bak_price_unit*1.35;
if(bak_side=='BKD30'){
bak_price_unit=bak_price_unit*2
}
var bak_extra_arry=this.getBakExtraUnit(cut_x_size,cut_y_size,bak_x_size,bak_y_size);
bak_extra_arry=bak_extra_arry.split("^");
var extra_unit=parseFloat(bak_extra_arry[0]);
var extra_min=parseFloat(bak_extra_arry[1]);
var extra_unit3=parseFloat(bak_extra_arry[2]);
var extra_unit4=parseFloat(bak_extra_arry[3]);
bak_price_unit=(bak_price_unit*extra_unit4*extra_unit);
bak_price_unit=Math.ceil(bak_price_unit/100)*100;
bak_price_unit=Math.max(bak_price_unit+extra_unit3,extra_min);
var cut_x_size=this.getCutXSize();
var cut_y_size=this.getCutYSize();
var cut_size_max=Math.max(cut_x_size,cut_y_size);
if(cut_size_max>=100){
bak_price_unit=Math.max(bak_price_unit,18500)
}
bak_dongpan_price=Math.ceil(bak_dongpan_price/100)*100;
 bak_price=bak_price_unit+bak_dongpan_price;
var bak_add_unit_price=0;
var paper_qty=this.getPaperQty();
$('bak_add_unit_price').value=bak_add_unit_price;
bak_price=bak_price+bak_add_unit_price;
this.setBakPrice(bak_price);
this.setDongpanPrice(bak_dongpan_price)
}
else{
this.setBakPrice(0);
this.setDongpanPrice(0);
$('bak_add_unit_price').value=0
}

}
var bak_type=this.getBakType();
var bak_work_price=0;
if(bak_type=='BKT11'||bak_type=='BKT12'||bak_type=='BKT13'){
var bak_work_price1=1250;
var bak_work_price2=1750
}
else{
var bak_work_price1=1000;
var bak_work_price2=1500
}
var bak_side=this.getBakSide();
var bak_side_unit=1;
if(bak_side=='BKD30'){
bak_side_unit=2
}
var max_cut_size=Math.max(cut_x_size,cut_y_size);
var min_cut_size=Math.min(cut_x_size,cut_y_size);
var paper_qty_unit=this_paper_qty/100;
if(max_cut_size<=99&&min_cut_size<=55){
bak_work_price=bak_work_price1*paper_qty_unit*bak_side_unit
}
if((max_cut_size>=100&&max_cut_size<=130)||(min_cut_size>=56&&min_cut_size<=110)){
bak_work_price=bak_work_price2*paper_qty_unit*bak_side_unit
}
$('bak_work_price_'+this.seq).value=bak_work_price
}
,getBakExtraUnit:function(cut_x_size,cut_y_size,bak_x_size,bak_y_size){
var x_max_size=Math.max(bak_x_size,30);
var y_max_size=Math.max(bak_y_size,30);
var xy_max_size=Math.max(x_max_size,y_max_size);
var extra_unit=1;
var extra_min=3000;
if(xy_max_size>=1&&xy_max_size<30){
extra_unit=1.00;
extra_min=3000
}
else if(xy_max_size>=30&&xy_max_size<35){
extra_unit=1.04;
extra_min=3300
}
else if(xy_max_size>=35&&xy_max_size<40){
extra_unit=1.08;
extra_min=3600
}
else if(xy_max_size>=40&&xy_max_size<45){
extra_unit=1.12;
extra_min=3900
}
else if(xy_max_size>=45&&xy_max_size<50){
extra_unit=1.16;
extra_min=4200
}
else if(xy_max_size>=50&&xy_max_size<55){
extra_unit=1.20;
extra_min=4500
}
else if(xy_max_size>=55&&xy_max_size<60){
extra_unit=1.24;
extra_min=4800
}
else if(xy_max_size>=60&&xy_max_size<65){
extra_unit=1.28;
extra_min=6000
}
else if(xy_max_size>=65&&xy_max_size<70){
extra_unit=1.32;
extra_min=6500
}
else if(xy_max_size>=70&&xy_max_size<75){
extra_unit=1.36;
extra_min=8000
}
else if(xy_max_size>=75&&xy_max_size<80){
extra_unit=1.40;
extra_min=1000
}
else if(xy_max_size>=80&&xy_max_size<85){
extra_unit=1.40;
extra_min=1300
}
else if(xy_max_size>=85&&xy_max_size<90){
extra_unit=1.40;
extra_min=14000
}
else if(xy_max_size>=90&&xy_max_size<95){
extra_unit=1.40;
extra_min=15000
}
else if(xy_max_size>=95&&xy_max_size<100){
extra_unit=1.40;
extra_min=18000
}
else if(xy_max_size>=100){
extra_unit=1.40;
extra_min=20000
}
var extra_unit3=500;
var extra_unit4=1.1;
if((cut_x_size==90&&cut_y_size==50)||(cut_x_size==50&&cut_y_size==90)){
extra_unit3=0;
extra_unit4=1
}
var order_count=this.getOrderCount();
var extra_min=extra_min*Math.max((order_count*0.7),1);
extra_min=Math.ceil(extra_min/100)*100;
var extra_price_arry=extra_unit+"^"+extra_min+"^"+extra_unit3+"^"+extra_unit4;
return extra_price_arry
}
,getBakDongpanPrice:function(){
bak_x_size=this.getBakXSize();
bak_y_size=this.getBakYSize();
var bak_dongpan_price=1000000000;
price1=Math.max(bak_x_size,30)*Math.max(bak_y_size,30)*1.6+1100;
price2=3000;
bak_dongpan_price=Math.max(price1,price2);
$('bak_margin_size_'+this.seq).value='';
var bak_dongpan_add_price=0;
var order_count=parseInt($('order_count').value);
if(parseInt(this.seq)>1&&order_count>1){
var bak_compare=$('bak_compare_'+this.seq).value;
if(bak_compare=='BAC11'){

}

}
bak_dongpan_price=bak_dongpan_price+bak_dongpan_add_price;
this.outputDebugMsg("[getDongpanPrice]bak_dongpan_price:"+bak_dongpan_price);
return bak_dongpan_price
}
,getBakPriceUnit:function(){
this_paper_qty=this.getPaperQty();
bak_type=this.getBakType();
bak_x_size=this.getBakXSize();
bak_y_size=this.getBakYSize();
var cut_x_size=this.getCutXSize();
var cut_y_size=this.getCutYSize();
var cut_size_max=Math.max(cut_x_size,cut_y_size);
var cut_size_min=Math.min(cut_x_size,cut_y_size);
var bak_work_price=this.getBakPaperWorkPrice();
var paper_max_price=this.getBakPaperMaxPrice(cut_size_max);
var bak_paper_add_price=this.getBakPaperWorkAddPrice();
var pp_bak_info=jsonPath(ppBakJsonOBJ,"$.pp_bak_info[?(@.type=='material_unit')][?(@.bak_type=='"+bak_type+"')]");
bak_type=parseInt(pp_bak_info[0].bak_type);
material_unit2=parseInt(pp_bak_info[0].material_unit2);
extra_rate=parseFloat(pp_bak_info[0].extra_rate);
chk_size_high=parseInt(pp_bak_info[0].chk_size_high);
chk_size_low=parseInt(pp_bak_info[0].chk_size_low);
var bak_x_size_max=Math.max(bak_x_size,30);
var bak_y_size_max=Math.max(bak_y_size,30);
var bak_size_extra_unit=0;
if(cut_size_max>=150||cut_size_min>=100){
bak_size_extra_unit=2000
}
var bak_film_price=material_unit2/(chk_size_low*chk_size_high)*(bak_x_size_max+15)*(bak_y_size_max+15)*extra_rate;
 bak_film_price=Math.round(bak_film_price*100)/100;
 var bak_price_unit=Math.max((bak_work_price*this_paper_qty)+(bak_film_price*this_paper_qty)+bak_size_extra_unit,paper_max_price);
bak_price_unit+=bak_paper_add_price+600;
return bak_price_unit
}
,getBakPaperWorkPrice:function(){
var cut_x_size=this.getCutXSize();
var cut_y_size=this.getCutYSize();
var bak_paper_work_price=((cut_x_size+cut_y_size)/20)+11;
return bak_paper_work_price
}
,getBakPaperWorkAddPrice:function(){
var cut_x_size=this.getCutXSize();
var cut_y_size=this.getCutYSize();
var cut_size_max=Math.max(cut_x_size,cut_y_size);
var this_paper_qty=this.getPaperQty();
var bak_paper_work_add_Price=0;
var paper_max_add_price=0;
if(cut_size_max>=100){
var R34=4000;
var R36=5000;
var R37=5000;
var R39=17000;
var R40=17000;
var R42=50000;
var Q34=101;
var Q36=170;
var Q37=171;
var Q39=300;
var Q40=301;
var Q42=600;
if(cut_size_max<Q34){
paper_max_add_price=0
}
else if(cut_size_max==Q34){
paper_max_add_price=R34
}
else if(cut_size_max<=169){
paper_max_add_price=R34-((R34-R36)/(Q36-Q34)*(cut_size_max-Q34))
}
else if(cut_size_max==Q36){
paper_max_add_price=R36
}
else if(cut_size_max==Q37){
paper_max_add_price=R37
}
else if(cut_size_max<=299){
paper_max_add_price=R37-((R37-R39)/(Q39-Q37)*(cut_size_max-Q37))
}
else if(cut_size_max==Q39){
paper_max_add_price=R39
}
else if(cut_size_max==Q40){
paper_max_add_price=R40
}
else if(cut_size_max<=599){
paper_max_add_price=R40-((R40-R42)/(Q42-Q40)*(cut_size_max-Q40))
}
else if(cut_size_max<=Q42){
paper_max_add_price=R42
}
var M8_a=(cut_x_size*cut_y_size)/5*this_paper_qty/1700;
var M8_b=1;
if(this_paper_qty>=3000&&cut_size_max>=120){
M8_b=(cut_x_size*cut_y_size)/3*this_paper_qty/3300-10000
}
else{
M8_b=1
}
bak_paper_work_add_Price=parseInt(paper_max_add_price+M8_a-M8_b)
}
return bak_paper_work_add_Price
}
,getBakPaperMaxPrice:function(cut_size_max){
var paper_max_price=0;
if(cut_size_max<100){
paper_max_price=3000
}
else if(cut_size_max<120){
paper_max_price=5000
}
else if(cut_size_max<150){
paper_max_price=8000
}
else if(cut_size_max<200){
paper_max_price=10000
}
else if(cut_size_max<250){
paper_max_price=12000
}
else if(cut_size_max<300){
paper_max_price=14000
}
else if(cut_size_max<350){
paper_max_price=16000
}
else if(cut_size_max<400){
paper_max_price=25000
}
else if(cut_size_max<500){
paper_max_price=30000
}
else if(cut_size_max<600){
paper_max_price=35000
}
else{
paper_max_price=40000
}
return parseFloat(paper_max_price)
}

}
);
var ppAP=Class.create(Postpress,{
initialize:function($super,seq){
$super();
this.seq=0
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
,setAPXSize:function(size){
$('ap_x_size_'+this.seq).value=size
}
,getAPXSize:function(){
if($('ap_x_size_'+this.seq).value==""){
return 0
}
else{
return parseFloat($('ap_x_size_'+this.seq).value)
}

}
,setAPYSize:function(size){
$('ap_y_size_'+this.seq).value=size
}
,getAPYSize:function(){
if($('ap_y_size_'+this.seq).value==""){
return 0
}
else{
return parseFloat($('ap_y_size_'+this.seq).value)
}

}
,setApMarginSize:function(size){
$('ap_margin_size_'+this.seq).value=size
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
,settingAPType:function(seq){
this_ap_section=this.getAPSection();
this_ap_type=this.getAPType();
if(this_ap_section=='APS10'){
this.initSelectOptions('ap_type_'+seq);
$('ap_type_'+seq).options[0]=new Option("앞으로 돌출","APT10",false);
$('ap_type_'+seq).options[1]=new Option("뒤로 돌출","APT20",false);
this.thisPositionSelectOptions("ap_type_"+seq,this_ap_type)
}

}
,calcuAPPrice:function(){
if(this.getIsPPAP()){
this.settingAPType(this.seq)
}
else{
$('ap_compare_2').value='BAC10';
$('ap_compare_3').value='BAC10'
}
this_order_count=this.getOrderCount();
ap_section=this.getAPSection();
ap_x_size=this.getAPXSize();
ap_y_size=this.getAPYSize();
cut_x_size=this.getCutXSize();
cut_y_size=this.getCutYSize();
if(cut_x_size<ap_x_size||cut_y_size<ap_y_size){
this.setAPPrice(0);
this.setAPDongpanPrice(0);
this.setAPXSize(0);
this.setAPYSize(0);
alert("형압 규격은 용지규격보다 작아야 합니다")
}
else{
if(this.getIsPPAP()&&ap_section!=""&&ap_x_size>0&&ap_y_size>0){
this_paper_qty=this.getPaperQty();
ap_price_unit=this.getAPPriceUnit();
if(cut_x_size<=(ap_x_size*1)+20&&cut_y_size>=(ap_y_size*1)+20){
this.setApMarginSize("가로크게")
}
else{
if(cut_x_size>=(ap_x_size*1)+20&&cut_y_size<=(ap_y_size*1)+20){
this.setApMarginSize("세로크게")
}
else{
if(cut_x_size<=(ap_x_size*1)+20&&cut_y_size<=(ap_y_size*1)+20){
this.setApMarginSize("가로크게,세로크게")
}
else{
this.setApMarginSize("")
}

}

}
if(ap_section=="APS10"){
ap_dongpan_price=this.getAPDongpanPrice()
}
else{
ap_dongpan_price=0
}
ap_price_unit=ap_price_unit*this_order_count;
var ap_extra_arry=this.getApExtraUnit(cut_x_size,cut_y_size,ap_x_size,ap_y_size);
ap_extra_arry=ap_extra_arry.split("^");
var extra_unit=parseFloat(ap_extra_arry[0]);
var extra_min=parseFloat(ap_extra_arry[1]);
var extra_unit3=parseFloat(ap_extra_arry[2]);
var extra_unit4=parseFloat(ap_extra_arry[3]);
ap_price_unit=ap_price_unit*extra_unit4*extra_unit;
ap_price_unit=Math.ceil(ap_price_unit/100)*100;
ap_price_unit=Math.max(ap_price_unit+extra_unit3,extra_min);
var cut_x_size=this.getCutXSize();
var cut_y_size=this.getCutYSize();
var cut_size_max=Math.max(cut_x_size,cut_y_size);
if(cut_size_max>=100){
ap_price_unit=Math.max(ap_price_unit,14000)
}
ap_price_unit+=500;
ap_dongpan_price=Math.ceil(ap_dongpan_price/100)*100;
ap_price=ap_price_unit+ap_dongpan_price;
var ap_add_unit_price=0;
$('ap_add_unit_price').value=ap_add_unit_price;
ap_price=ap_price+ap_add_unit_price;
this.setAPPrice(ap_price);
this.setAPDongpanPrice(ap_dongpan_price)
}
else{
this.setAPPrice(0);
this.setAPDongpanPrice(0);
$('ap_add_unit_price').value=0
}

}

}
,getApExtraUnit:function(cut_x_size,cut_y_size,ap_x_size,ap_y_size){
var x_max_size=Math.max(ap_x_size,30);
var y_max_size=Math.max(ap_y_size,30);
var xy_max_size=Math.max(x_max_size,y_max_size);
var extra_unit=1;
var extra_min=3000;
if(xy_max_size>=1&&xy_max_size<30){
extra_unit=1.00;
extra_min=3000
}
else if(xy_max_size>=30&&xy_max_size<35){
extra_unit=1.04;
extra_min=3300
}
else if(xy_max_size>=35&&xy_max_size<40){
extra_unit=1.08;
extra_min=3600
}
else if(xy_max_size>=40&&xy_max_size<45){
extra_unit=1.12;
extra_min=3900
}
else if(xy_max_size>=45&&xy_max_size<50){
extra_unit=1.16;
extra_min=4200
}
else if(xy_max_size>=50&&xy_max_size<55){
extra_unit=1.20;
extra_min=4500
}
else if(xy_max_size>=55&&xy_max_size<60){
extra_unit=1.24;
extra_min=4800
}
else if(xy_max_size>=60&&xy_max_size<65){
extra_unit=1.28;
extra_min=6000
}
else if(xy_max_size>=65&&xy_max_size<70){
extra_unit=1.32;
extra_min=6500
}
else if(xy_max_size>=70&&xy_max_size<75){
extra_unit=1.36;
extra_min=8000
}
else if(xy_max_size>=75&&xy_max_size<80){
extra_unit=1.40;
extra_min=1000
}
else if(xy_max_size>=80&&xy_max_size<85){
extra_unit=1.40;
extra_min=1300
}
else if(xy_max_size>=85&&xy_max_size<90){
extra_unit=1.40;
extra_min=14000
}
else if(xy_max_size>=90&&xy_max_size<95){
extra_unit=1.40;
extra_min=15000
}
else if(xy_max_size>=95&&xy_max_size<100){
extra_unit=1.40;
extra_min=18000
}
else if(xy_max_size>=100){
extra_unit=1.40;
extra_min=20000
}
var extra_unit3=500;
var extra_unit4=1.1;
if((cut_x_size==90&&cut_y_size==50)||(cut_x_size==50&&cut_y_size==90)){
extra_unit3=0;
extra_unit4=1
}
var order_count=this.getOrderCount();
var extra_min=extra_min*Math.max((order_count*0.7),1);
extra_min=Math.ceil(extra_min/100)*100;
var extra_price_arry=extra_unit+"^"+extra_min+"^"+extra_unit3+"^"+extra_unit4;
return extra_price_arry
}
,getAPDongpanPrice:function(){
ap_x_size=this.getAPXSize();
ap_y_size=this.getAPYSize();
var ap_dongpan_price=1000000000;
price0=Math.max(ap_x_size,30)*Math.max(ap_y_size,30)*0.8;
price0=Math.max(price0,3000);
price1=Math.max(ap_x_size,30)*Math.max(ap_y_size,30)*1.6+1100;
price2=3000;
price2=Math.max(price1,price2);
ap_dongpan_price=Math.max(price0+price2);
var ap_dongpan_add_price=0;
var order_count=parseInt($('order_count').value);
if(parseInt(this.seq)>1&&order_count>1){
var ap_compare=$('ap_compare_'+this.seq).value;
if(ap_compare=='BAC11'){

}

}
ap_dongpan_price=ap_dongpan_price+ap_dongpan_add_price;
this.outputDebugMsg("[getAPDongpanPrice]ap_dongpan_price:"+ap_dongpan_price);
return ap_dongpan_price
}
,getAPPriceUnit:function(){
this_paper_qty=this.getPaperQty();
var ap_work_price=this.getAPPaperWorkPrice();
var cut_x_size=this.getCutXSize();
var cut_y_size=this.getCutYSize();
var cut_size_max=Math.max(cut_x_size,cut_y_size);
var cut_size_min=Math.min(cut_x_size,cut_y_size);
var paper_max_price=this.getAPPaperMaxPrice(cut_size_max);
var ap_paper_add_price=this.getApPaperWorkAddPrice();
var ap_size_extra_unit=0;
if(cut_size_max>=150||cut_size_min>=100){
ap_size_extra_unit=2000
}
var ap_price_unit=Math.max((ap_work_price*this_paper_qty)+ap_size_extra_unit,paper_max_price);
ap_price_unit+=ap_paper_add_price;
return ap_price_unit
}
,getAPPaperWorkPrice:function(){
var cut_x_size=this.getCutXSize();
var cut_y_size=this.getCutYSize();
var ap_x_size=this.getAPXSize();
var ap_y_size=this.getAPYSize();
var pp_K43=Math.round(Math.min((ap_x_size+ap_y_size)/25,10),1);
var ap_paper_work_price=((cut_x_size+cut_y_size)/20+14)+pp_K43;
return ap_paper_work_price
}
,getApPaperWorkAddPrice:function(){
var cut_x_size=this.getCutXSize();
var cut_y_size=this.getCutYSize();
var cut_size_max=Math.max(cut_x_size,cut_y_size);
var this_paper_qty=this.getPaperQty();
var ap_paper_work_add_Price=0;
var paper_max_add_price=0;
if(cut_size_max>=100){
var R48=4000;
var R50=5000;
var R51=5000;
var R53=17000;
var R54=17000;
var R56=50000;
var Q48=101;
var Q50=170;
var Q51=171;
var Q53=300;
var Q54=301;
var Q56=600;
if(cut_size_max<Q48){
paper_max_add_price=0
}
else if(cut_size_max==Q48){
paper_max_add_price=R48
}
else if(cut_size_max<=169){
paper_max_add_price=R48-((R48-R50)/(Q50-Q48)*(cut_size_max-Q48))
}
else if(cut_size_max==Q50){
paper_max_add_price=R50
}
else if(cut_size_max==Q51){
paper_max_add_price=R51
}
else if(cut_size_max<=299){
paper_max_add_price=R51-((R51-R53)/(Q53-Q51)*(cut_size_max-Q51))
}
else if(cut_size_max==Q53){
paper_max_add_price=R53
}
else if(cut_size_max==Q54){
paper_max_add_price=R54
}
else if(cut_size_max<=599){
paper_max_add_price=R54-((R54-R56)/(Q56-Q54)*(cut_size_max-Q54))
}
else if(cut_size_max<=Q56){
paper_max_add_price=R56
}
var M8_a=(cut_x_size*cut_y_size)/5*this_paper_qty/1700;
var M8_b=1;
if(this_paper_qty>=3000&&cut_size_max>=120){
M8_b=(cut_x_size*cut_y_size)/3*this_paper_qty/3300-10000
}
else{
M8_b=1
}
ap_paper_work_add_Price=parseInt(paper_max_add_price+M8_a-M8_b)
}
return ap_paper_work_add_Price
}
,getAPPaperMaxPrice:function(cut_size_max){
var paper_max_price=0;
if(cut_size_max<100){
paper_max_price=3000
}
else if(cut_size_max<120){
paper_max_price=9000
}
else if(cut_size_max<150){
paper_max_price=12000
}
else if(cut_size_max<200){
paper_max_price=14000
}
else if(cut_size_max<250){
paper_max_price=16000
}
else if(cut_size_max<300){
paper_max_price=18000
}
else if(cut_size_max<350){
paper_max_price=20000
}
else if(cut_size_max<400){
paper_max_price=29000
}
else if(cut_size_max<500){
paper_max_price=34000
}
else if(cut_size_max<600){
paper_max_price=39000
}
else{
paper_max_price=44000
}
return parseFloat(paper_max_price)
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
,getNumberingKind:function(){
if($('numbering_kind').value==""){
return $('save_numbering_kind').value
}
else{
return $('numbering_kind').value
}

}
,getNumberingStart:function(){
if($('numbering_start').value==""){
return $('save_numbering_start').value
}
else{
return $('numbering_start').value
}

}
,setNumberingStart:function(number){
$('numbering_start').value=number
}
,getNumberingEnd:function(){
if($('numbering_end').value==""){
return $('save_numbering_end').value
}
else{
return $('numbering_end').value
}

}
,setNumberingEnd:function(number){
$('numbering_end').value=number
}
,setNumberingPrice:function(price){
$('numbering_amt').value=price
}
,getNumberingPrice:function(){
return $('numbering_amt').value
}
,getIsPPNumbering:function(){
if($('chk_is_numbering').checked==true){
return true
}
else{
return false
}

}
,settingNumberingKind:function(){
this_numbering_type=this.getNumberingType();
this_numbering_kind=this.getNumberingKind();
this.initSelectOptions('numbering_kind');
if(this_numbering_type=="NBT10"){
$('numbering_kind').options[0]=new Option("6자리 1개 정매수","NBN11",false);
$('numbering_kind').options[1]=new Option("6자리 2개 정매수","NBN12",false)
}
else if(this_numbering_type=="NBT20"){
$('numbering_kind').options[0]=new Option("난수넘버링 1개 정매수","NBN21",false);
$('numbering_kind').options[1]=new Option("난수넘버링 2개 정매수","NBN22",false)
}
this.thisPositionSelectOptions("numbering_kind",this_numbering_kind)
}
,isNumberingStart:function(){
var isNumberingStart=true;
$j('#numbering_end').css('background','#CCCCCC');
if(this.getIsPPNumbering()){
this_numbering_type=this.getNumberingType();
this_numbering_kind=this.getNumberingKind();
this_paper_qty=this.getPaperQty();
this_order_count=this.getOrderCount();
this_numbering_start=Number(this.getNumberingStart());
this_numbering_end=Number(this.getNumberingEnd());
numbering_jungmei=this_paper_qty*0.9;
if(this_numbering_start=='0'){
this_numbering_start=1
}
if($('numbering_start').value=='0'||$('numbering_start').value=='00'||$('numbering_start').value=='000'||$('numbering_start').value=='0000'||$('numbering_start').value=='00000'||$('numbering_start').value=='000000'||$('numbering_start').value==''){
alert("넘버링 최소 시작번호는 1입니다.");
$('numbering_start').value='000001'
}
else if(this_numbering_start>999994){
alert("넘버링 최대값은 999994입니다.");
$('numbering_start').value='000001'
}
else{
if(this_numbering_kind=="NBN11"||this_numbering_kind=="NBN12"||this_numbering_kind=="NBN21"||this_numbering_kind=="NBN22"){
numbering_total=numbering_jungmei
}
else{
numbering_total=this_paper_qty
}
paper_qty=parseInt($('paper_qty').value);
numbering_start=this_numbering_start;
numbering_end=paper_qty*0.9-1+numbering_start;
this_numbering_end=numbering_end;
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
$('numbering_start').value=new_numbering_start+this_numbering_start;
$('numbering_end').value=new_numbering_end+numbering_end;
$('numbering_start2').value=numbering_start;
$('numbering_end2').value=numbering_end;
$('span_numbering_end').innerHTML=numbering_jungmei;
if(this_numbering_type=="NBT10"){
$('numbering_start').show();
$('lbl_numbering_start').innerHTML="부터";
$('lbl_numbering_end').innerHTML="번";
if(this_numbering_end<=0){
alert("넘버링 시작, 끝 번호를 입력해주세요");
isNumberingStart=false;
return
}
else{
if((this_numbering_end-this_numbering_start)>numbering_total){
alert("정매 : 10% 여분 추가\n\n용지끝 : 인쇄주문매수에서 여분사용");
isNumberingStart=false;
this.setNumberingEnd(0);
return
}

}

}
else if(this_numbering_type=="NBT20"){
$('numbering_start').hide();
$('lbl_numbering_start').innerHTML="인쇄수량-제작여분수량=";
$('lbl_numbering_end').innerHTML="매";
if(this_numbering_start>numbering_total){
alert("정매 : 주문매수의 10% 여분 필요\n\n넘버링장수 : 넘버링 장수 입력");
isNumberingStart=false;
return
}
else{

}

}
else{
if((this_numbering_end-this_numbering_start)>=numbering_total){
alert("정매 : 10% 여분 추가\n\n용지끝 : 인쇄주문매수에서 여분사용");
isNumberingStart=false;
return
}

}

}

}
else{
isNumberingStart=false
}
return isNumberingStart
}
,calcuNumberingPrice:function(){
this_paper_code=this.getPaperCode();
if(this.getIsPPNumbering()){
this.settingNumberingKind()
}
var paper_gloss2=document.getElementsByName('paper_gloss2');
if((paper_gloss2[0].checked==true&&this_paper_code=='SNW250W00')||this_paper_code=='SNW300W00'){
$('numbering_kind').disabled=true;
$('numbering_type').disabled=true;
$('numbering_amt').disabled=true;
if(paper_gloss2[0].checked==true&&this_paper_code=='SNW250W00'){
alert('선택한 용지의 무광코팅은 넘버링을 할 수 없습니다.')
}
else{
alert('선택한 용지는 넘버링을 할 수 없습니다.')
}
$('chk_is_numbering').checked=false;
$('pnl_numbering').hide();
this.setNumberingPrice(0);
this.outputDebugMsg("[calcuNumberingPrice 1-1]numbering_price:0")
}
else{
$('numbering_kind').disabled=false;
$('numbering_type').disabled=false;
$('numbering_amt').disabled=false;
isNumberingStart=this.isNumberingStart();
if(isNumberingStart){
if(this.getIsPPNumbering()){
this_paper_qty=this.getPaperQty();
this_order_count=this.getOrderCount();
this_numbering_type=this.getNumberingType();
this_numbering_kind=this.getNumberingKind();
numbering_price_unit=this.calcuNumberingPriceUnit();
var NUMBERING_TYPE_PRICE_RATE=70000;
var NUMBERING_KIND_RATE=1.2;
if(this_numbering_type=='NBT10'){
NUMBERING_TYPE_PRICE_RATE=38000
}
if(this_numbering_kind=='NBN11'||this_numbering_kind=='NBN13'||this_numbering_kind=='NBN21'||this_numbering_kind=='NBN23'){
NUMBERING_KIND_RATE=1
}
numbering_price=Math.ceil(Math.max(NUMBERING_KIND_RATE*numbering_price_unit,NUMBERING_TYPE_PRICE_RATE)/1000)*1000*this_order_count;
if($('paper_code').value=='DNT250GP0'||$('paper_code').value=='UPP250FB0'){
numbering_price=0;
chkPostPress('0','numbering');
$('chk_is_numbering').checked=false;
alert('다이니티 골드펄250g, 유포지 FEB 250g은 넘버링이 불가능 합니다.')
}
this.setNumberingPrice(numbering_price);
this.outputDebugMsg("[calcuNumberingPrice 1-2]numbering_price:"+numbering_price+",numbering_price_unit:"+numbering_price_unit+",this_order_count:"+this_order_count)
}
else{
this.setNumberingPrice(0);
this.outputDebugMsg("[calcuNumberingPrice 1-3]numbering_price:0")
}

}
else{
this.setNumberingPrice(0);
this.outputDebugMsg("[calcuNumberingPrice 1-4]numbering_price:0")
}

}

}
,calcuNumberingPriceUnit:function(){
this_numbering_type=this.getNumberingType();
this_paper_qty=this.getPaperQty();
var cut_x_size=this.getCutXSize();
var cut_y_size=this.getCutYSize();
var NUMBERING_TYPE_SIZE_RATE=20;
var NUMBERING_TYPE_PAPER_QTY_MIN_RATE=40000;
var NUMBERING_TYPE_PAPER_QTY_MAX_RATE=80000;
var NUMBERING_TYPE_PRICE_UNIT=26000;
if(this_numbering_type=="NBT20"){
if($('category_code').value=='CNC4000'){
NUMBERING_TYPE_SIZE_RATE=5
}
else{
NUMBERING_TYPE_SIZE_RATE=15
}
NUMBERING_TYPE_PAPER_QTY_MIN_RATE=60000;
NUMBERING_TYPE_PAPER_QTY_MAX_RATE=100000;
NUMBERING_TYPE_PRICE_UNIT=45000
}
var numbering_size_rate=(cut_x_size+cut_y_size)/NUMBERING_TYPE_SIZE_RATE;
var numbering_paper_qty_mim_price=Math.min(this_paper_qty,20000);
var numbering_paper_qty_mim_rate=Math.max(1-(numbering_paper_qty_mim_price/NUMBERING_TYPE_PAPER_QTY_MIN_RATE),0.65);
var numbering_paper_qty_min=numbering_size_rate*numbering_paper_qty_mim_price*1.5*numbering_paper_qty_mim_rate;
var numbering_paper_qty_max_price=Math.max(this_paper_qty-20000,0);
var numbering_paper_qty_max_rate=Math.max(1-(numbering_paper_qty_max_price/NUMBERING_TYPE_PAPER_QTY_MAX_RATE),0.65);
var numbering_paper_qty_max=numbering_size_rate*numbering_paper_qty_max_price*0.4*numbering_paper_qty_max_rate;
var work_x_size=parseInt($('work_x_size').value);
var work_y_size=parseInt($('work_y_size').value);
var cut_x_size=parseInt($('cut_x_size').value);
var cut_y_size=parseInt($('cut_y_size').value);
var this_size_type=this.getSizeType();
var category_code=this.getCategoryCode();
var numbering_add_price=0;
if(this_size_type=='SZT20'&&(category_code=="CNC1000"||category_code=="CNC2000"||category_code=="CNC4000"||category_code=="CNC6000")||category_code=="CVS1000"||category_code=="CVS2000"||category_code=="CVS3000"||category_code=="CVS6000"){
var cut_max_size=Math.max(cut_x_size,cut_y_size);
if(this_numbering_type=="NBT10"){
if(cut_max_size>91&&cut_max_size<=199){
numbering_add_price=5000
}
else if(cut_max_size>199&&cut_max_size<=299){
numbering_add_price=25000
}
else if(cut_max_size>299){
numbering_add_price=50000
}

}
if(this_numbering_type=="NBT20"){
if(cut_max_size>91&&cut_max_size<=199){
numbering_add_price=5000
}
else if(cut_max_size>199&&cut_max_size<=299){
numbering_add_price=20000
}
else if(cut_max_size>299){
numbering_add_price=48000
}

}

}
var this_paper_qty=this.getPaperQty();
var numbering_ordercount_add_amt=0;
if(this_paper_qty<500){
numbering_ordercount_add_amt=Math.min(15000*(0*this_paper_qty/1200)+2000,15000)
}
else{
numbering_ordercount_add_amt=Math.min(15000*(1*this_paper_qty/1200)+2000,15000)
}
numbering_price_unit=numbering_paper_qty_min+numbering_paper_qty_max+NUMBERING_TYPE_PRICE_UNIT+numbering_add_price+numbering_ordercount_add_amt;
this.outputDebugMsg("[calcuNumberingPriceUnit]numbering_price_unit:"+numbering_price_unit+",numbering_paper_qty_min:"+numbering_paper_qty_min+",numbering_paper_qty_max:"+numbering_paper_qty_max);
return numbering_price_unit
}

}
);
var ppTagong=Class.create(Postpress,{
initialize:function($super){
$super();
this.save_tagong_num=$("save_tagong_num").value
}
,getTagongSize:function(){
return $('tagong_size').value
}
,getTagongNum:function(){
if($('tagong_num').value==""){
return 0
}
else{
return parseInt($('tagong_num').value)
}

}
,setTagongPrice:function(price){
$('tagong_amt').value=price
}
,getTagongPrice:function(){
if($('tagong_amt').value==""){
return 0
}
else{
return parseInt($('tagong_amt').value)
}

}
,getIsPPTagong:function(){
if($('chk_is_tagong').checked==true){
return true
}
else{
return false
}

}
,calcuTagongPrice:function(){
if(this.getIsPPTagong()){

}
this.enabledTagongOption();
var tagong_num=this.getTagongNum();
var tagong_price=0;
if(this.getIsPPTagong()&&tagong_num>0){
var this_paper_qty=this.getPaperQty();
var tagong_extra_rate=this.calcuTagongExtraRate();
var tagong_discount_rate=this.calcuTagongDiscountRate();
var this_order_count=this.getOrderCount();
var paper_extra_rate=this.calcuTagongPaperExtraRate();
tagong_price=Math.max((Math.round(4*this_paper_qty*tagong_extra_rate*tagong_discount_rate*paper_extra_rate/100)*100)+1500,2000)*this_order_count;
tagong_price=Math.max(tagong_price,2500);
this.setTagongPrice(tagong_price)
}
else{
this.setTagongPrice(0)
}

}
,calcuTagongPaperExtraRate:function(){
var category_code=this.getCategoryCode();
var paper_code=this.getPaperCode();
var paper_extra_rate=1;
if(paper_code=='ARE310W00'||paper_code=='ARM310W00'||paper_code=='TDR300W00'||paper_code=='SNW250W00'||paper_code=='SNW300W00'||paper_code=='CFT30000N'||paper_code=='VNV320W00'||paper_code=='RDV310N00'){
paper_extra_rate=1.2
}
else if(paper_code=='ETM350W00'||paper_code=='ETP370W00'||paper_code=='EGS400WH1'||paper_code=='RBE359W00'||paper_code=='VVT359W00'||paper_code=='DUO400W01'){
paper_extra_rate=1.5
}
if(category_code=='CNC3000'||category_code=='CNC5000'){
paper_extra_rate=1.5
}
else if(category_code=='CNC4000'||category_code=='CNC6000'){
paper_extra_rate=1.2
}
return paper_extra_rate
}
,calcuTagongExtraRate:function(){
tagong_num=this.getTagongNum();
var tagong_extra_rate=1;
if(tagong_num==1){
tagong_extra_rate=1
}
else if(tagong_num==2){
tagong_extra_rate=1.5
}
else if(tagong_num==3){
tagong_extra_rate=2.0
}
else if(tagong_num==4){
tagong_extra_rate=2.5
}
return tagong_extra_rate
}
,calcuTagongDiscountRate:function(){
this_paper_qty=this.getPaperQty();
tagong_discount_price=Math.max(1-(this_paper_qty/20000),0.75);
return tagong_discount_price
}
,enabledTagongOption:function(){
$('tagong_num').disabled=false;
$('tagong_size').disabled=false
}
,disableTagongOption:function(){
$('tagong_num').disabled=true;
$('tagong_size').disabled=true
}

}
);
var ppGuidori=Class.create(Postpress,{
initialize:function($super){
$super()
}
,getGuidoriType:function(){
if($('guidori_type').value==""){
return $('save_guidori_type').value
}
else{
return $('guidori_type').value
}

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
if(guidori_position=='0'||guidori_position==''){
$('guidori_position1').checked=false;
$('guidori_position2').checked=false;
$('guidori_position3').checked=false;
$('guidori_position4').checked=false
}
else{
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

}

}

}
,calcuGuidoriPrice:function(){
this.calcuGuidoriPosition();
guidori_type=this.getGuidoriType();
this_category_code=this.getCategoryCode();
this_size_type=this.getSizeType();
this.initSelectOptions('guidori_type');
if(this_category_code=='CNC3000'||this_category_code=='CNC5000'){
if(this_size_type=='SZT10'){
$('guidori_type').options[0]=new Option("네귀도리(4mm)","GDR40",false);
$('guidori_type').options[1]=new Option("사각재단만(귀도리안함)","GDR90",false);
if(guidori_type==''){
guidori_type="GDR40"
}

}
else{
$('guidori_type').options[0]=new Option("네귀도리(4mm)","GDR40",false);
$('guidori_type').options[1]=new Option("세귀도리(4mm)","GDR30",false);
$('guidori_type').options[2]=new Option("두귀도리(4mm)","GDR20",false);
$('guidori_type').options[3]=new Option("한귀도리(4mm)","GDR10",false);
$('guidori_type').options[4]=new Option("사각재단만(귀도리안함)","GDR90",false);
if(guidori_type==''){
guidori_type="GDR40"
}

}

}
else{
$('guidori_type').options[0]=new Option("네귀도리(4mm)","GDR40",false);
$('guidori_type').options[1]=new Option("세귀도리(4mm)","GDR30",false);
$('guidori_type').options[2]=new Option("두귀도리(4mm)","GDR20",false);
$('guidori_type').options[3]=new Option("한귀도리(4mm)","GDR10",false);
$('guidori_type').options[4]=new Option("네귀도리(6mm)","GDR80",false);
$('guidori_type').options[5]=new Option("세귀도리(6mm)","GDR70",false);
$('guidori_type').options[6]=new Option("두귀도리(6mm)","GDR60",false);
$('guidori_type').options[7]=new Option("한귀도리(6mm)","GDR50",false);
if(guidori_type==''){
guidori_type="GDR40"
}

}
this.thisPositionSelectOptions("guidori_type",guidori_type);
if(this.getIsPPGuidori()&&guidori_type!=""){
var guidori_price_unit=this.calcuGuidoriPriceUnit();
this_order_count=this.getOrderCount();
var cut_x_size=this.getCutXSize();
var cut_y_size=this.getCutYSize();
if(this_category_code=="CNC5000"&&((cut_x_size=="86"&&cut_y_size=="54")||(cut_x_size=="54"&&cut_y_size=="86"))){
guidori_price=0
}
else if(this_category_code=="CNC3000"&&((cut_x_size=="86"&&cut_y_size=="54")||(cut_x_size=="54"&&cut_y_size=="86"))){
guidori_price=0
}
else{
guidori_price=guidori_calcu_price;
if(this_category_code=='CNC3000'||this_category_code=='CNC5000'){
guidori_price=guidori_price*2
}

}
var is_guidori=true;
if(guidori_type=='GDR90'){
is_guidori=false
}
else if(guidori_type=='GDR40'){
if(this_category_code=="CNC5000"&&((cut_x_size=="86"&&cut_y_size=="54")||(cut_x_size=="54"&&cut_y_size=="86"))){
is_guidori=false
}
else if(this_category_code=="CNC3000"&&((cut_x_size=="86"&&cut_y_size=="54")||(cut_x_size=="54"&&cut_y_size=="86"))){
is_guidori=false
}
else{
is_guidori=true
}

}
else{
is_guidori=true
}
if(is_guidori==true){
var guidori_calcu_price=(Math.round(Math.max(guidori_price_unit,2000)/100)*100)*this_order_count;
 guidori_price=guidori_calcu_price;
if(this_category_code=='CNC3000'||this_category_code=='CNC5000'){
guidori_price=guidori_price*2
}

}
else{
guidori_price=0
}
guidori_price=Math.ceil(guidori_price/100)*100;
this.setGuidoriPrice(guidori_price);
this.outputDebugMsg("[calcuGuidoriPrice]guidori_price:"+guidori_price)
}
else{
this.setGuidoriPrice(0);
this.outputDebugMsg("[calcuGuidoriPrice]guidori_price:0")
}

}
,calcuGuidoriPriceUnit:function(){
this_paper_qty=this.getPaperQty();
var cut_x_size=this.getCutXSize();
var cut_y_size=this.getCutYSize();
var guidori_size_rate=Math.max((cut_x_size+cut_y_size)/500-0.14,0);
var guidori_paper_qty_rate=this_paper_qty*5.4;
var guidori_discount_rate=Math.max(1-(this_paper_qty/20000),0.7)+guidori_size_rate;
var guidori_price_unit=guidori_paper_qty_rate*guidori_discount_rate;
return guidori_price_unit
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
,getPartsNum:function(){
return $("parts_num").value
}
,getPaperCode:function(){
if($('paper_code').value==""){
return $("save_paper_code").value
}
else{
return $('paper_code').value
}

}
,getWorkXSize:function(){
return parseInt($('work_x_size').value)
}
,getWorkYSize:function(){
return parseInt($('work_y_size').value)
}
,calcuEpoxyPrice:function(){
category_code=this.getCategoryCode();
paper_code=this.getPaperCode();
epoxy_type=this.getEpoxyType();
epoxy_kind=this.getEpoxyKind();
order_count=this.getOrderCount();
paper_qty=parseInt($('paper_qty').value);
var depoxy_paper_arr=Array('ARM310W00','ETM350W00','VNV186W00','VNV227SW0','ARM230W00','VNV320W00','RDV310N00');
if(this.getIsPPDomusong()){
cut_x_size=parseInt($('domusong_x_size').value);
cut_y_size=parseInt($('domusong_y_size').value)
}
else{
cut_x_size=parseInt($('cut_x_size').value);
cut_y_size=parseInt($('cut_y_size').value)
}
cut_max_size=Math.max(cut_x_size,cut_y_size);
cut_min_size=Math.min(cut_x_size,cut_y_size);
this.initSelectOptions('epoxy_type');
if(cut_max_size<=100&&cut_max_size>=80&&cut_min_size>=50&&cut_min_size<=90){
if($('paper_code').value=='CFT30000N'||(category_code!='CNC2000'&&($('paper_code').value=='ETM350W00'||$('paper_code').value=='ETP370W00'))){
$('epoxy_type').options[0]=new Option("전면","EPT10",false);
$('epoxy_type').options[0].selected=true
}
else if(category_code=='CNC2000'&&($('paper_code').value=='BKN350BL0'||$('paper_code').value=='BKN380BL0')){
$('epoxy_type').options[0]=new Option("전면","EPT10",false);
$('epoxy_type').options[1]=new Option("후면","EPT20",false);
if(epoxy_type==''||epoxy_type=='EPT30'){
$('epoxy_type').options[0].selected=true
}
else{
this.thisPositionSelectOptions("epoxy_type",epoxy_type)
}

}
else if(category_code=='CNC2000'&&($('paper_code').value=="ARE310W00"||$('paper_code').value=="ARM310W00"||$('paper_code').value=="VNV186W00"||$('paper_code').value=="VNV227SW0"||$('paper_code').value=="ETM350W00"||$('paper_code').value=="ETP370W00")){
$('epoxy_type').options[0]=new Option("전면","EPT10",false);
$('epoxy_type').options[1]=new Option("후면","EPT20",false);
this.thisPositionSelectOptions("epoxy_type",epoxy_type)
}
else{
$('epoxy_type').options[0]=new Option("전면","EPT10",false);
$('epoxy_type').options[1]=new Option("후면","EPT20",false);
$('epoxy_type').options[2]=new Option("양면","EPT30",false);
this.thisPositionSelectOptions("epoxy_type",epoxy_type)
}

}
else{
$('epoxy_type').options[0]=new Option("없음","",false);
$('epoxy_type').options[0].selected=true
}
if(category_code=='CNC6000'||category_code=='CVS6000'){
this.initSelectOptions('epoxy_type');
$('epoxy_type').options[0]=new Option("전면","EPT10",false);
$('epoxy_type').options[1]=new Option("양면","EPT30",false);
if(!(category_code=='CNC6000'&&$('paper_code').value!='SNW300W00')){
$('epoxy_type').options[1]=new Option("양면","EPT30",false)
}
this.thisPositionSelectOptions("epoxy_type",epoxy_type);
$('epoxy_kind').hide()
}
if($('paper_code').value=='UPP250FB0'&&$('epoxy_type').value=='EPT30'){
alert("해당 용지는 양면을 선택 할 수 없습니다.");
this.thisPositionSelectOptions("epoxy_type","EPT10");
return
}
epoxy_type=this.getEpoxyType();
this.initSelectOptions('epoxy_kind');
epoxy_kind=this.getEpoxyKind();
if(epoxy_type=='EPT30'){
$('epoxy_kind').options[0]=new Option("전면칼라+후면칼라 코팅","EPK30",false);
if(category_code!="CNC2000"){
$('epoxy_kind').options[1]=new Option("전면칼라+후면먹 코팅","EPK40",false);
$('epoxy_kind').options[2]=new Option("전면먹+후면칼라 코팅","EPK50",false);
$('epoxy_kind').options[3]=new Option("전면먹+후면먹 코팅","EPK60",false)
}

}
else if(epoxy_type=='EPT10'||epoxy_type=='EPT20'){
$('epoxy_kind').options[0]=new Option("칼라부분 코팅","EPK10",false)
}
else{
$('epoxy_kind').options[0]=new Option("없음","",false);
$('epoxy_kind').options[0].selected=true
}
this.thisPositionSelectOptions("epoxy_kind",epoxy_kind);
if(category_code=='CNC6000'||category_code=='CVS6000'){
$('epoxy_kind').options[0]=new Option("없음","",false);
$('epoxy_kind').options[0].selected=true
}
var epoxy_price=0;
var depoxy_price=0;
if(epoxy_type){
if((depoxy_paper_arr.includes(paper_code)&&category_code=="CNC2000")||category_code=="CNC6000"){
depoxy_price=this.calcuDEpoxyPrice();
epoxy_price=depoxy_price
}
else{
epoxy_price=(paper_qty/100*4500);
if(category_code=='CNC6000'||category_code=='CVS6000'){
var paper_qty=parseInt($('paper_qty').value);
var work_x_size=parseInt($('work_x_size').value);
var work_y_size=parseInt($('work_y_size').value);
var epoxy_F4=1;
var epoxy_G4=1;
var epoxy_F5=1;
var epoxy_G5=1;
var epoxy_I4=1;
var epoxy_I5=1;
var epoxy_K5=1;
epoxy_F4=Math.ceil(work_x_size/92);
epoxy_G4=Math.ceil(work_y_size/52);
epoxy_F5=Math.ceil(work_y_size/92);
epoxy_G5=Math.ceil(work_x_size/52);
epoxy_I4=epoxy_F4*epoxy_G4;
epoxy_I5=epoxy_F5*epoxy_G5;
epoxy_K5=Math.min(epoxy_I4,epoxy_I5);
epoxy_price=epoxy_K5*7000*(paper_qty/200);
 epoxy_price=Math.ceil(epoxy_price/100)*100
}
epoxy_price=Math.max(epoxy_price,4000);
epoxy_price=Math.max(epoxy_price,paper_qty*20);
if(epoxy_type!=''){
if(epoxy_type=='EPT30'){
epoxy_price=epoxy_price*2
}

}

}
epoxy_price=epoxy_price*order_count
}
this.setEpoxyPrice(epoxy_price)
}
,calcuDEpoxyPrice:function(){
var depoxy_x_size=30;
var depoxy_y_size=30;
var paper_qty=parseInt($('paper_qty').value);
var epoxy_type=this.getEpoxyType();
var depoxy_price=0;
var work_x_size=this.getWorkXSize();
var work_y_size=this.getWorkYSize();
if(category_code=="CNC6000"||category_code=="CNC2000"){
var this_paper_code=this.getPaperCode();
order_count=this.getOrderCount();
paper_qty=parseInt($('paper_qty').value);
var depoxy_paper_in_arr=Array('ARM310W00','VNV186W00','VNV227SW0','ARM230W00','VNV320W00','RDV310N00');
var setNum=Math.min(Math.ceil(work_x_size/92)*Math.ceil(work_y_size/52),Math.ceil(work_x_size/52)*Math.ceil(work_y_size/92));
if(depoxy_paper_in_arr.includes(this_paper_code)){
depoxy_price=setNum*20*paper_qty
}
else{
depoxy_price=setNum*45*paper_qty
}
if(this.getEpoxyType()=="EPT30"){
depoxy_price=depoxy_price*2
}
depoxy_price=depoxy_price
}
else{
var this_part_num=this.getPartsNum();
var ret=this.settingA2B2PartsNum();
this_part_num=$('a2_parts_num').value;
var tong_su=Math.ceil(paper_qty/this_part_num);
var convert_qty=Math.ceil(tong_su*this_part_num);
var basic_margin_ratio=0;
var this_paper_size=this.getPaperSize();
var base_amt=0;
var base_amt_jojeong=0;
var base_work_margin_ratio=(120/100);
var base_epoxy_amt=base_amt+base_amt_jojeong;
var org_basic_depoxy_amt=base_amt+base_amt_jojeong;
var basic_depoxy_amt=Math.ceil((org_basic_depoxy_amt*basic_margin_ratio)/100)*100;
 var work_margin_page=0;
var basic_work_unit_amt=570;
var min_work_unit_amt=320;
var margin_amt=(min_work_unit_amt*1.3)*work_margin_page;
var margin_ratio=Math.max(1-(Math.max(tong_su,1)/1300),0.7);
var org_work_amt=margin_amt+basic_work_unit_amt/this_part_num*convert_qty*margin_ratio;
 var area_add_ratio=0;
var work_margin_ratio=Math.max((230/100)-area_add_ratio,(133/100));
var work_depoxy_amt=Math.ceil((org_work_amt*work_margin_ratio)/100)*100;
 var work_depoxy_amt=Math.ceil((org_work_amt*base_work_margin_ratio*margin_ratio)/100)*100;
 var depoxy_I6=0.0027/0.467/0.636/0.0985*0.75*0.1;
var depoxy_I7=160000;
var depoxy_I8=cut_x_size*cut_y_size/1000/1000;
var depoxy_K5=Math.max((depoxy_x_size*depoxy_y_size)/(cut_x_size*cut_y_size),(18/100));
var depoxy_K6=Math.min(Math.max(((40/100)/depoxy_K5),(67/100)),(100/100));
var depoxy_basic_amt=Math.ceil(depoxy_I6*depoxy_I7*depoxy_I8*depoxy_K5*depoxy_K6);
var depoxy_extra_amt=depoxy_basic_amt*work_margin_page;
var depoxy_basic_margin_ratio=0;
var depoxy_margin_ratio=Math.max((230/100)-area_add_ratio,(133/100));
var qty_sail_ratio=Math.max((100/100)-Math.max(tong_su,1)/1300,(70/100));
var depoxy_amt=Math.ceil((depoxy_extra_amt*depoxy_basic_margin_ratio+depoxy_basic_amt*depoxy_margin_ratio*convert_qty*qty_sail_ratio)/100)*100;
 depoxy_price=basic_depoxy_amt+work_depoxy_amt+depoxy_amt;
depoxy_price=Math.ceil(depoxy_price/100)*100
}
return depoxy_price
}

}
);
var ppDBak=Class.create(Postpress,{
initialize:function($super,seq){
$super();
this.seq=0;
this.small_unit=0;
this.min_price=0;
this.min_unit=0
}
,setDBakSeq:function(seq){
this.seq=seq
}
,getDBakSection:function(){
return $('dbak_section_'+this.seq).value
}
,getDBakSide:function(){
return $('dbak_side_'+this.seq).value
}
,getDBakType:function(){
return $('dbak_type_'+this.seq).value
}
,setDBakXSize:function(size){
$('dbak_x_size_'+this.seq).value=size
}
,getDBakXSize:function(){
return $('dbak_x_size_'+this.seq).value
}
,setDBakYSize:function(size){
$('dbak_y_size_'+this.seq).value=size
}
,getDBakYSize:function(){
return $('dbak_y_size_'+this.seq).value
}
,setDBakMarginSize:function(size){
$('dbak_margin_size_'+this.seq).value=size
}
,setDBakPrice:function(price){
$('dbak_amt_'+this.seq).value=price
}
,getDBakPrice:function(){
return $('dbak_amt_'+this.seq).value
}
,setDBakDongpanPrice:function(price){
$('detc1_'+this.seq).value=price
}
,getDBakDongpanPrice:function(){
return $('detc1_'+this.seq).value
}
,getIsPPDBak:function(){
if($('chk_is_dbak').checked==true){
return true
}
else{
return false
}

}
,getPaperCode:function(){
if($('paper_code').value==""){
return $("save_paper_code").value
}
else{
return $('paper_code').value
}

}
,getWorkXSize:function(){
return parseInt($('work_x_size').value)
}
,getWorkYSize:function(){
return parseInt($('work_y_size').value)
}
,settingDBakType:function(){
this_dbak_section=this.getDBakSection()
}
,getDBakNum:function(){
return $('dbak_num_'+this.seq).value
}
,calcuDBakPrice:function(){
if(this.getIsPPDBak()){
this.settingDBakType()
}
var dbak_section=this.getDBakSection();
var dbak_side=this.getDBakSide();
var dbak_x_size=30;
var dbak_y_size=30;
var dbak_x_size_chk=dbak_x_size+4;
var dbak_y_size_chk=dbak_y_size+4;
var cut_x_size=this.getCutXSize();
var cut_y_size=this.getCutYSize();
var work_x_size=this.getWorkXSize();
var work_y_size=this.getWorkYSize();
if(cut_x_size<dbak_x_size_chk||cut_y_size<dbak_y_size_chk){
this.setDBakPrice(0);
this.setDBakXSize(0);
this.setDBakYSize(0);
alert("디지털 박은 재단선보다 4mm 작아야 합니다.")
}
else{
if(category_code=="CNC8000"||category_code=="CNC2000"){
var this_paper_code=this.getPaperCode();
order_count=this.getOrderCount();
paper_qty=parseInt($('paper_qty').value);
var dbak_paper_arr=Array('VNV186W00','VNV227SW0','RDV310N00','ARM230W00','ARM310W00');
var setNum=Math.min(Math.ceil(work_x_size/92)*Math.ceil(work_y_size/52),Math.ceil(work_x_size/52)*Math.ceil(work_y_size/92));
if(dbak_paper_arr.includes(this_paper_code)){
final_dbak_price=setNum*25*paper_qty
}
else{
final_dbak_price=setNum*50*paper_qty
}
if(this.getDBakSide()=="BKD30"){
final_dbak_price=final_dbak_price*2
}
final_dbak_price=final_dbak_price*order_count;
this.setDBakPrice(final_dbak_price)
}
else if(this.getIsPPDBak()&&dbak_section!=""&&dbak_x_size>0&&dbak_y_size>0){
order_count=this.getOrderCount();
paper_qty=parseInt($('paper_qty').value);
var this_part_num=$("parts_num").value;
var ret=this.settingA2B2PartsNum();
this_part_num=$('a2_parts_num').value;
var cut_x_size=this.getCutXSize();
var cut_y_size=this.getCutYSize();
var tong_su=Math.ceil(paper_qty/this_part_num);
var convert_qty=Math.ceil(tong_su*this_part_num);
var qty_sail_ratio=Math.max((100/100)-Math.max(tong_su,1)/1300,(70/100));
var base_amt=0;
var dbak_base_amt=0;
var dbak_polymer_amt=0;
var dbak_film_amt=0;
var dbak_type=this.getDBakType();
switch(dbak_type){
case'BKT02':dbak_film_amt=420000;
break;
case'BKT09':dbak_film_amt=420000;
break;
case'BKT01':dbak_film_amt=420000;
break;
case'BKT10':dbak_film_amt=420000;
break
}
var dbak_unit_cost_per_meter=Math.ceil(dbak_film_amt/0.5/1000);
var dbak_cost=Math.ceil(dbak_unit_cost_per_meter*0.5*0.74);
var area_add_ratio=0;
var work_margin_page=0;
var basic_work_unit_amt=570;
var min_work_unit_amt=320;
var margin_amt=(min_work_unit_amt*1.3)*work_margin_page;
var this_paper_size=this.getPaperSize();
var base_amt=0;
var base_amt_jojeong=0;
var org_basic_depoxy_amt=base_amt+base_amt_jojeong;
var basic_margin_ratio=0;
base_amt=Math.ceil((org_basic_depoxy_amt*basic_margin_ratio)/100)*100;
 var work_basic_amt=margin_amt+(basic_work_unit_amt/this_part_num*convert_qty*qty_sail_ratio);
 var dbak_add_basic_amt=0;
var dbak_work_basic_amt=dbak_cost*work_margin_page;
var basic_magin_ratio=(170/100);
var work_margin_ratio=(120/100);
dbak_base_amt=Math.ceil((dbak_work_basic_amt*basic_magin_ratio)/100)*100+Math.ceil((work_basic_amt*work_margin_ratio*qty_sail_ratio+dbak_add_basic_amt)/100)*100;
var dbak_polymer_U6=0.0027/0.467/0.636/0.0985*0.75*0.1;
var dbak_polymer_U7=160000;
var dbak_polymer_U8=cut_x_size*cut_y_size/1000/1000;
var dbak_polymer_W5=Math.max((dbak_x_size*dbak_y_size)/(cut_x_size*cut_y_size),(18/100));
var dbak_polymer_W6=Math.min(Math.max(((40/100)/dbak_polymer_W5),(67/100)),(100/100));
var polymer_base_cost=Math.ceil(dbak_polymer_U6*dbak_polymer_U7*dbak_polymer_U8*dbak_polymer_W5*dbak_polymer_W6);
var depoxy_surplus_amt=polymer_base_cost*work_margin_page;
var dbak_polymer=depoxy_surplus_amt+(polymer_base_cost*convert_qty);
var polymer_area_add=Math.min(Math.max((cut_x_size*cut_y_size)/(466*317)-0.25,1)-1,(50/100));
var polymer_magin_ratio=80/100;
var polymer_basic_magin_ratio=0;
dbak_polymer_amt=Math.ceil((depoxy_surplus_amt*polymer_basic_magin_ratio+polymer_base_cost*polymer_magin_ratio*convert_qty*qty_sail_ratio)/100)*100;
 var dbak_scodix_cost=dbak_cost*convert_qty/this_part_num*qty_sail_ratio;
 var dbak_area_ratio=Math.max((dbak_x_size*dbak_y_size)/(cut_x_size*cut_y_size),(18/100));
var dbak_area_saile=(100/100)-Math.min(Math.max(((40/100)/dbak_area_ratio),(80/100)),(100/100));
 var dbak_margin_ratio=90/100;
var dbak_amt=Math.ceil((dbak_scodix_cost*dbak_margin_ratio*qty_sail_ratio)/100)*100;
 var final_dbak_price=base_amt+dbak_base_amt+dbak_polymer_amt+dbak_amt;
final_dbak_price=Math.max(final_dbak_price,5000);
final_dbak_price=Math.max(final_dbak_price,paper_qty*25);
if(this.getDBakSide()=="BKD30"){
final_dbak_price=final_dbak_price*2
}
final_dbak_price=final_dbak_price*order_count;
this.setDBakPrice(final_dbak_price)
}
else{
this.setDBakPrice(0)
}

}

}
,setDBakNum:function(){
category_code=this.getCategoryCode();
order_count=this.getOrderCount()
}

}
);
