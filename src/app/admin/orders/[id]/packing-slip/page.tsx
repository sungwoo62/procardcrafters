'use client'


// OMO-2629: 인증/관리자 페이지는 인증 게이트·비SEO → 정적 프리렌더 제외(빌드 안정성).
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface OrderItem {
  id: string
  product_name_en: string
  product_name_ko: string
  selected_options: Record<string, string>
  quantity: number
  subtotal_usd: number
}

interface Order {
  id: string
  order_number: string
  customer_name: string
  customer_email: string
  customer_phone: string | null
  shipping_name: string
  shipping_address_line1: string
  shipping_address_line2: string | null
  shipping_city: string
  shipping_state: string | null
  shipping_country: string
  shipping_postal_code: string
  subtotal_usd: number
  shipping_usd: number
  total_usd: number
  status: string
  created_at: string
  print_order_items: OrderItem[]
}

interface Shipment {
  id: string
  carrier: string
  tracking_number: string | null
  weight_kg: number | null
  cost_usd: number | null
  charged_usd: number | null
  status: string
  print_shipping_services: { code: string; name_en: string } | null
  print_shipping_zones: { code: string; name_en: string } | null
}

interface OriginConfig {
  company_ko: string
  company_en: string
  address_ko: string
  address_en: string
  phone: string | null
  email: string | null
}

const ORIGIN_FALLBACK: OriginConfig = {
  company_ko: 'ALLPACKMEISTER CO., LTD.',
  company_en: 'ALLPACKMEISTER CO., LTD.',
  address_ko: '20, GILJU-RO 411BEON-GIL, 618HO, BUCHEON',
  address_en: '20, GILJU-RO 411BEON-GIL, 618HO, BUCHEON, KR 14488',
  phone: null,
  email: null,
}

