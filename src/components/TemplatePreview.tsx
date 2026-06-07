import type { TemplateDef, TemplateCategory } from '@/config/templates'
import {
  buildCardLayout, CARD_FONT, CARD_CATEGORIES, resolveCardColors, cardLayoutIndex, cardSampleFor,
  type LayoutPrim,
} from '@/config/cardLayout'

// 템플릿 미리보기 — 카테고리·레이아웃별로 서로 다른 SVG 목업을 렌더.
// 순수 SVG (클라이언트 훅 없음) → 서버 컴포넌트에서도 그대로 사용 가능.

interface Colors {
  bg: string
  ink: string   // 주요 텍스트/도형
  sub: string   // 보조 텍스트
  accent: string // 강조 색
}

// ── 색상 유틸 ────────────────────────────────────────────────────────────────

function luminance(hex: string): number {
  const h = hex.replace('#', '')
  if (h.length < 6) return 1
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 / 255
}

function isDark(hex: string): boolean {
  return luminance(hex) < 0.5
}

// 강조 색 풀 — bg 와 충돌하지 않는 것을 hash 로 선택.
const ACCENT_POOL = [
  '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#f59e0b', '#eab308', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#d4956a', '#b8860b', '#9d174d',
]

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

function resolveColors(t: TemplateDef): Colors {
  const dark = isDark(t.bg)
  const ink = t.ink ?? (dark ? '#ffffff' : '#1a1a1a')
  const sub = dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.4)'

  // 생성 템플릿은 명시적 accent 사용.
  if (t.accent) return { bg: t.bg, ink, sub, accent: t.accent }

  // accent: pick from pool by name hash, avoid one too close to bg luminance
  const bgLum = luminance(t.bg)
  const start = hashStr(t.name) % ACCENT_POOL.length
  let accent = ACCENT_POOL[start]
  for (let i = 0; i < ACCENT_POOL.length; i++) {
    const cand = ACCENT_POOL[(start + i) % ACCENT_POOL.length]
    if (Math.abs(luminance(cand) - bgLum) > 0.2) { accent = cand; break }
  }
  // luxury / gold themed → gold accent
  if (t.category === 'luxury' || /gold|platinum|noir|luxe|marble/i.test(t.name)) {
    accent = dark ? '#d4af37' : '#b8860b'
  }
  return { bg: t.bg, ink, sub, accent }
}

// ── 카테고리별 viewBox (실제 제품 비율 반영) ──────────────────────────────────

const ASPECT: Record<TemplateCategory, [number, number]> = {
  business:   [170, 110],  // 명함 가로 (실제 제품 85×55mm 비율)
  minimal:    [170, 110],
  creative:   [170, 110],
  food:       [170, 110],
  health:     [170, 110],
  tech:       [170, 110],
  realestate: [170, 110],
  luxury:     [170, 110],
  sticker:    [120, 120],  // 정사각 스티커
  postcard:   [180, 120],  // 엽서 가로
  banner:     [90, 135],   // 배너 세로
  flyer:      [100, 141],  // A5 세로
  brochure:   [100, 141],
  poster:     [100, 141],  // A4 세로
}

const initials = (name: string) =>
  name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || 'AB'

// ── 명함 레이아웃 (8종) ───────────────────────────────────────────────────────

