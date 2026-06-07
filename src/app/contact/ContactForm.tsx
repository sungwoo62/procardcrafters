'use client'

import { useState } from 'react'
import { Send, CheckCircle2 } from 'lucide-react'

// OMO-2612: 사람 채널 CS 인입 캡처용 문의폼.
// 제출 시 POST /api/contact → recordCsThread(channel:'contact_form')로 opened_at 기록.

export default function ContactForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [orderNumber, setOrderNumber] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('submitting')
    setError(null)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, orderNumber, subject, message }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? '문의 접수에 실패했습니다. 다시 시도해 주세요.')
        setStatus('idle')
        return
      }
      setStatus('success')
    } catch {
      setError('네트워크 오류가 발생했습니다. 다시 시도해 주세요.')
      setStatus('idle')
    }
  }

  if (status === 'success') {
    return (
      <div className="border border-green-200 bg-green-50 rounded-xl p-8 text-center">
        <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
        <h2 className="font-semibold text-gray-900 mb-2">문의가 접수되었습니다</h2>
        <p className="text-sm text-gray-600">
          영업일 기준 24시간 이내에 입력하신 이메일로 답변드리겠습니다.
        </p>
      </div>
    )
  }

  const inputClass =
    'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'

  return (
    <form onSubmit={handleSubmit} className="space-y-4 border border-gray-200 rounded-xl p-6 bg-white">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            이름
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="홍길동"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            이메일 <span className="text-red-500">*</span>
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder="you@example.com"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="orderNumber" className="block text-sm font-medium text-gray-700 mb-1">
            주문번호 <span className="text-gray-400">(선택)</span>
          </label>
          <input
            id="orderNumber"
            type="text"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            className={inputClass}
            placeholder="PCC-12345"
          />
        </div>
        <div>
          <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
            제목 <span className="text-gray-400">(선택)</span>
          </label>
          <input
            id="subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className={inputClass}
            placeholder="문의 제목"
          />
        </div>
      </div>

      <div>
        <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
          문의 내용 <span className="text-red-500">*</span>
        </label>
        <textarea
          id="message"
          required
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className={inputClass}
          placeholder="문의하실 내용을 자세히 적어주세요."
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        <Send className="w-4 h-4" />
        {status === 'submitting' ? '전송 중…' : '문의 보내기'}
      </button>
    </form>
  )
}
