'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { MessageCircle, X, Send, Loader2, ExternalLink } from 'lucide-react'
import Link from 'next/link'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Estimate {
  product: string
  quantity: number
  size: string
  finish: string
  priceUsd: number
}

// 세션 ID를 브라우저 스토리지에서 가져오거나 새로 생성
function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  const key = 'pccf_chat_session'
  let id = sessionStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(key, id)
  }
  return id
}

const WELCOME_MESSAGE: Message = {
  role: 'assistant',
  content:
    "Hi there! 👋 I'm your print specialist at Procardcrafters. I can help you get an instant quote for business cards, stickers, flyers, postcards, or posters.\n\nWhat would you like to print today?",
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [estimate, setEstimate] = useState<Estimate | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const sessionId = useRef('')

  useEffect(() => {
    sessionId.current = getSessionId()
  }, [])

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      inputRef.current?.focus()
    }
  }, [isOpen, messages])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: newMessages,
        sessionId: sessionId.current,
      }),
    })

    setLoading(false)

    if (!res.ok) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
        },
      ])
      return
    }

    const data = await res.json()
    setMessages((prev) => [...prev, { role: 'assistant', content: data.text }])
    if (data.estimate) setEstimate(data.estimate)
  }, [input, loading, messages])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function resetChat() {
    setMessages([WELCOME_MESSAGE])
    setEstimate(null)
    setInput('')
    // 새 세션 시작
    sessionStorage.removeItem('pccf_chat_session')
    sessionId.current = getSessionId()
  }

  return (
    <>
      {/* 플로팅 버튼 */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        aria-label="인쇄 견적 챗봇 열기"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gray-900 text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {/* 채팅 패널 */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 flex w-80 flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl sm:w-96">
          {/* 헤더 */}
          <div className="flex items-center justify-between rounded-t-2xl bg-gray-900 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-white">Print Quote Assistant</p>
              <p className="text-xs text-gray-400">Instant estimates · No signup needed</p>
            </div>
            <button
              onClick={resetChat}
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              New chat
            </button>
          </div>

          {/* 메시지 목록 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-80">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-gray-900 text-white rounded-br-sm'
                      : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* 견적 CTA */}
          {estimate && (
            <div className="mx-4 mb-3 rounded-xl bg-gray-50 border border-gray-200 p-3">
              <p className="text-xs font-semibold text-gray-700 mb-1">Your Estimate</p>
              <p className="text-sm text-gray-600">
                {estimate.quantity}× {estimate.product} ({estimate.size}, {estimate.finish})
              </p>
              <p className="text-lg font-bold text-gray-900 mt-1">
                ${estimate.priceUsd.toFixed(2)}
              </p>
              <Link
                href={`/order?product=${encodeURIComponent(estimate.product)}&quantity=${estimate.quantity}`}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-gray-900 py-2 text-xs font-semibold text-white hover:bg-gray-700 transition-colors"
              >
                Place Order <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          )}

          {/* 입력창 */}
          <div className="flex items-center gap-2 border-t border-gray-100 px-3 py-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about pricing..."
              disabled={loading}
              className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-gray-400 disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              aria-label="메시지 전송"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gray-900 text-white transition-colors hover:bg-gray-700 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
