import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAuthServerClient } from '@/lib/supabase-server'
import { Package, Printer, Truck, CheckCircle, XCircle, Clock, RotateCcw, FileText, User } from 'lucide-react'
import type { PrintOrder, PrintOrderItem, PrintFile, OrderStatus } from '@/types/database'
import LogoutButton from './LogoutButton'

export const metadata = {
  title: '마이페이지 — Procardcrafters',
}

export const dynamic = 'force-dynamic'

const STATUS_CONFIG: Record<OrderStatus, { label: string; icon: React.ReactNode; color: string }> = {
  pending: { label: '결제 대기', icon: <Clock className="w-4 h-4" />, color: 'text-yellow-600 bg-yellow-50' },
  paid: { label: '결제 완료', icon: <Package className="w-4 h-4" />, color: 'text-blue-600 bg-blue-50' },
  processing: { label: '인쇄 중', icon: <Printer className="w-4 h-4" />, color: 'text-indigo-600 bg-indigo-50' },
  shipped: { label: '배송 중', icon: <Truck className="w-4 h-4" />, color: 'text-orange-600 bg-orange-50' },
  delivered: { label: '배송 완료', icon: <CheckCircle className="w-4 h-4" />, color: 'text-green-600 bg-green-50' },
  cancelled: { label: '취소됨', icon: <XCircle className="w-4 h-4" />, color: 'text-red-600 bg-red-50' },
  refunded: { label: '환불 완료', icon: <RotateCcw className="w-4 h-4" />, color: 'text-gray-600 bg-gray-100' },
}

const FILE_STATUS_CONFIG = {
  uploaded: { label: '검토 중', color: 'text-yellow-600 bg-yellow-50' },
  approved: { label: '승인됨', color: 'text-green-600 bg-green-50' },
  rejected: { label: '반려됨', color: 'text-red-600 bg-red-50' },
  processing: { label: '처리 중', color: 'text-blue-600 bg-blue-50' },
}

interface OrderWithItems extends PrintOrder {
  items: PrintOrderItem[]
  files: PrintFile[]
}

export default async function MypagePage() {
  const supabase = await createAuthServerClient()

  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/auth/login')
  }

  const user = session.user
  const displayName = user.user_metadata?.full_name ?? user.email

  // 주문 이력 조회
  const { data: ordersData } = await supabase
    .from('print_orders')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  const orders = (ordersData as PrintOrder[] | null) ?? []

  // 각 주문의 항목 + 파일 조회
  const ordersWithItems: OrderWithItems[] = await Promise.all(
    orders.map(async (order) => {
      const [{ data: items }, { data: files }] = await Promise.all([
        supabase
          .from('print_order_items')
          .select('*')
          .eq('order_id', order.id),
        supabase
          .from('print_files')
          .select('*')
          .eq('order_id', order.id),
      ])
      return {
        ...order,
        items: (items as PrintOrderItem[] | null) ?? [],
        files: (files as PrintFile[] | null) ?? [],
      }
    })
  )

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <User className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">마이페이지</h1>
            <p className="text-sm text-gray-500">{displayName}</p>
          </div>
        </div>
        <LogoutButton />
      </div>

      {/* 주문 이력 */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">주문 이력</h2>

        {ordersWithItems.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
            <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">아직 주문 내역이 없습니다.</p>
            <p className="text-sm text-gray-400 mt-1">첫 주문을 시작해보세요!</p>
            <Link
              href="/products"
              className="inline-block mt-4 bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              상품 보기
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {ordersWithItems.map((order) => {
              const statusInfo = STATUS_CONFIG[order.status]
              return (
                <div key={order.id} className="border border-gray-200 rounded-2xl overflow-hidden">
                  {/* 주문 헤더 */}
                  <div className="px-5 py-4 bg-gray-50 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-semibold text-gray-900">
                        {order.order_number}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusInfo.color}`}>
                        {statusInfo.icon}
                        {statusInfo.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-gray-900">${order.total_usd.toFixed(2)}</span>
                      <Link
                        href={`/orders/${order.order_number}`}
                        className="text-xs text-blue-600 hover:underline font-medium"
                      >
                        상세 보기 →
                      </Link>
                    </div>
                  </div>

                  {/* 주문 항목 */}
                  <div className="px-5 py-4 space-y-2">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex justify-between items-center">
                        <div>
                          <span className="text-sm font-medium text-gray-900">{item.product_name_en}</span>
                          <span className="text-xs text-gray-400 ml-2">×{item.quantity}</span>
                          {Object.keys(item.selected_options).length > 0 && (
                            <span className="text-xs text-gray-400 ml-2">
                              ({Object.entries(item.selected_options).map(([k, v]) => `${k}: ${v}`).join(', ')})
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-gray-700">${item.subtotal_usd.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  {/* 파일 상태 */}
                  {order.files.length > 0 && (
                    <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50">
                      <div className="flex items-center gap-2 mb-1.5">
                        <FileText className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-xs font-medium text-gray-500">업로드 파일</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {order.files.map((file) => {
                          const fileStatus = FILE_STATUS_CONFIG[file.status]
                          return (
                            <div key={file.id} className="flex items-center gap-1.5 text-xs">
                              <span className="text-gray-600 max-w-[160px] truncate">{file.original_filename}</span>
                              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${fileStatus.color}`}>
                                {fileStatus.label}
                              </span>
                              {file.rejection_reason && (
                                <span className="text-red-500 text-xs">— {file.rejection_reason}</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* 주문 일시 */}
                  <div className="px-5 py-2 border-t border-gray-100">
                    <p className="text-xs text-gray-400">
                      주문일: {new Date(order.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
