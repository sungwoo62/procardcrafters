'use client'

import Link from 'next/link'
import { ShoppingCart, ArrowRight } from 'lucide-react'

export default function CartPage() {
  // MVP: cart replaced by direct product → order flow
  return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-6" />
      <h1 className="text-2xl font-bold text-gray-900 mb-3">Your Cart</h1>
      <p className="text-gray-500 mb-8">
        Your cart is empty. Browse our products and configure your order directly from each product page.
      </p>
      <Link
        href="/products"
        className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
      >
        Browse Products <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  )
}
