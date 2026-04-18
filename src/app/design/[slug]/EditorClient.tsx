'use client'

import {
  useState, useRef, useEffect, useCallback, useMemo
} from 'react'
import Link from 'next/link'
import {
  Type, Square, ImageIcon, Layers, Trash2,
  ChevronUp, ChevronDown, Eye, EyeOff, Lock, Unlock,
  Download, ShoppingCart, Bold, Italic, AlignLeft,
  AlignCenter, AlignRight, ArrowLeft, Plus, LayoutTemplate,
} from 'lucide-react'
import type { PrintProduct, PrintProductOption } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

type LayerType = 'text' | 'image' | 'rect'
type TextAlign = 'left' | 'center' | 'right'

interface DesignLayer {
  id: string
  type: LayerType
  x: number      // mm from trim-area left edge
  y: number      // mm from trim-area top edge
  width: number  // mm
  height: number // mm
  visible: boolean
  locked: boolean
  name: string
  // text
  content?: string
  fontFamily?: string
  fontSize?: number   // pt
  fontBold?: boolean
  fontItalic?: boolean
  color?: string
  textAlign?: TextAlign
  letterSpacing?: number   // px extra per char on canvas
  lineHeight?: number      // multiplier
  // image
  imageUrl?: string
  // rect
  fillColor?: string
  strokeColor?: string
  strokeWidth?: number
}

