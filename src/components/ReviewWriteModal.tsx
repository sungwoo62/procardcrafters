'use client'

import { useState, useRef } from 'react'
import { X, Star, Upload, Trash2, CheckCircle, AlertCircle } from 'lucide-react'
import { createAuthBrowserClient } from '@/lib/supabase'

interface Props {
  orderId: string
  productId: string
  productName: string
  defaultName: string
  onClose: () => void
  onSuccess: () => void
}

type Step = 'form' | 'uploading' | 'submitting' | 'success' | 'error'

const STAR_LABELS = ['', '별로예요', '아쉬워요', '보통이에요', '좋아요', '최고예요']

export default function ReviewWriteModal({ orderId, productId, productName, defaultName, onClose, onSuccess }: Props) {
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [useAnonymous, setUseAnonymous] = useState(false)
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [step, setStep] = useState<Step>('form')
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const displayName = useAnonymous ? 'Anonymous' : defaultName
  const bodyLen = body.length

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    const toAdd = files.slice(0, 5 - photos.length)
    setPhotos(prev => [...prev, ...toAdd])
    toAdd.forEach(file => {
      const reader = new FileReader()
      reader.onloadend = () => setPhotoPreviews(prev => [...prev, reader.result as string])
      reader.readAsDataURL(file)
    })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removePhoto(idx: number) {
    setPhotos(prev => prev.filter((_, i) => i !== idx))
    setPhotoPreviews(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!rating) { setError('별점을 선택해주세요.'); return }
    if (bodyLen < 10 || bodyLen > 5000) { setError('리뷰 본문은 10~5000자 사이여야 합니다.'); return }

    let photoUrls: string[] = []

    if (photos.length > 0) {
      setStep('uploading')
      const supabase = createAuthBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setStep('error')
        setError('로그인이 필요합니다.')
        return
      }

      const results = await Promise.allSettled(
        photos.map(async (file) => {
          const ext = file.name.split('.').pop() ?? 'jpg'
          const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
          const { error: uploadErr } = await supabase.storage
            .from('print-review-photos')
            .upload(path, file, { contentType: file.type, upsert: false })
          if (uploadErr) throw uploadErr
          return supabase.storage.from('print-review-photos').getPublicUrl(path).data.publicUrl
        })
      )

      if (results.some(r => r.status === 'rejected')) {
        setStep('error')
        setError('사진 업로드 중 오류가 발생했습니다. 다시 시도해주세요.')
        return
      }

      photoUrls = results.map(r => (r as PromiseFulfilledResult<string>).value)
    }

    setStep('submitting')
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          productId,
          rating,
          title: title.trim() || undefined,
          body,
          reviewerName: displayName,
          photos: photoUrls,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setStep('error')
        if (res.status === 409) {
          setError('이미 해당 상품에 리뷰를 작성하셨습니다.')
        } else if (res.status === 401) {
          setError('로그인 후 이용해주세요.')
        } else {
          setError(data.error ?? '리뷰 제출에 실패했습니다.')
        }
        return
      }
      setStep('success')
    } catch {
      setStep('error')
      setError('네트워크 오류가 발생했습니다. 다시 시도해주세요.')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">리뷰 작성</h2>
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[320px]">{productName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {step === 'success' ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-7 h-7 text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">리뷰가 접수되었습니다!</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              1-2 영업일 내 검토 후 게시됩니다.<br />
              게시 완료 시 <span className="font-semibold text-blue-600">$2 할인 쿠폰</span>이 자동 발급됩니다.
            </p>
            <button
              onClick={() => { onSuccess(); onClose() }}
              className="mt-6 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              확인
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col">
            <div className="flex-1 p-5 space-y-5">
              {/* Star Rating */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  별점 <span className="text-red-500">*</span>
                </p>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onMouseEnter={() => setHoverRating(n)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(n)}
                      className="transition-transform hover:scale-110 active:scale-95"
                      aria-label={`${n}점`}
                    >
                      <Star
                        className="w-8 h-8"
                        fill={(hoverRating || rating) >= n ? '#F59E0B' : 'none'}
                        stroke={(hoverRating || rating) >= n ? '#F59E0B' : '#D1D5DB'}
                        strokeWidth={1.5}
                      />
                    </button>
                  ))}
                  {rating > 0 && (
                    <span className="ml-2 text-sm text-amber-600 font-medium">
                      {STAR_LABELS[rating]}
                    </span>
                  )}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">
                  제목 <span className="text-gray-400 text-xs font-normal">(선택)</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  maxLength={100}
                  placeholder="리뷰 제목을 입력하세요"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              {/* Body */}
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">
                  리뷰 내용 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={5}
                  maxLength={5000}
                  placeholder="제품 품질, 인쇄 결과, 배송에 대한 솔직한 리뷰를 작성해주세요. (최소 10자)"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                />
                <p className={`text-xs mt-1 text-right ${bodyLen > 0 && bodyLen < 10 ? 'text-red-500' : 'text-gray-400'}`}>
                  {bodyLen.toLocaleString()} / 5,000자
                </p>
              </div>

              {/* Photo Upload */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-1.5">
                  사진 첨부 <span className="text-gray-400 text-xs font-normal">(최대 5장, 선택)</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {photoPreviews.map((src, i) => (
                    <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-gray-200 group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="사진 삭제"
                      >
                        <Trash2 className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  ))}
                  {photos.length < 5 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      <span className="text-[10px] mt-0.5">추가</span>
                    </button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* Name Display */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">이름 표시</p>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={!useAnonymous}
                      onChange={() => setUseAnonymous(false)}
                      className="accent-blue-600"
                    />
                    <span className="text-sm text-gray-700">{defaultName}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={useAnonymous}
                      onChange={() => setUseAnonymous(true)}
                      className="accent-blue-600"
                    />
                    <span className="text-sm text-gray-700">익명</span>
                  </label>
                </div>
              </div>

              {/* Error */}
              {(step === 'error' || error) && (
                <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg border border-red-100">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-600">{error}</p>
                </div>
              )}

              {/* Coupon notice */}
              <div className="bg-blue-50 rounded-xl py-3 px-4 text-center">
                <p className="text-xs text-gray-500">
                  리뷰 게시 후 <span className="font-semibold text-blue-600">$2 할인 쿠폰</span>이 자동 발급됩니다
                  <span className="text-gray-400"> (1-2 영업일 소요)</span>
                </p>
              </div>
            </div>

            {/* Sticky footer */}
            <div className="flex-shrink-0 px-5 py-4 border-t border-gray-100 bg-white">
              <button
                type="submit"
                disabled={step === 'uploading' || step === 'submitting'}
                className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors"
              >
                {step === 'uploading' ? '사진 업로드 중…' : step === 'submitting' ? '제출 중…' : '리뷰 제출하기'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
