// OMO-2365: 운영 환경 라이브 요율 캡처
// 보드 질문 응답용 — 샌드박스 (계약 할인 미적용) vs 운영 (ALLPACKMEISTER 계약가) 비교
//
// 실행: npx tsx scripts/test-fedex-prod-rates.ts

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const envFile = resolve(process.cwd(), '.env.local')
for (const line of readFileSync(envFile, 'utf-8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const BASE = process.env.FEDEX_API_BASE!   // apis.fedex.com (운영)
const CLIENT_ID = process.env.FEDEX_CLIENT_ID!
const CLIENT_SECRET = process.env.FEDEX_CLIENT_SECRET!
const ACCOUNT = process.env.FEDEX_ACCOUNT_NUMBER!  // 210839884

async function tok() {
  const r = await fetch(`${BASE}/oauth/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  })
  if (!r.ok) throw new Error(`OAuth ${r.status}: ${await r.text()}`)
  return ((await r.json()) as { access_token: string }).access_token
}

interface Addr { postalCode: string; countryCode: string; city: string; stateOrProvinceCode?: string }

async function rate(label: string, token: string, shipper: Addr, recipient: Addr, weightKg: number) {
  const isInt = shipper.countryCode !== recipient.countryCode
  const body = {
    accountNumber: { value: ACCOUNT },
    rateRequestControlParameters: { returnTransitTimes: true, servicesNeededOnRateFailure: true, rateSortOrder: 'COMMITASCENDING' },
    requestedShipment: {
      shipper: { address: shipper }, recipient: { address: recipient },
      pickupType: 'USE_SCHEDULED_PICKUP', rateRequestType: ['ACCOUNT', 'LIST'], preferredCurrency: 'USD',
      ...(isInt ? {
        customsClearanceDetail: { dutiesPayment: { paymentType: 'SENDER' }, commodities: [
          { description: 'Printed marketing materials', countryOfManufacture: shipper.countryCode, quantity: 1, quantityUnits: 'PCS',
            unitPrice: { amount: 10, currency: 'USD' }, customsValue: { amount: 10, currency: 'USD' },
            weight: { units: 'KG', value: weightKg }, harmonizedCode: '491110' }] }
      } : {}),
      requestedPackageLineItems: [{ weight: { units: 'KG', value: weightKg } }],
    },
  }
  const r = await fetch(`${BASE}/rate/v1/rates/quotes`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-locale': 'en_US' },
    body: JSON.stringify(body),
  })
  const status = r.status
  const data: any = await r.json().catch(() => ({}))
  // 모든 ratedShipmentDetails 보존 (ACCOUNT vs LIST 비교)
  const options = (data?.output?.rateReplyDetails ?? []).map((d: any) => ({
    serviceType: d.serviceType, serviceName: d.serviceName,
    rateDetails: (d.ratedShipmentDetails ?? []).map((r: any) => ({
      rateType: r.rateType, currency: r.currency,
      totalNetCharge: r.totalNetCharge, totalBaseCharge: r.totalBaseCharge,
      totalDiscounts: r.totalDiscounts, totalSurcharges: r.totalSurcharges,
    })),
  }))
  return { label, status, options, alerts: data?.output?.alerts ?? [], errors: data?.errors ?? [] }
}

;(async () => {
  console.log(`BASE=${BASE} ACCOUNT=${ACCOUNT}`)
  const token = await tok()
  console.log(`✅ Prod OAuth OK\n`)

  const KR = { postalCode: '14488', countryCode: 'KR', city: 'BUCHEON' } as Addr
  const cases: any[] = []
  for (const job of [
    ['KR Bucheon → US LA, 1kg',    KR, { postalCode: '90210', countryCode: 'US', city: 'BEVERLY HILLS', stateOrProvinceCode: 'CA' }, 1.0],
    ['KR Bucheon → US LA, 2kg',    KR, { postalCode: '90210', countryCode: 'US', city: 'BEVERLY HILLS', stateOrProvinceCode: 'CA' }, 2.0],
    ['KR Bucheon → US NY, 1kg',    KR, { postalCode: '10001', countryCode: 'US', city: 'NEW YORK', stateOrProvinceCode: 'NY' }, 1.0],
    ['KR Bucheon → JP Tokyo, 1kg', KR, { postalCode: '100-0001', countryCode: 'JP', city: 'TOKYO' }, 1.0],
    ['KR Bucheon → GB London, 1kg', KR, { postalCode: 'SW1A 1AA', countryCode: 'GB', city: 'LONDON' }, 1.0],
  ] as const) {
    const c = await rate(job[0] as string, token, job[1] as Addr, job[2] as Addr, job[3] as number)
    cases.push(c)
    console.log(`${c.status} ${c.label}`)
    for (const o of c.options.slice(0, 6)) {
      const acc = o.rateDetails.find((r: any) => r.rateType === 'ACCOUNT' || r.rateType === 'PAYOR_ACCOUNT_PACKAGE')
      const list = o.rateDetails.find((r: any) => r.rateType === 'LIST' || r.rateType === 'PAYOR_LIST_PACKAGE')
      const accPrice = acc ? `${acc.totalNetCharge} ${acc.currency}` : '-'
      const listPrice = list ? `${list.totalNetCharge} ${list.currency}` : '-'
      console.log(`  · ${o.serviceType.padEnd(40)}  ACCOUNT=${accPrice.padEnd(22)} LIST=${listPrice}`)
    }
    await new Promise((r) => setTimeout(r, 800))
  }
  const out = {
    capturedAt: new Date().toISOString(),
    fedex: { base: BASE, account: ACCOUNT, env: 'production' },
    summary: { total: cases.length, success: cases.filter((c) => c.status === 200).length },
    cases,
  }
  writeFileSync('public/fedex-status/prod-rates.json', JSON.stringify(out, null, 2))
  console.log(`\nSaved public/fedex-status/prod-rates.json`)
})()
