'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js'

interface Props {
  orderNumber: string
  orderId: string
  paypalOrderId: string
  totalUsd: number
  clientId: string
}

export default function ReorderPayClient({
  orderNumber,
  orderId,
  paypalOrderId,
  totalUsd,
  clientId,
}: Props) {
  const router = useRouter()
  const [paymentError, setPaymentError] = useState<string | null>(null)

  // 재주문 라우트에서 이미 생성된 PayPal 주문을 그대로 승인 — 새로 생성하지 않음
  async function handleCapture(approvedPaypalOrderId: string) {
    const res = await fetch('/api/paypal/capture-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paypalOrderId: approvedPaypalOrderId, orderId }),
    })

    const data = await res.json()
    if (!res.ok) {
      setPaymentError(data.error ?? 'Payment capture failed')
      return
    }

    router.push(`/order/success?order=${data.orderNumber ?? orderNumber}`)
  }

  return (
    <section>
      {paymentError && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg px-4 py-3 mb-4">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {paymentError}
        </div>
      )}

      <PayPalScriptProvider
        options={{
          clientId,
          currency: 'USD',
          intent: 'capture',
        }}
      >
        <PayPalButtons
          style={{ layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay' }}
          createOrder={() => Promise.resolve(paypalOrderId)}
          onApprove={async (data) => {
            await handleCapture(data.orderID ?? paypalOrderId)
          }}
          onError={(err) => {
            setPaymentError(`Payment error: ${String(err)}`)
          }}
        />
      </PayPalScriptProvider>

      <p className="text-xs text-center text-gray-400 mt-3">
        Secure ${totalUsd.toFixed(2)} USD payment via PayPal · Your payment details are protected
      </p>
    </section>
  )
}
