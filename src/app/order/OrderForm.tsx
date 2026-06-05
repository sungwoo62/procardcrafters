'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js'
import { trackBeginCheckout } from '@/lib/analytics'
import type { PrintProduct } from '@/types/database'
import { COUNTRIES, STATES_BY_COUNTRY, getCountry, isPostalCodeValid } from '@/lib/intl-address'

interface Props {
  product: PrintProduct
  selectedOptions: Record<string, string>
  itemPriceUsd: number
  shippingUsd: number            // 초기 표시값 (서버 SSR 기본 추정값)
  exchangeRate: number
  preloadedFileId?: string | null
}

interface ShippingOption {
  serviceCode: string | null
  serviceNameEn: string | null
  costUsd: number
  effectiveCostUsd: number
  isDefault: boolean
  descriptionEn?: string | null
  descriptionKo?: string | null
  transitTimeLabelEn?: string | null
  transitTimeLabelKo?: string | null
  deliveryDayOfWeek?: string | null
  zoneCode: string
  isFallback: boolean
}

interface LiveQuoteResponse {
  options: ShippingOption[]
  defaultOptionIndex: number
  freeShipping: boolean
  freeShippingThresholdUsd: number
  freeShippingShortageUsd: number
  freeShippingMaxWeightKg: number
  overWeightLimit: boolean
  freeShippingNote: string | null
}

interface FormState {
  customerName: string
  customerEmail: string
  customerPhone: string
  shippingName: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  country: string
  postalCode: string
}

const INITIAL_FORM: FormState = {
  customerName: '',
  customerEmail: '',
  customerPhone: '',
  shippingName: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  country: 'US',
  postalCode: '',
}

type UploadStatus = 'idle' | 'uploading' | 'done' | 'error'

interface FileValidation {
  isValid: boolean
  warnings: string[]
  details: {
    pageCount?: number
    widthMm?: number
    heightMm?: number
    colorSpace?: string
    hasBleed?: boolean
  }
}

