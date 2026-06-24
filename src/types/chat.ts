// OMO-3744: 챗봇 방문자 자동수집 — 클라이언트가 캡처해 서버로 보내는 방문자 메타.
// medal-site / omoongmoo(OMO-3317) / plaque(OMO-3319) 와 동일 형태(하위호환, 전부 선택).
export interface VisitorMetaPayload {
  device?: string
  os?: string
  browser?: string
  screenResolution?: string
  locale?: string
  timezone?: string
  userAgent?: string
  referrer?: string
  landingUrl?: string
  currentPageUrl?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmTerm?: string
  utmContent?: string
  snsChannel?: string
}
