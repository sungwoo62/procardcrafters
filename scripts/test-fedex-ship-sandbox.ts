// OMO-2365: Ship API 샌드박스 검증 (FedEx Label Validation Step 2)
//
// 목표
//  1. /ship/v1/shipments 호출 → master tracking + Base64 PDF 라벨
//  2. public/fedex-status/sample-label.pdf 저장 (라벨 평가팀 제출용 후보)
//
// 주의: 샌드박스 라벨은 production 환경에서 사용 불가. label@fedex.com 에 보내는 것도
//       프로젝트가 production 으로 이동된 이후 production label 으로 보내야 함 (Step 3-4).
//       이 스크립트는 Step 1-2 검증 용도.

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const envFile = resolve(process.cwd(), '.env.local')
for (const line of readFileSync(envFile, 'utf-8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const BASE = process.env.FEDEX_SANDBOX_API_BASE!
const CLIENT_ID = process.env.FEDEX_SANDBOX_CLIENT_ID!
const CLIENT_SECRET = process.env.FEDEX_SANDBOX_CLIENT_SECRET!
const ACCOUNT = process.env.FEDEX_SANDBOX_ACCOUNT_NUMBER!

async function tok() {
  const r = await fetch(`${BASE}/oauth/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  })
  if (!r.ok) throw new Error(`OAuth ${r.status}: ${await r.text()}`)
  return ((await r.json()) as { access_token: string }).access_token
}

;(async () => {
  const token = await tok()
  console.log(`✅ Sandbox OAuth OK`)

  // KR Bucheon → JP Tokyo, 1kg, INTERNATIONAL_PRIORITY
  const body = {
    labelResponseOptions: 'LABEL',
    requestedShipment: {
      shipper: {
        contact: {
          personName: 'ALLPACKMEISTER CO., LTD.',
          phoneNumber: '0327030200',
          companyName: 'ALLPACKMEISTER',
        },
        address: {
          streetLines: ['123-45 BUCHEON-RO'],
          city: 'BUCHEON',
          stateOrProvinceCode: '',
          postalCode: '14488',
          countryCode: 'KR',
        },
      },
      recipients: [{
        contact: {
          personName: 'TEST RECIPIENT',
          phoneNumber: '0312345678',
          companyName: 'TEST CO',
        },
        address: {
          streetLines: ['1-1-1 CHIYODA'],
          city: 'TOKYO',
          stateOrProvinceCode: '',
          postalCode: '100-0001',
          countryCode: 'JP',
        },
      }],
      shipDatestamp: new Date().toISOString().slice(0, 10),
      serviceType: 'INTERNATIONAL_PRIORITY',
      packagingType: 'YOUR_PACKAGING',
      pickupType: 'USE_SCHEDULED_PICKUP',
      blockInsightVisibility: false,
      shippingChargesPayment: {
        paymentType: 'SENDER',
        payor: { responsibleParty: { accountNumber: { value: ACCOUNT } } },
      },
      labelSpecification: {
        labelFormatType: 'COMMON2D',
        imageType: 'PDF',
        labelStockType: 'PAPER_4X6',
      },
      customsClearanceDetail: {
        dutiesPayment: {
          paymentType: 'SENDER',
          payor: { responsibleParty: { accountNumber: { value: ACCOUNT } } },
        },
        isDocumentOnly: false,
        commercialInvoice: {
          shipmentPurpose: 'SOLD',
        },
        commodities: [{
          description: 'Printed marketing materials',
          countryOfManufacture: 'KR',
          quantity: 1,
          quantityUnits: 'PCS',
          unitPrice: { amount: 10, currency: 'USD' },
          customsValue: { amount: 10, currency: 'USD' },
          weight: { units: 'KG', value: 1.0 },
          harmonizedCode: '491110',
          numberOfPieces: 1,
        }],
      },
      requestedPackageLineItems: [{
        sequenceNumber: 1,
        weight: { units: 'KG', value: 1.0 },
        customerReferences: [{ customerReferenceType: 'CUSTOMER_REFERENCE', value: 'OMO-2365-TEST' }],
      }],
    },
    accountNumber: { value: ACCOUNT },
  }

  const r = await fetch(`${BASE}/ship/v1/shipments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-locale': 'en_US',
    },
    body: JSON.stringify(body),
  })
  const text = await r.text()
  console.log(`Ship API HTTP ${r.status}`)
  let data: any
  try { data = JSON.parse(text) } catch { data = { raw: text.slice(0, 500) } }

  if (!r.ok) {
    console.error(JSON.stringify(data?.errors ?? data, null, 2))
    writeFileSync('public/fedex-status/ship-sandbox-error.json', JSON.stringify({ status: r.status, data }, null, 2))
    process.exit(1)
  }

  const tx = data?.transactionId
  const out = data?.output
  const completed = out?.transactionShipments?.[0]
  const master = completed?.masterTrackingNumber
  const pieces = completed?.pieceResponses ?? []
  console.log(`✅ Master tracking: ${master}`)
  console.log(`Pieces: ${pieces.length}, transactionId: ${tx}`)

  for (const p of pieces) {
    const labels = p.packageDocuments ?? []
    for (const lbl of labels) {
      if (lbl.contentType === 'LABEL' && lbl.encodedLabel) {
        const fname = `public/fedex-status/sample-label-${master}.pdf`
        writeFileSync(fname, Buffer.from(lbl.encodedLabel, 'base64'))
        console.log(`  → 라벨 저장: ${fname}`)
      }
    }
  }

  writeFileSync('public/fedex-status/ship-sandbox-result.json', JSON.stringify({
    capturedAt: new Date().toISOString(),
    sandbox: true,
    transactionId: tx,
    masterTrackingNumber: master,
    serviceType: completed?.serviceType,
    serviceName: completed?.serviceName,
    pieces: pieces.length,
    completedShipmentDetail: {
      shipmentRating: completed?.completedShipmentDetail?.shipmentRating?.shipmentRateDetails?.slice(0, 3),
    },
  }, null, 2))
})()