export default function PackingSlipPage() {
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<Order | null>(null)
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [origin, setOrigin] = useState<OriginConfig>(ORIGIN_FALLBACK)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!id) return
    Promise.all([
      fetch(`/api/admin/orders/${id}`).then((r) => r.json()),
      fetch(`/api/admin/orders/${id}/shipments`).then((r) => r.json()),
      fetch(`/api/admin/shipping/config`).then((r) => r.json()).catch(() => null),
    ]).then(([o, s, c]) => {
      if (o.error) setErr(o.error)
      else setOrder(o.order)
      setShipments(s.shipments ?? [])
      if (c?.config) {
        const cfg = c.config
        const addrParts = [cfg.origin_address_line1, cfg.origin_address_line2, cfg.origin_city, cfg.origin_state, cfg.origin_postal_code].filter(Boolean).join(', ')
        setOrigin({
          company_ko: cfg.origin_company_ko || ORIGIN_FALLBACK.company_ko,
          company_en: cfg.origin_company_en || ORIGIN_FALLBACK.company_en,
          address_ko: addrParts || ORIGIN_FALLBACK.address_ko,
          address_en: addrParts ? `${addrParts}, ${cfg.origin_country || 'KR'}` : ORIGIN_FALLBACK.address_en,
          phone: cfg.origin_phone || null,
          email: cfg.origin_email || null,
        })
      }
    })
  }, [id])

  if (err) return <p className="p-6 text-red-600">{err}</p>
  if (!order) return <p className="p-6 text-gray-500">불러오는 중...</p>

  const shipment = shipments[0]

  return (
    <div className="bg-gray-100 min-h-screen p-4 print:p-0 print:bg-white">
      <div className="mx-auto max-w-3xl print:max-w-none">
        {/* 인쇄 버튼 */}
        <div className="mb-3 flex justify-end gap-2 print:hidden">
          <button
            onClick={() => window.print()}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
          >
            인쇄
          </button>
        </div>

        {/* 페이지 */}
        <div className="bg-white shadow rounded-lg print:shadow-none print:rounded-none p-8 print:p-6">
          <header className="border-b-2 border-gray-900 pb-4 mb-6 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">Packing Slip / 패킹 슬립</h1>
              <p className="text-sm text-gray-600 mt-1">
                Order / 주문번호: <span className="font-mono font-semibold">{order.order_number}</span>
              </p>
              <p className="text-sm text-gray-600">
                Date / 날짜: {new Date(order.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="text-right">
              <p className="font-semibold">{origin.company_en}</p>
              <p className="text-xs text-gray-600">{origin.address_en}</p>
              {origin.phone && <p className="text-xs text-gray-600">{origin.phone}</p>}
              {origin.email && <p className="text-xs text-gray-600">{origin.email}</p>}
            </div>
          </header>

          {/* 주소 박스 */}
          <section className="grid grid-cols-2 gap-6 mb-6">
            <AddressBox title="FROM (보낸 사람)">
              <p className="font-semibold">{origin.company_ko}</p>
              <p>{origin.address_ko}</p>
              {origin.phone && <p className="mt-1 text-sm">Tel: {origin.phone}</p>}
            </AddressBox>
            <AddressBox title="TO (받는 사람)">
              <p className="font-semibold text-lg">{order.shipping_name}</p>
              <p>{order.shipping_address_line1}</p>
              {order.shipping_address_line2 && <p>{order.shipping_address_line2}</p>}
              <p>
                {order.shipping_city}{order.shipping_state ? `, ${order.shipping_state}` : ''} {order.shipping_postal_code}
              </p>
              <p className="font-semibold">{order.shipping_country}</p>
              {order.customer_phone && <p className="mt-1 text-sm">Tel: {order.customer_phone}</p>}
              <p className="text-xs text-gray-600">{order.customer_email}</p>
            </AddressBox>
          </section>

          {/* 송장 정보 */}
          {shipment && (
            <section className="mb-6 rounded-lg border-2 border-gray-900 p-4">
              <div className="grid grid-cols-4 gap-4 text-sm">
                <KV label="Carrier / 택배사" value={shipment.carrier.toUpperCase()} />
                <KV label="Service / 서비스" value={shipment.print_shipping_services?.name_en ?? '-'} />
                <KV label="Zone / 지역" value={shipment.print_shipping_zones?.code ?? '-'} />
                <KV label="Weight / 무게" value={shipment.weight_kg ? `${shipment.weight_kg} kg` : '-'} />
              </div>
              {shipment.tracking_number && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-500 uppercase">Tracking Number / 송장번호</p>
                  <p className="font-mono text-xl font-bold tracking-wider">{shipment.tracking_number}</p>
                </div>
              )}
            </section>
          )}

          {/* 품목 표 */}
          <section className="mb-6">
            <h2 className="text-sm font-bold uppercase mb-2 text-gray-700">Items / 품목</h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-900 text-left">
                  <th className="py-2 pr-2">#</th>
                  <th className="py-2 pr-2">Product / 상품</th>
                  <th className="py-2 pr-2">Options / 옵션</th>
                  <th className="py-2 pr-2 text-right">Qty / 수량</th>
                  <th className="py-2 pl-2 text-right">Subtotal / 소계</th>
                </tr>
              </thead>
              <tbody>
                {order.print_order_items.map((it, i) => (
                  <tr key={it.id} className="border-b border-gray-200">
                    <td className="py-2 pr-2 align-top">{i + 1}</td>
                    <td className="py-2 pr-2 align-top">
                      <p className="font-medium">{it.product_name_en}</p>
                      <p className="text-xs text-gray-600">{it.product_name_ko}</p>
                    </td>
                    <td className="py-2 pr-2 align-top text-xs text-gray-700">
                      {Object.entries(it.selected_options).map(([k, v]) => (
                        <p key={k}>{k}: {v}</p>
                      ))}
                    </td>
                    <td className="py-2 pr-2 align-top text-right">{it.quantity}</td>
                    <td className="py-2 pl-2 align-top text-right">${Number(it.subtotal_usd).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* 총액 */}
          <section className="ml-auto w-72 text-sm">
            <Row label="Subtotal / 소계" value={`$${Number(order.subtotal_usd).toFixed(2)}`} />
            <Row label="Shipping (incl. 10% VAT) / 배송비 (부가세 10% 포함)" value={`$${Number(order.shipping_usd).toFixed(2)}`} />
            <Row label="TOTAL / 합계" value={`$${Number(order.total_usd).toFixed(2)}`} bold />
          </section>

          <footer className="mt-8 pt-4 border-t text-xs text-gray-500">
            <p>이 명세서를 박스 안 또는 표면에 함께 부착해 주세요.</p>
            <p>Please attach this slip to the package.</p>
          </footer>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body { background: white; }
        }
      `}</style>
    </div>
  )
}

function AddressBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-300 p-4">
      <p className="text-xs font-bold uppercase text-gray-500 mb-2">{title}</p>
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  )
}
function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  )
}
function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between border-b border-gray-200 py-1.5 ${bold ? 'font-bold text-base border-gray-900' : ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}
