'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Star } from 'lucide-react'

const ReviewWriteModal = dynamic(() => import('./ReviewWriteModal'), { ssr: false })

interface Props {
  orderId: string
  productId: string
  productName: string
  defaultName: string
}

export default function ReviewButton({ orderId, productId, productName, defaultName }: Props) {
  const [open, setOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  if (submitted) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
        <Star className="w-3 h-3 fill-green-500 stroke-green-500" />
        리뷰 접수됨
      </span>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
      >
        <Star className="w-3 h-3" />
        리뷰 작성
      </button>
      {open && (
        <ReviewWriteModal
          orderId={orderId}
          productId={productId}
          productName={productName}
          defaultName={defaultName}
          onClose={() => setOpen(false)}
          onSuccess={() => setSubmitted(true)}
        />
      )}
    </>
  )
}
