'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'

export default function OrdersPage() {
  const [orderNumber, setOrderNumber] = useState('')
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = orderNumber.trim()
    if (trimmed) {
      router.push(`/orders/${trimmed}`)
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-20">
      <h1 className="text-2xl font-bold text-gray-900 mb-3 text-center">Order Status</h1>
      <p className="text-gray-500 mb-8 text-center">
        Enter your order number to check the current status.
      </p>
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="text"
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          placeholder="e.g. ORD-ABC123"
          className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-5 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Search className="w-4 h-4" />
          Track
        </button>
      </form>
    </div>
  )
}
