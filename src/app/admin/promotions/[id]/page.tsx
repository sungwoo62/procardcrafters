'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Lock, Unlock, AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react'

interface PromoCode {
  id: string
  code: string
  discount_pct: number
  discount_tier: string
  status: string
  valid_from: string
  valid_until: string
  max_uses: number | null
  per_user_max: number
  campaign?: { id: string; headline_ko: string | null; status: string } | null
}

interface LockEvent {
  id: string
  action: 'locked' | 'unlocked'
  reason: string | null
  context: Record<string, unknown> | null
  created_at: string
}

interface Stats {
  redemptions_1h: number
  redemptions_total: number
}

const REASON_LABELS: Record<string, string> = {
  abuse_auto_lock: '자동 잠금 (abuse)',
  admin_manual_lock: '수동 잠금 (어드민)',
  admin_manual_unlock: '수동 해제 (어드민)',
  margin_alert: 'margin 음수 자동 잠금',
}

export default function PromoCodeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [code, setCode] = useState<PromoCode | null>(null)
  const [lockHistory, setLockHistory] = useState<LockEvent[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    const res = await fetch(`/api/admin/promo-codes/${id}`)
    if (res.status === 401) { router.push('/admin/login'); return }
    if (!res.ok) { setError('코드 정보를 불러올 수 없습니다.'); setLoading(false); return }
    const data = await res.json()
    setCode(data.code)
    setLockHistory(data.lockHistory)
    setStats(data.stats)
    setLoading(false)
  }, [id, router])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleLockToggle(action: 'lock' | 'unlock') {
    if (!code) return
    setActionLoading(true)
    setError('')
    const res = await fetch(`/api/admin/promo-codes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? '작업 실패')
    } else {
      await fetchData()
    }
    setActionLoading(false)
  }

  const isLocked = code?.status === 'locked'
  const isActive = code?.status === 'active'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        {/* 헤더 */}
        <div className="flex items-center gap-3">
          <Link
            href="/admin/promotions"
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            프로모션 목록
          </Link>
        </div>

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">프로모 코드 상세</h1>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl bg-white border border-gray-200 p-8 text-center text-sm text-gray-400">
            불러오는 중...
          </div>
        ) : code ? (
          <>
            {/* 코드 정보 카드 */}
            <div className="rounded-2xl bg-white border border-gray-200 p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-gray-500 font-medium mb-1">프로모 코드</p>
                  <p className="text-2xl font-mono font-bold text-gray-900">{code.code}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                    code.status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : code.status === 'locked'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {code.status === 'active'
                    ? '사용 가능'
                    : code.status === 'locked'
                      ? '잠금'
                      : code.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 pt-2 border-t border-gray-100">
                {[
                  { label: '할인율', value: `${code.discount_pct}%` },
                  { label: '티어', value: code.discount_tier },
                  {
                    label: '유효 기간',
                    value: `${new Date(code.valid_from).toLocaleDateString('ko-KR')} ~ ${new Date(code.valid_until).toLocaleDateString('ko-KR')}`,
                  },
                  {
                    label: '사용 횟수',
                    value: `${stats?.redemptions_total ?? '-'}${code.max_uses ? ` / ${code.max_uses}` : ''}`,
                  },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                    <p className="text-sm font-medium text-gray-900">{value}</p>
                  </div>
                ))}
              </div>

              {/* 1h 통계 */}
              {stats && (
                <div
                  className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${
                    stats.redemptions_1h >= 80
                      ? 'bg-red-50 text-red-700'
                      : stats.redemptions_1h >= 50
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-gray-50 text-gray-600'
                  }`}
                >
                  {stats.redemptions_1h >= 80 && (
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                  )}
                  <span>
                    최근 1시간 사용: <strong>{stats.redemptions_1h}회</strong>
                    {stats.redemptions_1h >= 80 && ' — 임계값 접근 중 (100회 초과 시 자동 잠금)'}
                  </span>
                </div>
              )}

              {/* 캠페인 연결 정보 */}
              {code.campaign && (
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-1">연결 캠페인</p>
                  <p className="text-sm font-medium text-gray-900">
                    {code.campaign.headline_ko ?? '(제목 없음)'}
                    <span className="ml-2 text-xs text-gray-400">({code.campaign.status})</span>
                  </p>
                </div>
              )}
            </div>

            {/* Lock / Unlock 버튼 */}
            <div className="flex gap-3">
              {isActive && (
                <button
                  onClick={() => handleLockToggle('lock')}
                  disabled={actionLoading}
                  className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  <Lock className="h-4 w-4" />
                  {actionLoading ? '처리 중...' : 'Lock code'}
                </button>
              )}
              {isLocked && (
                <button
                  onClick={() => handleLockToggle('unlock')}
                  disabled={actionLoading}
                  className="flex items-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  <Unlock className="h-4 w-4" />
                  {actionLoading ? '처리 중...' : 'Unlock code'}
                </button>
              )}
            </div>

            {/* 잠금 이력 */}
            <div className="rounded-2xl bg-white border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">잠금 이력</h2>
              {lockHistory.length === 0 ? (
                <p className="text-sm text-gray-400">잠금 이력 없음</p>
              ) : (
                <div className="space-y-2">
                  {lockHistory.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start gap-3 rounded-lg border border-gray-100 px-4 py-3"
                    >
                      <span
                        className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                          event.action === 'locked' ? 'bg-red-500' : 'bg-green-500'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {event.action === 'locked' ? '잠금' : '잠금 해제'}
                          {event.reason && (
                            <span className="ml-2 text-xs font-normal text-gray-500">
                              {REASON_LABELS[event.reason] ?? event.reason}
                            </span>
                          )}
                        </p>
                        {event.context && Object.keys(event.context).length > 0 && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {Object.entries(event.context)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(', ')}
                          </p>
                        )}
                      </div>
                      <time className="shrink-0 text-xs text-gray-400">
                        {new Date(event.created_at).toLocaleString('ko-KR', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </time>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-500">코드를 찾을 수 없습니다.</p>
        )}
      </div>
    </div>
  )
}
