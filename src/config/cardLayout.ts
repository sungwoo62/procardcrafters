// ── 명함 레이아웃 단일 소스 (Single Source of Truth) ──────────────────────────
// 썸네일(TemplatePreview, SVG)과 에디터(EditorClient, fabric)가 "완전히 동일한"
// 디자인을 그리도록, 레이아웃을 추상 프리미티브 배열로 한 곳에서 정의한다.
// 두 렌더러는 이 배열을 각자의 방식(SVG / fabric)으로 그릴 뿐, 좌표·텍스트가
// 갈라지지 않는다. 좌표·크기는 호출자가 넘긴 W·H 의 절대 단위로 반환한다
// (썸네일은 viewBox 단위, 에디터는 mm). 같은 비율이면 결과도 1:1로 일치한다.

// 썸네일(SVG)·에디터(fabric canvas) 양쪽에서 동일하게 렌더되는 폰트.
// fabric Textbox 는 fontFamily 미지정 시 'Times New Roman'(세리프)로 떨어져
// 산세리프 썸네일과 어긋난다 → 두 렌더러 모두 이 상수를 사용한다.
export const CARD_FONT = 'Helvetica, Arial, sans-serif'

export interface LayoutColors {
  ink: string
  sub: string
  accent: string
}

export interface LayoutSample {
  name: string
  title: string
  contact: string
}

export type LayoutPrim =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; fill?: string; stroke?: string; sw?: number; opacity?: number; r?: number; rotate?: number; label?: string }
  | { kind: 'circle'; cx: number; cy: number; r: number; fill?: string; stroke?: string; sw?: number; opacity?: number; label?: string }
  | { kind: 'poly'; pts: Array<[number, number]>; fill: string; opacity?: number; label?: string }
  | {
      kind: 'text'; text: string; x: number; y: number; w: number; size: number; fill: string
      weight?: 'bold'; align?: 'left' | 'center'; opacity?: number
      rotate?: number; originCenter?: boolean
      field?: 'name' | 'title' | 'email'; label: string
    }

const initialsOf = (name: string) =>
  name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || 'YN'

// ── 모든 명함 템플릿(수동·생성)을 같은 스펙으로 환원하는 공유 헬퍼 ───────────────
// 썸네일과 에디터가 이 함수들로 layout·accent·ink·sample 을 똑같이 도출하므로,
// 수동 템플릿도 별도 코드 없이 양쪽에서 1:1로 일치한다.

export interface CardTemplateLike {
  bg: string
  name: string
  category: string
  accent?: string
  ink?: string
  layout?: number
  sample?: LayoutSample
}

// 명함 계열 카테고리 — 이 카테고리는 buildCardLayout 단일 경로로 렌더한다.
export const CARD_CATEGORIES = new Set([
  'business', 'minimal', 'creative', 'food', 'health', 'tech', 'realestate', 'luxury',
])

const ACCENT_POOL = [
  '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#f59e0b', '#eab308', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#d4956a', '#b8860b', '#9d174d',
]

function luminance(hex: string): number {
  const h = hex.replace('#', '')
  if (h.length < 6) return 1
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 / 255
}

export function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

// 명시적 accent 가 있으면 그대로, 없으면 이름 해시로 풀에서 선택(bg 와 충돌 회피).
export function resolveCardColors(t: CardTemplateLike): LayoutColors {
  const dark = luminance(t.bg) < 0.5
  const ink = t.ink ?? (dark ? '#ffffff' : '#1a1a1a')
  const sub = dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.45)'
  if (t.accent) return { ink, sub, accent: t.accent }
  const bgLum = luminance(t.bg)
  const start = hashStr(t.name) % ACCENT_POOL.length
  let accent = ACCENT_POOL[start]
  for (let i = 0; i < ACCENT_POOL.length; i++) {
    const cand = ACCENT_POOL[(start + i) % ACCENT_POOL.length]
    if (Math.abs(luminance(cand) - bgLum) > 0.2) { accent = cand; break }
  }
  if (t.category === 'luxury' || /gold|platinum|noir|luxe|marble/i.test(t.name)) {
    accent = dark ? '#d4af37' : '#b8860b'
  }
  return { ink, sub, accent }
}

// 명시 layout 이 있으면 그대로, 없으면(수동 템플릿) 이름 해시로 0–17 결정.
export function cardLayoutIndex(t: CardTemplateLike): number {
  return t.layout ?? (hashStr(t.name) % 18)
}

