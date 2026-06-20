import { chromium } from 'playwright'
const BASE='https://www.swadpia.co.kr', U=process.env.SWADPIA_USERNAME, PW=process.env.SWADPIA_PASSWORD
const b=await chromium.launch({headless:true}); const ctx=await b.newContext({locale:'ko-KR',viewport:{width:1280,height:900}})
const page=await ctx.newPage(); page.on('dialog',d=>d.accept())
await page.goto(`${BASE}/member/login`,{waitUntil:'domcontentloaded',timeout:20000})
await page.fill('input[name="member_id"]',U); await page.fill('input[name="member_pw"]',PW)
await Promise.all([page.waitForNavigation({timeout:15000}).catch(()=>{}),page.click('#icon_member_login')]); await page.waitForTimeout(1500)
await page.goto(`${BASE}/goods/goods_view/CNC1000/1`,{waitUntil:'networkidle',timeout:30000}); await page.waitForTimeout(2500)
const seq=[['paper_code','SNW300W00'],['print_color_type','CTN40'],['paper_size','N0100'],['paper_qty','500']]
for(const [name,val] of seq){
  const el=await page.$(`select[name="${name}"]`)
  if(!el){console.log(name,'-> NO SELECT ELEMENT'); continue}
  const before=await el.evaluate(e=>({vis:e.offsetParent!==null,disabled:e.disabled,vals:Array.from(e.options).map(o=>o.value)}))
  let res='ok'
  try{ await el.selectOption(val,{timeout:5000}) }catch(e){ res='FAIL: '+e.message.split('\n')[0] }
  console.log(`${name}=${val} | visible=${before.vis} disabled=${before.disabled} present=${before.vals.includes(val)} -> ${res} | opts=[${before.vals.slice(0,12).join(',')}]`)
  await page.waitForTimeout(800)
}
await b.close()
