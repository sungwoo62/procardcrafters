'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Type, Square, ImageIcon, Layers, Trash2,
  ChevronUp, ChevronDown, Eye, EyeOff, Lock, Unlock,
  Download, ShoppingCart, Bold, Italic, AlignLeft,
  AlignCenter, AlignRight, ArrowLeft, Plus, LayoutTemplate,
  RotateCcw, RotateCw, RefreshCw, Crop, Star, Circle, Triangle,
  FileText, Save, FolderOpen, QrCode, ShieldCheck, CopyPlus,
  AlertTriangle, CheckCircle, XCircle, FlipHorizontal2,
} from 'lucide-react'
import type { PrintProduct, PrintProductOption } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

type LayerType = 'text' | 'image' | 'rect'

interface SavedDesign {
  id: string
  name: string
  productSlug: string
  frontJson: string
  backJson: string | null
  thumbnail: string
  savedAt: string
}

interface PreflightResult {
  level: 'ok' | 'warn' | 'error'
  message: string
}

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

interface FieldDef {
  key: string
  label: string
  placeholder: string
  type: 'text' | 'multiline' | 'email' | 'phone'
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
  // image
  opacity?: number
  brightness?: number
  contrast?: number
  saturation?: number
  grayscale?: boolean
  blendMode?: string
  hasCrop?: boolean
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

// ─── Required fields per product ──────────────────────────────────────────────
// 제품별 필수 입력 필드. 사용자가 입력하면 캔버스의 data.fieldKey가 일치하는
// Textbox에 즉시 반영된다. 빈 캔버스에서는 신규 텍스트 박스가 자동 생성된다.

const REQUIRED_FIELDS: Record<string, FieldDef[]> = {
  business_cards: [
    { key: 'name',    label: '이름 (Name)',      placeholder: '홍길동',              type: 'text' },
    { key: 'title',   label: '직책 (Title)',     placeholder: '대리',                type: 'text' },
    { key: 'company', label: '회사 (Company)',   placeholder: '회사명',              type: 'text' },
    { key: 'phone',   label: '전화 (Phone)',     placeholder: '010-1234-5678',       type: 'phone' },
    { key: 'email',   label: '이메일 (Email)',   placeholder: 'name@company.com',    type: 'email' },
  ],
  premium_business_cards: [
    { key: 'name',    label: '이름 (Name)',      placeholder: '홍길동',              type: 'text' },
    { key: 'title',   label: '직책 (Title)',     placeholder: '대리',                type: 'text' },
    { key: 'company', label: '회사 (Company)',   placeholder: '회사명',              type: 'text' },
    { key: 'phone',   label: '전화 (Phone)',     placeholder: '010-1234-5678',       type: 'phone' },
    { key: 'email',   label: '이메일 (Email)',   placeholder: 'name@company.com',    type: 'email' },
  ],
  stickers: [
    { key: 'headline', label: '메인 문구 (Headline)', placeholder: '오픈 기념 50% 할인', type: 'text' },
    { key: 'sub',      label: '서브 문구 (Sub)',     placeholder: '오늘부터 5월 30일까지', type: 'text' },
  ],
  die_cut_stickers: [
    { key: 'headline', label: '메인 문구 (Headline)', placeholder: '오픈 기념 50% 할인', type: 'text' },
    { key: 'sub',      label: '서브 문구 (Sub)',     placeholder: '오늘부터 5월 30일까지', type: 'text' },
  ],
  flyers: [
    { key: 'headline', label: '헤드라인 (Headline)', placeholder: '이번 주 50% 할인',   type: 'text' },
    { key: 'body',     label: '본문 (Body)',        placeholder: '할인 상세 내용...',   type: 'multiline' },
    { key: 'cta',      label: 'CTA',                placeholder: '지금 방문하기',       type: 'text' },
    { key: 'contact',  label: '연락처 (Contact)',   placeholder: '전화 / 주소',         type: 'multiline' },
  ],
  brochures: [
    { key: 'company',  label: '회사명 (Company)',   placeholder: '회사명',              type: 'text' },
    { key: 'tagline',  label: '슬로건 (Tagline)',   placeholder: '한 줄 슬로건',         type: 'text' },
    { key: 'body',     label: '본문 (Body)',        placeholder: '소개 본문...',        type: 'multiline' },
    { key: 'contact',  label: '연락처 (Contact)',   placeholder: '전화 / 이메일 / 웹사이트', type: 'multiline' },
  ],
  postcards: [
    { key: 'greeting', label: '인사말 (Greeting)',  placeholder: '안녕하세요',          type: 'text' },
    { key: 'body',     label: '본문 (Body)',        placeholder: '메시지 내용...',      type: 'multiline' },
    { key: 'signature',label: '서명 (Signature)',   placeholder: '드림',                type: 'text' },
  ],
  posters: [
    { key: 'headline', label: '메인 헤드라인 (Headline)', placeholder: '큰 글씨 한 줄',  type: 'text' },
    { key: 'sub',      label: '서브타이틀 (Sub)',         placeholder: '부가 설명',      type: 'text' },
    { key: 'body',     label: '본문 (Body)',             placeholder: '세부 정보...',   type: 'multiline' },
    { key: 'date',     label: '날짜/장소 (Date/Place)',   placeholder: '2026.06.01 · 서울', type: 'text' },
  ],
  banners: [
    { key: 'headline', label: '메인 문구 (Headline)',     placeholder: 'GRAND OPEN',     type: 'text' },
    { key: 'sub',      label: '서브 문구 (Sub)',          placeholder: '5월 30일',       type: 'text' },
    { key: 'contact',  label: '연락처 (Contact)',         placeholder: '02-1234-5678',   type: 'text' },
  ],
}

const DEFAULT_REQUIRED_FIELDS: FieldDef[] = REQUIRED_FIELDS.business_cards

const MAX_CANVAS_W = 620
const MAX_CANVAS_H = 520
const SNAP_THRESHOLD_MM = 2

// ─── Font catalog ────────────────────────────────────────────────────────────

interface FontEntry {
  name: string
  google?: boolean  // dynamically loaded from Google Fonts
  category: 'sans' | 'serif' | 'display' | 'system'
}

const FONT_CATALOG: FontEntry[] = [
  // ── Sans-Serif
  { name: 'Roboto',            google: true,  category: 'sans' },
  { name: 'Open Sans',         google: true,  category: 'sans' },
  { name: 'Lato',              google: true,  category: 'sans' },
  { name: 'Montserrat',        google: true,  category: 'sans' },
  { name: 'Poppins',           google: true,  category: 'sans' },
  { name: 'Inter',             google: true,  category: 'sans' },
  { name: 'Nunito',            google: true,  category: 'sans' },
  { name: 'Raleway',           google: true,  category: 'sans' },
  // ── Serif
  { name: 'Playfair Display',  google: true,  category: 'serif' },
  { name: 'Merriweather',      google: true,  category: 'serif' },
  { name: 'Lora',              google: true,  category: 'serif' },
  { name: 'EB Garamond',       google: true,  category: 'serif' },
  // ── Display / Decorative
  { name: 'Oswald',            google: true,  category: 'display' },
  { name: 'Bebas Neue',        google: true,  category: 'display' },
  { name: 'Pacifico',          google: true,  category: 'display' },
  { name: 'Righteous',         google: true,  category: 'display' },
  // ── System fonts (always available)
  { name: 'Arial',             category: 'system' },
  { name: 'Georgia',           category: 'system' },
  { name: 'Helvetica',         category: 'system' },
  { name: 'Times New Roman',   category: 'system' },
  { name: 'Courier New',       category: 'system' },
  { name: 'Impact',            category: 'system' },
]

const FONT_CATEGORY_LABELS: Record<FontEntry['category'], string> = {
  sans:    'Sans-Serif',
  serif:   'Serif',
  display: 'Display',
  system:  'System',
}

// ─── Template catalog ─────────────────────────────────────────────────────────

type TemplateCategory = 'business' | 'minimal' | 'creative' | 'food' | 'health' | 'tech' | 'realestate' | 'sticker' | 'postcard'

interface TemplateDef {
  name: string
  category: TemplateCategory
  bg: string
  description: string
  products?: string[]
}

const BC = ['business_cards', 'premium_business_cards']
const ST = ['stickers']
const DC = ['die_cut_stickers']
const PC = ['postcards']

const TEMPLATE_CATALOG: TemplateDef[] = [
  // ── Business / Professional (명함)
  { name: 'Classic',            category: 'business',    bg: '#ffffff', description: 'Traditional layout',       products: BC },
  { name: 'Corporate',          category: 'business',    bg: '#0f172a', description: 'Dark professional',        products: BC },
  { name: 'Executive',          category: 'business',    bg: '#ffffff', description: 'Elegant & formal',         products: BC },
  { name: 'Law Firm',           category: 'business',    bg: '#1c2a40', description: 'Dark navy, gold serif',    products: BC },
  { name: 'Consultant',         category: 'business',    bg: '#ffffff', description: 'Clean blue accent',        products: BC },
  { name: 'Finance',            category: 'business',    bg: '#0d1b2a', description: 'Midnight, gold stripe',    products: BC },
  // ── Minimal (명함)
  { name: 'Blank',              category: 'minimal',     bg: '#ffffff', description: 'Start from scratch',       products: BC },
  { name: 'Minimal',            category: 'minimal',     bg: '#ffffff', description: 'Clean & simple',           products: BC },
  { name: 'Dark',               category: 'minimal',     bg: '#1a1a1a', description: 'Dark with accent',         products: BC },
  { name: 'Mono',               category: 'minimal',     bg: '#f5f5f5', description: 'Pure monochrome',          products: BC },
  // ── Creative (명함)
  { name: 'Bold',               category: 'creative',    bg: '#4f46e5', description: 'Vibrant accent',           products: BC },
  { name: 'Creative',           category: 'creative',    bg: '#fef3c7', description: 'Warm tone',                products: BC },
  { name: 'Photographer',       category: 'creative',    bg: '#111111', description: 'Dark portfolio',           products: BC },
  { name: 'Artist',             category: 'creative',    bg: '#ffffff', description: 'Gallery white',            products: BC },
  // ── Food & Hospitality (명함)
  { name: 'Restaurant',         category: 'food',        bg: '#7b1d1d', description: 'Warm deep red',            products: BC },
  { name: 'Cafe',               category: 'food',        bg: '#3b1f0a', description: 'Coffee & cream',           products: BC },
  { name: 'Bakery',             category: 'food',        bg: '#fdf6e3', description: 'Soft warm beige',          products: BC },
  // ── Health & Wellness (명함)
  { name: 'Medical',            category: 'health',      bg: '#f0f9ff', description: 'Clean clinical blue',      products: BC },
  { name: 'Fitness',            category: 'health',      bg: '#0f172a', description: 'Bold energy orange',       products: BC },
  { name: 'Beauty Spa',         category: 'health',      bg: '#fff1f2', description: 'Soft rose & gold',         products: BC },
  // ── Technology (명함)
  { name: 'Tech Startup',       category: 'tech',        bg: '#0f0f23', description: 'Dark gradient purple',     products: BC },
  { name: 'Developer',          category: 'tech',        bg: '#0d1117', description: 'Terminal dark',            products: BC },
  // ── Real Estate & Architecture (명함)
  { name: 'Realtor',            category: 'realestate',  bg: '#ffffff', description: 'Gold prestige',            products: BC },
  { name: 'Architect',          category: 'realestate',  bg: '#f8f8f8', description: 'Minimal grid lines',       products: BC },

  // ══ 신규 명함 +20 ════════════════════════════════════════════════════════════
  // ── Business +5
  { name: 'Event Planner',      category: 'business',    bg: '#2d1b69', description: 'Deep purple & gold',       products: BC },
  { name: 'Travel Agent',       category: 'business',    bg: '#0c4a6e', description: 'Sky blue horizon',         products: BC },
  { name: 'Investment Advisor', category: 'business',    bg: '#0a1628', description: 'Navy & gold premium',      products: BC },
  { name: 'Marketing Agency',   category: 'business',    bg: '#ffffff', description: 'Bold red accent',          products: BC },
  { name: 'Language School',    category: 'business',    bg: '#fefce8', description: 'Bright & academic',        products: BC },
  // ── Minimal +1
  { name: 'Editorial',          category: 'minimal',     bg: '#fafafa', description: 'Magazine-style serif',     products: BC },
  // ── Creative +4
  { name: 'Photographer Studio',category: 'creative',    bg: '#0a0a0a', description: 'Full-dark studio v2',      products: BC },
  { name: 'Freelance Writer',   category: 'creative',    bg: '#fffbf5', description: 'Warm editorial',           products: BC },
  { name: 'Music Teacher',      category: 'creative',    bg: '#1a0535', description: 'Deep violet music',        products: BC },
  { name: 'Interior Designer',  category: 'creative',    bg: '#f5ede0', description: 'Warm minimal terracotta',  products: BC },
  // ── Health +5
  { name: 'Wellness Card',      category: 'health',      bg: '#f0fdf4', description: 'Soft green natural',       products: BC },
  { name: 'Yoga Instructor',    category: 'health',      bg: '#fdf4ff', description: 'Calm lavender',            products: BC },
  { name: 'Nutritionist',       category: 'health',      bg: '#f0fdf4', description: 'Fresh green health',       products: BC },
  { name: 'Dental Clinic',      category: 'health',      bg: '#f0f9ff', description: 'Clinical mint & white',    products: BC },
  { name: 'Pet Veterinarian',   category: 'health',      bg: '#fefce8', description: 'Friendly warm yellow',     products: BC },
  // ── Tech +3
  { name: 'Product Designer',   category: 'tech',        bg: '#0f172a', description: 'Dark design tool',         products: BC },
  { name: 'Startup Founder',    category: 'tech',        bg: '#020617', description: 'Pitch-dark gradient',      products: BC },
  { name: 'Software Engineer',  category: 'tech',        bg: '#111827', description: 'Code slate dark',          products: BC },
  // ── Real Estate +2
  { name: 'Real Estate v2',     category: 'realestate',  bg: '#1e293b', description: 'Dark slate prestige',      products: BC },
  { name: 'Tutor',              category: 'minimal',     bg: '#ffffff', description: 'Clean academic white',      products: BC },

  // ══ 스티커 10 (70×70mm) ══════════════════════════════════════════════════════
  { name: 'Logo Round',         category: 'sticker',     bg: '#ffffff', description: '원형 로고 스티커',            products: ST },
  { name: 'Quote Square',       category: 'sticker',     bg: '#fef9c3', description: '인용구 사각 스티커',          products: ST },
  { name: 'Brand Badge',        category: 'sticker',     bg: '#1e293b', description: '브랜드 배지 다크',            products: ST },
  { name: 'Event Promo',        category: 'sticker',     bg: '#dc2626', description: '이벤트 홍보 스티커',          products: ST },
  { name: 'Caution Label',      category: 'sticker',     bg: '#fbbf24', description: '주의 경고 라벨',              products: ST },
  { name: 'Thank You',          category: 'sticker',     bg: '#fdf2f8', description: '감사 선물 스티커',            products: ST },
  { name: 'Handmade',           category: 'sticker',     bg: '#fefce8', description: '수공예 핸드메이드',           products: ST },
  { name: 'Open Sign',          category: 'sticker',     bg: '#16a34a', description: '오픈 안내 스티커',            products: ST },
  { name: 'Sale Badge',         category: 'sticker',     bg: '#7c3aed', description: '할인 세일 배지',              products: ST },
  { name: 'Minimal Label',      category: 'sticker',     bg: '#f8fafc', description: '미니멀 라벨 흰색',            products: ST },

  // ══ 도무송 스티커 8 (70×70mm, 비정형 컷) ════════════════════════════════════
  { name: 'Circle Logo',        category: 'sticker',     bg: '#ffffff', description: '원형 도무송 — safe zone',    products: DC },
  { name: 'Heart Love',         category: 'sticker',     bg: '#fdf2f8', description: '하트 도무송 스티커',          products: DC },
  { name: 'Star Badge',         category: 'sticker',     bg: '#fef9c3', description: '별 모양 도무송',              products: DC },
  { name: 'Speech Bubble',      category: 'sticker',     bg: '#eff6ff', description: '말풍선 도무송',               products: DC },
  { name: 'Icon Text Round',    category: 'sticker',     bg: '#f0fdf4', description: '아이콘+텍스트 원형',          products: DC },
  { name: 'Vintage Stamp',      category: 'sticker',     bg: '#fdf6e3', description: '빈티지 원형 스탬프',          products: DC },
  { name: 'Character Card',     category: 'sticker',     bg: '#faf5ff', description: '캐릭터 카드 도무송',          products: DC },
  { name: 'Hexagon Label',      category: 'sticker',     bg: '#f0f9ff', description: '헥사곤 라벨 도무송',          products: DC },

  // ══ 엽서 10 (152×102mm 가로) ════════════════════════════════════════════════
  { name: 'Greeting Card',      category: 'postcard',    bg: '#fff7ed', description: '따뜻한 인사 엽서',            products: PC },
  { name: 'Invitation',         category: 'postcard',    bg: '#1e1b4b', description: '이벤트 초대장',               products: PC },
  { name: 'Thank You Note',     category: 'postcard',    bg: '#fdf2f8', description: '감사 메시지 엽서',            products: PC },
  { name: 'Business Postcard',  category: 'postcard',    bg: '#0f172a', description: '비즈니스 안내 엽서',          products: PC },
  { name: 'Event Invite',       category: 'postcard',    bg: '#7c3aed', description: '파티·이벤트 초대',            products: PC },
  { name: 'Holiday Card',       category: 'postcard',    bg: '#14532d', description: '시즌 인사 카드',              products: PC },
  { name: 'Product Launch',     category: 'postcard',    bg: '#0c4a6e', description: '신제품 출시 프로모션',         products: PC },
  { name: 'Welcome Card',       category: 'postcard',    bg: '#f0fdf4', description: '환영 온보딩 카드',            products: PC },
  { name: 'Farewell Card',      category: 'postcard',    bg: '#fafafa', description: '작별 인사 카드',              products: PC },
  { name: 'Congrats Card',      category: 'postcard',    bg: '#fefce8', description: '축하 기념 엽서',              products: PC },
]

const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory | 'all', string> = {
  all:        'All',
  business:   'Business',
  minimal:    'Minimal',
  creative:   'Creative',
  food:       'Food',
  health:     'Health',
  tech:       'Tech',
  realestate: 'Real Estate',
  sticker:    'Sticker',
  postcard:   'Postcard',
}

const DESIGNS_STORAGE_KEY = 'procardcrafters_saved_designs'

// ─── Brand palette catalog ────────────────────────────────────────────────────

interface PaletteDef {
  name: string
  bg: string        // canvas background
  primary: string   // main headline color
  accent: string    // accent / shapes
  body: string      // secondary text
}

const PALETTE_CATALOG: PaletteDef[] = [
  { name: 'Classic Blue',    bg: '#ffffff', primary: '#1d4ed8', accent: '#3b82f6', body: '#374151' },
  { name: 'Midnight',        bg: '#0f172a', primary: '#ffffff', accent: '#6366f1', body: '#94a3b8' },
  { name: 'Forest Green',    bg: '#ffffff', primary: '#14532d', accent: '#16a34a', body: '#374151' },
  { name: 'Sunset Red',      bg: '#ffffff', primary: '#991b1b', accent: '#ef4444', body: '#374151' },
  { name: 'Rose Gold',       bg: '#fff1f2', primary: '#9d174d', accent: '#b8860b', body: '#881337' },
  { name: 'Ocean Teal',      bg: '#f0fdfa', primary: '#134e4a', accent: '#0d9488', body: '#374151' },
  { name: 'Monochrome',      bg: '#f5f5f5', primary: '#1a1a1a', accent: '#555555', body: '#777777' },
  { name: 'Purple Haze',     bg: '#faf5ff', primary: '#4c1d95', accent: '#7c3aed', body: '#6b7280' },
  { name: 'Warm Earth',      bg: '#fdf6e3', primary: '#3b1f0a', accent: '#d4956a', body: '#8b6347' },
  { name: 'Neon Night',      bg: '#0d1117', primary: '#f0f6fc', accent: '#3fb950', body: '#6e7681' },
  { name: 'Coral Pink',      bg: '#ffffff', primary: '#9d174d', accent: '#f97316', body: '#6b7280' },
  { name: 'Sky Lavender',    bg: '#f8fafc', primary: '#1e40af', accent: '#818cf8', body: '#64748b' },
]

// ─── Finish (paper/coating) options ──────────────────────────────────────────

interface FinishOption {
  value: string
  label: string
  priceMultiplier: number
}

const FINISH_OPTIONS: FinishOption[] = [
  { value: 'standard',  label: '일반지 (Standard)',   priceMultiplier: 1.0 },
  { value: 'premium',   label: '고급지 (Premium)',    priceMultiplier: 1.3 },
  { value: 'gloss',     label: '유광 (Gloss)',        priceMultiplier: 1.2 },
  { value: 'matte',     label: '무광 (Matte)',        priceMultiplier: 1.25 },
  { value: 'spot_uv',   label: 'Spot UV',             priceMultiplier: 1.6 },
]

// ─── Blend modes ─────────────────────────────────────────────────────────────

const BLEND_MODES: { value: string; label: string }[] = [
  { value: 'source-over', label: 'Normal' },
  { value: 'multiply',    label: 'Multiply' },
  { value: 'screen',      label: 'Screen' },
  { value: 'overlay',     label: 'Overlay' },
  { value: 'darken',      label: 'Darken' },
  { value: 'lighten',     label: 'Lighten' },
  { value: 'color-dodge', label: 'Color Dodge' },
  { value: 'color-burn',  label: 'Color Burn' },
  { value: 'hard-light',  label: 'Hard Light' },
  { value: 'soft-light',  label: 'Soft Light' },
  { value: 'difference',  label: 'Difference' },
  { value: 'exclusion',   label: 'Exclusion' },
]

// ─── Shape presets ────────────────────────────────────────────────────────────

type ShapeKind = 'rect' | 'circle' | 'triangle' | 'path'

interface ShapePreset {
  name: string
  icon: React.ReactNode
  kind: ShapeKind
  path?: string
}

const SHAPE_PRESETS: ShapePreset[] = [
  { name: 'Rectangle', icon: <Square className="w-4 h-4" />,   kind: 'rect' },
  { name: 'Circle',    icon: <Circle className="w-4 h-4" />,   kind: 'circle' },
  { name: 'Triangle',  icon: <Triangle className="w-4 h-4" />, kind: 'triangle' },
  { name: 'Star',      icon: <Star className="w-4 h-4" />,     kind: 'path',
    path: 'M 50 5 L 61 35 L 95 35 L 68 57 L 79 91 L 50 70 L 21 91 L 32 57 L 5 35 L 39 35 Z' },
  { name: 'Heart',     icon: <span className="text-sm">♥</span>, kind: 'path',
    path: 'M 50 85 C 10 55 0 35 20 20 C 35 10 45 20 50 30 C 55 20 65 10 80 20 C 100 35 90 55 50 85 Z' },
  { name: 'Diamond',   icon: <span className="text-sm">◆</span>, kind: 'path',
    path: 'M 50 5 L 95 50 L 50 95 L 5 50 Z' },
  { name: 'Arrow →',   icon: <span className="text-sm">→</span>, kind: 'path',
    path: 'M 5 38 L 65 38 L 65 20 L 95 50 L 65 80 L 65 62 L 5 62 Z' },
  { name: 'Hexagon',   icon: <span className="text-sm">⬡</span>, kind: 'path',
    path: 'M 25 8 L 75 8 L 95 43 L 75 78 L 25 78 L 5 43 Z' },
]

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

const BACKGROUND_ROLES = new Set(['bleed-bg', 'trim-bg', 'trim-border', 'guide'])

function isBackground(obj: { data?: { role?: string } }) {
  return BACKGROUND_ROLES.has(obj.data?.role ?? '')
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
  const [activePanel, setActivePanel] = useState<'layers' | 'templates' | 'shapes' | 'properties' | 'contact' | 'fields'>('fields')
  const productFields = REQUIRED_FIELDS[product.category] ?? DEFAULT_REQUIRED_FIELDS
  const [bgColor, setBgColor] = useState('#ffffff')
  const [ordering, setOrdering] = useState(false)
  const [orderError, setOrderError] = useState('')
  const [cropActive, setCropActive] = useState(false)
  const cropTargetIdRef = useRef<string | null>(null)
  const cropRectIdRef = useRef<string | null>(null)

  // Phase 5: Front/Back
  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front')
  const frontJsonRef = useRef<string | null>(null)
  const backJsonRef = useRef<string | null>(null)

  // Phase 6: Bleed / QR / Preflight
  const [showBleed, setShowBleed] = useState(true)
  const [qrUrl, setQrUrl] = useState('')
  const [showPreflight, setShowPreflight] = useState(false)
  const [preflightResults, setPreflightResults] = useState<PreflightResult[]>([])
  const [templateCategory, setTemplateCategory] = useState<TemplateCategory | 'all'>('all')
  const [templateSearch, setTemplateSearch] = useState('')

  // Phase B: Contact smart fields
  const [contactFields, setContactFields] = useState({
    name: '', title: '', company: '', phone: '', email: '', website: '', linkedin: '',
  })

  // 필수 필드 값 (product 별 REQUIRED_FIELDS 스키마 기반)
  const [requiredFieldValues, setRequiredFieldValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const f of productFields) init[f.key] = ''
    return init
  })

  // Phase C: Brand palette
  const [selectedPalette, setSelectedPalette] = useState<string | null>(null)

  // Phase D: Finish + logo
  const [finish, setFinish] = useState('standard')
  const logoInputRef = useRef<HTMLInputElement>(null)

  // Phase 4: Saved designs
  const [savedDesigns, setSavedDesigns] = useState<SavedDesign[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      return JSON.parse(localStorage.getItem(DESIGNS_STORAGE_KEY) ?? '[]')
    } catch { return [] }
  })
  const [saveDesignName, setSaveDesignName] = useState('')

  // Keep ref in sync with state for canvas event handlers
  useEffect(() => { toolRef.current = tool }, [tool])
  const bgColorRef = useRef(bgColor)
  useEffect(() => { bgColorRef.current = bgColor }, [bgColor])

  // ── Sync helpers ──────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function syncLayers(canvas: any) {
    const objs = canvas.getObjects().filter((o: { data?: { role?: string } }) => !isBackground(o) && o.data?.role !== 'crop')
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
    // Skip property panel update when the crop rect is selected (keep crop mode active)
    if (obj.data?.role === 'crop') return
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
      // text outline
      props.textStroke = typeof obj.stroke === 'string' && obj.stroke ? obj.stroke : '#000000'
      props.textStrokeWidth = obj.strokeWidth ?? 0
      // shadow
      const sh = obj.shadow
      props.shadowEnabled = !!sh
      props.shadowColor = sh?.color ?? 'rgba(0,0,0,0.5)'
      props.shadowOffsetX = sh?.offsetX ?? 4
      props.shadowOffsetY = sh?.offsetY ?? 4
      props.shadowBlur = sh?.blur ?? 6
    } else if (['rect', 'circle', 'triangle', 'path', 'polygon'].includes(objType)) {
      props.fillColor = typeof obj.fill === 'string' ? obj.fill : '#e5e7eb'
      props.strokeColor = typeof obj.stroke === 'string' ? obj.stroke : '#000000'
      props.strokeWidth = obj.strokeWidth ?? 0
    } else if (objType === 'image') {
      props.opacity = obj.opacity ?? 1
      props.blendMode = obj.globalCompositeOperation ?? 'source-over'
      props.hasCrop = !!obj.clipPath
      // Read filter values
      const filters: { type?: string; brightness?: number; contrast?: number; saturation?: number }[] = obj.filters ?? []
      const bFilter = filters.find((f) => f.type === 'Brightness' || (f as { constructor?: { name?: string } }).constructor?.name === 'Brightness')
      const cFilter = filters.find((f) => f.type === 'Contrast' || (f as { constructor?: { name?: string } }).constructor?.name === 'Contrast')
      const sFilter = filters.find((f) => f.type === 'Saturation' || (f as { constructor?: { name?: string } }).constructor?.name === 'Saturation')
      const gFilter = filters.find((f) => f.type === 'Grayscale' || (f as { constructor?: { name?: string } }).constructor?.name === 'Grayscale')
      props.brightness = bFilter?.brightness ?? 0
      props.contrast = cFilter?.contrast ?? 0
      props.saturation = sFilter?.saturation ?? 0
      props.grayscale = !!gFilter
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
        if (obj && !isBackground(obj) && obj.data?.role !== 'crop') {
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
        data: { id: makeId(), name: 'Name', layerType: 'text' , fieldKey: 'name' },
      })
      addTextbox(canvas, fabric, 'Senior Designer', bl + mmToPx(5, scale), bl + mmToPx(27, scale), mmToPx(65, scale), {
        fontSize: mmToPx(3.2, scale), fill: '#555555', textAlign: 'left',
        data: { id: makeId(), name: 'Title', layerType: 'text' , fieldKey: 'title' },
      })
      canvas.add(new fabric.Rect({
        left: bl + mmToPx(5, scale), top: bl + mmToPx(36, scale),
        width: mmToPx(45, scale), height: mmToPx(0.5, scale),
        fill: '#cccccc', data: { id: makeId(), name: 'Divider', layerType: 'rect' },
      }))
      addTextbox(canvas, fabric, 'email@company.com\n+1 (555) 000-0000', bl + mmToPx(5, scale), bl + mmToPx(40, scale), mmToPx(75, scale), {
        fontSize: mmToPx(2.8, scale), fill: '#444444', textAlign: 'left',
        data: { id: makeId(), name: 'Contact', layerType: 'text' , fieldKey: 'email' },
      })
    } else if (name === 'Minimal') {
      addTextbox(canvas, fabric, 'Your Name', bl + mmToPx(7.5, scale), bl + mmToPx(19, scale), mmToPx(70, scale), {
        fontSize: mmToPx(6, scale), fill: '#000000', textAlign: 'center', charSpacing: 200,
        data: { id: makeId(), name: 'Name', layerType: 'text' , fieldKey: 'name' },
      })
      addTextbox(canvas, fabric, 'Company · Title', bl + mmToPx(7.5, scale), bl + mmToPx(34, scale), mmToPx(70, scale), {
        fontSize: mmToPx(3, scale), fill: '#888888', textAlign: 'center', charSpacing: 100,
        data: { id: makeId(), name: 'Company', layerType: 'text' , fieldKey: 'company' },
      })
    } else if (name === 'Dark') {
      canvas.add(new fabric.Rect({
        left: bl, top: bl, width: mmToPx(4, scale), height: mmToPx(dims.heightMm, scale),
        fill: '#4f46e5', data: { id: makeId(), name: 'Accent Bar', layerType: 'rect' },
      }))
      addTextbox(canvas, fabric, 'Your Name', bl + mmToPx(10, scale), bl + mmToPx(14, scale), mmToPx(70, scale), {
        fontSize: mmToPx(5.5, scale), fontWeight: 'bold', fill: '#ffffff', textAlign: 'left',
        data: { id: makeId(), name: 'Name', layerType: 'text' , fieldKey: 'name' },
      })
      addTextbox(canvas, fabric, 'Title • Company', bl + mmToPx(10, scale), bl + mmToPx(27, scale), mmToPx(70, scale), {
        fontSize: mmToPx(3, scale), fill: '#a5b4fc', textAlign: 'left',
        data: { id: makeId(), name: 'Title', layerType: 'text' , fieldKey: 'title' },
      })
      addTextbox(canvas, fabric, 'email@company.com', bl + mmToPx(10, scale), bl + mmToPx(40, scale), mmToPx(70, scale), {
        fontSize: mmToPx(2.5, scale), fill: '#9ca3af', textAlign: 'left',
        data: { id: makeId(), name: 'Email', layerType: 'text' , fieldKey: 'email' },
      })
    } else if (name === 'Corporate') {
      // Dark header bar at top
      canvas.add(new fabric.Rect({
        left: bl, top: bl, width: mmToPx(dims.widthMm, scale), height: mmToPx(14, scale),
        fill: '#1e293b', data: { id: makeId(), name: 'Header', layerType: 'rect' },
      }))
      addTextbox(canvas, fabric, 'JANE SMITH', bl + mmToPx(5, scale), bl + mmToPx(3.5, scale), mmToPx(75, scale), {
        fontSize: mmToPx(4.5, scale), fontWeight: 'bold', fill: '#ffffff', charSpacing: 150,
        data: { id: makeId(), name: 'Name', layerType: 'text' , fieldKey: 'name' },
      })
      addTextbox(canvas, fabric, 'Product Director', bl + mmToPx(5, scale), bl + mmToPx(20, scale), mmToPx(60, scale), {
        fontSize: mmToPx(3.5, scale), fill: '#475569', fontFamily: 'Lato',
        data: { id: makeId(), name: 'Title', layerType: 'text' , fieldKey: 'title' },
      })
      addTextbox(canvas, fabric, 'jane@company.com  ·  linkedin.com/in/jane', bl + mmToPx(5, scale), bl + mmToPx(34, scale), mmToPx(75, scale), {
        fontSize: mmToPx(2.5, scale), fill: '#94a3b8',
        data: { id: makeId(), name: 'Contact', layerType: 'text' , fieldKey: 'email' },
      })
    } else if (name === 'Executive') {
      // Subtle border frame
      canvas.add(new fabric.Rect({
        left: bl + mmToPx(2, scale), top: bl + mmToPx(2, scale),
        width: mmToPx(dims.widthMm - 4, scale), height: mmToPx(dims.heightMm - 4, scale),
        fill: 'transparent', stroke: '#c0a060', strokeWidth: 1,
        data: { id: makeId(), name: 'Frame', layerType: 'rect' },
      }))
      addTextbox(canvas, fabric, 'Alexander Wright', bl + mmToPx(7.5, scale), bl + mmToPx(15, scale), mmToPx(70, scale), {
        fontSize: mmToPx(5, scale), fontFamily: 'Playfair Display', fill: '#1a1a1a', textAlign: 'center',
        data: { id: makeId(), name: 'Name', layerType: 'text' , fieldKey: 'name' },
      })
      addTextbox(canvas, fabric, '— Managing Partner —', bl + mmToPx(7.5, scale), bl + mmToPx(26, scale), mmToPx(70, scale), {
        fontSize: mmToPx(3, scale), fontFamily: 'EB Garamond', fill: '#c0a060', textAlign: 'center', charSpacing: 100,
        data: { id: makeId(), name: 'Title', layerType: 'text' , fieldKey: 'title' },
      })
      addTextbox(canvas, fabric, 'alex@firm.com', bl + mmToPx(7.5, scale), bl + mmToPx(37, scale), mmToPx(70, scale), {
        fontSize: mmToPx(2.8, scale), fontFamily: 'EB Garamond', fill: '#666666', textAlign: 'center',
        data: { id: makeId(), name: 'Email', layerType: 'text' , fieldKey: 'email' },
      })
    } else if (name === 'Bold') {
      // Bold colored left panel
      canvas.add(new fabric.Rect({
        left: bl, top: bl, width: mmToPx(28, scale), height: mmToPx(dims.heightMm, scale),
        fill: '#ffffff', opacity: 0.15, data: { id: makeId(), name: 'Panel', layerType: 'rect' },
      }))
      addTextbox(canvas, fabric, 'ALEX', bl + mmToPx(3, scale), bl + mmToPx(10, scale), mmToPx(22, scale), {
        fontSize: mmToPx(7, scale), fontWeight: 'bold', fill: '#ffffff', textAlign: 'center',
        data: { id: makeId(), name: 'First', layerType: 'text' , fieldKey: 'name' },
      })
      addTextbox(canvas, fabric, 'TURNER', bl + mmToPx(3, scale), bl + mmToPx(22, scale), mmToPx(22, scale), {
        fontSize: mmToPx(4, scale), fontWeight: 'bold', fill: '#ffffff', textAlign: 'center',
        data: { id: makeId(), name: 'Last', layerType: 'text' },
      })
      addTextbox(canvas, fabric, 'UX Designer', bl + mmToPx(32, scale), bl + mmToPx(12, scale), mmToPx(50, scale), {
        fontSize: mmToPx(4, scale), fontWeight: 'bold', fill: '#ffffff',
        data: { id: makeId(), name: 'Title', layerType: 'text' , fieldKey: 'title' },
      })
      addTextbox(canvas, fabric, 'hello@alexturner.io\n+1 (415) 000-1234', bl + mmToPx(32, scale), bl + mmToPx(27, scale), mmToPx(50, scale), {
        fontSize: mmToPx(2.8, scale), fill: 'rgba(255,255,255,0.8)',
        data: { id: makeId(), name: 'Contact', layerType: 'text' , fieldKey: 'email' },
      })
    } else if (name === 'Creative') {
      // Warm creative style
      canvas.add(new fabric.Rect({
        left: bl, top: bl + mmToPx(dims.heightMm - 10, scale), width: mmToPx(dims.widthMm, scale), height: mmToPx(10, scale),
        fill: '#f59e0b', data: { id: makeId(), name: 'Footer Bar', layerType: 'rect' },
      }))
      addTextbox(canvas, fabric, 'CREATIVE', bl + mmToPx(5, scale), bl + mmToPx(8, scale), mmToPx(75, scale), {
        fontSize: mmToPx(8, scale), fontWeight: 'bold', fill: '#92400e', charSpacing: 300,
        data: { id: makeId(), name: 'Tag', layerType: 'text' },
      })
      addTextbox(canvas, fabric, 'Sam Rivera', bl + mmToPx(5, scale), bl + mmToPx(22, scale), mmToPx(70, scale), {
        fontSize: mmToPx(5, scale), fontFamily: 'Pacifico', fill: '#1c1917',
        data: { id: makeId(), name: 'Name', layerType: 'text' , fieldKey: 'name' },
      })
      addTextbox(canvas, fabric, 'Art Director & Illustrator', bl + mmToPx(5, scale), bl + mmToPx(32, scale), mmToPx(70, scale), {
        fontSize: mmToPx(3, scale), fontFamily: 'Poppins', fill: '#57534e',
        data: { id: makeId(), name: 'Title', layerType: 'text' , fieldKey: 'title' },
      })

    // ── New templates ─────────────────────────────────────────────────────

    } else if (name === 'Law Firm') {
      // Dark navy + gold serif — legal professional
      canvas.add(new fabric.Rect({
        left: bl + mmToPx(dims.widthMm - 6, scale), top: bl,
        width: mmToPx(6, scale), height: mmToPx(dims.heightMm, scale),
        fill: '#b8860b', data: { id: makeId(), name: 'Gold Bar', layerType: 'rect' },
      }))
      addTextbox(canvas, fabric, 'MORRISON & ASSOCIATES', bl + mmToPx(5, scale), bl + mmToPx(10, scale), mmToPx(68, scale), {
        fontSize: mmToPx(3.5, scale), fontWeight: 'bold', fontFamily: 'Playfair Display',
        fill: '#d4af6e', charSpacing: 120,
        data: { id: makeId(), name: 'Firm', layerType: 'text' , fieldKey: 'company' },
      })
      canvas.add(new fabric.Rect({
        left: bl + mmToPx(5, scale), top: bl + mmToPx(21, scale),
        width: mmToPx(55, scale), height: mmToPx(0.4, scale),
        fill: '#b8860b', data: { id: makeId(), name: 'Divider', layerType: 'rect' },
      }))
      addTextbox(canvas, fabric, 'Richard Morrison', bl + mmToPx(5, scale), bl + mmToPx(24, scale), mmToPx(70, scale), {
        fontSize: mmToPx(5, scale), fontFamily: 'Playfair Display', fill: '#f5f0e0',
        data: { id: makeId(), name: 'Name', layerType: 'text' , fieldKey: 'name' },
      })
      addTextbox(canvas, fabric, 'Senior Partner', bl + mmToPx(5, scale), bl + mmToPx(34, scale), mmToPx(65, scale), {
        fontSize: mmToPx(3, scale), fill: '#b8860b', fontFamily: 'Lato',
        data: { id: makeId(), name: 'Title', layerType: 'text' , fieldKey: 'title' },
      })
      addTextbox(canvas, fabric, 'r.morrison@morrlaw.com  ·  +1 (212) 000-1234', bl + mmToPx(5, scale), bl + mmToPx(43, scale), mmToPx(70, scale), {
        fontSize: mmToPx(2.4, scale), fill: '#9e9e8e',
        data: { id: makeId(), name: 'Contact', layerType: 'text' , fieldKey: 'email' },
      })

    } else if (name === 'Consultant') {
      // Clean white with navy-blue top accent
      canvas.add(new fabric.Rect({
        left: bl, top: bl, width: mmToPx(dims.widthMm, scale), height: mmToPx(2, scale),
        fill: '#1d4ed8', data: { id: makeId(), name: 'Top Bar', layerType: 'rect' },
      }))
      addTextbox(canvas, fabric, 'David Chen', bl + mmToPx(5, scale), bl + mmToPx(10, scale), mmToPx(70, scale), {
        fontSize: mmToPx(6, scale), fontWeight: 'bold', fontFamily: 'Montserrat', fill: '#1e293b',
        data: { id: makeId(), name: 'Name', layerType: 'text' , fieldKey: 'name' },
      })
      addTextbox(canvas, fabric, 'Management Consultant', bl + mmToPx(5, scale), bl + mmToPx(23, scale), mmToPx(70, scale), {
        fontSize: mmToPx(3.2, scale), fill: '#1d4ed8', fontFamily: 'Montserrat',
        data: { id: makeId(), name: 'Title', layerType: 'text' , fieldKey: 'title' },
      })
      canvas.add(new fabric.Rect({
        left: bl + mmToPx(5, scale), top: bl + mmToPx(32, scale),
        width: mmToPx(50, scale), height: mmToPx(0.5, scale),
        fill: '#e2e8f0', data: { id: makeId(), name: 'Divider', layerType: 'rect' },
      }))
      addTextbox(canvas, fabric, 'david.chen@firmname.com\n+1 (650) 000-5678', bl + mmToPx(5, scale), bl + mmToPx(36, scale), mmToPx(70, scale), {
        fontSize: mmToPx(2.8, scale), fill: '#64748b',
        data: { id: makeId(), name: 'Contact', layerType: 'text' , fieldKey: 'email' },
      })

    } else if (name === 'Finance') {
      // Midnight blue with gold stripe
      canvas.add(new fabric.Rect({
        left: bl, top: bl, width: mmToPx(dims.widthMm, scale), height: mmToPx(1.5, scale),
        fill: '#b8860b', data: { id: makeId(), name: 'Top Gold', layerType: 'rect' },
      }))
      canvas.add(new fabric.Rect({
        left: bl, top: bl + mmToPx(dims.heightMm - 1.5, scale), width: mmToPx(dims.widthMm, scale), height: mmToPx(1.5, scale),
        fill: '#b8860b', data: { id: makeId(), name: 'Bottom Gold', layerType: 'rect' },
      }))
      addTextbox(canvas, fabric, 'APEX CAPITAL', bl + mmToPx(5, scale), bl + mmToPx(8, scale), mmToPx(75, scale), {
        fontSize: mmToPx(3.5, scale), fontWeight: 'bold', fill: '#d4af6e', charSpacing: 200,
        data: { id: makeId(), name: 'Company', layerType: 'text' , fieldKey: 'company' },
      })
      addTextbox(canvas, fabric, 'Elena Voss', bl + mmToPx(5, scale), bl + mmToPx(20, scale), mmToPx(70, scale), {
        fontSize: mmToPx(5.5, scale), fontFamily: 'Playfair Display', fill: '#ffffff',
        data: { id: makeId(), name: 'Name', layerType: 'text' , fieldKey: 'name' },
      })
      addTextbox(canvas, fabric, 'Private Wealth Manager', bl + mmToPx(5, scale), bl + mmToPx(31, scale), mmToPx(70, scale), {
        fontSize: mmToPx(3, scale), fill: '#94a3b8',
        data: { id: makeId(), name: 'Title', layerType: 'text' , fieldKey: 'title' },
      })
      addTextbox(canvas, fabric, 'e.voss@apexcap.com  ·  +44 20 0000 1234', bl + mmToPx(5, scale), bl + mmToPx(40, scale), mmToPx(70, scale), {
        fontSize: mmToPx(2.4, scale), fill: '#64748b',
        data: { id: makeId(), name: 'Contact', layerType: 'text' , fieldKey: 'email' },
      })

    } else if (name === 'Mono') {
      // Pure monochrome minimal
      canvas.add(new fabric.Rect({
        left: bl, top: bl, width: mmToPx(dims.widthMm, scale), height: mmToPx(dims.heightMm, scale),
        fill: '#f5f5f5', data: { id: makeId(), name: 'BG', layerType: 'rect' },
      }))
      addTextbox(canvas, fabric, 'YOUR NAME', bl + mmToPx(5, scale), bl + mmToPx(16, scale), mmToPx(75, scale), {
        fontSize: mmToPx(5.5, scale), fontWeight: 'bold', fontFamily: 'Montserrat',
        fill: '#1a1a1a', charSpacing: 200,
        data: { id: makeId(), name: 'Name', layerType: 'text' , fieldKey: 'name' },
      })
      canvas.add(new fabric.Rect({
        left: bl + mmToPx(5, scale), top: bl + mmToPx(28, scale),
        width: mmToPx(40, scale), height: mmToPx(0.5, scale),
        fill: '#1a1a1a', data: { id: makeId(), name: 'Line', layerType: 'rect' },
      }))
      addTextbox(canvas, fabric, 'Title  ·  Company', bl + mmToPx(5, scale), bl + mmToPx(32, scale), mmToPx(70, scale), {
        fontSize: mmToPx(3, scale), fill: '#666666', charSpacing: 100,
        data: { id: makeId(), name: 'Role', layerType: 'text' , fieldKey: 'title' },
      })
      addTextbox(canvas, fabric, 'email@company.com', bl + mmToPx(5, scale), bl + mmToPx(42, scale), mmToPx(70, scale), {
        fontSize: mmToPx(2.8, scale), fill: '#888888',
        data: { id: makeId(), name: 'Contact', layerType: 'text' , fieldKey: 'email' },
      })

    } else if (name === 'Photographer') {
      // Dark portfolio — B&W bold
      canvas.add(new fabric.Rect({
        left: bl, top: bl + mmToPx(dims.heightMm - 16, scale),
        width: mmToPx(dims.widthMm, scale), height: mmToPx(16, scale),
        fill: '#ffffff', data: { id: makeId(), name: 'Bottom Light', layerType: 'rect' },
      }))
      addTextbox(canvas, fabric, 'STUDIO', bl + mmToPx(5, scale), bl + mmToPx(8, scale), mmToPx(70, scale), {
        fontSize: mmToPx(3, scale), fill: '#888888', charSpacing: 400, fontFamily: 'Montserrat',
        data: { id: makeId(), name: 'Label', layerType: 'text' },
      })
      addTextbox(canvas, fabric, 'Oliver Kraft', bl + mmToPx(5, scale), bl + mmToPx(16, scale), mmToPx(70, scale), {
        fontSize: mmToPx(6.5, scale), fontWeight: 'bold', fill: '#ffffff', fontFamily: 'Raleway',
        data: { id: makeId(), name: 'Name', layerType: 'text' , fieldKey: 'name' },
      })
      addTextbox(canvas, fabric, 'Photography', bl + mmToPx(5, scale), bl + mmToPx(40, scale), mmToPx(70, scale), {
        fontSize: mmToPx(3, scale), fill: '#111111',
        data: { id: makeId(), name: 'Title', layerType: 'text' , fieldKey: 'title' },
      })
      addTextbox(canvas, fabric, 'oliver@kraftstudio.com', bl + mmToPx(5, scale), bl + mmToPx(47, scale), mmToPx(70, scale), {
        fontSize: mmToPx(2.6, scale), fill: '#555555',
        data: { id: makeId(), name: 'Email', layerType: 'text' , fieldKey: 'email' },
      })

    } else if (name === 'Artist') {
      // Gallery white with colorful accent corner
      canvas.add(new fabric.Rect({
        left: bl + mmToPx(dims.widthMm - 18, scale), top: bl,
        width: mmToPx(18, scale), height: mmToPx(18, scale),
        fill: '#f97316', data: { id: makeId(), name: 'Corner', layerType: 'rect' },
      }))
      addTextbox(canvas, fabric, 'Maya', bl + mmToPx(5, scale), bl + mmToPx(12, scale), mmToPx(60, scale), {
        fontSize: mmToPx(10, scale), fontFamily: 'Pacifico', fill: '#1a1a1a',
        data: { id: makeId(), name: 'FirstName', layerType: 'text' , fieldKey: 'name' },
      })
      addTextbox(canvas, fabric, 'Visual Artist & Illustrator', bl + mmToPx(5, scale), bl + mmToPx(30, scale), mmToPx(70, scale), {
        fontSize: mmToPx(3, scale), fill: '#666666', fontFamily: 'Poppins',
        data: { id: makeId(), name: 'Title', layerType: 'text' , fieldKey: 'title' },
      })
      addTextbox(canvas, fabric, 'maya.art@studio.com', bl + mmToPx(5, scale), bl + mmToPx(40, scale), mmToPx(70, scale), {
        fontSize: mmToPx(2.8, scale), fill: '#f97316',
        data: { id: makeId(), name: 'Email', layerType: 'text' , fieldKey: 'email' },
      })

    } else if (name === 'Restaurant') {
      // Deep red with cream accents
      canvas.add(new fabric.Rect({
        left: bl, top: bl, width: mmToPx(dims.widthMm, scale), height: mmToPx(12, scale),
        fill: '#5c1010', data: { id: makeId(), name: 'Header', layerType: 'rect' },
      }))
      addTextbox(canvas, fabric, 'LA CUCINA', bl + mmToPx(5, scale), bl + mmToPx(2.5, scale), mmToPx(75, scale), {
        fontSize: mmToPx(4.5, scale), fontWeight: 'bold', fontFamily: 'Playfair Display',
        fill: '#f5e6c8', charSpacing: 150,
        data: { id: makeId(), name: 'Restaurant', layerType: 'text' , fieldKey: 'company' },
      })
      addTextbox(canvas, fabric, 'Marco Rossi', bl + mmToPx(5, scale), bl + mmToPx(18, scale), mmToPx(70, scale), {
        fontSize: mmToPx(5, scale), fontFamily: 'Playfair Display', fill: '#f5e6c8',
        data: { id: makeId(), name: 'Name', layerType: 'text' , fieldKey: 'name' },
      })
      addTextbox(canvas, fabric, 'Executive Chef', bl + mmToPx(5, scale), bl + mmToPx(29, scale), mmToPx(70, scale), {
        fontSize: mmToPx(3, scale), fill: '#e2b97a', fontFamily: 'Lora',
        data: { id: makeId(), name: 'Title', layerType: 'text' , fieldKey: 'title' },
      })
      addTextbox(canvas, fabric, 'marco@lacucina.com  ·  +39 02 000 1234', bl + mmToPx(5, scale), bl + mmToPx(40, scale), mmToPx(70, scale), {
        fontSize: mmToPx(2.5, scale), fill: '#c4a882',
        data: { id: makeId(), name: 'Contact', layerType: 'text' , fieldKey: 'email' },
      })

    } else if (name === 'Cafe') {
      // Coffee brown with cream
      canvas.add(new fabric.Rect({
        left: bl + mmToPx(dims.widthMm - 22, scale), top: bl,
        width: mmToPx(22, scale), height: mmToPx(dims.heightMm, scale),
        fill: '#6b3a1f', data: { id: makeId(), name: 'Side Panel', layerType: 'rect' },
      }))
      addTextbox(canvas, fabric, 'BEAN', bl + mmToPx(dims.widthMm - 19, scale), bl + mmToPx(10, scale), mmToPx(18, scale), {
        fontSize: mmToPx(5, scale), fontWeight: 'bold', fill: '#f5e6c8', textAlign: 'center', charSpacing: 100,
        data: { id: makeId(), name: 'Brand1', layerType: 'text' , fieldKey: 'company' },
      })
      addTextbox(canvas, fabric, '& CO', bl + mmToPx(dims.widthMm - 19, scale), bl + mmToPx(20, scale), mmToPx(18, scale), {
        fontSize: mmToPx(3.5, scale), fill: '#c4a882', textAlign: 'center',
        data: { id: makeId(), name: 'Brand2', layerType: 'text' },
      })
      addTextbox(canvas, fabric, 'Sofia Lane', bl + mmToPx(5, scale), bl + mmToPx(12, scale), mmToPx(55, scale), {
        fontSize: mmToPx(5.5, scale), fontFamily: 'Lora', fill: '#3b1f0a',
        data: { id: makeId(), name: 'Name', layerType: 'text' , fieldKey: 'name' },
      })
      addTextbox(canvas, fabric, 'Head Barista', bl + mmToPx(5, scale), bl + mmToPx(24, scale), mmToPx(55, scale), {
        fontSize: mmToPx(3, scale), fill: '#6b3a1f',
        data: { id: makeId(), name: 'Title', layerType: 'text' , fieldKey: 'title' },
      })
      addTextbox(canvas, fabric, 'sofia@beanandco.com', bl + mmToPx(5, scale), bl + mmToPx(36, scale), mmToPx(55, scale), {
        fontSize: mmToPx(2.8, scale), fill: '#8b6347',
        data: { id: makeId(), name: 'Email', layerType: 'text' , fieldKey: 'email' },
      })

    } else if (name === 'Bakery') {
      // Soft beige, playful script
      canvas.add(new fabric.Rect({
        left: bl + mmToPx(5, scale), top: bl + mmToPx(dims.heightMm - 8, scale),
        width: mmToPx(dims.widthMm - 10, scale), height: mmToPx(0.5, scale),
        fill: '#d4956a', data: { id: makeId(), name: 'Bottom Line', layerType: 'rect' },
      }))
      addTextbox(canvas, fabric, 'Sweet Crumbs', bl + mmToPx(5, scale), bl + mmToPx(8, scale), mmToPx(75, scale), {
        fontSize: mmToPx(7, scale), fontFamily: 'Pacifico', fill: '#8b4513',
        data: { id: makeId(), name: 'Brand', layerType: 'text' , fieldKey: 'company' },
      })
      addTextbox(canvas, fabric, 'BAKERY & CAFÉ', bl + mmToPx(5, scale), bl + mmToPx(24, scale), mmToPx(70, scale), {
        fontSize: mmToPx(2.5, scale), fill: '#d4956a', charSpacing: 200,
        data: { id: makeId(), name: 'Sub', layerType: 'text' },
      })
      addTextbox(canvas, fabric, 'Claire Dubois', bl + mmToPx(5, scale), bl + mmToPx(30, scale), mmToPx(70, scale), {
        fontSize: mmToPx(4, scale), fontFamily: 'Lora', fill: '#5c3317',
        data: { id: makeId(), name: 'Name', layerType: 'text' , fieldKey: 'name' },
      })
      addTextbox(canvas, fabric, 'claire@sweetcrumbs.com', bl + mmToPx(5, scale), bl + mmToPx(41, scale), mmToPx(70, scale), {
        fontSize: mmToPx(2.6, scale), fill: '#a0704a',
        data: { id: makeId(), name: 'Email', layerType: 'text' , fieldKey: 'email' },
      })

    } else if (name === 'Medical') {
      // Clean clinical — white & sky blue
      canvas.add(new fabric.Rect({
        left: bl, top: bl, width: mmToPx(dims.widthMm, scale), height: mmToPx(2, scale),
        fill: '#0284c7', data: { id: makeId(), name: 'Top Bar', layerType: 'rect' },
      }))
      canvas.add(new fabric.Rect({
        left: bl, top: bl + mmToPx(dims.heightMm - 2, scale), width: mmToPx(dims.widthMm, scale), height: mmToPx(2, scale),
        fill: '#0284c7', data: { id: makeId(), name: 'Bottom Bar', layerType: 'rect' },
      }))
      addTextbox(canvas, fabric, 'Dr. Sarah Kim', bl + mmToPx(5, scale), bl + mmToPx(10, scale), mmToPx(70, scale), {
        fontSize: mmToPx(6, scale), fontWeight: 'bold', fontFamily: 'Nunito', fill: '#0c1a2e',
        data: { id: makeId(), name: 'Name', layerType: 'text' , fieldKey: 'name' },
      })
      addTextbox(canvas, fabric, 'M.D. — Internal Medicine', bl + mmToPx(5, scale), bl + mmToPx(23, scale), mmToPx(70, scale), {
        fontSize: mmToPx(3, scale), fill: '#0284c7', fontFamily: 'Nunito',
        data: { id: makeId(), name: 'Title', layerType: 'text' , fieldKey: 'title' },
      })
      canvas.add(new fabric.Rect({
        left: bl + mmToPx(5, scale), top: bl + mmToPx(32, scale),
        width: mmToPx(55, scale), height: mmToPx(0.5, scale),
        fill: '#bae6fd', data: { id: makeId(), name: 'Divider', layerType: 'rect' },
      }))
      addTextbox(canvas, fabric, 's.kim@medcenter.com  ·  +1 (800) 000-1234', bl + mmToPx(5, scale), bl + mmToPx(36, scale), mmToPx(70, scale), {
        fontSize: mmToPx(2.5, scale), fill: '#475569',
        data: { id: makeId(), name: 'Contact', layerType: 'text' , fieldKey: 'email' },
      })

    } else if (name === 'Fitness') {
      // Dark + energetic orange
      canvas.add(new fabric.Rect({
        left: bl, top: bl, width: mmToPx(dims.widthMm, scale), height: mmToPx(4, scale),
        fill: '#ea580c', data: { id: makeId(), name: 'Top Bar', layerType: 'rect' },
      }))
      addTextbox(canvas, fabric, 'IRON WILL', bl + mmToPx(5, scale), bl + mmToPx(10, scale), mmToPx(75, scale), {
        fontSize: mmToPx(4, scale), fontWeight: 'bold', fill: '#ea580c', charSpacing: 250,
        data: { id: makeId(), name: 'Brand', layerType: 'text' , fieldKey: 'company' },
      })
      addTextbox(canvas, fabric, 'Jake Morrison', bl + mmToPx(5, scale), bl + mmToPx(22, scale), mmToPx(70, scale), {
        fontSize: mmToPx(6, scale), fontWeight: 'bold', fill: '#ffffff',
        data: { id: makeId(), name: 'Name', layerType: 'text' , fieldKey: 'name' },
      })
      addTextbox(canvas, fabric, 'Certified Personal Trainer', bl + mmToPx(5, scale), bl + mmToPx(34, scale), mmToPx(70, scale), {
        fontSize: mmToPx(3, scale), fill: '#9ca3af',
        data: { id: makeId(), name: 'Title', layerType: 'text' , fieldKey: 'title' },
      })
      addTextbox(canvas, fabric, 'jake@ironwillfitness.com', bl + mmToPx(5, scale), bl + mmToPx(43, scale), mmToPx(70, scale), {
        fontSize: mmToPx(2.8, scale), fill: '#6b7280',
        data: { id: makeId(), name: 'Email', layerType: 'text' , fieldKey: 'email' },
      })

    } else if (name === 'Beauty Spa') {
      // Soft rose & gold
      canvas.add(new fabric.Rect({
        left: bl, top: bl, width: mmToPx(dims.widthMm, scale), height: mmToPx(dims.heightMm, scale),
        fill: '#fff1f2', data: { id: makeId(), name: 'BG', layerType: 'rect' },
      }))
      canvas.add(new fabric.Rect({
        left: bl, top: bl + mmToPx(dims.heightMm - 8, scale), width: mmToPx(dims.widthMm, scale), height: mmToPx(8, scale),
        fill: '#fecdd3', data: { id: makeId(), name: 'Footer', layerType: 'rect' },
      }))
      addTextbox(canvas, fabric, 'Lumière', bl + mmToPx(5, scale), bl + mmToPx(8, scale), mmToPx(75, scale), {
        fontSize: mmToPx(8, scale), fontFamily: 'Playfair Display', fill: '#9d174d',
        data: { id: makeId(), name: 'Brand', layerType: 'text' , fieldKey: 'company' },
      })
      addTextbox(canvas, fabric, 'BEAUTY & SPA', bl + mmToPx(5, scale), bl + mmToPx(25, scale), mmToPx(70, scale), {
        fontSize: mmToPx(2.5, scale), fill: '#b8860b', charSpacing: 200,
        data: { id: makeId(), name: 'Sub', layerType: 'text' },
      })
      addTextbox(canvas, fabric, 'Chloé Martin, Head Stylist', bl + mmToPx(5, scale), bl + mmToPx(31, scale), mmToPx(70, scale), {
        fontSize: mmToPx(3, scale), fontFamily: 'Lora', fill: '#881337',
        data: { id: makeId(), name: 'Name', layerType: 'text' , fieldKey: 'name' },
      })
      addTextbox(canvas, fabric, 'chloe@lumiere-spa.com', bl + mmToPx(5, scale), bl + mmToPx(40, scale), mmToPx(70, scale), {
        fontSize: mmToPx(2.5, scale), fill: '#9d174d',
        data: { id: makeId(), name: 'Email', layerType: 'text' , fieldKey: 'email' },
      })

    } else if (name === 'Tech Startup') {
      // Dark gradient purple — modern SaaS
      canvas.add(new fabric.Rect({
        left: bl, top: bl, width: mmToPx(dims.widthMm, scale), height: mmToPx(dims.heightMm, scale),
        fill: '#0f0f23', data: { id: makeId(), name: 'BG', layerType: 'rect' },
      }))
      canvas.add(new fabric.Rect({
        left: bl, top: bl, width: mmToPx(3, scale), height: mmToPx(dims.heightMm, scale),
        fill: '#7c3aed', data: { id: makeId(), name: 'Left Bar', layerType: 'rect' },
      }))
      addTextbox(canvas, fabric, 'NEXUS', bl + mmToPx(8, scale), bl + mmToPx(7, scale), mmToPx(70, scale), {
        fontSize: mmToPx(4, scale), fontWeight: 'bold', fill: '#7c3aed', charSpacing: 200,
        data: { id: makeId(), name: 'Brand', layerType: 'text' , fieldKey: 'company' },
      })
      addTextbox(canvas, fabric, 'Alex Park', bl + mmToPx(8, scale), bl + mmToPx(19, scale), mmToPx(70, scale), {
        fontSize: mmToPx(6, scale), fontWeight: 'bold', fill: '#ffffff', fontFamily: 'Inter',
        data: { id: makeId(), name: 'Name', layerType: 'text' , fieldKey: 'name' },
      })
      addTextbox(canvas, fabric, 'Co-founder & CTO', bl + mmToPx(8, scale), bl + mmToPx(31, scale), mmToPx(70, scale), {
        fontSize: mmToPx(3, scale), fill: '#a78bfa',
        data: { id: makeId(), name: 'Title', layerType: 'text' , fieldKey: 'title' },
      })
      addTextbox(canvas, fabric, 'alex@nexus.io  ·  nexus.io', bl + mmToPx(8, scale), bl + mmToPx(41, scale), mmToPx(70, scale), {
        fontSize: mmToPx(2.6, scale), fill: '#6b7280',
        data: { id: makeId(), name: 'Contact', layerType: 'text' , fieldKey: 'email' },
      })

    } else if (name === 'Developer') {
      // Terminal dark — monospace aesthetic
      canvas.add(new fabric.Rect({
        left: bl, top: bl, width: mmToPx(dims.widthMm, scale), height: mmToPx(dims.heightMm, scale),
        fill: '#0d1117', data: { id: makeId(), name: 'BG', layerType: 'rect' },
      }))
      addTextbox(canvas, fabric, '$ whoami', bl + mmToPx(5, scale), bl + mmToPx(8, scale), mmToPx(70, scale), {
        fontSize: mmToPx(3, scale), fill: '#3fb950', fontFamily: 'Courier New',
        data: { id: makeId(), name: 'Prompt', layerType: 'text' },
      })
      addTextbox(canvas, fabric, 'Kim Juno', bl + mmToPx(5, scale), bl + mmToPx(17, scale), mmToPx(70, scale), {
        fontSize: mmToPx(6.5, scale), fontWeight: 'bold', fill: '#f0f6fc', fontFamily: 'Courier New',
        data: { id: makeId(), name: 'Name', layerType: 'text' , fieldKey: 'name' },
      })
      addTextbox(canvas, fabric, '// Full-Stack Engineer', bl + mmToPx(5, scale), bl + mmToPx(30, scale), mmToPx(70, scale), {
        fontSize: mmToPx(3, scale), fill: '#6e7681', fontFamily: 'Courier New',
        data: { id: makeId(), name: 'Title', layerType: 'text' , fieldKey: 'title' },
      })
      addTextbox(canvas, fabric, 'kim@devstudio.io\ngithub.com/kimjuno', bl + mmToPx(5, scale), bl + mmToPx(39, scale), mmToPx(70, scale), {
        fontSize: mmToPx(2.6, scale), fill: '#58a6ff', fontFamily: 'Courier New',
        data: { id: makeId(), name: 'Links', layerType: 'text' , fieldKey: 'email' },
      })

    } else if (name === 'Realtor') {
      // Gold prestige — real estate
      canvas.add(new fabric.Rect({
        left: bl, top: bl, width: mmToPx(dims.widthMm, scale), height: mmToPx(3, scale),
        fill: '#b8860b', data: { id: makeId(), name: 'Top Gold', layerType: 'rect' },
      }))
      addTextbox(canvas, fabric, 'PREMIER REALTY', bl + mmToPx(5, scale), bl + mmToPx(9, scale), mmToPx(75, scale), {
        fontSize: mmToPx(3, scale), fill: '#b8860b', charSpacing: 150, fontFamily: 'Montserrat', fontWeight: 'bold',
        data: { id: makeId(), name: 'Agency', layerType: 'text' , fieldKey: 'company' },
      })
      addTextbox(canvas, fabric, 'James Sullivan', bl + mmToPx(5, scale), bl + mmToPx(20, scale), mmToPx(70, scale), {
        fontSize: mmToPx(6, scale), fontFamily: 'Playfair Display', fill: '#1a1a1a',
        data: { id: makeId(), name: 'Name', layerType: 'text' , fieldKey: 'name' },
      })
      addTextbox(canvas, fabric, 'Licensed Real Estate Agent', bl + mmToPx(5, scale), bl + mmToPx(32, scale), mmToPx(70, scale), {
        fontSize: mmToPx(3, scale), fill: '#555555',
        data: { id: makeId(), name: 'Title', layerType: 'text' , fieldKey: 'title' },
      })
      addTextbox(canvas, fabric, 'j.sullivan@premierrealty.com  ·  +1 (310) 000-9876', bl + mmToPx(5, scale), bl + mmToPx(41, scale), mmToPx(70, scale), {
        fontSize: mmToPx(2.4, scale), fill: '#777777',
        data: { id: makeId(), name: 'Contact', layerType: 'text' , fieldKey: 'email' },
      })

    } else if (name === 'Architect') {
      // Clean minimal grid lines
      canvas.add(new fabric.Rect({
        left: bl, top: bl + mmToPx(dims.heightMm / 2, scale), width: mmToPx(dims.widthMm, scale), height: mmToPx(0.3, scale),
        fill: '#e5e7eb', data: { id: makeId(), name: 'Grid H', layerType: 'rect' },
      }))
      canvas.add(new fabric.Rect({
        left: bl + mmToPx(dims.widthMm / 2, scale), top: bl, width: mmToPx(0.3, scale), height: mmToPx(dims.heightMm, scale),
        fill: '#e5e7eb', data: { id: makeId(), name: 'Grid V', layerType: 'rect' },
      }))
      addTextbox(canvas, fabric, 'FORMA', bl + mmToPx(5, scale), bl + mmToPx(8, scale), mmToPx(70, scale), {
        fontSize: mmToPx(4, scale), fontWeight: 'bold', fill: '#111827', charSpacing: 300, fontFamily: 'Montserrat',
        data: { id: makeId(), name: 'Brand', layerType: 'text' , fieldKey: 'company' },
      })
      addTextbox(canvas, fabric, 'Yuki Tanaka', bl + mmToPx(5, scale), bl + mmToPx(20, scale), mmToPx(65, scale), {
        fontSize: mmToPx(5.5, scale), fontFamily: 'Raleway', fill: '#1f2937',
        data: { id: makeId(), name: 'Name', layerType: 'text' , fieldKey: 'name' },
      })
      addTextbox(canvas, fabric, 'Principal Architect  ·  RIBA', bl + mmToPx(5, scale), bl + mmToPx(32, scale), mmToPx(70, scale), {
        fontSize: mmToPx(3, scale), fill: '#6b7280',
        data: { id: makeId(), name: 'Title', layerType: 'text' , fieldKey: 'title' },
      })
      addTextbox(canvas, fabric, 'y.tanaka@formaarch.com', bl + mmToPx(5, scale), bl + mmToPx(42, scale), mmToPx(70, scale), {
        fontSize: mmToPx(2.8, scale), fill: '#9ca3af',
        data: { id: makeId(), name: 'Email', layerType: 'text' , fieldKey: 'email' },
      })
    }
    // Blank: no user objects

    // Update trim-bg color
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const trimBg = canvas.getObjects().find((o: any) => o.data?.role === 'trim-bg')
    if (trimBg) trimBg.set('fill', bg)
  }

  // ── Phase B: Apply contact smart fields ──────────────────────────────────

  async function applyContactFields(fields: typeof contactFields) {
    const fabric = fabricModRef.current ?? await import('fabric')
    const canvas = fabricRef.current
    if (!canvas) return
    const bl = mmToPx(dims.bleedMm, scale)

    const fieldMap: Record<string, string> = {
      name:     fields.name,
      title:    fields.title,
      company:  fields.company,
      phone:    fields.phone,
      email:    fields.email,
      website:  fields.website,
      linkedin: fields.linkedin,
    }

    // Update existing tagged layers first
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = canvas.getObjects().filter((o: any) => o.data?.fieldType)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    existing.forEach((o: any) => {
      const val = fieldMap[o.data.fieldType]
      if (val !== undefined && o.set) o.set('text', val || `[${o.data.fieldType}]`)
    })

    // Add missing layers if none found at all (blank canvas case)
    if (existing.length === 0) {
      const rows: { fieldType: string; label: string; y: number; fs: number; fw?: string; color: string }[] = [
        { fieldType: 'name',    label: fields.name    || 'Your Name',      y: 10, fs: 6, fw: 'bold', color: '#111111' },
        { fieldType: 'title',   label: fields.title   || 'Your Title',     y: 22, fs: 3.5,            color: '#555555' },
        { fieldType: 'company', label: fields.company || 'Company',        y: 29, fs: 3,              color: '#777777' },
        { fieldType: 'email',   label: fields.email   || 'email@company.com', y: 38, fs: 2.8,        color: '#444444' },
        { fieldType: 'phone',   label: fields.phone   || '+1 (000) 000-0000', y: 44, fs: 2.8,        color: '#444444' },
        { fieldType: 'website', label: fields.website || 'www.yoursite.com',  y: 50, fs: 2.8,        color: '#4f46e5' },
      ]
      rows.forEach(row => {
        const id = makeId()
        const obj = new fabric.Textbox(row.label, {
          left: bl + mmToPx(5, scale),
          top: bl + mmToPx(row.y, scale),
          width: mmToPx(75, scale),
          fontSize: mmToPx(row.fs, scale),
          fontWeight: row.fw ?? 'normal',
          fill: row.color,
          data: { id, name: row.fieldType, layerType: 'text' as const, fieldType: row.fieldType },
        })
        canvas.add(obj)
      })
    }

    canvas.renderAll()
    syncLayers(canvas)
    saveHistory(canvas)
  }

  // ── 필수 필드 즉시 반영 ─────────────────────────────────────────────────
  // 사용자가 좌측 패널에서 입력하면 캔버스의 data.fieldKey 또는
  // data.fieldType이 일치하는 Textbox에 즉시 반영한다.
  // 매칭되는 텍스트 박스가 없고 값이 비어있지 않다면 신규 박스를 생성한다.
  async function applyRequiredField(key: string, value: string) {
    const fabric = fabricModRef.current ?? await import('fabric')
    const canvas = fabricRef.current
    if (!canvas) return
    const bl = mmToPx(dims.bleedMm, scale)
    const def = productFields.find(f => f.key === key)
    const fallback = def?.placeholder ? `[${def.label.replace(/\s*\(.*\)$/, '')}]` : `[${key}]`

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const matches = canvas.getObjects().filter((o: any) =>
      o.data?.fieldKey === key || o.data?.fieldType === key
    )

    if (matches.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      matches.forEach((o: any) => {
        if (o.set) o.set('text', value || fallback)
      })
    } else if (value) {
      // 빈 캔버스에서 처음 입력하면 새 텍스트 박스 자동 생성
      const orderIdx = productFields.findIndex(f => f.key === key)
      const top = bl + mmToPx(8 + Math.max(orderIdx, 0) * 8, scale)
      const fontSize = (def?.type === 'multiline')
        ? mmToPx(2.8, scale)
        : (orderIdx === 0 ? mmToPx(6, scale) : mmToPx(3.2, scale))
      const obj = new fabric.Textbox(value, {
        left: bl + mmToPx(5, scale),
        top,
        width: mmToPx(Math.max(dims.widthMm - 10, 30), scale),
        fontSize,
        fontWeight: orderIdx === 0 ? 'bold' : 'normal',
        fill: orderIdx === 0 ? '#111111' : '#444444',
        data: { id: makeId(), name: def?.label ?? key, layerType: 'text' as const, fieldKey: key, fieldType: key },
      })
      canvas.add(obj)
    }

    canvas.renderAll()
    syncLayers(canvas)
  }

  // ── Phase C: Apply brand palette ─────────────────────────────────────────

  function applyPalette(palette: PaletteDef) {
    setSelectedPalette(palette.name)
    updateBgColor(palette.bg)
    const canvas = fabricRef.current
    if (!canvas) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canvas.getObjects().forEach((o: any) => {
      if (isBackground(o) || o.data?.role === 'crop') return
      const role = o.data?.paletteRole as string | undefined
      if (role === 'primary' && o.set) {
        o.set('fill', palette.primary)
      } else if (role === 'accent' && o.set) {
        o.set('fill', palette.accent)
      } else if (role === 'body' && o.set) {
        o.set('fill', palette.body)
      }
    })
    canvas.renderAll()
    saveHistory(canvas)
  }

  // ── Phase D: Logo upload ──────────────────────────────────────────────────

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const fabric = fabricModRef.current ?? await import('fabric')
    const canvas = fabricRef.current
    if (!canvas) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string
      if (!dataUrl) return
      const img = await fabric.FabricImage.fromURL(dataUrl)
      const bl = mmToPx(dims.bleedMm, scale)
      const maxW = mmToPx(25, scale)
      const maxH = mmToPx(15, scale)
      const ratio = Math.min(maxW / (img.width ?? maxW), maxH / (img.height ?? maxH))
      const id = makeId()
      img.set({
        left: bl + mmToPx(3, scale),
        top: bl + mmToPx(3, scale),
        scaleX: ratio,
        scaleY: ratio,
        data: { id, name: 'Logo', layerType: 'image' },
      })
      canvas.add(img)
      canvas.setActiveObject(img)
      canvas.renderAll()
      syncLayers(canvas)
      saveHistory(canvas)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
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
  const replaceImageInputRef = useRef<HTMLInputElement>(null)

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

  async function handleReplaceImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const canvas = fabricRef.current
    if (!canvas) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const oldImg: any = canvas.getActiveObject()
    if (!oldImg || oldImg.type !== 'image') return

    const url = URL.createObjectURL(file)
    const fabric = fabricModRef.current ?? await import('fabric')
    const newImg = await fabric.FabricImage.fromURL(url)

    // Keep the old position, scale, angle, opacity, filters, data
    newImg.set({
      left: oldImg.left,
      top: oldImg.top,
      scaleX: oldImg.scaleX,
      scaleY: oldImg.scaleY,
      angle: oldImg.angle,
      opacity: oldImg.opacity,
      filters: oldImg.filters,
      data: { ...oldImg.data, name: file.name.slice(0, 20) },
    })
    newImg.applyFilters()

    canvas.remove(oldImg)
    canvas.add(newImg)
    canvas.setActiveObject(newImg)
    canvas.renderAll()
    syncLayers(canvas)
    saveHistory(canvas)
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
    // Rect-specific
    if (patch.fillColor !== undefined) obj.set('fill', patch.fillColor)
    if (patch.strokeColor !== undefined) obj.set('stroke', patch.strokeColor)
    if (patch.strokeWidth !== undefined) obj.set('strokeWidth', patch.strokeWidth)

    // Image-specific
    if (patch.opacity !== undefined) obj.set('opacity', patch.opacity)
    if (patch.blendMode !== undefined) obj.set('globalCompositeOperation', patch.blendMode)
    if (
      patch.brightness !== undefined || patch.contrast !== undefined ||
      patch.saturation !== undefined || patch.grayscale !== undefined
    ) {
      const fabric = fabricModRef.current
      if (fabric) {
        const cur = selectedProps!
        const brightness = patch.brightness ?? cur.brightness ?? 0
        const contrast = patch.contrast ?? cur.contrast ?? 0
        const saturation = patch.saturation ?? cur.saturation ?? 0
        const grayscale = patch.grayscale ?? cur.grayscale ?? false
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const newFilters: any[] = []
        if (brightness !== 0) newFilters.push(new (fabric.filters as any).Brightness({ brightness }))
        if (contrast !== 0) newFilters.push(new (fabric.filters as any).Contrast({ contrast }))
        if (saturation !== 0) newFilters.push(new (fabric.filters as any).Saturation({ saturation }))
        if (grayscale) newFilters.push(new (fabric.filters as any).Grayscale())
        obj.filters = newFilters
        obj.applyFilters()
      }
    }

    canvas.renderAll()
    setSelectedProps(prev => prev ? { ...prev, ...patch } : null)
    saveHistory(canvas)
  }

  // ── Crop ─────────────────────────────────────────────────────────────────

  function startCrop() {
    const canvas = fabricRef.current
    const fabric = fabricModRef.current
    if (!canvas || !fabric) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const img: any = canvas.getActiveObject()
    if (!img || img.type !== 'image') return

    cropTargetIdRef.current = img.data?.id ?? null
    img.set({ selectable: false, evented: false })

    const id = makeId()
    cropRectIdRef.current = id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cropRect = new (fabric as any).Rect({
      left: img.left,
      top: img.top,
      width: img.getScaledWidth(),
      height: img.getScaledHeight(),
      fill: 'rgba(99,102,241,0.12)',
      stroke: '#6366f1',
      strokeWidth: 2,
      strokeDashArray: [6, 3],
      data: { id, role: 'crop', name: 'Crop Area', layerType: 'rect' as LayerType },
    })
    canvas.add(cropRect)
    canvas.setActiveObject(cropRect)
    canvas.renderAll()
    setCropActive(true)
    setActivePanel('properties')
  }

  function applyCrop() {
    const canvas = fabricRef.current
    const fabric = fabricModRef.current
    if (!canvas || !fabric) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cropRect: any = canvas.getObjects().find((o: any) => o.data?.id === cropRectIdRef.current)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const img: any = canvas.getObjects().find((o: any) => o.data?.id === cropTargetIdRef.current)
    if (!cropRect || !img) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    img.clipPath = new (fabric as any).Rect({
      left: cropRect.left,
      top: cropRect.top,
      width: cropRect.getScaledWidth(),
      height: cropRect.getScaledHeight(),
      absolutePositioned: true,
    })
    img.dirty = true
    img.set({ selectable: true, evented: true })

    canvas.remove(cropRect)
    canvas.setActiveObject(img)
    canvas.renderAll()

    cropRectIdRef.current = null
    cropTargetIdRef.current = null
    setCropActive(false)
    syncLayers(canvas)
    syncSelected(canvas)
    saveHistory(canvas)
  }

  function cancelCrop() {
    const canvas = fabricRef.current
    if (!canvas) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cropRect = canvas.getObjects().find((o: any) => o.data?.id === cropRectIdRef.current)
    if (cropRect) canvas.remove(cropRect)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const img: any = canvas.getObjects().find((o: any) => o.data?.id === cropTargetIdRef.current)
    if (img) {
      img.set({ selectable: true, evented: true })
      canvas.setActiveObject(img)
    }

    canvas.renderAll()
    cropRectIdRef.current = null
    cropTargetIdRef.current = null
    setCropActive(false)
    syncLayers(canvas)
    syncSelected(canvas)
  }

  function resetCrop() {
    const canvas = fabricRef.current
    if (!canvas) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const img: any = canvas.getActiveObject()
    if (!img || img.type !== 'image') return
    img.clipPath = undefined
    img.dirty = true
    canvas.renderAll()
    syncSelected(canvas)
    saveHistory(canvas)
  }

  // ── Shape library ─────────────────────────────────────────────────────────

  async function addShape(preset: ShapePreset) {
    const fabric = fabricModRef.current ?? await import('fabric')
    const canvas = fabricRef.current
    if (!canvas) return
    const bl = mmToPx(dims.bleedMm, scale)
    const size = mmToPx(20, scale)
    const id = makeId()
    const cx = bl + (mmToPx(dims.widthMm, scale) - size) / 2
    const cy = bl + (mmToPx(dims.heightMm, scale) - size) / 2
    const commonStyle = {
      fill: '#e5e7eb',
      stroke: '#9ca3af',
      strokeWidth: 1,
      data: { id, name: preset.name, layerType: 'rect' as LayerType },
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let obj: any

    if (preset.kind === 'rect') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      obj = new (fabric as any).Rect({ left: cx, top: cy, width: size, height: size, ...commonStyle })
    } else if (preset.kind === 'circle') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      obj = new (fabric as any).Circle({ left: cx, top: cy, radius: size / 2, ...commonStyle })
    } else if (preset.kind === 'triangle') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      obj = new (fabric as any).Triangle({ left: cx, top: cy, width: size, height: size, ...commonStyle })
    } else if (preset.kind === 'path' && preset.path) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      obj = new (fabric as any).Path(preset.path, commonStyle)
      const bw = obj.width ?? 1
      const bh = obj.height ?? 1
      const scaleF = size / Math.max(bw, bh)
      obj.set({ scaleX: scaleF, scaleY: scaleF, left: cx, top: cy })
    }

    if (obj) {
      canvas.add(obj)
      canvas.setActiveObject(obj)
      canvas.renderAll()
      setTool('select')
      syncLayers(canvas)
      saveHistory(canvas)
    }
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

  // targetDpi: desired output DPI. 300 = print quality, 150 = preview.
  // 블리드 포함 영역(= trim + 2×bleed)을 export 한다. 인쇄소 재단 기준을 맞추기 위함.
  // includeBleed=false 인 경우 trim만 export (PNG 미리보기 등 호환용).
  function getExportDataUrl(targetDpi = 150, includeBleed = true): string {
    const canvas = fabricRef.current
    if (!canvas) return ''
    const bleedPx = mmToPx(dims.bleedMm, scale)
    const trimW = mmToPx(dims.widthMm, scale)
    const trimH = mmToPx(dims.heightMm, scale)
    const exportLeft = includeBleed ? 0 : bleedPx
    const exportTop = includeBleed ? 0 : bleedPx
    const exportW = includeBleed ? trimW + 2 * bleedPx : trimW
    const exportH = includeBleed ? trimH + 2 * bleedPx : trimH
    const exportWmm = includeBleed ? dims.widthMm + 2 * dims.bleedMm : dims.widthMm
    const exportHmm = includeBleed ? dims.heightMm + 2 * dims.bleedMm : dims.heightMm

    // Compute multiplier dynamically from product dimensions to guarantee target DPI
    const MM_PER_INCH = 25.4
    const needW = (exportWmm / MM_PER_INCH) * targetDpi
    const needH = (exportHmm / MM_PER_INCH) * targetDpi
    const multiplier = Math.max(1, Math.ceil(Math.max(needW / exportW, needH / exportH)))

    // Save viewport, reset for export
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vpt: any = [...(canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0])]
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0])

    const dataUrl = canvas.toDataURL({
      format: 'png',
      left: exportLeft,
      top: exportTop,
      width: exportW,
      height: exportH,
      multiplier,
    })

    canvas.setViewportTransform(vpt)
    canvas.renderAll()
    return dataUrl
  }

  function exportPng() {
    // PNG 미리보기는 trim 영역만 (블리드 제외) — 디자인 시안 확인용
    const dataUrl = getExportDataUrl(150, false)
    if (!dataUrl) return
    const link = document.createElement('a')
    link.download = `${product.slug}-design.png`
    link.href = dataUrl
    link.click()
  }

  // ── Phase 6: PDF export ────────────────────────────────────────────────────

  async function exportPdf() {
    // 블리드 포함 영역을 300dpi로 export → PDF 페이지 크기 = trim + 2×bleed
    const dataUrl = getExportDataUrl(300, true)
    if (!dataUrl) return
    const { PDFDocument, rgb } = await import('pdf-lib')
    const pdfDoc = await PDFDocument.create()
    const MM_PER_PT = 2.8346
    const bleedPt = dims.bleedMm * MM_PER_PT
    const trimWpt = dims.widthMm * MM_PER_PT
    const trimHpt = dims.heightMm * MM_PER_PT
    const pageW = trimWpt + 2 * bleedPt
    const pageH = trimHpt + 2 * bleedPt
    const page = pdfDoc.addPage([pageW, pageH])

    // 캔버스 이미지(블리드 포함)를 페이지 전체에 깔기
    const pngBytes = await fetch(dataUrl).then(r => r.arrayBuffer())
    const image = await pdfDoc.embedPng(pngBytes)
    page.drawImage(image, { x: 0, y: 0, width: pageW, height: pageH })

    // 재단선(crop marks): 4모서리에 trim 경계 외부로 가는 검정선
    // 트림선에서 시작 → 블리드 영역을 지나 페이지 가장자리 방향으로 ~3mm 연장
    // (block 인쇄 표준: 두께 0.25pt, 검정, trim 라인에서 약간 떨어진 gap 없음)
    const markLenPt = Math.max(bleedPt, 3 * MM_PER_PT) // 최소 3mm, 블리드가 더 크면 페이지 가장자리까지
    const markStroke = 0.25
    const markColor = rgb(0, 0, 0)
    // PDF 좌표: 원점(0,0) = 좌하단
    // trim 박스 좌하단 = (bleedPt, bleedPt), 우상단 = (bleedPt+trimWpt, bleedPt+trimHpt)
    const trimL = bleedPt
    const trimB = bleedPt
    const trimR = bleedPt + trimWpt
    const trimT = bleedPt + trimHpt
    // 페이지 경계
    const pageMinX = 0
    const pageMinY = 0
    const pageMaxX = pageW
    const pageMaxY = pageH
    // 각 mark의 외측 끝 (trim 경계에서 markLenPt 만큼 외부, 단 페이지 밖으로 나가지 않게 clamp)
    const outL = Math.max(pageMinX, trimL - markLenPt)
    const outR = Math.min(pageMaxX, trimR + markLenPt)
    const outB = Math.max(pageMinY, trimB - markLenPt)
    const outT = Math.min(pageMaxY, trimT + markLenPt)

    const drawMark = (x1: number, y1: number, x2: number, y2: number) => {
      page.drawLine({
        start: { x: x1, y: y1 },
        end: { x: x2, y: y2 },
        thickness: markStroke,
        color: markColor,
      })
    }
    // 좌하단 corner: 수평 mark (trim left → 페이지 좌측), 수직 mark (trim bottom → 페이지 하단)
    drawMark(outL, trimB, trimL, trimB)
    drawMark(trimL, outB, trimL, trimB)
    // 우하단 corner
    drawMark(trimR, trimB, outR, trimB)
    drawMark(trimR, outB, trimR, trimB)
    // 좌상단 corner
    drawMark(outL, trimT, trimL, trimT)
    drawMark(trimL, trimT, trimL, outT)
    // 우상단 corner
    drawMark(trimR, trimT, outR, trimT)
    drawMark(trimR, trimT, trimR, outT)

    const pdfBytes = await pdfDoc.save()
    const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' })
    const link = document.createElement('a')
    link.download = `${product.slug}-300dpi.pdf`
    link.href = URL.createObjectURL(blob)
    link.click()
  }

  // ── Phase 6: QR code ──────────────────────────────────────────────────────

  async function addQrCode(url: string) {
    if (!url.trim()) return
    const canvas = fabricRef.current
    const fabric = fabricModRef.current ?? await import('fabric')
    if (!canvas) return
    const QRCode = (await import('qrcode')).default
    const qrDataUrl = await QRCode.toDataURL(url.trim(), { width: 200, margin: 1 })
    const img = await fabric.FabricImage.fromURL(qrDataUrl)
    const size = mmToPx(20, scale)
    const bl = mmToPx(dims.bleedMm, scale)
    const id = makeId()
    img.set({
      left: bl + mmToPx(dims.widthMm - 22, scale),
      top: bl + mmToPx(dims.heightMm - 22, scale),
      scaleX: size / (img.width ?? 200),
      scaleY: size / (img.height ?? 200),
      data: { id, name: 'QR Code', layerType: 'image' },
    })
    canvas.add(img)
    canvas.setActiveObject(img)
    canvas.renderAll()
    setQrUrl('')
  }

  // ── Phase 6: Bleed guides toggle ──────────────────────────────────────────

  function toggleBleedGuides() {
    const canvas = fabricRef.current
    if (!canvas) return
    const newShow = !showBleed
    setShowBleed(newShow)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canvas.getObjects().forEach((o: any) => {
      if (o.data?.role === 'bleed-bg') {
        o.set('visible', newShow)
      }
    })
    canvas.renderAll()
  }

  // ── Phase 6: Preflight ────────────────────────────────────────────────────

  function runPreflight(): PreflightResult[] {
    const results: PreflightResult[] = []
    const canvas = fabricRef.current
    if (!canvas) return results

    const bl = mmToPx(dims.bleedMm, scale)
    const safeMargin = mmToPx(3, scale) // 3mm safe zone inside trim
    const trimX = bl
    const trimY = bl
    const trimW = mmToPx(dims.widthMm, scale)
    const trimH = mmToPx(dims.heightMm, scale)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userObjs = canvas.getObjects().filter((o: any) => !isBackground(o) && o.data?.role !== 'crop')

    if (userObjs.length === 0) {
      results.push({ level: 'warn', message: 'Canvas is empty — add some content before ordering.' })
    }

    // Check objects near trim edges
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let nearEdge = false
    userObjs.forEach((o: any) => {
      const oLeft = o.left ?? 0
      const oTop = o.top ?? 0
      const oRight = oLeft + (o.getScaledWidth?.() ?? o.width ?? 0)
      const oBottom = oTop + (o.getScaledHeight?.() ?? o.height ?? 0)
      if (
        oLeft < trimX + safeMargin ||
        oTop < trimY + safeMargin ||
        oRight > trimX + trimW - safeMargin ||
        oBottom > trimY + trimH - safeMargin
      ) {
        nearEdge = true
      }
    })
    if (nearEdge) {
      results.push({ level: 'warn', message: 'Some elements are within 3mm of the trim edge — they may be cut off.' })
    } else if (userObjs.length > 0) {
      results.push({ level: 'ok', message: 'All elements are within the safe zone.' })
    }

    // Check background color
    if (bgColor === '#ffffff' || bgColor === '#fff') {
      results.push({ level: 'ok', message: 'White background — suitable for print.' })
    } else {
      results.push({ level: 'ok', message: `Background color ${bgColor} set.` })
    }

    // Resolution is always 300dpi via getExportDataUrl
    results.push({ level: 'ok', message: 'Export resolution: 300 DPI (print-ready).' })

    return results
  }

  // ── Phase 5: Front / Back switching ──────────────────────────────────────

  async function switchSide(side: 'front' | 'back') {
    if (side === activeSide) return
    const canvas = fabricRef.current
    const fabric = fabricModRef.current
    if (!canvas || !fabric) return

    // Save current side's JSON
    const currentJson = JSON.stringify(canvas.toJSON(['data']))
    if (activeSide === 'front') frontJsonRef.current = currentJson
    else backJsonRef.current = currentJson

    // Load target side JSON
    const targetJson = side === 'front' ? frontJsonRef.current : backJsonRef.current

    isMutating.current = true
    canvas.discardActiveObject()

    if (targetJson) {
      await canvas.loadFromJSON(targetJson)
    } else {
      // Initialize blank canvas for new side
      clearUserObjects(canvas)
      const newBg = side === 'back' ? bgColor : bgColor
      addBackgroundObjects(canvas, fabric, newBg)
    }

    canvas.renderAll()
    isMutating.current = false
    syncLayers(canvas)
    setSelectedId(null)
    setSelectedProps(null)
    setActiveSide(side)
  }

  async function copyFrontToBack() {
    const canvas = fabricRef.current
    const fabric = fabricModRef.current
    if (!canvas || !fabric) return

    // Save current (must be 'front') JSON
    const frontJson = JSON.stringify(canvas.toJSON(['data']))
    frontJsonRef.current = frontJson
    backJsonRef.current = frontJson

    // If already on back, reload
    if (activeSide === 'back') {
      isMutating.current = true
      await canvas.loadFromJSON(frontJson)
      canvas.renderAll()
      isMutating.current = false
      syncLayers(canvas)
    }
  }

  // ── Phase 4: Save / Load designs ─────────────────────────────────────────

  function saveDesign(name: string) {
    const canvas = fabricRef.current
    if (!canvas || !name.trim()) return

    // Snapshot current side
    const currentJson = JSON.stringify(canvas.toJSON(['data']))
    if (activeSide === 'front') frontJsonRef.current = currentJson
    else backJsonRef.current = currentJson

    const thumbnail = getExportDataUrl(72)
    const design: SavedDesign = {
      id: makeId(),
      name: name.trim(),
      productSlug: product.slug,
      frontJson: frontJsonRef.current ?? currentJson,
      backJson: backJsonRef.current,
      thumbnail,
      savedAt: new Date().toISOString(),
    }
    const updated = [design, ...savedDesigns]
    localStorage.setItem(DESIGNS_STORAGE_KEY, JSON.stringify(updated))
    setSavedDesigns(updated)
    setSaveDesignName('')
  }

  async function loadSavedDesign(design: SavedDesign) {
    const canvas = fabricRef.current
    const fabric = fabricModRef.current
    if (!canvas || !fabric) return

    frontJsonRef.current = design.frontJson
    backJsonRef.current = design.backJson

    isMutating.current = true
    canvas.discardActiveObject()
    const targetJson = activeSide === 'front' ? design.frontJson : (design.backJson ?? design.frontJson)
    await canvas.loadFromJSON(targetJson)
    canvas.renderAll()
    isMutating.current = false
    syncLayers(canvas)
    setSelectedId(null)
    setSelectedProps(null)
  }

  function deleteSavedDesign(id: string) {
    const updated = savedDesigns.filter(d => d.id !== id)
    localStorage.setItem(DESIGNS_STORAGE_KEY, JSON.stringify(updated))
    setSavedDesigns(updated)
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
        window.location.href = `/order?product=${product.slug}&fileId=${data.fileId}&finish=${finish}${optStr ? '&' + optStr : ''}`
      } else {
        setOrdering(false)
        setOrderError(data.error || 'Upload failed.')
      }
    } catch {
      setOrdering(false)
      setOrderError('An error occurred. Please try again.')
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const selectedLayer = layers.find(l => l.id === selectedId) ?? null

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">
      {/* Preflight modal */}
      {showPreflight && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-96 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" /> Preflight Check
              </h3>
              <button onClick={() => setShowPreflight(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <ul className="space-y-2">
              {preflightResults.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  {r.level === 'ok' && <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />}
                  {r.level === 'warn' && <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />}
                  {r.level === 'error' && <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />}
                  <span className={r.level === 'ok' ? 'text-gray-700' : r.level === 'warn' ? 'text-amber-700' : 'text-red-700'}>{r.message}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => setShowPreflight(false)}
              className="mt-4 w-full rounded-lg bg-indigo-600 text-white text-sm font-medium py-2 hover:bg-indigo-700"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center gap-2 bg-white border-b border-gray-200 px-3 py-2 shrink-0 flex-wrap">
        <Link href={`/products/${product.slug}`} className="text-gray-400 hover:text-gray-600 flex items-center gap-1 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="h-4 border-r border-gray-200" />
        <span className="text-sm font-semibold text-gray-800">{product.name_en} Editor</span>
        <span className="text-xs text-gray-400 hidden sm:inline">{dims.widthMm}×{dims.heightMm}mm</span>

        {/* Phase 5: Front/Back tabs */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {(['front', 'back'] as const).map(side => (
            <button
              key={side}
              onClick={() => switchSide(side)}
              className={`px-3 py-1 text-xs font-medium transition-colors ${activeSide === side ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              {side === 'front' ? 'Front' : 'Back'}
            </button>
          ))}
        </div>
        <button
          onClick={copyFrontToBack}
          title="Copy front design to back"
          className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:text-indigo-600 hover:border-indigo-300"
        >
          <CopyPlus className="w-3.5 h-3.5" />
        </button>

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
          <input ref={replaceImageInputRef} type="file" accept="image/*" onChange={handleReplaceImage} className="hidden" />
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

        <div className="flex gap-1.5">
          {/* Phase 6: Bleed toggle */}
          <button
            onClick={toggleBleedGuides}
            title={showBleed ? 'Hide bleed guides' : 'Show bleed guides'}
            className={`w-8 h-8 flex items-center justify-center rounded-md border transition-colors ${showBleed ? 'border-indigo-300 text-indigo-600 bg-indigo-50' : 'border-gray-200 text-gray-400'}`}
          >
            <FlipHorizontal2 className="w-4 h-4" />
          </button>
          {/* Phase 6: Preflight */}
          <button
            onClick={() => { setPreflightResults(runPreflight()); setShowPreflight(true) }}
            title="Run preflight check"
            className="w-8 h-8 flex items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:text-indigo-600 hover:border-indigo-300"
          >
            <ShieldCheck className="w-4 h-4" />
          </button>
          <button
            onClick={exportPng}
            title="Export PNG"
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Download className="w-3.5 h-3.5" /> PNG
          </button>
          {/* Phase 6: PDF */}
          <button
            onClick={exportPdf}
            title="Export PDF (300 DPI)"
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <FileText className="w-3.5 h-3.5" /> PDF
          </button>
          {/* Phase D: Finish selector */}
          <select
            value={finish}
            onChange={e => setFinish(e.target.value)}
            title="용지 & 코팅 선택"
            className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          >
            {FINISH_OPTIONS.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
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
              { key: 'fields',     icon: FileText,       label: '필수' },
              { key: 'templates',  icon: LayoutTemplate, label: 'Tmpl' },
              { key: 'contact',    icon: Type,           label: 'Info' },
              { key: 'shapes',     icon: Star,           label: 'Shapes' },
              { key: 'layers',     icon: Layers,         label: 'Layers' },
              { key: 'properties', icon: null,           label: 'Props' },
            ] as const).map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setActivePanel(key)}
                className={`flex-1 py-2.5 text-[10px] font-medium flex items-center justify-center gap-0.5 transition-colors ${activePanel === key ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {Icon && <Icon className="w-3 h-3" />}
                {label}
              </button>
            ))}
          </div>

          {/* 필수 필드 패널 — 제품별 스키마 기반, 입력 시 캔버스 즉시 반영 */}
          {activePanel === 'fields' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              <p className="text-[10px] text-gray-400 leading-tight">
                필수 항목을 입력하면 캔버스에 즉시 반영됩니다.
                템플릿에 미리 표시된 같은 항목이 있으면 그 글자가 바뀌고,
                없으면 새 텍스트 박스가 자동으로 추가됩니다.
              </p>
              {productFields.map(f => (
                <div key={f.key}>
                  <label className="block text-[10px] text-gray-500 mb-0.5">{f.label}</label>
                  {f.type === 'multiline' ? (
                    <textarea
                      value={requiredFieldValues[f.key] ?? ''}
                      onChange={e => {
                        const v = e.target.value
                        setRequiredFieldValues(prev => ({ ...prev, [f.key]: v }))
                        applyRequiredField(f.key, v)
                      }}
                      placeholder={f.placeholder}
                      rows={3}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-none"
                    />
                  ) : (
                    <input
                      type={f.type === 'email' ? 'email' : f.type === 'phone' ? 'tel' : 'text'}
                      value={requiredFieldValues[f.key] ?? ''}
                      onChange={e => {
                        const v = e.target.value
                        setRequiredFieldValues(prev => ({ ...prev, [f.key]: v }))
                        applyRequiredField(f.key, v)
                      }}
                      placeholder={f.placeholder}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Contact smart fields panel */}
          {activePanel === 'contact' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              <p className="text-[10px] text-gray-400 leading-tight">
                연락처를 입력하고 &ldquo;디자인에 적용&rdquo;을 누르면 캔버스에 자동 배치됩니다.
              </p>
              {([
                { key: 'name',     label: '이름 (Name)',       placeholder: 'John Doe' },
                { key: 'title',    label: '직함 (Title)',      placeholder: 'Senior Designer' },
                { key: 'company',  label: '회사 (Company)',    placeholder: 'ACME Corp.' },
                { key: 'phone',    label: '전화 (Phone)',      placeholder: '+1 (555) 000-0000' },
                { key: 'email',    label: '이메일 (Email)',    placeholder: 'you@company.com' },
                { key: 'website',  label: '웹사이트 (Web)',    placeholder: 'www.yoursite.com' },
                { key: 'linkedin', label: 'LinkedIn URL',      placeholder: 'linkedin.com/in/you' },
              ] as const).map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-[10px] text-gray-500 mb-0.5">{label}</label>
                  <input
                    type="text"
                    value={contactFields[key]}
                    onChange={e => setContactFields(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                </div>
              ))}
              <button
                onClick={() => applyContactFields(contactFields)}
                className="w-full rounded-lg bg-indigo-600 py-2 text-xs font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                디자인에 적용
              </button>
            </div>
          )}

          {/* Templates panel */}
          {activePanel === 'templates' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {/* Phase D: Logo upload */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">로고 (Logo)</label>
                <button
                  onClick={() => logoInputRef.current?.click()}
                  className="w-full rounded-lg border border-dashed border-gray-300 py-2 text-xs text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
                >
                  + 로고 이미지 업로드
                </button>
                <input ref={logoInputRef} type="file" accept="image/png,image/svg+xml,image/jpeg" onChange={handleLogoUpload} className="hidden" />
                <p className="text-[10px] text-gray-400 mt-0.5">PNG/SVG 권장 (투명 배경)</p>
              </div>

              {/* Phase C: Brand palette */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">브랜드 팔레트</label>
                <div className="grid grid-cols-4 gap-1">
                  {PALETTE_CATALOG.map(p => (
                    <button
                      key={p.name}
                      title={p.name}
                      onClick={() => applyPalette(p)}
                      className={`rounded p-0.5 border-2 transition-colors ${selectedPalette === p.name ? 'border-indigo-500' : 'border-transparent hover:border-gray-300'}`}
                    >
                      <div className="w-full h-5 rounded-sm flex overflow-hidden">
                        <span className="flex-1" style={{ background: p.bg }} />
                        <span className="flex-1" style={{ background: p.primary }} />
                        <span className="flex-1" style={{ background: p.accent }} />
                        <span className="flex-1" style={{ background: p.body }} />
                      </div>
                      <div className="text-[8px] text-gray-400 text-center truncate mt-0.5">{p.name}</div>
                    </button>
                  ))}
                </div>
                {selectedPalette && (
                  <p className="text-[10px] text-indigo-600 mt-1">✓ {selectedPalette} 적용됨</p>
                )}
              </div>

              {/* Background color */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">배경 색상 (Background)</label>
                <input type="color" value={bgColor} onChange={e => updateBgColor(e.target.value)} className="w-full h-8 rounded cursor-pointer" />
              </div>

              {/* Template search + category filter */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Templates</label>
                <input
                  type="search"
                  value={templateSearch}
                  onChange={e => setTemplateSearch(e.target.value)}
                  placeholder="Search templates..."
                  className="w-full border border-gray-200 rounded px-2 py-1 text-xs mb-2 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
                <div className="flex flex-wrap gap-1 mb-2">
                  {(['all', 'business', 'minimal', 'creative', 'food', 'health', 'tech', 'realestate'] as const).map(cat => (
                    <button
                      key={cat}
                      onClick={() => { setTemplateCategory(cat); setTemplateSearch('') }}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${templateCategory === cat && !templateSearch ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    >
                      {TEMPLATE_CATEGORY_LABELS[cat]}
                    </button>
                  ))}
                </div>
                <div className="space-y-1">
                  {TEMPLATE_CATALOG
                    .filter(t => {
                      if (templateSearch) return t.name.toLowerCase().includes(templateSearch.toLowerCase()) || t.description.toLowerCase().includes(templateSearch.toLowerCase())
                      return templateCategory === 'all' || t.category === templateCategory
                    })
                    .map(t => (
                      <button
                        key={t.name}
                        onClick={() => loadTemplate(t.name, t.bg)}
                        className="w-full text-left rounded-lg border border-gray-200 px-3 py-2 hover:border-indigo-300 hover:bg-indigo-50 transition-colors flex items-center gap-2"
                      >
                        <span className="w-6 h-6 rounded shrink-0 border border-gray-200" style={{ background: t.bg }} />
                        <div>
                          <div className="text-xs font-medium text-gray-700">{t.name}</div>
                          <div className="text-[10px] text-gray-400">{t.description}</div>
                        </div>
                      </button>
                    ))}
                </div>
              </div>

              {/* Phase 6: QR Code tool */}
              <div>
                <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                  <QrCode className="w-3 h-3" /> QR Code
                </label>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={qrUrl}
                    onChange={e => setQrUrl(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addQrCode(qrUrl)}
                    placeholder="https://..."
                    className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs min-w-0"
                  />
                  <button
                    onClick={() => addQrCode(qrUrl)}
                    disabled={!qrUrl.trim()}
                    className="px-2 py-1 rounded bg-indigo-600 text-white text-xs hover:bg-indigo-700 disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Phase 4: Save design */}
              <div>
                <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                  <Save className="w-3 h-3" /> Save Design
                </label>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={saveDesignName}
                    onChange={e => setSaveDesignName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveDesign(saveDesignName)}
                    placeholder="Design name..."
                    className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs min-w-0"
                  />
                  <button
                    onClick={() => saveDesign(saveDesignName)}
                    disabled={!saveDesignName.trim()}
                    className="px-2 py-1 rounded bg-indigo-600 text-white text-xs hover:bg-indigo-700 disabled:opacity-40"
                  >
                    Save
                  </button>
                </div>
              </div>

              {/* Phase 4: Saved designs */}
              {savedDesigns.filter(d => d.productSlug === product.slug).length > 0 && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                    <FolderOpen className="w-3 h-3" /> Saved Designs
                  </label>
                  <div className="space-y-1">
                    {savedDesigns
                      .filter(d => d.productSlug === product.slug)
                      .map(design => (
                        <div key={design.id} className="flex items-center gap-1.5 rounded-lg border border-gray-200 p-1.5">
                          {design.thumbnail && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={design.thumbnail} alt="" className="w-10 h-6 object-cover rounded shrink-0 border border-gray-100" />
                          )}
                          <button
                            onClick={() => loadSavedDesign(design)}
                            className="flex-1 text-left"
                          >
                            <div className="text-[11px] font-medium text-gray-700 truncate">{design.name}</div>
                            <div className="text-[9px] text-gray-400">{new Date(design.savedAt).toLocaleDateString()}</div>
                          </button>
                          <button
                            onClick={() => deleteSavedDesign(design.id)}
                            className="text-red-400 hover:text-red-600 shrink-0"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Shapes panel */}
          {activePanel === 'shapes' && (
            <div className="flex-1 overflow-y-auto p-3">
              <p className="text-[11px] text-gray-400 mb-2">Click a shape to add it to the canvas.</p>
              <div className="grid grid-cols-4 gap-2">
                {SHAPE_PRESETS.map(preset => (
                  <button
                    key={preset.name}
                    onClick={() => addShape(preset)}
                    title={preset.name}
                    className="flex flex-col items-center gap-1 p-2 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors text-gray-600"
                  >
                    <span className="text-gray-500">{preset.icon}</span>
                    <span className="text-[9px] text-gray-400 truncate w-full text-center">{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Layers panel */}
          {activePanel === 'layers' && (
            <div className="flex-1 overflow-y-auto">
              {layers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-gray-400 text-sm gap-2">
                  <Layers className="w-6 h-6" />
                  No layers
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
                  <Plus className="w-3.5 h-3.5" /> Text
                </button>
                <button onClick={addRectLayer} className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 py-2 text-xs text-gray-500 hover:text-gray-700 hover:border-gray-400">
                  <Plus className="w-3.5 h-3.5" /> Shape
                </button>
              </div>
            </div>
          )}

          {/* Properties panel */}
          {activePanel === 'properties' && selectedProps && selectedLayer && (
            <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
              {/* Name */}
              <div>
                <label className="block text-gray-500 mb-1">Layer Name</label>
                <input
                  type="text"
                  value={selectedLayer.name}
                  onChange={e => updateLayerName(selectedId!, e.target.value)}
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs"
                />
              </div>

              {/* Position / Angle */}
              <div>
                <label className="block text-gray-500 mb-1">Position / Size</label>
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
                    <span className="text-gray-400 w-8">Angle</span>
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
                    <label className="block text-gray-500 mb-1">Text</label>
                    <textarea
                      value={selectedProps.text ?? ''}
                      onChange={e => updateSelected({ text: e.target.value })}
                      rows={3}
                      className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-500 mb-1">Font</label>
                    <select
                      value={selectedProps.fontFamily ?? 'Arial'}
                      onChange={e => updateSelected({ fontFamily: e.target.value })}
                      className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs"
                    >
                      {(['sans','serif','display','system'] as const).map(cat => {
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
                      <label className="block text-gray-500 mb-1">Size (px)</label>
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
                    <label className="block text-gray-500 mb-1">Color</label>
                    <input
                      type="color"
                      value={selectedProps.fill ?? '#000000'}
                      onChange={e => updateSelected({ fill: e.target.value })}
                      className="w-full h-8 rounded cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-500 mb-1">Alignment</label>
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
                      <label className="block text-gray-500 mb-1">Letter Spacing</label>
                      <input
                        type="number"
                        value={selectedProps.charSpacing ?? 0}
                        step={10}
                        onChange={e => updateSelected({ charSpacing: parseFloat(e.target.value) })}
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-500 mb-1">Line Height</label>
                      <input
                        type="number"
                        value={selectedProps.lineHeight ?? 1.4}
                        step={0.1} min={0.8} max={4}
                        onChange={e => updateSelected({ lineHeight: parseFloat(e.target.value) })}
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs"
                      />
                    </div>
                  </div>

                  {/* Text outline */}
                  <div>
                    <label className="block text-gray-500 mb-1">Outline</label>
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
                        placeholder="Width"
                      />
                    </div>
                  </div>

                  {/* Text shadow */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-gray-500">Shadow</label>
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
                          <span className="text-gray-400 text-[10px]">Color</span>
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
                    <label className="block text-gray-500 mb-1">Fill Color</label>
                    <input
                      type="color"
                      value={selectedProps.fillColor ?? '#e5e7eb'}
                      onChange={e => updateSelected({ fillColor: e.target.value })}
                      className="w-full h-8 rounded cursor-pointer"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="block text-gray-500 mb-1">Stroke Color</label>
                      <input
                        type="color"
                        value={selectedProps.strokeColor ?? '#000000'}
                        onChange={e => updateSelected({ strokeColor: e.target.value })}
                        className="w-full h-8 rounded cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-500 mb-1">Stroke Width</label>
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

              {/* Image-specific */}
              {selectedLayer.type === 'image' && (
                <>
                  {/* Crop */}
                  <div>
                    <label className="block text-gray-500 mb-1">Crop</label>
                    {cropActive ? (
                      <>
                        <p className="text-[10px] text-indigo-500 mb-1.5">Drag the blue overlay to set crop area.</p>
                        <div className="flex gap-1.5">
                          <button
                            onClick={applyCrop}
                            className="flex-1 py-1.5 text-xs rounded bg-indigo-600 text-white font-medium hover:bg-indigo-700"
                          >
                            Apply
                          </button>
                          <button
                            onClick={cancelCrop}
                            className="flex-1 py-1.5 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex gap-1.5">
                        <button
                          onClick={startCrop}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
                        >
                          <Crop className="w-3 h-3" /> Crop
                        </button>
                        {selectedProps.hasCrop && (
                          <button
                            onClick={resetCrop}
                            className="flex-1 py-1.5 text-xs rounded border border-gray-200 text-gray-500 hover:bg-gray-50"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {!cropActive && (
                  <>
                  {/* Blend Mode */}
                  <div>
                    <label className="block text-gray-500 mb-1">Blend Mode</label>
                    <select
                      value={selectedProps.blendMode ?? 'source-over'}
                      onChange={e => updateSelected({ blendMode: e.target.value })}
                      className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs"
                    >
                      {BLEND_MODES.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-gray-500">Opacity</label>
                      <span className="text-gray-400 text-[10px]">{Math.round((selectedProps.opacity ?? 1) * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0} max={1} step={0.01}
                      value={selectedProps.opacity ?? 1}
                      onChange={e => updateSelected({ opacity: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-gray-500">Brightness</label>
                      <span className="text-gray-400 text-[10px]">{Math.round((selectedProps.brightness ?? 0) * 100)}</span>
                    </div>
                    <input
                      type="range"
                      min={-1} max={1} step={0.01}
                      value={selectedProps.brightness ?? 0}
                      onChange={e => updateSelected({ brightness: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-gray-500">Contrast</label>
                      <span className="text-gray-400 text-[10px]">{Math.round((selectedProps.contrast ?? 0) * 100)}</span>
                    </div>
                    <input
                      type="range"
                      min={-1} max={1} step={0.01}
                      value={selectedProps.contrast ?? 0}
                      onChange={e => updateSelected({ contrast: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-gray-500">Saturation</label>
                      <span className="text-gray-400 text-[10px]">{Math.round((selectedProps.saturation ?? 0) * 100)}</span>
                    </div>
                    <input
                      type="range"
                      min={-1} max={1} step={0.01}
                      value={selectedProps.saturation ?? 0}
                      onChange={e => updateSelected({ saturation: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-gray-500">Grayscale</label>
                    <button
                      onClick={() => updateSelected({ grayscale: !selectedProps.grayscale })}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${selectedProps.grayscale ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}
                    >
                      {selectedProps.grayscale ? 'ON' : 'OFF'}
                    </button>
                  </div>
                  <button
                    onClick={() => replaceImageInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 py-2 text-xs text-gray-600 hover:bg-gray-50"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Replace Image
                  </button>
                  <button
                    onClick={() => updateSelected({ brightness: 0, contrast: 0, saturation: 0, grayscale: false, opacity: 1 })}
                    className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 py-2 text-xs text-gray-500 hover:bg-gray-50"
                  >
                    Reset Filters
                  </button>
                  </>)}
                </>
              )}

              <button
                onClick={deleteSelectedLayer}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-red-200 py-2 text-xs text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Layer
              </button>
            </div>
          )}

          {activePanel === 'properties' && !selectedProps && (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-xs">
              Select a layer
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
