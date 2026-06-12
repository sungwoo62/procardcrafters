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

/** 공급자 호출 실패. 진단용으로 공급자/업스트림 상태를 보존(시크릿 미포함). */
export class ChatLlmProviderError extends Error {
  provider: string
  upstreamStatus?: number
  constructor(provider: string, upstreamStatus?: number, message?: string) {
    super(message ?? `${provider} call failed`)
    this.name = 'ChatLlmProviderError'
    this.provider = provider
    this.upstreamStatus = upstreamStatus
  }
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001'
const MAX_OUTPUT_TOKENS = 512
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'

// 콜드스타트당 1회 해석한 Gemini 모델명을 캐시(모델명 하드코딩 회피).
let resolvedGeminiModel: string | null = null

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

/**
 * 사용할 Gemini 모델명을 해석한다.
 * 1) GEMINI_CHAT_MODEL env 가 있으면 그것을 신뢰.
 * 2) 없으면 ListModels 로 generateContent 지원 모델 중 flash 우선 선택.
 * 결과는 콜드스타트 동안 캐시한다.
 */
async function resolveGeminiModel(apiKey: string): Promise<string> {
  if (resolvedGeminiModel) return resolvedGeminiModel

  const envModel = process.env.GEMINI_CHAT_MODEL
  if (envModel) {
    resolvedGeminiModel = envModel.replace(/^models\//, '')
    return resolvedGeminiModel
  }

  const res = await fetch(`${GEMINI_BASE}/models?key=${apiKey}`)
  if (!res.ok) {
    throw new ChatLlmProviderError('gemini', res.status, `Gemini ListModels ${res.status}`)
  }
  const data = (await res.json()) as {
    models?: { name: string; supportedGenerationMethods?: string[] }[]
  }
  const usable = (data.models ?? []).filter((m) =>
    (m.supportedGenerationMethods ?? []).includes('generateContent')
  )
  // flash(저지연/저비용) 우선, 없으면 첫 사용 가능 모델.
  const pick =
    usable.find((m) => /flash/i.test(m.name) && !/thinking|exp/i.test(m.name)) ??
    usable.find((m) => /flash/i.test(m.name)) ??
    usable[0]
  if (!pick) {
    throw new ChatLlmProviderError('gemini', 404, 'No generateContent-capable Gemini model')
  }
  resolvedGeminiModel = pick.name.replace(/^models\//, '')
  return resolvedGeminiModel
}

async function generateWithGemini(
  system: string,
  messages: ChatMessage[]
): Promise<string> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY as string
  const model = await resolveGeminiModel(apiKey)
  const url = `${GEMINI_BASE}/models/${model}:generateContent?key=${apiKey}`

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
    throw new ChatLlmProviderError('gemini', res.status, `Gemini API ${res.status}`)
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
