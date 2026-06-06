import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAuthServerClient } from '@/lib/supabase-server'
import { createServerClient } from '@/lib/supabase'
import { Package, Printer, Truck, CheckCircle, XCircle, Clock, RotateCcw, FileText, User, AlertTriangle, Eye, UploadCloud } from 'lucide-react'
import type { PrintOrder, PrintOrderItem, PrintFile, OrderStatus } from '@/types/database'
import LogoutButton from './LogoutButton'
import ReviewButton from '@/components/ReviewButton'

export const metadata = {
  title: 'My Page — Procardcrafters',
}

export const dynamic = 'force-dynamic'

const STATUS_CONFIG: Record<OrderStatus, { label: string; icon: React.ReactNode; color: string }> = {
  pending: { label: 'Pending', icon: <Clock className="w-4 h-4" />, color: 'text-yellow-600 bg-yellow-50' },
  paid: { label: 'Paid', icon: <Package className="w-4 h-4" />, color: 'text-blue-600 bg-blue-50' },
  processing: { label: 'Printing', icon: <Printer className="w-4 h-4" />, color: 'text-indigo-600 bg-indigo-50' },
  shipped: { label: 'Shipped', icon: <Truck className="w-4 h-4" />, color: 'text-orange-600 bg-orange-50' },
  delivered: { label: 'Delivered', icon: <CheckCircle className="w-4 h-4" />, color: 'text-green-600 bg-green-50' },
  cancelled: { label: 'Cancelled', icon: <XCircle className="w-4 h-4" />, color: 'text-red-600 bg-red-50' },
  refunded: { label: 'Refunded', icon: <RotateCcw className="w-4 h-4" />, color: 'text-gray-600 bg-gray-100' },
}

const FILE_STATUS_CONFIG = {
  uploaded: { label: 'Under Review', color: 'text-yellow-600 bg-yellow-50' },
  approved: { label: 'Approved', color: 'text-green-600 bg-green-50' },
  rejected: { label: 'Rejected', color: 'text-red-600 bg-red-50' },
  processing: { label: 'Processing', color: 'text-blue-600 bg-blue-50' },
}

interface MypageShipment {
  id: string
  carrier: string
  tracking_number: string | null
  status: string
}

interface PendingProof {
  id: string
  order_id: string
  order_number: string
  version: number
  admin_note: string | null
}

interface OrderWithItems extends PrintOrder {
  items: PrintOrderItem[]
  files: PrintFile[]
  shipments: MypageShipment[]
  pendingProof: PendingProof | null
}

function trackingUrl(carrier: string, tn: string): string | null {
  if (!tn) return null
  if (carrier === 'fedex') return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(tn)}`
  if (carrier === 'dhl')   return `https://www.dhl.com/global-en/home/tracking/tracking-express.html?tracking-id=${encodeURIComponent(tn)}`
  if (carrier === 'ups')   return `https://www.ups.com/track?tracknum=${encodeURIComponent(tn)}`
  return null
}