function cardLayout(idx: number, c: Colors, t: TemplateDef, W: number, H: number) {
  const variant = idx % 18
  const serif = /law|finance|executive|editorial|investment|realtor|luxe|gold|letterpress|noir|lawyer|accountant|architect/i.test(t.name)
  const ff = serif ? 'Georgia, serif' : 'Helvetica, Arial, sans-serif'

  switch (variant) {
    case 0: // 좌측 강조 바 + 좌정렬
      return (<>
        <rect x={0} y={0} width={10} height={H} fill={c.accent} />
        <rect x={22} y={H * 0.32} width={W * 0.42} height={5} rx={2} fill={c.ink} />
        <rect x={22} y={H * 0.45} width={W * 0.28} height={3} rx={1.5} fill={c.accent} />
        <rect x={22} y={H * 0.66} width={W * 0.5} height={2.5} rx={1} fill={c.sub} />
        <rect x={22} y={H * 0.74} width={W * 0.4} height={2.5} rx={1} fill={c.sub} />
      </>)
    case 1: // 중앙 모노그램
      return (<>
        <circle cx={W / 2} cy={H * 0.32} r={13} fill="none" stroke={c.accent} strokeWidth={2} />
        <text x={W / 2} y={H * 0.32 + 5} textAnchor="middle" fontFamily={ff} fontSize={12} fontWeight="bold" fill={c.ink}>{initials(t.name)}</text>
        <rect x={W / 2 - W * 0.2} y={H * 0.6} width={W * 0.4} height={4} rx={2} fill={c.ink} />
        <line x1={W / 2 - 14} y1={H * 0.72} x2={W / 2 + 14} y2={H * 0.72} stroke={c.accent} strokeWidth={1.5} />
        <rect x={W / 2 - W * 0.14} y={H * 0.78} width={W * 0.28} height={2.5} rx={1} fill={c.sub} />
      </>)
    case 2: // 상단 컬러 밴드
      return (<>
        <rect x={0} y={0} width={W} height={H * 0.4} fill={c.accent} />
        <rect x={14} y={H * 0.14} width={W * 0.45} height={5} rx={2} fill="#ffffff" />
        <rect x={14} y={H * 0.26} width={W * 0.3} height={3} rx={1.5} fill="rgba(255,255,255,0.7)" />
        <rect x={14} y={H * 0.58} width={W * 0.55} height={2.5} rx={1} fill={c.sub} />
        <rect x={14} y={H * 0.68} width={W * 0.45} height={2.5} rx={1} fill={c.sub} />
        <rect x={14} y={H * 0.78} width={W * 0.5} height={2.5} rx={1} fill={c.sub} />
      </>)
    case 3: // 좌우 분할
      return (<>
        <rect x={0} y={0} width={W * 0.4} height={H} fill={c.accent} />
        <text x={W * 0.2} y={H / 2 + 7} textAnchor="middle" fontFamily={ff} fontSize={20} fontWeight="bold" fill="#ffffff">{initials(t.name)}</text>
        <rect x={W * 0.48} y={H * 0.34} width={W * 0.42} height={5} rx={2} fill={c.ink} />
        <rect x={W * 0.48} y={H * 0.47} width={W * 0.3} height={3} rx={1.5} fill={c.accent} />
        <rect x={W * 0.48} y={H * 0.66} width={W * 0.4} height={2.5} rx={1} fill={c.sub} />
      </>)
    case 4: // 하단 강조 바
      return (<>
        <rect x={14} y={H * 0.2} width={W * 0.5} height={5} rx={2} fill={c.ink} />
        <rect x={14} y={H * 0.33} width={W * 0.32} height={3} rx={1.5} fill={c.accent} />
        <rect x={0} y={H * 0.72} width={W} height={H * 0.28} fill={c.accent} />
        <rect x={14} y={H * 0.82} width={W * 0.55} height={2.5} rx={1} fill="rgba(255,255,255,0.85)" />
      </>)
    case 5: // 코너 도형 사선
      return (<>
        <polygon points={`0,0 ${W * 0.45},0 0,${H * 0.6}`} fill={c.accent} opacity={0.9} />
        <rect x={14} y={H * 0.6} width={W * 0.48} height={5} rx={2} fill={c.ink} />
        <rect x={14} y={H * 0.73} width={W * 0.32} height={3} rx={1.5} fill={c.sub} />
        <rect x={14} y={H * 0.82} width={W * 0.42} height={2.5} rx={1} fill={c.sub} />
      </>)
    case 6: // 미니멀 중앙
      return (<>
        <rect x={W / 2 - W * 0.22} y={H * 0.42} width={W * 0.44} height={4} rx={2} fill={c.ink} />
        <line x1={W / 2 - 10} y1={H * 0.56} x2={W / 2 + 10} y2={H * 0.56} stroke={c.accent} strokeWidth={1.5} />
        <rect x={W / 2 - W * 0.12} y={H * 0.62} width={W * 0.24} height={2.5} rx={1} fill={c.sub} />
      </>)
    case 7: // 프레임
      return (<>
        <rect x={8} y={8} width={W - 16} height={H - 16} fill="none" stroke={c.accent} strokeWidth={1.5} />
        <rect x={W / 2 - W * 0.2} y={H * 0.38} width={W * 0.4} height={5} rx={2} fill={c.ink} />
        <rect x={W / 2 - W * 0.13} y={H * 0.52} width={W * 0.26} height={3} rx={1.5} fill={c.sub} />
        <rect x={W / 2 - W * 0.16} y={H * 0.64} width={W * 0.32} height={2.5} rx={1} fill={c.sub} />
      </>)
    case 8: // 우측 사이드바
      return (<>
        <rect x={W * 0.7} y={0} width={W * 0.3} height={H} fill={c.accent} />
        <circle cx={W * 0.85} cy={H * 0.3} r={9} fill="rgba(255,255,255,0.85)" />
        <rect x={14} y={H * 0.34} width={W * 0.42} height={5} rx={2} fill={c.ink} />
        <rect x={14} y={H * 0.48} width={W * 0.3} height={3} rx={1.5} fill={c.accent} />
        <rect x={14} y={H * 0.66} width={W * 0.45} height={2.5} rx={1} fill={c.sub} />
        <rect x={14} y={H * 0.74} width={W * 0.38} height={2.5} rx={1} fill={c.sub} />
      </>)
    case 9: // 투톤 대각 밴드
      return (<>
        <polygon points={`0,0 ${W},0 ${W},${H * 0.42} 0,${H * 0.72}`} fill={c.accent} />
        <rect x={14} y={H * 0.12} width={W * 0.5} height={5} rx={2} fill="#ffffff" />
        <rect x={14} y={H * 0.25} width={W * 0.32} height={3} rx={1.5} fill="rgba(255,255,255,0.75)" />
        <rect x={14} y={H * 0.78} width={W * 0.55} height={2.5} rx={1} fill={c.sub} />
        <rect x={14} y={H * 0.87} width={W * 0.4} height={2.5} rx={1} fill={c.sub} />
      </>)
    case 10: // 중앙 엠블럼 (이중 프레임)
      return (<>
        <rect x={6} y={6} width={W - 12} height={H - 12} fill="none" stroke={c.accent} strokeWidth={1} />
        <rect x={10} y={10} width={W - 20} height={H - 20} fill="none" stroke={c.accent} strokeWidth={0.5} opacity={0.5} />
        <circle cx={W / 2} cy={H * 0.3} r={8} fill={c.accent} />
        <text x={W / 2} y={H * 0.3 + 4} textAnchor="middle" fontFamily={ff} fontSize={9} fontWeight="bold" fill="#ffffff">{initials(t.name)}</text>
        <rect x={W / 2 - W * 0.22} y={H * 0.56} width={W * 0.44} height={4} rx={2} fill={c.ink} />
        <rect x={W / 2 - W * 0.14} y={H * 0.7} width={W * 0.28} height={2.5} rx={1} fill={c.sub} />
      </>)
    case 12: // 우상단 기하 도형
      return (<>
        <circle cx={W * 0.78} cy={H * 0.02} r={22} fill={c.accent} />
        <polygon points={`${W * 0.84},${H * 0.2} ${W * 0.96},${H * 0.2} ${W * 0.9},${H * 0.05}`} fill={c.accent} opacity={0.45} />
        <rect x={14} y={H * 0.44} width={W * 0.5} height={5} rx={2} fill={c.ink} />
        <rect x={14} y={H * 0.6} width={W * 0.32} height={3} rx={1.5} fill={c.accent} />
        <rect x={14} y={H * 0.76} width={W * 0.45} height={2.5} rx={1} fill={c.sub} />
      </>)
    case 13: // 하단 웨이브 밴드
      return (<>
        <path d={`M0 ${H * 0.6} Q ${W * 0.25} ${H * 0.5} ${W * 0.5} ${H * 0.6} T ${W} ${H * 0.6} L ${W} ${H} L 0 ${H} Z`} fill={c.accent} />
        <rect x={14} y={H * 0.18} width={W * 0.5} height={5} rx={2} fill={c.ink} />
        <rect x={14} y={H * 0.32} width={W * 0.32} height={3} rx={1.5} fill={c.accent} />
        <rect x={14} y={H * 0.8} width={W * 0.5} height={2.5} rx={1} fill="rgba(255,255,255,0.85)" />
      </>)
    case 14: // 좌측 멀티 스트라이프
      return (<>
        <rect x={0} y={0} width={5} height={H} fill={c.accent} />
        <rect x={8} y={0} width={3} height={H} fill={c.accent} opacity={0.6} />
        <rect x={13} y={0} width={2} height={H} fill={c.accent} opacity={0.35} />
        <rect x={24} y={H * 0.3} width={W * 0.45} height={5} rx={2} fill={c.ink} />
        <rect x={24} y={H * 0.45} width={W * 0.3} height={3} rx={1.5} fill={c.accent} />
        <rect x={24} y={H * 0.66} width={W * 0.42} height={2.5} rx={1} fill={c.sub} />
      </>)
    case 15: // 좌측 세로형 패널
      return (<>
        <rect x={0} y={0} width={W * 0.22} height={H} fill={c.accent} />
        <text x={W * 0.11} y={H * 0.5} textAnchor="middle" fontFamily={ff} fontSize={11} fontWeight="bold" fill="#ffffff" transform={`rotate(-90 ${W * 0.11} ${H * 0.5})`}>{initials(t.name)}</text>
        <rect x={W * 0.3} y={H * 0.36} width={W * 0.5} height={5} rx={2} fill={c.ink} />
        <rect x={W * 0.3} y={H * 0.5} width={W * 0.32} height={3} rx={1.5} fill={c.accent} />
        <rect x={W * 0.3} y={H * 0.64} width={W * 0.42} height={2.5} rx={1} fill={c.sub} />
      </>)
    case 16: // 좌상단 코너 리본
      return (<>
        <polygon points={`0,${H * 0.28} ${W * 0.34},0 ${W * 0.46},0 0,${H * 0.4}`} fill={c.accent} />
        <rect x={14} y={H * 0.5} width={W * 0.5} height={5} rx={2} fill={c.ink} />
        <rect x={14} y={H * 0.65} width={W * 0.32} height={3} rx={1.5} fill={c.accent} />
        <rect x={14} y={H * 0.79} width={W * 0.45} height={2.5} rx={1} fill={c.sub} />
      </>)
    case 17: // 상단 라운드 배지
      return (<>
        <rect x={14} y={H * 0.16} width={W * 0.3} height={H * 0.13} rx={H * 0.065} fill={c.accent} />
        <rect x={14 + W * 0.05} y={H * 0.205} width={W * 0.2} height={2.5} rx={1} fill="#ffffff" />
        <rect x={14} y={H * 0.46} width={W * 0.55} height={6} rx={2} fill={c.ink} />
        <rect x={14} y={H * 0.62} width={W * 0.32} height={3} rx={1.5} fill={c.accent} />
        <rect x={14} y={H * 0.76} width={W * 0.42} height={2.5} rx={1} fill={c.sub} />
      </>)
    default: // 11: 대형 이니셜 워터마크
      return (<>
        <text x={W * 0.62} y={H * 0.95} fontFamily={ff} fontSize={H * 0.95} fontWeight="bold" fill={c.accent} opacity={0.12}>{initials(t.name)[0]}</text>
        <rect x={14} y={H * 0.5} width={W * 0.5} height={5} rx={2} fill={c.ink} />
        <rect x={14} y={H * 0.63} width={W * 0.32} height={3} rx={1.5} fill={c.accent} />
        <rect x={14} y={H * 0.76} width={W * 0.45} height={2.5} rx={1} fill={c.sub} />
      </>)
  }
}

