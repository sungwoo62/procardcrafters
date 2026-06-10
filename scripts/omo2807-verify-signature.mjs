// OMO-2807: Resend(Svix) 웹훅 서명 검증 알고리즘 단위 검증.
// src/lib/resend-webhook.ts 의 verifyResendSignature 와 동일한 로직을 Svix 공개 테스트 벡터로 확인한다.
// 실행: node scripts/omo2807-verify-signature.mjs
import { createHmac, timingSafeEqual } from 'crypto'

const TOLERANCE_SECONDS = 5 * 60

function verifyResendSignature(payload, headers, secret, nowSeconds) {
  const { id, timestamp, signature } = headers
  if (!id || !timestamp || !signature) return { valid: false, reason: 'missing_headers' }
  if (!secret) return { valid: false, reason: 'missing_secret' }
  const ts = Number(timestamp)
  if (!Number.isFinite(ts)) return { valid: false, reason: 'invalid_timestamp' }
  if (nowSeconds !== undefined && Math.abs(nowSeconds - ts) > TOLERANCE_SECONDS) {
    return { valid: false, reason: 'timestamp_out_of_tolerance' }
  }
  const secretBody = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret
  const secretBytes = Buffer.from(secretBody, 'base64')
  const signedContent = `${id}.${timestamp}.${payload}`
  const expected = createHmac('sha256', secretBytes).update(signedContent).digest('base64')
  const expectedBuf = Buffer.from(expected, 'base64')
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

// Svix 공식 문서의 알려진 테스트 벡터
const secret = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw'
const id = 'msg_p5jXN8AQM9LWM0D4loKWxJek'
const timestamp = '1614265330'
const payload = '{"test": 2432232314}'
const validSig = 'v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE='

let failures = 0
function check(name, cond) {
  const ok = !!cond
  if (!ok) failures++
  console.log(`${ok ? '✅' : '❌'} ${name}`)
}

// 1) 유효 서명 통과 (타임스탬프 검사 생략)
check('유효 Svix 벡터 통과', verifyResendSignature(payload, { id, timestamp, signature: validSig }, secret).valid === true)

// 2) 변조된 페이로드 거부
check('페이로드 변조 거부', verifyResendSignature(payload + ' ', { id, timestamp, signature: validSig }, secret).valid === false)

// 3) 잘못된 서명 거부
check('잘못된 서명 거부', verifyResendSignature(payload, { id, timestamp, signature: 'v1,AAAA' }, secret).valid === false)

// 4) 헤더 누락 거부
check('헤더 누락 거부', verifyResendSignature(payload, { id: null, timestamp, signature: validSig }, secret).reason === 'missing_headers')

// 5) 여러 서명 중 하나만 맞아도 통과 (키 롤오버)
check('다중 서명 중 1개 일치 통과', verifyResendSignature(payload, { id, timestamp, signature: `v1,wronnnng== ${validSig}` }, secret).valid === true)

// 6) 타임스탬프 허용오차 초과 거부
check('타임스탬프 허용오차 초과 거부', verifyResendSignature(payload, { id, timestamp, signature: validSig }, secret, Number(timestamp) + 999).valid === false)

// 7) 타임스탬프 허용오차 내 통과
check('타임스탬프 허용오차 내 통과', verifyResendSignature(payload, { id, timestamp, signature: validSig }, secret, Number(timestamp) + 60).valid === true)

console.log(failures === 0 ? '\n전체 통과' : `\n실패 ${failures}건`)
process.exit(failures === 0 ? 0 : 1)
