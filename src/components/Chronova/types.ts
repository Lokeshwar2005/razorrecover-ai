export type WatchBrand =
  | 'Titan'
  | 'Fastrack'
  | 'Casio'
  | 'Noise'
  | 'Fossil'

export type WatchCategory =
  | 'Analog Watches'
  | 'Digital Watches'
  | 'Smart Watches'
  | 'Automatic Watches'
  | 'Chronograph'
  | 'Sports Watches'
  | 'Dress Watches'
  | 'Casual Watches'
  | 'Luxury Watches'
  | 'Fitness Watches'
  | 'Outdoor Watches'
  | 'Minimal Watches'

export type WatchVibe =
  | 'Everyday'
  | 'Office'
  | 'Street'
  | 'Sport'
  | 'Party'
  | 'Travel'
  | 'Minimal'
  | 'Premium'

export interface WatchReview {
  id: string
  reviewer_name: string
  rating: number
  date: string
  verified_purchase: boolean
  title: string
  comment: string
  helpful_votes: number
}

export interface WatchSpecs {
  movement: string
  case_size: string
  case_thickness?: string
  case_material: string
  dial_color: string
  strap_material: string
  strap_color: string
  water_resistance: string
  battery_life: string
  glass?: string
  display_type?: string
  display_size?: string
  resolution?: string
  bluetooth_calling?: boolean
  gps?: boolean
  sensors?: string[]
  sports_modes?: number
  warranty: string
  origin?: string
}

export interface WatchColorVariant {
  name: string
  hex: string
  image_url?: string
}

export interface ChronovaProduct {
  id: string
  brand: WatchBrand
  series: string
  model: string
  name: string
  category: WatchCategory
  vibe: WatchVibe
  gender: 'Men' | 'Women' | 'Unisex'
  price_rupees: number
  original_price_rupees: number
  discount_percent: number
  currency: string
  rating: number
  review_count: number
  stock_status: string
  in_stock: boolean
  featured?: boolean
  is_new_arrival?: boolean
  is_bestseller?: boolean
  badge?: string | null
  description: string
  highlights: string[]
  images: {
    primary: string
    gallery: string[]
  }
  primaryImage?: string
  thumbnailImage?: string
  color_variants: WatchColorVariant[]
  specs: WatchSpecs
  reviews: WatchReview[]
}

export interface CartItem {
  product: ChronovaProduct
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

export interface AppliedCoupon {
  code: string
  discountPercent?: number
  flatDiscount?: number
  description: string
}

