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
      setErrorMsg(body.error ?? 'Upload failed. Please try again.')
      setState('error')
    }
  }

  if (state === 'success') {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
        <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
        <div>
          <p className="font-semibold text-green-800">Replacement file submitted</p>
          <p className="mt-1 text-sm text-green-700">We will review and proceed to the next step.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3" id="reupload">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-red-800">File review result: Rejected</p>
          <p className="mt-0.5 text-sm text-red-700 font-mono break-all">{file.original_filename}</p>
          {file.rejection_reason && (
            <p className="mt-2 text-sm text-red-700">
              <span className="font-medium">Reason: </span>{file.rejection_reason}
            </p>
          )}
        </div>
      </div>

      <div className="pl-8">
        <p className="text-sm text-gray-700 mb-2">
          Please correct the file and upload a replacement below.
          Supported: PDF, AI, PSD, PNG, JPG, TIFF · Max 200MB · 300 DPI+
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
            <><Loader2 className="h-4 w-4 animate-spin" />Uploading…</>
          ) : (
            <><UploadCloud className="h-4 w-4" />Upload replacement</>
          )}
        </button>

        {state === 'error' && (
          <p className="mt-2 text-sm text-red-600">{errorMsg}</p>
        )}
      </div>
    </div>
  )
}
