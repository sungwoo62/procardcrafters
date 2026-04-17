export type ProductCategory = 'business_cards' | 'stickers' | 'flyers' | 'postcards' | 'posters'
export type OptionType = 'quantity' | 'paper' | 'coating' | 'size' | 'finish'
export type OrderStatus = 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded'
export type FileStatus = 'uploaded' | 'approved' | 'rejected' | 'processing'

export interface PrintProduct {
  id: string
  slug: string
  name_ko: string
  name_en: string
  description_ko: string | null
  category: ProductCategory
  base_price_krw: number
  margin_multiplier: number
  is_active: boolean
  sort_order: number
  thumbnail_url: string | null
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
  is_default: boolean
  sort_order: number
  created_at: string
}

export interface PrintOrder {
  id: string
  order_number: string
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
