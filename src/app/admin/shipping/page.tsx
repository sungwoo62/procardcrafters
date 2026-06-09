'use client'


// OMO-2629: 인증/관리자 페이지는 인증 게이트·비SEO → 정적 프리렌더 제외(빌드 안정성).
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Truck, Globe, Settings, Layers, Package2, ArrowLeft, FileSpreadsheet, AlertTriangle, CheckCircle2 } from 'lucide-react'

interface Zone {
  id: string
  code: string
  name_ko: string
  name_en: string
  countries: string[]
  sort_order: number
  is_active: boolean
}
interface Service {
  id: string
  code: string
  name_ko: string
  name_en: string
  carrier: string
  est_days_min: number | null
  est_days_max: number | null
  sort_order: number
  is_active: boolean
}
interface Config {
  vat_markup_percent: number
  origin_country: string
  default_weight_kg: number
  fallback_rate_usd: number
  free_shipping_threshold_usd: number
  free_shipping_max_weight_kg: number
  origin_company_ko: string
  origin_company_en: string
  origin_address_line1: string
  origin_address_line2: string | null
  origin_city: string
  origin_state: string | null
  origin_postal_code: string
  origin_phone: string | null
  origin_email: string | null
}

type Tab = 'zones' | 'services' | 'rates' | 'shipments' | 'reconciliation' | 'config'

