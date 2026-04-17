import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerClient } from '@/lib/supabase'
import { getKrwToUsdRate } from '@/lib/exchange-rate'
import { calculateItemPriceUsd } from '@/lib/pricing'
import { getShippingCost } from '@/lib/shipping'

interface OrderItemInput {
  productId: string
  selectedOptions: Record<string, string>
  fileId?: string
}

interface OrderRequest {
  items: OrderItemInput[]
  customer: {
    email: string
    name: string
    phone?: string
  }
  shipping: {
    name: string
    addressLine1: string
    addressLine2?: string
    city: string
    state?: string
    country: string
    postalCode: string
  }
}

export async function POST(request: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

  let body: OrderRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다' }, { status: 400 })
  }

  const { items, customer, shipping } = body

  if (!items?.length || !customer?.email || !shipping?.addressLine1) {
    return NextResponse.json({ error: '필수 정보가 누락되었습니다' }, { status: 400 })
  }

  const supabase = createServerClient()
  const exchangeRate = await getKrwToUsdRate()
  const shippingUsd = getShippingCost(shipping.country)

  // 상품 정보 조회
  const productIds = items.map((i) => i.productId)
  const { data: products, error: productError } = await supabase
    .from('print_products')
    .select('*, print_product_options(*)')
    .in('id', productIds)
    .eq('is_active', true)

  if (productError || !products?.length) {
    return NextResponse.json({ error: '상품 정보를 찾을 수 없습니다' }, { status: 404 })
  }

  interface StripeLineItem {
    price_data: {
      currency: string
      product_data: { name: string }
      unit_amount: number
    }
    quantity: number
  }

  // 주문 항목별 가격 계산
  const lineItems: StripeLineItem[] = []
  const orderItemsData: {
    product_id: string
    product_name_ko: string
    product_name_en: string
    selected_options: Record<string, string>
    quantity: number
    unit_price_usd: number
    subtotal_usd: number
  }[] = []

  for (const item of items) {
    const product = products.find((p) => p.id === item.productId)
    if (!product) {
      return NextResponse.json({ error: `상품을 찾을 수 없습니다: ${item.productId}` }, { status: 404 })
    }

    const productOptions = (product.print_product_options ?? []) as {
      option_type: string
      value: string
      extra_price_krw: number
    }[]

    const extraPricesKrw = Object.entries(item.selectedOptions).map(([type, value]) => {
      const opt = productOptions.find((o) => o.option_type === type && o.value === value)
      return opt?.extra_price_krw ?? 0
    })

    const unitPriceUsd = calculateItemPriceUsd({
      basePriceKrw: product.base_price_krw,
      marginMultiplier: product.margin_multiplier,
      extraPricesKrw,
      exchangeRate,
    })

    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: { name: product.name_en },
        unit_amount: Math.round(unitPriceUsd * 100),
      },
      quantity: 1,
    })

    orderItemsData.push({
      product_id: product.id,
      product_name_ko: product.name_ko,
      product_name_en: product.name_en,
      selected_options: item.selectedOptions,
      quantity: 1,
      unit_price_usd: unitPriceUsd,
      subtotal_usd: unitPriceUsd,
    })
  }

  // 배송비 line item
  lineItems.push({
    price_data: {
      currency: 'usd',
      product_data: { name: 'Shipping' },
      unit_amount: Math.round(shippingUsd * 100),
    },
    quantity: 1,
  })

  const subtotalUsd = orderItemsData.reduce((sum, i) => sum + i.subtotal_usd, 0)
  const totalUsd = subtotalUsd + shippingUsd

  // 주문 생성
  const { data: order, error: orderError } = await supabase
    .from('print_orders')
    .insert({
      customer_email: customer.email,
      customer_name: customer.name,
      customer_phone: customer.phone ?? null,
      shipping_name: shipping.name,
      shipping_address_line1: shipping.addressLine1,
      shipping_address_line2: shipping.addressLine2 ?? null,
      shipping_city: shipping.city,
      shipping_state: shipping.state ?? null,
      shipping_country: shipping.country,
      shipping_postal_code: shipping.postalCode,
      subtotal_usd: subtotalUsd,
      shipping_usd: shippingUsd,
      total_usd: totalUsd,
      exchange_rate_krw_usd: exchangeRate,
      status: 'pending',
    })
    .select()
    .single()

  if (orderError || !order) {
    return NextResponse.json({ error: `주문 생성 실패: ${orderError?.message}` }, { status: 500 })
  }

  // 주문 항목 생성
  const { error: itemsError } = await supabase.from('print_order_items').insert(
    orderItemsData.map((i) => ({ ...i, order_id: order.id }))
  )

  if (itemsError) {
    return NextResponse.json({ error: `주문 항목 저장 실패: ${itemsError.message}` }, { status: 500 })
  }

  // 파일 연결
  for (let idx = 0; idx < items.length; idx++) {
    const fileId = items[idx].fileId
    if (fileId) {
      await supabase
        .from('print_files')
        .update({ order_id: order.id })
        .eq('id', fileId)
    }
  }

  // Stripe Checkout 세션 생성
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: lineItems,
    customer_email: customer.email,
    metadata: { orderId: order.id, orderNumber: order.order_number },
    success_url: `${baseUrl}/order/success?session_id={CHECKOUT_SESSION_ID}&order=${order.order_number}`,
    cancel_url: `${baseUrl}/order?cancelled=1`,
    shipping_address_collection: undefined,
    payment_intent_data: {
      metadata: { orderId: order.id },
    },
  })

  // Stripe session ID 저장
  await supabase
    .from('print_orders')
    .update({ stripe_session_id: session.id })
    .eq('id', order.id)

  return NextResponse.json({ checkoutUrl: session.url, orderNumber: order.order_number })
}
