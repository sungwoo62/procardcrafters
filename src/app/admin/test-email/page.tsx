'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail, Send, ArrowLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

// OMO-2840: 견적/주문 회신메일을 고객에게 나갈 것과 동일하게 임의 주소로 테스트 발송하는 어드민 페이지.

const SAMPLE_TYPES: { value: string; label: string }[] = [
  { value: 'paid', label: '주문 확정 안내 (대표)' },
  { value: 'pending', label: '주문 접수 · 결제 대기' },
  { value: 'processing', label: '제작 시작 안내' },
  { value: 'shipped', label: '배송 시작 안내' },
  { value: 'delivered', label: '배송 완료 안내' },
  { value: 'cancelled', label: '주문 취소 안내' },
  { value: 'refunded', label: '환불 안내' },
]

interface SendResult {
  ok: boolean
  sent: boolean
  source: 'order' | 'sample'
  subject: string
  html: string
  message: string
}

export default function TestEmailPage() {
  const [toEmail, setToEmail] = useState('')
  const [orderId, setOrderId] = useState('')
  const [sampleType, setSampleType] = useState('paid')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SendResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSend() {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/admin/test-quote-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail: toEmail.trim(),
          sampleType,
          orderId: orderId.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? '발송에 실패했습니다.')
      } else {
        setResult(json as SendResult)
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> 관리자 홈
      </Link>

      <div className="flex items-center gap-2 mb-1">
        <Mail className="w-6 h-6 text-gray-800" />
        <h1 className="text-2xl font-bold text-gray-900">견적/주문 회신메일 테스트 발송</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        고객에게 실제로 나가는 회신메일과 100% 동일한 내용을, 입력한 주소로만 테스트 발송합니다.
        (실고객·CC·BCC 발송 없음, 제목에 <code>[테스트]</code> 프리픽스가 붙습니다.)
      </p>

      <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            수신 이메일 주소 <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={toEmail}
            onChange={(e) => setToEmail(e.target.value)}
            placeholder="test@example.com"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-800 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">샘플 유형</label>
          <select
            value={sampleType}
            onChange={(e) => setSampleType(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-800 focus:outline-none"
          >
            {SAMPLE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            주문 ID (선택)
          </label>
          <input
            type="text"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="비워두면 대표 샘플 데이터로 발송"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-800 focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-400">
            입력 시 해당 주문의 실데이터로, 비워두면 대표 샘플 데이터로 메일을 구성합니다.
          </p>
        </div>

        <button
          onClick={handleSend}
          disabled={loading || !toEmail.trim()}
          className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          테스트 발송
        </button>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="mt-4 space-y-4">
          <div
            className={`flex items-start gap-2 rounded-md border p-4 text-sm ${
              result.sent
                ? 'border-green-200 bg-green-50 text-green-700'
                : 'border-amber-200 bg-amber-50 text-amber-700'
            }`}
          >
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-medium">{result.message}</p>
              <p className="mt-1 text-xs opacity-80">
                제목: {result.subject} · 데이터:{' '}
                {result.source === 'order' ? '주문 실데이터' : '대표 샘플'}
              </p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">미리보기</p>
            <iframe
              title="email-preview"
              srcDoc={result.html}
              className="w-full rounded-md border border-gray-200 bg-white"
              style={{ height: 520 }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