export default function AdminShippingPage() {
  const [tab, setTab] = useState<Tab>('zones')
  const [zones, setZones] = useState<Zone[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [config, setConfig] = useState<Config | null>(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const loadAll = useCallback(async () => {
    setLoading(true); setMsg('')
    const [zRes, sRes, cRes] = await Promise.all([
      fetch('/api/admin/shipping/zones'),
      fetch('/api/admin/shipping/services'),
      fetch('/api/admin/shipping/config'),
    ])
    if (zRes.status === 401) { window.location.href = '/admin/login'; return }
    const [z, s, c] = await Promise.all([zRes.json(), sRes.json(), cRes.json()])
    setZones(z.zones ?? [])
    setServices(s.services ?? [])
    setConfig(c.config ?? null)
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
              <ArrowLeft className="h-4 w-4" /> Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Truck className="h-6 w-6" /> 배송 (Shipping)
            </h1>
          </div>
          {msg && <p className="text-sm text-gray-600">{msg}</p>}
        </div>

        <div className="mb-6 flex gap-2 flex-wrap">
          {[
            { key: 'zones',     label: '권역 (Zone)',          icon: Globe },
            { key: 'services',  label: '서비스 (Service)',     icon: Layers },
            { key: 'rates',     label: '요금표 (Rate)',        icon: Package2 },
            { key: 'shipments', label: '송장 (Shipment)',      icon: Truck },
            { key: 'reconciliation', label: '정산 (Reconcile)', icon: FileSpreadsheet },
            { key: 'config',    label: '설정 (Config)',        icon: Settings },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key as Tab)}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                tab === key
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">불러오는 중...</p>
        ) : (
          <>
            {tab === 'zones'     && <ZonesPanel zones={zones} reload={loadAll} setMsg={setMsg} />}
            {tab === 'services'  && <ServicesPanel services={services} reload={loadAll} setMsg={setMsg} />}
            {tab === 'rates'     && <RatesPanel zones={zones} services={services} setMsg={setMsg} />}
            {tab === 'shipments' && <ShipmentsPanel />}
            {tab === 'reconciliation' && <ReconciliationPanel setMsg={setMsg} />}
            {tab === 'config'    && <ConfigPanel config={config} reload={loadAll} setMsg={setMsg} />}
          </>
        )}
      </div>
    </div>
  )
}

/* ============ Zones ============ */
function ZonesPanel({ zones, reload, setMsg }: { zones: Zone[]; reload: () => void; setMsg: (s: string) => void }) {
  const [edits, setEdits] = useState<Record<string, Partial<Zone>>>({})

  const save = async (zone: Zone) => {
    const patch = edits[zone.id]
    if (!patch) return
    const countries =
      typeof patch.countries === 'string'
        ? (patch.countries as unknown as string).split(/[,\s]+/).map((s) => s.trim().toUpperCase()).filter(Boolean)
        : patch.countries
    const res = await fetch('/api/admin/shipping/zones', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: zone.id, ...patch, countries }),
    })
    const data = await res.json()
    setMsg(res.ok ? `${zone.code} 저장됨` : `오류: ${data.error}`)
    if (res.ok) { setEdits((e) => { const c = { ...e }; delete c[zone.id]; return c }); reload() }
  }

  return (
    <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">코드</th>
              <th className="px-4 py-3 text-left">이름 (KO)</th>
              <th className="px-4 py-3 text-left">국가 (ISO-2, 쉼표)</th>
              <th className="px-4 py-3 text-left">활성</th>
              <th className="px-4 py-3 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {zones.map((z) => {
              const e = edits[z.id] ?? {}
              const countriesStr =
                typeof e.countries === 'string' ? e.countries : (e.countries ?? z.countries).join(', ')
              return (
                <tr key={z.id}>
                  <td className="px-4 py-3 font-mono text-xs">{z.code}</td>
                  <td className="px-4 py-3">
                    <input
                      className="w-full rounded border-gray-200 text-sm"
                      value={e.name_ko ?? z.name_ko}
                      onChange={(ev) => setEdits((x) => ({ ...x, [z.id]: { ...x[z.id], name_ko: ev.target.value } }))}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      className="w-full rounded border-gray-200 text-xs font-mono"
                      value={countriesStr}
                      onChange={(ev) =>
                        setEdits((x) => ({
                          ...x,
                          [z.id]: { ...x[z.id], countries: ev.target.value as unknown as string[] },
                        }))
                      }
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={e.is_active ?? z.is_active}
                      onChange={(ev) => setEdits((x) => ({ ...x, [z.id]: { ...x[z.id], is_active: ev.target.checked } }))}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => save(z)}
                      disabled={!edits[z.id]}
                      className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-30"
                    >
                      저장
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ============ Services ============ */
function ServicesPanel({ services }: { services: Service[]; reload: () => void; setMsg: (s: string) => void }) {
  return (
    <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            <th className="px-4 py-3 text-left">코드</th>
            <th className="px-4 py-3 text-left">서비스</th>
            <th className="px-4 py-3 text-left">캐리어</th>
            <th className="px-4 py-3 text-left">예상일</th>
            <th className="px-4 py-3 text-left">활성</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {services.map((s) => (
            <tr key={s.id}>
              <td className="px-4 py-3 font-mono text-xs">{s.code}</td>
              <td className="px-4 py-3">{s.name_ko}</td>
              <td className="px-4 py-3">{s.carrier}</td>
              <td className="px-4 py-3">
                {s.est_days_min && s.est_days_max ? `${s.est_days_min}-${s.est_days_max}일` : '-'}
              </td>
              <td className="px-4 py-3">{s.is_active ? '✓' : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ============ Rates ============ */
function RatesPanel({ zones, services, setMsg }: { zones: Zone[]; services: Service[]; setMsg: (s: string) => void }) {
  const [serviceId, setServiceId] = useState<string>('')
  const [csv, setCsv] = useState<string>('')
  const [replace, setReplace] = useState(true)
  const [importing, setImporting] = useState(false)

  useEffect(() => { if (!serviceId && services[0]) setServiceId(services[0].id) }, [services, serviceId])

  const importRates = async () => {
    if (!serviceId) { setMsg('서비스 선택 필요'); return }
    setImporting(true); setMsg('')
    // 형식: zoneCode,weightKgMax,rateUsd  (또는 탭/공백 구분, 첫 줄 헤더 허용)
    const rows = csv
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !/^(zone|code|#)/i.test(line))
      .map((line) => {
        const parts = line.split(/[,\t\s]+/).filter(Boolean)
        return { zoneCode: parts[0], weightKgMax: Number(parts[1]), rateUsd: Number(parts[2]) }
      })
      .filter((r) => r.zoneCode && Number.isFinite(r.weightKgMax) && Number.isFinite(r.rateUsd))

    if (!rows.length) { setMsg('파싱된 행 없음. 형식: zoneCode,weightKgMax,rateUsd'); setImporting(false); return }

    const res = await fetch('/api/admin/shipping/rates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceId, replaceExisting: replace, rows }),
    })
    const data = await res.json()
    setImporting(false)
    setMsg(res.ok
      ? `${data.inserted}건 임포트, ${data.skipped}건 스킵`
      : `오류: ${data.error}`)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">FedEx 요금표 임포트</h2>
        <p className="text-xs text-gray-500 leading-relaxed">
          각 줄에 <code className="font-mono bg-gray-100 px-1 rounded">권역코드,kg최대,USD요율</code> 형식으로
          붙여 넣으세요. 예: <code className="font-mono bg-gray-100 px-1 rounded">A,0.5,18.50</code><br />
          권역코드는 위 권역 탭에 등록된 코드(A~H)와 일치해야 합니다. 첫 줄 헤더는 자동 무시됩니다.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-gray-700">서비스</label>
          <select
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            className="rounded-lg border-gray-200 text-sm"
          >
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name_ko}</option>
            ))}
          </select>
          <label className="text-xs text-gray-700 flex items-center gap-1.5">
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
            기존 요율 모두 교체
          </label>
        </div>
        <textarea
          rows={10}
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder={'A,0.5,18.50\nA,1.0,22.30\nB,0.5,20.10\n...'}
          className="w-full rounded-lg border-gray-200 font-mono text-xs"
        />
        <button
          onClick={importRates}
          disabled={importing}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {importing ? '임포트 중...' : '임포트'}
        </button>
      </div>

      <div className="rounded-2xl bg-white border border-gray-200 p-5">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">등록된 권역</h3>
        <div className="flex flex-wrap gap-2">
          {zones.map((z) => (
            <span key={z.id} className="rounded-md bg-gray-100 px-2 py-1 text-xs font-mono">
              {z.code} · {z.countries.length}개국
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ============ Shipments ============ */
interface ShipmentRow {
  id: string
  order_id: string
  carrier: string
  tracking_number: string | null
  weight_kg: number | null
  cost_usd: number | null
  charged_usd: number | null
  status: string
  shipped_at: string | null
  delivered_at: string | null
  created_at: string
  print_orders: { order_number: string; customer_name: string; shipping_country: string; shipping_city: string } | null
}

function ShipmentsPanel() {
  const [rows, setRows] = useState<ShipmentRow[]>([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    setLoading(true)
    fetch('/api/admin/shipping/shipments')
      .then((r) => r.json())
      .then((d) => setRows(d.shipments ?? []))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-sm text-gray-500">불러오는 중...</p>

  return (
    <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            <th className="px-4 py-3 text-left">주문</th>
            <th className="px-4 py-3 text-left">국가</th>
            <th className="px-4 py-3 text-left">캐리어</th>
            <th className="px-4 py-3 text-left">송장번호</th>
            <th className="px-4 py-3 text-right">무게(kg)</th>
            <th className="px-4 py-3 text-right">청구(USD)</th>
            <th className="px-4 py-3 text-left">상태</th>
            <th className="px-4 py-3 text-left">발송일</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.length === 0 ? (
            <tr><td colSpan={8} className="px-4 py-6 text-center text-sm text-gray-400">송장 없음</td></tr>
          ) : rows.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-3">
                <Link href={`/admin/orders/${r.order_id}`} className="text-blue-600 hover:underline">
                  {r.print_orders?.order_number ?? r.order_id.slice(0, 8)}
                </Link>
              </td>
              <td className="px-4 py-3 text-xs">{r.print_orders?.shipping_country} {r.print_orders?.shipping_city}</td>
              <td className="px-4 py-3 text-xs uppercase">{r.carrier}</td>
              <td className="px-4 py-3 font-mono text-xs">{r.tracking_number ?? '-'}</td>
              <td className="px-4 py-3 text-right text-xs">{r.weight_kg ?? '-'}</td>
              <td className="px-4 py-3 text-right text-xs">{r.charged_usd ? `$${Number(r.charged_usd).toFixed(2)}` : '-'}</td>
              <td className="px-4 py-3 text-xs">{r.status}</td>
              <td className="px-4 py-3 text-xs">{r.shipped_at ? new Date(r.shipped_at).toLocaleDateString() : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ============ Config ============ */
function ConfigPanel({ config, reload, setMsg }: { config: Config | null; reload: () => void; setMsg: (s: string) => void }) {
  const [draft, setDraft] = useState<Partial<Config>>({})
  useEffect(() => { setDraft({}) }, [config])
  if (!config) return <p className="text-sm text-gray-500">설정을 로드할 수 없습니다.</p>

  const merged: Config = { ...config, ...draft }

  const save = async () => {
    const res = await fetch('/api/admin/shipping/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    })
    const data = await res.json()
    setMsg(res.ok ? '저장됨' : `오류: ${data.error}`)
    if (res.ok) { setDraft({}); reload() }
  }

  return (
    <div className="rounded-2xl bg-white border border-gray-200 p-5 max-w-xl space-y-4">
      <h2 className="text-sm font-semibold text-gray-900">배송 설정</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="VAT 가산율 (%)">
          <input type="number" step="0.01" value={merged.vat_markup_percent}
            onChange={(e) => setDraft((d) => ({ ...d, vat_markup_percent: Number(e.target.value) }))}
            className="w-full rounded-lg border-gray-200 text-sm" />
        </Field>
        <Field label="원산지 (ISO-2)">
          <input value={merged.origin_country}
            onChange={(e) => setDraft((d) => ({ ...d, origin_country: e.target.value.toUpperCase() }))}
            className="w-full rounded-lg border-gray-200 text-sm font-mono" />
        </Field>
        <Field label="기본 패키지 무게 (kg)">
          <input type="number" step="0.001" value={merged.default_weight_kg}
            onChange={(e) => setDraft((d) => ({ ...d, default_weight_kg: Number(e.target.value) }))}
            className="w-full rounded-lg border-gray-200 text-sm" />
        </Field>
        <Field label="Fallback 요금 (USD)">
          <input type="number" step="0.01" value={merged.fallback_rate_usd}
            onChange={(e) => setDraft((d) => ({ ...d, fallback_rate_usd: Number(e.target.value) }))}
            className="w-full rounded-lg border-gray-200 text-sm" />
        </Field>
      </div>

      <div className="border-t border-gray-200 pt-4 mt-2">
        <h3 className="text-xs font-semibold text-gray-700 uppercase mb-3">무료배송 프로모션</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="무료배송 임계 (USD, 0=비활성)">
            <input type="number" step="0.01" value={merged.free_shipping_threshold_usd ?? 0}
              onChange={(e) => setDraft((d) => ({ ...d, free_shipping_threshold_usd: Number(e.target.value) }))}
              className="w-full rounded-lg border-gray-200 text-sm" />
          </Field>
          <Field label="무료배송 무게 상한 (kg, 0=무제한)">
            <input type="number" step="0.001" value={merged.free_shipping_max_weight_kg ?? 0}
              onChange={(e) => setDraft((d) => ({ ...d, free_shipping_max_weight_kg: Number(e.target.value) }))}
              className="w-full rounded-lg border-gray-200 text-sm" />
          </Field>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          예: 임계 $150 + 상한 3kg → 주문가 $150 이상이면서 무게 3kg 이하인 주문만 무료배송.
        </p>
      </div>

      <p className="text-xs text-gray-500">
        VAT 가산율은 FedEx 원가에 자동으로 더해져 고객 청구 금액이 됩니다.
        (예: 가산율 10%, 원가 $20 → 청구 $22.00)
      </p>

      <div className="border-t border-gray-200 pt-4 mt-2">
        <h3 className="text-xs font-semibold text-gray-700 uppercase mb-3">발신지 (Origin / 패킹슬립 인쇄용)</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="회사명 (한국어)">
            <input value={merged.origin_company_ko ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, origin_company_ko: e.target.value }))}
              className="w-full rounded-lg border-gray-200 text-sm" />
          </Field>
          <Field label="Company (English)">
            <input value={merged.origin_company_en ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, origin_company_en: e.target.value }))}
              className="w-full rounded-lg border-gray-200 text-sm" />
          </Field>
          <Field label="주소 (Line 1)">
            <input value={merged.origin_address_line1 ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, origin_address_line1: e.target.value }))}
              className="w-full rounded-lg border-gray-200 text-sm" />
          </Field>
          <Field label="주소 (Line 2)">
            <input value={merged.origin_address_line2 ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, origin_address_line2: e.target.value }))}
              className="w-full rounded-lg border-gray-200 text-sm" />
          </Field>
          <Field label="시 (City)">
            <input value={merged.origin_city ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, origin_city: e.target.value }))}
              className="w-full rounded-lg border-gray-200 text-sm" />
          </Field>
          <Field label="도/주 (State)">
            <input value={merged.origin_state ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, origin_state: e.target.value }))}
              className="w-full rounded-lg border-gray-200 text-sm" />
          </Field>
          <Field label="우편번호">
            <input value={merged.origin_postal_code ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, origin_postal_code: e.target.value }))}
              className="w-full rounded-lg border-gray-200 text-sm" />
          </Field>
          <Field label="전화번호">
            <input value={merged.origin_phone ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, origin_phone: e.target.value }))}
              className="w-full rounded-lg border-gray-200 text-sm" />
          </Field>
          <Field label="이메일">
            <input value={merged.origin_email ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, origin_email: e.target.value }))}
              className="w-full rounded-lg border-gray-200 text-sm" />
          </Field>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          패킹슬립의 FROM 박스에 자동 표시됩니다.
        </p>
      </div>
      <button
        onClick={save}
        disabled={Object.keys(draft).length === 0}
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-30"
      >
        저장
      </button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-700 mb-1 block">{label}</span>
      {children}
    </label>
  )
}

