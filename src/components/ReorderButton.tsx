'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'

interface Props {
  orderNumber: string
  className?: string
  variant?: 'primary' | 'secondary' | 'ghost'
  label?: string
}

export default function ReorderButton({
  orderNumber,
  className = '',
  variant = 'secondary',
  label = 'Reorder',
}: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleReorder() {
    const confirmed = window.confirm(
      'Create a new order using the same design, options, and shipping address.\nYou can cancel before payment. Continue?'
    )
    if (!confirmed) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/orders/${orderNumber}/reorder`, { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = `/auth/login?next=/orders/${orderNumber}`
          return
        }
        setError(data.error ?? 'Failed to create reorder.')
        return
      }

      window.location.href = data.checkoutUrl
    } catch {
      setError('Network error occurred.')
    } finally {
      setLoading(false)
    }
  }

  const variantClass =
    variant === 'primary'
      ? 'bg-blue-600 text-white hover:bg-blue-700 border border-blue-600'
      : variant === 'ghost'
      ? 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
      : 'border border-gray-300 text-gray-700 bg-white hover:bg-gray-50'

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        onClick={handleReorder}
        disabled={loading}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${variantClass} ${className}`}
      >
        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        {loading ? 'Processing…' : label}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
