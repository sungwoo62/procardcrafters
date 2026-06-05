// OMO-2365: API 응답에서 surcharge / 할인 / 베이스를 모두 itemize 해서
// FedEx Korea 웹사이트 (₩86,120) 와 reconcile.

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

;(async () => {
  const token = await tok()
  const body = {
    accountNumber: { value: ACCOUNT },
    rateRequestControlParameters: { returnTransitTimes: true, servicesNeededOnRateFailure: true, rateSortOrder: 'COMMITASCENDING' },
    requestedShipment: {
      shipper: { address: { postalCode: '14488', countryCode: 'KR', city: 'BUCHEON' } },
      recipient: { address: { postalCode: '90210', countryCode: 'US', city: 'BEVERLY HILLS', stateOrProvinceCode: 'CA' } },
      pickupType: 'USE_SCHEDULED_PICKUP',
      serviceType: 'FEDEX_INTERNATIONAL_PRIORITY',
      rateRequestType: ['ACCOUNT', 'LIST'],
      preferredCurrency: 'KRW',
      shipDateStamp: '2026-06-08',  // 월요일 (웹사이트와 매치)
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
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-locale': 'en_US' },
    body: JSON.stringify(body),
  })
  const data: any = await r.json()
  const reply = (data?.output?.rateReplyDetails ?? []).find((d: any) => d.serviceType === 'FEDEX_INTERNATIONAL_PRIORITY')
  if (!reply) { console.log('no IP reply'); console.log(JSON.stringify(data, null, 2).slice(0, 2000)); return }

  console.log('=== FEDEX_INTERNATIONAL_PRIORITY ===\n')
  for (const r of reply.ratedShipmentDetails ?? []) {
    console.log(`--- rateType: ${r.rateType} (${r.currency}) ---`)
    console.log(`  totalNetCharge:    ${r.totalNetCharge?.toLocaleString()}`)
    console.log(`  totalBaseCharge:   ${r.totalBaseCharge?.toLocaleString()}`)
    console.log(`  totalDiscounts:    ${r.totalDiscounts?.toLocaleString()}`)
    console.log(`  totalSurcharges:   ${r.totalSurcharges?.toLocaleString()}`)
    console.log(`  totalNetFreight:   ${r.totalNetFreight?.toLocaleString()}`)
    console.log(`  totalNetFedExCharge: ${r.totalNetFedExCharge?.toLocaleString()}`)
    const detail = r.shipmentRateDetail
    if (detail?.surCharges) {
      console.log(`  surCharges:`)
      for (const s of detail.surCharges) console.log(`    ${s.type?.padEnd(20)} ${s.description ?? ''}: ${s.amount?.toLocaleString()}`)
    }
    if (detail?.freightDiscounts) {
      console.log(`  freightDiscounts:`)
      for (const d of detail.freightDiscounts) console.log(`    ${d.type ?? d.description}: ${d.amount?.toLocaleString()}`)
    }
    console.log()
  }
  writeFileSync('public/fedex-status/ip-detail.json', JSON.stringify({
    capturedAt: new Date().toISOString(),
    case: 'KR Bucheon 14488 → US Beverly Hills 90210, 1.0kg, FEDEX_INTERNATIONAL_PRIORITY, ship 2026-06-08 (Mon)',
    website_reference: {
      base_charge: 191400,
      surcharges: { fuel: 24520, us_inbound: 3900, out_of_area: 4200, peak_demand: 1280, total: 33900 },
      discount: 131910,
      bonus_discount: 7270,
      total: 86120,
      effective_discount_pct: 72.7,
      currency: 'KRW',
    },
    api: reply,
  }, null, 2))
})()