// ── 스티커 레이아웃 (4종) ─────────────────────────────────────────────────────

function stickerLayout(idx: number, c: Colors, t: TemplateDef, W: number, H: number) {
  const cx = W / 2, cy = H / 2
  switch (idx % 4) {
    case 0: // 라운드 배지 + 링
      return (<>
        <circle cx={cx} cy={cy} r={W * 0.42} fill="none" stroke={c.accent} strokeWidth={3} />
        <circle cx={cx} cy={cy} r={W * 0.33} fill="none" stroke={c.ink} strokeWidth={1} opacity={0.4} />
        <text x={cx} y={cy + 6} textAnchor="middle" fontFamily="Helvetica, Arial" fontSize={16} fontWeight="bold" fill={c.ink}>{initials(t.name)}</text>
      </>)
    case 1: // 별 배지
      return (<>
        <polygon points={star(cx, cy, W * 0.42, W * 0.18, 5)} fill={c.accent} />
        <rect x={cx - W * 0.16} y={cy - 2} width={W * 0.32} height={4} rx={2} fill="#ffffff" />
      </>)
    case 2: // 원형 텍스트 링
      return (<>
        <circle cx={cx} cy={cy} r={W * 0.4} fill={c.accent} opacity={0.12} />
        <circle cx={cx} cy={cy} r={W * 0.24} fill={c.accent} />
        <text x={cx} y={cy + 4} textAnchor="middle" fontFamily="Helvetica, Arial" fontSize={11} fontWeight="bold" fill="#ffffff">{initials(t.name)}</text>
      </>)
    default: // 3: 사각 라벨 + 코너마크
      return (<>
        <rect x={W * 0.18} y={H * 0.18} width={W * 0.64} height={H * 0.64} rx={6} fill="none" stroke={c.accent} strokeWidth={2} strokeDasharray="6 4" />
        <rect x={cx - W * 0.2} y={cy - 6} width={W * 0.4} height={5} rx={2} fill={c.ink} />
        <rect x={cx - W * 0.12} y={cy + 4} width={W * 0.24} height={3} rx={1.5} fill={c.sub} />
      </>)
  }
}

