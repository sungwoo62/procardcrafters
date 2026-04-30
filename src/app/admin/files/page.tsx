'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  ArrowLeft,
  Loader2,
  Filter,
  RefreshCw,
} from 'lucide-react'

interface ValidationResult {
  isValid: boolean
  warnings: string[]
  errors: string[]
  details: {
    pageCount?: number
    widthMm?: number
    heightMm?: number
    colorSpace?: string
    hasBleed?: boolean
    estimatedDpi?: number
    fileFormatValid: boolean
  }
}

interface FileRecord {
  id: string
  storage_path: string
  original_filename: string
  file_size_bytes: number | null
  mime_type: string | null
  status: 'uploaded' | 'approved' | 'rejected' | 'processing'
  rejection_reason: string | null
  validation_result: ValidationResult | null
  reviewed_at: string | null
  reviewed_by: string | null
  uploaded_at: string
  order_id: string | null
}

const STATUS_STYLE: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  uploaded: { label: 'Pending Review', color: 'bg-yellow-100 text-yellow-700', icon: AlertTriangle },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: XCircle },
  processing: { label: 'Processing', color: 'bg-blue-100 text-blue-700', icon: Loader2 },
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AdminFilesPage() {
  const [secret, setSecret] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [files, setFiles] = useState<FileRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [updating, setUpdating] = useState(false)

  const fetchFiles = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page) })
    if (statusFilter) params.set('status', statusFilter)

    const res = await fetch(`/api/admin/files?${params}`, {
      headers: { 'x-admin-secret': secret },
    })
    if (res.status === 401) {
      setAuthenticated(false)
      setLoading(false)
      return
    }
    const data = await res.json()
    setFiles(data.files ?? [])
    setTotal(data.total ?? 0)
    setTotalPages(data.totalPages ?? 1)
    setLoading(false)
  }, [secret, page, statusFilter])

  useEffect(() => {
    if (authenticated) fetchFiles()
  }, [authenticated, fetchFiles])

  async function updateFileStatus(fileId: string, status: string) {
    setUpdating(true)
    const body: Record<string, string> = { fileId, status }
    if (status === 'rejected' && rejectionReason) {
      body.rejectionReason = rejectionReason
    }

    await fetch('/api/admin/files', {
      method: 'PATCH',
      headers: { 'x-admin-secret': secret, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setUpdating(false)
    setSelectedFile(null)
    setRejectionReason('')
    fetchFiles()
  }

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setAuthenticated(true)
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <form onSubmit={handleLogin} className="bg-white rounded-xl border border-gray-200 p-8 w-full max-w-sm space-y-4">
          <h1 className="text-xl font-bold text-gray-900">File Management</h1>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Admin password"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium text-sm">
            Log In
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-gray-500 hover:text-gray-700">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">File Review</h1>
              <p className="text-sm text-gray-500">{total} files total</p>
            </div>
          </div>
          <button onClick={fetchFiles} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => { setStatusFilter(''); setPage(1) }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${!statusFilter ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            All
          </button>
          {Object.entries(STATUS_STYLE).map(([key, { label }]) => (
            <button
              key={key}
              onClick={() => { setStatusFilter(key); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === key ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-20 text-gray-400">No files found</div>
        ) : (
          <>
            {/* File list */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Filename</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Format</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Size</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Validation</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Uploaded</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => {
                    const statusInfo = STATUS_STYLE[file.status] ?? STATUS_STYLE.uploaded
                    const StatusIcon = statusInfo.icon
                    const validation = file.validation_result
                    const warningCount = validation?.warnings?.length ?? 0

                    return (
                      <tr key={file.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                            <span className="truncate max-w-[200px]">{file.original_filename}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {file.mime_type?.split('/').pop()?.toUpperCase() ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{formatFileSize(file.file_size_bytes)}</td>
                        <td className="px-4 py-3">
                          {validation ? (
                            <div className="flex items-center gap-1">
                              {warningCount > 0 ? (
                                <span className="flex items-center gap-1 text-amber-600 text-xs font-medium">
                                  <AlertTriangle className="w-3.5 h-3.5" /> {warningCount} warning(s)
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                                  <CheckCircle className="w-3.5 h-3.5" /> OK
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">Not validated</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(file.uploaded_at)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setSelectedFile(file)}
                            className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium ${p === page ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* File detail modal */}
        {selectedFile && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedFile(null)}>
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">File Details</h2>
                  <p className="text-sm text-gray-500 truncate max-w-[300px]">{selectedFile.original_filename}</p>
                </div>
                <button onClick={() => setSelectedFile(null)} className="text-gray-400 hover:text-gray-600">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Basic info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-gray-400 text-xs mb-1">Format</div>
                  <div className="font-medium">{selectedFile.mime_type?.split('/').pop()?.toUpperCase()}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-gray-400 text-xs mb-1">Size</div>
                  <div className="font-medium">{formatFileSize(selectedFile.file_size_bytes)}</div>
                </div>
              </div>

              {/* Validation results */}
              {selectedFile.validation_result && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900 text-sm">Validation Results</h3>

                  {/* Details */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {selectedFile.validation_result.details.pageCount !== undefined && (
                      <div className="bg-blue-50 rounded-lg p-2">
                        <span className="text-blue-500">Pages:</span>{' '}
                        <span className="font-medium text-blue-800">{selectedFile.validation_result.details.pageCount}</span>
                      </div>
                    )}
                    {selectedFile.validation_result.details.widthMm !== undefined && (
                      <div className="bg-blue-50 rounded-lg p-2">
                        <span className="text-blue-500">Dimensions:</span>{' '}
                        <span className="font-medium text-blue-800">
                          {selectedFile.validation_result.details.widthMm} × {selectedFile.validation_result.details.heightMm}mm
                        </span>
                      </div>
                    )}
                    {selectedFile.validation_result.details.colorSpace && (
                      <div className={`rounded-lg p-2 ${selectedFile.validation_result.details.colorSpace === 'CMYK' ? 'bg-green-50' : 'bg-amber-50'}`}>
                        <span className={selectedFile.validation_result.details.colorSpace === 'CMYK' ? 'text-green-500' : 'text-amber-500'}>Colors:</span>{' '}
                        <span className={`font-medium ${selectedFile.validation_result.details.colorSpace === 'CMYK' ? 'text-green-800' : 'text-amber-800'}`}>
                          {selectedFile.validation_result.details.colorSpace}
                        </span>
                      </div>
                    )}
                    {selectedFile.validation_result.details.hasBleed !== undefined && (
                      <div className={`rounded-lg p-2 ${selectedFile.validation_result.details.hasBleed ? 'bg-green-50' : 'bg-amber-50'}`}>
                        <span className={selectedFile.validation_result.details.hasBleed ? 'text-green-500' : 'text-amber-500'}>Bleed:</span>{' '}
                        <span className={`font-medium ${selectedFile.validation_result.details.hasBleed ? 'text-green-800' : 'text-amber-800'}`}>
                          {selectedFile.validation_result.details.hasBleed ? 'Yes' : 'No/Insufficient'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Warnings */}
                  {selectedFile.validation_result.warnings.length > 0 && (
                    <div className="space-y-1.5">
                      {selectedFile.validation_result.warnings.map((w, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          {w}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Rejection reason */}
              {selectedFile.status === 'rejected' && selectedFile.rejection_reason && (
                <div className="bg-red-50 rounded-lg p-3 text-sm text-red-700">
                  <span className="font-medium">Rejection reason:</span> {selectedFile.rejection_reason}
                </div>
              )}

              {/* Review actions */}
              {selectedFile.status === 'uploaded' && (
                <div className="space-y-3 border-t border-gray-100 pt-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateFileStatus(selectedFile.id, 'approved')}
                      disabled={updating}
                      className="flex-1 bg-green-600 text-white py-2 rounded-lg font-medium text-sm hover:bg-green-700 disabled:opacity-50"
                    >
                      {updating ? 'Processing...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => {
                        if (!rejectionReason) {
                          setRejectionReason(' ')
                          return
                        }
                        updateFileStatus(selectedFile.id, 'rejected')
                      }}
                      disabled={updating}
                      className="flex-1 bg-red-600 text-white py-2 rounded-lg font-medium text-sm hover:bg-red-700 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                  {rejectionReason !== '' && (
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Enter rejection reason (e.g., low resolution, CMYK conversion needed)"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none h-20"
                    />
                  )}
                </div>
              )}

              {/* Review info */}
              {selectedFile.reviewed_at && (
                <div className="text-xs text-gray-400 pt-2 border-t border-gray-100">
                  Reviewed by: {selectedFile.reviewed_by} · {formatDate(selectedFile.reviewed_at)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
