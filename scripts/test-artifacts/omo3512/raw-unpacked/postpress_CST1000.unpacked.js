var Postpress=Class.create(Print,{
initialize:function($super){
$super()
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
,getPaperCode:function(){
if($('paper_code').value==""){
return this.save_paper_code
}
else{
return $('paper_code').value
}

}
,getCoatingType:function(){
if($('coating_type').value==""){
return $('save_coating_type').value
}
else{
return $('coating_type').value
}

}
,setCoatingType:function(type){
$('coating_type').value=type
}
,setOrderMethod:function(method){
$('order_method').value=method
}
,getOrderMethod:function(){
return $('order_method').value
}
,setCoatingPrice:function(price){
$('coating_amt').value=price
}
,getCoatingPrice:function(){
return $('coating_amt').value
}
,getIsPPCoating:function(){
if($('coating_type').value){
return true
}
else{
return false
}

}
,setPrintPaperQty:function(num){
$('print_paper_qty').value=num
}
,getPrintPaperQty:function(){
return $("print_paper_qty").value
}
,settingCoatingType:function(){
var this_coating_type=this.getCoatingType();
var this_paper_code=this.getPaperCode();
this.initSelectOptions('coating_type');
var show_code=this_paper_code.substring(0,8);
if(show_code=="STK025SD"||show_code=="STK025TD"||show_code=="STK038DT"){
$('coating_type').options[0]=new Option("유광써멀라미네팅","COT70",false)
}
else if(show_code=="STK080VL"||show_code=="STK080YP"||show_code=="STK120PV"||show_code=='STK057CR0'||this_paper_code=='STK080ABL'||this_paper_code=='STK060HU1'){
this.setCoatingPrice(0);
$('coating_type').options[0]=new Option("코팅없음","COT80",false)
}
else if(this_paper_code=="STK090AT1"||this_paper_code=='STK090AF0'||this_paper_code=='STK075AT1'){
$('coating_type').options[0]=new Option("유광써멀라미네팅","COT70",false);
$('coating_type').options[1]=new Option("코팅없음","COT80",false)
}
else if(this_paper_code=="STK090AT0"||this_paper_code=="STK075AT0"){
$('coating_type').options[0]=new Option("유광써멀라미네팅","COT70",false);
$('coating_type').options[1]=new Option("무광써멀라미네팅","COT71",false);
$('coating_type').options[2]=new Option("코팅없음","COT80",false)
}
else{
this.setCoatingPrice(0);
$('coating_type').options[0]=new Option("코팅없음","COT80",false)
}
this.thisPositionSelectOptions("coating_type",this_coating_type);
this.calcuCoatingPrice();
if($('coating_type').value=="COT70"||$('coating_type').value=="COT71"){
$('chk_is_cutting').value='1'
}
else{
$('chk_is_cutting').value='0'
}

}
,calcuCoatingPrice:function(){
var order_method=this.getOrderMethod();
var this_print_paper_qty=this.getPrintPaperQty();
var this_paper_code=this.getPaperCode();
var coating_type=this.getCoatingType();
var minimum=0;
var coating_price=0;
if(coating_type!=""&&this_print_paper_qty!=""&&order_method=='CTT80'){
minimum=Math.max((this_print_paper_qty/500),1);
if(coating_type=="COT70"||coating_type=="COT71"){
if(this_paper_code=="STK090AT0"||this_paper_code=="STK075AT0"){
coating_price=Math.ceil((50000*minimum))
}
else{
coating_price=Math.ceil((60000*minimum))
}

}
else{
coating_price=0
}
var coating_sale_price=parseFloat($('coating_sale_price').value);
this_cut_x_size=this.getCutXSize();
this_cut_y_size=this.getCutYSize();
this_paper_qty=this.getPaperQty();
coating_price=this_cut_x_size*this_cut_y_size*0.17*(this_paper_qty/1000)+10000;
coating_price=Math.ceil(coating_price/1000)*1000;
if(coating_type=='COT80'){
coating_price=0
}
this.setCoatingPrice(coating_price)
}
else{
this.setCoatingPrice(0)
}

}

}
);
var ppWorking=Class.create(Postpress,{
initialize:function($super){
$super();
this.unit_price=0;
this.min_price=0
}
,getCategoryCode:function(){
return $('category_code').value
}
,getPaperCode:function(){
if($('paper_code').value==""){
return this.save_paper_code
}
else{
return $('paper_code').value
}

}
,getWorkingType:function(){
if($('working_type').value==""){
return this.save_working_type
}
else{
return $('working_type').value
}

}
,setOrderMethod:function(method){
$('order_method').value=method
}
,getOrderMethod:function(){
return $('order_method').value
}
,getCuttingType:function(){
return $('working_type').value
}
,setCuttingType:function(type){
$('working_type').value=type
}
,setWorkingPrice:function(price){
$('working_amt').value=price
}
,getWorkingPrice:function(){
return $('working_amt').value
}
,getPaperQty:function(){
if($('paper_qty').value==""){
return parseInt(this.save_paper_qty)
}
else{
return parseInt($('paper_qty').value)
}

}
,setPrintPaperQty:function(num){
$('print_paper_qty').value=num
}
,getPrintPaperQty:function(){
return $("print_paper_qty").value
}
,getCutXSize:function(){
if($('cut_x_size').value==''){
return parseInt($('save_cut_x_size').value)
}
else{
return parseInt($('cut_x_size').value)
}

}
,getCutYSize:function(){
if($('cut_y_size').value==''){
return parseInt($('save_cut_y_size').value)
}
else{
return parseInt($('cut_y_size').value)
}

}
,settingWorkingType:function(){
var this_category_code=this.getCategoryCode();
var this_working_type=this.getWorkingType();
var this_paper_code=this.getPaperCode();
var this_order_method=this.getOrderMethod();
var show_code=this_paper_code.substring(0,8);
this.initSelectOptions('working_type');
if(this_category_code=="CST1000"||this_category_code=="CST1100"){
if(show_code=="STK025SD"||show_code=="STK025TD"||show_code=="STK038DT"||show_code=="STK120PV"){
$j("#working_type").css('width','130px');
$('working_type').options[0]=new Option("후면칼선없음","BHK50",false)
}
else if(show_code=="STK075AT"||show_code=="STK090AT"||show_code=="STK075AT"||show_code=="STK080VL"||show_code=="STK080YP"||this_paper_code=="STK090AF0"||this_paper_code=="STK057CR0"||this_paper_code=='STK080ABL'){
this_cut_x_size=this.getCutXSize();
this_cut_y_size=this.getCutYSize();
max_cut_size=Math.max(this_cut_x_size,this_cut_y_size);
if(max_cut_size>600){
$('working_type').options[0]=new Option("후면반칼(방향지정안함)","BHK10",false)
}
else{
if(this_order_method=="CTT80"){
$('working_type').options[0]=new Option("후면반칼(방향지정안함)","BHK10",false);
$('working_type').options[1]=new Option("후면반칼(가로방향)","BHK20",false);
$('working_type').options[2]=new Option("후면반칼(세로방향)","BHK30",false);
$('working_type').options[3]=new Option("후면반칼(1줄)방향지정안함","BHK40",false);
$('working_type').options[4]=new Option("후면반칼(1줄 가로방향)","BHK60",false);
$('working_type').options[5]=new Option("후면반칼(1줄 세로방향)","BHK70",false)
}
else{
$('working_type').options[0]=new Option("후면반칼(방향지정안함)","BHK10",false);
$('working_type').options[1]=new Option("후면반칼(가로방향)","BHK20",false);
$('working_type').options[2]=new Option("후면반칼(세로방향)","BHK30",false);
$('working_type').options[3]=new Option("후면반칼(1줄)방향지정안함","BHK40",false);
$('working_type').options[4]=new Option("후면반칼(1줄 가로방향)","BHK60",false);
$('working_type').options[5]=new Option("후면반칼(1줄 세로방향)","BHK70",false)
}

}
$j("#working_type").css('width','180px')
}
else{
this.setCoatingPrice(0);
$j("#working_type").css('width','130px');
$('working_type').options[0]=new Option("후면칼선없음","BHK50",false)
}

}
else if(this_category_code=="CST2000"){
$('working_type').options[0]=new Option("작업선제거재단","CTT70",false);
$('working_type').options[1]=new Option("작업선포함재단","CTT60",false)
}
else{
$('working_type').options[0]=new Option("작업선제거재단","CTT70",false)
}
this.thisPositionSelectOptions("working_type",this_working_type)
}
,calcuWorkingPrice:function(){
var this_paper_qty=this.getPaperQty();
var this_paper_code=this.getPaperCode();
var working_type=this.getWorkingType();
var order_method=this.getOrderMethod();
var minimum=0;
var working_price=0;
if(working_type!=""&&this_paper_qty!=""){
if(working_type=="BHK20"){
working_price=Math.max((this_paper_qty*1),1000)
}
else if(order_method=='CTT80'&&(working_type=="BHK40"||working_type=="BHK60"||working_type=="BHK70")){
working_price=Math.max(((this_paper_qty*10)+10000),40000)
}
else if(working_type=="BHK40"||working_type=="BHK60"||working_type=="BHK70"){
if(this_paper_code=="STK090AT0"||this_paper_code=="STK075AT0"){
minimum=30000
}
else{
minimum=50000
}
working_price=Math.max(((this_paper_qty*10)+10000),minimum)
}
else{
if(working_type=="BHK30"){
working_price=Math.max((this_paper_qty*1),1000)
}
else{
this.setWorkingPrice(0)
}

}
this.setWorkingPrice(working_price)
}
else{
this.setWorkingPrice(0)
}

}

}
);
var ppBak=Class.create(Postpress,{
initialize:function($super,seq){
$super();
this.seq=0;
this.small_unit=0;
this.min_price=0;
this.min_unit=0
}
,setBakSeq:function(seq){
this.seq=seq
}
,getBakSection:function(){
return $('bak_section_'+this.seq).value
}
,getBakType:function(){
return $('bak_type_'+this.seq).value
}
,setBakXSize:function(size){
$('bak_x_size_'+this.seq).value=size
}
,getBakXSize:function(){
return $('bak_x_size_'+this.seq).value
}
,setBakYSize:function(size){
$('bak_y_size_'+this.seq).value=size
}
,getBakYSize:function(){
return $('bak_y_size_'+this.seq).value
}
,setWorkXSize:function(size){
$('work_x_size').value=size
}
,getWorkXSize:function(size){
return parseInt($('work_x_size').value)
}
,setWorkYSize:function(size){
$('work_y_size').value=size
}
,getWorkYSize:function(size){
return parseInt($('work_y_size').value)
}
,setCutXSize:function(size){
$('cut_x_size').value=size
}
,getCutXSize:function(size){
return parseInt($('cut_x_size').value)
}
,setCutYSize:function(size){
$('cut_y_size').value=size
}
,getCutYSize:function(size){
return parseInt($('cut_y_size').value)
}
,setBakMarginSize:function(size){
$('bak_margin_size_'+this.seq).value=size
}
,setBakSide:function(side){
$('bak_side_'+this.seq).value=side
}
,getBakSide:function(){
return $('bak_side_'+this.seq).value
}
,setBakPrice:function(price){
$('bak_amt_'+this.seq).value=price
}
,getBakPrice:function(){
return $('bak_amt_'+this.seq).value
}
,setDongpanPrice:function(price){
$('dongpan_amt_'+this.seq).value=price;
$('etc1_'+this.seq).value=price
}
,getDongpanPrice:function(){
return $('dongpan_amt_'+this.seq).value
}
,getIsPPBak:function(){
if($('chk_is_bak').checked==true){
return true
}
else{
return false
}

}
,getPaperQty:function(){
if($('paper_qty').value==""){
return parseInt($("save_paper_qty").value)
}
else{
return parseInt($('paper_qty').value)
}

}
,settingBakType:function(){
if($('chk_is_bak').checked==true&&($('coating_type').value=="COT70"||$('coating_type').value=="COT71")){
this.setBakPrice(0);
this.setDongpanPrice(0);
return false
}

}
,calcuBakPrice:function(){
if(this.getIsPPBak()){
this.settingBakType();
this_bak_section=this.getBakSection()
}
bak_section=this.getBakSection();
bak_x_size=this.getBakXSize();
bak_y_size=this.getBakYSize();
cut_x_size=this.getCutXSize();
cut_y_size=this.getCutYSize();
var bak_unit_price=this.getBakPriceUnit();
var this_paper_qty=parseInt(this.getPaperQty());
var dongpan_price1=0;
var dongpan_price=0;
var bak_price=0;
if(bak_section=="BKS20"){
dongpan_price=0
}
else{
var tmp_dongpan_add=Math.floor((this_paper_qty/1000-1));
if(tmp_dongpan_add<0){
tmp_dongpan_add=0
}
dongpan_price1=Math.max(((bak_x_size*1)+5)*((bak_y_size*1)+5)*1.6,3500)+3000*tmp_dongpan_add;
dongpan_price=Math.ceil(dongpan_price1*0.001)*1000
}
if(bak_x_size>cut_x_size){
alert('박사이즈는 용지사이즈 보다 클 수 없습니다.');
$j("#bak_x_size").focus();
this.setBakXSize('');
this.setBakPrice('0');
this.setDongpanPrice('0');
return false
}
if(bak_y_size>cut_y_size){
alert('박사이즈는 용지사이즈 보다 클 수 없습니다.');
$j("#bak_y_size").focus();
this.setBakYSize('');
this.setBakPrice('0');
this.setDongpanPrice('0');
return false
}
if(bak_x_size>0&&bak_y_size>0){
bak_price=bak_unit_price+dongpan_price
}
else{
dongpan_price=0;
bak_price=0
}
if(!$("chk_is_bak").checked){
dongpan_price=0;
bak_price=0
}
this.setBakPrice(bak_price);
this.setDongpanPrice(dongpan_price);
this.setBakSide('BKD10')
}
,getBakWorkPrice:function(){
var work_x_size=this.getCutXSize();
var work_y_size=this.getCutYSize();
var work_price=0;
var work_x_size1=0;
var work_y_size1=0;
if(work_x_size>=30&&work_x_size<50){
work_x_size1=30;
if(work_y_size>=30&&work_y_size<50)work_y_size1=30;
else if(work_y_size>=50&&work_y_size<80)work_y_size1=50;
else if(work_y_size>=80&&work_y_size<110)work_y_size1=80;
else if(work_y_size>=110&&work_y_size<140)work_y_size1=110;
else if(work_y_size>=140&&work_y_size<170)work_y_size1=140;
else if(work_y_size>=170&&work_y_size<200)work_y_size1=170;
else if(work_y_size>=200&&work_y_size<230)work_y_size1=200;
else if(work_y_size>=230&&work_y_size<260)work_y_size1=230;
else if(work_y_size>=260&&work_y_size<290)work_y_size1=260;
else if(work_y_size>=290&&work_y_size<320)work_y_size1=290;
else if(work_y_size>=320&&work_y_size<350)work_y_size1=320;
else if(work_y_size>=350&&work_y_size<380)work_y_size1=350;
else if(work_y_size>=380&&work_y_size<450)work_y_size1=380;
else if(work_y_size>=450&&work_y_size<600)work_y_size1=450;
else if(work_y_size>=600)work_y_size1=600
}
else if(work_x_size>=50&&work_x_size<80){
work_x_size1=50;
if(work_y_size>=30&&work_y_size<50)work_y_size1=30;
else if(work_y_size>=50&&work_y_size<80)work_y_size1=50;
else if(work_y_size>=80&&work_y_size<110)work_y_size1=80;
else if(work_y_size>=110&&work_y_size<140)work_y_size1=110;
else if(work_y_size>=140&&work_y_size<170)work_y_size1=140;
else if(work_y_size>=170&&work_y_size<200)work_y_size1=170;
else if(work_y_size>=200&&work_y_size<230)work_y_size1=200;
else if(work_y_size>=230&&work_y_size<260)work_y_size1=230;
else if(work_y_size>=260&&work_y_size<290)work_y_size1=260;
else if(work_y_size>=290&&work_y_size<320)work_y_size1=290;
else if(work_y_size>=320&&work_y_size<350)work_y_size1=320;
else if(work_y_size>=350&&work_y_size<380)work_y_size1=350;
else if(work_y_size>=380&&work_y_size<450)work_y_size1=380;
else if(work_y_size>=450&&work_y_size<600)work_y_size1=450;
else if(work_y_size>=600)work_y_size1=600
}
else if(work_x_size>=80&&work_x_size<110){
work_x_size1=80;
if(work_y_size>=30&&work_y_size<50)work_y_size1=30;
else if(work_y_size>=50&&work_y_size<80)work_y_size1=50;
else if(work_y_size>=80&&work_y_size<110)work_y_size1=80;
else if(work_y_size>=110&&work_y_size<140)work_y_size1=110;
else if(work_y_size>=140&&work_y_size<170)work_y_size1=140;
else if(work_y_size>=170&&work_y_size<200)work_y_size1=170;
else if(work_y_size>=200&&work_y_size<230)work_y_size1=200;
else if(work_y_size>=230&&work_y_size<260)work_y_size1=230;
else if(work_y_size>=260&&work_y_size<290)work_y_size1=260;
else if(work_y_size>=290&&work_y_size<320)work_y_size1=290;
else if(work_y_size>=320&&work_y_size<350)work_y_size1=320;
else if(work_y_size>=350&&work_y_size<380)work_y_size1=350;
else if(work_y_size>=380&&work_y_size<450)work_y_size1=380;
else if(work_y_size>=450&&work_y_size<600)work_y_size1=450;
else if(work_y_size>=600)work_y_size1=600
}
else if(work_x_size>=110&&work_x_size<140){
work_x_size1=110;
if(work_y_size>=30&&work_y_size<50)work_y_size1=30;
else if(work_y_size>=50&&work_y_size<80)work_y_size1=50;
else if(work_y_size>=80&&work_y_size<110)work_y_size1=80;
else if(work_y_size>=110&&work_y_size<140)work_y_size1=110;
else if(work_y_size>=140&&work_y_size<170)work_y_size1=140;
else if(work_y_size>=170&&work_y_size<200)work_y_size1=170;
else if(work_y_size>=200&&work_y_size<230)work_y_size1=200;
else if(work_y_size>=230&&work_y_size<260)work_y_size1=230;
else if(work_y_size>=260&&work_y_size<290)work_y_size1=260;
else if(work_y_size>=290&&work_y_size<320)work_y_size1=290;
else if(work_y_size>=320&&work_y_size<350)work_y_size1=320;
else if(work_y_size>=350&&work_y_size<380)work_y_size1=350;
else if(work_y_size>=380&&work_y_size<450)work_y_size1=380;
else if(work_y_size>=450&&work_y_size<600)work_y_size1=450;
else if(work_y_size>=600)work_y_size1=600
}
else if(work_x_size>=140&&work_x_size<170){
work_x_size1=140;
if(work_y_size>=30&&work_y_size<50)work_y_size1=30;
else if(work_y_size>=50&&work_y_size<80)work_y_size1=50;
else if(work_y_size>=80&&work_y_size<110)work_y_size1=80;
else if(work_y_size>=110&&work_y_size<140)work_y_size1=110;
else if(work_y_size>=140&&work_y_size<170)work_y_size1=140;
else if(work_y_size>=170&&work_y_size<200)work_y_size1=170;
else if(work_y_size>=200&&work_y_size<230)work_y_size1=200;
else if(work_y_size>=230&&work_y_size<260)work_y_size1=230;
else if(work_y_size>=260&&work_y_size<290)work_y_size1=260;
else if(work_y_size>=290&&work_y_size<320)work_y_size1=290;
else if(work_y_size>=320&&work_y_size<350)work_y_size1=320;
else if(work_y_size>=350&&work_y_size<380)work_y_size1=350;
else if(work_y_size>=380&&work_y_size<450)work_y_size1=380;
else if(work_y_size>=450&&work_y_size<600)work_y_size1=450;
else if(work_y_size>=600)work_y_size1=600
}
else if(work_x_size>=170&&work_x_size<200){
work_x_size1=170;
if(work_y_size>=30&&work_y_size<50)work_y_size1=30;
else if(work_y_size>=50&&work_y_size<80)work_y_size1=50;
else if(work_y_size>=80&&work_y_size<110)work_y_size1=80;
else if(work_y_size>=110&&work_y_size<140)work_y_size1=110;
else if(work_y_size>=140&&work_y_size<170)work_y_size1=140;
else if(work_y_size>=170&&work_y_size<200)work_y_size1=170;
else if(work_y_size>=200&&work_y_size<230)work_y_size1=200;
else if(work_y_size>=230&&work_y_size<260)work_y_size1=230;
else if(work_y_size>=260&&work_y_size<290)work_y_size1=260;
else if(work_y_size>=290&&work_y_size<320)work_y_size1=290;
else if(work_y_size>=320&&work_y_size<350)work_y_size1=320;
else if(work_y_size>=350&&work_y_size<380)work_y_size1=350;
else if(work_y_size>=380&&work_y_size<450)work_y_size1=380;
else if(work_y_size>=450&&work_y_size<600)work_y_size1=450;
else if(work_y_size>=600)work_y_size1=600
}
else if(work_x_size>=200&&work_x_size<230){
work_x_size1=200;
if(work_y_size>=30&&work_y_size<50)work_y_size1=30;
else if(work_y_size>=50&&work_y_size<80)work_y_size1=50;
else if(work_y_size>=80&&work_y_size<110)work_y_size1=80;
else if(work_y_size>=110&&work_y_size<140)work_y_size1=110;
else if(work_y_size>=140&&work_y_size<170)work_y_size1=140;
else if(work_y_size>=170&&work_y_size<200)work_y_size1=170;
else if(work_y_size>=200&&work_y_size<230)work_y_size1=200;
else if(work_y_size>=230&&work_y_size<260)work_y_size1=230;
else if(work_y_size>=260&&work_y_size<290)work_y_size1=260;
else if(work_y_size>=290&&work_y_size<320)work_y_size1=290;
else if(work_y_size>=320&&work_y_size<350)work_y_size1=320;
else if(work_y_size>=350&&work_y_size<380)work_y_size1=350;
else if(work_y_size>=380&&work_y_size<450)work_y_size1=380;
else if(work_y_size>=450&&work_y_size<600)work_y_size1=450;
else if(work_y_size>=600)work_y_size1=600
}
else if(work_x_size>=230&&work_x_size<260){
work_x_size1=230;
if(work_y_size>=30&&work_y_size<50)work_y_size1=30;
else if(work_y_size>=50&&work_y_size<80)work_y_size1=50;
else if(work_y_size>=80&&work_y_size<110)work_y_size1=80;
else if(work_y_size>=110&&work_y_size<140)work_y_size1=110;
else if(work_y_size>=140&&work_y_size<170)work_y_size1=140;
else if(work_y_size>=170&&work_y_size<200)work_y_size1=170;
else if(work_y_size>=200&&work_y_size<230)work_y_size1=200;
else if(work_y_size>=230&&work_y_size<260)work_y_size1=230;
else if(work_y_size>=260&&work_y_size<290)work_y_size1=260;
else if(work_y_size>=290&&work_y_size<320)work_y_size1=290;
else if(work_y_size>=320&&work_y_size<350)work_y_size1=320;
else if(work_y_size>=350&&work_y_size<380)work_y_size1=350;
else if(work_y_size>=380&&work_y_size<450)work_y_size1=380;
else if(work_y_size>=450&&work_y_size<600)work_y_size1=450;
else if(work_y_size>=600)work_y_size1=600
}
else if(work_x_size>=260&&work_x_size<290){
work_x_size1=260;
if(work_y_size>=30&&work_y_size<50)work_y_size1=30;
else if(work_y_size>=50&&work_y_size<80)work_y_size1=50;
else if(work_y_size>=80&&work_y_size<110)work_y_size1=80;
else if(work_y_size>=110&&work_y_size<140)work_y_size1=110;
else if(work_y_size>=140&&work_y_size<170)work_y_size1=140;
else if(work_y_size>=170&&work_y_size<200)work_y_size1=170;
else if(work_y_size>=200&&work_y_size<230)work_y_size1=200;
else if(work_y_size>=230&&work_y_size<260)work_y_size1=230;
else if(work_y_size>=260&&work_y_size<290)work_y_size1=260;
else if(work_y_size>=290&&work_y_size<320)work_y_size1=290;
else if(work_y_size>=320&&work_y_size<350)work_y_size1=320;
else if(work_y_size>=350&&work_y_size<380)work_y_size1=350;
else if(work_y_size>=380&&work_y_size<450)work_y_size1=380;
else if(work_y_size>=450&&work_y_size<600)work_y_size1=450;
else if(work_y_size>=600)work_y_size1=600
}
else if(work_x_size>=290&&work_x_size<320){
work_x_size1=290;
if(work_y_size>=30&&work_y_size<50)work_y_size1=30;
else if(work_y_size>=50&&work_y_size<80)work_y_size1=50;
else if(work_y_size>=80&&work_y_size<110)work_y_size1=80;
else if(work_y_size>=110&&work_y_size<140)work_y_size1=110;
else if(work_y_size>=140&&work_y_size<170)work_y_size1=140;
else if(work_y_size>=170&&work_y_size<200)work_y_size1=170;
else if(work_y_size>=200&&work_y_size<230)work_y_size1=200;
else if(work_y_size>=230&&work_y_size<260)work_y_size1=230;
else if(work_y_size>=260&&work_y_size<290)work_y_size1=260;
else if(work_y_size>=290&&work_y_size<320)work_y_size1=290;
else if(work_y_size>=320&&work_y_size<350)work_y_size1=320;
else if(work_y_size>=350&&work_y_size<380)work_y_size1=350;
else if(work_y_size>=380&&work_y_size<450)work_y_size1=380;
else if(work_y_size>=450&&work_y_size<600)work_y_size1=450;
else if(work_y_size>=600)work_y_size1=600
}
else if(work_x_size>=320&&work_x_size<350){
work_x_size1=320;
if(work_y_size>=30&&work_y_size<50)work_y_size1=30;
else if(work_y_size>=50&&work_y_size<80)work_y_size1=50;
else if(work_y_size>=80&&work_y_size<110)work_y_size1=80;
else if(work_y_size>=110&&work_y_size<140)work_y_size1=110;
else if(work_y_size>=140&&work_y_size<170)work_y_size1=140;
else if(work_y_size>=170&&work_y_size<200)work_y_size1=170;
else if(work_y_size>=200&&work_y_size<230)work_y_size1=200;
else if(work_y_size>=230&&work_y_size<260)work_y_size1=230;
else if(work_y_size>=260&&work_y_size<290)work_y_size1=260;
else if(work_y_size>=290&&work_y_size<320)work_y_size1=290;
else if(work_y_size>=320&&work_y_size<350)work_y_size1=320;
else if(work_y_size>=350&&work_y_size<380)work_y_size1=350;
else if(work_y_size>=380&&work_y_size<450)work_y_size1=380;
else if(work_y_size>=450&&work_y_size<600)work_y_size1=450;
else if(work_y_size>=600)work_y_size1=600
}
else if(work_x_size>=350&&work_x_size<380){
work_x_size1=350;
if(work_y_size>=30&&work_y_size<50)work_y_size1=30;
else if(work_y_size>=50&&work_y_size<80)work_y_size1=50;
else if(work_y_size>=80&&work_y_size<110)work_y_size1=80;
else if(work_y_size>=110&&work_y_size<140)work_y_size1=110;
else if(work_y_size>=140&&work_y_size<170)work_y_size1=140;
else if(work_y_size>=170&&work_y_size<200)work_y_size1=170;
else if(work_y_size>=200&&work_y_size<230)work_y_size1=200;
else if(work_y_size>=230&&work_y_size<260)work_y_size1=230;
else if(work_y_size>=260&&work_y_size<290)work_y_size1=260;
else if(work_y_size>=290&&work_y_size<320)work_y_size1=290;
else if(work_y_size>=320&&work_y_size<350)work_y_size1=320;
else if(work_y_size>=350&&work_y_size<380)work_y_size1=350;
else if(work_y_size>=380&&work_y_size<450)work_y_size1=380;
else if(work_y_size>=450&&work_y_size<600)work_y_size1=450;
else if(work_y_size>=600)work_y_size1=600
}
else if(work_x_size>=380&&work_x_size<450){
work_x_size1=380;
if(work_y_size>=30&&work_y_size<50)work_y_size1=30;
else if(work_y_size>=50&&work_y_size<80)work_y_size1=50;
else if(work_y_size>=80&&work_y_size<110)work_y_size1=80;
else if(work_y_size>=110&&work_y_size<140)work_y_size1=110;
else if(work_y_size>=140&&work_y_size<170)work_y_size1=140;
else if(work_y_size>=170&&work_y_size<200)work_y_size1=170;
else if(work_y_size>=200&&work_y_size<230)work_y_size1=200;
else if(work_y_size>=230&&work_y_size<260)work_y_size1=230;
else if(work_y_size>=260&&work_y_size<290)work_y_size1=260;
else if(work_y_size>=290&&work_y_size<320)work_y_size1=290;
else if(work_y_size>=320&&work_y_size<350)work_y_size1=320;
else if(work_y_size>=350&&work_y_size<380)work_y_size1=350;
else if(work_y_size>=380&&work_y_size<450)work_y_size1=380;
else if(work_y_size>=450&&work_y_size<600)work_y_size1=450;
else if(work_y_size>=600)work_y_size1=600
}
else if(work_x_size>=450&&work_x_size<600){
work_x_size1=450;
if(work_y_size>=30&&work_y_size<50)work_y_size1=30;
else if(work_y_size>=50&&work_y_size<80)work_y_size1=50;
else if(work_y_size>=80&&work_y_size<110)work_y_size1=80;
else if(work_y_size>=110&&work_y_size<140)work_y_size1=110;
else if(work_y_size>=140&&work_y_size<170)work_y_size1=140;
else if(work_y_size>=170&&work_y_size<200)work_y_size1=170;
else if(work_y_size>=200&&work_y_size<230)work_y_size1=200;
else if(work_y_size>=230&&work_y_size<260)work_y_size1=230;
else if(work_y_size>=260&&work_y_size<290)work_y_size1=260;
else if(work_y_size>=290&&work_y_size<320)work_y_size1=290;
else if(work_y_size>=320&&work_y_size<350)work_y_size1=320;
else if(work_y_size>=350&&work_y_size<380)work_y_size1=350;
else if(work_y_size>=380&&work_y_size<450)work_y_size1=380;
else if(work_y_size>=450&&work_y_size<600)work_y_size1=450;
else if(work_y_size>=600)work_y_size1=600
}
else{
work_x_size1=600;
if(work_y_size>=30&&work_y_size<50)work_y_size1=30;
else if(work_y_size>=50&&work_y_size<80)work_y_size1=50;
else if(work_y_size>=80&&work_y_size<110)work_y_size1=80;
else if(work_y_size>=110&&work_y_size<140)work_y_size1=110;
else if(work_y_size>=140&&work_y_size<170)work_y_size1=140;
else if(work_y_size>=170&&work_y_size<200)work_y_size1=170;
else if(work_y_size>=200&&work_y_size<230)work_y_size1=200;
else if(work_y_size>=230&&work_y_size<260)work_y_size1=230;
else if(work_y_size>=260&&work_y_size<290)work_y_size1=260;
else if(work_y_size>=290&&work_y_size<320)work_y_size1=290;
else if(work_y_size>=320&&work_y_size<350)work_y_size1=320;
else if(work_y_size>=350&&work_y_size<380)work_y_size1=350;
else if(work_y_size>=380&&work_y_size<450)work_y_size1=380;
else if(work_y_size>=450&&work_y_size<600)work_y_size1=450;
else if(work_y_size>=600)work_y_size1=600
}
work_price=((work_x_size1*1)+(work_y_size1*1))/12;
return work_price
}
,getBakPriceUnit:function(){
this_paper_qty=this.getPaperQty();
var work_price=this.getBakWorkPrice();
var material_price=this.getBakMaterialPrice();
var bak_unit_price1=0;
var bak_unit_price=0;
var bak_extra=0;
var bak_min_price=0;
bak_min_price=Math.ceil((material_price*this_paper_qty+this_paper_qty*20*1.1)/100)*100;
bak_min_price=Math.max(bak_min_price,30000);
bak_extra=Math.max(1-(this_paper_qty/40000),0.7);
bak_unit_price1=this_paper_qty*((work_price*1)+(material_price*1))*1.6*bak_extra;
bak_unit_price=Math.ceil(bak_unit_price1*0.001)*1000+15000;
bak_unit_price=Math.max(bak_unit_price,bak_min_price);
return bak_unit_price
}
,getBakMaterialPrice:function(){
bak_type=this.getBakType();
bak_x_size=this.getBakXSize();
bak_y_size=this.getBakYSize();
paper_qty=this.getPaperQty();
var buy_price=0;
var f_x_size=0;
var f_y_size=0;
var one_unit_extra=0;
var material_price=0;
var max_bak_x=Math.max(bak_x_size,30);
var max_bak_y=Math.max(bak_y_size,30);
if(bak_type=="BKT01"||bak_type=="BKT02"||bak_type=="BKT03"||bak_type=="BKT04"||bak_type=="BKT05"||bak_type=="BKT09"||bak_type=="BKT10"){
buy_price=26000;
f_x_size=640;
f_y_size=60000;
one_unit_extra=1.3
}
else if(bak_type=="BKT06"){
buy_price=30000;
f_x_size=640;
f_y_size=60000;
one_unit_extra=1.3
}
else if(bak_type=="BKT11"||bak_type=="BKT12"||bak_type=="BKT13"){
buy_price=70000;
f_x_size=640;
f_y_size=60000;
one_unit_extra=1.3
}
else{
buy_price=26000;
f_x_size=640;
f_y_size=60000;
one_unit_extra=1.3
}
material_price=buy_price/(f_x_size*f_y_size)*((max_bak_x+30)*(max_bak_y+30))*one_unit_extra;
material_price1=Math.round(material_price);
return material_price
}

}
);
