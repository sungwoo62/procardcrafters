'use client'

import type { PrintProductOption } from '@/types/database'

interface SizePopupProps {
  option: Pick<PrintProductOption, 'value' | 'label_en' | 'label_ko'>
}

// ISO/IEC 7810 ID-1 신용카드 = 85.6 × 53.98 mm (비교 기준)
const CARD_W = 85.6
const CARD_H = 53.98

/** "90×50mm (Standard)" / "85*40" 같은 라벨에서 가로×세로(mm) 추출. */
function parseDims(label: string): { w: number; h: number } | null {
  const m = label.match(/(\d{2,4}(?:\.\d+)?)\s*[×xX*]\s*(\d{2,4}(?:\.\d+)?)/)
  if (!m) return null
  const w = parseFloat(m[1])
  const h = parseFloat(m[2])
  if (!(w > 0 && h > 0)) return null
  return { w, h }
}

// OMO-3196 (보드 요청): 사이즈 버튼에 hover 시 신용카드와 크기 비교 이미지를 띄운다.
export default function SizePopup({ option }: SizePopupProps) {
  const dims = parseDims(`${option.label_en ?? ''} ${option.label_ko ?? ''}`)

  const VBW = 200
  const VBH = 130
  const pad = 18
  const maxW = Math.max(CARD_W, dims?.w ?? CARD_W)
  const maxH = Math.max(CARD_H, dims?.h ?? CARD_H)
  const scale = Math.min((VBW - pad * 2) / maxW, (VBH - pad * 2) / maxH)
  const ox = pad
  const oy = VBH - pad // bottom-left 정렬 기준

  const card = { x: ox, y: oy - CARD_H * scale, w: CARD_W * scale, h: CARD_H * scale }
  const prod = dims ? { x: ox, y: oy - dims.h * scale, w: dims.w * scale, h: dims.h * scale } : null

  return (
    <div className="pointer-events-none absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 bg-white border border-gray-200 rounded-xl shadow-xl p-3 text-left">
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-2 overflow-hidden">
        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-r border-b border-gray-200 rotate-45" />
      </div>

      <p className="text-xs font-semibold text-gray-900 mb-1.5">
        {dims ? `${dims.w} × ${dims.h} mm` : option.label_en}
        <span className="ml-1.5 font-normal text-gray-400">vs. credit card</span>
      </p>

      <svg viewBox={`0 0 ${VBW} ${VBH}`} className="w-full h-auto rounded-lg bg-gray-50">
        {/* 신용카드 기준 (점선 회색) */}
        <rect
          x={card.x} y={card.y} width={card.w} height={card.h}
          rx="4" fill="#e5e7eb" fillOpacity="0.5" stroke="#9ca3af" strokeWidth="1" strokeDasharray="4 3"
        />
        {/* 선택 사이즈 (파랑 반투명, 위에 겹침) */}
        {prod && (
          <rect
            x={prod.x} y={prod.y} width={prod.w} height={prod.h}
            rx="3" fill="#3b82f6" fillOpacity="0.22" stroke="#2563eb" strokeWidth="1.5"
          />
        )}
      </svg>

      <div className="mt-2 space-y-1">
        <div className="flex items-center gap-1.5 text-[11px] text-blue-700">
          <span className="inline-block w-3 h-2.5 rounded-sm bg-blue-500/30 border border-blue-600" />
          This size {dims ? `· ${dims.w}×${dims.h}mm` : ''}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
          <span className="inline-block w-3 h-2.5 rounded-sm border border-dashed border-gray-400" />
          Credit card · 85.6×54mm
        </div>
      </div>
    </div>
  )
}
