import { NextRequest, NextResponse, after } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { recordCsThread } from '@/lib/cs-threads'
import { captureVisitor } from '@/lib/chat/visitor'
import type { VisitorMetaPayload } from '@/types/chat'
import {
  activeChatProvider,
  generateChatReply,
  ChatLlmProviderError,
} from '@/lib/chat-llm'

const SYSTEM_PROMPT = `You are a friendly print specialist at Procardcrafters, helping customers get instant quotes for professional printing services.

We offer 5 products:
- **Business Cards**: Standard 90×55mm, 1000 sheets from ~$15
- **Stickers**: Various sizes, 100 sheets from ~$12
- **Flyers**: A5/A4/A3, 500 sheets from ~$20
- **Postcards**: 100×148mm, 200 sheets from ~$18
- **Posters**: A3/A2/A1, 50 sheets from ~$25

Pricing guide (approximate USD, includes precision printing + international shipping):
- Business Cards: 1000=$15, 2000=$22, 5000=$38 | Options: matte/glossy/UV coating +$3-8
- Stickers: 100=$12, 500=$35, 1000=$55 | Options: cut shapes +$5
- Flyers: 500=$20, 1000=$30, 2000=$45 | A4/A3 +20%
- Postcards: 200=$18, 500=$30, 1000=$45 | laminated +$5
- Posters: 50=$25, 100=$40, 200=$65 | A2 +30%, A1 +60%

Your job:
1. Greet warmly and ask what they'd like to print
2. Gather: product type → quantity → size → finish/coating
3. Calculate and present a clear price estimate in USD
4. Offer to proceed to order with a clear CTA

Keep responses concise (2-4 sentences). Be friendly and professional. Always give a specific price when you have enough info.
If asked about turnaround: standard is 7-10 business days including shipping.
If asked about files: we accept PDF, AI, PSD, PNG (300dpi+).

When you have gathered all details and presented a price, end your message with exactly this line on a new line:
[ESTIMATE_READY: product=<product>, quantity=<number>, size=<size>, finish=<finish>, price_usd=<number>]`

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(req: NextRequest) {
  const { messages, sessionId, visitorId, visitor } = (await req.json()) as {
    messages: Message[]
    sessionId: string
    visitorId?: string
    visitor?: VisitorMetaPayload
  }

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'No messages provided.' }, { status: 400 })
  }

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required.' }, { status: 400 })
  }

  // OMO-2703: 챗봇 LLM 공급자는 Anthropic(선호) → Gemini 폴백 순.
  // 두 키 모두 없으면 챗봇 무응답 → 명시적 503으로 진단 가능하게.
  // reason 필드는 운영 진단용(시크릿 미포함).
  if (!activeChatProvider()) {
    return NextResponse.json(
      { error: 'Chat service is temporarily unavailable.', reason: 'no_provider' },
      { status: 503 }
    )
  }

  let assistantText = ''
  try {
    assistantText = await generateChatReply(SYSTEM_PROMPT, messages)
  } catch (err) {
    // 모델 호출 실패(인증·레이트리밋·일시장애)는 클라이언트가 처리 가능한 503으로.
    const diag =
      err instanceof ChatLlmProviderError
        ? {
            reason: 'provider_error',
            provider: err.provider,
            upstreamStatus: err.upstreamStatus,
            detail: err.message,
          }
        : { reason: 'provider_error' }
    return NextResponse.json(
      { error: 'Chat service is temporarily unavailable.', ...diag },
      { status: 503 }
    )
  }

  // Parse estimate info
  const estimateMatch = assistantText.match(
    /\[ESTIMATE_READY: product=([^,]+), quantity=(\d+), size=([^,]+), finish=([^,]+), price_usd=([\d.]+)\]/
  )

  const userMessage = messages[messages.length - 1]

  // OMO-3744: 새 세션 여부 = 사용자 메시지가 이번이 처음(1건)일 때.
  // 세션당 1회만 페이지뷰/세션카운트 적재(page_view 스팸 방지).
  const isNewSession = messages.filter((m) => m.role === 'user').length === 1
  // after() 안에서 쓰기 위해 헤더(IP/geo)를 스냅샷.
  const requestHeaders = req.headers

  // Save chat log to Supabase.
  // ⚠️ OMO-3332: Vercel serverless 는 응답 후 unawaited 백그라운드 write 를 freeze/드롭한다.
  // Next16 after() 로 응답 플러시 후에도 DB write 가 완료되도록 보장한다(과거 void IIFE → 드롭 버그).
  after(async () => {
    const supabase = createServerClient()
    try {
      await supabase.from('print_chat_logs').insert([
        {
          session_id: sessionId,
          role: 'user',
          content: userMessage.content,
        },
        {
          session_id: sessionId,
          role: 'assistant',
          content: assistantText,
          ...(estimateMatch
            ? {
                estimate_product: estimateMatch[1].trim(),
                estimate_quantity: parseInt(estimateMatch[2]),
                estimate_size: estimateMatch[3].trim(),
                estimate_finish: estimateMatch[4].trim(),
                estimate_price_usd: parseFloat(estimateMatch[5]),
              }
            : {}),
        },
      ])
    } catch {
      // Log save failure does not affect response
    }

    // OMO-2600: CS 응답시간 계측 — 챗(CSAgent) 인입을 print_cs_threads에 멱등 기록.
    // 세션 첫 메시지에 스레드 open, AI 첫 응답에 first_response_at 기록.
    // 자동 셀프서비스 채널이므로 is_automated=true (사람 CS SLA에서 분리).
    const now = new Date().toISOString()
    await recordCsThread({
      channel: 'chat',
      externalRef: sessionId,
      isAutomated: true,
      openedAt: now,
      firstResponseAt: assistantText ? now : null,
    })

    // OMO-3744: 방문자 프로필 upsert + 페이지뷰 적재(공유 cs_visitor_profiles/cs_page_views, site='procard').
    // 실패해도 상담 흐름 비차단. page_view 의 session_id 로 admin 상세에서 세션↔방문자 연결.
    if (visitorId) {
      await captureVisitor(supabase, visitorId, visitor, requestHeaders, {
        sessionId,
        isNewSession,
      })
    }
  })

  // Pass [ESTIMATE_READY: ...] tag to client but strip from display text
  const displayText = assistantText
    .replace(/\[ESTIMATE_READY:[^\]]+\]/g, '')
    .trim()

  return NextResponse.json({
    text: displayText,
    estimate: estimateMatch
      ? {
          product: estimateMatch[1].trim(),
          quantity: parseInt(estimateMatch[2]),
          size: estimateMatch[3].trim(),
          finish: estimateMatch[4].trim(),
          priceUsd: parseFloat(estimateMatch[5]),
        }
      : null,
  })
}
