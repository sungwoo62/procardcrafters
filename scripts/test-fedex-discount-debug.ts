// OMO-2365: 운영 ACCOUNT 가격이 계약서 할인율 만큼 안 적용되는 문제 디버깅
//
// DB 시드 (계약서 PricingAgreement 2520066223-100):
//   IP Zone D (US) ≤ 2.5kg = 77.41% 할인
//   IP automation 보너스 3.8%
//   → 기대치: LIST × (1 - 0.7741) × (1 - 0.038) = LIST × 0.2174
//
// 실측: LIST ₩164,460 → ACCOUNT ₩71,840 (할인 ~56%) → 기대 ₩35,748 이 아님
//
// 가설:
//   A) rateRequestType 에 ACCOUNT 만 보내면 base account rate (소액 할인) 만 적용
//   B) PREFERRED / INCENTIVE / PAYOR_LIST_SHIPMENT 등 다른 rateType 시도 필요
//   C) pricingDate / accountSpecificRate 등 contract effective_from 명시 필요
//   D) FedEx Pricing Agreement 가 API 측에 sync 안 됨 (계약 활성화 별건)

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
const ACCOUNT = process.env.FEDEX_ACCOUNT_NUMBER!

async function tok() {
  const r = await fetch(`${BASE}/oauth/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  })
  if (!r.ok) throw new Error(`OAuth ${r.status}: ${await r.text()}`)
  return ((await r.json()) as { access_token: string }).access_token
}

async function rate(label: string, token: string, rateRequestType: string[], extra: any = {}) {
  const body = {
    accountNumber: { value: ACCOUNT },
    rateRequestControlParameters: { returnTransitTimes: true, servicesNeededOnRateFailure: true, rateSortOrder: 'COMMITASCENDING' },
    requestedShipment: {
      shipper: { address: { postalCode: '14488', countryCode: 'KR', city: 'BUCHEON' } },
      recipient: { address: { postalCode: '90210', countryCode: 'US', city: 'BEVERLY HILLS', stateOrProvinceCode: 'CA' } },
      pickupType: 'USE_SCHEDULED_PICKUP',
      serviceType: 'FEDEX_INTERNATIONAL_PRIORITY',
      rateRequestType,
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
      ...extra,
    },
  }
  const r = await fetch(`${BASE}/rate/v1/rates/quotes`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-locale': 'en_US' },
    body: JSON.stringify(body),
  })
  const data: any = await r.json().catch(() => ({}))
  console.log(`\n=== ${label} (HTTP ${r.status}) ===`)
  const reply = data?.output?.rateReplyDetails ?? []
  for (const d of reply.slice(0, 4)) {
    for (const r of d.ratedShipmentDetails ?? []) {
      console.log(`  ${d.serviceType.padEnd(40)} ${r.rateType?.padEnd(28)} ${r.totalNetCharge} ${r.currency}  (base=${r.totalBaseCharge ?? '-'} disc=${r.totalDiscounts ?? '-'} sur=${r.totalSurcharges ?? '-'})`)
    }
  }
  for (const a of (data?.output?.alerts ?? []).slice(0, 5)) console.log(`  ! ${a.code}: ${a.message}`)
  for (const e of (data?.errors ?? []).slice(0, 3)) console.log(`  ❌ ${e.code}: ${e.message}`)
  return data
}

;(async () => {
  const t = await tok()
  console.log(`apis.fedex.com, account=${ACCOUNT}, KR→US 1kg IP`)

  await rate('A) ACCOUNT + LIST (현재 사용)', t, ['ACCOUNT', 'LIST'])
  await rate('B) PREFERRED_ACCOUNT_PACKAGE', t, ['PREFERRED_ACCOUNT_PACKAGE', 'LIST'])
  await rate('C) PAYOR_ACCOUNT_PACKAGE', t, ['PAYOR_ACCOUNT_PACKAGE'])
  await rate('D) RETAIL', t, ['RETAIL'])
  await rate('E) NONE (default)', t, [])
  await rate('F) PAYOR_ACCOUNT_SHIPMENT', t, ['PAYOR_ACCOUNT_SHIPMENT'])
  await rate('G) preferred=KRW', t, ['ACCOUNT', 'LIST'], { preferredCurrency: 'KRW' })
})()
