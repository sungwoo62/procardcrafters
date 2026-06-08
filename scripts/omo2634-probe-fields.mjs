import { chromium } from 'playwright'
const BASE='https://www.swadpia.co.kr'
// category -> field names to dump full options
const PLAN = {
  CST5000:['paper_code','print_color_type','paper_size','paper_qty'],
  CST7000:['paper_code','print_color_type','paper_size','paper_qty'],
  CLP1000:['paper_code','fside_color_amount1','small_size_type','paper_size','paper_qty_select'],
  CPR4000:['paper_size','cover_paper_code','in_paper_code','binding_type','bundle_qty','in_page_qty'],
  CCD2000:['paper_code','paper_size','print_method','paper_qty_select','binding_type'],
  CCD1000:['paper_code','paper_size','print_method','paper_qty_select','binding_type'],
  CNR2000:['paper_code','code_size_type','fside_color_amount','bside_print_type','paper_qty'],
  CEV1000:['bongto_type','paper_code','fside_color_amount','proc_method','paper_qty'],
  CPR5000:['paper_code','code_size_type','fside_color_amount','print_method','paper_qty'],
  CPR3000:['paper_code','paper_type','fside_color_amount','print_method','paper_size','paper_qty'],
  CLF2000:['paper_code','paper_type','fside_color_amount','print_method','paper_size','paper_qty'],
}
const browser=await chromium.launch({headless:true})
const ctx=await browser.newContext({userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',locale:'ko-KR',viewport:{width:1280,height:900}})
const page=await ctx.newPage(); page.on('dialog',d=>d.accept().catch(()=>{}))
const out={}
for (const [code,fields] of Object.entries(PLAN)) {
  try{
    await page.goto(`${BASE}/goods/goods_view/${code}/1`,{waitUntil:'networkidle',timeout:45000})
    await page.waitForTimeout(3500)
    const data=await page.evaluate((fields)=>{
      const r={}
      for(const f of fields){
        const sel=document.querySelector(`select[name="${f}"]`)
        r[f]= sel? Array.from(sel.options).filter(o=>o.value!=='').map(o=>({v:o.value,t:(o.textContent||'').replace(/\s+/g,' ').trim()})) : null
      }
      return r
    },fields)
    out[code]=data
    console.error(`[${code}] ${fields.map(f=>`${f}=${data[f]?data[f].length:'∅'}`).join(' ')}`)
  }catch(e){out[code]={error:e.message};console.error(`[${code}] ERR ${e.message}`)}
}
await browser.close()
console.log(JSON.stringify(out,null,2))
