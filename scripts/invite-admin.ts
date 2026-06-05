/**
 * Admin 계정 초대 스크립트 (OMO-2401)
 *
 * Supabase Auth Admin API로 사용자 invite 메일을 발송한다.
 * 보드가 메일 링크로 비밀번호를 직접 설정한 뒤 /admin 으로 로그인한다.
 *
 * 비밀번호를 Paperclip / Slack / 코멘트에 절대 게시하지 않는다.
 *
 * 실행:
 *   node --experimental-strip-types --env-file=.env.local scripts/invite-admin.ts board@example.com
 *
 * 환경변수 필요:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (service role — 절대 클라이언트 노출 금지)
 *
 * 사후 작업:
 *   1. Vercel env (production/preview) `ADMIN_EMAILS` 에 해당 이메일 추가
 *      쉼표 구분, 예: ADMIN_EMAILS=board@example.com,ops@example.com
 *   2. `.env.local` 동일하게 추가 (로컬 admin 테스트용)
 *   3. 보드가 메일 링크로 비밀번호 설정 → /admin/login 접근 검증
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://omoongmoo.com'

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.')
  process.exit(1)
}

const targetEmail = process.argv[2]?.trim().toLowerCase()
if (!targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
  console.error('사용법: node --experimental-strip-types --env-file=.env.local scripts/invite-admin.ts <email>')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  console.log(`[invite-admin] target=${targetEmail}`)

  const { data: invite, error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(targetEmail, {
    redirectTo: `${SITE_URL}/admin/login`,
  })

  if (inviteErr) {
    // 이미 가입된 이메일이면 비밀번호 재설정 메일을 발송한다.
    const alreadyExists = /already.*registered|user.*exists|email.*taken/i.test(inviteErr.message)
    if (!alreadyExists) {
      console.error('[invite-admin] invite 실패:', inviteErr.message)
      process.exit(1)
    }
    console.log('[invite-admin] 기존 사용자 — 비밀번호 재설정 메일 발송 시도')
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(targetEmail, {
      redirectTo: `${SITE_URL}/admin/login`,
    })
    if (resetErr) {
      console.error('[invite-admin] 재설정 메일 실패:', resetErr.message)
      process.exit(1)
    }
  } else {
    console.log(`[invite-admin] invite 전송 완료 — user_id=${invite.user?.id ?? 'unknown'}`)
  }

  console.log('')
  console.log('다음 단계:')
  console.log(`  1. Vercel env ADMIN_EMAILS 에 ${targetEmail} 추가 (production + preview)`)
  console.log(`  2. .env.local 의 ADMIN_EMAILS 에도 동일하게 추가`)
  console.log(`  3. 보드가 메일에서 비밀번호 설정 → ${SITE_URL}/admin/login 으로 로그인`)
}

main().catch((err) => {
  console.error('[invite-admin] 예외:', err)
  process.exit(1)
})
