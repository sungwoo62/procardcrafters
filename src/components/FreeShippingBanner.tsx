import { createServerClient } from '@/lib/supabase'
import { Sparkles } from 'lucide-react'

/**
 * 사이트 상단 promo 배너 — 무료배송 활성화 시 노출.
 * config.free_shipping_threshold_usd > 0 일 때만 렌더.
 */
export default async function FreeShippingBanner() {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('print_shipping_config')
    .select('free_shipping_threshold_usd, free_shipping_max_weight_kg')
    .eq('id', 1)
    .maybeSingle()

  const threshold = Number(data?.free_shipping_threshold_usd ?? 0)
  if (!threshold) return null

  const maxWeight = Number(data?.free_shipping_max_weight_kg ?? 0)
  const weightNote = maxWeight > 0 ? ` (≤${maxWeight}kg)` : ''

  return (
    <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-center text-xs sm:text-sm py-2 px-4">
      <span className="inline-flex items-center gap-1.5 font-medium">
        <Sparkles className="w-3.5 h-3.5" />
        FREE worldwide shipping on orders over <strong>${threshold.toFixed(0)}</strong>{weightNote} — FedEx International Priority
      </span>
    </div>
  )
}