const CARD_SAMPLES: Record<string, LayoutSample> = {
  business:   { name: 'Alexander Reed', title: 'Business Consultant',  contact: 'alex@company.com · (212) 555-0100' },
  minimal:    { name: 'Jordan Blake',   title: 'Creative Professional', contact: 'jordan@studio.com · (415) 555-0188' },
  creative:   { name: 'Riley Quinn',    title: 'Art Director',          contact: 'riley@creative.com · (323) 555-0162' },
  food:       { name: 'Marco Bianchi',  title: 'Executive Chef',        contact: 'marco@kitchen.com · (212) 555-0153' },
  health:     { name: 'Dr. Taylor Kim', title: 'Wellness Specialist',   contact: 'taylor@clinic.com · (646) 555-0184' },
  tech:       { name: 'Sam Patel',      title: 'Software Engineer',      contact: 'sam@dev.io · github.com/samp' },
  realestate: { name: 'Morgan Lee',     title: 'Realtor®',              contact: 'morgan@realty.com · (480) 555-0133' },
  luxury:     { name: 'Victoria Sterling', title: 'Private Client Advisor', contact: 'victoria@luxe.com · (212) 555-0199' },
}

// 생성 템플릿은 직군 샘플, 수동 템플릿은 카테고리 기본 샘플을 사용.
export function cardSampleFor(t: CardTemplateLike): LayoutSample {
  return t.sample ?? CARD_SAMPLES[t.category] ?? { name: 'Your Name', title: 'Your Title', contact: 'email@company.com' }
}

