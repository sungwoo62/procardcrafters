import type { Page } from 'playwright'
const BASE='https://www.swadpia.co.kr'
async function login(p:Page){await p.goto(`${BASE}/member/login`,{waitUntil:'domcontentloaded',timeout:20000});await p.fill('input[name="member_id"]',process.env.SWADPIA_USERNAME!);await p.fill('input[name="member_pw"]',process.env.SWADPIA_PASSWORD!);await Promise.all([p.waitForNavigation({waitUntil:'domcontentloaded',timeout:15000}).catch(()=>{}),p.click('#icon_member_login')]);await p.waitForTimeout(1500)}
// 기존 9종 중 refactor 영향 큰 것: epoxy(autoPick), numbering(special+autoPick), osi, missing, guidori
const SPECS:any={epoxy:{autoPick:['epoxy_kind'],needsClick:true,fields:{epoxy_type:'EPT10'}},numbering:{autoPick:['numbering_kind'],fields:{numbering_type:'NBT10',numbering_kind:'NBN11'}},osi:{needsClick:true,fields:{osi_num:'OSN01',osi_direction:'OMD10'}},missing:{needsClick:true,fields:{missing_num:'MSN01',missing_direction:'OMD10'}},guidori:{needsClick:true,positions:true,fields:{guidori_type:'GDR40'}}}
async function main(){const{chromium}=await import('playwright');const b=await chromium.launch({headless:true});const pg=await b.newPage();pg.on('dialog',d=>d.accept().catch(()=>{}));await login(pg);
await pg.goto(`${BASE}/goods/goods_view/CNC1000/1`,{waitUntil:'networkidle',timeout:30000});await pg.waitForTimeout(700);
await pg.evaluate(()=>{const s=document.querySelector('select[name="paper_code"]') as HTMLSelectElement|null;if(s){const o=Array.from(s.options).find(x=>x.value);if(o){s.value=o.value;s.dispatchEvent(new Event('change',{bubbles:true}))}}});await pg.waitForTimeout(900);
await pg.evaluate(()=>{const s=document.querySelector('select[name="paper_qty"]') as HTMLSelectElement|null;if(s){const o=Array.from(s.options).find(x=>/^\d+$/.test(x.value));if(o){s.value=o.value;s.dispatchEvent(new Event('change',{bubbles:true}))}}});await pg.waitForTimeout(500);
for(const[t,sp]of Object.entries(SPECS) as [string,any][]){
 await pg.evaluate((p:any)=>{const{ppType,fields,autoPick,needsClick,positions}=p;const w=window as any;
  const setField=(n:string,v:string)=>{const el=document.querySelector(`[name="${n}"]`) as any;if(!el)return;if(el.tagName==='SELECT'&&!Array.from(el.options).some((o:any)=>o.value===v))return;el.value=v;el.dispatchEvent(new Event('change',{bubbles:true}))};
  const pick=(n:string)=>{const ke=document.querySelector(`select[name="${n}"]`) as any;if(!ke)return;const o=Array.from(ke.options).map((x:any)=>x.value).filter(Boolean);if(!o.length)return;const want=fields[n];ke.value=want&&o.indexOf(want)!==-1?want:o[0];ke.dispatchEvent(new Event('change',{bubbles:true}))};
  const chk=document.getElementById(`chk_is_${ppType}`) as any;if(chk)chk.checked=true;if(chk&&needsClick){chk.dispatchEvent(new Event('click',{bubbles:true}));chk.dispatchEvent(new Event('change',{bubbles:true}))}
  try{w.$j&&w.$j(`#pnl_${ppType}`).show()}catch{}
  for(const[n,v]of Object.entries(fields) as [string,string][]){if(n.endsWith('_kind')||(autoPick||[]).indexOf(n)!==-1)continue;setField(n,v)}
  if(ppType==='numbering'){try{w.chgNumberingType&&w.chgNumberingType()}catch{};pick('numbering_kind')}
  if(positions)for(const i of[1,2,3,4]){const pp=document.querySelector(`[name="guidori_position${i}"]`) as any;if(pp&&!pp.checked){pp.checked=true;pp.dispatchEvent(new Event('click',{bubbles:true}));pp.dispatchEvent(new Event('change',{bubbles:true}))}}
  try{w.setIsPostpress&&w.setIsPostpress(ppType)}catch{}
  for(const n of (autoPick||[]))pick(n);
  try{w.product1&&w.product1.calcuEstimate()}catch{}
 },{ppType:t,...sp});
 await pg.waitForTimeout(900);
 const amt=await pg.evaluate((t:string)=>(document.querySelector(`[name="${t}_amt"]`) as any)?.value,t);
 console.log(`regress ${t}: amt=${amt}`);
 // reset chk for next
 await pg.evaluate((t:string)=>{const c=document.getElementById(`chk_is_${t}`) as any;if(c&&c.checked){c.checked=false;c.dispatchEvent(new Event('click',{bubbles:true}))}},t);
 await pg.waitForTimeout(300);
}
await b.close()}
main()
