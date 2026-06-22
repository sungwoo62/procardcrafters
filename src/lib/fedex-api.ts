// FedEx Rate API 클라이언트
//
// Docs: https://developer.fedex.com/api/en-us/catalog/rate.html
// 인증: OAuth 2.0 client_credentials grant
// 운임: POST /rate/v1/rates/quotes  → 우리 account 의 계약 할인 적용된 실시간 요율
//
// 환경 변수
//   FEDEX_CLIENT_ID       — Developer Portal production credentials
//   FEDEX_CLIENT_SECRET
//   FEDEX_ACCOUNT_NUMBER  — 210839884 (계약 계정)
//   FEDEX_API_BASE        — (선택) 기본 https://apis.fedex.com (운영)
//                           샌드박스: https://apis-sandbox.fedex.com
//
// 자격 미설정 시 호출자가 DB-based fallback 으로 분기해야 함 (lib/shipping.ts 가 처리).

interface OAuthToken {
  access_token: string
  expires_at: number   // epoch ms
}

// OMO-3458: 계약 계정이 복수가 될 수 있어(신 211340858 + 구 210839884) 토큰을 client_id 별로 캐시.
const tokenCache = new Map<string, OAuthToken>()
const TOKEN_REFRESH_MARGIN_MS = 60_000

function getBaseUrl(): string {
  return process.env.FEDEX_API_BASE ?? 'https://apis.fedex.com'
}

// OMO-3458: 계약 계정 프로파일. FedEx OAuth 자격증명은 특정 계정번호에 귀속되므로
// (키↔계정 1:1) 신/구 계약을 모두 쓰려면 프로파일을 각각 구성한다.
export interface FedexCredentialProfile {
  clientId: string
  clientSecret: string
  account: string
  label: string          // 'primary'(신계약) | 'legacy'(구계약)
}

function primaryProfile(): FedexCredentialProfile | null {
  const clientId = process.env.FEDEX_CLIENT_ID
  const clientSecret = process.env.FEDEX_CLIENT_SECRET
  const account = process.env.FEDEX_ACCOUNT_NUMBER
  return clientId && clientSecret && account ? { clientId, clientSecret, account, label: 'primary' } : null
}

// 구 계약(기존 고객코드+API 키). 설정돼 있을 때만 신/구 비교에 합류한다.
function legacyProfile(): FedexCredentialProfile | null {
  const clientId = process.env.FEDEX_LEGACY_CLIENT_ID
  const clientSecret = process.env.FEDEX_LEGACY_CLIENT_SECRET
  const account = process.env.FEDEX_LEGACY_ACCOUNT_NUMBER
  return clientId && clientSecret && account ? { clientId, clientSecret, account, label: 'legacy' } : null
}

/** 구성된 모든 계약 프로파일(신계약 우선, 구계약은 설정 시 추가). */
export function getFedexProfiles(): FedexCredentialProfile[] {
  return [primaryProfile(), legacyProfile()].filter((p): p is FedexCredentialProfile => p !== null)
}

export function isFedexApiConfigured(): boolean {
  return primaryProfile() !== null
}

