// OMO-3028 [OMO-3019-3]: 결제후 업로드 시안 동의/책임 고지 문구.
//
// ⚠️ 법적 책임 고지 문구는 보드 승인 게이트(OMO-2760) 필수.
//    아래 DRAFT 문구는 승인 전 placeholder 다. 승인 전에는:
//      · UI 에 "법무 검토 중" 배지를 함께 노출한다(고객 오인 방지).
//      · 동의 레코드는 정상 기록하되 consent_version 으로 DRAFT 임을 추적한다.
//    보드 승인 후 APPROVED 문구로 교체하고 CONSENT_APPROVED=true, 버전을 올린다.
//
// 동의 텍스트/버전은 분쟁 대비로 동의 시점 그대로 print_design_consents 에 스냅샷된다.

/** 현재 라이브 동의 문구가 보드 승인을 받았는지. 승인 전 false. */
export const CONSENT_APPROVED = false

/**
 * 동의 문구 버전. 문구가 바뀔 때마다 올린다.
 * draft- prefix 는 보드 미승인 상태를 의미한다(분쟁 시 어떤 문구에 동의했는지 추적).
 */
export const CONSENT_VERSION = 'draft-2026-06-13'

/**
 * 책임 고지 동의 문구(전문). 고객이 체크박스로 명시 동의하는 본문.
 * 승인 전 placeholder — 법무 확정 문구로 교체 예정.
 */
export const CONSENT_TEXT = [
  '업로드한 인쇄 파일의 내용(오탈자, 이미지, 색상, 레이아웃, 연락처 등)을 직접 최종 확인했습니다.',
  '인쇄는 업로드된 파일 그대로 진행되며, 파일 내용으로 인해 발생하는 문제에 대한 책임은 주문 고객에게 있습니다.',
  '규격 프리플라이트 경고(해상도/블리드/색상 등)가 표시된 경우, 그 내용을 확인했고 그대로 인쇄 진행에 동의합니다.',
].join('\n')

/** 동의 체크박스 옆에 한 줄로 노출하는 짧은 동의문(요약). */
export const CONSENT_SHORT = '오탈자·내용 확인을 완료했으며, 파일 내용으로 발생하는 이슈는 고객 책임임에 동의합니다.'

export interface ConsentCopy {
  approved: boolean
  version: string
  text: string
  short: string
}

/** UI/API 공용 동의 문구 페이로드. */
export function getConsentCopy(): ConsentCopy {
  return {
    approved: CONSENT_APPROVED,
    version: CONSENT_VERSION,
    text: CONSENT_TEXT,
    short: CONSENT_SHORT,
  }
}