/* ============ Reconciliation ============ */
interface ReconRow {
  shipmentId: string
  orderNumber: string | null
  customer: string | null
  destinationCountry: string | null
  trackingNumber: string | null
  zoneCode: string | null
  serviceCode: string | null
  weightKg: number
  costUsd: number
  chargedUsd: number
  status: string
  shippedAt: string | null
  createdAt: string
}
interface ReconSummary {
  totalShipments: number
  totalEstimatedCostUsd: number
  totalChargedUsd: number
  avgWeightKg: number
  byCountry: Record<string, number>
  byStatus: Record<string, number>
  period: { from: string; to: string; unit: string }
}
interface InvoiceRow {
  id: string
  invoice_number: string
  invoice_date: string
  total_usd: number | null
  account_number: string | null
}

function ReconciliationPanel({ setMsg }: { setMsg: (s: string) => void }) {
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1); d.setDate(1)
    return d.toISOString().slice(0, 10)
  })
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [unit, setUnit] = useState('pccf')
  const [rows, setRows] = useState<ReconRow[]>([])
  const [summary, setSummary] = useState<ReconSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ from, to, unit })
    const [r, i] = await Promise.all([
      fetch(`/api/admin/shipping/reconciliation?${params}`).then((r) => r.json()),
      fetch('/api/admin/shipping/invoice-import').then((r) => r.json()).catch(() => ({ invoices: [] })),
    ])
    setRows(r.rows ?? [])
    setSummary(r.summary ?? null)
    setInvoices(i.invoices ?? [])
    setLoading(false)
  }, [from, to, unit])

  useEffect(() => { load() }, [load])

  const downloadCsv = () => {
    const params = new URLSearchParams({ from, to, unit, format: 'csv' })
    window.open(`/api/admin/shipping/reconciliation?${params}`, '_blank')
  }

  return (
    <div className="space-y-4">
      {/* 사업부 분리 안내 */}
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
        <strong>같은 FedEx 어카운트를 다른 사업부와 공유 중입니다</strong> (예: 에띠앙).
        이 페이지는 <code>business_unit=&apos;pccf&apos;</code> 송장만 표시합니다. FedEx 월별 인보이스 받으면 아래 임포트로 자동 매칭/차이 검출.
      </div>

      {/* 필터 */}
      <div className="rounded-2xl bg-white border border-gray-200 p-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-xs text-gray-600">From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="block rounded-lg border-gray-200 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs text-gray-600">To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="block rounded-lg border-gray-200 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs text-gray-600">사업부</span>
          <select value={unit} onChange={(e) => setUnit(e.target.value)}
            className="block rounded-lg border-gray-200 text-sm">
            <option value="pccf">PCCF (Procardcrafters)</option>
            <option value="ettiang">Ettiang</option>
            <option value="other">Other</option>
          </select>
        </label>
        <button onClick={downloadCsv}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white">
          CSV 다운로드
        </button>
      </div>

      {/* 요약 */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Summary label="총 송장" value={`${summary.totalShipments}`} />
          <Summary label="예상 FedEx 원가" value={`$${summary.totalEstimatedCostUsd.toFixed(2)}`} sub="우리 추정" />
          <Summary label="고객 청구 합계" value={`$${summary.totalChargedUsd.toFixed(2)}`} sub="VAT 포함" />
          <Summary label="평균 무게" value={`${summary.avgWeightKg.toFixed(2)} kg`} />
        </div>
      )}

      {/* 송장 리스트 */}
      <div className="rounded-2xl bg-white border border-gray-200 overflow-x-auto">
        {loading ? (
          <p className="p-6 text-sm text-gray-500">불러오는 중...</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-gray-400">기간 내 송장 없음</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">주문</th>
                <th className="px-3 py-2 text-left">도착</th>
                <th className="px-3 py-2 text-left">송장번호</th>
                <th className="px-3 py-2 text-left">Zone</th>
                <th className="px-3 py-2 text-right">kg</th>
                <th className="px-3 py-2 text-right">원가</th>
                <th className="px-3 py-2 text-right">청구</th>
                <th className="px-3 py-2 text-left">상태</th>
                <th className="px-3 py-2 text-left">발송일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.shipmentId}>
                  <td className="px-3 py-2 font-mono text-xs">{r.orderNumber}</td>
                  <td className="px-3 py-2 text-xs">{r.destinationCountry}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.trackingNumber ?? '—'}</td>
                  <td className="px-3 py-2 text-xs">{r.zoneCode ?? '—'}</td>
                  <td className="px-3 py-2 text-right text-xs">{r.weightKg.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right text-xs">${r.costUsd.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right text-xs">${r.chargedUsd.toFixed(2)}</td>
                  <td className="px-3 py-2 text-xs">{r.status}</td>
                  <td className="px-3 py-2 text-xs">{r.shippedAt ? new Date(r.shippedAt).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* FedEx 인보이스 import */}
      <InvoiceImporter onImported={() => { load(); setMsg('인보이스 임포트 완료') }} invoices={invoices} />
    </div>
  )
}