// layout 0–17 — 에디터 buildSpecTemplate 의 mm 좌표(W=85,H=55 기준)를 비율로 환산.
export function buildCardLayout(
  layout: number, W: number, H: number, c: LayoutColors, s: LayoutSample,
): LayoutPrim[] {
  const { ink, sub, accent } = c
  const ini = initialsOf(s.name)
  const P: LayoutPrim[] = []
  const name = (x: number, y: number, w: number, size: number, fill: string, align?: 'center'): LayoutPrim =>
    ({ kind: 'text', text: s.name, x, y, w, size, fill, weight: 'bold', align, field: 'name', label: 'Name' })
  const title = (x: number, y: number, w: number, size: number, fill: string, align?: 'center'): LayoutPrim =>
    ({ kind: 'text', text: s.title, x, y, w, size, fill, align, field: 'title', label: 'Title' })
  const contact = (x: number, y: number, w: number, size: number, fill: string, align?: 'center'): LayoutPrim =>
    ({ kind: 'text', text: s.contact, x, y, w, size, fill, align, field: 'email', label: 'Contact' })

  switch (layout) {
    case 0: // 좌측 강조 바
      P.push({ kind: 'rect', x: 0, y: 0, w: W * 0.047, h: H, fill: accent, label: 'Bar' })
      P.push(name(W * 0.118, H * 0.26, W * 0.812, H * 0.10, ink))
      P.push(title(W * 0.118, H * 0.46, W * 0.812, H * 0.0545, accent))
      P.push(contact(W * 0.118, H * 0.66, W * 0.812, H * 0.0473, sub))
      break
    case 1: // 중앙 모노그램
      P.push({ kind: 'circle', cx: W * 0.5, cy: H * 0.307, r: H * 0.127, stroke: accent, sw: H * 0.018, label: 'Ring' })
      P.push({ kind: 'text', text: ini, x: W * 0.382, y: H * 0.207, w: W * 0.235, size: H * 0.091, fill: ink, weight: 'bold', align: 'center', label: 'Monogram' })
      P.push(name(W * 0.147, H * 0.52, W * 0.706, H * 0.091, ink, 'center'))
      P.push({ kind: 'rect', x: W * 0.406, y: H * 0.68, w: W * 0.188, h: H * 0.0091, fill: accent, label: 'Line' })
      P.push(title(W * 0.147, H * 0.72, W * 0.706, H * 0.0509, sub, 'center'))
      break
    case 2: // 상단 컬러 밴드
      P.push({ kind: 'rect', x: 0, y: 0, w: W, h: H * 0.4, fill: accent, label: 'Band' })
      P.push(name(W * 0.082, H * 0.1, W * 0.835, H * 0.091, '#ffffff'))
      P.push(title(W * 0.082, H * 0.25, W * 0.835, H * 0.0545, 'rgba(255,255,255,0.85)'))
      P.push(contact(W * 0.082, H * 0.6, W * 0.835, H * 0.0509, sub))
      break
    case 3: // 좌우 분할
      P.push({ kind: 'rect', x: 0, y: 0, w: W * 0.4, h: H, fill: accent, label: 'Panel' })
      P.push({ kind: 'text', text: ini, x: 0, y: H * 0.409, w: W * 0.4, size: H * 0.164, fill: '#ffffff', weight: 'bold', align: 'center', label: 'Monogram' })
      P.push(name(W * 0.45, H * 0.3, W * 0.5, H * 0.091, ink))
      P.push(title(W * 0.45, H * 0.46, W * 0.5, H * 0.0509, accent))
      P.push(contact(W * 0.45, H * 0.64, W * 0.52, H * 0.0436, sub))
      break
    case 4: // 하단 강조 바
      P.push(name(W * 0.082, H * 0.18, W * 0.835, H * 0.10, ink))
      P.push(title(W * 0.082, H * 0.36, W * 0.835, H * 0.0545, accent))
      P.push({ kind: 'rect', x: 0, y: H * 0.72, w: W, h: H * 0.28, fill: accent, label: 'Bar' })
      P.push(contact(W * 0.082, H * 0.8, W * 0.835, H * 0.0509, '#ffffff'))
      break
    case 5: // 코너 사선
      P.push({ kind: 'poly', pts: [[0, 0], [W * 0.45, 0], [0, H * 0.6]], fill: accent, label: 'Corner' })
      P.push(name(W * 0.082, H * 0.6, W * 0.835, H * 0.091, ink))
      P.push(title(W * 0.082, H * 0.75, W * 0.835, H * 0.0509, sub))
      P.push(contact(W * 0.082, H * 0.85, W * 0.835, H * 0.0436, sub))
      break
    case 6: // 미니멀 중앙
      P.push(name(W * 0.088, H * 0.38, W * 0.824, H * 0.091, ink, 'center'))
      P.push({ kind: 'rect', x: W * 0.418, y: H * 0.56, w: W * 0.165, h: H * 0.0091, fill: accent, label: 'Line' })
      P.push(title(W * 0.088, H * 0.62, W * 0.824, H * 0.0509, sub, 'center'))
      break
    case 7: // 프레임
      P.push({ kind: 'rect', x: W * 0.0353, y: H * 0.0545, w: W * 0.929, h: H * 0.891, stroke: accent, sw: H * 0.0145, label: 'Frame' })
      P.push(name(W * 0.124, H * 0.34, W * 0.753, H * 0.091, ink, 'center'))
      P.push(title(W * 0.124, H * 0.5, W * 0.753, H * 0.0509, accent, 'center'))
      P.push(contact(W * 0.124, H * 0.64, W * 0.753, H * 0.0436, sub, 'center'))
      break
    case 8: // 우측 사이드바
      P.push({ kind: 'rect', x: W * 0.7, y: 0, w: W * 0.3, h: H, fill: accent, label: 'Sidebar' })
      P.push(name(W * 0.082, H * 0.32, W * 0.6, H * 0.091, ink))
      P.push(title(W * 0.082, H * 0.48, W * 0.6, H * 0.0545, accent))
      P.push(contact(W * 0.082, H * 0.66, W * 0.6, H * 0.0473, sub))
      break
    case 9: // 투톤 대각 밴드
      P.push({ kind: 'poly', pts: [[0, 0], [W, 0], [W, H * 0.42], [0, H * 0.72]], fill: accent, label: 'Band' })
      P.push(name(W * 0.082, H * 0.1, W * 0.835, H * 0.091, '#ffffff'))
      P.push(title(W * 0.082, H * 0.24, W * 0.835, H * 0.0545, 'rgba(255,255,255,0.85)'))
      P.push(contact(W * 0.082, H * 0.8, W * 0.835, H * 0.0473, sub))
      break
    case 10: // 중앙 엠블럼 (이중 프레임)
      P.push({ kind: 'rect', x: W * 0.0294, y: H * 0.0455, w: W * 0.941, h: H * 0.909, stroke: accent, sw: H * 0.0145, label: 'Frame' })
      P.push({ kind: 'circle', cx: W * 0.5, cy: H * 0.309, r: H * 0.109, fill: accent, label: 'Emblem' })
      P.push({ kind: 'text', text: ini, x: W * 0.382, y: H * 0.227, w: W * 0.235, size: H * 0.0727, fill: '#ffffff', weight: 'bold', align: 'center', label: 'Monogram' })
      P.push(name(W * 0.124, H * 0.54, W * 0.753, H * 0.082, ink, 'center'))
      P.push(title(W * 0.124, H * 0.7, W * 0.753, H * 0.0473, sub, 'center'))
      break
    case 12: // 우상단 기하 도형
      // 원은 아트보드 안에 완전히 들어오도록(상단 블리드로 빠지지 않게) 배치 —
      // 빠지면 fabric 에디터에서 렌더되지 않아 썸네일과 어긋난다.
      P.push({ kind: 'circle', cx: W * 0.74, cy: H * 0.25, r: H * 0.16, fill: accent, label: 'Circle' })
      P.push({ kind: 'poly', pts: [[W * 0.8, H * 0.309], [W * 0.953, H * 0.309], [W * 0.876, H * 0.109]], fill: accent, opacity: 0.45, label: 'Triangle' })
      P.push(name(W * 0.094, H * 0.42, W * 0.812, H * 0.10, ink))
      P.push(title(W * 0.094, H * 0.6, W * 0.812, H * 0.0545, accent))
      P.push(contact(W * 0.094, H * 0.78, W * 0.812, H * 0.0473, sub))
      break
    case 13: { // 하단 웨이브 밴드
      const steps = 16
      const pts: Array<[number, number]> = []
      for (let i = 0; i <= steps; i++) {
        pts.push([(W / steps) * i, H * 0.6 + H * 0.07 * Math.sin((i / steps) * Math.PI * 2)])
      }
      pts.push([W, H], [0, H])
      P.push({ kind: 'poly', pts, fill: accent, label: 'Wave' })
      P.push(name(W * 0.094, H * 0.16, W * 0.812, H * 0.0945, ink))
      P.push(title(W * 0.094, H * 0.32, W * 0.812, H * 0.0545, accent))
      P.push(contact(W * 0.094, H * 0.8, W * 0.812, H * 0.0473, '#ffffff'))
      break
    }
    case 14: // 좌측 멀티 스트라이프
      P.push({ kind: 'rect', x: 0, y: 0, w: W * 0.0294, h: H, fill: accent, label: 'Stripe' })
      P.push({ kind: 'rect', x: W * 0.0412, y: 0, w: W * 0.0176, h: H, fill: accent, opacity: 0.6, label: 'Stripe' })
      P.push({ kind: 'rect', x: W * 0.0706, y: 0, w: W * 0.0118, h: H, fill: accent, opacity: 0.35, label: 'Stripe' })
      P.push(name(W * 0.141, H * 0.28, W * 0.788, H * 0.0945, ink))
      P.push(title(W * 0.141, H * 0.46, W * 0.788, H * 0.0545, accent))
      P.push(contact(W * 0.141, H * 0.66, W * 0.788, H * 0.0473, sub))
      break
    case 15: // 좌측 세로형 패널 + 회전 직함
      P.push({ kind: 'rect', x: 0, y: 0, w: W * 0.22, h: H, fill: accent, label: 'Panel' })
      P.push({ kind: 'text', text: s.title, x: W * 0.11, y: H * 0.5, w: H * 0.782, size: H * 0.0509, fill: '#ffffff', align: 'center', rotate: 270, originCenter: true, field: 'title', label: 'Title' })
      P.push(name(W * 0.3, H * 0.34, W * 0.62, H * 0.091, ink))
      P.push(contact(W * 0.3, H * 0.56, W * 0.62, H * 0.0473, sub))
      break
    case 16: // 좌상단 코너 리본
      P.push({ kind: 'rect', x: -W * 0.047, y: H * 0.255, w: W * 0.494, h: H * 0.109, fill: accent, rotate: -45, label: 'Ribbon' })
      P.push(name(W * 0.082, H * 0.5, W * 0.835, H * 0.0945, ink))
      P.push(title(W * 0.082, H * 0.66, W * 0.835, H * 0.0545, accent))
      P.push(contact(W * 0.082, H * 0.8, W * 0.835, H * 0.0473, sub))
      break
    case 17: // 상단 라운드 배지 + 이름
      P.push({ kind: 'rect', x: W * 0.082, y: H * 0.16, w: W * 0.329, h: H * 0.127, r: H * 0.0636, fill: accent, label: 'Badge' })
      P.push(title(W * 0.082, H * 0.185, W * 0.329, H * 0.0473, '#ffffff', 'center'))
      P.push(name(W * 0.082, H * 0.46, W * 0.835, H * 0.109, ink))
      P.push(contact(W * 0.082, H * 0.72, W * 0.835, H * 0.0473, sub))
      break
    default: // 11: 대형 이니셜 워터마크
      P.push({ kind: 'text', text: ini[0] ?? '', x: W * 0.55, y: H * 0.05, w: W * 0.5, size: H * 0.9, fill: accent, weight: 'bold', opacity: 0.12, label: 'Watermark' })
      P.push(name(W * 0.082, H * 0.48, W * 0.6, H * 0.091, ink))
      P.push(title(W * 0.082, H * 0.62, W * 0.6, H * 0.0545, accent))
      P.push(contact(W * 0.082, H * 0.76, W * 0.6, H * 0.0473, sub))
      break
  }
  return P
}
