// OMO-3744: 방문자 자동수집 — 서버측 캡처 헬퍼
// 위젯이 보낸 클라이언트 메타(navigator/screen/Intl/referrer/utm)에 서버측 IP·geo 를
// 합쳐 공유 cs_visitor_profiles(최신 상태 upsert) + cs_page_views(1:N 로그)에 기록한다.
// cs_visitor_profiles / cs_page_views 는 cs_ prefix 예외(site 컬럼 공용)로 medal/goods/plaque
// 가 단일 테이블을 공유한다. procard 는 site='procard' 로 기록(US POD). 개인정보 최소수집 원칙.
// (foundational: OMO-3317 / 레퍼런스: plaque OMO-3319)
import type { SupabaseClient } from '@supabase/supabase-js'
import type { VisitorMetaPayload } from '@/types/chat'

export type VisitorMeta = VisitorMetaPayload

export const PROCARD_SITE = 'procard'

/** Vercel/프록시 헤더에서 IP·국가/지역/도시 추출. */
function extractGeo(headers: Headers) {
  const ip = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? headers.get('x-real-ip')
    ?? null
  return {
    ip,
    country: headers.get('x-vercel-ip-country'),
    region: headers.get('x-vercel-ip-country-region'),
    city: (() => {
      const c = headers.get('x-vercel-ip-city')
      return c ? decodeURIComponent(c) : null
    })(),
  }
}

/** referrer/utm 에서 SNS/유입 채널 추론(최선노력). */
export function inferSnsChannel(meta: VisitorMeta): string | null {
  if (meta.snsChannel) return meta.snsChannel
  const ref = (meta.referrer ?? '').toLowerCase()
  const src = (meta.utmSource ?? '').toLowerCase()
  const hay = `${ref} ${src}`
  const map: Record<string, string> = {
    instagram: 'instagram', 'instagr.am': 'instagram',
    'facebook.': 'facebook', 'fb.': 'facebook',
    'youtube.': 'youtube', 'youtu.be': 'youtube',
    'tiktok': 'tiktok', 'threads': 'threads',
    'linkedin': 'linkedin', 'pinterest': 'pinterest',
    'twitter': 'twitter', 't.co': 'twitter',
    'bing.': 'bing', 'google.': 'google',
  }
  for (const key of Object.keys(map)) {
    if (hay.includes(key)) return map[key]
  }
  return null
}

/**
 * 방문자 프로필 upsert + 페이지뷰 기록.
 * 실패해도 throw 하지 않는다(상담 흐름 비차단).
 * @param isNewSession true 면 session_count +1.
 */
export async function captureVisitor(
  supabase: SupabaseClient,
  visitorId: string,
  meta: VisitorMeta | undefined,
  headers: Headers,
  opts: { sessionId?: string; isNewSession?: boolean } = {},
): Promise<void> {
  if (!visitorId) return
  const m = meta ?? {}
  const sns = inferSnsChannel(m)
  const geo = extractGeo(headers)
  const { sessionId, isNewSession } = opts
  const site = PROCARD_SITE

  try {
    const { data: existing } = await supabase
      .from('cs_visitor_profiles')
      .select('visit_count, session_count')
      .eq('visitor_id', visitorId)
      .eq('site', site)
      .maybeSingle()

    // null/빈값 필드는 기존 값 보존(덮어쓰지 않음)
    const fields = {
      device: m.device, os: m.os, browser: m.browser,
      screen_resolution: m.screenResolution, locale: m.locale,
      timezone: m.timezone, user_agent: m.userAgent,
      ip: geo.ip, country: geo.country, region: geo.region, city: geo.city,
      referrer: m.referrer, landing_url: m.landingUrl,
      utm_source: m.utmSource, utm_medium: m.utmMedium,
      utm_campaign: m.utmCampaign, utm_term: m.utmTerm, utm_content: m.utmContent,
      sns_channel: sns, current_page_url: m.currentPageUrl,
    }
    const defined = Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v != null && v !== ''),
    )

    if (existing) {
      await supabase
        .from('cs_visitor_profiles')
        .update({
          ...defined,
          visit_count: (existing.visit_count ?? 0) + 1,
          session_count: isNewSession ? (existing.session_count ?? 0) + 1 : existing.session_count,
          last_seen_at: new Date().toISOString(),
        })
        .eq('visitor_id', visitorId)
        .eq('site', site)
    } else {
      await supabase.from('cs_visitor_profiles').insert({
        visitor_id: visitorId,
        site,
        ...defined,
        landing_url: m.landingUrl ?? m.currentPageUrl ?? null,
        visit_count: 1,
        session_count: isNewSession ? 1 : 0,
      })
    }

    // 페이지뷰 로그(1:N) — session_id 로 admin 상세에서 세션↔방문자 연결.
    if (m.currentPageUrl || m.landingUrl) {
      await supabase.from('cs_page_views').insert({
        visitor_id: visitorId,
        site,
        session_id: sessionId ?? null,
        page_url: m.currentPageUrl ?? m.landingUrl ?? null,
        referrer: m.referrer ?? null,
        utm_source: m.utmSource ?? null,
        utm_medium: m.utmMedium ?? null,
        utm_campaign: m.utmCampaign ?? null,
      })
    }
  } catch {
    // 수집 실패는 상담 흐름을 막지 않는다.
  }
}