export default function OrderForm({ product, selectedOptions, itemPriceUsd, shippingUsd, exchangeRate, preloadedFileId }: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const quantity = parseInt(selectedOptions['quantity'] ?? '1', 10) || 1

  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>(preloadedFileId ? 'done' : 'idle')
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(preloadedFileId ?? null)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(preloadedFileId ? 'Editor design file' : null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [fileValidation, setFileValidation] = useState<FileValidation | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [formTouched, setFormTouched] = useState(false)

  // 실시간 배송비 견적 (국가/우편번호/소계 변경 시 자동 갱신)
  const [liveQuoteResponse, setLiveQuoteResponse] = useState<LiveQuoteResponse | null>(null)
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(0)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [fileAgreement, setFileAgreement] = useState(false)

  const selectedOption = liveQuoteResponse?.options[selectedOptionIndex] ?? null
  const effectiveShippingUsd = selectedOption?.effectiveCostUsd ?? shippingUsd
  const totalUsd = itemPriceUsd + effectiveShippingUsd

  // Debounced 견적 페치 — 국가/우편번호/소계 변경 시 모든 옵션 갱신
  useEffect(() => {
    if (!form.country) return
    const timer = setTimeout(async () => {
      setQuoteLoading(true)
      try {
        const res = await fetch('/api/shipping/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            country: form.country,
            postalCode: form.postalCode,
            items: [{ productId: product.id, quantity, selectedOptions }],
            subtotalUsd: itemPriceUsd,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          setLiveQuoteResponse({
            options: (data.options ?? []).map((o: ShippingOption) => ({
              serviceCode: o.serviceCode,
              serviceNameEn: o.serviceNameEn,
              costUsd: Number(o.costUsd ?? 0),
              effectiveCostUsd: Number(o.effectiveCostUsd ?? o.costUsd ?? 0),
              isDefault: !!o.isDefault,
              descriptionEn: o.descriptionEn ?? null,
              descriptionKo: o.descriptionKo ?? null,
              transitTimeLabelEn: o.transitTimeLabelEn ?? null,
              transitTimeLabelKo: o.transitTimeLabelKo ?? null,
              deliveryDayOfWeek: o.deliveryDayOfWeek ?? null,
              zoneCode: String(o.zoneCode ?? ''),
              isFallback: !!o.isFallback,
            })),
            defaultOptionIndex: Number(data.defaultOptionIndex ?? 0),
            freeShipping: !!data.freeShipping,
            freeShippingThresholdUsd: Number(data.freeShippingThresholdUsd ?? 0),
            freeShippingShortageUsd: Number(data.freeShippingShortageUsd ?? 0),
            freeShippingMaxWeightKg: Number(data.freeShippingMaxWeightKg ?? 0),
            overWeightLimit: !!data.overWeightLimit,
            freeShippingNote: data.freeShippingNote ?? null,
          })
          // 국가/우편 변경 시 기본 선택(cheapest)으로 리셋
          setSelectedOptionIndex(Number(data.defaultOptionIndex ?? 0))
        }
      } catch { /* keep prior quote */ }
      finally { setQuoteLoading(false) }
    }, 350)
    return () => clearTimeout(timer)
  }, [form.country, form.postalCode, itemPriceUsd, product.id, selectedOptions])

  useEffect(() => {
    trackBeginCheckout({
      value: totalUsd,
      productId: product.id,
      productName: product.name_en,
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const country = useMemo(() => getCountry(form.country), [form.country])
  const stateOptions = STATES_BY_COUNTRY[form.country] ?? null
  const stateRequired = country?.statesRequired ?? false
  const postalValid = form.postalCode ? isPostalCodeValid(form.country, form.postalCode) : false

  function isFormValid(): boolean {
    if (
      !form.customerName ||
      !form.customerEmail ||
      !form.shippingName ||
      !form.addressLine1 ||
      !form.city ||
      !form.country ||
      !form.postalCode ||
      uploadStatus !== 'done' ||
      !fileAgreement
    ) {
      return false
    }
    if (stateRequired && !form.state) return false
    if (!postalValid) return false
    return true
  }

  function handleFieldChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setForm((prev) => {
      // Wipe state/province + postal when country switches — formats differ per country
      if (name === 'country' && value !== prev.country) {
        return { ...prev, country: value, state: '', postalCode: '' }
      }
      return { ...prev, [name]: value }
    })
    setFormTouched(true)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadStatus('uploading')
    setUploadError(null)
    setUploadedFileId(null)
    setFileValidation(null)

    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch('/api/files/upload', { method: 'POST', body: formData })
    const data = await res.json()

    if (!res.ok) {
      setUploadStatus('error')
      setUploadError(data.error ?? 'Upload failed')
      if (data.validation) setFileValidation(data.validation)
      return
    }

    setUploadStatus('done')
    setUploadedFileId(data.fileId)
    setUploadedFileName(file.name)
    if (data.validation) setFileValidation(data.validation)
  }

  // PayPal createOrder callback — creates DB order + PayPal Order
  async function handlePaypalCreateOrder() {
    setPaymentError(null)

    const res = await fetch('/api/paypal/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ productId: product.id, selectedOptions, quantity, fileId: uploadedFileId ?? undefined }],
        customer: {
          email: form.customerEmail,
          name: form.customerName,
          phone: form.customerPhone || undefined,
        },
        shipping: {
          name: form.shippingName,
          addressLine1: form.addressLine1,
          addressLine2: form.addressLine2 || undefined,
          city: form.city,
          state: form.state || undefined,
          country: form.country,
          postalCode: form.postalCode,
          shippingServiceCode: selectedOption?.serviceCode ?? undefined,
        },
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setPaymentError(data.error ?? 'Failed to create order')
      throw new Error(data.error)
    }

    // Stash orderId in sessionStorage for use in the capture callback
    sessionStorage.setItem('pccf_pending_order_id', data.orderId)
    return data.paypalOrderId as string
  }

  // PayPal onApprove callback — captures the payment
  async function handlePaypalApprove(paypalOrderId: string) {
    const orderId = sessionStorage.getItem('pccf_pending_order_id')
    if (!orderId) {
      setPaymentError('Order session expired. Please try again.')
      return
    }

    const res = await fetch('/api/paypal/capture-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paypalOrderId, orderId }),
    })

    const data = await res.json()
    if (!res.ok) {
      setPaymentError(data.error ?? 'Payment capture failed')
      return
    }

    sessionStorage.removeItem('pccf_pending_order_id')
    sessionStorage.setItem(
      'pccf_purchase_data',
      JSON.stringify({ value: totalUsd, productId: product.id, productName: product.name_en }),
    )
    router.push(`/order/success?order=${data.orderNumber}`)
  }

  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? ''

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Upload File & Place Order</h1>
        <p className="text-gray-500 text-sm">{product.name_en}</p>
      </div>

      {/* Options Summary */}
      {Object.keys(selectedOptions).length > 0 && (
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-xs font-semibold text-blue-700 mb-2 uppercase tracking-wide">Selected Options</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(selectedOptions).map(([type, value]) => (
              <span key={type} className="px-2 py-1 bg-white border border-blue-200 rounded text-sm text-blue-700">
                {type}: {value}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* File Upload */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">1. Upload Print File</h2>
        <p className="text-sm text-gray-500 mb-4">Supports PDF, AI, PSD, PNG, JPG, TIFF · Max 200MB</p>

        <div
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            uploadStatus === 'done'
              ? 'border-green-400 bg-green-50'
              : uploadStatus === 'error'
              ? 'border-red-300 bg-red-50'
              : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
          }`}
        >
          {uploadStatus === 'uploading' && (
            <div className="flex flex-col items-center gap-2 text-blue-600">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="text-sm font-medium">Uploading...</p>
            </div>
          )}
          {uploadStatus === 'done' && (
            <div className="flex flex-col items-center gap-2 text-green-600">
              <CheckCircle className="w-8 h-8" />
              <p className="text-sm font-medium">{uploadedFileName}</p>
              <p className="text-xs text-green-500">Upload complete · Click to replace file</p>
            </div>
          )}
          {uploadStatus === 'error' && (
            <div className="flex flex-col items-center gap-2 text-red-600">
              <AlertCircle className="w-8 h-8" />
              <p className="text-sm font-medium">{uploadError}</p>
              <p className="text-xs">Click to try again</p>
            </div>
          )}
          {uploadStatus === 'idle' && (
            <div className="flex flex-col items-center gap-2 text-gray-500">
              <Upload className="w-8 h-8" />
              <p className="text-sm font-medium">Choose a file or drag and drop here</p>
              <p className="text-xs">PDF · AI · PSD · PNG · JPG · TIFF</p>
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.ai,.psd,.png,.jpg,.jpeg,.tif,.tiff"
          onChange={handleFileChange}
          className="hidden"
        />

        {uploadStatus === 'done' && uploadedFileName && (
          <div className="mt-3 flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-3">
            <FileText className="w-4 h-4 text-blue-500 shrink-0" />
            <span className="truncate">{uploadedFileName}</span>
          </div>
        )}

        {fileValidation && (
          <div className="mt-3 space-y-2">
            {fileValidation.details && (
              <div className="flex flex-wrap gap-2 text-xs">
                {fileValidation.details.colorSpace && (
                  <span className={`px-2 py-1 rounded-full font-medium ${fileValidation.details.colorSpace === 'CMYK' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {fileValidation.details.colorSpace}
                  </span>
                )}
                {fileValidation.details.pageCount !== undefined && (
                  <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">
                    {fileValidation.details.pageCount}p
                  </span>
                )}
                {fileValidation.details.widthMm !== undefined && (
                  <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">
                    {fileValidation.details.widthMm}×{fileValidation.details.heightMm}mm
                  </span>
                )}
                {fileValidation.details.hasBleed !== undefined && (
                  <span className={`px-2 py-1 rounded-full font-medium ${fileValidation.details.hasBleed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    Bleed: {fileValidation.details.hasBleed ? 'OK' : 'Missing'}
                  </span>
                )}
              </div>
            )}
            {fileValidation.warnings.length > 0 && (
              <div className="space-y-1">
                {fileValidation.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    {w}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Customer Information */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">2. Your Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="customerName"
              value={form.customerName}
              onChange={handleFieldChange}
              required
              placeholder="Full name"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              name="customerEmail"
              value={form.customerEmail}
              onChange={handleFieldChange}
              required
              placeholder="you@example.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone (optional)</label>
            <input
              type="tel"
              name="customerPhone"
              value={form.customerPhone}
              onChange={handleFieldChange}
              placeholder={country?.phonePlaceholder ?? '+1 (555) 000-0000'}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </section>

      {/* Shipping Information */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">3. Shipping Information</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Recipient Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="shippingName"
              value={form.shippingName}
              onChange={handleFieldChange}
              required
              placeholder="Recipient's full name"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Street Address <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="addressLine1"
              value={form.addressLine1}
              onChange={handleFieldChange}
              required
              placeholder={form.country === 'GB' ? '10 Downing Street' : form.country === 'JP' ? '1-1-1 Chiyoda' : '123 Main Street'}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2 (optional)</label>
            <input
              type="text"
              name="addressLine2"
              value={form.addressLine2}
              onChange={handleFieldChange}
              placeholder="Apt, Suite, Unit, etc."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Country <span className="text-red-500">*</span>
            </label>
            <select
              name="country"
              value={form.country}
              onChange={handleFieldChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="city"
                value={form.city}
                onChange={handleFieldChange}
                required
                placeholder={form.country === 'GB' ? 'London' : form.country === 'CA' ? 'Toronto' : form.country === 'AU' ? 'Sydney' : form.country === 'JP' ? 'Tokyo' : 'City'}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {country?.stateLabel ?? 'State / Province'}
                {stateRequired ? <span className="text-red-500"> *</span> : <span className="text-gray-400 text-xs"> (optional)</span>}
              </label>
              {stateOptions ? (
                <select
                  name="state"
                  value={form.state}
                  onChange={handleFieldChange}
                  required={stateRequired}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select {country?.stateLabel ?? 'state'}…</option>
                  {stateOptions.map((s) => (
                    <option key={s.code} value={s.code}>{s.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  name="state"
                  value={form.state}
                  onChange={handleFieldChange}
                  required={stateRequired}
                  placeholder={country?.stateLabel ?? ''}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {country?.postalLabel ?? 'Postal Code'} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="postalCode"
              value={form.postalCode}
              onChange={handleFieldChange}
              required
              placeholder={country?.postalPlaceholder ?? '00000'}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${form.postalCode && !postalValid ? 'border-red-300' : 'border-gray-300'}`}
            />
            {form.postalCode && !postalValid && (
              <p className="mt-1 text-xs text-red-600">
                Format should look like <span className="font-mono">{country?.postalPlaceholder}</span>
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Shipping Options */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          4. Shipping Service
          {quoteLoading && <Loader2 className="w-4 h-4 inline ml-2 animate-spin text-gray-400" />}
        </h2>
        {liveQuoteResponse && liveQuoteResponse.options.length > 0 ? (
          <div className="space-y-2">
            {liveQuoteResponse.options.map((opt, idx) => {
              const isSelected = idx === selectedOptionIndex
              const isCheapest = idx === liveQuoteResponse.defaultOptionIndex
              const isFree = liveQuoteResponse.freeShipping && isCheapest
              const isDifferential = liveQuoteResponse.freeShipping && !isCheapest

              return (
                <label
                  key={opt.serviceCode ?? idx}
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="shippingOption"
                    checked={isSelected}
                    onChange={() => setSelectedOptionIndex(idx)}
                    className="mt-1 w-4 h-4 accent-blue-600 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-gray-900">
                        {opt.serviceNameEn ?? opt.serviceCode ?? 'FedEx'}
                      </span>
                      {isCheapest && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                          추천
                        </span>
                      )}
                    </div>
                    {(opt.transitTimeLabelKo || opt.transitTimeLabelEn) && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {opt.transitTimeLabelKo ?? opt.transitTimeLabelEn}
                      </p>
                    )}
                    {(opt.descriptionKo || opt.descriptionEn) && (
                      <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                        {opt.descriptionKo ?? opt.descriptionEn}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {isFree ? (
                      <span className="text-green-600 font-bold text-sm">FREE</span>
                    ) : isDifferential ? (
                      <span className="font-semibold text-sm text-gray-900">
                        +${opt.effectiveCostUsd.toFixed(2)}
                      </span>
                    ) : (
                      <span className="font-semibold text-sm text-gray-900">
                        ${opt.effectiveCostUsd.toFixed(2)}
                      </span>
                    )}
                  </div>
                </label>
              )
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 p-4 text-sm text-gray-500">
            {quoteLoading ? 'Calculating shipping rates…' : 'Enter your shipping address to see options.'}
          </div>
        )}
        {liveQuoteResponse?.freeShippingNote && !liveQuoteResponse.freeShipping && (
          <p className={`mt-2 text-xs rounded px-2 py-1 ${liveQuoteResponse.overWeightLimit ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
            {liveQuoteResponse.freeShippingNote}
          </p>
        )}
      </section>

      {/* Order Summary */}
      <section className="border border-gray-200 rounded-xl p-5 bg-gray-50 space-y-3">
        <h2 className="font-semibold text-gray-900">Order Summary</h2>
        <div className="flex justify-between text-sm text-gray-600">
          <span>Print Price</span>
          <span>${itemPriceUsd.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-600">
          <span>
            Shipping
            {selectedOption?.serviceNameEn && (
              <span className="text-xs text-gray-400 ml-1">({selectedOption.serviceNameEn})</span>
            )}
            {quoteLoading && <Loader2 className="w-3 h-3 inline ml-1 animate-spin" />}
          </span>
          <span>
            {liveQuoteResponse?.freeShipping && selectedOptionIndex === liveQuoteResponse.defaultOptionIndex ? (
              <span className="text-green-600 font-semibold">FREE</span>
            ) : (
              <>${effectiveShippingUsd.toFixed(2)}</>
            )}
          </span>
        </div>
        {liveQuoteResponse?.freeShippingNote && !liveQuoteResponse.freeShipping && (
          <p className={`text-xs rounded px-2 py-1 ${liveQuoteResponse.overWeightLimit ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
            {liveQuoteResponse.freeShippingNote}
          </p>
        )}
        <div className="border-t border-gray-200 pt-3 flex justify-between font-bold text-lg">
          <span>Total</span>
          <span className="text-blue-600">${totalUsd.toFixed(2)} USD</span>
        </div>
        <p className="text-xs text-gray-400">Exchange rate: 1 KRW ≈ ${exchangeRate.toFixed(6)} USD</p>
      </section>

      {/* File Responsibility Agreement */}
      <section className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={fileAgreement}
            onChange={e => { setFileAgreement(e.target.checked); setFormTouched(true) }}
            className="mt-0.5 w-4 h-4 rounded border-amber-400 accent-amber-600 shrink-0"
          />
          <span className="text-sm text-amber-900 leading-relaxed">
            <strong className="block mb-1">File Responsibility Agreement (Required)</strong>
            I confirm that I have reviewed my print file and it meets all technical requirements including correct resolution (300 DPI minimum), bleed area, safe zone, and color mode (CMYK). I understand that{' '}
            <strong>Procardcrafters is not responsible for print quality issues arising from incorrect or low-quality files</strong>{' '}
            — all file quality and content responsibility lies with the customer. By checking this box, I acknowledge this agreement and accept full responsibility for the uploaded file.
          </span>
        </label>
      </section>

      {/* PayPal Buttons */}
      <section>
        {!isFormValid() && formTouched && (
          <div className="flex items-center gap-2 text-amber-700 text-sm bg-amber-50 rounded-lg px-4 py-3 mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Please complete all required fields and upload your print file before paying.
          </div>
        )}
        {!isFormValid() && !formTouched && (
          <p className="text-sm text-gray-500 mb-3 text-center">
            Fill in your details and upload your file to unlock payment.
          </p>
        )}

        {paymentError && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg px-4 py-3 mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {paymentError}
          </div>
        )}

        <div className={isFormValid() ? '' : 'opacity-40 pointer-events-none'}>
          <PayPalScriptProvider
            options={{
              clientId,
              currency: 'USD',
              intent: 'capture',
            }}
          >
            <PayPalButtons
              style={{ layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay' }}
              createOrder={handlePaypalCreateOrder}
              onApprove={async (data) => {
                await handlePaypalApprove(data.orderID)
              }}
              onError={(err) => {
                setPaymentError(`Payment error: ${String(err)}`)
              }}
            />
          </PayPalScriptProvider>
        </div>
        <p className="text-xs text-center text-gray-400 mt-3">
          Secure USD payment via PayPal · Your payment details are protected
        </p>
      </section>
    </div>
  )
}
