// OMO-2840: 견적/주문 회신메일 샘플을 실제 빌더(buildOrderStatusEmail)로 렌더해 HTML 파일로 출력.
// 산출물 PNG 는 이 HTML 을 헤드리스 Chrome 으로 스크린샷하여 생성한다.
import { writeFileSync, mkdirSync } from 'node:fs'
import { buildOrderStatusEmail, SAMPLE_ORDER_EMAIL_DATA } from '../src/lib/email.ts'

const built = buildOrderStatusEmail('paid', SAMPLE_ORDER_EMAIL_DATA)
if (!built) throw new Error('빌더가 null 반환')

// 테스트 발송 시 제목에 붙는 [테스트] 프리픽스를 그대로 반영
const subject = `[테스트] ${built.subject}`

const page = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<style>body{margin:0;background:#f3f4f6;padding:24px;font-family:sans-serif}
.frame{max-width:640px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden}
.subject{background:#111827;color:#fff;padding:12px 20px;font-size:14px;font-weight:600}
.body{padding:20px}</style></head>
<body><div class="frame"><div class="subject">제목: ${subject}</div><div class="body">${built.html}</div></div></body></html>`

mkdirSync('docs/quote-samples/print', { recursive: true })
writeFileSync('docs/quote-samples/print/email-sample.html', page)
console.log('wrote docs/quote-samples/print/email-sample.html')
console.log('subject:', subject)
