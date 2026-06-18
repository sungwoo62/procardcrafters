'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Check, ChevronDown } from 'lucide-react'
import type { PrintProductOption } from '@/types/database'
import { getTextureSrc, PAPER_DESC, PAPER_TAGS } from '@/components/PaperPopup'

interface PaperDropdownProps {
  options: PrintProductOption[]
  value: string
  onChange: (value: string) => void
  /** Used for the empty-state placeholder ("Select Paper" 등). */
  label: string
}

// OMO-3195: 버튼 그리드 대신 드롭다운으로 용지/후가공을 선택한다.
// 네이티브 <select> 는 이미지·설명을 못 보여주므로 커스텀 listbox 로 구현 —
// 각 행에 질감 썸네일 + 설명 + 특성 태그를 인라인 노출해 "보면서 고르게" 한다.
export default function PaperDropdown({ options, value, onChange, label }: PaperDropdownProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // 바깥 클릭 / ESC 로 닫기
  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const selected = options.find((o) => o.value === value) ?? null

  return (
    <div ref={rootRef} className="relative">
      {/* 트리거 — 선택된 용지의 썸네일 + 라벨 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-left text-sm text-gray-800 transition-colors hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
      >
        {selected ? (
          <>
            <span className="h-8 w-8 shrink-0 overflow-hidden rounded-md border border-gray-100 shadow-sm">
              <Image
                src={getTextureSrc(selected.value, selected.image_url)}
                alt={selected.label_en}
                width={32}
                height={32}
                className="h-full w-full object-cover"
                unoptimized
              />
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">{selected.label_en}</span>
          </>
        ) : (
          <span className="min-w-0 flex-1 text-gray-400">Select {label}</span>
        )}
        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* 패널 — 각 행에 썸네일 + 설명 + 태그 인라인 */}
      {open && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1.5 max-h-80 w-full overflow-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl"
        >
          {options.map((opt) => {
            const isSelected = opt.value === value
            const desc = opt.description_en || PAPER_DESC[opt.value] || null
            const tags = PAPER_TAGS[opt.value] ?? []
            return (
              <li key={opt.value} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt.value)
                    setOpen(false)
                  }}
                  className={`flex w-full items-start gap-3 rounded-lg p-2 text-left transition-colors ${
                    isSelected ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-gray-100 shadow-sm">
                    <Image
                      src={getTextureSrc(opt.value, opt.image_url)}
                      alt={opt.label_en}
                      width={48}
                      height={48}
                      className="h-full w-full object-cover"
                      unoptimized
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className={`text-sm font-semibold leading-tight ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>
                        {opt.label_en}
                      </span>
                      {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-blue-600" />}
                    </span>
                    {desc && <span className="mt-0.5 block text-[11px] leading-snug text-gray-600">{desc}</span>}
                    {tags.length > 0 && (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {tags.map((tag) => (
                          <span key={tag} className="inline-block rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-600">
                            {tag}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
