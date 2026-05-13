'use client'

import { useState, useRef } from 'react'
import { UploadCloud, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'

interface RejectedFile {
  id: string
  original_filename: string
  rejection_reason: string | null
}

interface Props {
  file: RejectedFile
  orderNumber: string
}

export default function RejectedFileUpload({ file, orderNumber }: Props) {
  const [state, setState] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) return

    setState('uploading')
    setErrorMsg('')

    const form = new FormData()
    form.append('file', selected)
    form.append('orderNumber', orderNumber)

    const res = await fetch(`/api/files/${file.id}`, { method: 'PATCH', body: form })

    if (res.ok) {
      setState('success')
    } else {
      const body = await res.json().catch(() => ({}))
      setErrorMsg(body.error ?? '업로드에 실패했습니다. 다시 시도해 주세요.')
      setState('error')
    }
  }

  if (state === 'success') {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
        <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
        <div>
          <p className="font-semibold text-green-800">파일이 재제출되었습니다</p>
          <p className="mt-1 text-sm text-green-700">검토 후 다음 단계로 진행됩니다.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3" id="reupload">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-red-800">파일 검토 결과: 반려</p>
          <p className="mt-0.5 text-sm text-red-700 font-mono break-all">{file.original_filename}</p>
          {file.rejection_reason && (
            <p className="mt-2 text-sm text-red-700">
              <span className="font-medium">반려 사유: </span>{file.rejection_reason}
            </p>
          )}
        </div>
      </div>

      <div className="pl-8">
        <p className="text-sm text-gray-700 mb-2">
          파일을 수정한 후 아래에서 교체 파일을 업로드해 주세요.
          지원 형식: PDF, AI, PSD, PNG, JPG, TIFF / 최대 200MB / 300 DPI 이상
        </p>

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.ai,.eps,.psd,.png,.jpg,.jpeg,.tiff,.tif"
          className="hidden"
          onChange={handleChange}
          disabled={state === 'uploading'}
        />

        <button
          onClick={() => inputRef.current?.click()}
          disabled={state === 'uploading'}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
        >
          {state === 'uploading' ? (
            <><Loader2 className="h-4 w-4 animate-spin" />업로드 중...</>
          ) : (
            <><UploadCloud className="h-4 w-4" />교체 파일 업로드</>
          )}
        </button>

        {state === 'error' && (
          <p className="mt-2 text-sm text-red-600">{errorMsg}</p>
        )}
      </div>
    </div>
  )
}