async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const now = Date.now()
  const cached = tokenCache.get(clientId)
  if (cached && cached.expires_at - now > TOKEN_REFRESH_MARGIN_MS) {
    return cached.access_token
  }

  const res = await fetch(`${getBaseUrl()}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`FedEx OAuth failed: ${res.status} ${text}`)
  }

  const data = (await res.json()) as { access_token: string; expires_in: number }
  const token: OAuthToken = {
    access_token: data.access_token,
    expires_at: now + (data.expires_in - 60) * 1000,
  }
  tokenCache.set(clientId, token)
  return token.access_token
}

export interface FedexRateInput {
  recipientCountryCode: string
  recipientPostalCode: string
  recipientCity: string
  recipientStateCode?: string
  weightKg: number
  lengthCm?: number
  widthCm?: number
  heightCm?: number
  declaredValueUsd?: number
  preferredService?: 'INTERNATIONAL_PRIORITY' | 'INTERNATIONAL_ECONOMY'
}

export interface FedexRateOption {
  serviceType: string                // 'INTERNATIONAL_PRIORITY' 등
  serviceName: string                // 'FedEx International Priority®'
  totalNetCharge: number             // 우리 계약 할인 적용된 최종 청구액
  currency: string
  deliveryDayOfWeek?: string
  deliveryTimestamp?: string
  surchargeTotal?: number
  baseCharge?: number
  discountTotal?: number
}

export interface FedexRateResult {
  options: FedexRateOption[]
  alerts: { code: string; message: string }[]
  cheapest: FedexRateOption | null
}

/**
 * 한국(KR) 발 → 임의 국가행 실시간 요율 견적.
 * shipper 는 계약 계정 주소 사용.
 */
export async function fetchFedexRates(input: FedexRateInput, profile?: FedexCredentialProfile): Promise<FedexRateResult> {
  const prof = profile ?? primaryProfile()
  if (!prof) {
    throw new Error('FedEx API not configured (FEDEX_CLIENT_ID / FEDEX_CLIENT_SECRET / FEDEX_ACCOUNT_NUMBER required)')
  }

  const token = await getAccessToken(prof.clientId, prof.clientSecret)
  const account = prof.account

  const recipientCountry = input.recipientCountryCode.toUpperCase()
  const shipperCountry = 'KR'
  const isInternational = recipientCountry !== shipperCountry
  const weightKg = Math.max(0.1, input.weightKg)
  const declaredValueUsd = input.declaredValueUsd ?? 10

  // FedEx 는 kg 또는 lb 단위 받음. cm 도 그대로 사용.
  const body = {
    accountNumber: { value: account },
    rateRequestControlParameters: {
      returnTransitTimes: true,
      servicesNeededOnRateFailure: true,
      rateSortOrder: 'COMMITASCENDING',
    },
    requestedShipment: {
      shipper: {
        address: {
          postalCode: '14488',
          countryCode: shipperCountry,
          city: 'BUCHEON',
          stateOrProvinceCode: '',
        },
      },
      recipient: {
        address: {
          postalCode: input.recipientPostalCode || '00000',
          countryCode: recipientCountry,
          city: input.recipientCity || 'CITY',
          stateOrProvinceCode: input.recipientStateCode ?? '',
        },
      },
      pickupType: 'USE_SCHEDULED_PICKUP',
      ...(input.preferredService ? { serviceType: input.preferredService } : {}),
      rateRequestType: ['ACCOUNT', 'LIST'],
      preferredCurrency: 'USD',
      // 국제 배송은 customs clearance detail 필수 (없으면 RATE.CUSTOMCLEARANCEDETAIL.INVALID)
      ...(isInternational
        ? {
            customsClearanceDetail: {
              dutiesPayment: { paymentType: 'SENDER' },
              commodities: [
                {
                  description: 'Printed marketing materials',
                  countryOfManufacture: shipperCountry,
                  quantity: 1,
                  quantityUnits: 'PCS',
                  unitPrice: { amount: declaredValueUsd, currency: 'USD' },
                  customsValue: { amount: declaredValueUsd, currency: 'USD' },
                  weight: { units: 'KG', value: weightKg },
                  harmonizedCode: '491110', // 인쇄 광고물 기본
                },
              ],
            },
          }
        : {}),
      requestedPackageLineItems: [
        {
          weight: { units: 'KG', value: weightKg },
          ...(input.lengthCm && input.widthCm && input.heightCm
            ? {
                dimensions: {
                  length: Math.round(input.lengthCm),
                  width: Math.round(input.widthCm),
                  height: Math.round(input.heightCm),
                  units: 'CM',
                },
              }
            : {}),
          ...(input.declaredValueUsd
            ? { declaredValue: { amount: input.declaredValueUsd, currency: 'USD' } }
            : {}),
        },
      ],
    },
  }

  const res = await fetch(`${getBaseUrl()}/rate/v1/rates/quotes`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-locale': 'en_US',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`FedEx Rate API failed: ${res.status} ${text}`)
  }

  const data = (await res.json()) as FedexRateRawResponse
  return parseRateResponse(data)
}

interface FedexRateRawResponse {
  output?: {
    rateReplyDetails?: FedexRawReplyDetail[]
    alerts?: { code: string; message: string }[]
  }
}

interface FedexRawReplyDetail {
  serviceType: string
  serviceName: string
  commit?: { dateDetail?: { dayOfWeek?: string; dayCxsFormat?: string } }
  ratedShipmentDetails: {
    rateType: string  // 'ACCOUNT' 우선 (= 우리 계약가)
    totalNetCharge: number
    currency: string
    totalSurcharges?: number
    totalBaseCharge?: number
    totalDiscounts?: number
  }[]
}

function parseRateResponse(data: FedexRateRawResponse): FedexRateResult {
  const reply = data.output?.rateReplyDetails ?? []
  const options: FedexRateOption[] = []

  for (const detail of reply) {
    // ACCOUNT (계약가) 우선, 없으면 LIST
    const rated =
      detail.ratedShipmentDetails.find((r) => r.rateType === 'ACCOUNT') ??
      detail.ratedShipmentDetails.find((r) => r.rateType === 'PAYOR_ACCOUNT_PACKAGE') ??
      detail.ratedShipmentDetails[0]
    if (!rated) continue

    options.push({
      serviceType: detail.serviceType,
      serviceName: detail.serviceName,
      totalNetCharge: rated.totalNetCharge,
      currency: rated.currency,
      deliveryDayOfWeek: detail.commit?.dateDetail?.dayOfWeek,
      surchargeTotal: rated.totalSurcharges,
      baseCharge: rated.totalBaseCharge,
      discountTotal: rated.totalDiscounts,
    })
  }

  options.sort((a, b) => a.totalNetCharge - b.totalNetCharge)
  return {
    options,
    alerts: data.output?.alerts ?? [],
    cheapest: options[0] ?? null,
  }
}

/**
 * OMO-3458: 서비스별로 여러 계약(신/구) 결과 중 **가장 싼 요율**만 골라 합친다.
 * 런던처럼 구계약이 더 싼 구간 + 미국처럼 신계약이 더 싼 구간을 국가·서비스 단위로 cherry-pick.
 * (모든 KR-출발 계약 계정은 KRW 응답이라 totalNetCharge 직접 비교 가능.)
 */
export function mergeCheapestByService(results: FedexRateResult[]): FedexRateResult {
  const best = new Map<string, FedexRateOption>()
  const alerts: { code: string; message: string }[] = []
  for (const r of results) {
    for (const opt of r.options) {
      const cur = best.get(opt.serviceType)
      if (!cur || opt.totalNetCharge < cur.totalNetCharge) best.set(opt.serviceType, opt)
    }
    alerts.push(...r.alerts)
  }
  const options = [...best.values()].sort((a, b) => a.totalNetCharge - b.totalNetCharge)
  return { options, alerts, cheapest: options[0] ?? null }
}

/**
 * OMO-3458: 구성된 모든 계약 프로파일(신+구)을 병렬 조회해 서비스별 최저가로 합친 결과.
 * 구계약(legacy) 프로파일이 설정돼 있지 않으면 신계약 단독 결과와 동일(기존 동작 보존).
 * 한 프로파일이 실패해도(미연결/오류) 나머지로 견적을 낸다.
 */
export async function fetchFedexRatesCheapest(input: FedexRateInput): Promise<FedexRateResult> {
  const profiles = getFedexProfiles()
  if (profiles.length === 0) {
    throw new Error('FedEx API not configured (FEDEX_CLIENT_ID / FEDEX_CLIENT_SECRET / FEDEX_ACCOUNT_NUMBER required)')
  }
  const settled = await Promise.all(
    profiles.map(async (p) => {
      try {
        return await fetchFedexRates(input, p)
      } catch {
        return null // 한 계약이 실패해도 다른 계약으로 견적 (silent)
      }
    }),
  )
  const ok = settled.filter((r): r is FedexRateResult => r !== null)
  if (ok.length === 0) throw new Error('FedEx Rate API failed for all profiles')
  return mergeCheapestByService(ok)
}

// ====================================================================
// Ship API — 실제 라벨/송장 PDF 생성 (OMO-2371: ETD 자동 첨부)
// ====================================================================

export interface FedexShipInput {
  serviceType: 'INTERNATIONAL_PRIORITY' | 'INTERNATIONAL_ECONOMY' | 'INTERNATIONAL_PRIORITY_EXPRESS'
  recipient: {
    personName: string
    phoneNumber: string
    companyName?: string
    streetLines: string[]
    city: string
    stateOrProvinceCode?: string
    postalCode: string
    countryCode: string
  }
  packageWeightKg: number
  packageLengthCm?: number
  packageWidthCm?: number
  packageHeightCm?: number
  customerReference: string                 // 주문번호 etc
  commodities: {
    description: string
    countryOfManufacture: string
    quantity: number
    quantityUnits?: string
    unitPriceUsd: number
    customsValueUsd: number
    weightKg: number
    harmonizedCode?: string
    numberOfPieces?: number
  }[]
  /** ELECTRONIC_TRADE_DOCUMENTS 자동 invoice 첨부 여부 (기본 true, 국제만) */
  includeAutoEtdInvoice?: boolean
}

export interface FedexShipResult {
  masterTrackingNumber: string
  serviceType: string
  serviceName?: string
  /** 라벨 원본 바이트. PDF(레이저/잉크젯) 또는 ZPL(써멀 프린터) — labelFormat 으로 구분. 절대 이미지로 재렌더하지 않음 (FedEx 인증 요구사항). */
  labelPdf: Buffer | null
  /** 'pdf' = PAPER_4X6 PDF, 'zpl' = ZPLII raw buffer (써멀 프린터에 그대로 전송) */
  labelFormat: 'pdf' | 'zpl'
  invoicePdf: Buffer | null                  // ELECTRONIC_TRADE_DOCUMENTS — Commercial Invoice
  raw: unknown
}

/**
 * 실제 발송 라벨 생성. 국제 발송 시 ETD (Electronic Trade Documents) 로 Commercial Invoice 자동 첨부.
 *
 * OMO-2371 — buildAutoInvoiceEtd() 스프레드 사용.
 */
export async function createFedexShipment(input: FedexShipInput): Promise<FedexShipResult> {
  if (!isFedexApiConfigured()) {
    throw new Error('FedEx API not configured')
  }

  const { buildAutoInvoiceEtd } = await import('@/lib/fedex-etd')

  const token = await getAccessToken(process.env.FEDEX_CLIENT_ID!, process.env.FEDEX_CLIENT_SECRET!)
  const account = process.env.FEDEX_ACCOUNT_NUMBER!
  const isInternational = input.recipient.countryCode.toUpperCase() !== 'KR'
  const includeEtd = isInternational && (input.includeAutoEtdInvoice ?? true)

  // OMO-3736 — 라벨 포맷 env 게이트. 기본 PDF(레이저/잉크젯). 써멀 프린터(Zebra) 인증 시 FEDEX_LABEL_IMAGE_TYPE=ZPLII.
  // ZPLII 선택 시 FedEx 가 반환한 ZPL 버퍼를 그대로 저장·전송한다 (이미지로 재렌더 금지 — FedEx 인증 거부 사유).
  const rawImageType = (process.env.FEDEX_LABEL_IMAGE_TYPE ?? 'PDF').toUpperCase()
  const useZpl = rawImageType === 'ZPLII' || rawImageType === 'ZPL'
  // 써멀 라벨 기본 stock 은 STOCK_4X6 (PDF 는 PAPER_4X6). env 로 override 가능.
  const labelStockType = process.env.FEDEX_LABEL_STOCK_TYPE ?? (useZpl ? 'STOCK_4X6' : 'PAPER_4X6')

  const body: Record<string, unknown> = {
    labelResponseOptions: 'LABEL',
    accountNumber: { value: account },
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
          personName: input.recipient.personName,
          phoneNumber: input.recipient.phoneNumber,
          companyName: input.recipient.companyName ?? input.recipient.personName,
        },
        address: {
          streetLines: input.recipient.streetLines,
          city: input.recipient.city,
          stateOrProvinceCode: input.recipient.stateOrProvinceCode ?? '',
          postalCode: input.recipient.postalCode,
          countryCode: input.recipient.countryCode,
        },
      }],
      shipDatestamp: new Date().toISOString().slice(0, 10),
      serviceType: input.serviceType,
      packagingType: 'YOUR_PACKAGING',
      pickupType: 'USE_SCHEDULED_PICKUP',
      blockInsightVisibility: false,
      shippingChargesPayment: {
        paymentType: 'SENDER',
        payor: { responsibleParty: { accountNumber: { value: account } } },
      },
      labelSpecification: {
        labelFormatType: 'COMMON2D',
        imageType: useZpl ? 'ZPLII' : 'PDF',
        labelStockType,
      },
      ...(isInternational ? {
        customsClearanceDetail: {
          dutiesPayment: {
            paymentType: 'SENDER',
            payor: { responsibleParty: { accountNumber: { value: account } } },
          },
          isDocumentOnly: false,
          commercialInvoice: { shipmentPurpose: 'SOLD' },
          commodities: input.commodities.map((c) => ({
            description: c.description,
            countryOfManufacture: c.countryOfManufacture,
            quantity: c.quantity,
            quantityUnits: c.quantityUnits ?? 'PCS',
            unitPrice: { amount: c.unitPriceUsd, currency: 'USD' },
            customsValue: { amount: c.customsValueUsd, currency: 'USD' },
            weight: { units: 'KG', value: c.weightKg },
            ...(c.harmonizedCode ? { harmonizedCode: c.harmonizedCode } : {}),
            numberOfPieces: c.numberOfPieces ?? 1,
          })),
        },
      } : {}),
      requestedPackageLineItems: [{
        sequenceNumber: 1,
        weight: { units: 'KG', value: Math.max(0.1, input.packageWeightKg) },
        ...(input.packageLengthCm && input.packageWidthCm && input.packageHeightCm
          ? { dimensions: {
              length: Math.round(input.packageLengthCm),
              width: Math.round(input.packageWidthCm),
              height: Math.round(input.packageHeightCm),
              units: 'CM',
            } }
          : {}),
        customerReferences: [{ customerReferenceType: 'CUSTOMER_REFERENCE', value: input.customerReference }],
      }],
      ...(includeEtd ? buildAutoInvoiceEtd() : {}),
    },
  }

  const res = await fetch(`${getBaseUrl()}/ship/v1/shipments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-locale': 'en_US',
    },
    body: JSON.stringify(body),
  })

  const text = await res.text()
  let data: unknown
  try { data = JSON.parse(text) } catch { data = { raw: text.slice(0, 500) } }

  if (!res.ok) {
    throw new Error(`FedEx Ship API failed: ${res.status} ${text.slice(0, 500)}`)
  }

  interface ShipRaw {
    output?: {
      transactionShipments?: Array<{
        masterTrackingNumber?: string
        serviceType?: string
        serviceName?: string
        pieceResponses?: Array<{ packageDocuments?: Array<{ contentType?: string; encodedLabel?: string }> }>
        shipmentDocuments?: Array<{ contentType?: string; encodedLabel?: string }>
      }>
    }
  }
  const d = data as ShipRaw
  const ts = d.output?.transactionShipments?.[0]
  if (!ts?.masterTrackingNumber) {
    throw new Error(`FedEx Ship API: masterTrackingNumber missing — ${text.slice(0, 300)}`)
  }

  const labelDoc = ts.pieceResponses?.[0]?.packageDocuments?.find((p) => p.contentType === 'LABEL')
  const invoiceDoc = ts.shipmentDocuments?.find((s) => s.contentType === 'COMMERCIAL_INVOICE')

  // base64 디코드 = 라벨 원본 바이트. ZPLII 면 그 자체가 thermal 프린터용 raw ZPL 스크립트 (^XA…^XZ). 재렌더 없음.
  return {
    masterTrackingNumber: ts.masterTrackingNumber,
    serviceType: ts.serviceType ?? input.serviceType,
    serviceName: ts.serviceName,
    labelPdf: labelDoc?.encodedLabel ? Buffer.from(labelDoc.encodedLabel, 'base64') : null,
    labelFormat: useZpl ? 'zpl' : 'pdf',
    invoicePdf: invoiceDoc?.encodedLabel ? Buffer.from(invoiceDoc.encodedLabel, 'base64') : null,
    raw: data,
  }
}

// FedEx serviceType ↔ 내부 서비스 코드 매핑
export function fedexServiceToInternalCode(serviceType: string): string {
  const map: Record<string, string> = {
    INTERNATIONAL_PRIORITY:           'fedex_ip',
    INTERNATIONAL_ECONOMY:            'fedex_ie',
    INTERNATIONAL_PRIORITY_EXPRESS:   'fedex_ipe',
    FEDEX_INTERNATIONAL_PRIORITY:     'fedex_ip',
    FEDEX_INTERNATIONAL_ECONOMY:      'fedex_ie',
    FEDEX_INTERNATIONAL_CONNECT_PLUS: 'fedex_icp',
    INTERNATIONAL_FIRST:              'fedex_ipe',
  }
  return map[serviceType] ?? `fedex_${serviceType.toLowerCase()}`
}
