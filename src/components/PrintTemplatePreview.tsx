// OMO-3027: 인쇄 템플릿 시각 미리보기(SVG).
//
// 다운로드 PDF(`src/lib/print-template-pdf.ts`)와 동일한 기하(블리드/재단/세이프/크롭마크)를
// 웹에서 라이브 렌더한다. 래스터 스크린샷 대신 SVG 로 그려 정확·반응형·경량.
// PrintSpec(OMO-3026) 만 읽으며 성원/타사 자산 미사용(OMO-2975).

import type { PrintSpec } from '@/lib/print-spec'

export default function PrintTemplatePreview({
  spec,
  className,
}: {
  spec: PrintSpec
  className?: string
}) {
  // viewBox = 블리드 포함 전체(mm). 원점은 좌상단(SVG 기본).
  const fullW = spec.width_mm + 2 * spec.bleed_mm
  const fullH = spec.height_mm + 2 * spec.bleed_mm
  const b = spec.bleed_mm
  const s = spec.safe_mm
  // 선 굵기는 크기에 비례(작은 명함도, 큰 포스터도 일관되게 보이도록).
  const sw = Math.max(0.25, Math.min(fullW, fullH) * 0.004)
  const markLen = Math.max(2, Math.min(b > 0 ? b : 3, 10))
  const gap = b > 0 ? Math.min(1, b * 0.2) : 0

  // 크롭마크 — 4개 트림 코너 바깥 L자(블리드 영역). SVG y축은 아래로 증가.
  const corners = [
    { x: b, y: b, sx: -1, sy: -1 },                              // 좌상
    { x: b + spec.width_mm, y: b, sx: 1, sy: -1 },               // 우상
    { x: b, y: b + spec.height_mm, sx: -1, sy: 1 },              // 좌하
    { x: b + spec.width_mm, y: b + spec.height_mm, sx: 1, sy: 1 },// 우하
  ]

  return (
    <svg
      viewBox={`0 0 ${fullW} ${fullH}`}
      className={className}
      role="img"
      aria-label={`인쇄 템플릿 미리보기 ${spec.width_mm}×${spec.height_mm}mm`}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* 용지(블리드 포함 영역) */}
      <rect x="0" y="0" width={fullW} height={fullH} fill="#ffffff" />
      {/* 블리드 경계(빨강 점선) */}
      <rect
        x={sw / 2} y={sw / 2} width={fullW - sw} height={fullH - sw}
        fill="none" stroke="#ef4444" strokeWidth={sw} strokeDasharray={`${sw * 4} ${sw * 2}`}
      />
      {/* 재단선(검정 실선) */}
      <rect
        x={b} y={b} width={spec.width_mm} height={spec.height_mm}
        fill="none" stroke="#111827" strokeWidth={sw * 1.4}
      />
      {/* 세이프존(파랑 점선) */}
      {s > 0 && (
        <rect
          x={b + s} y={b + s} width={spec.width_mm - 2 * s} height={spec.height_mm - 2 * s}
          fill="none" stroke="#2563eb" strokeWidth={sw} strokeDasharray={`${sw * 2} ${sw * 2}`}
        />
      )}
      {/* 크롭마크 */}
      {b > gap + sw && corners.map((c, i) => (
        <g key={i} stroke="#111827" strokeWidth={sw}>
          <line x1={c.x + c.sx * gap} y1={c.y} x2={c.x + c.sx * (gap + markLen)} y2={c.y} />
          <line x1={c.x} y1={c.y + c.sy * gap} x2={c.x} y2={c.y + c.sy * (gap + markLen)} />
        </g>
      ))}
      {/* 브랜드 표기(OMO-3027) — 다운로드 PDF 와 동일하게 도메인 박아넣음 */}
      <text
        x={b + s + 1}
        y={b + spec.height_mm - s - 1}
        fontFamily="sans-serif"
        fontSize={Math.max(2, Math.min(fullW, fullH) * 0.05)}
        fill="#6366f1"
        opacity={0.75}
      >
        procardcrafters.com
      </text>
    </svg>
  )
}