export default async function MypagePage() {
  const supabase = await createAuthServerClient()

  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/auth/login')
  }

  // shipments RLS 는 service_role 만 허용 (관리자 API 경유 가정)
  // 마이페이지는 이미 주문 owner 만 노출되므로 service-role 로 보강 조회.
  const adminSupabase = createServerClient()

  const user = session.user

  // Fetch order history
  const { data: ordersData } = await supabase
    .from('print_orders')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  const orders = (ordersData as PrintOrder[] | null) ?? []

  // Fetch items + files + shipments + pending proofs for each order
  const ordersWithItems: OrderWithItems[] = await Promise.all(
    orders.map(async (order) => {
      const [{ data: items }, { data: files }, { data: shipments }, { data: proofs }] = await Promise.all([
        supabase
          .from('print_order_items')
          .select('*')
          .eq('order_id', order.id),
        supabase
          .from('print_files')
          .select('*')
          .eq('order_id', order.id),
        adminSupabase
          .from('print_shipments')
          .select('id, carrier, tracking_number, status')
          .eq('order_id', order.id)
          .in('status', ['label_created', 'in_transit', 'delivered'])
          .order('created_at', { ascending: false }),
        adminSupabase
          .from('print_design_proofs')
          .select('id, order_id, version, admin_note, status')
          .eq('order_id', order.id)
          .eq('status', 'pending')
          .order('version', { ascending: false })
          .limit(1),
      ])
      const pendingProof = proofs?.[0]
        ? { ...(proofs[0] as { id: string; order_id: string; version: number; admin_note: string | null; status: string }), order_number: order.order_number }
        : null
      return {
        ...order,
        items: (items as PrintOrderItem[] | null) ?? [],
        files: (files as PrintFile[] | null) ?? [],
        shipments: (shipments as MypageShipment[] | null) ?? [],
        pendingProof,
      }
    })
  )

  // 이미 작성된 리뷰: order_id + product_id 조합 집합
  const { data: existingReviews } = await adminSupabase
    .from('print_reviews')
    .select('order_id, product_id')
    .eq('user_id', user.id)

  const reviewedSet = new Set(
    (existingReviews ?? []).map((r) => `${r.order_id}:${r.product_id}`)
  )

  const displayName = (user.user_metadata?.full_name ?? user.email) ?? 'Customer'

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <User className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Page</h1>
            <p className="text-sm text-gray-500">{displayName}</p>
          </div>
        </div>
        <LogoutButton />
      </div>

      {/* Action Required */}
      {(() => {
        const actionItems = ordersWithItems.filter(
          o => o.pendingProof || o.files.some(f => f.status === 'rejected')
        )
        if (actionItems.length === 0) return null
        return (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-semibold text-gray-900">Action Required</h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{actionItems.length}</span>
            </div>
            <div className="space-y-3">
              {actionItems.map(order => (
                <div key={`action-${order.id}`} className="border border-amber-200 bg-amber-50 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-semibold text-gray-900">{order.order_number}</span>
                    <Link href={`/orders/${order.order_number}`} className="text-xs text-blue-600 hover:underline font-medium">
                      View Order →
                    </Link>
                  </div>
                  {order.pendingProof && (
                    <div className="flex items-start gap-2">
                      <Eye className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">Design proof ready for review</p>
                        {order.pendingProof.admin_note && (
                          <p className="text-xs text-gray-500 mt-0.5 truncate">Note: {order.pendingProof.admin_note}</p>
                        )}
                        <Link
                          href={`/orders/${order.order_number}#proof`}
                          className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-blue-600 hover:text-blue-700"
                        >
                          Review Design Proof →
                        </Link>
                      </div>
                    </div>
                  )}
                  {order.files.filter(f => f.status === 'rejected').map(file => (
                    <div key={file.id} className="flex items-start gap-2">
                      <UploadCloud className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-red-700">File rejected: {file.original_filename}</p>
                        {file.rejection_reason && (
                          <p className="text-xs text-red-500 mt-0.5">{file.rejection_reason}</p>
                        )}
                        <Link
                          href={`/orders/${order.order_number}#reupload`}
                          className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-red-600 hover:text-red-700"
                        >
                          Upload Replacement File →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        )
      })()}

      {/* Order History */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Order History</h2>

        {ordersWithItems.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
            <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">You have no orders yet.</p>
            <p className="text-sm text-gray-400 mt-1">Start your first order!</p>
            <Link
              href="/products"
              className="inline-block mt-4 bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {ordersWithItems.map((order) => {
              const statusInfo = STATUS_CONFIG[order.status]
              return (
                <div key={order.id} className="border border-gray-200 rounded-2xl overflow-hidden">
                  {/* Order Header */}
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
                        View Details →
                      </Link>
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="px-5 py-4 space-y-2">
                    {order.items.map((item) => {
                      const canReview =
                        (order.status === 'shipped' || order.status === 'delivered') &&
                        !reviewedSet.has(`${order.id}:${item.product_id}`)
                      return (
                        <div key={item.id} className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-gray-900">{item.product_name_en}</span>
                            <span className="text-xs text-gray-400 ml-2">×{item.quantity}</span>
                            {Object.keys(item.selected_options).length > 0 && (
                              <span className="text-xs text-gray-400 ml-2">
                                ({Object.entries(item.selected_options).map(([k, v]) => `${k}: ${v}`).join(', ')})
                              </span>
                            )}
                            {canReview && (
                              <div className="mt-1">
                                <ReviewButton
                                  orderId={order.id}
                                  productId={item.product_id}
                                  productName={item.product_name_en}
                                  defaultName={displayName}
                                />
                              </div>
                            )}
                          </div>
                          <span className="text-sm text-gray-700 flex-shrink-0">${item.subtotal_usd.toFixed(2)}</span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Tracking — 라벨 발급 이후 노출 */}
                  {order.shipments.length > 0 && (
                    <div className="px-5 py-3 border-t border-gray-100 bg-orange-50/40">
                      {order.shipments.map((sh) => {
                        const url = sh.tracking_number ? trackingUrl(sh.carrier, sh.tracking_number) : null
                        return (
                          <div key={sh.id} className="flex items-center gap-3 text-xs">
                            <Truck className="w-3.5 h-3.5 text-orange-600" />
                            <span className="uppercase text-gray-500 font-semibold">{sh.carrier}</span>
                            <span className="font-mono font-semibold text-gray-900">{sh.tracking_number ?? '—'}</span>
                            {url && (
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline font-medium"
                              >
                                Track →
                              </a>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* File Status + Design Proof */}
                  {(order.files.length > 0 || order.pendingProof) && (
                    <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 space-y-2">
                      {order.pendingProof && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Eye className="w-3.5 h-3.5 text-blue-500" />
                            <span className="text-xs font-semibold text-blue-700">Design Proof v{order.pendingProof.version} — Awaiting Review</span>
                          </div>
                          <Link
                            href={`/orders/${order.order_number}#proof`}
                            className="text-xs text-blue-600 font-semibold hover:underline"
                          >
                            Review →
                          </Link>
                        </div>
                      )}
                      {order.files.length > 0 && (
                        <>
                          <div className="flex items-center gap-2">
                            <FileText className="w-3.5 h-3.5 text-gray-400" />
                            <span className="text-xs font-medium text-gray-500">Uploaded Files</span>
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
                                  {file.status === 'rejected' && (
                                    <Link
                                      href={`/orders/${order.order_number}#reupload`}
                                      className="text-red-600 text-xs font-semibold hover:underline"
                                    >
                                      Re-upload →
                                    </Link>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Order Date */}
                  <div className="px-5 py-2 border-t border-gray-100">
                    <p className="text-xs text-gray-400">
                      Ordered: {new Date(order.created_at).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}
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
