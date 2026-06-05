// OMO-2365: FedEx 샌드박스 creds 검증
// - OAuth 토큰 발급
// - KR 발 / 글로벌 발 양쪽으로 Rate API 호출하여 응답 확인
//
// 실행: npx tsx scripts/test-fedex-sandbox.ts

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// .env.local 직접 파싱 (dotenv 의존 제거)
const envFile = resolve(process.cwd(), '.env.local')
for (const line of readFileSync(envFile, 'utf-8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const BASE = process.env.FEDEX_API_BASE ?? 'https://apis-sandbox.fedex.com'
const CLIENT_ID = process.env.FEDEX_CLIENT_ID!
const CLIENT_SECRET = process.env.FEDEX_CLIENT_SECRET!
const ACCOUNT = process.env.FEDEX_ACCOUNT_NUMBER!

async function token(): Promise<string> {
  const res = await fetch(`${BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  })
  const text = await res.text()
  console.log(`[OAuth] status=${res.status}`)
  if (!res.ok) {
    console.error(text)
    throw new Error('OAuth failed')
  }
  const data = JSON.parse(text)
  console.log(`[OAuth] token len=${data.access_token.length}, expires_in=${data.expires_in}s, scope=${data.scope ?? '(none)'}`)
  return data.access_token
}

interface ShipperAddress {
  postalCode: string
  countryCode: string
  city: string
  stateOrProvinceCode?: string
}

async function quote(label: string, accessToken: string, shipper: ShipperAddress, recipient: ShipperAddress, weightKg: number) {
  console.log(`\n=== ${label} ===`)
  const body = {
    accountNumber: { value: ACCOUNT },
    rateRequestControlParameters: {
      returnTransitTimes: true,
      servicesNeededOnRateFailure: true,
      rateSortOrder: 'COMMITASCENDING',
    },
    requestedShipment: {
      shipper: { address: shipper },
      recipient: { address: recipient },
      pickupType: 'USE_SCHEDULED_PICKUP',
      rateRequestType: ['ACCOUNT', 'LIST'],
      preferredCurrency: 'USD',
      requestedPackageLineItems: [
        { weight: { units: 'KG', value: weightKg } },
      ],
      ...(shipper.countryCode !== recipient.countryCode
        ? {
            customsClearanceDetail: {
              dutiesPayment: { paymentType: 'SENDER' },
              commodities: [
                {
                  description: 'Printed marketing materials',
                  countryOfManufacture: shipper.countryCode,
                  quantity: 1,
                  quantityUnits: 'PCS',
                  unitPrice: { amount: 10, currency: 'USD' },
                  customsValue: { amount: 10, currency: 'USD' },
                  weight: { units: 'KG', value: weightKg },
                  harmonizedCode: '491110',
                },
              ],
            },
          }
        : {}),
    },
  }
  const res = await fetch(`${BASE}/rate/v1/rates/quotes`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-locale': 'en_US',
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  console.log(`[Rate] status=${res.status}`)
  if (!res.ok) {
    console.error(text.slice(0, 800))
    return
  }
  const data = JSON.parse(text)
  const reply = data.output?.rateReplyDetails ?? []
  console.log(`[Rate] options=${reply.length}, alerts=${data.output?.alerts?.length ?? 0}`)
  for (const detail of reply.slice(0, 6)) {
    const rated = detail.ratedShipmentDetails?.[0]
    console.log(`  · ${detail.serviceType}  ${rated?.totalNetCharge} ${rated?.currency}  (${rated?.rateType})`)
  }
  for (const a of data.output?.alerts?.slice(0, 5) ?? []) {
    console.log(`  ! alert ${a.code}: ${a.message}`)
  }
}

;(async () => {
  if (!CLIENT_ID || !CLIENT_SECRET || !ACCOUNT) {
    console.error('FEDEX_CLIENT_ID / FEDEX_CLIENT_SECRET / FEDEX_ACCOUNT_NUMBER 누락')
    process.exit(1)
  }
  console.log(`BASE=${BASE}, ACCOUNT=${ACCOUNT}`)
  const t = await token()

  // 케이스 1: KR 발 → US 행 (현재 코드 가정)
  await quote(
    'KR (Bucheon 14488) → US (Memphis 38116) 1kg',
    t,
    { postalCode: '14488', countryCode: 'KR', city: 'BUCHEON' },
    { postalCode: '38116', countryCode: 'US', city: 'MEMPHIS', stateOrProvinceCode: 'TN' },
    1.0,
  )

  // 케이스 2: US 발 → US 행 (샌드박스 글로벌 계정 디폴트)
  await quote(
    'US (Memphis) → US (Beverly Hills 90210) 1kg',
    t,
    { postalCode: '38116', countryCode: 'US', city: 'MEMPHIS', stateOrProvinceCode: 'TN' },
    { postalCode: '90210', countryCode: 'US', city: 'BEVERLY HILLS', stateOrProvinceCode: 'CA' },
    1.0,
  )

  // 케이스 3: KR 발 → JP 행 (실제 흔한 한국출 international)
  await quote(
    'KR (Bucheon) → JP (Tokyo 100-0001) 1kg',
    t,
    { postalCode: '14488', countryCode: 'KR', city: 'BUCHEON' },
    { postalCode: '100-0001', countryCode: 'JP', city: 'TOKYO' },
    1.0,
  )
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
