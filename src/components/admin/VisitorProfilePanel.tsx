'use client'

// OMO-3744: procard admin 챗 상세 — 방문자 프로필 + 페이지뷰 타임라인 패널.
// 채널톡 우측 사이드바급 정보(디바이스/유입/UTM/위치/방문이력/페이지뷰)를 표시한다.
// IP 는 서버에서 마스킹되어 전달됨(OMO-2760). 레퍼런스: allpack-ops VisitorProfilePanel.
import { Monitor, Globe, MapPin, History, Eye } from 'lucide-react'
import type {
  VisitorProfile,
  VisitorPageView,
} from '@/lib/chat/visitorProfile'

interface Props {
  profile: VisitorProfile | null
  pageViews: VisitorPageView[]
}

function Row({ label, value }: { label: string; value: string | number | null }) {
  if (value == null || value === '') return null
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <span className="text-xs text-gray-500 flex-shrink-0">{label}</span>
      <span className="text-xs text-gray-800 text-right break-all">{value}</span>
    </div>
  )
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-gray-700">
        {icon}
        {title}
      </div>
      <div className="divide-y divide-gray-50">{children}</div>
    </div>
  )
}

function fmtTime(ts: string | null): string {
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function VisitorProfilePanel({ profile, pageViews }: Props) {
  if (!profile && pageViews.length === 0) {
    return (
      <p className="text-xs text-gray-400">방문자 정보 없음 (수집 이전 세션이거나 차단됨)</p>
    )
  }

  const location =
    profile &&
    [profile.city, profile.region, profile.country].filter(Boolean).join(', ')

  return (
    <div className="space-y-2.5">
      {profile && (
        <>
          <Section icon={<Monitor className="h-3.5 w-3.5" />} title="디바이스·환경">
            <Row label="디바이스" value={profile.device} />
            <Row label="운영체제" value={profile.os} />
            <Row label="브라우저" value={profile.browser} />
            <Row label="화면 해상도" value={profile.screenResolution} />
            <Row label="언어" value={profile.locale} />
            <Row label="시간대" value={profile.timezone} />
          </Section>

          <Section icon={<Globe className="h-3.5 w-3.5" />} title="유입·마케팅">
            <Row label="유입 채널" value={profile.snsChannel} />
            <Row label="리퍼러" value={profile.referrer} />
            <Row label="랜딩 페이지" value={profile.landingUrl} />
            <Row label="UTM 소스" value={profile.utmSource} />
            <Row label="UTM 매체" value={profile.utmMedium} />
            <Row label="UTM 캠페인" value={profile.utmCampaign} />
            <Row label="최근 페이지" value={profile.currentPageUrl} />
          </Section>

          <Section icon={<MapPin className="h-3.5 w-3.5" />} title="위치">
            <Row label="위치" value={location || null} />
            <Row label="IP" value={profile.ipMasked} />
          </Section>

          <Section icon={<History className="h-3.5 w-3.5" />} title="방문 이력">
            <Row label="방문 횟수" value={profile.visitCount} />
            <Row label="세션 수" value={profile.sessionCount} />
            <Row label="최초 방문" value={fmtTime(profile.firstSeenAt)} />
            <Row label="최근 방문" value={fmtTime(profile.lastSeenAt)} />
          </Section>
        </>
      )}

      {pageViews.length > 0 && (
        <Section icon={<Eye className="h-3.5 w-3.5" />} title="페이지뷰 타임라인">
          <ul className="space-y-1.5 pt-1">
            {pageViews.map((pv) => (
              <li key={pv.id} className="text-xs">
                <span className="text-gray-400 mr-2">{fmtTime(pv.createdAt)}</span>
                <span className="text-gray-700 break-all">{pv.pageUrl ?? '—'}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}
