'use client'

import Image from 'next/image'
import type { PrintProductOption } from '@/types/database'
import { FINISHING_BY_VALUE } from '@/config/finishing-catalog'
import { paperDisplay } from '@/config/paper-display'

interface PaperPopupProps {
  // 용지/후가공 옵션 모두 받는다(후가공은 카탈로그에서 합성한 최소 객체 가능).
  option: Pick<PrintProductOption, 'value' | 'label_en' | 'label_ko' | 'image_url' | 'description_en'>
  // OMO-3196: inline=true 면 떠 있는 툴팁이 아니라 정적 카드로 렌더(드롭다운 미리보기용).
  inline?: boolean
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

// 용지 설명 (Swadpia 코드 기반) — DB description_en 이 비어있을 때의 폴백.
// OMO-3195: 코드 단위라 같은 용지를 쓰는 모든 제품에 자동 적용된다.
const PAPER_DESC: Record<string, string> = {
  SNW120W00: 'Smooth matte stock with a clean, non-glare surface. Light weight — best for flyers and inserts.',
  SNW150W00: 'Smooth matte paper with a soft, premium feel. Great for flyers and brochures.',
  SNW180W00: 'Sturdy matte stock that feels substantial in hand. Ideal for postcards and menus.',
  SNW200W00: 'Heavy matte stock with a refined, glare-free surface. A popular choice for premium cards.',
  SNW250W00: 'Thick premium matte card stock — rigid and luxurious. A top pick for business cards.',
  SNW300W00: 'Our thickest matte stock. Maximum rigidity and a high-end feel for luxury cards.',
  ART090W00: 'Lightweight glossy stock with sharp, vivid color. Economical for high-volume flyers.',
  ART100W00: 'Standard glossy paper — bright color on a smooth coated surface at a great price.',
  ART120W00: 'Semi-gloss coated stock. Versatile, with crisp print and a balanced sheen.',
  ART150W00: 'Heavy glossy stock with vivid color and a premium coated feel.',
  ART180W00: 'Thick magazine-grade glossy paper. Rich color for brochures and covers.',
  ART200W00: 'Premium heavy gloss — poster and catalog grade with bold, saturated color.',
  STK075AT0: 'Coated art-paper sticker with standard adhesive and a smooth printable surface.',
  STK075AT1: 'Coated art-paper sticker with strong adhesive for a lasting hold.',
  STK090AF0: 'Heavier art-paper sticker with heavy-duty adhesive for demanding surfaces.',
  STK080YP0: 'Waterproof synthetic (yupo) film — tear- and water-resistant, slightly translucent.',
  BNR440W00: 'Durable 440g PVC banner material for indoor and short-term outdoor use.',
  BNR510W00: 'Heavy 510g PVC banner for large-format, long-term outdoor display.',
  CTN400W00: 'Natural cotton stock with a soft tactile texture. Uncoated and writable.',
  CTN600W00: 'Premium 600g cotton (Crane Lettra) — luxurious texture, ideal for letterpress.',
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

export default function PaperPopup({ option, inline = false }: PaperPopupProps) {
  // OMO-3196: 후가공 옵션이면 카탈로그(이미지/설명)로 폴백 — DB 후가공 행은 이미지/설명이
  // 비어 있어도 "맞는 이미지랑 설명"을 보여준다.
  const fin = FINISHING_BY_VALUE[option.value]
  const textureSrc = getTextureSrc(option.value, option.image_url || fin?.image_url || null)
  // OMO-3196: 용지(특히 특수지)는 US-친화 표시명/특징/설명을 paper-display 에서 라벨 키워드로 매칭.
  const disp = !fin ? paperDisplay(`${option.label_en ?? ''} ${option.label_ko ?? ''}`) : null
  const title = disp?.name || option.label_en
  // OMO-3196 (보드): 고객용 — 후가공 팝업에서 한글(label_ko) 제거, 영문만.
  const tags = PAPER_TAGS[option.value] ?? disp?.features ?? []
  // OMO-2314: customer-facing — render English fields only.
  // OMO-3195: fall back to the code-keyed description so options with an empty DB field still explain the stock.
  const description = option.description_en || PAPER_DESC[option.value] || disp?.desc || fin?.description_en || null

  return (
    <div
      className={
        inline
          ? 'w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-left'
          : 'pointer-events-none absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-white border border-gray-200 rounded-xl shadow-xl p-3 text-left'
      }
    >
      {!inline && (
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-2 overflow-hidden">
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-r border-b border-gray-200 rotate-45" />
        </div>
      )}

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
            {title}
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
