import { NextRequest, NextResponse } from 'next/server'
import { recordCsThread } from '@/lib/cs-threads'
import { sendContactInquiryEmail } from '@/lib/email'

// OMO-2612: 사람 채널 CS 인입 캡처 (문의폼 → print_cs_threads)
// 정적 mailto 링크를 폼으로 전환해 인입 시각(opened_at)을 코드가 캡처한다.
// → print_cs_response_kpi.human_avg_first_response_seconds 분모 확보.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  let body: {
    name?: string
    email?: string
    subject?: string
    message?: string
    orderNumber?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const name = body.name?.trim() ?? ''
  const email = body.email?.trim() ?? ''
  const subject = body.subject?.trim() ?? ''
  const message = body.message?.trim() ?? ''
  const orderNumber = body.orderNumber?.trim() ?? ''

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: '유효한 이메일 주소를 입력해 주세요.' }, { status: 400 })
  }
  if (!message) {
    return NextResponse.json({ error: '문의 내용을 입력해 주세요.' }, { status: 400 })
  }

  // 문의 제목: 사용자가 제목을 비우면 주문번호/기본값으로 보완 (KPI 식별성).
  const threadSubject =
    subject || (orderNumber ? `Order ${orderNumber} 문의` : '사이트 문의')

  // CS 응답시간 KPI — 사람 채널 인입 시각을 print_cs_threads에 기록(분모 확보).
  // is_automated=false(사람 SLA 포함). first_response_at은 어드민/CSAgent 회신 시 스탬프(2단계).
  const result = await recordCsThread({
    channel: 'contact_form',
    customerEmail: email,
    subject: threadSubject,
    openedAt: new Date().toISOString(),
  })

  // 팀이 문의를 실제로 보도록 관리자 알림 메일 발송(키 미설정 시 no-op, best-effort).
  void sendContactInquiryEmail({
    name: name || '(이름 미기재)',
    email,
    subject: threadSubject,
    message,
    orderNumber: orderNumber || undefined,
  }).catch(() => {})

  if (!result.ok) {
    // 계측 실패해도 사용자 흐름은 막지 않되, 재시도 유도를 위해 500 반환.
    return NextResponse.json(
      { error: '문의 접수 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
