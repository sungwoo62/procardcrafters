// OMO-3581: 성원 별색 박 상품 바로주문 업로드 슬롯 구조 라이브 실측 (READ-ONLY).
//
// 목적(블로커 해소): 합본 PDF 페이지 구성 결정 입력 = 성원 바로주문 업로드 슬롯이
//   (a) 단일파일(→다중페이지 PDF 합본) 인가 (b) 다중파일(위치보기용/인쇄/박파일 별도) 인가,
//   그리고 요구 페이지/파일 순서·가이드("박인쇄 작업방법") 텍스트를 캡처한다.
//
// 절대규칙: 제출/결제/업로드 없음. #btn_order3 모달만 열어 DOM·가이드 텍스트 스냅샷.
//
// 사용: node scripts/omo3581-upload-slot-probe.mjs [CODE]   (기본 CNC1000 = 명함)
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const BASE = 'https://www.swadpia.co.kr'
const CODE = process.argv[2] || 'CNC1000'
const GOODS = 'G' + CODE.slice(1, -1) + '1'

const envPath = path.resolve('.env.local')
if (fs.existsSync(envPath)) for (const l of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const USER = process.env.SWADPIA_USERNAME, PW = process.env.SWADPIA_PASSWORD
if (!USER || !PW) { console.error('NO CREDS'); process.exit(2) }

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ locale: 'ko-KR', viewport: { width: 1400, height: 1600 } })
const page = await ctx.newPage()
page.on('dialog', (d) => d.dismiss().catch(() => {})) // 모달 confirm 은 모두 취소(실주문 방지)

await page.goto(`${BASE}/member/login`, { waitUntil: 'domcontentloaded', timeout: 25000 })
await page.fill('input[name="member_id"]', USER); await page.fill('input[name="member_pw"]', PW)
await Promise.all([page.waitForNavigation({ timeout: 25000 }).catch(() => {}), page.click('#icon_member_login').catch(() => {})])
if (page.url().includes('/member/login')) { console.error('LOGIN FAILED'); await browser.close(); process.exit(3) }

await page.goto(`${BASE}/goods/goods_view/${CODE}/${GOODS}`, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(2000)

// 바로주문 모달 열기 (옵션 미선택 상태로도 모달 DOM 은 존재 — 업로드 슬롯 구조만 확인)
const opened = await page.evaluate(() => {
  const btn = document.querySelector('#btn_order3')
  if (btn) { btn.click(); return true }
  return false
})
await page.waitForTimeout(1500)

const snap = await page.evaluate(() => {
  const txt = (el) => (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim()
  // 모든 plupload/uploader 컨테이너
  const uploaders = Array.from(document.querySelectorAll('[id*="uploader" i], .plupload, [id*="upload" i]'))
    .map((e) => ({ tag: e.tagName, id: e.id, cls: e.className, vis: e.offsetParent !== null }))
  // 파일 관련 input
  const fileInputs = Array.from(document.querySelectorAll('input'))
    .filter((i) => /file|upload|order_file/i.test(i.name || i.id || ''))
    .map((i) => ({ name: i.name, id: i.id, type: i.type }))
  // 박/위치/단면 가이드 텍스트 후보
  const guideEls = Array.from(document.querySelectorAll('*'))
    .filter((e) => e.children.length === 0 && /박|위치보기|단면|양면|작업방법|별색|K100|M100|인쇄파일|박파일/.test(e.textContent || ''))
    .map((e) => txt(e)).filter((t) => t.length > 3 && t.length < 300)
  const guide = Array.from(new Set(guideEls)).slice(0, 40)
  // 주문 모달 컨테이너 HTML(트림)
  const modal = document.querySelector('#layer_order, #order_form, [id*="order" i].layer, .order_pop')
  const modalHtml = modal ? modal.outerHTML.slice(0, 4000) : '(no order modal container found)'
  return { uploaders, fileInputs, guide, modalHtml, hasOrderForm: !!document.getElementById('order_form') }
})

const out = { code: CODE, opened, ...snap }
fs.mkdirSync('artifacts/omo3581', { recursive: true })
fs.writeFileSync(`artifacts/omo3581/upload-slot-${CODE}.json`, JSON.stringify(out, null, 2))
await page.screenshot({ path: `artifacts/omo3581/upload-slot-${CODE}.png`, fullPage: false }).catch(() => {})
console.log(JSON.stringify({ code: CODE, opened, uploaders: out.uploaders, fileInputs: out.fileInputs, guideCount: out.guide.length, guide: out.guide.slice(0, 20), hasOrderForm: out.hasOrderForm }, null, 2))
await browser.close()
