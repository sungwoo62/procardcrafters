import { createServerClient } from '@/lib/supabase'

export type OrderEventType =
  | 'status_change'
  | 'email_sent'
  | 'payment_received'
  | 'payment_failed'
  | 'fraud_alert'
  | 'file_uploaded'
  | 'file_approved'
  | 'file_rejected'
  | 'shipment_created'
  | 'shipped'
  | 'delivered'

export interface PrintOrderEvent {
  id: string
  order_id: string
  event_type: OrderEventType
  old_value: string | null
  new_value: string | null
  metadata: Record<string, unknown>
  actor: string
  created_at: string
}

export interface LogOrderEventOptions {
  orderId: string
  eventType: OrderEventType
  oldValue?: string
  newValue?: string
  metadata?: Record<string, unknown>
  actor?: string
}

export async function logOrderEvent(options: LogOrderEventOptions): Promise<void> {
  const supabase = createServerClient()
  await supabase.from('print_order_events').insert({
    order_id: options.orderId,
    event_type: options.eventType,
    old_value: options.oldValue ?? null,
    new_value: options.newValue ?? null,
    metadata: options.metadata ?? {},
    actor: options.actor ?? 'system',
  })
}

export async function getOrderEvents(orderId: string): Promise<PrintOrderEvent[]> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('print_order_events')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })
  return (data ?? []) as PrintOrderEvent[]
}
