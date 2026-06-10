/**
 * OMO-2834 — 성원 결제서(order_pay) 실원가 캡처 셀렉터 자동검증
 *
 * 배경: readOrderPayAmount() 의 라이브 검증은 실 발주 1건(실결제)이 필요하고
 *   드라이런은 결제서 직전에 멈춰 검증 불가. 보드 지시("자동테스트로 진행해봐")에 따라
 *   라이브 발주 대신, 성원 결제서 DOM 형태(OMO-2647 probe 로 확인된
 *   order_price_detail 전역 / .estimate_pay_price·[class*=pay_price] 셀렉터 / 결제금액 라벨)를
 *   재현한 픽스처를 실 Chromium 에 로드해 readOrderPayAmount() 의 3중 캡처 경로를 검증한다.
 *
 * 실행: npx vitest run src/lib/__tests__/swadpia-order-pay-capture.test.ts
 * Chromium 미설치 환경(일부 CI)에서는 자동 skip — 발주 캡처는 비차단 기능이라 게이트하지 않는다.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Browser } from 'playwright'
import { readOrderPayAmount } from '../swadpia-order'

const AMT = 187000
const AMT_TXT = '187,000원'

interface Fixture {
  name: string
  html: string
  expectKrw: number | null
  expectSourcePrefix: string
}

const FIXTURES: Fixture[] = [
  {
    name: '전략1: 전역 order_price_detail.pay_price (가장 신뢰)',
    html: `<html><body><div>결제 진행</div>
      <script>window.order_price_detail = { pay_price: ${AMT}, total_price: 999999 };</script></body></html>`,
    expectKrw: AMT,
    expectSourcePrefix: 'global:order_price_detail.pay_price',
  },
  {
    name: '전략1b: 전역 window.total_price 폴백',
    html: `<html><body><script>window.total_price = "${AMT_TXT}";</script></body></html>`,
    expectKrw: AMT,
    expectSourcePrefix: 'global:window.total_price',
  },
  {
    name: '전략2: 셀렉터 .estimate_pay_price (성원 실 DOM)',
    html: `<html><body><table><tr><th>결제 금액</th>
      <td class="estimate_pay_price">${AMT_TXT}</td></tr></table></body></html>`,
    expectKrw: AMT,
    expectSourcePrefix: 'selector:.estimate_pay_price',
  },
  {
    name: '전략2b: 셀렉터 #pay_price',
    html: `<html><body><span id="pay_price">${AMT_TXT}</span></body></html>`,
    expectKrw: AMT,
    expectSourcePrefix: 'selector:#pay_price',
  },
  {
    name: '전략2c: 셀렉터 [class*=pay_price] 부분일치',
    html: `<html><body><div class="order_pay_price_box">${AMT_TXT}</div></body></html>`,
    expectKrw: AMT,
    expectSourcePrefix: 'selector:',
  },
  {
    name: '전략3: 라벨 텍스트("총 결제금액 … 187,000원") 근처 추출',
    html: `<html><body><ul><li>상품금액 170,000원</li>
      <li>총 결제금액 : ${AMT_TXT}</li></ul></body></html>`,
    expectKrw: AMT,
    expectSourcePrefix: 'label:',
  },
  {
    name: '전략4: 캡처 실패 → krw null + 진단 후보 수집',
    html: `<html><body><div class="some_price_label">결제 안내</div>
      <div id="amount_note">아래에서 확인</div></body></html>`,
    expectKrw: null,
    expectSourcePrefix: 'none[',
  },
]

let browser: Browser | null = null
let launchError: string | null = null

beforeAll(async () => {
  try {
    const pw = await import('playwright')
    browser = await pw.chromium.launch({ headless: true })
  } catch (e) {
    launchError = e instanceof Error ? e.message : String(e)
  }
}, 60_000)

afterAll(async () => {
  if (browser) await browser.close()
})

describe('OMO-2834 readOrderPayAmount 결제서 캡처 경로', () => {
  for (const fx of FIXTURES) {
    it(fx.name, async () => {
      if (!browser) {
        // eslint-disable-next-line no-console
        console.warn(`[OMO-2834] Chromium 미가용 → skip (${launchError})`)
        return
      }
      const page = await browser.newPage()
      try {
        await page.setContent(fx.html, { waitUntil: 'load' })
        const res = await readOrderPayAmount(page)
        expect(res.krw).toBe(fx.expectKrw)
        expect(res.source.startsWith(fx.expectSourcePrefix)).toBe(true)
      } finally {
        await page.close()
      }
    }, 30_000)
  }
})