function Summary({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-white border border-gray-200 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-bold text-gray-900">{value}</p>
      {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
    </div>
  )
}

function InvoiceImporter({ onImported, invoices }: { onImported: () => void; invoices: InvoiceRow[] }) {
  const [csv, setCsv] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ matched: number; discrepancy: number; unmatched: number; total: number } | null>(null)

  const doImport = async () => {
    if (!invoiceNumber) { alert('인보이스 번호 필수'); return }
    setImporting(true); setResult(null)
    // 형식: trackingNumber,shipDate,serviceCode,weightKg,chargedUsd,destinationCountry  (첫 줄 헤더 자동 무시)
    const rows = csv.split('\n').map((l) => l.trim()).filter(Boolean).filter((l) => !/^tracking|^#/i.test(l))
      .map((line) => {
        const cells = line.split(',').map((c) => c.trim())
        return {
          trackingNumber: cells[0],
          shipDate: cells[1] || undefined,
          serviceCode: cells[2] || undefined,
          weightKg: Number(cells[3]) || undefined,
          chargedUsd: Number(cells[4]),
          destinationCountry: cells[5] || undefined,
        }
      }).filter((r) => r.trackingNumber && Number.isFinite(r.chargedUsd))

    if (!rows.length) { alert('파싱된 행 없음'); setImporting(false); return }

    const res = await fetch('/api/admin/shipping/invoice-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceNumber, invoiceDate, rows }),
    })
    const data = await res.json()
    setImporting(false)
    if (!res.ok) { alert(`오류: ${data.error}`); return }
    setResult({ matched: data.matched, discrepancy: data.discrepancy, unmatched: data.unmatched, total: data.total })
    onImported()
  }

  return (
    <div className="rounded-2xl bg-white border border-gray-200 p-5 space-y-4">
      <h2 className="text-sm font-semibold text-gray-900">FedEx 인보이스 임포트 (CSV)</h2>
      <p className="text-xs text-gray-500 leading-relaxed">
        포맷: <code className="bg-gray-100 px-1 rounded">trackingNumber,shipDate,serviceCode,weightKg,chargedUsd,destinationCountry</code> (헤더 자동 스킵).<br />
        매칭 결과: <span className="text-green-700">matched</span> = 우리 송장 + 금액 OK,
        <span className="text-orange-700"> discrepancy</span> = 금액 차이 &gt; $1,
        <span className="text-amber-700"> unmatched</span> = 우리 시스템에 없음 (=다른 사업부 가능성).
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="block">
          <span className="text-xs text-gray-600">인보이스 번호</span>
          <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)}
            className="w-full rounded-lg border-gray-200 text-sm" placeholder="예: 8-123-45678" />
        </label>
        <label className="block">
          <span className="text-xs text-gray-600">인보이스 일자</span>
          <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)}
            className="w-full rounded-lg border-gray-200 text-sm" />
        </label>
      </div>
      <textarea rows={8} value={csv} onChange={(e) => setCsv(e.target.value)}
        placeholder="780012345678,2026-05-15,INTERNATIONAL_PRIORITY,1.2,14.50,US"
        className="w-full rounded-lg border-gray-200 font-mono text-xs" />
      <button onClick={doImport} disabled={importing}
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {importing ? '임포트 중...' : '임포트 + 자동 매칭'}
      </button>

      {result && (
        <div className="grid grid-cols-4 gap-2 text-center text-xs pt-2">
          <div className="rounded bg-gray-100 p-2">총 {result.total}</div>
          <div className="rounded bg-green-100 text-green-700 p-2 flex items-center justify-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> matched {result.matched}
          </div>
          <div className="rounded bg-orange-100 text-orange-700 p-2 flex items-center justify-center gap-1">
            <AlertTriangle className="w-3 h-3" /> diff {result.discrepancy}
          </div>
          <div className="rounded bg-amber-100 text-amber-700 p-2 flex items-center justify-center gap-1">
            <AlertTriangle className="w-3 h-3" /> unmatched {result.unmatched}
          </div>
        </div>
      )}

      {invoices.length > 0 && (
        <div className="pt-3 border-t border-gray-200">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">최근 임포트된 인보이스</h3>
          <ul className="space-y-1 text-xs">
            {invoices.slice(0, 5).map((inv) => (
              <li key={inv.id} className="flex justify-between">
                <span className="font-mono">{inv.invoice_number}</span>
                <span className="text-gray-500">{inv.invoice_date}</span>
                {inv.total_usd && <span>${Number(inv.total_usd).toFixed(2)}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
