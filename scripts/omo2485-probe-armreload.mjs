/**
 * OMO-2485: ARM230W00 발주실패 원인 규명
 * paper_code 변경 시 성원 AJAX 리로드로 dependent select(색상/사이즈/수량)가
 * 바뀌는지 확인. ARM230W00(실패) vs INV350MT0(정상) 사후 옵션 대조.
 * 실행: node --env-file=.env.local scripts/omo2485-probe-armreload.mjs
 */
import { chromium } from 'playwright'

const BASE = 'https://www.swadpia.co.kr'
const CAT = process.argv[2] || 'CNC6000'

async function login(page) {
  await page.goto(`${BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.fill('input[name="member_id"]', process.env.SWADPIA_USERNAME)
  await page.fill('input[name="member_pw"]', process.env.SWADPIA_PASSWORD)
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
    page.click('#icon_member_login'),
  ])
  await page.waitForTimeout(2000)
}

async function dump(page, name) {
  return page.evaluate((n) => {
    const s = document.querySelector(`select[name="${n}"]`)
    if (!s) return null
    return Array.from(s.options).map((o) => o.value).filter((v) => v !== '')
  }, name)
}

async function snapshot(page, tag) {
  const color = await dump(page, 'print_color_type')
  const size = await dump(page, 'paper_size')
  const qty = await dump(page, 'paper_qty')
  console.log(`\n[${tag}]`)
  console.log(`  print_color_type: ${color ? color.join(', ') : '(없음)'}`)
  console.log(`  paper_size:       ${size ? size.join(', ') : '(없음)'}`)
  console.log(`  paper_qty(min~):  ${qty ? qty.slice(0, 6).join(', ') + ' ...('+qty.length+')' : '(없음)'}`)
  console.log(`  paper_qty has 200: ${qty ? qty.includes('200') : 'n/a'}`)
}

async function trySelectPaper(page, code) {
  console.log(`\n>>> paper_code=${code} 선택 시도`)
  try {
    await page.selectOption('select[name="paper_code"]', code)
    await page.waitForTimeout(2500) // AJAX 리로드 대기
    console.log('  paper_code 선택 OK')
  } catch (e) {
    console.log(`  paper_code 선택 실패: ${e.message.split('\n')[0]}`)
  }
  await snapshot(page, `after paper_code=${code}`)
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newContext().then((c) => c.newPage())
  try {
    await login(page)
    await page.goto(`${BASE}/goods/goods_view/${CAT}/1`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(1500)
    const defaultPaper = await page.$eval('select[name="paper_code"]', (s) => s.value)
    console.log(`${CAT} 로드. 기본 paper_code=${defaultPaper}`)
    await snapshot(page, 'initial (default paper)')
    // INV350MT0(정상군) → ARM230W00(실패군) 순차 전환
    await trySelectPaper(page, 'INV350MT0')
    await trySelectPaper(page, 'ARM230W00')
  } finally {
    await browser.close()
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
