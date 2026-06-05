// OMO-2371 — FedEx ETD (Electronic Trade Documents) 샌드박스 검증
//
// 두 시나리오를 모두 검증한다.
//
//  시나리오 1 — 발송 전 업로드
//    1) Upload Documents 호출 → docID
//    2) Ship API 호출 시 shipmentSpecialServices.etdDetail.attachedDocuments 에 docID 포함
//    3) 발송 생성 응답 + 라벨 확인
//
//  시나리오 2 — 발송 후 업로드
//    1) Ship API 호출 시 specialServiceTypes=['ELECTRONIC_TRADE_DOCUMENTS'] +
//       etdDetail.requestedDocumentTypes=['COMMERCIAL_INVOICE'] 지정 → masterTrackingNumber 수령
//    2) Upload Documents 호출 시 shipmentDocumentInfo.trackingNumber = masterTrackingNumber
//
// 결과 아티팩트
//   public/fedex-status/etd-scenario1-result.json
//   public/fedex-status/etd-scenario2-result.json
//
// 주의: 샌드박스 라벨/문서는 운영 환경에서 사용 불가. Step 3-4 (Production 평가) 는 별도 진행.

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  uploadEtdDocument,
  buildShipPreshipmentAttachment,
  buildShipPostshipmentEtdDetail,
} from '../src/lib/fedex-etd'

