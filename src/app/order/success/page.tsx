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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">주문이 완료되었습니다!</h1>
        <p className="text-gray-500">결제가 성공적으로 처리되었습니다. 주문 확인 이메일을 발송했습니다.</p>
      </div>

      {orderNumber && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
          <p className="text-sm text-gray-500 mb-1">주문 번호</p>
          <p className="text-xl font-bold text-gray-900 font-mono">{orderNumber}</p>
          <p className="text-xs text-gray-400 mt-1">이 번호로 주문 상태를 확인할 수 있습니다</p>
        </div>
      )}

      <div className="bg-blue-50 rounded-xl p-5 text-left space-y-3">
        <h2 className="font-semibold text-blue-900 flex items-center gap-2">
          <Package className="w-4 h-4" />
          다음 단계
        </h2>
        <ul className="text-sm text-blue-800 space-y-2">
          <li className="flex items-start gap-2">
            <span className="font-bold shrink-0">1.</span>
            파일 검토 — 업로드하신 인쇄 파일을 검토합니다 (1 영업일 이내)
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold shrink-0">2.</span>
            Production — printing begins after file approval
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold shrink-0">3.</span>
            배송 출발 — 인쇄 완료 후 FedEx/기쿠리어로 발송하고 운송장 번호를 이메일로 안내합니다
          </li>
        </ul>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        {orderNumber && (
          <Link
            href={`/orders/${orderNumber}`}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            주문 상태 확인
            <ArrowRight className="w-4 h-4" />
          </Link>
        )}
        <Link
          href="/products"
          className="flex-1 flex items-center justify-center gap-2 border border-gray-300 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
        >
          다른 상품 보기
        </Link>
      </div>
    </div>
  )
}

export default function OrderSuccessPage(props: PageProps) {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <Suspense fallback={<div className="text-gray-400 text-sm text-center">불러오는 중...</div>}>
        <SuccessContent {...props} />
      </Suspense>
    </div>
  )
}
