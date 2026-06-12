// OMO-3028 [OMO-3019-3]: 시안 동의/책임 고지 기록.
//
// 업로드+프리플라이트(/upload) 이후, 고객이 책임 고지에 명시 동의하면
// 동의 문구 전문/버전/프리플라이트 스냅샷/타임스탬프를 print_design_consents 에 영속화한다.
// ⚠️ 동의 문구는 보드 승인 게이트(OMO-2760) — 승인 전 placeholder 버전으로 기록된다.

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getConsentCopy } from '@/lib/design-consent'
import { logOrderEvent } from '@/lib/order-events'

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') ?? 'unknown'
}

async function sha256Hex(value: string): Promise<string> {
  const buf = new TextEncoder().encode(value)
  const hashBuffer = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// 기존 동의 여부 조회 (UI 가 동의 단계를 건너뛸지 판단).
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> },
) {
  const { orderNumber } = await params
  const supabase = createServerClient()

  const { data: order } = await supabase
    .from('print_orders')
    .select('id')
    .eq('order_number', orderNumber)
    .single()

  if (!order) {
    return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 })
  }

  const { data: consents } = await supabase
    .from('print_design_consents')
    .select('id, file_id, consent_version, agreed_at')
    .eq('order_id', order.id)
    .order('agreed_at', { ascending: false })

  return NextResponse.json({
    consents: consents ?? [],
    consent: getConsentCopy(),
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> },
) {
  const { orderNumber } = await params
  const supabase = createServerClient()

  const { data: order } = await supabase
    .from('print_orders')
    .select('id')
    .eq('order_number', orderNumber)
    .single()

  if (!order) {
    return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 })
  }

  let body: { fileId?: string; agreed?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const { fileId, agreed } = body
  if (!fileId) {
    return NextResponse.json({ error: 'fileId가 필요합니다.' }, { status: 400 })
  }
  if (agreed !== true) {
    return NextResponse.json({ error: '책임 고지에 동의해야 합니다.' }, { status: 400 })
  }

  // 파일이 이 주문 소속인지 확인 + 프리플라이트 스냅샷 확보
  const { data: fileRow } = await supabase
    .from('print_files')
    .select('id, order_id, order_item_id, preflight_result')
    .eq('id', fileId)
    .eq('order_id', order.id)
    .single()

  if (!fileRow) {
    return NextResponse.json({ error: '해당 주문의 파일을 찾을 수 없습니다.' }, { status: 404 })
  }

  const copy = getConsentCopy()
  const ipHash = await sha256Hex(getClientIp(request))
  const userAgent = request.headers.get('user-agent')?.slice(0, 500) ?? null

  const { data: consent, error } = await supabase
    .from('print_design_consents')
    .insert({
      order_id: order.id,
      order_item_id: fileRow.order_item_id,
      file_id: fileRow.id,
      consent_text: copy.text,
      consent_version: copy.version,
      preflight_snapshot: fileRow.preflight_result ?? null,
      ip_hash: ipHash,
      user_agent: userAgent,
    })
    .select('id, consent_version, agreed_at')
    .single()

  if (error) {
    return NextResponse.json({ error: `DB 오류: ${error.message}` }, { status: 500 })
  }

  // 주문 이벤트 로깅 (감사 추적)
  await logOrderEvent({
    orderId: order.id,
    eventType: 'status_change',
    newValue: `시안 책임 고지 동의 (${copy.version})`,
    metadata: { fileId: fileRow.id, consentVersion: copy.version, consentApproved: copy.approved },
    actor: 'customer',
  }).catch(() => null)

  return NextResponse.json({ consent })
}
