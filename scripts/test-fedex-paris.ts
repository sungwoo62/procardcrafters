// OMO-2365: 보드가 FR Paris 에 「많이 받기로한」 할인 — 실제 API 적용 확인

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
  return ((await r.json()) as { access_token: string }).access_token
}

async function rate(token: string, service: string, recipientPostal: string, recipientCountry: string, recipientCity: string) {
  const body = {
    accountNumber: { value: ACCOUNT },
    rateRequestControlParameters: { returnTransitTimes: true, servicesNeededOnRateFailure: true, rateSortOrder: 'COMMITASCENDING' },
    requestedShipment: {
      shipper: { address: { postalCode: '14488', countryCode: 'KR', city: 'BUCHEON' } },
      recipient: { address: { postalCode: recipientPostal, countryCode: recipientCountry, city: recipientCity } },
      pickupType: 'USE_SCHEDULED_PICKUP',
      serviceType: service,
      rateRequestType: ['ACCOUNT', 'LIST'],
      preferredCurrency: 'KRW',
      shipDateStamp: '2026-06-08',
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
  return await r.json()
}

;(async () => {
  const token = await tok()
  // 보드 웹사이트 quote: FR Paris (75001), 1kg
  // 실제 zone 확인 + 할인율 확인
  const results: any[] = []
  for (const svc of ['FEDEX_INTERNATIONAL_PRIORITY', 'INTERNATIONAL_ECONOMY', 'INTERNATIONAL_PRIORITY_EXPRESS']) {
    console.log(`\n=== ${svc} → FR Paris 75001 ===`)
    const data: any = await rate(token, svc, '75001', 'FR', 'PARIS')
    const reply = (data?.output?.rateReplyDetails ?? [])[0]
    if (!reply) {
      console.log(JSON.stringify(data?.errors ?? data, null, 2).slice(0, 500))
      continue
    }
    for (const r of reply.ratedShipmentDetails ?? []) {
      const d = r.shipmentRateDetail
      console.log(`--- ${r.rateType} ---`)
      console.log(`  rateZone: ${d?.rateZone}`)
      console.log(`  rateScale: ${d?.rateScale}`)
      console.log(`  base: ${r.totalBaseCharge?.toLocaleString()}  totalDiscounts: ${r.totalDiscounts?.toLocaleString()}  net: ${r.totalNetCharge?.toLocaleString()} ${r.currency}`)
      if (d?.freightDiscount) {
        for (const f of d.freightDiscount) console.log(`    ${f.type}: ${f.amount?.toLocaleString()} (${f.percent}%)`)
      }
      if (d?.surCharges) {
        for (const s of d.surCharges) console.log(`    + ${s.type} ${s.description}: ${s.amount?.toLocaleString()}`)
      }
    }
    results.push({ serviceType: svc, reply })
  }
  writeFileSync('public/fedex-status/paris-detail.json', JSON.stringify({
    capturedAt: new Date().toISOString(),
    case: 'KR Bucheon → FR Paris 75001, 1kg, multiple services',
    website_reference_IP: {
      base: 227100, fuel: 14850, peak: 3200, discount: 186720, bonus: 8630, total: 49800,
      discount_pct: 82.22, bonus_pct: 3.8,
    },
    api_results: results,
  }, null, 2))
})()
