'use client'

import React, { useState, useMemo, useRef } from 'react'
import {
  CHRONOVA_CATALOG,
  ALL_BRANDS,
  ALL_CATEGORIES,
  ALL_VIBES,
} from '../../data/chronovaCatalog'
import type {
  ChronovaProduct,
  CartItem,
  WatchBrand,
  WatchCategory,
  WatchVibe,
} from './types'
import { ProductCard } from './ProductCard'
import { ProductDetailModal } from './ProductDetailModal'
import { CartDrawer } from './CartDrawer'
import { CheckoutModal } from './CheckoutModal'

export const ChronovaStore: React.FC = () => {
  // Navigation & Filter States
  const [activeNavTab, setActiveNavTab] = useState<string>('WATCHES')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedBrands, setSelectedBrands] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedGenders, setSelectedGenders] = useState<string[]>([])
  const [selectedMovements, setSelectedMovements] = useState<string[]>([])
  const [selectedDisplayTypes, setSelectedDisplayTypes] = useState<string[]>([])
  const [selectedDialColors, setSelectedDialColors] = useState<string[]>([])
  const [selectedStrapMaterials, setSelectedStrapMaterials] = useState<string[]>([])
  const [selectedDiscounts, setSelectedDiscounts] = useState<number[]>([])
  const [selectedPriceRanges, setSelectedPriceRanges] = useState<string[]>([])
  const [inStockOnly, setInStockOnly] = useState<boolean>(false)
  const [sortBy, setSortBy] = useState<
    'relevance' | 'newest' | 'bestsellers' | 'popularity' | 'discount' | 'price_desc' | 'price_asc' | 'rating'
  >('relevance')

  // Filter Accordion Expand/Collapse States
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({
    brand: true,
    category: true,
    price: true,
    gender: true,
    movement: false,
    display: false,
    dial: false,
    strap: false,
    discount: false,
    availability: false,
  })

  const toggleAccordion = (section: string) => {
    setOpenAccordions((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  // Modals & Drawers
  const [selectedProduct, setSelectedProduct] = useState<ChronovaProduct | null>(null)
  const [quickViewProduct, setQuickViewProduct] = useState<ChronovaProduct | null>(null)
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set())
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false)
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false)
  const [wishlistOpenOnly, setWishlistOpenOnly] = useState<boolean>(false)
  const [mobileFilterOpen, setMobileFilterOpen] = useState<boolean>(false)
  const [mobileSortOpen, setMobileSortOpen] = useState<boolean>(false)
  const [showPromoBar, setShowPromoBar] = useState<boolean>(true)

  // Toggle Selection Helper
  const toggleArrayItem = <T,>(arr: T[], item: T, setter: (val: T[]) => void) => {
    if (arr.includes(item)) {
      setter(arr.filter((i) => i !== item))
    } else {
      setter([...arr, item])
    }
  }

  const handleClearAllFilters = () => {
    setSelectedBrands([])
    setSelectedCategories([])
    setSelectedGenders([])
    setSelectedMovements([])
    setSelectedDisplayTypes([])
    setSelectedDialColors([])
    setSelectedStrapMaterials([])
    setSelectedDiscounts([])
    setSelectedPriceRanges([])
    setInStockOnly(false)
    setSearchQuery('')
    setWishlistOpenOnly(false)
    setSortBy('relevance')
  }

  // Filter List Definitions
  const priceRanges = [
    { label: 'Under ₹2,000', min: 0, max: 2000, id: 'under-2k' },
    { label: '₹2,000 - ₹5,000', min: 2000, max: 5000, id: '2k-5k' },
    { label: '₹5,000 - ₹10,000', min: 5000, max: 10000, id: '5k-10k' },
    { label: '₹10,000 - ₹25,000', min: 10000, max: 25000, id: '10k-25k' },
    { label: 'Above ₹25,000', min: 25000, max: 1000000, id: 'above-25k' },
  ]

  const movementOptions = ['Precision Japanese Quartz', 'Mechanical Automatic', 'Smart Digital OS']
  const displayOptions = ['AMOLED', 'High-Res TFT', 'Analog Dial', 'Digital LCD']
  const dialColors = ['Obsidian Black', 'Sunburst Midnight Blue', 'Emerald Green', 'Champagne Gold', 'Silver Sunray']
  const strapMaterials = ['Genuine Leather', 'Stainless Steel', 'Silicone', 'Ceramic', 'Titanium Mesh']

  // Filtered & Sorted Catalog
  const filteredProducts = useMemo(() => {
    return CHRONOVA_CATALOG.filter((p) => {
      // Wishlist filter
      if (wishlistOpenOnly && !wishlistIds.has(p.id)) return false

      // Top Nav Tab Filter
      if (activeNavTab === 'SMART WATCHES' && p.category !== 'Smart Watches' && p.category !== 'Fitness Watches') return false
      if (activeNavTab === 'NEW ARRIVALS' && !p.is_new_arrival) return false
      if (activeNavTab === 'BESTSELLERS' && !p.is_bestseller) return false
      if (activeNavTab === 'SALE' && p.discount_percent <= 0) return false

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchName = p.name.toLowerCase().includes(query)
        const matchBrand = p.brand.toLowerCase().includes(query)
        const matchCat = p.category.toLowerCase().includes(query)
        const matchSeries = p.series.toLowerCase().includes(query)
        const matchVibe = p.vibe.toLowerCase().includes(query)
        const matchMovement = p.specs.movement.toLowerCase().includes(query)
        if (!matchName && !matchBrand && !matchCat && !matchSeries && !matchVibe && !matchMovement) {
          return false
        }
      }

      // Brand Filter
      if (selectedBrands.length > 0 && !selectedBrands.includes(p.brand)) return false

      // Category Filter
      if (selectedCategories.length > 0 && !selectedCategories.includes(p.category)) return false

      // Gender Filter
      if (selectedGenders.length > 0 && !selectedGenders.includes(p.gender)) return false

      // Movement Filter
      if (selectedMovements.length > 0 && !selectedMovements.some((m) => p.specs.movement.includes(m))) return false

      // Display Type Filter
      if (selectedDisplayTypes.length > 0 && !selectedDisplayTypes.some((d) => (p.specs.display_type || '').includes(d))) return false

      // Dial Color Filter
      if (selectedDialColors.length > 0 && !selectedDialColors.some((c) => (p.specs.dial_color || '').includes(c))) return false

      // Strap Material Filter
      if (selectedStrapMaterials.length > 0 && !selectedStrapMaterials.some((s) => (p.specs.strap_material || '').includes(s))) return false

      // Discount Filter
      if (selectedDiscounts.length > 0 && !selectedDiscounts.some((d) => p.discount_percent >= d)) return false

      // Price Range Filter
      if (selectedPriceRanges.length > 0) {
        const matchPrice = selectedPriceRanges.some((rangeId) => {
          const r = priceRanges.find((pr) => pr.id === rangeId)
          if (!r) return true
          return p.price_rupees >= r.min && p.price_rupees < r.max
        })
        if (!matchPrice) return false
      }

      // In Stock Only
      if (inStockOnly && !p.in_stock) return false

      return true
    }).sort((a, b) => {
      if (sortBy === 'bestsellers' || sortBy === 'popularity') return (b.is_bestseller ? 1 : 0) - (a.is_bestseller ? 1 : 0)
      if (sortBy === 'newest') return (b.is_new_arrival ? 1 : 0) - (a.is_new_arrival ? 1 : 0)
      if (sortBy === 'price_asc') return a.price_rupees - b.price_rupees
      if (sortBy === 'price_desc') return b.price_rupees - a.price_rupees
      if (sortBy === 'rating') return b.rating - a.rating
      if (sortBy === 'discount') return b.discount_percent - a.discount_percent
      return 0
    })
  }, [
    activeNavTab,
    searchQuery,
    selectedBrands,
    selectedCategories,
    selectedGenders,
    selectedMovements,
    selectedDisplayTypes,
    selectedDialColors,
    selectedStrapMaterials,
    selectedDiscounts,
    selectedPriceRanges,
    inStockOnly,
    sortBy,
    wishlistOpenOnly,
    wishlistIds,
  ])

  const totalCartCount = cartItems.reduce((acc, i) => acc + i.quantity, 0)

  // Total active filter count
  const activeFilterCount =
    selectedBrands.length +
    selectedCategories.length +
    selectedGenders.length +
    selectedMovements.length +
    selectedDisplayTypes.length +
    selectedDialColors.length +
    selectedStrapMaterials.length +
    selectedDiscounts.length +
    selectedPriceRanges.length +
    (inStockOnly ? 1 : 0) +
    (searchQuery ? 1 : 0)

  // Handlers for cart
  const handleAddToCart = (product: ChronovaProduct, qty = 1, color?: string) => {
    setCartItems((prev) => {
      const idx = prev.findIndex((i) => i.product.id === product.id)
      if (idx > -1) {
        const next = [...prev]
        next[idx] = { ...next[idx], quantity: next[idx].quantity + qty }
        return next
      }
      return [...prev, { product, quantity: qty, selected_color: color }]
    })
    setIsCartOpen(true)
  }

  const handleInstantBuy = (product: ChronovaProduct, qty = 1, color?: string) => {
    setCartItems([{ product, quantity: qty, selected_color: color }])
    setIsCheckoutOpen(true)
  }

  const handleToggleWishlist = (product: ChronovaProduct) => {
    setWishlistIds((prev) => {
      const next = new Set(prev)
      if (next.has(product.id)) {
        next.delete(product.id)
      } else {
        next.add(product.id)
      }
      return next
    })
  }

  // Reusable Filter Sidebar Content
  const renderFilterSidebar = () => (
    <div className="space-y-4 text-xs">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <span className="text-sm font-black tracking-wider uppercase text-slate-900">FILTERS</span>
        {activeFilterCount > 0 && (
          <button
            onClick={handleClearAllFilters}
            className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
          >
            CLEAR ALL ({activeFilterCount})
          </button>
        )}
      </div>

      {/* BRAND ACCORDION */}
      <div className="border-b border-slate-200 pb-3">
        <button
          onClick={() => toggleAccordion('brand')}
          className="w-full flex items-center justify-between py-1 text-xs font-bold uppercase text-slate-900 cursor-pointer"
        >
          <span>BRAND</span>
          <span>{openAccordions.brand ? '⌃' : '⌄'}</span>
        </button>
        {openAccordions.brand && (
          <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {ALL_BRANDS.map((brand) => (
              <label key={brand} className="flex items-center gap-2 text-slate-700 cursor-pointer hover:text-slate-900">
                <input
                  type="checkbox"
                  checked={selectedBrands.includes(brand)}
                  onChange={() => toggleArrayItem(selectedBrands, brand, setSelectedBrands)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer"
                />
                <span className="text-xs">{brand}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* CATEGORY ACCORDION */}
      <div className="border-b border-slate-200 pb-3">
        <button
          onClick={() => toggleAccordion('category')}
          className="w-full flex items-center justify-between py-1 text-xs font-bold uppercase text-slate-900 cursor-pointer"
        >
          <span>CATEGORY</span>
          <span>{openAccordions.category ? '⌃' : '⌄'}</span>
        </button>
        {openAccordions.category && (
          <div className="mt-2 space-y-1.5 max-h-44 overflow-y-auto pr-1">
            {ALL_CATEGORIES.map((cat) => (
              <label key={cat} className="flex items-center gap-2 text-slate-700 cursor-pointer hover:text-slate-900">
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(cat)}
                  onChange={() => toggleArrayItem(selectedCategories, cat, setSelectedCategories)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer"
                />
                <span className="text-xs">{cat}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* GENDER ACCORDION */}
      <div className="border-b border-slate-200 pb-3">
        <button
          onClick={() => toggleAccordion('gender')}
          className="w-full flex items-center justify-between py-1 text-xs font-bold uppercase text-slate-900 cursor-pointer"
        >
          <span>GENDER</span>
          <span>{openAccordions.gender ? '⌃' : '⌄'}</span>
        </button>
        {openAccordions.gender && (
          <div className="mt-2 space-y-1.5">
            {['Men', 'Women', 'Unisex'].map((g) => (
              <label key={g} className="flex items-center gap-2 text-slate-700 cursor-pointer hover:text-slate-900">
                <input
                  type="checkbox"
                  checked={selectedGenders.includes(g)}
                  onChange={() => toggleArrayItem(selectedGenders, g, setSelectedGenders)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer"
                />
                <span className="text-xs">{g}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* PRICE RANGE ACCORDION */}
      <div className="border-b border-slate-200 pb-3">
        <button
          onClick={() => toggleAccordion('price')}
          className="w-full flex items-center justify-between py-1 text-xs font-bold uppercase text-slate-900 cursor-pointer"
        >
          <span>PRICE</span>
          <span>{openAccordions.price ? '⌃' : '⌄'}</span>
        </button>
        {openAccordions.price && (
          <div className="mt-2 space-y-1.5">
            {priceRanges.map((pr) => (
              <label key={pr.id} className="flex items-center gap-2 text-slate-700 cursor-pointer hover:text-slate-900">
                <input
                  type="checkbox"
                  checked={selectedPriceRanges.includes(pr.id)}
                  onChange={() => toggleArrayItem(selectedPriceRanges, pr.id, setSelectedPriceRanges)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer"
                />
                <span className="text-xs">{pr.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* MOVEMENT ACCORDION */}
      <div className="border-b border-slate-200 pb-3">
        <button
          onClick={() => toggleAccordion('movement')}
          className="w-full flex items-center justify-between py-1 text-xs font-bold uppercase text-slate-900 cursor-pointer"
        >
          <span>MOVEMENT</span>
          <span>{openAccordions.movement ? '⌃' : '⌄'}</span>
        </button>
        {openAccordions.movement && (
          <div className="mt-2 space-y-1.5">
            {movementOptions.map((mov) => (
              <label key={mov} className="flex items-center gap-2 text-slate-700 cursor-pointer hover:text-slate-900">
                <input
                  type="checkbox"
                  checked={selectedMovements.includes(mov)}
                  onChange={() => toggleArrayItem(selectedMovements, mov, setSelectedMovements)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer"
                />
                <span className="text-xs">{mov}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* DISPLAY TYPE ACCORDION */}
      <div className="border-b border-slate-200 pb-3">
        <button
          onClick={() => toggleAccordion('display')}
          className="w-full flex items-center justify-between py-1 text-xs font-bold uppercase text-slate-900 cursor-pointer"
        >
          <span>DISPLAY TYPE</span>
          <span>{openAccordions.display ? '⌃' : '⌄'}</span>
        </button>
        {openAccordions.display && (
          <div className="mt-2 space-y-1.5">
            {displayOptions.map((disp) => (
              <label key={disp} className="flex items-center gap-2 text-slate-700 cursor-pointer hover:text-slate-900">
                <input
                  type="checkbox"
                  checked={selectedDisplayTypes.includes(disp)}
                  onChange={() => toggleArrayItem(selectedDisplayTypes, disp, setSelectedDisplayTypes)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer"
                />
                <span className="text-xs">{disp}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* STRAP MATERIAL ACCORDION */}
      <div className="border-b border-slate-200 pb-3">
        <button
          onClick={() => toggleAccordion('strap')}
          className="w-full flex items-center justify-between py-1 text-xs font-bold uppercase text-slate-900 cursor-pointer"
        >
          <span>STRAP MATERIAL</span>
          <span>{openAccordions.strap ? '⌃' : '⌄'}</span>
        </button>
        {openAccordions.strap && (
          <div className="mt-2 space-y-1.5">
            {strapMaterials.map((strap) => (
              <label key={strap} className="flex items-center gap-2 text-slate-700 cursor-pointer hover:text-slate-900">
                <input
                  type="checkbox"
                  checked={selectedStrapMaterials.includes(strap)}
                  onChange={() => toggleArrayItem(selectedStrapMaterials, strap, setSelectedStrapMaterials)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer"
                />
                <span className="text-xs">{strap}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* DISCOUNT ACCORDION */}
      <div className="border-b border-slate-200 pb-3">
        <button
          onClick={() => toggleAccordion('discount')}
          className="w-full flex items-center justify-between py-1 text-xs font-bold uppercase text-slate-900 cursor-pointer"
        >
          <span>DISCOUNT</span>
          <span>{openAccordions.discount ? '⌃' : '⌄'}</span>
        </button>
        {openAccordions.discount && (
          <div className="mt-2 space-y-1.5">
            {[10, 20, 30].map((d) => (
              <label key={d} className="flex items-center gap-2 text-slate-700 cursor-pointer hover:text-slate-900">
                <input
                  type="checkbox"
                  checked={selectedDiscounts.includes(d)}
                  onChange={() => toggleArrayItem(selectedDiscounts, d, setSelectedDiscounts)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer"
                />
                <span className="text-xs">{d}% and above</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* AVAILABILITY ACCORDION */}
      <div className="pb-3">
        <label className="flex items-center gap-2 text-slate-800 font-bold cursor-pointer">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => setInStockOnly(e.target.checked)}
            className="rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer"
          />
          <span className="text-xs uppercase">In Stock Only</span>
        </label>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans antialiased selection:bg-slate-900 selection:text-white">
      {/* 1. Top Promotional Bar (Dismissible) */}
      {showPromoBar && (
        <div className="bg-slate-900 px-4 py-2 text-center text-xs font-semibold text-white tracking-wider flex items-center justify-between">
          <div className="flex-1 text-center">
            TIMELESS STYLE. NEW ARRIVALS ARE HERE. · EXTRA 10% OFF WITH CODE <strong className="text-amber-400 font-mono">CHRONOVA10</strong> · FREE SHIPPING ACROSS INDIA
          </div>
          <button
            onClick={() => setShowPromoBar(false)}
            className="text-slate-400 hover:text-white text-sm ml-2 cursor-pointer"
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. Main Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20 gap-4 sm:gap-8">
            {/* Logo */}
            <div
              onClick={() => {
                setActiveNavTab('WATCHES')
                handleClearAllFilters()
              }}
              className="flex items-center gap-2.5 cursor-pointer shrink-0"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white font-black text-xl shadow-md">
                ⧖
              </div>
              <div className="flex flex-col">
                <span className="text-xl sm:text-2xl font-black tracking-widest text-slate-900 leading-none">
                  CHRONOVA
                </span>
                <span className="text-[9px] font-bold tracking-widest text-blue-700 uppercase">
                  Find Your Time.
                </span>
              </div>
            </div>

            {/* Main Search Bar (Center / Large with Instant Autocomplete) */}
            <div className="flex-1 max-w-2xl relative hidden md:block">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search watches, smartwatches & brands..."
                className="w-full pl-11 pr-10 py-2.5 rounded-full bg-slate-100 border border-slate-300 text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:bg-white transition shadow-xs"
              />
              <span className="absolute left-4 top-3 text-slate-400 text-xs">🔍</span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-2.5 text-xs text-slate-400 hover:text-slate-700 p-1"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Header Right Actions */}
            <div className="flex items-center gap-3 sm:gap-5 shrink-0">
              <button
                onClick={() => alert('Customer Portal: 100% Genuine Certified & Doorstep Warranty Assistance.')}
                className="hidden sm:flex flex-col items-center text-slate-700 hover:text-slate-900 cursor-pointer"
              >
                <span className="text-lg">👤</span>
                <span className="text-[10px] font-bold">Account</span>
              </button>

              <button
                onClick={() => setWishlistOpenOnly((prev) => !prev)}
                className={`flex flex-col items-center p-1 rounded-xl transition cursor-pointer relative ${
                  wishlistOpenOnly ? 'text-rose-600 font-bold' : 'text-slate-700 hover:text-slate-900'
                }`}
                title="Wishlist"
              >
                <span className="text-lg">❤️</span>
                <span className="text-[10px] font-bold">Wishlist</span>
                {wishlistIds.size > 0 && (
                  <span className="absolute -top-1 -right-1.5 w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] font-black flex items-center justify-center font-mono">
                    {wishlistIds.size}
                  </span>
                )}
              </button>

              <button
                onClick={() => setIsCartOpen(true)}
                className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-slate-900 hover:bg-blue-600 text-white transition shadow-sm cursor-pointer"
              >
                <span className="text-base">🛍️</span>
                <span className="text-xs font-black tracking-wide hidden sm:inline">CART</span>
                <span className="w-5 h-5 rounded-full bg-white text-slate-900 text-xs font-black font-mono flex items-center justify-center">
                  {totalCartCount}
                </span>
              </button>
            </div>
          </div>

          {/* Navigation Bar */}
          <nav className="flex items-center justify-center gap-6 sm:gap-8 py-2.5 border-t border-slate-100 text-xs font-bold tracking-wider uppercase text-slate-700 overflow-x-auto scrollbar-none">
            {[
              { id: 'WATCHES', label: 'WATCHES' },
              { id: 'SMART WATCHES', label: 'SMART WATCHES' },
              { id: 'NEW ARRIVALS', label: 'NEW ARRIVALS' },
              { id: 'BESTSELLERS', label: 'BESTSELLERS' },
              { id: 'COLLECTIONS', label: 'COLLECTIONS' },
              { id: 'SALE', label: 'SALE', highlight: true },
              { id: 'MORE', label: 'MORE' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveNavTab(tab.id)
                  setWishlistOpenOnly(false)
                }}
                className={`transition cursor-pointer pb-1 whitespace-nowrap border-b-2 ${
                  activeNavTab === tab.id
                    ? 'text-slate-900 border-slate-900 font-black'
                    : tab.highlight
                    ? 'text-rose-600 border-transparent hover:border-rose-600'
                    : 'text-slate-600 border-transparent hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Mobile Search Bar */}
      <div className="p-4 md:hidden bg-slate-50 border-b border-slate-200">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search watches, smartwatches & brands..."
          className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900"
        />
      </div>

      {/* 3. PRODUCT LISTING AREA (TWO-COLUMN E-COMMERCE LAYOUT) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Catalog Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight">
              {activeNavTab === 'SMART WATCHES' ? 'Smart Watches' : 'Watches'}
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {filteredProducts.length} Watches Found · Authentic Indian & International Horology
            </p>
          </div>

          {/* Controls: Mobile Filter Buttons + Desktop Sort */}
          <div className="flex items-center gap-3">
            {/* Mobile Filter & Sort Buttons */}
            <button
              onClick={() => setMobileFilterOpen(true)}
              className="lg:hidden flex-1 py-2 px-4 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>⚙️ Filters</span>
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-slate-900 text-white text-[10px] font-mono flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Desktop Sort Dropdown */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-semibold hidden sm:inline">Sort By:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 font-bold focus:outline-none focus:border-slate-900 cursor-pointer"
              >
                <option value="relevance">Relevance</option>
                <option value="newest">New Arrivals</option>
                <option value="bestsellers">Best Sellers</option>
                <option value="popularity">Popularity</option>
                <option value="discount">Discount</option>
                <option value="price_desc">Price: High To Low</option>
                <option value="price_asc">Price: Low To High</option>
              </select>
            </div>
          </div>
        </div>

        {/* Applied Filter Chips Bar */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 py-4 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Applied:</span>
            {selectedBrands.map((b) => (
              <span key={b} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 border border-slate-300 text-xs font-medium text-slate-800">
                Brand: {b}
                <button onClick={() => toggleArrayItem(selectedBrands, b, setSelectedBrands)} className="text-slate-500 hover:text-slate-900 ml-1">✕</button>
              </span>
            ))}
            {selectedCategories.map((c) => (
              <span key={c} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 border border-slate-300 text-xs font-medium text-slate-800">
                Category: {c}
                <button onClick={() => toggleArrayItem(selectedCategories, c, setSelectedCategories)} className="text-slate-500 hover:text-slate-900 ml-1">✕</button>
              </span>
            ))}
            {selectedGenders.map((g) => (
              <span key={g} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 border border-slate-300 text-xs font-medium text-slate-800">
                Gender: {g}
                <button onClick={() => toggleArrayItem(selectedGenders, g, setSelectedGenders)} className="text-slate-500 hover:text-slate-900 ml-1">✕</button>
              </span>
            ))}
            {selectedPriceRanges.map((prId) => (
              <span key={prId} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 border border-slate-300 text-xs font-medium text-slate-800">
                Price: {priceRanges.find((r) => r.id === prId)?.label}
                <button onClick={() => toggleArrayItem(selectedPriceRanges, prId, setSelectedPriceRanges)} className="text-slate-500 hover:text-slate-900 ml-1">✕</button>
              </span>
            ))}
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs font-medium text-blue-800">
                Search: "{searchQuery}"
                <button onClick={() => setSearchQuery('')} className="text-blue-600 hover:text-blue-900 ml-1">✕</button>
              </span>
            )}
            <button
              onClick={handleClearAllFilters}
              className="text-xs font-bold text-rose-600 hover:underline ml-2 cursor-pointer"
            >
              CLEAR ALL
            </button>
          </div>
        )}

        {/* TWO-COLUMN GRID: LEFT FILTER SIDEBAR + RIGHT PRODUCT GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-6 items-start">
          {/* LEFT: FILTER SIDEBAR (DESKTOP) */}
          <aside className="hidden lg:block lg:col-span-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs sticky top-32">
            {renderFilterSidebar()}
          </aside>

          {/* RIGHT: PRODUCT GRID */}
          <section className="lg:col-span-9">
            {filteredProducts.length === 0 ? (
              <div className="py-24 text-center space-y-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="text-5xl">⌚</div>
                <h3 className="text-xl font-bold text-slate-900">No matching watches found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  No timepieces match all of your selected filters. Try removing filters or clearing all options.
                </p>
                <button
                  onClick={handleClearAllFilters}
                  className="px-6 py-2.5 rounded-full bg-slate-900 hover:bg-blue-600 text-white text-xs font-bold transition cursor-pointer"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onSelectProduct={(p) => setSelectedProduct(p)}
                    onAddToCart={(p) => handleAddToCart(p, 1)}
                    onToggleWishlist={(p) => handleToggleWishlist(p)}
                    isWishlisted={wishlistIds.has(product.id)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Mobile Filter Drawer / Bottom Sheet */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden lg:hidden">
          <div
            onClick={() => setMobileFilterOpen(false)}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
          />
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-sm bg-white p-6 overflow-y-auto shadow-2xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
                  <span className="text-base font-black text-slate-900">FILTERS</span>
                  <button
                    onClick={() => setMobileFilterOpen(false)}
                    className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600"
                  >
                    ✕
                  </button>
                </div>
                {renderFilterSidebar()}
              </div>

              <div className="pt-6 mt-6 border-t border-slate-200 flex gap-3">
                <button
                  onClick={handleClearAllFilters}
                  className="flex-1 py-3 bg-slate-100 text-slate-800 rounded-xl text-xs font-bold"
                >
                  Clear
                </button>
                <button
                  onClick={() => setMobileFilterOpen(false)}
                  className="flex-1 py-3 bg-slate-900 text-white rounded-xl text-xs font-bold"
                >
                  Apply ({filteredProducts.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Multi-Column Footer */}
      <footer className="bg-slate-900 text-slate-400 py-16 mt-20 text-xs border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-white text-slate-900 font-black flex items-center justify-center text-lg">
                ⧖
              </div>
              <span className="text-white font-black text-lg tracking-wider">CHRONOVA</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              India's premier luxury and connected horology destination. Offering 100% authentic manufacturer warranty and pan-India express courier delivery.
            </p>
            <div className="pt-2 text-white font-bold text-xs font-mono">
              "FIND YOUR TIME."
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-white font-bold uppercase tracking-wider font-mono">Customer Service</h4>
            <ul className="space-y-2">
              <li className="hover:text-white cursor-pointer">Track Order Status</li>
              <li className="hover:text-white cursor-pointer">Doorstep Warranty Claims</li>
              <li className="hover:text-white cursor-pointer">Free 7-Day Replacement</li>
              <li className="hover:text-white cursor-pointer">Authenticity Certificate</li>
              <li className="hover:text-white cursor-pointer">Store Locator</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-white font-bold uppercase tracking-wider font-mono">Popular Brands</h4>
            <ul className="space-y-2">
              <li className="hover:text-white cursor-pointer" onClick={() => { setSelectedBrands(['Titan']); }}>Titan Regalia & Ceramic</li>
              <li className="hover:text-white cursor-pointer" onClick={() => { setSelectedBrands(['Casio']); }}>Casio G-Shock & Edifice</li>
              <li className="hover:text-white cursor-pointer" onClick={() => { setSelectedBrands(['Fastrack']); }}>Fastrack Stunners</li>
              <li className="hover:text-white cursor-pointer" onClick={() => { setSelectedBrands(['Seiko']); }}>Seiko 5 Sports & Presage</li>
              <li className="hover:text-white cursor-pointer" onClick={() => { setSelectedBrands(['Apple Watch']); }}>Apple Watch Series 9 & Ultra</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-white font-bold uppercase tracking-wider font-mono">Payment & Security</h4>
            <p className="text-slate-400 leading-relaxed">
              Secured by 256-bit SSL encryption. Supporting UPI, NetBanking, Credit/Debit Cards, and Razorpay Test Mode.
            </p>
            <div className="pt-2 text-emerald-400 font-mono font-bold">
              ✓ Verified Merchant Checkout Active
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 mt-10 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
          <div>© 2026 CHRONOVA Timepieces Inc. All rights reserved.</div>
          <div className="font-mono text-slate-400">Designed for watch lovers across India</div>
        </div>
      </footer>

      {/* Modals & Slide-Overs */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={(p, qty, color) => handleAddToCart(p, qty, color)}
          onInstantBuy={(p, qty, color) => handleInstantBuy(p, qty, color)}
        />
      )}

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        onUpdateQuantity={(id, qty) => {
          setCartItems((prev) =>
            prev.map((i) => (i.product.id === id ? { ...i, quantity: qty } : i))
          )
        }}
        onRemoveItem={(id) => {
          setCartItems((prev) => prev.filter((i) => i.product.id !== id))
        }}
        onProceedToCheckout={() => setIsCheckoutOpen(true)}
      />

      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        items={cartItems}
        onClearCart={() => setCartItems([])}
      />
    </div>
  )
}
