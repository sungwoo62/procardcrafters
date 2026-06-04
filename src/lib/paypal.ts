const BASE_URL = process.env.PAYPAL_API_URL ?? 'https://api-m.sandbox.paypal.com'

async function getAccessToken(): Promise<string> {
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

  const res = await fetch(`${BASE_URL}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: 'USD',
            value: amountUsd.toFixed(2),
          },
          description,
        },
      ],
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
