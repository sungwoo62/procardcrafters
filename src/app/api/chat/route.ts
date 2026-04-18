import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

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
  const { messages, sessionId } = (await req.json()) as {
    messages: Message[]
    sessionId: string
  }

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: '메시지가 없습니다.' }, { status: 400 })
  }

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId가 없습니다.' }, { status: 400 })
  }

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  })

  const assistantText =
    response.content[0].type === 'text' ? response.content[0].text : ''

  // 견적 정보 파싱
  const estimateMatch = assistantText.match(
    /\[ESTIMATE_READY: product=([^,]+), quantity=(\d+), size=([^,]+), finish=([^,]+), price_usd=([\d.]+)\]/
  )

  const userMessage = messages[messages.length - 1]

  // Supabase에 대화 로그 저장 (비동기, 실패해도 응답에 영향 없음)
  void (async () => {
    try {
      const supabase = createServerClient()
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
      // 로그 저장 실패해도 응답에 영향 없음
    }
  })()

  // [ESTIMATE_READY: ...] 태그는 클라이언트에 전달하되, 표시 텍스트에서는 제거
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
