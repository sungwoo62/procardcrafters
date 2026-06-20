import { chromium } from 'playwright'
const BASE='https://www.swadpia.co.kr', U=process.env.SWADPIA_USERNAME, PW=process.env.SWADPIA_PASSWORD
const b=await chromium.launch({headless:true}); const page=await (await b.newContext({locale:'ko-KR',viewport:{width:1400,height:1400}})).newPage()
page.on('dialog',d=>d.accept())
await page.goto(`${BASE}/member/login`,{waitUntil:'domcontentloaded',timeout:20000})
await page.fill('input[name="member_id"]',U); await page.fill('input[name="member_pw"]',PW)
await Promise.all([page.waitForNavigation({timeout:15000}).catch(()=>{}),page.click('#icon_member_login')]); await page.waitForTimeout(1500)
await page.goto(`${BASE}/goods/goods_view/CNC1000/1`,{waitUntil:'domcontentloaded',timeout:30000}); await page.waitForTimeout(1000)
const gv = await page.evaluate(()=>({charset:document.characterSet, ct:document.contentType, head:document.querySelector('head')?.innerHTML.match(/charset=[^"'>\s]+/i)?.[0]||'none'}))
console.log('GOODS_VIEW:', JSON.stringify(gv))
// 결제대기 주문내역에서 우리 주문(OSA260619512225) 행 텍스트 확인
await page.goto(`${BASE}/mypage/order_unpaid`,{waitUntil:'networkidle',timeout:20000}); await page.waitForTimeout(2000)
const ord = await page.evaluate(()=>{
  const txt=document.body.innerText||''
  const i=txt.indexOf('OSA260619512225')
  return {charset:document.characterSet, around: i>=0? txt.slice(Math.max(0,i-120), i+120) : '(주문 텍스트 못찾음)'}
})
console.log('ORDER_UNPAID:', JSON.stringify(ord))
await b.close()
