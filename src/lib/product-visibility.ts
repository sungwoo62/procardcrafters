/**
 * OMO-3058: 고객에게 숨긴 제품 슬러그 집합.
 *
 * print_swadpia_mapping.hidden_from_customer = true 인 제품을 고객 제품목록/PDP 에서
 * 제외한다. (성원 미연동 등 판매 불가 제품을 보드가 숨길 때 사용)
 * print_products.is_active 와 분리한 이유: is_active 는 라이브 prod 가 직접 읽어
 * 테스트 토글이 prod 노출을 바꾼다 — 별도 플래그라야 prod 무손상 검증이 가능.
 */
import type { createServerClient } from '@/lib/supabase'

export async function getHiddenSlugs(
  supabase: ReturnType<typeof createServerClient>,
): Promise<Set<string>> {
  try {
    const { data, error } = await supabase
      .from('print_swadpia_mapping')
      .select('slug')
      .eq('hidden_from_customer', true)
    if (error) return new Set()
    return new Set((data ?? []).map((r: { slug: string }) => r.slug))
  } catch {
    // 테이블 미존재 등 — 숨김 없음으로 폴백(고객사이트 안전)
    return new Set()
  }
}

export async function isSlugHidden(
  supabase: ReturnType<typeof createServerClient>,
  slug: string,
): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('print_swadpia_mapping')
      .select('hidden_from_customer')
      .eq('slug', slug)
      .maybeSingle()
    return Boolean(data?.hidden_from_customer)
  } catch {
    return false
  }
}
