'use client'

// OMO-3028 [OMO-3019-3]: 결제후 파일 업로드 → 규격 프리플라이트 → 책임 고지 동의 E2E.
//
// 흐름: 파일 선택 → /api/orders/[no]/upload (검증+프리플라이트) → 통과/경고 표시
//   → 책임 고지 동의 체크 → /api/orders/[no]/consent (동의 영속화) → 완료.
// ⚠️ 책임 고지 문구는 보드 승인 전 placeholder — "법무 검토 중" 배지로 명시.

import { useEffect, useRef, useState } from 'react'
import { UploadCloud, CheckCircle, AlertTriangle, Info, Loader2, ShieldCheck } from 'lucide-react'

interface PreflightCheck {
  key: string
  label: string
  status: 'pass' | 'warn' | 'unknown'
  message: string
}
interface Preflight {
  status: 'pass' | 'warn'
  checks: PreflightCheck[]
}
interface ConsentCopy {
  approved: boolean
  version: string
  text: string
  short: string
}

interface Props {
  orderNumber: string
}

type Phase = 'idle' | 'uploading' | 'review' | 'consenting' | 'done'

export default function PostPaymentUpload({ orderNumber }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const [fileId, setFileId] = useState('')
  const [preflight, setPreflight] = useState<Preflight | null>(null)
  const [consent, setConsent] = useState<ConsentCopy | null>(null)
  const [agreed, setAgreed] = useState(false)
  const [loadingExisting, setLoadingExisting] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  // 이미 동의한 주문이면 완료 상태로 시작 (중복 업로드 방지).
  useEffect(() => {
    let active = true
    fetch(`/api/orders/${orderNumber}/consent`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active) return
        if (data?.consents?.length > 0) setPhase('done')
      })
      .catch(() => null)
      .finally(() => active && setLoadingExisting(false))
    return () => {
      active = false
    }
  }, [orderNumber])

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) return
    setError('')
    setFileName(selected.name)
    setPhase('uploading')

    const form = new FormData()
    form.append('file', selected)

    const res = await fetch(`/api/orders/${orderNumber}/upload`, { method: 'POST', body: form })
    const body = await res.json().catch(() => ({}))

    if (!res.ok) {
      setError(body.error ?? '업로드에 실패했습니다. 다시 시도해 주세요.')
      setPhase('idle')
      return
    }

    setFileId(body.fileId)
    setPreflight(body.preflight)
    setConsent(body.consent)
    setAgreed(false)
    setPhase('review')
  }

  async function handleConsent() {
    if (!agreed || !fileId) return
    setPhase('consenting')
    setError('')

    const res = await fetch(`/api/orders/${orderNumber}/consent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId, agreed: true }),
    })

    if (res.ok) {
      setPhase('done')
    } else {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? '동의 기록에 실패했습니다. 다시 시도해 주세요.')
      setPhase('review')
    }
  }

  if (loadingExisting) {
    return (
      <section className="rounded-2xl border border-gray-200 p-5 text-sm text-gray-400 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> 업로드 상태 확인 중…
      </section>
    )
  }

  if (phase === 'done') {
    return (
      <section className="rounded-2xl border border-green-200 bg-green-50 p-5 flex items-start gap-3">
        <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
        <div>
          <p className="font-semibold text-green-800">인쇄 파일 접수 완료</p>
          <p className="mt-1 text-sm text-green-700">
            파일과 책임 고지 동의가 기록되었습니다. 담당자 검토 후 인쇄가 진행됩니다.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-gray-200 p-5 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <UploadCloud className="h-5 w-5 text-blue-600" /> 인쇄 파일 업로드
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          결제가 완료되었습니다. 인쇄에 사용할 파일을 업로드하면 규격을 자동 점검(프리플라이트)합니다.
        </p>
      </div>

      {/* 업로드 단계 */}
      {(phase === 'idle' || phase === 'uploading') && (
        <div>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.ai,.eps,.psd,.png,.jpg,.jpeg,.tiff,.tif"
            className="hidden"
            onChange={handleFile}
            disabled={phase === 'uploading'}
          />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={phase === 'uploading'}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {phase === 'uploading' ? (
              <><Loader2 className="h-4 w-4 animate-spin" />업로드·점검 중…</>
            ) : (
              <><UploadCloud className="h-4 w-4" />파일 선택</>
            )}
          </button>
          <p className="mt-2 text-xs text-gray-400">PDF, AI, PSD, PNG, JPG, TIFF · 최대 200MB · 권장 300DPI / CMYK</p>
        </div>
      )}

      {/* 프리플라이트 결과 + 동의 단계 */}
      {(phase === 'review' || phase === 'consenting') && preflight && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            업로드 파일: <span className="font-mono break-all">{fileName}</span>
          </p>

          {/* 전체 상태 배너 */}
          <div
            className={`rounded-xl border p-3 flex items-start gap-2 ${
              preflight.status === 'pass'
                ? 'border-green-200 bg-green-50'
                : 'border-amber-200 bg-amber-50'
            }`}
          >
            {preflight.status === 'pass' ? (
              <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
            ) : (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            )}
            <p className={`text-sm font-medium ${preflight.status === 'pass' ? 'text-green-800' : 'text-amber-800'}`}>
              {preflight.status === 'pass'
                ? '규격 점검 통과 — 인쇄 규격에 부합합니다.'
                : '규격 점검 경고 — 아래 항목을 확인해 주세요. 그대로 진행할 수도 있습니다.'}
            </p>
          </div>

          {/* 항목별 체크 */}
          <ul className="space-y-2">
            {preflight.checks.map((c) => (
              <li key={c.key} className="flex items-start gap-2 text-sm">
                {c.status === 'pass' ? (
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                ) : c.status === 'warn' ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                ) : (
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                )}
                <span className="text-gray-700">
                  <span className="font-medium">{c.label}:</span> {c.message}
                </span>
              </li>
            ))}
          </ul>

          {/* 책임 고지 동의 */}
          {consent && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-gray-600" />
                <h3 className="text-sm font-semibold text-gray-900">시안 확인 및 책임 고지</h3>
                {!consent.approved && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                    법무 검토 중(잠정 문구)
                  </span>
                )}
              </div>
              <p className="whitespace-pre-line text-xs leading-relaxed text-gray-600">{consent.text}</p>
              <label className="flex items-start gap-2 text-sm text-gray-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300"
                />
                <span>{consent.short}</span>
              </label>
              <button
                onClick={handleConsent}
                disabled={!agreed || phase === 'consenting'}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {phase === 'consenting' ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />기록 중…</>
                ) : (
                  '동의하고 인쇄 진행'
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  )
}
