import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    return NextResponse.json({ error: `Webhook verification failed: ${(err as Error).message}` }, { status: 400 })
  }

  const supabase = createServerClient()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const orderId = session.metadata?.orderId

    if (orderId) {
      await supabase
        .from('print_orders')
        .update({
          status: 'paid',
          stripe_payment_intent_id: session.payment_intent as string,
        })
        .eq('id', orderId)
    }
  }

  if (event.type === 'payment_intent.payment_failed') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent
    const orderId = paymentIntent.metadata?.orderId

    if (orderId) {
      await supabase
        .from('print_orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId)
    }
  }

  return NextResponse.json({ received: true })
}