function star(cx: number, cy: number, outer: number, inner: number, points: number): string {
  const pts: string[] = []
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = (Math.PI / points) * i - Math.PI / 2
    pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`)
  }
  return pts.join(' ')
}

// ── 엽서 레이아웃 (3종) ───────────────────────────────────────────────────────

function postcardLayout(idx: number, c: Colors, t: TemplateDef, W: number, H: number) {
  switch (idx % 3) {
    case 0: // 좌측 사진 영역 + 우측 텍스트
      return (<>
        <rect x={0} y={0} width={W * 0.45} height={H} fill={c.accent} opacity={0.85} />
        <circle cx={W * 0.22} cy={H * 0.4} r={10} fill="rgba(255,255,255,0.4)" />
        <rect x={W * 0.52} y={H * 0.28} width={W * 0.38} height={5} rx={2} fill={c.ink} />
        <rect x={W * 0.52} y={H * 0.42} width={W * 0.3} height={3} rx={1.5} fill={c.sub} />
        <rect x={W * 0.52} y={H * 0.55} width={W * 0.36} height={2.5} rx={1} fill={c.sub} />
      </>)
    case 1: // 중앙 초대장 (장식)
      return (<>
        <rect x={10} y={10} width={W - 20} height={H - 20} fill="none" stroke={c.accent} strokeWidth={1} />
        <line x1={W / 2 - 16} y1={H * 0.26} x2={W / 2 + 16} y2={H * 0.26} stroke={c.accent} strokeWidth={1.5} />
        <rect x={W / 2 - W * 0.24} y={H * 0.4} width={W * 0.48} height={5} rx={2} fill={c.ink} />
        <rect x={W / 2 - W * 0.14} y={H * 0.54} width={W * 0.28} height={3} rx={1.5} fill={c.sub} />
        <line x1={W / 2 - 16} y1={H * 0.72} x2={W / 2 + 16} y2={H * 0.72} stroke={c.accent} strokeWidth={1.5} />
      </>)
    default: // 2: 상단 이미지 + 캡션
      return (<>
        <rect x={0} y={0} width={W} height={H * 0.55} fill={c.accent} opacity={0.85} />
        <rect x={14} y={H * 0.68} width={W * 0.6} height={5} rx={2} fill={c.ink} />
        <rect x={14} y={H * 0.8} width={W * 0.45} height={3} rx={1.5} fill={c.sub} />
      </>)
  }
}

// ── 배너 / 전단 / 포스터 / 브로슈어 (세로형, 3종) ──────────────────────────────

function posterLayout(idx: number, c: Colors, t: TemplateDef, W: number, H: number) {
  switch (idx % 3) {
    case 0: // 큰 헤드라인 상단 + 이미지 + 푸터
      return (<>
        <rect x={W * 0.12} y={H * 0.1} width={W * 0.6} height={6} rx={2} fill={c.ink} />
        <rect x={W * 0.12} y={H * 0.2} width={W * 0.4} height={4} rx={2} fill={c.accent} />
        <rect x={W * 0.12} y={H * 0.34} width={W * 0.76} height={H * 0.38} rx={4} fill={c.accent} opacity={0.18} />
        <circle cx={W / 2} cy={H * 0.53} r={W * 0.12} fill={c.accent} opacity={0.5} />
        <rect x={W * 0.12} y={H * 0.82} width={W * 0.5} height={3} rx={1.5} fill={c.sub} />
      </>)
    case 1: // 사선 분할
      return (<>
        <polygon points={`0,0 ${W},0 ${W},${H * 0.5} 0,${H * 0.66}`} fill={c.accent} opacity={0.9} />
        <rect x={W * 0.14} y={H * 0.16} width={W * 0.55} height={6} rx={2} fill="#ffffff" />
        <rect x={W * 0.14} y={H * 0.28} width={W * 0.35} height={4} rx={2} fill="rgba(255,255,255,0.7)" />
        <rect x={W * 0.14} y={H * 0.74} width={W * 0.6} height={4} rx={2} fill={c.ink} />
        <rect x={W * 0.14} y={H * 0.83} width={W * 0.45} height={3} rx={1.5} fill={c.sub} />
      </>)
    default: // 2: 중앙 정렬 + 상하 스트라이프
      return (<>
        <rect x={0} y={0} width={W} height={H * 0.08} fill={c.accent} />
        <rect x={0} y={H * 0.92} width={W} height={H * 0.08} fill={c.accent} />
        <rect x={W / 2 - W * 0.3} y={H * 0.32} width={W * 0.6} height={7} rx={3} fill={c.ink} />
        <rect x={W / 2 - W * 0.2} y={H * 0.46} width={W * 0.4} height={4} rx={2} fill={c.accent} />
        <rect x={W / 2 - W * 0.26} y={H * 0.62} width={W * 0.52} height={3} rx={1.5} fill={c.sub} />
        <rect x={W / 2 - W * 0.18} y={H * 0.7} width={W * 0.36} height={3} rx={1.5} fill={c.sub} />
      </>)
  }
}

// ── 공유 레이아웃 스펙 → SVG (에디터와 동일 디자인 보장) ────────────────────────
// buildCardLayout 이 돌려주는 프리미티브를 SVG 로 그린다. 에디터(fabric)와 같은
// 배열을 소비하므로 좌표·텍스트가 1:1로 일치한다.

function primToSvg(p: LayoutPrim, i: number): React.ReactNode {
  switch (p.kind) {
    case 'rect':
      return (
        <rect
          key={i} x={p.x} y={p.y} width={Math.max(p.w, 0)} height={Math.max(p.h, 0)}
          rx={p.r} ry={p.r}
          fill={p.stroke ? 'none' : (p.fill ?? 'none')}
          stroke={p.stroke} strokeWidth={p.sw} opacity={p.opacity}
          transform={p.rotate ? `rotate(${p.rotate} ${p.x} ${p.y})` : undefined}
        />
      )
    case 'circle':
      return (
        <circle
          key={i} cx={p.cx} cy={p.cy} r={p.r}
          fill={p.stroke ? 'none' : (p.fill ?? 'none')}
          stroke={p.stroke} strokeWidth={p.sw} opacity={p.opacity}
        />
      )
    case 'poly':
      return <polygon key={i} points={p.pts.map(([x, y]) => `${x},${y}`).join(' ')} fill={p.fill} opacity={p.opacity} />
    case 'text': {
      const cx = p.align === 'center' ? p.x + p.w / 2 : p.x
      const anchor = p.align === 'center' ? 'middle' : 'start'
      const baseline = p.y + p.size * 0.82
      if (p.rotate && p.originCenter) {
        return (
          <text
            key={i} x={p.x} y={p.y} fontFamily={CARD_FONT}
            fontSize={p.size} fontWeight={p.weight} fill={p.fill} opacity={p.opacity}
            textAnchor="middle" dominantBaseline="central"
            transform={`rotate(${p.rotate} ${p.x} ${p.y})`}
          >{p.text}</text>
        )
      }
      return (
        <text
          key={i} x={cx} y={baseline} fontFamily={CARD_FONT}
          fontSize={p.size} fontWeight={p.weight} fill={p.fill} opacity={p.opacity}
          textAnchor={anchor}
          lengthAdjust="spacingAndGlyphs"
          textLength={p.text.length * p.size * 0.62 > p.w ? p.w : undefined}
        >{p.text}</text>
      )
    }
  }
}

// ── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export default function TemplatePreview({
  template,
  className = '',
}: {
  template: TemplateDef
  className?: string
}) {
  const c = resolveColors(template)
  const [W, H] = ASPECT[template.category] ?? [170, 110]
  // 생성 템플릿은 명시적 layout 인덱스, 수동 템플릿은 이름 hash 로 결정.
  const idx = template.layout ?? hashStr(template.name)

  let content: React.ReactNode
  // 명함 계열(수동·생성 모두) → 에디터와 동일한 공유 스펙으로 렌더.
  // 실제 샘플 텍스트를 같은 좌표에 그려 썸네일과 에디터가 1:1로 일치한다.
  if (CARD_CATEGORIES.has(template.category)) {
    const colors = resolveCardColors(template)
    const prims = buildCardLayout(cardLayoutIndex(template), W, H, colors, cardSampleFor(template))
    content = <>{prims.map((p, i) => primToSvg(p, i))}</>
  }
  else if (template.category === 'sticker') content = stickerLayout(idx, c, template, W, H)
  else if (template.category === 'postcard') content = postcardLayout(idx, c, template, W, H)
  else if (template.category === 'banner' || template.category === 'flyer' || template.category === 'brochure' || template.category === 'poster')
    content = posterLayout(idx, c, template, W, H)
  else content = cardLayout(idx, c, template, W, H)

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`${template.name} template preview`}
    >
      <rect x={0} y={0} width={W} height={H} fill={c.bg} />
      {content}
    </svg>
  )
}
