'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, ShoppingCart } from 'lucide-react'
import type { PrintProduct } from '@/types/database'

interface Props {
  product: PrintProduct
  selectedOptions: Record<string, string>
  itemPriceUsd: number
  shippingUsd: number
  exchangeRate: number
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

export default function OrderForm({ product, selectedOptions, itemPriceUsd, shippingUsd, exchangeRate }: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle')
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [fileValidation, setFileValidation] = useState<FileValidation | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const totalUsd = itemPriceUsd + shippingUsd

  function handleFieldChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
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
      if (data.validation) {
        setFileValidation(data.validation)
      }
      return
    }

    setUploadStatus('done')
    setUploadedFileId(data.fileId)
    setUploadedFileName(file.name)
    if (data.validation) {
      setFileValidation(data.validation)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!uploadedFileId) {
      setSubmitError('Please upload your print file first')
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [
          {
            productId: product.id,
            selectedOptions,
            fileId: uploadedFileId,
          },
        ],
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
        },
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setSubmitting(false)
      setSubmitError(data.error ?? 'Failed to create order')
      return
    }

    // Redirect to Stripe Checkout
    window.location.href = data.checkoutUrl
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Upload File & Place Order</h1>
        <p className="text-gray-500 text-sm">{product.name_en} · {product.name_ko}</p>
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

        {/* File Preview */}
        {uploadStatus === 'done' && uploadedFileName && (
          <div className="mt-3 flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-3">
            <FileText className="w-4 h-4 text-blue-500 shrink-0" />
            <span className="truncate">{uploadedFileName}</span>
          </div>
        )}

        {/* File Validation Results */}
        {fileValidation && (
          <div className="mt-3 space-y-2">
            {/* Details */}
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
            {/* Warning Messages */}
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
              placeholder="Hong Gildong"
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
              placeholder="+1 (555) 000-0000"
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
              placeholder="Hong Gildong"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="addressLine1"
              value={form.addressLine1}
              onChange={handleFieldChange}
              required
              placeholder="123 Main Street"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address Line 2 (optional)
            </label>
            <input
              type="text"
              name="addressLine2"
              value={form.addressLine2}
              onChange={handleFieldChange}
              placeholder="Apt, Suite, Unit, etc."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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
                placeholder="New York"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State / Province (optional)</label>
              <input
                type="text"
                name="state"
                value={form.state}
                onChange={handleFieldChange}
                placeholder="NY"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
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
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                <option value="AU">Australia</option>
                <option value="GB">United Kingdom</option>
                <option value="DE">Germany</option>
                <option value="FR">France</option>
                <option value="JP">Japan</option>
                <option value="KR">South Korea</option>
                <option value="SG">Singapore</option>
                <option value="HK">Hong Kong</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ZIP / Postal Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="postalCode"
                value={form.postalCode}
                onChange={handleFieldChange}
                required
                placeholder="10001"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Payment Summary */}
      <section className="border border-gray-200 rounded-xl p-5 bg-gray-50 space-y-3">
        <h2 className="font-semibold text-gray-900">Order Summary</h2>
        <div className="flex justify-between text-sm text-gray-600">
          <span>Print Price</span>
          <span>${itemPriceUsd.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-600">
          <span>Shipping</span>
          <span>${shippingUsd.toFixed(2)}</span>
        </div>
        <div className="border-t border-gray-200 pt-3 flex justify-between font-bold text-lg">
          <span>Total</span>
          <span className="text-blue-600">${totalUsd.toFixed(2)} USD</span>
        </div>
        <p className="text-xs text-gray-400">Exchange rate: 1 KRW ≈ ${exchangeRate.toFixed(6)} USD</p>
      </section>

      {submitError && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {submitError}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || uploadStatus === 'uploading'}
        className="w-full bg-blue-600 text-white px-6 py-4 rounded-xl font-semibold text-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Redirecting to checkout...
          </>
        ) : (
          <>
            <ShoppingCart className="w-5 h-5" />
            Pay with Stripe
          </>
        )}
      </button>
      <p className="text-xs text-center text-gray-400">
        Secure USD payment via Stripe · Your card details are never stored on our servers
      </p>
    </form>
  )
}
