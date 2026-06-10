import { createHmac, timingSafeEqual } from 'crypto'

// OMO-2807: Resend 수신 웹훅 서명 검증.
// Resend 는 Svix(Standard Webhooks) 서명 스킴을 사용한다.
//   signedContent = `${id}.${timestamp}.${payload}`
//   signature     = base64( HMAC-SHA256(secretBytes, signedContent) )
//   svix-signature 헤더 = 공백 구분 `v1,<sig>` 리스트
//   secret 은 `whsec_` 접두사 뒤가 base64 인코딩된 키
// 외부 의존성(svix) 추가 없이 Node crypto 로 직접 구현(코드베이스 HMAC 관례와 동일).

const TOLERANCE_SECONDS = 5 * 60

export interface ResendWebhookHeaders {
  id: string | null
  timestamp: string | null
  signature: string | null
}

/** Headers 객체에서 Svix/Standard-Webhooks 헤더를 추출(두 표기 모두 허용). */
export function extractWebhookHeaders(headers: Headers): ResendWebhookHeaders {
  return {
    id: headers.get('svix-id') ?? headers.get('webhook-id'),
    timestamp: headers.get('svix-timestamp') ?? headers.get('webhook-timestamp'),
    signature: headers.get('svix-signature') ?? headers.get('webhook-signature'),
  }
}

export interface VerifyResult {
  valid: boolean
  reason?: string
}

/**
 * Resend(Svix) 웹훅 서명을 검증한다.
 * @param payload   원문(raw) 요청 바디 — JSON.parse 이전 문자열이어야 한다.
 * @param headers   추출된 웹훅 헤더
 * @param secret    RESEND_WEBHOOK_SECRET (whsec_ 접두사 포함/미포함 모두 허용)
 * @param nowSeconds 현재 epoch 초(테스트 주입용). 미지정 시 타임스탬프 허용오차 검사 생략.
 */
export function verifyResendSignature(
  payload: string,
  headers: ResendWebhookHeaders,
  secret: string,
  nowSeconds?: number
): VerifyResult {
  const { id, timestamp, signature } = headers
  if (!id || !timestamp || !signature) {
    return { valid: false, reason: 'missing_headers' }
  }
  if (!secret) {
    return { valid: false, reason: 'missing_secret' }
  }

  const ts = Number(timestamp)
  if (!Number.isFinite(ts)) {
    return { valid: false, reason: 'invalid_timestamp' }
  }
  if (nowSeconds !== undefined && Math.abs(nowSeconds - ts) > TOLERANCE_SECONDS) {
    return { valid: false, reason: 'timestamp_out_of_tolerance' }
  }

  const secretBody = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret
  const secretBytes = Buffer.from(secretBody, 'base64')

  const signedContent = `${id}.${timestamp}.${payload}`
  const expected = createHmac('sha256', secretBytes).update(signedContent).digest('base64')
  const expectedBuf = Buffer.from(expected, 'base64')

  // svix-signature 헤더는 공백 구분 `v1,<sig>` 리스트. 키 롤오버 시 여러 개일 수 있다.
  const passed = signature.split(' ').some((part) => {
    const commaIdx = part.indexOf(',')
    if (commaIdx < 0) return false
    const version = part.slice(0, commaIdx)
    const sig = part.slice(commaIdx + 1)
    if (version !== 'v1' || !sig) return false
    const sigBuf = Buffer.from(sig, 'base64')
    if (sigBuf.length !== expectedBuf.length || sigBuf.length === 0) return false
    return timingSafeEqual(sigBuf, expectedBuf)
  })

  return passed ? { valid: true } : { valid: false, reason: 'signature_mismatch' }
}
