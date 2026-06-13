import type { PrintSpec } from '@/lib/print-spec'
export type { PrintSpec } from '@/lib/print-spec'

export type ProductCategory =
  | 'business_cards' | 'premium_business_cards' | 'premium_foil_cards'
  | 'stickers' | 'die_cut_stickers' | 'eco_stickers'
  | 'flyers' | 'brochures'
  | 'postcards' | 'posters' | 'banners'
  | 'letterpress_cards'
  | 'sample_pack'
// OMO-2635: 실제 print_product_options.option_type 값과 타입을 동기화(드리프트 정리).
//   paper_qty/paper_size/print_color_type 는 시드 데이터에 이미 존재했으나 union 누락.
//   finishing 은 후가공을 실주문옵션으로 전환하며 신설(성원 자동발주 와이어링).
export type OptionType =
  | 'quantity' | 'paper_qty'
  | 'paper' | 'paper_code'
  | 'coating' | 'size' | 'paper_size'
  | 'finish' | 'finishing'
  | 'print_color_type'
  | 'corners' | 'sides' | 'pages'
export type OrderStatus = 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded'
export type FileStatus = 'uploaded' | 'approved' | 'rejected' | 'processing'
export type DesignProofStatus = 'pending' | 'approved' | 'revision_requested'

export interface PrintProduct {
  id: string
  slug: string
  name_ko: string
  name_en: string
  description_ko: string | null
  description_en: string | null
  recommended_use_ko: string | null
  recommended_use_en: string | null
  category: ProductCategory
  base_price_krw: number
  margin_multiplier: number
  is_active: boolean
  is_premium: boolean
  badge_text_ko: string | null
  badge_text_en: string | null
  production_days_min: number
  production_days_max: number
  min_order_quantity: number
  sort_order: number
  thumbnail_url: string | null
  hero_image_url: string | null
  default_weight_kg: number
  unit_weight_g: number
  // OMO-3058: true=배송비 단가포함·무료배송 표시(패키지류). 운임은 margin 으로 흡수.
  free_shipping?: boolean
  // OMO-3026: 제품별 인쇄규격(트림/블리드/세이프/최소DPI/색공간). 시드 전 제품은 null.
  print_spec: PrintSpec | null
  created_at: string
  updated_at: string
}

export interface PrintProductOption {
  id: string
  product_id: string
  option_type: OptionType
  label_ko: string
  label_en: string
  value: string
  extra_price_krw: number
  weight_modifier_g: number
  description_ko: string | null
  description_en: string | null
  image_url: string | null
  is_default: boolean
  sort_order: number
  created_at: string
}

export interface PrintOrder {
  id: string
  order_number: string
  user_id: string | null
  customer_email: string
  customer_name: string
  customer_phone: string | null
  shipping_name: string
  shipping_address_line1: string
  shipping_address_line2: string | null
  shipping_city: string
  shipping_state: string | null
  shipping_country: string
  shipping_postal_code: string
  subtotal_usd: number
  shipping_usd: number
  total_usd: number
  exchange_rate_krw_usd: number | null
  stripe_payment_intent_id: string | null
  stripe_session_id: string | null
  status: OrderStatus
  notes: string | null
  tracking_number: string | null
  created_at: string
  updated_at: string
}

export interface PrintOrderItem {
  id: string
  order_id: string
  product_id: string
  product_name_ko: string
  product_name_en: string
  selected_options: Record<string, string>
  quantity: number
  unit_price_usd: number
  subtotal_usd: number
  created_at: string
}

export interface PrintFile {
  id: string
  order_id: string | null
  order_item_id: string | null
  storage_path: string
  original_filename: string
  file_size_bytes: number | null
  mime_type: string | null
  status: FileStatus
  rejection_reason: string | null
  uploaded_at: string
}

// OMO-3028: 결제후 업로드 시안 동의/책임 고지 기록
export interface PrintDesignConsent {
  id: string
  order_id: string
  order_item_id: string | null
  file_id: string | null
  consent_text: string
  consent_version: string
  preflight_snapshot: unknown | null
  ip_hash: string | null
  user_agent: string | null
  agreed_at: string
}

export interface PrintDesignProof {
  id: string
  order_id: string
  storage_path: string
  original_filename: string
  file_size_bytes: number | null
  mime_type: string | null
  admin_note: string | null
  status: DesignProofStatus
  customer_comment: string | null
  version: number
  uploaded_by: string
  uploaded_at: string
  responded_at: string | null
}

export type CompetitorName = 'vistaprint' | 'moo'

export interface CompetitorPrice {
  id: string
  sku_slug: string
  competitor: CompetitorName
  sku_variant: string
  quantity: number | null
  competitor_price_usd: number
  our_price_usd: number
  spec_notes: string | null
  captured_at: string
  source_url: string
  captured_by: string
  created_at: string
}

export interface CompetitorPriceSummary extends CompetitorPrice {
  is_fresh: boolean
  savings_pct: number
  captured_date: string
}