const envFile = resolve(process.cwd(), '.env.local')
for (const line of readFileSync(envFile, 'utf-8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const BASE = process.env.FEDEX_SANDBOX_API_BASE!
const CLIENT_ID = process.env.FEDEX_SANDBOX_CLIENT_ID!
const CLIENT_SECRET = process.env.FEDEX_SANDBOX_CLIENT_SECRET!
const ACCOUNT = process.env.FEDEX_SANDBOX_ACCOUNT_NUMBER!

if (!BASE || !CLIENT_ID || !CLIENT_SECRET || !ACCOUNT) {
  console.error('FEDEX_SANDBOX_* 환경 변수가 .env.local 에 모두 설정되어야 함')
  process.exit(1)
}

async function tok(): Promise<string> {
  const r = await fetch(`${BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  })
  if (!r.ok) throw new Error(`OAuth ${r.status}: ${await r.text()}`)
  return ((await r.json()) as { access_token: string }).access_token
}

// 최소 유효 PDF (Hello World) — 샌드박스 업로드 검증 용도
function buildSampleInvoicePdf(): Buffer {
  const pdf = `%PDF-1.4
1 0 obj
<</Type /Catalog /Pages 2 0 R>>
endobj
2 0 obj
<</Type /Pages /Kids [3 0 R] /Count 1>>
endobj
3 0 obj
<</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources <</Font <</F1 5 0 R>>>>>>
endobj
4 0 obj
<</Length 90>>
stream
BT /F1 18 Tf 72 720 Td (COMMERCIAL INVOICE) Tj 0 -24 Td (OMO-2371 sandbox ETD test) Tj ET
endstream
endobj
5 0 obj
<</Type /Font /Subtype /Type1 /BaseFont /Helvetica>>
endobj
xref
0 6
0000000000 65535 f
0000000010 00000 n
0000000056 00000 n
0000000103 00000 n
0000000196 00000 n
0000000333 00000 n
trailer
<</Size 6 /Root 1 0 R>>
startxref
400
%%EOF
`
  return Buffer.from(pdf, 'utf-8')
}

interface ShipResponse {
  output?: {
    transactionShipments?: Array<{
      masterTrackingNumber?: string
      serviceType?: string
      pieceResponses?: Array<{ packageDocuments?: Array<{ contentType?: string; encodedLabel?: string }> }>
    }>
  }
}

function commonShipShared(invoiceFileName: string) {
  return {
    shipper: {
      contact: { personName: 'ALLPACKMEISTER CO., LTD.', phoneNumber: '0327030200', companyName: 'ALLPACKMEISTER' },
      address: { streetLines: ['123-45 BUCHEON-RO'], city: 'BUCHEON', stateOrProvinceCode: '', postalCode: '14488', countryCode: 'KR' },
    },
    recipients: [{
      contact: { personName: 'TEST RECIPIENT', phoneNumber: '0312345678', companyName: 'TEST CO' },
      address: { streetLines: ['1-1-1 CHIYODA'], city: 'TOKYO', stateOrProvinceCode: '', postalCode: '100-0001', countryCode: 'JP' },
    }],
    shipDatestamp: new Date().toISOString().slice(0, 10),
    serviceType: 'INTERNATIONAL_PRIORITY',
    packagingType: 'YOUR_PACKAGING',
    pickupType: 'USE_SCHEDULED_PICKUP',
    blockInsightVisibility: false,
    shippingChargesPayment: { paymentType: 'SENDER', payor: { responsibleParty: { accountNumber: { value: ACCOUNT } } } },
    labelSpecification: { labelFormatType: 'COMMON2D', imageType: 'PDF', labelStockType: 'PAPER_4X6' },
    customsClearanceDetail: {
      dutiesPayment: { paymentType: 'SENDER', payor: { responsibleParty: { accountNumber: { value: ACCOUNT } } } },
      isDocumentOnly: false,
      commercialInvoice: { shipmentPurpose: 'SOLD' },
      commodities: [{
        description: 'Printed marketing materials', countryOfManufacture: 'KR', quantity: 1, quantityUnits: 'PCS',
        unitPrice: { amount: 10, currency: 'USD' }, customsValue: { amount: 10, currency: 'USD' },
        weight: { units: 'KG', value: 1.0 }, harmonizedCode: '491110', numberOfPieces: 1,
      }],
    },
    requestedPackageLineItems: [{
      sequenceNumber: 1, weight: { units: 'KG', value: 1.0 },
      customerReferences: [{ customerReferenceType: 'CUSTOMER_REFERENCE', value: `OMO-2371-${invoiceFileName}` }],
    }],
  }
}

async function shipApi(token: string, payload: unknown): Promise<{ status: number; body: ShipResponse & { errors?: unknown } }> {
  const r = await fetch(`${BASE}/ship/v1/shipments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-locale': 'en_US' },
    body: JSON.stringify(payload),
  })
  const text = await r.text()
  let body: ShipResponse & { errors?: unknown }
  try { body = JSON.parse(text) } catch { body = { errors: text.slice(0, 500) } as ShipResponse & { errors?: unknown } }
  return { status: r.status, body }
}

async function scenario1(token: string) {
  console.log('\n=== 시나리오 1 — 발송 전 ETD 업로드 → Ship 연결 ===')
  const pdf = buildSampleInvoicePdf()
  const referenceId = `OMO-2371-INV-${Date.now().toString(36)}`

  // 1) 사전 업로드
  let upload
  try {
    upload = await uploadEtdDocument({
      workflow: 'PRESHIPMENT',
      file: pdf,
      fileName: `commercial_invoice_${referenceId}.pdf`,
      referenceId,
      sandbox: true,
      accessToken: token,
    })
  } catch (err) {
    console.error('  ❌ Upload Documents 호출 실패:', (err as Error).message)
    return { ok: false, stage: 'upload', error: (err as Error).message }
  }

  const docId = upload.documentStatuses[0]?.documentId
  console.log(`  ✅ docID: ${docId ?? '(없음)'} status=${upload.documentStatuses[0]?.status}`)
  if (!docId) {
    return { ok: false, stage: 'upload', upload }
  }

  // 2) Ship 에 attachedDocuments 로 연결
  const etd = buildShipPreshipmentAttachment([{
    documentType: 'COMMERCIAL_INVOICE',
    documentId: docId,
    documentReference: referenceId,
    description: 'Commercial Invoice',
    fileName: `commercial_invoice_${referenceId}.pdf`,
  }])

  const ship = await shipApi(token, {
    labelResponseOptions: 'LABEL',
    accountNumber: { value: ACCOUNT },
    requestedShipment: {
      ...commonShipShared(referenceId),
      shipmentSpecialServices: etd,
    },
  })

  if (ship.status >= 400) {
    console.error(`  ❌ Ship API ${ship.status}`)
    console.error(JSON.stringify(ship.body, null, 2).slice(0, 1500))
    return { ok: false, stage: 'ship', referenceId, docId, ship }
  }

  const master = ship.body.output?.transactionShipments?.[0]?.masterTrackingNumber
  console.log(`  ✅ Ship OK — masterTracking=${master}`)
  return { ok: true, referenceId, docId, masterTrackingNumber: master, uploadResponse: upload, shipResponse: ship.body }
}

async function scenario2(token: string) {
  console.log('\n=== 시나리오 2 — Ship 먼저 → ETD 사후 업로드 ===')
  const referenceId = `OMO-2371-POST-${Date.now().toString(36)}`

  // 1) ETD 사후 업로드 의도를 발송 생성에 미리 선언
  //   FedEx 가 ELECTRONIC_TRADE_DOCUMENTS 요청 시 어떤 통관 서류가 동봉될지 알기 위해
  //   shippingDocumentSpecification.shippingDocumentTypes 도 함께 선언해야 한다.
  const etd = buildShipPostshipmentEtdDetail(['COMMERCIAL_INVOICE'])
  const ship = await shipApi(token, {
    labelResponseOptions: 'LABEL',
    accountNumber: { value: ACCOUNT },
    requestedShipment: {
      ...commonShipShared(referenceId),
      shipmentSpecialServices: etd,
      shippingDocumentSpecification: {
        shippingDocumentTypes: ['COMMERCIAL_INVOICE'],
        commercialInvoiceDetail: {
          documentFormat: { stockType: 'PAPER_LETTER', docType: 'PDF' },
        },
      },
    },
  })

  if (ship.status >= 400) {
    console.error(`  ❌ Ship API ${ship.status}`)
    console.error(JSON.stringify(ship.body, null, 2).slice(0, 1500))
    return { ok: false, stage: 'ship', referenceId, ship }
  }

  const master = ship.body.output?.transactionShipments?.[0]?.masterTrackingNumber
  console.log(`  ✅ Ship OK — masterTracking=${master}`)
  if (!master) return { ok: false, stage: 'ship', referenceId, shipResponse: ship.body }

  // 2) Upload Documents — trackingNumber 로 연결
  const pdf = buildSampleInvoicePdf()
  let upload
  try {
    upload = await uploadEtdDocument({
      workflow: 'POSTSHIPMENT',
      file: pdf,
      fileName: `commercial_invoice_${master}.pdf`,
      referenceId,
      documentType: 'COMMERCIAL_INVOICE',
      trackingNumber: master,
      sandbox: true,
      accessToken: token,
    })
  } catch (err) {
    console.error('  ❌ Upload Documents 호출 실패:', (err as Error).message)
    return {
      ok: false,
      stage: 'upload',
      referenceId,
      masterTrackingNumber: master,
      error: (err as Error).message,
      shipResponse: ship.body,
    }
  }

  console.log(`  ✅ Upload status=${upload.documentStatuses[0]?.status} docID=${upload.documentStatuses[0]?.documentId ?? 'n/a'}`)
  return { ok: true, referenceId, masterTrackingNumber: master, uploadResponse: upload, shipResponse: ship.body }
}

;(async () => {
  const token = await tok()
  console.log('✅ Sandbox OAuth OK')

  const r1 = await scenario1(token)
  writeFileSync(
    'public/fedex-status/etd-scenario1-result.json',
    JSON.stringify({ capturedAt: new Date().toISOString(), sandbox: true, ...r1 }, null, 2),
  )

  const r2 = await scenario2(token)
  writeFileSync(
    'public/fedex-status/etd-scenario2-result.json',
    JSON.stringify({ capturedAt: new Date().toISOString(), sandbox: true, ...r2 }, null, 2),
  )

  console.log('\n=== 요약 ===')
  console.log(`  시나리오 1: ${r1.ok ? '✅ 성공' : `❌ 실패 @${r1.stage}`}`)
  console.log(`  시나리오 2: ${r2.ok ? '✅ 성공' : `❌ 실패 @${r2.stage}`}`)
  if (!r1.ok || !r2.ok) process.exitCode = 1
})()
