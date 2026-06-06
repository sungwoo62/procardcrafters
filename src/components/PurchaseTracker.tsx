'use client'

import { useEffect, useRef } from 'react'
import { trackPurchase } from '@/lib/analytics'

interface Props {
  orderNumber: string
}

interface PurchaseSessionData {
  value: number
  productId?: string
  productName?: string
  customerEmail?: string
  customerPhone?: string
  customerName?: string
  shippingAddress?: {
    addressLine1?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
  }
}

function normalizeEmail(email?: string): string | undefined {
  const value = email?.trim().toLowerCase()
  return value ? value : undefined
}

function normalizePhoneNumber(phone?: string): string | undefined {
  if (!phone) return undefined
  const hasPlusPrefix = phone.trim().startsWith('+')
  const digits = phone.replace(/\D/g, '')
  if (!hasPlusPrefix || digits.length < 11 || digits.length > 15) return undefined
  return `+${digits}`
}

function buildAddress(data: PurchaseSessionData) {
  const name = data.customerName?.trim()
  const postalCode = data.shippingAddress?.postalCode?.trim()
  const country = data.shippingAddress?.country?.trim().toUpperCase()
  if (!name || !postalCode || !country) return undefined

  const [firstName, ...lastNameParts] = name.split(/\s+/)
  const lastName = lastNameParts.join(' ')
  if (!firstName || !lastName) return undefined

  return {
    first_name: firstName,
    last_name: lastName,
    street: data.shippingAddress?.addressLine1?.trim() || undefined,
    city: data.shippingAddress?.city?.trim() || undefined,
    region: data.shippingAddress?.state?.trim() || undefined,
    postal_code: postalCode,
    country,
  }
}

function buildUserData(data: PurchaseSessionData) {
  const email = normalizeEmail(data.customerEmail)
  const phone_number = normalizePhoneNumber(data.customerPhone)
  const address = buildAddress(data)

  if (!email && !phone_number && !address) return undefined
  return { email, phone_number, address }
}

export default function PurchaseTracker({ orderNumber }: Props) {
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    fired.current = true

    const raw = sessionStorage.getItem('pccf_purchase_data')
    if (!raw) return

    try {
      const data = JSON.parse(raw) as PurchaseSessionData
      trackPurchase({
        orderId: orderNumber,
        value: data.value,
        productId: data.productId,
        productName: data.productName,
        userData: buildUserData(data),
      })
      sessionStorage.removeItem('pccf_purchase_data')
    } catch {
      // 세션 데이터 파싱 실패 시 무시
    }
  }, [orderNumber])

  return null
}
