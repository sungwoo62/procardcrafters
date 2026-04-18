'use client'

import { useEffect, useState, useCallback } from 'react'
import { MessageCircle, ChevronDown, ChevronUp } from 'lucide-react'

interface ChatSession {
  session_id: string
  created_at: string
  estimate_product: string | null
  estimate_price_usd: number | null
}

interface ChatMessage {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  estimate_product: string | null
  estimate_quantity: number | null
  estimate_size: string | null
  estimate_finish: string | null
  estimate_price_usd: number | null
  created_at: string
}

export default function AdminChatsPage() {
  const [secret, setSecret] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedSession, setExpandedSession] = useState<string | null>(null)
  const [sessionMessages, setSessionMessages] = useState<Record<string, ChatMessage[]>>({})
  const [loadingSession, setLoadingSession] = useState<string | null>(null)

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    setError('')
    const res = await fetch(`/api/admin/chats?page=${page}`, {
      headers: { 'x-admin-secret': secret },
    })

    if (res.status === 401) {
      setAuthenticated(false)
      setError('인증 실패. 비밀번호를 확인하세요.')
      setLoading(false)
      return
    }

    const data = await res.json()
    setSessions(data.sessions ?? [])
    setLoading(false)
  }, [secret, page])

  useEffect(() => {
    if (authenticated) fetchSessions()
  }, [authenticated, fetchSessions])

  async function toggleSession(sessionId: string) {
    if (expandedSession === sessionId) {
      setExpandedSession(null)
      return
    }

    setExpandedSession(sessionId)

    if (sessionMessages[sessionId]) return

    setLoadingSession(sessionId)
    const res = await fetch(`/api/admin/chats/${sessionId}`, {
      headers: { 'x-admin-secret': secret },
    })
    const data = await res.json()
    setSessionMessages((prev) => ({ ...prev, [sessionId]: data.messages ?? [] }))
    setLoadingSession(null)
  }

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setAuthenticated(true)
  }

  if (!authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-md"
        >
          <h1 className="mb-6 text-xl font-bold text-gray-900">Admin — Chat Logs</h1>
          {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
          <input
            type="password"
            placeholder="Admin password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            className="mb-4 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none focus:border-gray-400"
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white hover:bg-gray-700 transition-colors"
          >
            로그인
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center gap-3">
          <MessageCircle className="h-6 w-6 text-gray-700" />
          <h1 className="text-2xl font-bold text-gray-900">AI 챗봇 대화 이력</h1>
        </div>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        {loading ? (
          <p className="text-sm text-gray-500">불러오는 중...</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-gray-500">아직 채팅 세션이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => {
              const isExpanded = expandedSession === session.session_id
              const msgs = sessionMessages[session.session_id] ?? []
              const isLoadingMsgs = loadingSession === session.session_id

              return (
                <div
                  key={session.session_id}
                  className="rounded-2xl border border-gray-200 bg-white overflow-hidden"
                >
                  <button
                    onClick={() => toggleSession(session.session_id)}
                    className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-mono text-gray-400">
                        {session.session_id.slice(0, 8)}…
                      </span>
                      <span className="text-sm text-gray-700">
                        {new Date(session.created_at).toLocaleString('ko-KR')}
                        {session.estimate_product && (
                          <span className="ml-3 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                            {session.estimate_product} — ${session.estimate_price_usd?.toFixed(2)}
                          </span>
                        )}
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-100 px-5 py-4 space-y-3 bg-gray-50">
                      {isLoadingMsgs ? (
                        <p className="text-xs text-gray-400">불러오는 중...</p>
                      ) : msgs.length === 0 ? (
                        <p className="text-xs text-gray-400">메시지 없음</p>
                      ) : (
                        msgs.map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed ${
                                msg.role === 'user'
                                  ? 'bg-gray-900 text-white rounded-br-sm'
                                  : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm'
                              }`}
                            >
                              {msg.content}
                              {msg.estimate_price_usd && (
                                <div className="mt-1.5 rounded-lg bg-gray-100 px-2 py-1 text-xs text-gray-600">
                                  견적: {msg.estimate_product} {msg.estimate_quantity}장 ({msg.estimate_size},{' '}
                                  {msg.estimate_finish}) — ${msg.estimate_price_usd.toFixed(2)}
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* 페이지네이션 */}
        <div className="mt-6 flex items-center justify-between">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            이전
          </button>
          <span className="text-sm text-gray-500">페이지 {page}</span>
          <button
            disabled={sessions.length < 50}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            다음
          </button>
        </div>
      </div>
    </div>
  )
}
