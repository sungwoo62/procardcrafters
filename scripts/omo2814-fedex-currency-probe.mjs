// OMO-2814: FedEx rate 응답의 통화(currency) 확인 probe.
// ratedShipmentDetails 별 rateType/currency/totalNetCharge 를 그대로 덤프해
// preferredCurrency:USD 요청에도 KRW 가 섞여 오는지 검증한다.
import { readFileSync } from 'node:fs'

// .env.local 로드 (간단 파서)
const env = {}
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const BASE = env.FEDEX_API_BASE || 'https://apis.fedex.com'

async function token() {
  const r = await fetch(`${BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: env.FEDEX_CLIENT_ID,
      client_secret: env.FEDEX_CLIENT_SECRET,
    }),
  })
  if (!r.ok) throw new Error(`oauth ${r.status} ${await r.text()}`)
  return (await r.json()).access_token
}

async function rate(t, country, postal, city) {
  const body = {
    accountNumber: { value: env.FEDEX_ACCOUNT_NUMBER },
    rateRequestControlParameters: { returnTransitTimes: true, rateSortOrder: 'COMMITASCENDING' },
    requestedShipment: {
      shipper: { address: { postalCode: '14488', countryCode: 'KR', city: 'BUCHEON' } },
      recipient: { address: { postalCode: postal, countryCode: country, city } },
      pickupType: 'USE_SCHEDULED_PICKUP',
      rateRequestType: ['ACCOUNT', 'LIST'],
      preferredCurrency: 'USD',
      customsClearanceDetail: {
        dutiesPayment: { paymentType: 'SENDER' },
        commodities: [{
          description: 'Printed marketing materials', countryOfManufacture: 'KR',
          quantity: 1, quantityUnits: 'PCS',
          unitPrice: { amount: 10, currency: 'USD' }, customsValue: { amount: 10, currency: 'USD' },
          weight: { units: 'KG', value: 0.5 }, harmonizedCode: '491110',
        }],
      },
      requestedPackageLineItems: [{ weight: { units: 'KG', value: 0.5 } }],
    },
  }
  const r = await fetch(`${BASE}/rate/v1/rates/quotes`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', 'X-locale': 'en_US' },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`rate ${r.status} ${await r.text()}`)
  return r.json()
}

const t = await token()
for (const [c, p, city] of [['US', '10001', 'NEW YORK'], ['JP', '1000001', 'TOKYO']]) {
  const data = await rate(t, c, p, city)
  console.log(`\n===== ${c} ${p} =====`)
  for (const d of data.output?.rateReplyDetails ?? []) {
    console.log(`service=${d.serviceType}`)
    for (const r of d.ratedShipmentDetails ?? []) {
      console.log(`   rateType=${r.rateType} currency=${r.currency} totalNetCharge=${r.totalNetCharge} totalBaseCharge=${r.totalBaseCharge}`)
    }
  }
}
