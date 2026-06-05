// OMO-2365: 프로덕션 키 검증 (보드 제공)
// 운영 base URL + 후보 account 2개 (210839884 ALLPACKMEISTER / 740561073 첫 발급)
//
// 실행: npx tsx scripts/test-fedex-prod.ts

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// .env.local 로드 (FEDEX_* 만 override 가능)
const envFile = resolve(process.cwd(), '.env.local')
for (const line of readFileSync(envFile, 'utf-8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

// 프로덕션 creds (보드 코멘트 2026-06-05)
const PROD_CLIENT_ID = 'l7330f8e0ecd5c419293fca5036ac09696'
const PROD_CLIENT_SECRET = '63e0a9b10fc44f4192eeffafeda470d7'
const PROD_BASE = 'https://apis.fedex.com'
const ACCOUNT_CANDIDATES = ['210839884', '740561073']

async function token(baseUrl: string, clientId: string, clientSecret: string) {
  const r = await fetch(`${baseUrl}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })
  const text = await r.text()
  if (!r.ok) throw new Error(`OAuth ${r.status}: ${text.slice(0, 200)}`)
  return JSON.parse(text) as { access_token: string; expires_in: number; scope?: string }
}

async function rate(baseUrl: string, accessToken: string, account: string) {
  const body = {
    accountNumber: { value: account },
    rateRequestControlParameters: { returnTransitTimes: true, servicesNeededOnRateFailure: true, rateSortOrder: 'COMMITASCENDING' },
    requestedShipment: {
      shipper: { address: { postalCode: '14488', countryCode: 'KR', city: 'BUCHEON' } },
      recipient: { address: { postalCode: '100-0001', countryCode: 'JP', city: 'TOKYO' } },
      pickupType: 'USE_SCHEDULED_PICKUP',
      rateRequestType: ['ACCOUNT', 'LIST'],
      preferredCurrency: 'USD',
      customsClearanceDetail: {
        dutiesPayment: { paymentType: 'SENDER' },
        commodities: [{
          description: 'Printed marketing materials',
          countryOfManufacture: 'KR', quantity: 1, quantityUnits: 'PCS',
          unitPrice: { amount: 10, currency: 'USD' },
          customsValue: { amount: 10, currency: 'USD' },
          weight: { units: 'KG', value: 1.0 },
          harmonizedCode: '491110',
        }],
      },
      requestedPackageLineItems: [{ weight: { units: 'KG', value: 1.0 } }],
    },
  }
  const r = await fetch(`${baseUrl}/rate/v1/rates/quotes`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-locale': 'en_US',
    },
    body: JSON.stringify(body),
  })
  const data = await r.json().catch(() => ({}))
  return { status: r.status, data }
}

;(async () => {
  console.log('=== 프로덕션 OAuth (apis.fedex.com) ===')
  try {
    const t = await token(PROD_BASE, PROD_CLIENT_ID, PROD_CLIENT_SECRET)
    console.log(`✅ OAuth OK — token len=${t.access_token.length}, expires_in=${t.expires_in}s, scope=${t.scope ?? '(none)'}`)
    for (const acc of ACCOUNT_CANDIDATES) {
      console.log(`\n--- KR Bucheon → JP Tokyo 1kg, account=${acc} ---`)
      const { status, data } = await rate(PROD_BASE, t.access_token, acc)
      console.log(`HTTP ${status}`)
      if (status === 200) {
        const reply = (data as any)?.output?.rateReplyDetails ?? []
        for (const d of reply.slice(0, 5)) {
          const rated = d.ratedShipmentDetails?.[0]
          console.log(`  · ${d.serviceType}  $${rated?.totalNetCharge} ${rated?.currency} (${rated?.rateType})`)
        }
        return
      } else {
        const errors = (data as any)?.errors ?? []
        for (const e of errors.slice(0, 3)) console.log(`  ! ${e.code}: ${e.message}`)
      }
    }
    console.log('\n⚠️ 두 account 모두 실패')
  } catch (e: any) {
    console.error(`❌ OAuth 실패: ${e.message}`)
    process.exit(1)
  }
})()
