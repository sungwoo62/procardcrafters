import { Suspense } from 'react'
import Link from 'next/link'
import { CheckCircle, Package, ArrowRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ order?: string; session_id?: string }>
}

async function SuccessContent({ searchParams }: PageProps) {
  const params = await searchParams
  const orderNumber = params.order

  return (
    <div className="max-w-lg mx-auto text-center space-y-6">
      <div className="flex justify-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
      </div>

      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Order Confirmed!</h1>
        <p className="text-gray-500">Your payment has been processed successfully. A confirmation email has been sent.</p>
      </div>

      {orderNumber && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
          <p className="text-sm text-gray-500 mb-1">Order Number</p>
          <p className="text-xl font-bold text-gray-900 font-mono">{orderNumber}</p>
          <p className="text-xs text-gray-400 mt-1">Use this number to track your order status</p>
        </div>
      )}

      <div className="bg-blue-50 rounded-xl p-5 text-left space-y-3">
        <h2 className="font-semibold text-blue-900 flex items-center gap-2">
          <Package className="w-4 h-4" />
          Next Steps
        </h2>
        <ul className="text-sm text-blue-800 space-y-2">
          <li className="flex items-start gap-2">
            <span className="font-bold shrink-0">1.</span>
            File Review — We will review your print file within 1 business day
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold shrink-0">2.</span>
            Production — printing begins after file approval
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold shrink-0">3.</span>
            Shipping — After printing, we ship via FedEx and email you the tracking number
          </li>
        </ul>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        {orderNumber && (
          <Link
            href={`/orders/${orderNumber}`}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            Track Order
            <ArrowRight className="w-4 h-4" />
          </Link>
        )}
        <Link
          href="/products"
          className="flex-1 flex items-center justify-center gap-2 border border-gray-300 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
        >
          Browse Products
        </Link>
      </div>
    </div>
  )
}

export default function OrderSuccessPage(props: PageProps) {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <Suspense fallback={<div className="text-gray-400 text-sm text-center">Loading...</div>}>
        <SuccessContent {...props} />
      </Suspense>
    </div>
  )
}
