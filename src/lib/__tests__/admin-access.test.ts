import { describe, it, expect } from 'vitest'
import { parseAdminEmails, isAllowedAdmin } from '../admin-access'

// OMO-2736 접근 통제 회귀 테스트.
// 핵심 불변식: ADMIN_EMAILS 가 비면 fail-CLOSED (모두 거부).
// 과거 fail-open 버그(allowedEmails.length > 0 && ...)가 재발하지 않도록 고정.

describe('parseAdminEmails', () => {
  it('정규화: 공백 제거 + 소문자화 + 빈 항목 제거', () => {
    expect(parseAdminEmails(' Boss@Example.com , , foo@bar.com ')).toEqual([
      'boss@example.com',
      'foo@bar.com',
    ])
  })

  it('undefined/null/빈 문자열 → 빈 배열', () => {
    expect(parseAdminEmails(undefined)).toEqual([])
    expect(parseAdminEmails(null)).toEqual([])
    expect(parseAdminEmails('')).toEqual([])
    expect(parseAdminEmails('   ')).toEqual([])
  })
})

describe('isAllowedAdmin — fail-closed', () => {
  it('화이트리스트가 비면 어떤 인증 사용자도 거부 (fail-closed)', () => {
    expect(isAllowedAdmin('sungwoo62@gmail.com', '')).toBe(false)
    expect(isAllowedAdmin('sungwoo62@gmail.com', undefined)).toBe(false)
    expect(isAllowedAdmin('sungwoo62@gmail.com', null)).toBe(false)
    expect(isAllowedAdmin('anyone@evil.com', '   ')).toBe(false)
  })

  it('허용 목록에 있는 계정만 통과', () => {
    expect(isAllowedAdmin('sungwoo62@gmail.com', 'sungwoo62@gmail.com')).toBe(true)
  })

  it('허용 목록에 없는 계정은 거부', () => {
    expect(isAllowedAdmin('attacker@evil.com', 'sungwoo62@gmail.com')).toBe(false)
  })

  it('대소문자/공백 무시하고 매칭', () => {
    expect(isAllowedAdmin(' SungWoo62@Gmail.com ', 'sungwoo62@gmail.com')).toBe(true)
  })

  it('다중 허용 목록 처리', () => {
    const allow = 'a@x.com, b@y.com'
    expect(isAllowedAdmin('b@y.com', allow)).toBe(true)
    expect(isAllowedAdmin('c@z.com', allow)).toBe(false)
  })

  it('이메일 없는 사용자(undefined/null/빈) 거부', () => {
    expect(isAllowedAdmin(undefined, 'sungwoo62@gmail.com')).toBe(false)
    expect(isAllowedAdmin(null, 'sungwoo62@gmail.com')).toBe(false)
    expect(isAllowedAdmin('', 'sungwoo62@gmail.com')).toBe(false)
  })
})
