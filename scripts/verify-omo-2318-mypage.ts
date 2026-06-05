/**
 * OMO-2318 마이페이지 보강 캡처
 * 신규 PCCF 주문이 기존 잘못된 주문명과 함께 결제대기 목록에 어떻게 노출되는지 확인.
 * 테이블 텍스트를 JSON으로 추출하고, 보이는 영역만 클립 캡처한다.
 */
import * as fs from 'fs'
import * as path from 'path'

const REPORT_DIR = path.join(import.meta.dirname ?? __dirname, '..', 'public', 'reports', 'omo-2318')
const SCREENSHOT_DIR = path.join(REPORT_DIR, 'screenshots')
const SWADPIA_BASE = 'https://www.swadpia.co.kr'

async function main() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'ko-KR',
    viewport: { width: 1400, height: 900 },
  })
  const page = await ctx.newPage()

  try {
    await page.goto(`${SWADPIA_BASE}/member/login`, { waitUntil: 'domcontentloaded' })
    await page.fill('input[name="member_id"]', process.env.SWADPIA_USERNAME!)
    await page.fill('input[name="member_pw"]', process.env.SWADPIA_PASSWORD!)
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
      page.click('#icon_member_login'),
    ])
    await page.waitForTimeout(2000)

    await page.goto(`${SWADPIA_BASE}/mypage/order_unpaid`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(3000)

    // 모든 주문 row에서 제목/금액/주문번호 추출
    const rows = await page.evaluate(() => {
      const out: { rawText: string; titleCandidates: string[] }[] = []
      const trs = document.querySelectorAll('table tbody tr, .order_list tr, .list_row')
      trs.forEach((tr) => {
        const text = (tr.textContent || '').replace(/\s+/g, ' ').trim()
        if (!text || text.length < 8) return
        const titles = Array.from(tr.querySelectorAll('a, strong, b, .title')).map((e) => (e.textContent || '').trim()).filter(Boolean)
        out.push({ rawText: text, titleCandidates: titles })
      })
      return out
    })

    fs.writeFileSync(path.join(REPORT_DIR, 'mypage-rows.json'), JSON.stringify(rows, null, 2))
    process.stdout.write(`row 개수: ${rows.length}\n`)
    for (const r of rows.slice(0, 10)) {
      process.stdout.write(`  • ${r.rawText.slice(0, 160)}\n`)
    }

    // 결제대기 페이지 전체 + 첫 화면 클립
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-mypage-unpaid-full.png'), fullPage: true })
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-mypage-unpaid-top.png'), clip: { x: 0, y: 100, width: 1400, height: 800 } })
  } finally {
    await browser.close()
  }
}

main().catch((e) => { process.stderr.write(`${e}\n`); process.exit(1) })
