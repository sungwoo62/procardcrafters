// OMO-2908: PAYPAL_API_URL 이 빈 문자열("")로 설정된 경우 `??` 는 빈 값을 그대로
// 통과시켜 BASE_URL 이 ""가 되고 모든 PayPal 호출이 깨진다. 공백/빈값은 미설정으로
// 보고 샌드박스 기본값으로 폴백한다(Live 는 명시적으로 api-m.paypal.com 주입).
const BASE_URL = process.env.PAYPAL_API_URL?.trim() || 'https://api-m.sandbox.paypal.com'

export async function getAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID ?? process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID
  const secret = process.env.PAYPAL_SECRET
  if (!clientId || !secret) {
    throw new Error('PayPal credentials are not configured (PAYPAL_CLIENT_ID / PAYPAL_SECRET)')
  }
  const credentials = Buffer.from(`${clientId}:${secret}`).toString('base64')

  const res = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!res.ok) {
    throw new Error('Failed to obtain PayPal access token')
  }

  const data = await res.json()
  return data.access_token as string
}

export async function createPaypalOrder(amountUsd: number, description: string): Promise<string> {
  const token = await getAccessToken()

  // 카드 명세서에 표기되는 가맹점명(soft descriptor).
  // PayPal 은 자동으로 "PAYPAL *" 접두사를 붙이며 최대 22자, 영문/숫자/공백만 허용.
  // 미설정 시 PayPal 계정 기본 사업자명이 사용된다.
  const rawDescriptor = process.env.PAYPAL_SOFT_DESCRIPTOR?.trim()
  const softDescriptor = rawDescriptor
    ? rawDescriptor.replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 22)
    : undefined

  const purchaseUnit: {
    amount: { currency_code: string; value: string }
    description: string
    soft_descriptor?: string
  } = {
    amount: {
      currency_code: 'USD',
      value: amountUsd.toFixed(2),
    },
    description,
  }
  if (softDescriptor) {
    purchaseUnit.soft_descriptor = softDescriptor
  }

  const res = await fetch(`${BASE_URL}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [purchaseUnit],
    }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Failed to create PayPal order: ${JSON.stringify(err)}`)
  }

  const data = await res.json()
  return data.id as string
}

export async function capturePaypalOrder(paypalOrderId: string): Promise<{
  status: string
  payerId: string | null
  amount: string | null
}> {
  const token = await getAccessToken()

  const res = await fetch(`${BASE_URL}/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Failed to capture PayPal order: ${JSON.stringify(err)}`)
  }

  const data = await res.json()
  const capture = data.purchase_units?.[0]?.payments?.captures?.[0]

  return {
    status: data.status as string,
    payerId: data.payer?.payer_id ?? null,
    amount: capture?.amount?.value ?? null,
  }
}

// OMO-2909: PayPal 서버 웹훅 서명검증.
// PayPal Developer Dashboard 에서 웹훅 등록 후 발급되는 webhook id 를
// PAYPAL_WEBHOOK_ID 로 주입해야 한다. 미설정 시 위조 이벤트를 차단하기 위해 throw.
export async function verifyPaypalWebhookSignature(
  headers: {
    authAlgo: string | null
    certUrl: string | null
    transmissionId: string | null
    transmissionSig: string | null
    transmissionTime: string | null
  },
  rawBody: string,
): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID
  if (!webhookId) {
    throw new Error('PAYPAL_WEBHOOK_ID is not configured')
  }
  if (
    !headers.authAlgo ||
    !headers.certUrl ||
    !headers.transmissionId ||
    !headers.transmissionSig ||
    !headers.transmissionTime
  ) {
    return false
  }

  const token = await getAccessToken()

  const res = await fetch(`${BASE_URL}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      auth_algo: headers.authAlgo,
      cert_url: headers.certUrl,
      transmission_id: headers.transmissionId,
      transmission_sig: headers.transmissionSig,
      transmission_time: headers.transmissionTime,
      webhook_id: webhookId,
      webhook_event: JSON.parse(rawBody),
    }),
  })

  if (!res.ok) {
    return false
  }

  const data = await res.json()
  return data.verification_status === 'SUCCESS'
}
