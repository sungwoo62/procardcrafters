import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getKrwToUsdRate } from '@/lib/exchange-rate'
import { calculateItemPriceUsd } from '@/lib/pricing'
import { quoteShipping, calculateOrderWeightKg } from '@/lib/shipping'
import { createPaypalOrder } from '@/lib/paypal'

interface OrderItemInput {
  productId: string
  selectedOptions: Record<string, string>
  quantity?: number
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
  let body: OrderRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request format' }, { status: 400 })
  }

  const { items, customer, shipping } = body

  if (!items?.length || !customer?.email || !shipping?.addressLine1) {
    return NextResponse.json({ error: 'Required fields are missing' }, { status: 400 })
  }

  const supabase = createServerClient()
  const exchangeRate = await getKrwToUsdRate()

  const productIds = items.map((i) => i.productId)
  const { data: products, error: productError } = await supabase
    .from('print_products')
    .select('*, print_product_options(*)')
    .in('id', productIds)
    .eq('is_active', true)

  if (productError || !products?.length) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

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
      return NextResponse.json({ error: `Product not found: ${item.productId}` }, { status: 404 })
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

    const batchPriceUsd = calculateItemPriceUsd({
      basePriceKrw: product.base_price_krw,
      marginMultiplier: product.margin_multiplier,
      extraPricesKrw,
      exchangeRate,
    })

    const pieceCount =
      item.quantity ??
      (parseInt(String(item.selectedOptions['quantity'] ?? '1'), 10) || 1)
    const unitPriceUsd = batchPriceUsd / pieceCount

    orderItemsData.push({
      product_id: product.id,
      product_name_ko: product.name_ko,
      product_name_en: product.name_en,
      selected_options: item.selectedOptions,
      quantity: pieceCount,
      unit_price_usd: unitPriceUsd,
      subtotal_usd: batchPriceUsd,
    })
  }

  const subtotalUsd = orderItemsData.reduce((sum, i) => sum + i.subtotal_usd, 0)
  const weightKg = calculateOrderWeightKg(
    orderItemsData.map((it) => {
      const product = products.find((p) => p.id === it.product_id)
      return {
        quantity: it.quantity,
        default_weight_kg: product?.default_weight_kg ?? 0.5,
        unit_weight_g: product?.unit_weight_g ?? 0,
        selected_options: it.selected_options,
      }
    }),
  )
  const shippingQuote = await quoteShipping(shipping.country, weightKg, undefined, shipping.postalCode)
  const { data: cfg } = await supabase
    .from('print_shipping_config')
    .select('free_shipping_threshold_usd, free_shipping_max_weight_kg')
    .eq('id', 1)
    .maybeSingle()
  const freeThreshold = Number(cfg?.free_shipping_threshold_usd ?? 0)
  const maxWeight = Number(cfg?.free_shipping_max_weight_kg ?? 0)
  const freeApplies =
    freeThreshold > 0 && subtotalUsd >= freeThreshold &&
    (maxWeight === 0 || weightKg <= maxWeight)
  const shippingUsd = freeApplies ? 0 : shippingQuote.costUsd
  const totalUsd = subtotalUsd + shippingUsd

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
      payment_provider: 'paypal',
    })
    .select()
    .single()

  if (orderError || !order) {
    return NextResponse.json({ error: `Failed to create order: ${orderError?.message}` }, { status: 500 })
  }

  const { data: insertedItems, error: itemsError } = await supabase.from('print_order_items').insert(
    orderItemsData.map((i) => ({ ...i, order_id: order.id }))
  ).select('id')

  if (itemsError) {
    return NextResponse.json({ error: `Failed to save order items: ${itemsError.message}` }, { status: 500 })
  }

  for (let idx = 0; idx < items.length; idx++) {
    const fileId = items[idx].fileId
    if (fileId) {
      const orderItemId = insertedItems?.[idx]?.id ?? null
      await supabase.from('print_files').update({
        order_id: order.id,
        order_item_id: orderItemId,
      }).eq('id', fileId)
    }
  }

  // Create PayPal Order
  const productNames = orderItemsData.map((i) => i.product_name_en).join(', ')
  const paypalOrderId = await createPaypalOrder(totalUsd, `Procardcrafters: ${productNames}`)

  await supabase
    .from('print_orders')
    .update({ paypal_order_id: paypalOrderId })
    .eq('id', order.id)

  return NextResponse.json({
    paypalOrderId,
    orderId: order.id,
    orderNumber: order.order_number,
  })
}
