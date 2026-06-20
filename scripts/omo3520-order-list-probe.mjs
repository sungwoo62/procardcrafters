import { chromium } from 'playwright'
const BASE='https://www.swadpia.co.kr', U=process.env.SWADPIA_USERNAME, PW=process.env.SWADPIA_PASSWORD
const b=await chromium.launch({headless:true}); const ctx=await b.newContext({locale:'ko-KR',viewport:{width:1400,height:1700}})
const page=await ctx.newPage(); page.on('dialog',d=>d.accept())
await page.goto(`${BASE}/member/login`,{waitUntil:'domcontentloaded',timeout:20000})
await page.fill('input[name="member_id"]',U); await page.fill('input[name="member_pw"]',PW)
await Promise.all([page.waitForNavigation({timeout:15000}).catch(()=>{}),page.click('#icon_member_login')]); await page.waitForTimeout(1500)
await page.goto(`${BASE}/mypage/order_unpaid`,{waitUntil:'networkidle',timeout:20000}); await page.waitForTimeout(2500)
const r=await page.evaluate(()=>{
  // order_no 가 들어갈 만한 href/onclick/value 전수 스캔
  const hits=new Set()
  const scan=(s)=>{ if(!s)return; for(const m of String(s).matchAll(/([A-Z]{2,4}\d{8,})/g)) hits.add(m[1]); 
    for(const m of String(s).matchAll(/order_no[=:'"\s]+([A-Z0-9]{8,})/gi)) hits.add(m[1]) }
  document.querySelectorAll('a,button,input,form,tr,td').forEach(el=>{ scan(el.getAttribute&&el.getAttribute('href')); scan(el.getAttribute&&el.getAttribute('onclick')); scan(el.getAttribute&&el.getAttribute('value')); scan(el.getAttribute&&el.getAttribute('action')); scan(el.getAttribute&&el.getAttribute('id')) })
  // 결제대기 영역 텍스트(메뉴 제외): 주문상세 셀
  const area=document.querySelector('.order_list, #order_list, .mypage_content, .content')
  const areaTxt=area? (area.innerText||'').slice(0,600) : ''
  for(const m of areaTxt.matchAll(/([A-Z]{2,4}\d{8,})/g)) hits.add(m[1])
  return {orderNos:[...hits].slice(0,10), areaSnippet: areaTxt.replace(/\n{2,}/g,'\n').slice(0,400)}
})
console.log(JSON.stringify(r,null,1))
await b.close()
