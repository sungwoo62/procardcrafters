'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Truck, Printer, Plus, Save, Send, CheckCircle2 } from 'lucide-react'

interface Shipment {
  id: string
  carrier: string
  tracking_number: string | null
  weight_kg: number | null
  length_cm: number | null
  width_cm: number | null
  height_cm: number | null
  cost_usd: number | null
  charged_usd: number | null
  status: 'pending' | 'label_created' | 'in_transit' | 'delivered' | 'returned' | 'cancelled'
  shipped_at: string | null
  delivered_at: string | null
  notes: string | null
  created_at: string
  print_shipping_services?: { code: string; name_ko: string; name_en: string } | null
  print_shipping_zones?: { code: string; name_ko: string; name_en: string } | null
}

interface Service {
  id: string
  code: string
  name_ko: string
}

const STATUS_LABELS: Record<Shipment['status'], string> = {
  pending:       '대기',
  label_created: '라벨 발급',
  in_transit:    '배송 중',
  delivered:     '배송 완료',
  returned:      '반송',
  cancelled:     '취소',
}

const STATUS_COLORS: Record<Shipment['status'], string> = {
  pending:       'bg-gray-100 text-gray-700',
  label_created: 'bg-blue-100 text-blue-700',
  in_transit:    'bg-purple-100 text-purple-700',
  delivered:     'bg-green-100 text-green-700',
  returned:      'bg-orange-100 text-orange-700',
  cancelled:     'bg-red-100 text-red-700',
}

export function OrderShipments({ orderId }: { orderId: string }) {
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [msg, setMsg] = useState('')

  // 새 송장 폼
  const [weightKg, setWeightKg] = useState('1.0')
  const [serviceCode, setServiceCode] = useState<string>('fedex_ip')
  const [carrier, setCarrier] = useState('fedex')

  const load = useCallback(async () => {
    setLoading(true)
    const [sRes, svcRes] = await Promise.all([
      fetch(`/api/admin/orders/${orderId}/shipments`),
      fetch('/api/admin/shipping/services'),
    ])
    if (sRes.ok) setShipments((await sRes.json()).shipments ?? [])
    if (svcRes.ok) setServices((await svcRes.json()).services ?? [])
    setLoading(false)
  }, [orderId])

  useEffect(() => { load() }, [load])

  const createShipment = async () => {
    setCreating(true); setMsg('')
    const res = await fetch(`/api/admin/orders/${orderId}/shipments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        weightKg: Number(weightKg),
        serviceCode,
        carrier,
      }),
    })
    const data = await res.json()
    setCreating(false)
    if (!res.ok) { setMsg(`오류: ${data.error}`); return }
    setMsg(
      data.quote?.isFallback
        ? `송장 생성됨 (요율 fallback $${data.quote.baseCostUsd} + ${data.quote.markupPct}% = $${data.quote.costUsd})`
        : `송장 생성됨 (Zone ${data.quote.zoneCode}, $${data.quote.baseCostUsd} + ${data.quote.markupPct}% = $${data.quote.costUsd})`,
    )
    load()
  }

  return (
    <section className="rounded-2xl bg-white border border-gray-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <Truck className="h-5 w-5" />
          배송 / 송장 관리
        </h2>
        <Link
          href={`/admin/orders/${orderId}/packing-slip`}
          target="_blank"
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          <Printer className="h-3.5 w-3.5" /> 패킹슬립 인쇄
        </Link>
      </div>

      {/* 새 송장 생성 */}
      <div className="rounded-lg border border-dashed border-gray-300 p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-700 uppercase">새 송장 생성</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="block">
            <span className="text-xs text-gray-600">무게 (kg)</span>
            <input
              type="number" step="0.001" min="0"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              className="w-full rounded-lg border-gray-200 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs text-gray-600">서비스</span>
            <select
              value={serviceCode}
              onChange={(e) => setServiceCode(e.target.value)}
              className="w-full rounded-lg border-gray-200 text-sm"
            >
              {services.map((s) => (
                <option key={s.id} value={s.code}>{s.name_ko}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-gray-600">캐리어</span>
            <input
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              className="w-full rounded-lg border-gray-200 text-sm"
            />
          </label>
          <div className="flex items-end">
            <button
              onClick={createShipment}
              disabled={creating}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {creating ? '생성 중...' : '생성'}
            </button>
          </div>
        </div>
        {msg && <p className="text-xs text-gray-600">{msg}</p>}
      </div>

      {/* 송장 목록 */}
      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : shipments.length === 0 ? (
        <p className="text-sm text-gray-400">아직 송장이 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {shipments.map((sh) => (
            <ShipmentRow key={sh.id} orderId={orderId} shipment={sh} onChange={load} />
          ))}
        </div>
      )}
    </section>
  )
}

function ShipmentRow({ orderId, shipment, onChange }: { orderId: string; shipment: Shipment; onChange: () => void }) {
  const [tracking, setTracking] = useState(shipment.tracking_number ?? '')
  const [weight, setWeight] = useState(String(shipment.weight_kg ?? ''))
  const [notes, setNotes] = useState(shipment.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const patch = async (extra: Record<string, unknown> = {}) => {
    setSaving(true); setMsg('')
    const res = await fetch(`/api/admin/orders/${orderId}/shipments`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shipmentId: shipment.id,
        trackingNumber: tracking,
        weightKg: weight === '' ? null : Number(weight),
        notes,
        ...extra,
      }),
    })
    const data = await res.json()
    setSaving(false)
    setMsg(res.ok ? '저장됨' : `오류: ${data.error}`)
    if (res.ok) onChange()
  }

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[shipment.status]}`}>
            {STATUS_LABELS[shipment.status]}
          </span>
          <span className="text-xs text-gray-500 uppercase">{shipment.carrier}</span>
          {shipment.print_shipping_zones && (
            <span className="text-xs text-gray-500">Zone {shipment.print_shipping_zones.code}</span>
          )}
          {shipment.charged_usd != null && (
            <span className="text-xs text-gray-700">
              ${Number(shipment.charged_usd).toFixed(2)} <span className="text-gray-400">(원가 ${Number(shipment.cost_usd ?? 0).toFixed(2)})</span>
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">{new Date(shipment.created_at).toLocaleString('ko-KR')}</span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 mb-3">
        <label className="block sm:col-span-2">
          <span className="text-xs text-gray-600">송장번호 (Tracking #)</span>
          <input
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            className="w-full rounded-lg border-gray-200 text-sm font-mono"
            placeholder="FedEx 송장번호 입력"
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-600">무게 (kg)</span>
          <input
            type="number" step="0.001"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="w-full rounded-lg border-gray-200 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-600">메모</span>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border-gray-200 text-sm"
          />
        </label>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => patch()}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" /> 저장
        </button>
        {shipment.status !== 'in_transit' && shipment.status !== 'delivered' && (
          <button
            onClick={() => patch({ status: 'in_transit' })}
            disabled={saving || !tracking}
            title={!tracking ? '송장번호를 먼저 입력하세요' : ''}
            className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" /> 발송 처리
          </button>
        )}
        {shipment.status === 'in_transit' && (
          <button
            onClick={() => patch({ status: 'delivered' })}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> 도착 처리
          </button>
        )}
        {msg && <span className="text-xs text-gray-600 ml-1">{msg}</span>}
      </div>
    </div>
  )
}
