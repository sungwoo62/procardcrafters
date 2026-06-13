import { createServerClient } from '@/lib/supabase'
import { Sparkles } from 'lucide-react'

/**
 * 사이트 상단 promo 배너 — 무료배송 활성화 시 노출.
 * config.free_shipping_threshold_usd > 0 일 때만 렌더.
 */
export default async function FreeShippingBanner() {
  // Supabase env 미설정(프리뷰 등 일부 배포 스코프) 시 배너 생략 — 빌드 prerender 안전 폴백.
  // 레이아웃에 직접 렌더되므로 여기서 throw 하면 /_not-found 등 정적 페이지 빌드가 통째로 실패한다.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null
  }

  const supabase = createServerClient()
  const { data } = await supabase
    .from('print_shipping_config')
    .select('free_shipping_threshold_usd, free_shipping_max_weight_kg')
    .eq('id', 1)
    .maybeSingle()
    .then(r => r, () => ({ data: null }))

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