interface EditorDimensions {
  widthMm: number
  heightMm: number
  bleedMm: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRODUCT_DIMS: Record<string, EditorDimensions> = {
  business_cards:          { widthMm: 85,  heightMm: 55,  bleedMm: 3 },
  premium_business_cards:  { widthMm: 85,  heightMm: 55,  bleedMm: 3 },
  stickers:                { widthMm: 70,  heightMm: 70,  bleedMm: 3 },
  die_cut_stickers:        { widthMm: 70,  heightMm: 70,  bleedMm: 3 },
  flyers:                  { widthMm: 148, heightMm: 210, bleedMm: 3 },
  brochures:               { widthMm: 148, heightMm: 210, bleedMm: 3 },
  postcards:               { widthMm: 152, heightMm: 102, bleedMm: 3 },
  posters:                 { widthMm: 210, heightMm: 297, bleedMm: 3 },
  banners:                 { widthMm: 200, heightMm: 300, bleedMm: 5 },
}
const DEFAULT_DIMS: EditorDimensions = { widthMm: 85, heightMm: 55, bleedMm: 3 }

const SNAP_THRESHOLD_MM = 2
const HANDLE_SIZE_PX = 8
const MAX_CANVAS_W = 620
const MAX_CANVAS_H = 520

const FONTS = ['Arial', 'Georgia', 'Helvetica', 'Times New Roman', 'Courier New', 'Verdana', 'Trebuchet MS', 'Impact']

// ─── Templates ────────────────────────────────────────────────────────────────

type TemplateLayer = Omit<DesignLayer, 'id'>

interface Template {
  name: string
  bgColor: string
  layers: TemplateLayer[]
}

function makeId() { return Math.random().toString(36).slice(2) }

function instantiateTemplate(t: Template): DesignLayer[] {
  return t.layers.map(l => ({ ...l, id: makeId() }))
}

const TEMPLATES: Template[] = [
  {
    name: '빈 템플릿',
    bgColor: '#ffffff',
    layers: [],
  },
  {
    name: '클래식',
    bgColor: '#ffffff',
    layers: [
      {
        name: '이름', type: 'text', x: 5, y: 14, width: 75, height: 12,
        visible: true, locked: false,
        content: '홍길동', fontFamily: 'Arial', fontSize: 22, fontBold: true, fontItalic: false,
        color: '#111111', textAlign: 'left', letterSpacing: 0, lineHeight: 1.3,
      },
      {
        name: '직책', type: 'text', x: 5, y: 27, width: 65, height: 8,
        visible: true, locked: false,
        content: 'Senior Designer', fontFamily: 'Arial', fontSize: 11, fontBold: false, fontItalic: false,
        color: '#555555', textAlign: 'left', letterSpacing: 0, lineHeight: 1.3,
      },
      {
        name: '구분선', type: 'rect', x: 5, y: 36, width: 45, height: 0.5,
        visible: true, locked: false, fillColor: '#cccccc', strokeWidth: 0,
      },
      {
        name: '연락처', type: 'text', x: 5, y: 40, width: 75, height: 10,
        visible: true, locked: false,
        content: 'email@company.com\n+1 (555) 000-0000', fontFamily: 'Arial', fontSize: 9, fontBold: false, fontItalic: false,
        color: '#444444', textAlign: 'left', letterSpacing: 0, lineHeight: 1.5,
      },
    ],
  },
  {
    name: '미니멀',
    bgColor: '#ffffff',
    layers: [
      {
        name: '이름', type: 'text', x: 7.5, y: 19, width: 70, height: 12,
        visible: true, locked: false,
        content: '이름 Name', fontFamily: 'Helvetica', fontSize: 22, fontBold: false, fontItalic: false,
        color: '#000000', textAlign: 'center', letterSpacing: 2, lineHeight: 1.3,
      },
      {
        name: '회사', type: 'text', x: 7.5, y: 34, width: 70, height: 8,
        visible: true, locked: false,
        content: 'Company · Title', fontFamily: 'Helvetica', fontSize: 10, fontBold: false, fontItalic: false,
        color: '#888888', textAlign: 'center', letterSpacing: 1, lineHeight: 1.3,
      },
    ],
  },
  {
    name: '다크',
    bgColor: '#1a1a1a',
    layers: [
      {
        name: '배경 액센트', type: 'rect', x: 0, y: 0, width: 4, height: 55,
        visible: true, locked: false, fillColor: '#4f46e5', strokeWidth: 0,
      },
      {
        name: '이름', type: 'text', x: 10, y: 14, width: 70, height: 12,
        visible: true, locked: false,
        content: 'Your Name', fontFamily: 'Arial', fontSize: 20, fontBold: true, fontItalic: false,
        color: '#ffffff', textAlign: 'left', letterSpacing: 0, lineHeight: 1.3,
      },
      {
        name: '직책', type: 'text', x: 10, y: 27, width: 70, height: 8,
        visible: true, locked: false,
        content: 'Title • Company', fontFamily: 'Arial', fontSize: 10, fontBold: false, fontItalic: false,
        color: '#a5b4fc', textAlign: 'left', letterSpacing: 0, lineHeight: 1.3,
      },
      {
        name: '이메일', type: 'text', x: 10, y: 40, width: 70, height: 7,
        visible: true, locked: false,
        content: 'email@company.com', fontFamily: 'Arial', fontSize: 9, fontBold: false, fontItalic: false,
        color: '#9ca3af', textAlign: 'left', letterSpacing: 0, lineHeight: 1.3,
      },
    ],
  },
]

// ─── Canvas helpers ────────────────────────────────────────────────────────────

function getScale(dims: EditorDimensions): number {
  const totalW = dims.widthMm + 2 * dims.bleedMm
  const totalH = dims.heightMm + 2 * dims.bleedMm
  return Math.min(MAX_CANVAS_W / totalW, MAX_CANVAS_H / totalH)
}

function mmToPx(mm: number, scale: number) { return mm * scale }
function pxToMm(px: number, scale: number) { return px / scale }

function buildFont(layer: DesignLayer): string {
  const style = layer.fontItalic ? 'italic ' : ''
  const weight = layer.fontBold ? 'bold ' : ''
  const size = (layer.fontSize ?? 12)
  const family = layer.fontFamily ?? 'Arial'
  return `${style}${weight}${size}pt ${family}`
}

function drawLayer(ctx: CanvasRenderingContext2D, layer: DesignLayer, scale: number, bleedMm: number) {
  if (!layer.visible) return

  const ox = mmToPx(layer.x + bleedMm, scale)
  const oy = mmToPx(layer.y + bleedMm, scale)
  const ow = mmToPx(layer.width, scale)
  const oh = mmToPx(layer.height, scale)

  if (layer.type === 'rect') {
    ctx.beginPath()
    ctx.rect(ox, oy, ow, oh)
    if (layer.fillColor) {
      ctx.fillStyle = layer.fillColor
      ctx.fill()
    }
    if (layer.strokeColor && (layer.strokeWidth ?? 0) > 0) {
      ctx.strokeStyle = layer.strokeColor
      ctx.lineWidth = mmToPx(layer.strokeWidth!, scale)
      ctx.stroke()
    }
    return
  }

  if (layer.type === 'text' && layer.content) {
    ctx.font = buildFont(layer)
    ctx.fillStyle = layer.color ?? '#000000'
    ctx.textAlign = layer.textAlign ?? 'left'
    ctx.textBaseline = 'top'

    const lines = layer.content.split('\n')
    const lhMult = layer.lineHeight ?? 1.4
    const ptToPx = scale * (1 / 0.352778) / (96 / 72) // approximate
    const lineH = (layer.fontSize ?? 12) * ptToPx * lhMult

    // letter spacing via manual char drawing
    const ls = layer.letterSpacing ?? 0
    const xAnchor = layer.textAlign === 'right' ? ox + ow : layer.textAlign === 'center' ? ox + ow / 2 : ox

    lines.forEach((line, i) => {
      const ly = oy + i * lineH
      if (ls !== 0) {
        // character-by-character for letter spacing
        let xCursor = xAnchor
        const metrics = ctx.measureText(line)
        const totalW = metrics.width + ls * (line.length - 1)
        if (layer.textAlign === 'center') xCursor = xAnchor - totalW / 2
        else if (layer.textAlign === 'right') xCursor = xAnchor - totalW
        else xCursor = xAnchor

        for (const ch of line) {
          ctx.fillText(ch, xCursor, ly)
          xCursor += ctx.measureText(ch).width + ls
        }
      } else {
        ctx.fillText(line, xAnchor, ly)
      }
    })
    return
  }

  if (layer.type === 'image' && layer.imageUrl) {
    // Image rendering is handled in the component via cached HTMLImageElement
    // This function is called with pre-loaded images via a different path
  }
}

function drawSelectionHandles(ctx: CanvasRenderingContext2D, layer: DesignLayer, scale: number, bleedMm: number) {
  const ox = mmToPx(layer.x + bleedMm, scale)
  const oy = mmToPx(layer.y + bleedMm, scale)
  const ow = mmToPx(layer.width, scale)
  const oh = mmToPx(layer.height, scale)

  ctx.save()
  ctx.strokeStyle = '#4f46e5'
  ctx.lineWidth = 1
  ctx.setLineDash([4, 2])
  ctx.strokeRect(ox - 1, oy - 1, ow + 2, oh + 2)
  ctx.setLineDash([])

  const handles = [
    [ox, oy], [ox + ow / 2, oy], [ox + ow, oy],
    [ox, oy + oh / 2],              [ox + ow, oy + oh / 2],
    [ox, oy + oh], [ox + ow / 2, oy + oh], [ox + ow, oy + oh],
  ]
  ctx.fillStyle = '#4f46e5'
  for (const [hx, hy] of handles) {
    ctx.fillRect(hx - HANDLE_SIZE_PX / 2, hy - HANDLE_SIZE_PX / 2, HANDLE_SIZE_PX, HANDLE_SIZE_PX)
  }
  ctx.restore()
}

// ─── Main component ────────────────────────────────────────────────────────────

interface Props {
  product: PrintProduct
  options: PrintProductOption[]
}

export default function EditorClient({ product, options }: Props) {
  const dims = PRODUCT_DIMS[product.category] ?? DEFAULT_DIMS
  const scale = getScale(dims)
  const canvasW = Math.round(mmToPx(dims.widthMm + 2 * dims.bleedMm, scale))
  const canvasH = Math.round(mmToPx(dims.heightMm + 2 * dims.bleedMm, scale))

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map())

