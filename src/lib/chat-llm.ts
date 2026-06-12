// OMO-2703: 챗봇 LLM 공급자 추상화.
// 우선순위: ANTHROPIC_API_KEY 가 있으면 Claude(Haiku) 사용(선호),
// 없으면 운영에 프로비저닝된 GOOGLE_GEMINI_API_KEY 로 폴백.
// 두 키 모두 없으면 ChatLlmUnavailableError 를 던져 호출부가 503 으로 변환.
//
// Gemini 는 의존성 추가 없이 REST(fetch)로 호출한다(빌드/락파일 변경 회피).
import Anthropic from '@anthropic-ai/sdk'

export class ChatLlmUnavailableError extends Error {
  constructor(message = 'No chat LLM provider configured') {
    super(message)
    this.name = 'ChatLlmUnavailableError'
  }
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001'
const GEMINI_MODEL = process.env.GEMINI_CHAT_MODEL ?? 'gemini-2.0-flash'
const MAX_OUTPUT_TOKENS = 512

/** 현재 사용 가능한 공급자 식별자(진단/로깅용). 없으면 null. */
export function activeChatProvider(): 'anthropic' | 'gemini' | null {
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic'
  if (process.env.GOOGLE_GEMINI_API_KEY) return 'gemini'
  return null
}

/**
 * 시스템 프롬프트 + 대화 메시지로 어시스턴트 응답 텍스트를 생성한다.
 * 공급자 우선순위: Anthropic → Gemini. 키가 전무하면 ChatLlmUnavailableError.
 * 모델 호출 실패는 에러를 그대로 던지므로 호출부에서 503 처리한다.
 */
export async function generateChatReply(
  system: string,
  messages: ChatMessage[]
): Promise<string> {
  const provider = activeChatProvider()

  if (provider === 'anthropic') {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    })
    return response.content[0]?.type === 'text' ? response.content[0].text : ''
  }

  if (provider === 'gemini') {
    return generateWithGemini(system, messages)
  }

  throw new ChatLlmUnavailableError()
}

async function generateWithGemini(
  system: string,
  messages: ChatMessage[]
): Promise<string> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY as string
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({
        // Gemini 는 어시스턴트 역할을 'model' 로 표기한다.
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
    }),
  })

  if (!res.ok) {
    throw new Error(`Gemini API ${res.status}`)
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }
  const parts = data.candidates?.[0]?.content?.parts ?? []
  return parts
    .map((p) => p.text ?? '')
    .join('')
    .trim()
}
