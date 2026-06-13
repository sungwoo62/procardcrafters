// OMO-3090: 제너릭 라벨 4종 use-case 샘플 다이라인 SVG 생성기 (PrintSpecialist).
// 각 SVG = 규격 템플릿(트림·블리드·세이프 영역 + use-case 콘텐츠 배치 가이드).
// 출력: public/samples/labels/{key}.svg
// 실행: node scripts/gen-label-usecase-samples.mjs
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../public/samples/labels')
const PX = 4 // 1mm = 4px
const BLEED = 2
const SAFE = 2

// 변형별: 기본 프리셋 치수(mm)와 콘텐츠 영역(라벨 + y 비율) 가이드.
const CASES = {
  'food-info': {
    title: '식품 표시사항 라벨',
    size: '50 × 40 mm · 아트지 80g(STR080ABN) · CMYK · 300dpi',
    w: 50, h: 40, accent: '#15803d',
    rows: ['제품명 / 식품유형', '소비기한 · 내용량', '원재료명 · 영양성분', '알레르기 · 신고 1399'],
  },
  'cosmetic-ingredient': {
    title: '화장품 전성분 표시 라벨',
    size: '50 × 60 mm · 아트지 80g(STR080ABN) · CMYK · 300dpi',
    w: 50, h: 60, accent: '#7c3aed',
    rows: ['제품 명칭', '책임판매업자 / 주소', '전성분 (함량 순)', '내용량 · 제조번호', '사용기한 · PAO 심볼'],
  },
  'health-food': {
    title: '건강기능식품 표시 라벨',
    size: '70 × 90 mm · 아트지 80g(STR080ABN) · CMYK · 300dpi',
    w: 70, h: 90, accent: '#b45309',
    rows: ["'건강기능식품' 도안", '제품명 / 영업소', '영양·기능정보 표', '섭취량 · 주의사항', '"질병 예방·치료 의약품 아님"'],
  },
  'barcode-qr': {
    title: '바코드 / QR 라벨',
    size: '40 × 30 mm · 아트지 80g · CMYK · 600dpi 권장',
    w: 40, h: 30, accent: '#0f172a',
    rows: ['EAN-13 막대 (K100)', 'Quiet zone 좌11·우7 모듈', '하단 숫자 (human readable)'],
  },
}

function svg(key, c) {
  const fullW = c.w + BLEED * 2
  const fullH = c.h + BLEED * 2
  const W = fullW * PX
  const H = fullH * PX
  const trimX = BLEED * PX
  const trimY = BLEED * PX
  const tw = c.w * PX
  const th = c.h * PX
  const safeX = (BLEED + SAFE) * PX
  const safeY = (BLEED + SAFE) * PX
  const sw = (c.w - SAFE * 2) * PX
  const sh = (c.h - SAFE * 2) * PX

  // 콘텐츠 영역(세이프 박스) 내부 가이드 행 or 바코드 모형
  let content = ''
  if (key === 'barcode-qr') {
    // 모형 바코드 막대 + 하단 숫자 자리
    const bars = []
    let bx = safeX + 6
    const widths = [2, 1, 3, 1, 2, 1, 1, 3, 2, 1, 2, 3, 1, 1, 2, 1, 3, 2, 1, 2]
    for (let i = 0; i < widths.length && bx < safeX + sw - 6; i++) {
      const bw = widths[i] * 1.6
      if (i % 2 === 0) bars.push(`<rect x="${bx.toFixed(1)}" y="${(safeY + 6).toFixed(1)}" width="${bw.toFixed(1)}" height="${(sh - 22).toFixed(1)}" fill="#0f172a"/>`)
      bx += bw + 1.5
    }
    content =
      bars.join('') +
      `<text x="${(safeX + sw / 2).toFixed(1)}" y="${(safeY + sh - 4).toFixed(1)}" font-size="9" text-anchor="middle" fill="#0f172a" font-family="monospace">8 801234 567890</text>`
  } else {
    const rowH = sh / c.rows.length
    content = c.rows
      .map((r, i) => {
        const ry = safeY + i * rowH
        const line = i > 0 ? `<line x1="${safeX}" y1="${ry.toFixed(1)}" x2="${(safeX + sw).toFixed(1)}" y2="${ry.toFixed(1)}" stroke="#e5e7eb" stroke-width="0.5"/>` : ''
        return `${line}<text x="${(safeX + 5).toFixed(1)}" y="${(ry + rowH / 2 + 3).toFixed(1)}" font-size="8.5" fill="#334155" font-family="sans-serif">${escapeXml(r)}</text>`
      })
      .join('')
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H + 36}" viewBox="0 0 ${W} ${H + 36}" role="img">
  <rect x="0" y="0" width="${W}" height="${H}" fill="#fde2e4" opacity="0.5"/>
  <rect x="${trimX}" y="${trimY}" width="${tw}" height="${th}" fill="#ffffff" stroke="${c.accent}" stroke-width="1.5"/>
  <rect x="${safeX}" y="${safeY}" width="${sw}" height="${sh}" fill="none" stroke="${c.accent}" stroke-width="0.6" stroke-dasharray="3 2" opacity="0.7"/>
  ${content}
  <text x="${trimX}" y="${(H + 14).toFixed(0)}" font-size="9" fill="${c.accent}" font-family="sans-serif" font-weight="700">${escapeXml(c.title)}</text>
  <text x="${trimX}" y="${(H + 27).toFixed(0)}" font-size="8" fill="#64748b" font-family="sans-serif">${escapeXml(c.size)} · 블리드 ${BLEED}mm(분홍) · 세이프 ${SAFE}mm(점선)</text>
</svg>
`
}

function escapeXml(s) {
  return s.replace(/[<>&"']/g, ch => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[ch]))
}

mkdirSync(OUT_DIR, { recursive: true })
for (const [key, c] of Object.entries(CASES)) {
  writeFileSync(resolve(OUT_DIR, `${key}.svg`), svg(key, c))
  console.log(`wrote ${key}.svg`)
}
