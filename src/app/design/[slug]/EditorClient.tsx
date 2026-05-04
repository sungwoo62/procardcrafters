'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Type, Square, ImageIcon, Layers, Trash2,
  ChevronUp, ChevronDown, Eye, EyeOff, Lock, Unlock,
  Download, ShoppingCart, Bold, Italic, AlignLeft,
  AlignCenter, AlignRight, ArrowLeft, Plus, LayoutTemplate,
  RotateCcw, RotateCw,
} from 'lucide-react'
import type { PrintProduct, PrintProductOption } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

type LayerType = 'text' | 'image' | 'rect'

interface LayerInfo {
  id: string
  name: string
  type: LayerType
  visible: boolean
  locked: boolean
}

interface EditorDimensions {
  widthMm: number
  heightMm: number
  bleedMm: number
}

interface SelectedProps {
  x: number
  y: number
  width: number
  height: number
  angle: number
  // text
  text?: string
  fontFamily?: string
  fontSize?: number
  fontWeight?: string
  fontStyle?: string
  fill?: string
  textAlign?: string
  charSpacing?: number
  lineHeight?: number
  // text effects
  textStroke?: string
  textStrokeWidth?: number
  shadowEnabled?: boolean
  shadowColor?: string
  shadowOffsetX?: number
  shadowOffsetY?: number
  shadowBlur?: number
  // rect
  fillColor?: string
  strokeColor?: string
  strokeWidth?: number
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

const MAX_CANVAS_W = 620
const MAX_CANVAS_H = 520
const SNAP_THRESHOLD_MM = 2

// ─── 폰트 카탈로그 ───────────────────────────────────────────────────────────
// Google Fonts URL은 로딩 시 동적으로 삽입

interface FontEntry {
  name: string
  google?: boolean  // true면 Google Fonts에서 동적 로드
  category: 'korean' | 'sans' | 'serif' | 'display' | 'system'
}

const FONT_CATALOG: FontEntry[] = [
  // ── 한국어
  { name: 'Noto Sans KR',      google: true,  category: 'korean' },
  { name: 'Nanum Gothic',      google: true,  category: 'korean' },
  { name: 'Nanum Myeongjo',    google: true,  category: 'korean' },
  { name: 'Black Han Sans',    google: true,  category: 'korean' },
  { name: 'Jua',               google: true,  category: 'korean' },
  { name: 'Cute Font',         google: true,  category: 'korean' },
  // ── Sans-Serif
  { name: 'Roboto',            google: true,  category: 'sans' },
  { name: 'Open Sans',         google: true,  category: 'sans' },
  { name: 'Lato',              google: true,  category: 'sans' },
  { name: 'Montserrat',        google: true,  category: 'sans' },
  { name: 'Poppins',           google: true,  category: 'sans' },
  { name: 'Inter',             google: true,  category: 'sans' },
  // ── Serif
  { name: 'Playfair Display',  google: true,  category: 'serif' },
  { name: 'Merriweather',      google: true,  category: 'serif' },
  { name: 'Lora',              google: true,  category: 'serif' },
  // ── Display / Decorative
  { name: 'Oswald',            google: true,  category: 'display' },
  { name: 'Bebas Neue',        google: true,  category: 'display' },
  { name: 'Pacifico',          google: true,  category: 'display' },
  // ── 시스템 폰트 (항상 사용 가능)
  { name: 'Arial',             category: 'system' },
  { name: 'Georgia',           category: 'system' },
  { name: 'Helvetica',         category: 'system' },
  { name: 'Times New Roman',   category: 'system' },
  { name: 'Courier New',       category: 'system' },
  { name: 'Impact',            category: 'system' },
]

const FONT_CATEGORY_LABELS: Record<FontEntry['category'], string> = {
  korean: '한국어',
  sans:   'Sans-Serif',
  serif:  'Serif',
  display: 'Display',
  system:  '시스템',
}

const loadedFonts = new Set<string>()

async function loadGoogleFont(fontName: string): Promise<void> {
  if (loadedFonts.has(fontName)) return
  const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}&display=swap`
  if (!document.querySelector(`link[data-gfont="${fontName}"]`)) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    link.setAttribute('data-gfont', fontName)
    document.head.appendChild(link)
  }
  await document.fonts.ready
  loadedFonts.add(fontName)
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getScale(dims: EditorDimensions): number {
  const totalW = dims.widthMm + 2 * dims.bleedMm
  const totalH = dims.heightMm + 2 * dims.bleedMm
  return Math.min(MAX_CANVAS_W / totalW, MAX_CANVAS_H / totalH)
}

function mmToPx(mm: number, scale: number) { return mm * scale }

function makeId() { return Math.random().toString(36).slice(2) }

function isBackground(obj: { data?: { role?: string } }) {
  return !!obj.data?.role
}

// ─── Main component ────────────────────────────────────────────────────────────

interface Props {
  product: PrintProduct
  options: PrintProductOption[]
}

export default function EditorClient({ product, options }: Props) {
  const searchParams = useSearchParams()
  const dims = PRODUCT_DIMS[product.category] ?? DEFAULT_DIMS
  const scale = getScale(dims)
  const canvasW = Math.round(mmToPx(dims.widthMm + 2 * dims.bleedMm, scale))
  const canvasH = Math.round(mmToPx(dims.heightMm + 2 * dims.bleedMm, scale))

  const canvasElRef = useRef<HTMLCanvasElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fabricRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fabricModRef = useRef<typeof import('fabric') | null>(null)
  const toolRef = useRef<'select' | 'text' | 'rect' | 'image'>('select')

  // History for undo/redo
  const historyStack = useRef<string[]>([])
  const historyIndex = useRef(-1)
  const isMutating = useRef(false)

  // Clipboard for copy/paste
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clipboardRef = useRef<any>(null)

  // State
  const [layers, setLayers] = useState<LayerInfo[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedProps, setSelectedProps] = useState<SelectedProps | null>(null)
  const [tool, setTool] = useState<'select' | 'text' | 'rect' | 'image'>('select')
  const [activePanel, setActivePanel] = useState<'layers' | 'templates' | 'properties'>('layers')
  const [bgColor, setBgColor] = useState('#ffffff')
  const [ordering, setOrdering] = useState(false)
  const [orderError, setOrderError] = useState('')

  // Keep ref in sync with state for canvas event handlers
  useEffect(() => { toolRef.current = tool }, [tool])
  const bgColorRef = useRef(bgColor)
  useEffect(() => { bgColorRef.current = bgColor }, [bgColor])

  // ── Sync helpers ──────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function syncLayers(canvas: any) {
    const objs = canvas.getObjects().filter((o: { data?: { role?: string } }) => !isBackground(o))
    const layerList: LayerInfo[] = [...objs].reverse().map((o: {
      data?: { id?: string; name?: string; layerType?: LayerType }
      visible?: boolean
      selectable?: boolean
    }) => ({
      id: o.data?.id ?? '',
      name: o.data?.name ?? 'Layer',
      type: (o.data?.layerType ?? 'rect') as LayerType,
      visible: o.visible ?? true,
      locked: !(o.selectable ?? true),
    }))
    setLayers(layerList)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function syncSelected(canvas: any) {
    const obj = canvas.getActiveObject()
    if (!obj || isBackground(obj)) {
      setSelectedId(null)
      setSelectedProps(null)
      return
    }
    const id = obj.data?.id ?? ''
    setSelectedId(id)

    const props: SelectedProps = {
      x: Math.round((obj.left ?? 0) * 10) / 10,
      y: Math.round((obj.top ?? 0) * 10) / 10,
      width: Math.round((obj.getScaledWidth?.() ?? obj.width ?? 0) * 10) / 10,
      height: Math.round((obj.getScaledHeight?.() ?? obj.height ?? 0) * 10) / 10,
      angle: Math.round((obj.angle ?? 0) * 10) / 10,
    }

    const objType: string = obj.type ?? ''
    if (objType === 'textbox' || objType === 'text' || objType === 'i-text') {
      props.text = obj.text ?? ''
      props.fontFamily = obj.fontFamily ?? 'Arial'
      props.fontSize = Math.round(obj.fontSize ?? 14)
      props.fontWeight = obj.fontWeight ?? 'normal'
      props.fontStyle = obj.fontStyle ?? 'normal'
      props.fill = typeof obj.fill === 'string' ? obj.fill : '#000000'
      props.textAlign = obj.textAlign ?? 'left'
      props.charSpacing = obj.charSpacing ?? 0
      props.lineHeight = obj.lineHeight ?? 1.4
      // 텍스트 아웃라인
      props.textStroke = typeof obj.stroke === 'string' && obj.stroke ? obj.stroke : '#000000'
      props.textStrokeWidth = obj.strokeWidth ?? 0
      // 그림자
      const sh = obj.shadow
      props.shadowEnabled = !!sh
      props.shadowColor = sh?.color ?? 'rgba(0,0,0,0.5)'
      props.shadowOffsetX = sh?.offsetX ?? 4
      props.shadowOffsetY = sh?.offsetY ?? 4
      props.shadowBlur = sh?.blur ?? 6
    } else if (objType === 'rect') {
      props.fillColor = typeof obj.fill === 'string' ? obj.fill : '#e5e7eb'
      props.strokeColor = typeof obj.stroke === 'string' ? obj.stroke : '#000000'
      props.strokeWidth = obj.strokeWidth ?? 0
    }

    setSelectedProps(props)
    setActivePanel('properties')
  }

  // ── History ───────────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function saveHistory(canvas: any) {
    const json = JSON.stringify(canvas.toJSON(['data', 'selectable', 'evented', 'hasControls', 'visible']))
    historyStack.current = historyStack.current.slice(0, historyIndex.current + 1)
    historyStack.current.push(json)
    historyIndex.current = historyStack.current.length - 1
  }

  const undo = useCallback(async () => {
    const canvas = fabricRef.current
    if (!canvas || historyIndex.current <= 0) return
    historyIndex.current--
    const json = historyStack.current[historyIndex.current]
    isMutating.current = true
    await canvas.loadFromJSON(JSON.parse(json))
    isMutating.current = false
    canvas.renderAll()
    syncLayers(canvas)
    syncSelected(canvas)
  }, [])

  const redo = useCallback(async () => {
    const canvas = fabricRef.current
    if (!canvas || historyIndex.current >= historyStack.current.length - 1) return
    historyIndex.current++
    const json = historyStack.current[historyIndex.current]
    isMutating.current = true
    await canvas.loadFromJSON(JSON.parse(json))
    isMutating.current = false
    canvas.renderAll()
    syncLayers(canvas)
    syncSelected(canvas)
  }, [])

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────

  useEffect(() => {
    async function handleKey(e: KeyboardEvent) {
      const canvas = fabricRef.current
      if (!canvas) return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const obj = canvas.getActiveObject()
        if (obj && !isBackground(obj)) {
          canvas.remove(obj)
          canvas.discardActiveObject()
          canvas.renderAll()
          syncLayers(canvas)
          saveHistory(canvas)
        }
      } else if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); await undo() }
        else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); await redo() }
        else if (e.key === 'c') {
          const obj = canvas.getActiveObject()
          if (obj && !isBackground(obj)) {
            clipboardRef.current = await obj.clone(['data'])
          }
        } else if (e.key === 'v') {
          if (clipboardRef.current) {
            const cloned = await clipboardRef.current.clone(['data'])
            cloned.set({ left: (cloned.left ?? 0) + 10, top: (cloned.top ?? 0) + 10 })
            cloned.data = { ...cloned.data, id: makeId() }
            canvas.add(cloned)
            canvas.setActiveObject(cloned)
            canvas.renderAll()
            syncLayers(canvas)
            saveHistory(canvas)
          }
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [undo, redo])

  // ── Background drawing ─────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function addBackgroundObjects(canvas: any, fabric: typeof import('fabric'), bg: string) {
    const trimX = mmToPx(dims.bleedMm, scale)
    const trimY = mmToPx(dims.bleedMm, scale)
    const trimW = mmToPx(dims.widthMm, scale)
    const trimH = mmToPx(dims.heightMm, scale)

    const bleedBg = new fabric.Rect({
      left: 0, top: 0, width: canvasW, height: canvasH,
      fill: '#e5e7eb', selectable: false, evented: false,
      data: { role: 'bleed-bg' },
    })
    const trimBg = new fabric.Rect({
      left: trimX, top: trimY, width: trimW, height: trimH,
      fill: bg, selectable: false, evented: false,
      data: { role: 'trim-bg' },
    })
    const trimBorder = new fabric.Rect({
      left: trimX, top: trimY, width: trimW, height: trimH,
      fill: 'transparent', stroke: 'rgba(239,68,68,0.5)', strokeWidth: 1,
      strokeDashArray: [6, 3], selectable: false, evented: false,
      data: { role: 'trim-border' },
    })

    canvas.add(bleedBg)
    canvas.add(trimBg)
    canvas.add(trimBorder)
    canvas.sendObjectToBack(trimBorder)
    canvas.sendObjectToBack(trimBg)
    canvas.sendObjectToBack(bleedBg)
  }

  // ── Snap guides ───────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function clearGuides(canvas: any) {
    const guides = canvas.getObjects().filter((o: { data?: { role?: string } }) => o.data?.role === 'guide')
    guides.forEach((g: object) => canvas.remove(g))
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function snapObject(canvas: any, fabric: typeof import('fabric'), obj: any) {
    clearGuides(canvas)

    const trimX = mmToPx(dims.bleedMm, scale)
    const trimY = mmToPx(dims.bleedMm, scale)
    const trimW = mmToPx(dims.widthMm, scale)
    const trimH = mmToPx(dims.heightMm, scale)
    const snapPx = mmToPx(SNAP_THRESHOLD_MM, scale)

    const objW = obj.getScaledWidth?.() ?? obj.width ?? 0
    const objH = obj.getScaledHeight?.() ?? obj.height ?? 0
    const objL = obj.left ?? 0
    const objT = obj.top ?? 0
    const docCX = trimX + trimW / 2
    const docCY = trimY + trimH / 2

    const guides: object[] = []

    function vLine(x: number) {
      return new fabric.Line([x, 0, x, canvasH], {
        stroke: '#4f46e5', strokeWidth: 1, strokeDashArray: [4, 4],
        selectable: false, evented: false, data: { role: 'guide' },
      })
    }
    function hLine(y: number) {
      return new fabric.Line([0, y, canvasW, y], {
        stroke: '#4f46e5', strokeWidth: 1, strokeDashArray: [4, 4],
        selectable: false, evented: false, data: { role: 'guide' },
      })
    }

    if (Math.abs(objL + objW / 2 - docCX) < snapPx) {
      obj.set('left', docCX - objW / 2)
      guides.push(vLine(docCX))
    }
    if (Math.abs(objT + objH / 2 - docCY) < snapPx) {
      obj.set('top', docCY - objH / 2)
      guides.push(hLine(docCY))
    }
    if (Math.abs(objL - trimX) < snapPx) {
      obj.set('left', trimX)
      guides.push(vLine(trimX))
    }
    if (Math.abs(objT - trimY) < snapPx) {
      obj.set('top', trimY)
      guides.push(hLine(trimY))
    }
    if (Math.abs(objL + objW - (trimX + trimW)) < snapPx) {
      obj.set('left', trimX + trimW - objW)
      guides.push(vLine(trimX + trimW))
    }
    if (Math.abs(objT + objH - (trimY + trimH)) < snapPx) {
      obj.set('top', trimY + trimH - objH)
      guides.push(hLine(trimY + trimH))
    }

    guides.forEach(g => canvas.add(g))
  }

  // ── Templates ─────────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function clearUserObjects(canvas: any) {
    const toRemove = canvas.getObjects().filter(
      (o: { data?: { role?: string } }) => !o.data?.role || o.data.role === 'guide'
    )
    toRemove.forEach((o: object) => canvas.remove(o))
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function addTextbox(canvas: any, fabric: typeof import('fabric'), text: string, left: number, top: number, width: number, opts: Record<string, unknown>) {
    const obj = new fabric.Textbox(text, { left, top, width, ...opts })
    canvas.add(obj)
    return obj
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function buildTemplate(canvas: any, fabric: typeof import('fabric'), name: string, bg: string) {
    const bl = mmToPx(dims.bleedMm, scale)

    if (name === 'Classic') {
      addTextbox(canvas, fabric, 'John Doe', bl + mmToPx(5, scale), bl + mmToPx(14, scale), mmToPx(75, scale), {
        fontSize: mmToPx(6, scale), fontWeight: 'bold', fill: '#111111', textAlign: 'left',
        data: { id: makeId(), name: 'Name', layerType: 'text' },
      })
      addTextbox(canvas, fabric, 'Senior Designer', bl + mmToPx(5, scale), bl + mmToPx(27, scale), mmToPx(65, scale), {
        fontSize: mmToPx(3.2, scale), fill: '#555555', textAlign: 'left',
        data: { id: makeId(), name: 'Title', layerType: 'text' },
      })
      canvas.add(new fabric.Rect({
        left: bl + mmToPx(5, scale), top: bl + mmToPx(36, scale),
        width: mmToPx(45, scale), height: mmToPx(0.5, scale),
        fill: '#cccccc', data: { id: makeId(), name: 'Divider', layerType: 'rect' },
      }))
      addTextbox(canvas, fabric, 'email@company.com\n+1 (555) 000-0000', bl + mmToPx(5, scale), bl + mmToPx(40, scale), mmToPx(75, scale), {
        fontSize: mmToPx(2.8, scale), fill: '#444444', textAlign: 'left',
        data: { id: makeId(), name: 'Contact', layerType: 'text' },
      })
    } else if (name === 'Minimal') {
      addTextbox(canvas, fabric, 'Your Name', bl + mmToPx(7.5, scale), bl + mmToPx(19, scale), mmToPx(70, scale), {
        fontSize: mmToPx(6, scale), fill: '#000000', textAlign: 'center', charSpacing: 200,
        data: { id: makeId(), name: 'Name', layerType: 'text' },
      })
      addTextbox(canvas, fabric, 'Company · Title', bl + mmToPx(7.5, scale), bl + mmToPx(34, scale), mmToPx(70, scale), {
        fontSize: mmToPx(3, scale), fill: '#888888', textAlign: 'center', charSpacing: 100,
        data: { id: makeId(), name: 'Company', layerType: 'text' },
      })
    } else if (name === 'Dark') {
      canvas.add(new fabric.Rect({
        left: bl, top: bl, width: mmToPx(4, scale), height: mmToPx(dims.heightMm, scale),
        fill: '#4f46e5', data: { id: makeId(), name: 'Accent Bar', layerType: 'rect' },
      }))
      addTextbox(canvas, fabric, 'Your Name', bl + mmToPx(10, scale), bl + mmToPx(14, scale), mmToPx(70, scale), {
        fontSize: mmToPx(5.5, scale), fontWeight: 'bold', fill: '#ffffff', textAlign: 'left',
        data: { id: makeId(), name: 'Name', layerType: 'text' },
      })
      addTextbox(canvas, fabric, 'Title • Company', bl + mmToPx(10, scale), bl + mmToPx(27, scale), mmToPx(70, scale), {
        fontSize: mmToPx(3, scale), fill: '#a5b4fc', textAlign: 'left',
        data: { id: makeId(), name: 'Title', layerType: 'text' },
      })
      addTextbox(canvas, fabric, 'email@company.com', bl + mmToPx(10, scale), bl + mmToPx(40, scale), mmToPx(70, scale), {
        fontSize: mmToPx(2.5, scale), fill: '#9ca3af', textAlign: 'left',
        data: { id: makeId(), name: 'Email', layerType: 'text' },
      })
    }
    // Blank: no user objects

    // Update trim-bg color
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const trimBg = canvas.getObjects().find((o: any) => o.data?.role === 'trim-bg')
    if (trimBg) trimBg.set('fill', bg)
  }

  // ── Init Fabric.js ─────────────────────────────────────────────────────────

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let canvas: any = null

    async function init() {
      const fabric = await import('fabric')
      fabricModRef.current = fabric
      if (!canvasElRef.current) return

      canvas = new fabric.Canvas(canvasElRef.current, {
        width: canvasW,
        height: canvasH,
        preserveObjectStacking: true,
        enableRetinaScaling: false,
      })
      fabricRef.current = canvas

      // Draw background
      addBackgroundObjects(canvas, fabric, bgColorRef.current)

      // Load Classic template
      buildTemplate(canvas, fabric, 'Classic', bgColorRef.current)
      canvas.renderAll()

      syncLayers(canvas)
      saveHistory(canvas)

      // ── Events ────────────────────────────────────────────────────────────
      canvas.on('selection:created', () => syncSelected(canvas))
      canvas.on('selection:updated', () => syncSelected(canvas))
      canvas.on('selection:cleared', () => { setSelectedId(null); setSelectedProps(null) })

      canvas.on('object:modified', () => {
        syncLayers(canvas)
        syncSelected(canvas)
        saveHistory(canvas)
      })

      canvas.on('object:added', () => {
        if (!isMutating.current) {
          syncLayers(canvas)
          saveHistory(canvas)
        }
      })

      canvas.on('object:removed', () => {
        if (!isMutating.current) {
          syncLayers(canvas)
          saveHistory(canvas)
        }
      })

      canvas.on('object:moving', (e: { target: object }) => {
        snapObject(canvas, fabric, e.target)
      })

      canvas.on('object:moved', () => {
        clearGuides(canvas)
      })

      // Mouse wheel zoom
      canvas.on('mouse:wheel', (opt: { e: WheelEvent }) => {
        const delta = opt.e.deltaY
        let z = canvas.getZoom()
        z *= 0.999 ** delta
        z = Math.min(Math.max(z, 0.2), 5)
        canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, z)
        opt.e.preventDefault()
        opt.e.stopPropagation()
      })

      // Click to place objects
      canvas.on('mouse:down', async (opt: { e: MouseEvent; target?: object }) => {
        const currentTool = toolRef.current
        if (currentTool === 'select') return
        if (opt.target && !isBackground(opt.target as { data?: { role?: string } })) return

        const pointer = canvas.getScenePoint(opt.e)

        if (currentTool === 'text') {
          const id = makeId()
          const obj = new fabric.Textbox('Enter text', {
            left: pointer.x,
            top: pointer.y,
            width: mmToPx(40, scale),
            fontSize: mmToPx(5, scale),
            fontFamily: 'Arial',
            fill: '#000000',
            data: { id, name: 'Text', layerType: 'text' },
          })
          canvas.add(obj)
          canvas.setActiveObject(obj)
          canvas.renderAll()
          setTool('select')
        } else if (currentTool === 'rect') {
          const id = makeId()
          const obj = new fabric.Rect({
            left: pointer.x,
            top: pointer.y,
            width: mmToPx(20, scale),
            height: mmToPx(20, scale),
            fill: '#e5e7eb',
            stroke: '#9ca3af',
            strokeWidth: 1,
            data: { id, name: 'Rectangle', layerType: 'rect' },
          })
          canvas.add(obj)
          canvas.setActiveObject(obj)
          canvas.renderAll()
          setTool('select')
        }
      })
    }

    init()

    return () => {
      if (canvas) canvas.dispose()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Background color update ───────────────────────────────────────────────

  function updateBgColor(color: string) {
    setBgColor(color)
    bgColorRef.current = color
    const canvas = fabricRef.current
    if (!canvas) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const trimBg = canvas.getObjects().find((o: any) => o.data?.role === 'trim-bg')
    if (trimBg) {
      trimBg.set('fill', color)
      canvas.renderAll()
    }
  }

  // ── Layer add operations ──────────────────────────────────────────────────

  async function addTextLayer() {
    const fabric = fabricModRef.current ?? await import('fabric')
    const canvas = fabricRef.current
    if (!canvas) return
    const bl = mmToPx(dims.bleedMm, scale)
    const id = makeId()
    const obj = new fabric.Textbox('Enter text', {
      left: bl + mmToPx(5, scale),
      top: bl + mmToPx(5, scale),
      width: mmToPx(40, scale),
      fontSize: mmToPx(5, scale),
      fontFamily: 'Arial',
      fill: '#000000',
      data: { id, name: 'Text', layerType: 'text' },
    })
    canvas.add(obj)
    canvas.setActiveObject(obj)
    canvas.renderAll()
    setTool('select')
  }

  async function addRectLayer() {
    const fabric = fabricModRef.current ?? await import('fabric')
    const canvas = fabricRef.current
    if (!canvas) return
    const bl = mmToPx(dims.bleedMm, scale)
    const id = makeId()
    const obj = new fabric.Rect({
      left: bl + mmToPx(10, scale),
      top: bl + mmToPx(10, scale),
      width: mmToPx(20, scale),
      height: mmToPx(20, scale),
      fill: '#e5e7eb',
      stroke: '#9ca3af',
      strokeWidth: 1,
      data: { id, name: 'Rectangle', layerType: 'rect' },
    })
    canvas.add(obj)
    canvas.setActiveObject(obj)
    canvas.renderAll()
    setTool('select')
  }

  const imageInputRef = useRef<HTMLInputElement>(null)

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    const fabric = fabricModRef.current ?? await import('fabric')
    const canvas = fabricRef.current
    if (!canvas) return

    const img = await fabric.FabricImage.fromURL(url)
    const maxW = mmToPx(dims.widthMm * 0.6, scale)
    const maxH = mmToPx(dims.heightMm * 0.6, scale)
    const scaleF = Math.min(maxW / (img.width ?? 1), maxH / (img.height ?? 1))
    const bl = mmToPx(dims.bleedMm, scale)
    const id = makeId()
    img.set({
      left: bl + (mmToPx(dims.widthMm, scale) - (img.width ?? 0) * scaleF) / 2,
      top: bl + (mmToPx(dims.heightMm, scale) - (img.height ?? 0) * scaleF) / 2,
      scaleX: scaleF,
      scaleY: scaleF,
      data: { id, name: file.name.slice(0, 20), layerType: 'image' },
    })
    canvas.add(img)
    canvas.setActiveObject(img)
    canvas.renderAll()
    e.target.value = ''
  }

  // ── Load template ────────────────────────────────────────────────────────

  async function loadTemplate(name: string, bg: string) {
    const fabric = fabricModRef.current ?? await import('fabric')
    const canvas = fabricRef.current
    if (!canvas) return

    isMutating.current = true
    clearUserObjects(canvas)
    setBgColor(bg)
    bgColorRef.current = bg
    buildTemplate(canvas, fabric, name, bg)
    canvas.discardActiveObject()
    canvas.renderAll()
    isMutating.current = false

    syncLayers(canvas)
    saveHistory(canvas)
    setSelectedId(null)
    setSelectedProps(null)
    setActivePanel('layers')
  }

  // ── Selected object update ────────────────────────────────────────────────

  function updateSelected(patch: Partial<SelectedProps>) {
    const canvas = fabricRef.current
    if (!canvas) return
    const obj = canvas.getActiveObject()
    if (!obj || isBackground(obj)) return

    if (patch.x !== undefined) obj.set('left', patch.x)
    if (patch.y !== undefined) obj.set('top', patch.y)
    if (patch.angle !== undefined) obj.set('angle', patch.angle)
    if (patch.text !== undefined) obj.set('text', patch.text)
    if (patch.fontFamily !== undefined) {
      const entry = FONT_CATALOG.find(f => f.name === patch.fontFamily)
      if (entry?.google) {
        loadGoogleFont(patch.fontFamily).then(() => {
          obj.set('fontFamily', patch.fontFamily!)
          canvas.requestRenderAll()
        })
      } else {
        obj.set('fontFamily', patch.fontFamily)
      }
    }
    if (patch.fontSize !== undefined) obj.set('fontSize', patch.fontSize)
    if (patch.fontWeight !== undefined) obj.set('fontWeight', patch.fontWeight)
    if (patch.fontStyle !== undefined) obj.set('fontStyle', patch.fontStyle)
    if (patch.fill !== undefined) obj.set('fill', patch.fill)
    if (patch.textAlign !== undefined) obj.set('textAlign', patch.textAlign)
    if (patch.charSpacing !== undefined) obj.set('charSpacing', patch.charSpacing)
    if (patch.lineHeight !== undefined) obj.set('lineHeight', patch.lineHeight)
    // 텍스트 아웃라인
    if (patch.textStroke !== undefined) obj.set('stroke', patch.textStroke)
    if (patch.textStrokeWidth !== undefined) {
      obj.set('strokeWidth', patch.textStrokeWidth)
      if (patch.textStrokeWidth > 0) obj.set('paintFirst', 'stroke')
    }
    // 그림자
    if (patch.shadowEnabled !== undefined || patch.shadowColor !== undefined ||
        patch.shadowOffsetX !== undefined || patch.shadowOffsetY !== undefined ||
        patch.shadowBlur !== undefined) {
      const cur = selectedProps!
      const enabled = patch.shadowEnabled ?? cur.shadowEnabled
      if (!enabled) {
        obj.set('shadow', null)
      } else {
        const fabric = fabricModRef.current
        if (fabric) {
          obj.set('shadow', new fabric.Shadow({
            color: patch.shadowColor ?? cur.shadowColor ?? 'rgba(0,0,0,0.5)',
            offsetX: patch.shadowOffsetX ?? cur.shadowOffsetX ?? 4,
            offsetY: patch.shadowOffsetY ?? cur.shadowOffsetY ?? 4,
            blur: patch.shadowBlur ?? cur.shadowBlur ?? 6,
          }))
        }
      }
    }
    // Rect 전용
    if (patch.fillColor !== undefined) obj.set('fill', patch.fillColor)
    if (patch.strokeColor !== undefined) obj.set('stroke', patch.strokeColor)
    if (patch.strokeWidth !== undefined) obj.set('strokeWidth', patch.strokeWidth)

    canvas.renderAll()
    setSelectedProps(prev => prev ? { ...prev, ...patch } : null)
    saveHistory(canvas)
  }

  // ── Layer operations ──────────────────────────────────────────────────────

  function deleteSelectedLayer() {
    const canvas = fabricRef.current
    if (!canvas) return
    const obj = canvas.getActiveObject()
    if (obj && !isBackground(obj)) {
      canvas.remove(obj)
      canvas.discardActiveObject()
      canvas.renderAll()
      setSelectedId(null)
      setSelectedProps(null)
      setActivePanel('layers')
    }
  }

  function selectLayerById(id: string) {
    const canvas = fabricRef.current
    if (!canvas) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = canvas.getObjects().find((o: any) => o.data?.id === id)
    if (obj) {
      canvas.setActiveObject(obj)
      canvas.renderAll()
      syncSelected(canvas)
    }
  }

  function toggleVisibility(id: string) {
    const canvas = fabricRef.current
    if (!canvas) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = canvas.getObjects().find((o: any) => o.data?.id === id)
    if (obj) {
      obj.set('visible', !obj.visible)
      canvas.renderAll()
      syncLayers(canvas)
    }
  }

  function toggleLock(id: string) {
    const canvas = fabricRef.current
    if (!canvas) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = canvas.getObjects().find((o: any) => o.data?.id === id)
    if (obj) {
      const nowLocked = obj.selectable
      obj.set({ selectable: !nowLocked, evented: !nowLocked, hasControls: !nowLocked })
      canvas.renderAll()
      syncLayers(canvas)
    }
  }

  function moveLayerOrder(id: string, dir: 'up' | 'down') {
    const canvas = fabricRef.current
    if (!canvas) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = canvas.getObjects().find((o: any) => o.data?.id === id)
    if (!obj) return
    if (dir === 'up') canvas.bringObjectForward(obj)
    else canvas.sendObjectBackwards(obj)
    canvas.renderAll()
    syncLayers(canvas)
  }

  function updateLayerName(id: string, name: string) {
    const canvas = fabricRef.current
    if (!canvas) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = canvas.getObjects().find((o: any) => o.data?.id === id)
    if (obj) {
      obj.data = { ...obj.data, name }
      syncLayers(canvas)
    }
  }

  // ── Export ────────────────────────────────────────────────────────────────

  // targetDpi: 원하는 출력 DPI. 300 = 인쇄 품질, 150 = 미리보기
  function getExportDataUrl(targetDpi = 150): string {
    const canvas = fabricRef.current
    if (!canvas) return ''
    const trimX = mmToPx(dims.bleedMm, scale)
    const trimY = mmToPx(dims.bleedMm, scale)
    const trimW = mmToPx(dims.widthMm, scale)
    const trimH = mmToPx(dims.heightMm, scale)

    // 제품 크기에 따라 동적으로 multiplier 계산 (DPI 보장)
    const MM_PER_INCH = 25.4
    const needW = (dims.widthMm / MM_PER_INCH) * targetDpi
    const needH = (dims.heightMm / MM_PER_INCH) * targetDpi
    const multiplier = Math.max(1, Math.ceil(Math.max(needW / trimW, needH / trimH)))

    // Save viewport, reset for export
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vpt: any = [...(canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0])]
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0])

    const dataUrl = canvas.toDataURL({
      format: 'png',
      left: trimX,
      top: trimY,
      width: trimW,
      height: trimH,
      multiplier,
    })

    canvas.setViewportTransform(vpt)
    canvas.renderAll()
    return dataUrl
  }

  function exportPng() {
    const dataUrl = getExportDataUrl(150)
    if (!dataUrl) return
    const link = document.createElement('a')
    link.download = `${product.slug}-design.png`
    link.href = dataUrl
    link.click()
  }

  async function proceedToOrder() {
    setOrdering(true)
    setOrderError('')
    try {
      const dataUrl = getExportDataUrl(300)
      if (!dataUrl) throw new Error('Export failed')
      const res = await fetch(dataUrl)
      const blob = await res.blob()
      const formData = new FormData()
      formData.append('file', blob, `${product.slug}-design.png`)
      const uploadRes = await fetch('/api/files/upload', { method: 'POST', body: formData })
      const data = await uploadRes.json()
      if (uploadRes.ok && data.fileId) {
        const optionParams = new URLSearchParams()
        for (const opt of options) {
          const val = searchParams.get(opt.option_type)
          if (val) optionParams.set(opt.option_type, val)
        }
        const optStr = optionParams.toString()
        window.location.href = `/order?product=${product.slug}&fileId=${data.fileId}${optStr ? '&' + optStr : ''}`
      } else {
        setOrdering(false)
        setOrderError(data.error || '업로드에 실패했습니다.')
      }
    } catch {
      setOrdering(false)
      setOrderError('오류가 발생했습니다. 다시 시도해주세요.')
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const selectedLayer = layers.find(l => l.id === selectedId) ?? null

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 bg-white border-b border-gray-200 px-4 py-2.5 shrink-0">
        <Link href={`/products/${product.slug}`} className="text-gray-400 hover:text-gray-600 flex items-center gap-1 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="h-4 border-r border-gray-200" />
        <span className="text-sm font-semibold text-gray-800">{product.name_en} Editor</span>
        <span className="text-xs text-gray-400">{dims.widthMm}×{dims.heightMm}mm (bleed {dims.bleedMm}mm)</span>

        <div className="flex-1" />

        {/* Tools */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {([
            { id: 'select', icon: null, label: 'Select (V)' },
            { id: 'text',   icon: Type,    label: 'Text (T)' },
            { id: 'rect',   icon: Square,  label: 'Rectangle (R)' },
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
            title="Add Image (I)"
            className="w-8 h-8 flex items-center justify-center rounded-md transition-colors text-gray-500 hover:text-gray-800"
          >
            <ImageIcon className="w-4 h-4" />
          </button>
          <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
        </div>

        {/* Undo/Redo */}
        <div className="flex gap-1">
          <button onClick={undo} title="Undo (Ctrl+Z)" className="w-8 h-8 flex items-center justify-center rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100">
            <RotateCcw className="w-4 h-4" />
          </button>
          <button onClick={redo} title="Redo (Ctrl+Shift+Z)" className="w-8 h-8 flex items-center justify-center rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100">
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={exportPng}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Download className="w-3.5 h-3.5" /> Save PNG
          </button>
          <button
            onClick={proceedToOrder}
            disabled={ordering}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ShoppingCart className="w-3.5 h-3.5" /> {ordering ? 'Uploading...' : 'Order'}
          </button>
          {orderError && <span className="text-xs text-red-500">{orderError}</span>}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Canvas area */}
        <div className="flex-1 flex items-center justify-center overflow-auto bg-gray-200 p-6">
          <div
            className="shadow-xl"
            style={{ cursor: tool === 'text' ? 'text' : tool === 'rect' ? 'crosshair' : 'default' }}
          >
            <canvas ref={canvasElRef} />
          </div>
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
                <input type="color" value={bgColor} onChange={e => updateBgColor(e.target.value)} className="w-full h-8 rounded cursor-pointer" />
              </div>
              {[
                { name: 'Blank',   bg: '#ffffff' },
                { name: 'Classic', bg: '#ffffff' },
                { name: 'Minimal', bg: '#ffffff' },
                { name: 'Dark',    bg: '#1a1a1a' },
              ].map(t => (
                <button
                  key={t.name}
                  onClick={() => loadTemplate(t.name, t.bg)}
                  className="w-full text-left rounded-lg border border-gray-200 p-3 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                >
                  <div className="text-sm font-medium text-gray-700">{t.name}</div>
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
                  레이어 없음
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {layers.map((layer, idx) => (
                    <li
                      key={layer.id}
                      onClick={() => { selectLayerById(layer.id) }}
                      className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-xs hover:bg-gray-50 ${selectedId === layer.id ? 'bg-indigo-50' : ''}`}
                    >
                      <span className="text-gray-300 text-[10px] w-4 shrink-0">{idx + 1}</span>
                      <span className="truncate flex-1 font-medium text-gray-700">{layer.name}</span>
                      <button onClick={e => { e.stopPropagation(); toggleVisibility(layer.id) }} className="text-gray-400 hover:text-gray-600">
                        {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={e => { e.stopPropagation(); toggleLock(layer.id) }} className="text-gray-400 hover:text-gray-600">
                        {layer.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={e => { e.stopPropagation(); moveLayerOrder(layer.id, 'up') }} className="text-gray-400 hover:text-gray-600">
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={e => { e.stopPropagation(); moveLayerOrder(layer.id, 'down') }} className="text-gray-400 hover:text-gray-600">
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); selectLayerById(layer.id); setTimeout(deleteSelectedLayer, 0) }}
                        className="text-red-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="p-3 border-t border-gray-100 flex gap-2">
                <button onClick={addTextLayer} className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 py-2 text-xs text-gray-500 hover:text-gray-700 hover:border-gray-400">
                  <Plus className="w-3.5 h-3.5" /> 텍스트
                </button>
                <button onClick={addRectLayer} className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 py-2 text-xs text-gray-500 hover:text-gray-700 hover:border-gray-400">
                  <Plus className="w-3.5 h-3.5" /> 도형
                </button>
              </div>
            </div>
          )}

          {/* Properties panel */}
          {activePanel === 'properties' && selectedProps && selectedLayer && (
            <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
              {/* Name */}
              <div>
                <label className="block text-gray-500 mb-1">레이어 이름</label>
                <input
                  type="text"
                  value={selectedLayer.name}
                  onChange={e => updateLayerName(selectedId!, e.target.value)}
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs"
                />
              </div>

              {/* Position / Angle */}
              <div>
                <label className="block text-gray-500 mb-1">위치 / 크기</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {([['x', 'X'], ['y', 'Y']] as const).map(([k, label]) => (
                    <div key={k} className="flex items-center gap-1">
                      <span className="text-gray-400 w-3">{label}</span>
                      <input
                        type="number"
                        value={Math.round(selectedProps[k] ?? 0)}
                        step="1"
                        onChange={e => updateSelected({ [k]: parseFloat(e.target.value) || 0 })}
                        className="flex-1 border border-gray-200 rounded px-1.5 py-1 text-xs w-0"
                      />
                    </div>
                  ))}
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400 w-3">W</span>
                    <span className="flex-1 border border-gray-100 rounded px-1.5 py-1 text-xs bg-gray-50 text-gray-400">{Math.round(selectedProps.width ?? 0)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400 w-3">H</span>
                    <span className="flex-1 border border-gray-100 rounded px-1.5 py-1 text-xs bg-gray-50 text-gray-400">{Math.round(selectedProps.height ?? 0)}</span>
                  </div>
                  <div className="flex items-center gap-1 col-span-2">
                    <span className="text-gray-400 w-8">각도</span>
                    <input
                      type="number"
                      value={Math.round(selectedProps.angle ?? 0)}
                      step="1" min={-360} max={360}
                      onChange={e => updateSelected({ angle: parseFloat(e.target.value) || 0 })}
                      className="flex-1 border border-gray-200 rounded px-1.5 py-1 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Text-specific */}
              {selectedLayer.type === 'text' && (
                <>
                  <div>
                    <label className="block text-gray-500 mb-1">텍스트</label>
                    <textarea
                      value={selectedProps.text ?? ''}
                      onChange={e => updateSelected({ text: e.target.value })}
                      rows={3}
                      className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-500 mb-1">폰트</label>
                    <select
                      value={selectedProps.fontFamily ?? 'Arial'}
                      onChange={e => updateSelected({ fontFamily: e.target.value })}
                      className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs"
                    >
                      {(['korean','sans','serif','display','system'] as const).map(cat => {
                        const fonts = FONT_CATALOG.filter(f => f.category === cat)
                        return (
                          <optgroup key={cat} label={FONT_CATEGORY_LABELS[cat]}>
                            {fonts.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
                          </optgroup>
                        )
                      })}
                    </select>
                  </div>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="block text-gray-500 mb-1">크기 (px)</label>
                      <input
                        type="number"
                        value={selectedProps.fontSize ?? 14}
                        min={4} max={500} step={1}
                        onChange={e => updateSelected({ fontSize: parseInt(e.target.value) || 14 })}
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs"
                      />
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => updateSelected({ fontWeight: selectedProps.fontWeight === 'bold' ? 'normal' : 'bold' })}
                        className={`w-7 h-7 flex items-center justify-center rounded border text-xs font-bold transition-colors ${selectedProps.fontWeight === 'bold' ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-gray-200 text-gray-600'}`}
                      ><Bold className="w-3.5 h-3.5" /></button>
                      <button
                        onClick={() => updateSelected({ fontStyle: selectedProps.fontStyle === 'italic' ? 'normal' : 'italic' })}
                        className={`w-7 h-7 flex items-center justify-center rounded border text-xs italic transition-colors ${selectedProps.fontStyle === 'italic' ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-gray-200 text-gray-600'}`}
                      ><Italic className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-gray-500 mb-1">색상</label>
                    <input
                      type="color"
                      value={selectedProps.fill ?? '#000000'}
                      onChange={e => updateSelected({ fill: e.target.value })}
                      className="w-full h-8 rounded cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-500 mb-1">정렬</label>
                    <div className="flex gap-1">
                      {([
                        { v: 'left',   icon: AlignLeft },
                        { v: 'center', icon: AlignCenter },
                        { v: 'right',  icon: AlignRight },
                      ] as const).map(({ v, icon: Icon }) => (
                        <button
                          key={v}
                          onClick={() => updateSelected({ textAlign: v })}
                          className={`flex-1 h-7 flex items-center justify-center rounded border transition-colors ${selectedProps.textAlign === v ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-gray-200 text-gray-600'}`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="block text-gray-500 mb-1">자간</label>
                      <input
                        type="number"
                        value={selectedProps.charSpacing ?? 0}
                        step={10}
                        onChange={e => updateSelected({ charSpacing: parseFloat(e.target.value) })}
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-500 mb-1">행간</label>
                      <input
                        type="number"
                        value={selectedProps.lineHeight ?? 1.4}
                        step={0.1} min={0.8} max={4}
                        onChange={e => updateSelected({ lineHeight: parseFloat(e.target.value) })}
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs"
                      />
                    </div>
                  </div>

                  {/* 텍스트 아웃라인 */}
                  <div>
                    <label className="block text-gray-500 mb-1">아웃라인</label>
                    <div className="flex gap-1.5 items-center">
                      <input
                        type="color"
                        value={selectedProps.textStroke ?? '#000000'}
                        onChange={e => updateSelected({ textStroke: e.target.value })}
                        className="w-8 h-8 rounded cursor-pointer shrink-0"
                      />
                      <input
                        type="number"
                        value={selectedProps.textStrokeWidth ?? 0}
                        step={0.5} min={0} max={20}
                        onChange={e => updateSelected({ textStrokeWidth: parseFloat(e.target.value) || 0 })}
                        className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-xs"
                        placeholder="두께"
                      />
                    </div>
                  </div>

                  {/* 텍스트 그림자 */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-gray-500">그림자</label>
                      <button
                        onClick={() => updateSelected({ shadowEnabled: !selectedProps.shadowEnabled })}
                        className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${selectedProps.shadowEnabled ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}
                      >
                        {selectedProps.shadowEnabled ? 'ON' : 'OFF'}
                      </button>
                    </div>
                    {selectedProps.shadowEnabled && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="color"
                            value={selectedProps.shadowColor?.replace(/rgba?\([^)]+\)/,'#000000') ?? '#000000'}
                            onChange={e => updateSelected({ shadowColor: e.target.value })}
                            className="w-8 h-6 rounded cursor-pointer shrink-0"
                          />
                          <span className="text-gray-400 text-[10px]">색상</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          <div>
                            <span className="block text-[10px] text-gray-400 mb-0.5">X</span>
                            <input type="number" value={selectedProps.shadowOffsetX ?? 4} step={1}
                              onChange={e => updateSelected({ shadowOffsetX: parseFloat(e.target.value) })}
                              className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs" />
                          </div>
                          <div>
                            <span className="block text-[10px] text-gray-400 mb-0.5">Y</span>
                            <input type="number" value={selectedProps.shadowOffsetY ?? 4} step={1}
                              onChange={e => updateSelected({ shadowOffsetY: parseFloat(e.target.value) })}
                              className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs" />
                          </div>
                          <div>
                            <span className="block text-[10px] text-gray-400 mb-0.5">Blur</span>
                            <input type="number" value={selectedProps.shadowBlur ?? 6} step={1} min={0}
                              onChange={e => updateSelected({ shadowBlur: parseFloat(e.target.value) })}
                              className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs" />
                          </div>
                        </div>
                      </div>
                    )}
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
                      value={selectedProps.fillColor ?? '#e5e7eb'}
                      onChange={e => updateSelected({ fillColor: e.target.value })}
                      className="w-full h-8 rounded cursor-pointer"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="block text-gray-500 mb-1">테두리 색상</label>
                      <input
                        type="color"
                        value={selectedProps.strokeColor ?? '#000000'}
                        onChange={e => updateSelected({ strokeColor: e.target.value })}
                        className="w-full h-8 rounded cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-500 mb-1">테두리 두께</label>
                      <input
                        type="number"
                        value={selectedProps.strokeWidth ?? 0}
                        step={0.5} min={0}
                        onChange={e => updateSelected({ strokeWidth: parseFloat(e.target.value) })}
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                </>
              )}

              <button
                onClick={deleteSelectedLayer}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-red-200 py-2 text-xs text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-3.5 h-3.5" /> 레이어 삭제
              </button>
            </div>
          )}

          {activePanel === 'properties' && !selectedProps && (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-xs">
              레이어를 선택하세요
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
