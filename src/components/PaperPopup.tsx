'use client'

import Image from 'next/image'
import type { PrintProductOption } from '@/types/database'

interface PaperPopupProps {
  option: PrintProductOption
}

// SVG 질감 패턴 — 용지 계열별 시각적 구분
const makeSVG = (bg: string, lines?: string, extra?: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="${bg}"/>${lines ?? ''}${extra ?? ''}</svg>`

const GRID_LINES = (color = '#999', op = 0.1) =>
  `<g opacity="${op}" stroke="${color}" stroke-width="0.5">${[10,20,30,40,50,60,70].map(y=>`<line x1="0" y1="${y}" x2="80" y2="${y}"/>`).join('')}</g>`

const WEAVE = (color = '#8b7a65', op = 0.18) =>
  `<g opacity="${op}" stroke="${color}" stroke-width="0.7">${[8,16,24,32,40,48,56,64,72].map(y=>`<line x1="0" y1="${y}" x2="80" y2="${y}"/>`).join('')}${[8,16,24,32,40,48,56,64,72].map(x=>`<line x1="${x}" y1="0" x2="${x}" y2="80"/>`).join('')}</g>`

// 용지 코드 → SVG 질감
const TEXTURE_SVG: Record<string, string> = {
  // 스노우지 — 순백, 미세한 수평 결
  SNW120W00: makeSVG('#fafafa', GRID_LINES('#ccc', 0.08)),
  SNW150W00: makeSVG('#fafafa', GRID_LINES('#bbb', 0.09)),
  SNW180W00: makeSVG('#f9f9f9', GRID_LINES('#aaa', 0.10)),
  SNW200W00: makeSVG('#f9f9f9', GRID_LINES('#999', 0.11)),
  SNW250W00: makeSVG('#f8f8f8', GRID_LINES('#888', 0.12)),
  SNW300W00: makeSVG('#f7f7f7', GRID_LINES('#777', 0.13)),
  // 아트지 — 광택 흰색, 매끄러운 표면
  ART090W00: makeSVG('#f7f7f5', GRID_LINES('#ccc', 0.06), `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fff" stop-opacity="0.5"/><stop offset="100%" stop-color="#e8e8e4" stop-opacity="0.3"/></linearGradient></defs><rect width="80" height="80" fill="url(#g)"/>`),
  ART100W00: makeSVG('#f6f6f4', GRID_LINES('#ccc', 0.07), `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fff" stop-opacity="0.5"/><stop offset="100%" stop-color="#e5e5e1" stop-opacity="0.3"/></linearGradient></defs><rect width="80" height="80" fill="url(#g)"/>`),
  ART120W00: makeSVG('#f5f5f3', GRID_LINES('#bbb', 0.07)),
  ART150W00: makeSVG('#f4f4f2', GRID_LINES('#bbb', 0.08)),
  ART180W00: makeSVG('#f3f3f1', GRID_LINES('#aaa', 0.09)),
  ART200W00: makeSVG('#f2f2f0', GRID_LINES('#aaa', 0.10)),
  // 스티커 아트지 — 밝은 흰색
  STK075AT0: makeSVG('#f8f8f6'),
  STK075AT1: makeSVG('#f7f7f5'),
  STK090AF0: makeSVG('#f6f6f4'),
  // 유포지 — 반투명 필름 느낌
  STK080YP0: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><defs><linearGradient id="film" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#e8f4f8"/><stop offset="50%" stop-color="#f0f8f8"/><stop offset="100%" stop-color="#ddf0f5"/></linearGradient></defs><rect width="80" height="80" fill="url(#film)"/></svg>`,
  // 현수막 — PVC 거친 표면
  BNR440W00: makeSVG('#e8e8e8', WEAVE('#aaa', 0.12)),
  BNR510W00: makeSVG('#e5e5e5', WEAVE('#999', 0.14)),
  // 코튼지 — 면직물 짜임
  CTN400W00: makeSVG('#f0ebe2', WEAVE('#9b8b7a', 0.20)),
  CTN600W00: makeSVG('#ede7dc', WEAVE('#8b7b6a', 0.22)),
}

const DEFAULT_SVG = makeSVG('#f0f0f0')

function getTextureSrc(value: string, imageUrl: string | null): string {
  if (imageUrl) return imageUrl
  const svg = TEXTURE_SVG[value] ?? DEFAULT_SVG
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

// 용지 특성 태그 (Swadpia 코드 기반)
const PAPER_TAGS: Record<string, string[]> = {
  SNW120W00: ['Light', 'Opaque', 'Bright white'],
  SNW150W00: ['Medium weight', 'Opaque', 'Bright white'],
  SNW180W00: ['Substantial feel', 'Premium', 'Bright white'],
  SNW200W00: ['Heavy', 'Premium feel', 'Bright white'],
  SNW250W00: ['Premium weight', 'Premium card stock', 'Pure white'],
  SNW300W00: ['Maximum weight', 'Luxury', 'Pure white'],
  ART090W00: ['Lightweight', 'Glossy', 'Sharp print'],
  ART100W00: ['Standard', 'Glossy', 'Economical'],
  ART120W00: ['Semi-gloss', 'Sharp print', 'Versatile'],
  ART150W00: ['Heavy gloss', 'Premium feel', 'Vivid color'],
  ART180W00: ['Heavy gloss', 'Magazine / Brochure'],
  ART200W00: ['Premium gloss', 'Poster / Catalog'],
  STK075AT0: ['Sticker stock', 'Art paper', 'Standard adhesive'],
  STK075AT1: ['Sticker stock', 'Art paper', 'Strong adhesive'],
  STK090AF0: ['Sticker stock', 'Art paper', 'Heavy-duty adhesive'],
  STK080YP0: ['Waterproof', 'Translucent film', 'Synthetic'],
  BNR440W00: ['Banner', 'PVC 440g', 'Outdoor'],
  BNR510W00: ['Banner', 'PVC 510g', 'Large outdoor'],
  CTN400W00: ['Cotton', 'Natural texture', 'Writable'],
  CTN600W00: ['Premium cotton', 'Crane Lettra', 'Letterpress'],
}

export default function PaperPopup({ option }: PaperPopupProps) {
  const textureSrc = getTextureSrc(option.value, option.image_url)
  const tags = PAPER_TAGS[option.value] ?? []
  // OMO-2314: customer-facing — render English fields only.
  const description = option.description_en

  return (
    <div className="pointer-events-none absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-white border border-gray-200 rounded-xl shadow-xl p-3 text-left">
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-2 overflow-hidden">
        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-r border-b border-gray-200 rotate-45" />
      </div>

      <div className="flex gap-3">
        <div className="shrink-0 w-14 h-14 rounded-lg overflow-hidden border border-gray-100 shadow-sm">
          <Image
            src={textureSrc}
            alt={option.label_en}
            width={56}
            height={56}
            className="w-full h-full object-cover"
            unoptimized
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-gray-900 leading-tight mb-1.5">
            {option.label_en}
          </p>
          {description && (
            <p className="text-[11px] text-gray-600 leading-snug mb-1.5">
              {description}
            </p>
          )}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-block px-1.5 py-0.5 text-[10px] bg-blue-50 text-blue-600 rounded-md"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
