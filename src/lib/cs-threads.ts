import { createServerClient } from '@/lib/supabase'

// OMO-2600: CS 문의 스레드 계측 헬퍼 (print_cs_threads)
// CS 응답시간 KPI = first_response_at − opened_at.
// 모든 인입 채널(이메일/문의폼/CSAgent챗/카카오/네이버톡톡)의 공통 기록 진입점.

export type CsChannel =
  | 'email'
  | 'contact_form'
  | 'chat'
  | 'kakao'
  | 'naver_talk'
  | 'phone'

export interface RecordCsThreadInput {
  channel: CsChannel
  externalRef?: string | null // 채널 원본 식별자(챗 session_id 등) — 멱등 키
  customerEmail?: string | null
  orderId?: string | null
  subject?: string | null
  isAutomated?: boolean
  /** 인입 시각(미지정 시 DB 기본 NOW()) */
  openedAt?: string
  /** 첫응답 시각 — 동시에 응답이 발생한 경우(자동 챗 등) 함께 기록 */
  firstResponseAt?: string | null
  assignee?: string | null
}

/**
 * CS 스레드를 멱등 기록한다.
 * externalRef 가 있으면 (channel, external_ref) 유니크로 upsert — 같은 문의는 1행.
 * 이미 존재하는 스레드는 opened_at 을 덮어쓰지 않고, first_response_at 이 비어 있을 때만 채운다.
 * service_role 클라이언트를 사용하므로 RLS 우회(서버 전용).
 *
 * 실패는 throw 하지 않는다 — CS 계측은 원 응답 흐름을 막지 않는다(best-effort).
 */
export async function recordCsThread(
  input: RecordCsThreadInput
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createServerClient()

    // 멱등 키가 있으면 기존 스레드 조회 후 first_response_at 채우기.
    if (input.externalRef) {
      const { data: existing } = await supabase
        .from('print_cs_threads')
        .select('id, first_response_at')
        .eq('channel', input.channel)
        .eq('external_ref', input.externalRef)
        .maybeSingle()

      if (existing) {
        // 첫응답이 아직 비었고 이번에 응답이 발생했으면 기록(첫응답만 1회).
        if (!existing.first_response_at && input.firstResponseAt) {
          await supabase
            .from('print_cs_threads')
            .update({ first_response_at: input.firstResponseAt })
            .eq('id', existing.id)
        }
        return { ok: true }
      }
    }

    const { error } = await supabase.from('print_cs_threads').insert({
      channel: input.channel,
      external_ref: input.externalRef ?? null,
      customer_email: input.customerEmail ?? null,
      order_id: input.orderId ?? null,
      subject: input.subject ?? null,
      is_automated: input.isAutomated ?? false,
      assignee: input.assignee ?? null,
      ...(input.openedAt ? { opened_at: input.openedAt } : {}),
      first_response_at: input.firstResponseAt ?? null,
    })

    if (error) {
      // 멱등 키 경합으로 인한 중복 INSERT(23505)는 정상 — 다른 요청이 먼저 생성함.
      if (error.code === '23505') return { ok: true }
      return { ok: false, error: error.message }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' }
  }
}
