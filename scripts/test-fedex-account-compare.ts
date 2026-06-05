// OMO-2365: 두 FedEx account 동일 케이스 비교
//
// 사용:
//   ALT_ACCOUNT=123456789 npx tsx scripts/test-fedex-account-compare.ts
//
// 또는 ARG 로:
//   npx tsx scripts/test-fedex-account-compare.ts 123456789

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const envFile = resolve(process.cwd(), '.env.local')
for (const line of readFileSync(envFile, 'utf-8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const BASE = process.env.FEDEX_API_BASE!
const CLIENT_ID = process.env.FEDEX_CLIENT_ID!
const CLIENT_SECRET = process.env.FEDEX_CLIENT_SECRET!
const PRIMARY = process.env.FEDEX_ACCOUNT_NUMBER!  // 210839884
const ALT = process.argv[2] || process.env.ALT_ACCOUNT
if (!ALT) {
  console.error('두 번째 account 를 인자로 또는 ALT_ACCOUNT env 로 전달하세요.')
  process.exit(1)
}

async function tok() {
  const r = await fetch(`${BASE}/oauth/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  })
  if (!r.ok) throw new Error(`OAuth ${r.status}: ${await r.text()}`)
  return ((await r.json()) as { access_token: string }).access_token
}

async function rate(token: string, account: string) {
  const body = {
    accountNumber: { value: account },
    rateRequestControlParameters: { returnTransitTimes: true, servicesNeededOnRateFailure: true, rateSortOrder: 'COMMITASCENDING' },
    requestedShipment: {
      shipper: { address: { postalCode: '14488', countryCode: 'KR', city: 'BUCHEON' } },
      recipient: { address: { postalCode: '90210', countryCode: 'US', city: 'BEVERLY HILLS', stateOrProvinceCode: 'CA' } },
      pickupType: 'USE_SCHEDULED_PICKUP',
      serviceType: 'FEDEX_INTERNATIONAL_PRIORITY',
      rateRequestType: ['ACCOUNT', 'LIST'],
      preferredCurrency: 'KRW',
      customsClearanceDetail: {
        dutiesPayment: { paymentType: 'SENDER' },
        commodities: [{
          description: 'Printed marketing materials', countryOfManufacture: 'KR', quantity: 1, quantityUnits: 'PCS',
          unitPrice: { amount: 10, currency: 'USD' }, customsValue: { amount: 10, currency: 'USD' },
          weight: { units: 'KG', value: 1.0 }, harmonizedCode: '491110',
        }],
      },
      requestedPackageLineItems: [{ weight: { units: 'KG', value: 1.0 } }],
    },
  }
  const r = await fetch(`${BASE}/rate/v1/rates/quotes`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-locale': 'en_US' },
    body: JSON.stringify(body),
  })
  const data: any = await r.json().catch(() => ({}))
  return { status: r.status, data }
}

;(async () => {
  const token = await tok()
  const results: any[] = []
  for (const acc of [PRIMARY, ALT]) {
    console.log(`\n=== account=${acc} ===`)
    const { status, data } = await rate(token, acc)
    console.log(`HTTP ${status}`)
    if (status !== 200) {
      console.log(JSON.stringify(data?.errors ?? data, null, 2))
      results.push({ account: acc, status, errors: data?.errors ?? [] })
      continue
    }
    const reply = (data?.output?.rateReplyDetails ?? []).filter((d: any) => d.serviceType === 'FEDEX_INTERNATIONAL_PRIORITY')
    const r = reply[0]?.ratedShipmentDetails?.find((r: any) => r.rateType === 'ACCOUNT')
    const l = reply[0]?.ratedShipmentDetails?.find((r: any) => r.rateType === 'LIST')
    if (r && l) {
      const discount = ((l.totalNetCharge - r.totalNetCharge) / l.totalNetCharge * 100).toFixed(1)
      console.log(`  LIST     ${l.totalNetCharge.toLocaleString()} ${l.currency}`)
      console.log(`  ACCOUNT  ${r.totalNetCharge.toLocaleString()} ${r.currency}  (할인 ${discount}%)`)
      results.push({ account: acc, status, list: l.totalNetCharge, account_price: r.totalNetCharge, discount_pct: Number(discount), currency: l.currency })
    }
    for (const a of (data?.output?.alerts ?? []).slice(0, 5)) console.log(`  ! ${a.code}: ${a.message}`)
  }
  console.log('\n=== 비교 결과 ===')
  if (results.length === 2 && results.every((r) => r.status === 200)) {
    const [a, b] = results
    const better = a.discount_pct > b.discount_pct ? a : b
    console.log(`  ${a.account}: ${a.discount_pct}% 할인`)
    console.log(`  ${b.account}: ${b.discount_pct}% 할인`)
    console.log(`  → ${better.account} 가 더 좋음. ${better.discount_pct >= 70 ? '✅ 계약 풀 적용' : '⚠ 여전히 격차 — sync 이슈'}`)
  }
  writeFileSync('public/fedex-status/account-compare.json', JSON.stringify({
    capturedAt: new Date().toISOString(),
    case: 'KR Bucheon → US Beverly Hills 1kg FEDEX_INTERNATIONAL_PRIORITY',
    expected_discount_pct: 76.29,
    results,
  }, null, 2))
})()