  // ── State ──────────────────────────────────────────────────────────────────
  const [layers, setLayers] = useState<DesignLayer[]>(() =>
    instantiateTemplate(TEMPLATES[1])
  )
  const [bgColor, setBgColor] = useState('#ffffff')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tool, setTool] = useState<'select' | 'text' | 'rect' | 'image'>('select')
  const [activePanel, setActivePanel] = useState<'layers' | 'templates' | 'properties'>('layers')

  const [guides, setGuides] = useState<{ x?: number; y?: number }[]>([])

  // drag state (refs so canvas handler can read without stale closures)
  const dragging = useRef(false)
  const dragLayerId = useRef<string | null>(null)
  const dragOffset = useRef({ x: 0, y: 0 })
  const layersRef = useRef(layers)
  useEffect(() => { layersRef.current = layers }, [layers])

  // ── Selected layer ─────────────────────────────────────────────────────────
  const selectedLayer = useMemo(() => layers.find(l => l.id === selectedId) ?? null, [layers, selectedId])

  // ── Canvas draw ────────────────────────────────────────────────────────────
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvasW, canvasH)

    // Bleed zone (light checkerboard pattern to show bleed area)
    ctx.fillStyle = '#e5e7eb'
    ctx.fillRect(0, 0, canvasW, canvasH)

    // Trim area (the actual print area)
    const trimX = mmToPx(dims.bleedMm, scale)
    const trimY = mmToPx(dims.bleedMm, scale)
    const trimW = mmToPx(dims.widthMm, scale)
    const trimH = mmToPx(dims.heightMm, scale)
    ctx.fillStyle = bgColor
    ctx.fillRect(trimX, trimY, trimW, trimH)

    // Layers (back to front)
    const current = layersRef.current
    for (const layer of [...current].reverse()) {
      if (layer.type === 'image' && layer.imageUrl) {
        const cached = imageCache.current.get(layer.imageUrl)
        if (cached) {
          const ox = mmToPx(layer.x + dims.bleedMm, scale)
          const oy = mmToPx(layer.y + dims.bleedMm, scale)
          ctx.drawImage(cached, ox, oy, mmToPx(layer.width, scale), mmToPx(layer.height, scale))
        }
      } else {
        drawLayer(ctx, layer, scale, dims.bleedMm)
      }
    }

    // Selection handles
    const sel = current.find(l => l.id === selectedId)
    if (sel) drawSelectionHandles(ctx, sel, scale, dims.bleedMm)

    // Bleed border indicator
    ctx.save()
    ctx.strokeStyle = 'rgba(239,68,68,0.5)'
    ctx.lineWidth = 1
    ctx.setLineDash([6, 3])
    ctx.strokeRect(trimX, trimY, trimW, trimH)
    ctx.setLineDash([])
    ctx.restore()

    // Alignment guides
    ctx.save()
    ctx.strokeStyle = '#4f46e5'
    ctx.lineWidth = 1
    for (const g of guides) {
      if (g.x !== undefined) {
        ctx.beginPath(); ctx.moveTo(g.x, 0); ctx.lineTo(g.x, canvasH); ctx.stroke()
      }
      if (g.y !== undefined) {
        ctx.beginPath(); ctx.moveTo(0, g.y); ctx.lineTo(canvasW, g.y); ctx.stroke()
      }
    }
    ctx.restore()
  }, [bgColor, selectedId, guides, canvasW, canvasH, dims, scale])

  useEffect(() => { drawCanvas() }, [drawCanvas, layers])

  // ── Mouse helpers ──────────────────────────────────────────────────────────
  function canvasCoordsToMm(cx: number, cy: number) {
    return {
      xMm: pxToMm(cx, scale) - dims.bleedMm,
      yMm: pxToMm(cy, scale) - dims.bleedMm,
    }
  }

  function hitTest(xMm: number, yMm: number): DesignLayer | null {
    const visible = layersRef.current.filter(l => l.visible && !l.locked)
    for (const layer of visible) {
      if (xMm >= layer.x && xMm <= layer.x + layer.width &&
          yMm >= layer.y && yMm <= layer.y + layer.height) {
        return layer
      }
    }
    return null
  }

  function computeGuides(movingLayer: DesignLayer, xMm: number, yMm: number): { x?: number; y?: number }[] {
    const guides: { x?: number; y?: number }[] = []
    const docCenterX = dims.widthMm / 2
    const docCenterY = dims.heightMm / 2
    const layerCX = xMm + movingLayer.width / 2
    const layerCY = yMm + movingLayer.height / 2

    // Snap to doc center
    if (Math.abs(layerCX - docCenterX) < SNAP_THRESHOLD_MM) {
      guides.push({ x: mmToPx(docCenterX + dims.bleedMm, scale) })
    }
    if (Math.abs(layerCY - docCenterY) < SNAP_THRESHOLD_MM) {
      guides.push({ y: mmToPx(docCenterY + dims.bleedMm, scale) })
    }
    // Snap to doc edges
    if (Math.abs(xMm) < SNAP_THRESHOLD_MM) guides.push({ x: mmToPx(dims.bleedMm, scale) })
    if (Math.abs(yMm) < SNAP_THRESHOLD_MM) guides.push({ y: mmToPx(dims.bleedMm, scale) })
    if (Math.abs(xMm + movingLayer.width - dims.widthMm) < SNAP_THRESHOLD_MM) {
      guides.push({ x: mmToPx(dims.widthMm + dims.bleedMm, scale) })
    }
    if (Math.abs(yMm + movingLayer.height - dims.heightMm) < SNAP_THRESHOLD_MM) {
      guides.push({ y: mmToPx(dims.heightMm + dims.bleedMm, scale) })
    }
    return guides
  }

  function snapPosition(movingLayer: DesignLayer, xMm: number, yMm: number) {
    let snappedX = xMm
    let snappedY = yMm
    const docCenterX = dims.widthMm / 2
    const docCenterY = dims.heightMm / 2
    const layerCX = xMm + movingLayer.width / 2
    const layerCY = yMm + movingLayer.height / 2

    if (Math.abs(layerCX - docCenterX) < SNAP_THRESHOLD_MM) snappedX = docCenterX - movingLayer.width / 2
    if (Math.abs(layerCY - docCenterY) < SNAP_THRESHOLD_MM) snappedY = docCenterY - movingLayer.height / 2
    if (Math.abs(xMm) < SNAP_THRESHOLD_MM) snappedX = 0
    if (Math.abs(yMm) < SNAP_THRESHOLD_MM) snappedY = 0
    if (Math.abs(xMm + movingLayer.width - dims.widthMm) < SNAP_THRESHOLD_MM) snappedX = dims.widthMm - movingLayer.width
    if (Math.abs(yMm + movingLayer.height - dims.heightMm) < SNAP_THRESHOLD_MM) snappedY = dims.heightMm - movingLayer.height

    return { snappedX, snappedY }
  }

  // ── Mouse events ───────────────────────────────────────────────────────────
  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect()
    const cx = (e.clientX - rect.left) * (canvasW / rect.width)
    const cy = (e.clientY - rect.top) * (canvasH / rect.height)
    const { xMm, yMm } = canvasCoordsToMm(cx, cy)

    if (tool === 'select') {
      const hit = hitTest(xMm, yMm)
      if (hit) {
        setSelectedId(hit.id)
        dragging.current = true
        dragLayerId.current = hit.id
        dragOffset.current = { x: xMm - hit.x, y: yMm - hit.y }
        setActivePanel('properties')
      } else {
        setSelectedId(null)
        setActivePanel('layers')
      }
    } else if (tool === 'text') {
      const id = makeId()
      const newLayer: DesignLayer = {
        id, type: 'text', name: '텍스트',
        x: Math.max(0, xMm - 20), y: Math.max(0, yMm - 5),
        width: 50, height: 10,
        visible: true, locked: false,
        content: '텍스트 입력',
        fontFamily: 'Arial', fontSize: 14, fontBold: false, fontItalic: false,
        color: '#000000', textAlign: 'left', letterSpacing: 0, lineHeight: 1.4,
      }
      setLayers(prev => [newLayer, ...prev])
      setSelectedId(id)
      setTool('select')
      setActivePanel('properties')
    } else if (tool === 'rect') {
      const id = makeId()
      const newLayer: DesignLayer = {
        id, type: 'rect', name: '사각형',
        x: Math.max(0, xMm - 10), y: Math.max(0, yMm - 10),
        width: 20, height: 20,
        visible: true, locked: false,
        fillColor: '#e5e7eb', strokeColor: '#9ca3af', strokeWidth: 0.5,
      }
      setLayers(prev => [newLayer, ...prev])
      setSelectedId(id)
      setTool('select')
      setActivePanel('properties')
    }
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!dragging.current || !dragLayerId.current) return
    const rect = canvasRef.current!.getBoundingClientRect()
    const cx = (e.clientX - rect.left) * (canvasW / rect.width)
    const cy = (e.clientY - rect.top) * (canvasH / rect.height)
    const { xMm, yMm } = canvasCoordsToMm(cx, cy)

    const rawX = xMm - dragOffset.current.x
    const rawY = yMm - dragOffset.current.y
    const movingLayer = layersRef.current.find(l => l.id === dragLayerId.current)!

    const { snappedX, snappedY } = snapPosition(movingLayer, rawX, rawY)
    const newGuides = computeGuides(movingLayer, rawX, rawY)
    setGuides(newGuides)

    setLayers(prev => prev.map(l =>
      l.id === dragLayerId.current ? { ...l, x: snappedX, y: snappedY } : l
    ))
  }

  function handleMouseUp() {
    dragging.current = false
    dragLayerId.current = null
    setGuides([])
  }

  // ── Layer operations ───────────────────────────────────────────────────────
  function deleteLayer(id: string) {
    setLayers(prev => prev.filter(l => l.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  function moveLayer(id: string, dir: 'up' | 'down') {
    setLayers(prev => {
      const idx = prev.findIndex(l => l.id === id)
      if (idx < 0) return prev
      const next = [...prev]
      const target = dir === 'up' ? idx - 1 : idx + 1
      if (target < 0 || target >= next.length) return prev
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
  }

  function toggleVisibility(id: string) {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: !l.visible } : l))
  }

  function toggleLock(id: string) {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, locked: !l.locked } : l))
  }

  function updateSelected(patch: Partial<DesignLayer>) {
    if (!selectedId) return
    setLayers(prev => prev.map(l => l.id === selectedId ? { ...l, ...patch } : l))
  }

  function loadTemplate(t: Template) {
    setLayers(instantiateTemplate(t))
    setBgColor(t.bgColor)
    setSelectedId(null)
    setActivePanel('layers')
  }

  // ── Image upload ───────────────────────────────────────────────────────────
  const imageInputRef = useRef<HTMLInputElement>(null)

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      imageCache.current.set(url, img)
      const aspectRatio = img.naturalWidth / img.naturalHeight
      const w = Math.min(dims.widthMm * 0.6, 50)
      const h = w / aspectRatio
      const id = makeId()
      setLayers(prev => [{
        id, type: 'image', name: file.name.slice(0, 20),
        x: (dims.widthMm - w) / 2, y: (dims.heightMm - h) / 2,
        width: w, height: h,
        visible: true, locked: false,
        imageUrl: url,
      }, ...prev])
      setSelectedId(id)
      setTool('select')
    }
    img.src = url
    e.target.value = ''
  }

  // ── Export ─────────────────────────────────────────────────────────────────
  function exportPng() {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `${product.slug}-design.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  async function proceedToOrder() {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob(async (blob) => {
      if (!blob) return
      const formData = new FormData()
      formData.append('file', blob, `${product.slug}-design.png`)
      const res = await fetch('/api/files/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (res.ok && data.fileId) {
        window.location.href = `/order?product=${product.slug}&fileId=${data.fileId}`
      }
    }, 'image/png')
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  const TOOL_CURSOR: Record<string, string> = {
    select: 'default',
    text: 'text',
    rect: 'crosshair',
    image: 'copy',
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 bg-white border-b border-gray-200 px-4 py-2.5 shrink-0">
        <Link href={`/products/${product.slug}`} className="text-gray-400 hover:text-gray-600 flex items-center gap-1 text-sm">
          <ArrowLeft className="w-4 h-4" /> 상품으로
        </Link>
        <div className="h-4 border-r border-gray-200" />
        <span className="text-sm font-semibold text-gray-800">{product.name_en} 에디터</span>
        <span className="text-xs text-gray-400">{dims.widthMm}×{dims.heightMm}mm (블리드 {dims.bleedMm}mm)</span>

        <div className="flex-1" />

        {/* Tools */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {([
            { id: 'select', icon: null, label: '선택 (V)' },
            { id: 'text',   icon: Type,    label: '텍스트 (T)' },
            { id: 'rect',   icon: Square,  label: '사각형 (R)' },
          ] as const).map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setTool(id)}
              title={label}
              className={`w-8 h-8 flex items-center justify-center rounded-md text-xs transition-colors ${tool === id ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
            >
              {Icon ? <Icon className="w-4 h-4" /> : <span className="font-bold">↖</span>}
            </button>
          ))}
          <button
            onClick={() => imageInputRef.current?.click()}
            title="이미지 추가 (I)"
            className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors text-gray-500 hover:text-gray-800`}
          >
            <ImageIcon className="w-4 h-4" />
          </button>
          <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
        </div>

        <div className="flex gap-2">
          <button
            onClick={exportPng}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Download className="w-3.5 h-3.5" /> PNG 저장
          </button>
          <button
            onClick={proceedToOrder}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <ShoppingCart className="w-3.5 h-3.5" /> 주문하기
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Canvas area */}
        <div className="flex-1 flex items-center justify-center overflow-auto bg-gray-200 p-6">
          <canvas
            ref={canvasRef}
            width={canvasW}
            height={canvasH}
            style={{ cursor: TOOL_CURSOR[tool], maxWidth: '100%', maxHeight: '100%', imageRendering: 'crisp-edges' }}
            className="shadow-xl"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </div>

        {/* Right panel */}
        <div className="w-64 bg-white border-l border-gray-200 flex flex-col overflow-hidden shrink-0">
          {/* Panel tabs */}
          <div className="flex border-b border-gray-200 shrink-0">
            {([
              { key: 'templates', icon: LayoutTemplate, label: '템플릿' },
              { key: 'layers',    icon: Layers,          label: '레이어' },
              { key: 'properties', icon: null,           label: '속성' },
            ] as const).map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setActivePanel(key)}
                className={`flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1 transition-colors ${activePanel === key ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                {label}
              </button>
            ))}
          </div>

          {/* Templates panel */}
          {activePanel === 'templates' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              <div className="mb-2">
                <label className="block text-xs text-gray-500 mb-1">배경 색상</label>
                <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} className="w-full h-8 rounded cursor-pointer" />
              </div>
              {TEMPLATES.map(t => (
                <button
                  key={t.name}
                  onClick={() => loadTemplate(t)}
                  className="w-full text-left rounded-lg border border-gray-200 p-3 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                >
                  <div className="text-sm font-medium text-gray-700">{t.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{t.layers.length}개 레이어</div>
                </button>
              ))}
            </div>
          )}

          {/* Layers panel */}
          {activePanel === 'layers' && (
            <div className="flex-1 overflow-y-auto">
              {layers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-gray-400 text-sm gap-2">
                  <Layers className="w-6 h-6" />
                  레이어가 없습니다
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {layers.map((layer, idx) => (
                    <li
                      key={layer.id}
                      onClick={() => { setSelectedId(layer.id); setActivePanel('properties') }}
                      className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-xs hover:bg-gray-50 ${selectedId === layer.id ? 'bg-indigo-50' : ''}`}
                    >
                      <span className="text-gray-300 text-[10px] w-4 shrink-0">{layers.length - idx}</span>
                      <span className="truncate flex-1 font-medium text-gray-700">{layer.name}</span>
                      <button onClick={e => { e.stopPropagation(); toggleVisibility(layer.id) }} className="text-gray-400 hover:text-gray-600">
                        {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={e => { e.stopPropagation(); toggleLock(layer.id) }} className="text-gray-400 hover:text-gray-600">
                        {layer.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={e => { e.stopPropagation(); moveLayer(layer.id, 'up') }} className="text-gray-400 hover:text-gray-600">
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={e => { e.stopPropagation(); moveLayer(layer.id, 'down') }} className="text-gray-400 hover:text-gray-600">
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={e => { e.stopPropagation(); deleteLayer(layer.id) }} className="text-red-400 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {/* Add buttons */}
              <div className="p-3 border-t border-gray-100 flex gap-2">
                <button
                  onClick={() => setTool('text')}
                  className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 py-2 text-xs text-gray-500 hover:text-gray-700 hover:border-gray-400"
                >
                  <Plus className="w-3.5 h-3.5" /> 텍스트
                </button>
                <button
                  onClick={() => setTool('rect')}
                  className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 py-2 text-xs text-gray-500 hover:text-gray-700 hover:border-gray-400"
                >
                  <Plus className="w-3.5 h-3.5" /> 도형
                </button>
              </div>
            </div>
          )}

          {/* Properties panel */}
          {activePanel === 'properties' && selectedLayer && (
            <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
              {/* Name */}
              <div>
                <label className="block text-gray-500 mb-1">레이어 이름</label>
                <input
                  type="text"
                  value={selectedLayer.name}
                  onChange={e => updateSelected({ name: e.target.value })}
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs"
                />
              </div>

              {/* Position */}
              <div>
                <label className="block text-gray-500 mb-1">위치 / 크기 (mm)</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {([['x', 'X'], ['y', 'Y'], ['width', 'W'], ['height', 'H']] as const).map(([k, label]) => (
                    <div key={k} className="flex items-center gap-1">
                      <span className="text-gray-400 w-3">{label}</span>
                      <input
                        type="number"
                        value={Math.round(selectedLayer[k] * 10) / 10}
                        step="0.5"
                        onChange={e => updateSelected({ [k]: parseFloat(e.target.value) || 0 })}
                        className="flex-1 border border-gray-200 rounded px-1.5 py-1 text-xs w-0"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Text-specific */}
              {selectedLayer.type === 'text' && (
                <>
                  <div>
                    <label className="block text-gray-500 mb-1">텍스트</label>
                    <textarea
                      value={selectedLayer.content ?? ''}
                      onChange={e => updateSelected({ content: e.target.value })}
                      rows={3}
                      className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-500 mb-1">폰트</label>
                    <select
                      value={selectedLayer.fontFamily ?? 'Arial'}
                      onChange={e => updateSelected({ fontFamily: e.target.value })}
                      className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs"
                    >
                      {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="block text-gray-500 mb-1">크기 (pt)</label>
                      <input
                        type="number"
                        value={selectedLayer.fontSize ?? 12}
                        min={6} max={200} step={1}
                        onChange={e => updateSelected({ fontSize: parseInt(e.target.value) || 12 })}
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs"
                      />
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => updateSelected({ fontBold: !selectedLayer.fontBold })}
                        className={`w-7 h-7 flex items-center justify-center rounded border text-xs font-bold transition-colors ${selectedLayer.fontBold ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-gray-200 text-gray-600'}`}
                      >B</button>
                      <button
                        onClick={() => updateSelected({ fontItalic: !selectedLayer.fontItalic })}
                        className={`w-7 h-7 flex items-center justify-center rounded border text-xs italic transition-colors ${selectedLayer.fontItalic ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-gray-200 text-gray-600'}`}
                      >I</button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-gray-500 mb-1">색상</label>
                    <input
                      type="color"
                      value={selectedLayer.color ?? '#000000'}
                      onChange={e => updateSelected({ color: e.target.value })}
                      className="w-full h-8 rounded cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-500 mb-1">정렬</label>
                    <div className="flex gap-1">
                      {([
                        { v: 'left', icon: AlignLeft },
                        { v: 'center', icon: AlignCenter },
                        { v: 'right', icon: AlignRight },
                      ] as const).map(({ v, icon: Icon }) => (
                        <button
                          key={v}
                          onClick={() => updateSelected({ textAlign: v })}
                          className={`flex-1 h-7 flex items-center justify-center rounded border transition-colors ${selectedLayer.textAlign === v ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-gray-200 text-gray-600'}`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="block text-gray-500 mb-1">자간 (px)</label>
                      <input
                        type="number"
                        value={selectedLayer.letterSpacing ?? 0}
                        step={0.5}
                        onChange={e => updateSelected({ letterSpacing: parseFloat(e.target.value) })}
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-500 mb-1">행간 (배수)</label>
                      <input
                        type="number"
                        value={selectedLayer.lineHeight ?? 1.4}
                        step={0.1} min={0.8} max={4}
                        onChange={e => updateSelected({ lineHeight: parseFloat(e.target.value) })}
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Rect-specific */}
              {selectedLayer.type === 'rect' && (
                <>
                  <div>
                    <label className="block text-gray-500 mb-1">채우기 색상</label>
                    <input
                      type="color"
                      value={selectedLayer.fillColor ?? '#e5e7eb'}
                      onChange={e => updateSelected({ fillColor: e.target.value })}
                      className="w-full h-8 rounded cursor-pointer"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="block text-gray-500 mb-1">테두리 색상</label>
                      <input
                        type="color"
                        value={selectedLayer.strokeColor ?? '#000000'}
                        onChange={e => updateSelected({ strokeColor: e.target.value })}
                        className="w-full h-8 rounded cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-500 mb-1">테두리 두께</label>
                      <input
                        type="number"
                        value={selectedLayer.strokeWidth ?? 0}
                        step={0.1} min={0}
                        onChange={e => updateSelected({ strokeWidth: parseFloat(e.target.value) })}
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                </>
              )}

              <button
                onClick={() => { deleteLayer(selectedId!); setActivePanel('layers') }}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-red-200 py-2 text-xs text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-3.5 h-3.5" /> 레이어 삭제
              </button>
            </div>
          )}

          {activePanel === 'properties' && !selectedLayer && (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-xs">
              레이어를 선택하세요
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
