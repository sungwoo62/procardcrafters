export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parent_id?: string | null;
  sort_order: number;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  category_id: string;
  description?: string;
  base_price?: number;
  thumbnail_url?: string;
  image_url?: string;
  min_qty?: number;
  lead_days?: number;
  is_active: boolean;
  created_at?: string;
}

export interface OptionGroup {
  id: string;
  product_id: string;
  name: string;
  label: string;
  sort_order: number;
}

export interface OptionValue {
  id: string;
  group_id: string;
  name: string;
  label: string;
  sort_order: number;
}

export interface PriceRule {
  id: string;
  product_id: string;
  option_combination: Record<string, string>;
  price: number;
}

export interface PrintOrder {
  id?: string;
  name: string;
  email: string;
  product?: string;
  quantity?: number;
  message?: string;
  site: string;
  created_at?: string;
}
