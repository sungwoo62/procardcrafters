// OMO-2371 — 자동 E2E 테스트: 실제 운영자가 하는 것처럼.
//
// "운영자가 송장 row 만들고 [FedEx 라벨 생성] 클릭" 시나리오를 in-process 로 재현한다.
// - 실제 운영 코드 (`createFedexShipment` from `src/lib/fedex-api.ts`) 를 호출
// - 단, 토큰/계정은 sandbox 키로 덮어써서 실제 청구 없는 안전한 환경에서 검증
// - 결과: master tracking + label PDF + invoice PDF (ETD 자동 첨부) 를 디스크에 저장
//
// 실행: npx tsx scripts/test-fedex-create-label-e2e.ts
//
// 산출물
//   public/fedex-status/e2e-label-<master>.pdf
//   public/fedex-status/e2e-invoice-<master>.pdf
//   public/fedex-status/e2e-result.json

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

for (const line of readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

// 운영 fedex-api.ts 가 읽는 env 를 sandbox 값으로 덮어쓴다 (실제 청구 없도록)
process.env.FEDEX_CLIENT_ID       = process.env.FEDEX_SANDBOX_CLIENT_ID
process.env.FEDEX_CLIENT_SECRET   = process.env.FEDEX_SANDBOX_CLIENT_SECRET
process.env.FEDEX_ACCOUNT_NUMBER  = process.env.FEDEX_SANDBOX_ACCOUNT_NUMBER
process.env.FEDEX_API_BASE        = process.env.FEDEX_SANDBOX_API_BASE

const orderNumber = `PCCF-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-E2E${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`

;(async () => {
  const { createFedexShipment } = await import('../src/lib/fedex-api')

  const start = Date.now()
  console.log(`▶ E2E 라벨 생성 시작 (주문 ${orderNumber})`)

  try {
    // KR(부천) → JP(도쿄), 명함 500매 + 전단지 200매, 1.2kg
    const result = await createFedexShipment({
      serviceType: 'INTERNATIONAL_PRIORITY',
      recipient: {
        personName: 'Takeshi Yamamoto',
        phoneNumber: '0312345678',
        companyName: 'YAMAMOTO TRADING',
        streetLines: ['1-1-1 Chiyoda', 'Suite 502'],
        city: 'TOKYO',
        stateOrProvinceCode: '',
        postalCode: '100-0001',
        countryCode: 'JP',
      },
      packageWeightKg: 1.2,
      packageLengthCm: 30,
      packageWidthCm: 22,
      packageHeightCm: 5,
      customerReference: orderNumber,
      commodities: [
        {
          description: 'Printed Business Cards 90x54mm',
          countryOfManufacture: 'KR',
          quantity: 500, quantityUnits: 'PCS',
          unitPriceUsd: 0.03, customsValueUsd: 15.0,
          weightKg: 0.7, harmonizedCode: '491110', numberOfPieces: 500,
        },
        {
          description: 'Printed Flyers A5',
          countryOfManufacture: 'KR',
          quantity: 200, quantityUnits: 'PCS',
          unitPriceUsd: 0.05, customsValueUsd: 10.0,
          weightKg: 0.5, harmonizedCode: '491110', numberOfPieces: 200,
        },
      ],
      includeAutoEtdInvoice: true,
    })

    const elapsedMs = Date.now() - start
    const master = result.masterTrackingNumber
    const labelBytes   = result.labelPdf   ? result.labelPdf.length   : 0
    const invoiceBytes = result.invoicePdf ? result.invoicePdf.length : 0

    if (result.labelPdf)   writeFileSync(`public/fedex-status/e2e-label-${master}.pdf`,   result.labelPdf)
    if (result.invoicePdf) writeFileSync(`public/fedex-status/e2e-invoice-${master}.pdf`, result.invoicePdf)

    const summary = {
      capturedAt: new Date().toISOString(),
      sandbox: true,
      orderNumber,
      elapsedMs,
      masterTrackingNumber: master,
      serviceType: result.serviceType,
      serviceName: result.serviceName,
      labelPdfBytes: labelBytes,
      invoicePdfBytes: invoiceBytes,
      etdInvoiceAttached: Boolean(result.invoicePdf),
      artifacts: {
        label:   result.labelPdf   ? `public/fedex-status/e2e-label-${master}.pdf`   : null,
        invoice: result.invoicePdf ? `public/fedex-status/e2e-invoice-${master}.pdf` : null,
      },
    }
    writeFileSync('public/fedex-status/e2e-result.json', JSON.stringify(summary, null, 2))

    console.log('\n=== E2E 결과 ===')
    console.log(`  주문번호:        ${orderNumber}`)
    console.log(`  master tracking: ${master}`)
    console.log(`  service:         ${result.serviceType} (${result.serviceName ?? '—'})`)
    console.log(`  label PDF:       ${labelBytes.toLocaleString()} bytes`)
    console.log(`  invoice PDF:     ${invoiceBytes.toLocaleString()} bytes  ${result.invoicePdf ? '✅ ETD 자동 첨부' : '❌ 첨부 안됨'}`)
    console.log(`  elapsed:         ${elapsedMs}ms`)
    console.log(`  artifacts:`)
    console.log(`    ${summary.artifacts.label   ?? '(라벨 없음)'}`)
    console.log(`    ${summary.artifacts.invoice ?? '(invoice 없음)'}`)

    if (!result.labelPdf || !result.invoicePdf) {
      console.error('\n❌ 라벨 또는 invoice 가 누락되었습니다.')
      process.exit(1)
    }
    console.log('\n✅ E2E 통과 — 운영자가 [FedEx 라벨 생성] 누르면 동일한 결과')
  } catch (err) {
    console.error('\n❌ E2E 실패:', (err as Error).message)
    writeFileSync('public/fedex-status/e2e-result.json', JSON.stringify({
      capturedAt: new Date().toISOString(),
      sandbox: true,
      orderNumber,
      error: (err as Error).message,
    }, null, 2))
    process.exit(1)
  }
})()
