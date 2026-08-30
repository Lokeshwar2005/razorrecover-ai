export type WatchBrand =
  | 'Titan'
  | 'Fastrack'
  | 'Casio'
  | 'Seiko'
  | 'Citizen'
  | 'Fossil'
  | 'Garmin'
  | 'Apple Watch'
  | 'Samsung Galaxy Watch'
  | 'Amazfit'
  | 'Noise'
  | 'boAt'

export type WatchCategory =
  | "Men's Watches"
  | "Women's Watches"
  | 'Smart Watches'
  | 'Luxury Watches'
  | 'Sports Watches'
  | 'Fitness Watches'
  | 'Chronographs'
  | 'Automatic Watches'
  | 'Digital Watches'

export interface WatchReview {
  id: string
  reviewer_name: string
  rating: number // 1 to 5
  date: string
  verified_purchase: boolean
  title: string
  comment: string
  helpful_votes?: number
}

export interface WatchSpecs {
  movement: string
  case_size: string
  case_material: string
  dial_color: string
  strap_material: string
  strap_color: string
  water_resistance: string
  battery_life?: string
  display_type?: string
  connectivity?: string
  sensors?: string[]
  warranty: string
  origin?: string
}

export interface WatchProduct {
  id: string
  name: string
  brand: WatchBrand
  series: string
  model: string
  price_rupees: number
  original_price_rupees: number
  discount_percent: number
  rating: number
  review_count: number
  stock_status: 'In Stock' | 'Only 2 Left' | 'Pre-Order'
  in_stock: boolean
  category: WatchCategory
  gender: 'Men' | 'Women' | 'Unisex'
  featured?: boolean
  badge?: string | null
  description: string
  highlights: string[]
  images: string[]
  specs: WatchSpecs
  reviews: WatchReview[]
  color_variants?: { name: string; hex: string; image?: string }[]
}

export interface CartItem {
  product: WatchProduct
  quantity: number
  selected_color?: string
}

export interface ShippingAddress {
  full_name: string
  email: string
  phone: string
  address_line1: string
  address_line2?: string
  city: string
  state: string
  pincode: string
}

export type FailureScenario =
  | 'success'
  | 'insufficient_funds'
  | 'gateway_timeout'
  | 'card_declined'
  | 'checkout_abandoned'
