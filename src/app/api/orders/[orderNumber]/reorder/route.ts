import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createPaypalOrder } from '@/lib/paypal'
import { createAuthServerClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/admin-auth'
import { getKrwToUsdRate } from '@/lib/exchange-rate'
import { calculateItemPriceUsd } from '@/lib/pricing'
import { quoteShipping, calculateOrderWeightKg } from '@/lib/shipping'
import { logOrderEvent } from '@/lib/order-events'
import { buildOrderExtraPricesKrw } from '@/config/finishing-surcharge'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  const { orderNumber } = await params
  const supabase = createServerClient()

  // 인증: 일반 사용자 세션 또는 관리자
  let actorEmail: string | null = null
  let isAdmin = false

  const authClient = await createAuthServerClient()
  const { data: { session } } = await authClient.auth.getSession()
  if (session?.user?.email) {
    actorEmail = session.user.email
  } else {
    const adminUser = await requireAdmin()
    if (adminUser) {
      isAdmin = true
      actorEmail = adminUser.email ?? null
    }
  }

  if (!actorEmail && !isAdmin) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
  }

  // 원본 주문 조회
  const { data: order } = await supabase
    .from('print_orders')
    .select('*')
    .eq('order_number', orderNumber)
    .single()

  if (!order) {
    return NextResponse.json({ error: '주문을 찾을 수 없습니다' }, { status: 404 })
  }

  // 소유자 확인 (관리자가 아닌 경우)
  if (!isAdmin && actorEmail !== order.customer_email) {
    return NextResponse.json({ error: '이 주문에 대한 권한이 없습니다' }, { status: 403 })
  }

  // 주문 아이템 + 연결된 파일 조회
  const { data: items } = await supabase
    .from('print_order_items')
    .select('*, print_files(id, status, storage_path, original_filename, file_size_bytes, mime_type)')
    .eq('order_id', order.id)

  if (!items?.length) {
    return NextResponse.json({ error: '주문 항목을 찾을 수 없습니다' }, { status: 404 })
  }

  // 제품 현행 정보 조회
  const productIds = [...new Set(items.map((i) => i.product_id as string))]
  const { data: products } = await supabase
    .from('print_products')
    .select('*, print_product_options(*)')
    .in('id', productIds)
    .eq('is_active', true)

  // 단종 제품 체크
  const discontinuedIds = productIds.filter((id) => !products?.find((p) => p.id === id))
  if (discontinuedIds.length > 0) {
    const names = items
      .filter((i) => discontinuedIds.includes(i.product_id))
      .map((i) => i.product_name_en as string)
      .join(', ')
    return NextResponse.json(
      { error: `단종된 제품이 포함되어 있어 재주문이 불가합니다: ${names}`, discontinued: true },
      { status: 422 }
    )
  }

  // 새 가격 계산
  const exchangeRate = await getKrwToUsdRate()

  interface OrderItemCalc {
    product_id: string
    product_name_ko: string
    product_name_en: string
    selected_options: Record<string, string>
    quantity: number
    unit_price_usd: number
    subtotal_usd: number
    _files: { storage_path: string; original_filename: string; file_size_bytes: number | null; mime_type: string | null }[]
  }

  const orderItemsCalc: OrderItemCalc[] = []

  for (const item of items) {
    const product = products!.find((p) => p.id === item.product_id)!
    const productOptions = (product.print_product_options ?? []) as {
      option_type: string
      value: string
      extra_price_krw: number
    }[]

    const selectedOpts = item.selected_options as Record<string, string>
    // OMO-2672: 후가공 가격을 단일 권위 빌더로 산출. 정확일치만 쓰면 시드된 finishing 행과
    // 충돌(단일 이중·다중 과소청구)하므로 create-order·order/page 와 동일 헬퍼로 통일한다.
    const extraPricesKrw = buildOrderExtraPricesKrw(selectedOpts, productOptions)

    const batchPriceUsd = calculateItemPriceUsd({
      basePriceKrw: product.base_price_krw,
      marginMultiplier: product.margin_multiplier,
      extraPricesKrw,
      exchangeRate,
    })
    const unitPriceUsd = batchPriceUsd / item.quantity

    // 거절되지 않은 파일만 복사
    const validFiles = ((item.print_files ?? []) as {
      id: string
      status: string
      storage_path: string
      original_filename: string
      file_size_bytes: number | null
      mime_type: string | null
    }[]).filter((f) => f.status !== 'rejected')

    orderItemsCalc.push({
      product_id: product.id,
      product_name_ko: product.name_ko,
      product_name_en: product.name_en,
      selected_options: selectedOpts,
      quantity: item.quantity,
      unit_price_usd: unitPriceUsd,
      subtotal_usd: batchPriceUsd,
      _files: validFiles,
    })
  }

  // 배송비 계산
  const subtotalUsd = orderItemsCalc.reduce((s, i) => s + i.subtotal_usd, 0)
  const weightKg = calculateOrderWeightKg(
    orderItemsCalc.map((it) => {
      const p = products!.find((p) => p.id === it.product_id)!
      return {
        quantity: it.quantity,
        default_weight_kg: p.default_weight_kg ?? 0.5,
        unit_weight_g: p.unit_weight_g ?? 0,
        selected_options: it.selected_options,
      }
    })
  )
  const shippingQuote = await quoteShipping(
    order.shipping_country,
    weightKg,
    undefined,
    order.shipping_postal_code
  )

  const { data: cfg } = await supabase
    .from('print_shipping_config')
    .select('free_shipping_threshold_usd, free_shipping_max_weight_kg')
    .eq('id', 1)
    .maybeSingle()
  const freeThreshold = Number(cfg?.free_shipping_threshold_usd ?? 0)
  const maxWeight = Number(cfg?.free_shipping_max_weight_kg ?? 0)
  const freeApplies =
    freeThreshold > 0 &&
    subtotalUsd >= freeThreshold &&
    (maxWeight === 0 || weightKg <= maxWeight)
  const shippingUsd = freeApplies ? 0 : shippingQuote.costUsd
  const totalUsd = subtotalUsd + shippingUsd

  // 새 주문 레코드 생성
  const { data: newOrder, error: orderError } = await supabase
    .from('print_orders')
    .insert({
      user_id: order.user_id,
      customer_email: order.customer_email,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      shipping_name: order.shipping_name,
      shipping_address_line1: order.shipping_address_line1,
      shipping_address_line2: order.shipping_address_line2,
      shipping_city: order.shipping_city,
      shipping_state: order.shipping_state,
      shipping_country: order.shipping_country,
      shipping_postal_code: order.shipping_postal_code,
      subtotal_usd: subtotalUsd,
      shipping_usd: shippingUsd,
      total_usd: totalUsd,
      exchange_rate_krw_usd: exchangeRate,
      status: 'pending',
      payment_provider: 'paypal',
    })
    .select()
    .single()

  if (orderError || !newOrder) {
    return NextResponse.json(
      { error: `주문 생성 실패: ${orderError?.message}` },
      { status: 500 }
    )
  }

  // 주문 아이템 저장
  const { data: insertedItems, error: itemsError } = await supabase
    .from('print_order_items')
    .insert(
      orderItemsCalc.map(({ _files: _, ...i }) => ({ ...i, order_id: newOrder.id }))
    )
    .select('id')

  if (itemsError) {
    return NextResponse.json(
      { error: `주문 항목 저장 실패: ${itemsError.message}` },
      { status: 500 }
    )
  }

  // 파일 복사 (동일 storage_path 참조, 새 print_files 행 생성)
  for (let idx = 0; idx < orderItemsCalc.length; idx++) {
    const orderItemId = insertedItems?.[idx]?.id ?? null
    for (const file of orderItemsCalc[idx]._files) {
      await supabase.from('print_files').insert({
        order_id: newOrder.id,
        order_item_id: orderItemId,
        storage_path: file.storage_path,
        original_filename: file.original_filename,
        file_size_bytes: file.file_size_bytes,
        mime_type: file.mime_type,
        status: 'uploaded',
      })
    }
  }

  // PayPal 주문 생성 (라이브 스토어는 PayPal 전용 — create-order 플로우와 동일)
  const productNames = orderItemsCalc.map((i) => i.product_name_en).join(', ')
  let paypalOrderId: string
  try {
    paypalOrderId = await createPaypalOrder(totalUsd, `Procardcrafters: ${productNames}`)
  } catch (err) {
    return NextResponse.json(
      { error: `결제 준비에 실패했습니다: ${(err as Error).message}` },
      { status: 502 }
    )
  }

  await supabase
    .from('print_orders')
    .update({ paypal_order_id: paypalOrderId })
    .eq('id', newOrder.id)

  // 재주문 이벤트 기록
  await logOrderEvent({
    orderId: newOrder.id,
    eventType: 'reorder',
    newValue: newOrder.order_number,
    metadata: {
      reordered_from: orderNumber,
      actor_email: actorEmail ?? 'admin',
    },
    actor: isAdmin ? 'admin' : 'customer',
  })

  return NextResponse.json({
    paypalOrderId,
    orderId: newOrder.id,
    orderNumber: newOrder.order_number,
  })
}
