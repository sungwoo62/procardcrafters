// OMO-3736 — FedEx 테스트 라벨(ZPL) 생성 API
//
// 관리자 로그인 없이 /fedex-status/test-label 페이지에서 호출. 단, FedEx 실 발송을
// 만드는 호출이므로 secret key 게이트로 보호한다 (FEDEX_TEST_LABEL_KEY env).
// 라벨은 항상 ZPLII 강제 → FedEx가 준 raw ZPL 버퍼를 그대로 반환(이미지 변환 없음).

import { NextRequest, NextResponse } from 'next/server'
import { createFedexShipment } from '@/lib/fedex-api'

export const dynamic = 'force-dynamic'

// FedEx 인증 제출용 고정 테스트 수취인 (FedEx 본사, 멤피스 TN).
const TEST_RECIPIENT = {
  personName: 'FEDEX CERT TEST',
  phoneNumber: '9013693600',
  companyName: 'FEDEX',
  streetLines: ['3610 Hacks Cross Rd'],
  city: 'Memphis',
  stateOrProvinceCode: 'TN',
  postalCode: '38125',
  countryCode: 'US',
}

export async function POST(req: NextRequest) {
  const expected = process.env.FEDEX_TEST_LABEL_KEY
  if (!expected) {
    return NextResponse.json({ error: 'FEDEX_TEST_LABEL_KEY 미설정 — 서버 env 필요' }, { status: 503 })
  }
  const key = req.nextUrl.searchParams.get('key') || req.headers.get('x-test-label-key')
  if (key !== expected) {
    return NextResponse.json({ error: '잘못된 키' }, { status: 401 })
  }

  try {
    const ref = `CERT-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}`
    const result = await createFedexShipment({
      serviceType: 'INTERNATIONAL_PRIORITY',
      recipient: TEST_RECIPIENT,
      packageWeightKg: 0.5,
      packageLengthCm: 20,
      packageWidthCm: 15,
      packageHeightCm: 5,
      customerReference: ref,
      labelImageType: 'ZPLII',          // 항상 ZPL 강제
      sandbox: true,                    // 인증/테스트 환경 (실 청구·발송 없음)
      includeAutoEtdInvoice: false,     // 인증은 라벨만 — ETD invoice 불필요
      commodities: [{
        description: 'Printed business cards (sample)',
        countryOfManufacture: 'KR',
        quantity: 1,
        quantityUnits: 'PCS',
        unitPriceUsd: 10,
        customsValueUsd: 10,
        weightKg: 0.5,
        harmonizedCode: '491110',
        numberOfPieces: 1,
      }],
    })

    if (!result.labelPdf || result.labelFormat !== 'zpl') {
      return NextResponse.json(
        { error: `ZPL 라벨 미생성 (format=${result.labelFormat})`, trackingNumber: result.masterTrackingNumber },
        { status: 502 },
      )
    }

    let zpl = result.labelPdf.toString('utf8')
    // OMO-3736 — '느리게 인쇄' 옵션: 인쇄 속도(^PR)만 최저로 낮춰 저가 써멀의 2D 바코드 공백을 줄인다.
    // 라벨/바코드 데이터는 일절 건드리지 않음(인쇄 메커니즘 파라미터만). FedEx 다크니스는 이미 ^MD30(최대).
    const slow = req.nextUrl.searchParams.get('slow') === '1'
    if (slow) zpl = zpl.replace(/\^PR\d+(,\d+)*/g, '^PR2,2,2')

    return NextResponse.json({
      ok: true,
      zpl,
      slow,
      trackingNumber: result.masterTrackingNumber,
      serviceType: result.serviceType,
      reference: ref,
      bytes: zpl.length,
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
