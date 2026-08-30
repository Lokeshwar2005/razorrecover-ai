'use client'

import React, { useState, useMemo } from 'react'
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
  // Navigation & Catalog States
  const [activeNavTab, setActiveNavTab] = useState<string>('WATCHES')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedBrand, setSelectedBrand] = useState<WatchBrand | 'All'>('All')
  const [selectedCategory, setSelectedCategory] = useState<WatchCategory | 'All'>('All')
  const [selectedVibe, setSelectedVibe] = useState<WatchVibe | 'All'>('All')
  const [selectedGender, setSelectedGender] = useState<'All' | 'Men' | 'Women' | 'Unisex'>('All')
  const [maxPrice, setMaxPrice] = useState<number>(100000)
  const [minRating, setMinRating] = useState<number>(0)
  const [sortBy, setSortBy] = useState<
    'featured' | 'bestsellers' | 'newest' | 'price_asc' | 'price_desc' | 'rating' | 'discount'
  >('featured')

  // Modals & Drawers
  const [selectedProduct, setSelectedProduct] = useState<ChronovaProduct | null>(null)
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set())
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false)
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false)
  const [wishlistOpenOnly, setWishlistOpenOnly] = useState<boolean>(false)

  // Handlers
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

  const handleResetFilters = () => {
    setSearchQuery('')
    setSelectedBrand('All')
    setSelectedCategory('All')
    setSelectedVibe('All')
    setSelectedGender('All')
    setMaxPrice(100000)
    setMinRating(0)
    setSortBy('featured')
    setWishlistOpenOnly(false)
  }

  // Filtered & Sorted Catalog
  const filteredProducts = useMemo(() => {
    return CHRONOVA_CATALOG.filter((p) => {
      // Wishlist filter
      if (wishlistOpenOnly && !wishlistIds.has(p.id)) return false

      // Top Nav Tab quick filtering
      if (activeNavTab === 'MEN' && p.gender !== 'Men' && p.gender !== 'Unisex') return false
      if (activeNavTab === 'WOMEN' && p.gender !== 'Women' && p.gender !== 'Unisex') return false
      if (activeNavTab === 'SMARTWATCHES' && p.category !== 'Smart Watches' && p.category !== 'Fitness Watches') return false
      if (activeNavTab === 'AUTOMATIC' && p.category !== 'Automatic Watches') return false
      if (activeNavTab === 'SPORTS' && p.category !== 'Sports Watches' && p.category !== 'Outdoor Watches') return false
      if (activeNavTab === 'NEW ARRIVALS' && !p.is_new_arrival) return false
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
      if (selectedBrand !== 'All' && p.brand !== selectedBrand) return false

      // Category Filter
      if (selectedCategory !== 'All' && p.category !== selectedCategory) return false

      // Vibe Filter
      if (selectedVibe !== 'All' && p.vibe !== selectedVibe) return false

      // Gender Filter
      if (selectedGender !== 'All' && p.gender !== selectedGender) return false

      // Price Filter
      if (p.price_rupees > maxPrice) return false

      // Rating Filter
      if (p.rating < minRating) return false

      return true
    }).sort((a, b) => {
      if (sortBy === 'bestsellers') return (b.is_bestseller ? 1 : 0) - (a.is_bestseller ? 1 : 0)
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
    selectedBrand,
    selectedCategory,
    selectedVibe,
    selectedGender,
    maxPrice,
    minRating,
    sortBy,
    wishlistOpenOnly,
    wishlistIds,
  ])

  // Featured Showcase rails
  const bestsellers = useMemo(() => CHRONOVA_CATALOG.filter((p) => p.is_bestseller).slice(0, 4), [])
  const smartWatches = useMemo(() => CHRONOVA_CATALOG.filter((p) => p.category === 'Smart Watches').slice(0, 4), [])

  const totalCartCount = cartItems.reduce((acc, i) => acc + i.quantity, 0)

  return (
    <div className="min-h-screen bg-[#050811] text-[#e2e8f0] font-sans antialiased selection:bg-[#38bdf8] selection:text-[#050811]">
      {/* 1. Promotional Header */}
      <div className="bg-gradient-to-r from-[#1e3a8a] via-[#0284c7] to-[#0d9488] px-4 py-1.5 text-center text-xs font-mono font-medium text-white tracking-wider">
        ✨ CHRONOVA FESTIVAL OF TIME · EXTRA 10% OFF WITH CODE <strong className="underline font-bold">CHRONOVA10</strong> · FREE EXPRESS SHIPPING ALL OVER INDIA
      </div>

      {/* 2. Main Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#070b16]/95 backdrop-blur-md border-b border-[#1e293b] shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Logo */}
            <div
              onClick={() => {
                setActiveNavTab('WATCHES')
                handleResetFilters()
              }}
              className="flex items-center gap-2.5 cursor-pointer shrink-0"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2563eb] to-[#0284c7] flex items-center justify-center text-white font-black text-lg shadow-md shadow-sky-500/30">
                ⧖
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-black tracking-widest text-white leading-none">
                  CHRONOVA
                </span>
                <span className="text-[9px] font-mono text-[#38bdf8] tracking-widest uppercase">
                  Find Your Time.
                </span>
              </div>
            </div>

            {/* Instant Search Bar */}
            <div className="flex-1 max-w-xl relative hidden md:block">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search watches, smartwatches, brands & collections (e.g. Titan, AMOLED, Automatic)..."
                className="w-full pl-10 pr-4 py-2 rounded-2xl bg-[#0b1222] border border-[#1e293b] text-xs text-white placeholder-[#64748b] focus:outline-none focus:border-[#38bdf8] transition shadow-inner"
              />
              <span className="absolute left-3.5 top-2.5 text-xs text-[#64748b]">🔍</span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-xs text-[#64748b] hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Header Right Actions (Wishlist & Cart) */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Wishlist Button */}
              <button
                onClick={() => setWishlistOpenOnly((prev) => !prev)}
                className={`p-2 rounded-xl border transition flex items-center gap-1.5 text-xs font-bold cursor-pointer ${
                  wishlistOpenOnly
                    ? 'bg-[#ef4444]/20 border-[#ef4444] text-[#ef4444]'
                    : 'bg-[#0b1222] border-[#1e293b] text-[#94a3b8] hover:text-white'
                }`}
                title="Wishlist"
              >
                <span>❤️</span>
                <span className="hidden sm:inline font-mono">{wishlistIds.size}</span>
              </button>

              {/* Cart Button */}
              <button
                onClick={() => setIsCartOpen(true)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#2563eb] to-[#0284c7] hover:from-[#3b82f6] hover:to-[#0ea5e9] text-white text-xs font-bold transition shadow-lg shadow-blue-500/25 flex items-center gap-2 cursor-pointer"
              >
                <span>🛍️ Bag</span>
                <span className="px-1.5 py-0.5 rounded-full bg-white text-[#050811] text-[11px] font-black font-mono">
                  {totalCartCount}
                </span>
              </button>
            </div>
          </div>

          {/* Category Navigation Pills */}
          <div className="flex items-center gap-2 overflow-x-auto py-2.5 scrollbar-none border-t border-[#1e293b]/60 text-xs font-mono">
            {['MEN', 'WOMEN', 'WATCHES', 'SMARTWATCHES', 'SPORTS', 'AUTOMATIC', 'NEW ARRIVALS', 'SALE'].map(
              (cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setActiveNavTab(cat)
                    setWishlistOpenOnly(false)
                  }}
                  className={`px-3.5 py-1.5 rounded-xl transition whitespace-nowrap cursor-pointer font-bold ${
                    activeNavTab === cat
                      ? 'bg-[#38bdf8] text-[#050811] shadow-md shadow-sky-500/25'
                      : 'bg-[#0b1222]/80 text-[#94a3b8] hover:text-white hover:bg-[#1e293b]'
                  }`}
                >
                  {cat}
                </button>
              )
            )}
          </div>
        </div>
      </header>

      {/* Mobile Search */}
      <div className="p-4 md:hidden bg-[#070b16] border-b border-[#1e293b]">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search 190+ watches & brands..."
          className="w-full px-4 py-2 rounded-xl bg-[#0b1222] border border-[#1e293b] text-xs text-white placeholder-[#64748b] focus:outline-none focus:border-[#38bdf8]"
        />
      </div>

      {/* 3. Hero Section (Zero 3D, High-Impact Watch Photography) */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#070b16] to-[#050811] border-b border-[#1e293b] py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#38bdf8]/15 border border-[#38bdf8]/30 text-[#38bdf8] text-xs font-mono font-bold">
              <span>⌚ THE 2026 HOROLOGY & SMART COLLECTION</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight uppercase leading-tight">
              FIND YOUR <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#38bdf8] via-[#60a5fa] to-[#34d399]">TIME.</span>
            </h1>

            <p className="text-sm sm:text-base text-[#94a3b8] max-w-xl leading-relaxed">
              From everyday essentials and mechanical automatic movements to connected AMOLED sports trackers, discover India's premier collection of 190 precision timepieces.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                onClick={() => {
                  setActiveNavTab('WATCHES')
                  setSelectedCategory('All')
                }}
                className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#2563eb] to-[#0284c7] hover:from-[#3b82f6] hover:to-[#0ea5e9] text-white text-xs font-bold uppercase tracking-wider transition shadow-lg shadow-blue-500/25 cursor-pointer"
              >
                SHOP WATCHES →
              </button>

              <button
                onClick={() => {
                  setActiveNavTab('SMARTWATCHES')
                  setSelectedCategory('Smart Watches')
                }}
                className="px-6 py-3.5 rounded-xl bg-[#0b1222] hover:bg-[#1e293b] text-[#38bdf8] border border-[#38bdf8]/30 text-xs font-bold uppercase tracking-wider transition cursor-pointer"
              >
                SHOP SMARTWATCHES →
              </button>
            </div>
          </div>

          {/* Hero High-Resolution Photographic Showcase */}
          <div className="lg:col-span-5 relative">
            <div className="relative w-full aspect-square rounded-3xl bg-gradient-to-br from-[#0b1222] to-[#070b16] border border-[#1e293b] p-8 flex items-center justify-center overflow-hidden shadow-2xl">
              <img
                src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80"
                alt="Chronova Flagship Watch"
                className="max-h-full max-w-full object-contain filter drop-shadow-[0_20px_30px_rgba(56,189,248,0.2)]"
              />
              <div className="absolute bottom-4 left-4 right-4 p-3 rounded-2xl bg-[#050811]/90 backdrop-blur-md border border-[#1e293b] flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-mono text-[#38bdf8] uppercase">Titan Edge Ceramic Pro</div>
                  <div className="text-xs font-extrabold text-white">₹18,995</div>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#10b981]/20 text-[#10b981] text-[10px] font-mono font-bold">
                  ★ 4.9 · 128 Reviews
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Brand Discovery Strip */}
      <section className="py-6 bg-[#040711] border-b border-[#1e293b] overflow-x-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-3 text-xs font-mono">
            <span className="text-[#64748b] uppercase font-bold tracking-wider">OFFICIAL BRAND PARTNERS (15 BRANDS)</span>
            {selectedBrand !== 'All' && (
              <button onClick={() => setSelectedBrand('All')} className="text-[#38bdf8] hover:underline cursor-pointer">
                Clear Brand Filter ({selectedBrand})
              </button>
            )}
          </div>
          <div className="flex items-center gap-2.5 pb-1 overflow-x-auto scrollbar-none">
            {ALL_BRANDS.map((brand) => (
              <button
                key={brand}
                onClick={() => setSelectedBrand(selectedBrand === brand ? 'All' : brand)}
                className={`px-4 py-2 rounded-xl text-xs font-mono font-bold whitespace-nowrap transition cursor-pointer border ${
                  selectedBrand === brand
                    ? 'bg-[#38bdf8] text-[#050811] border-[#38bdf8] shadow-md'
                    : 'bg-[#090e1a] text-[#94a3b8] border-[#1e293b] hover:text-white hover:border-[#38bdf8]/40'
                }`}
              >
                {brand}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Main Catalog & Interactive Filters */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filter Controls Bar */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#090e1a] border border-[#1e293b] mb-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-white">
                Showing {filteredProducts.length} of {CHRONOVA_CATALOG.length} Watches
              </span>
              {(selectedBrand !== 'All' || selectedCategory !== 'All' || selectedVibe !== 'All' || searchQuery) && (
                <button
                  onClick={handleResetFilters}
                  className="px-2.5 py-1 rounded-lg bg-[#ef4444]/15 text-[#ef4444] text-[11px] font-mono hover:bg-[#ef4444]/25 transition cursor-pointer"
                >
                  Reset All Filters ✕
                </button>
              )}
            </div>

            {/* Sorting Dropdown */}
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-[#64748b]">Sort By:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-1.5 rounded-xl bg-[#050811] border border-[#1e293b] text-white focus:outline-none focus:border-[#38bdf8]"
              >
                <option value="featured">Featured</option>
                <option value="bestsellers">Bestsellers</option>
                <option value="newest">New Arrivals</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="rating">Top Customer Rated</option>
                <option value="discount">Highest Discount</option>
              </select>
            </div>
          </div>

          {/* Filter Pills (Categories & Vibes) */}
          <div className="space-y-2 pt-2 border-t border-[#1e293b]">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              <span className="text-[#64748b] font-mono text-[11px] shrink-0">Category:</span>
              <button
                onClick={() => setSelectedCategory('All')}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-medium transition cursor-pointer ${
                  selectedCategory === 'All'
                    ? 'bg-[#2563eb] text-white'
                    : 'bg-[#050811] text-[#94a3b8] hover:text-white border border-[#1e293b]'
                }`}
              >
                All Categories
              </button>
              {ALL_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-medium whitespace-nowrap transition cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-[#2563eb] text-white'
                      : 'bg-[#050811] text-[#94a3b8] hover:text-white border border-[#1e293b]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              <span className="text-[#64748b] font-mono text-[11px] shrink-0">Style Vibe:</span>
              <button
                onClick={() => setSelectedVibe('All')}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-medium transition cursor-pointer ${
                  selectedVibe === 'All'
                    ? 'bg-[#0284c7] text-white'
                    : 'bg-[#050811] text-[#94a3b8] hover:text-white border border-[#1e293b]'
                }`}
              >
                All Vibes
              </button>
              {ALL_VIBES.map((vibe) => (
                <button
                  key={vibe}
                  onClick={() => setSelectedVibe(vibe)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-medium whitespace-nowrap transition cursor-pointer ${
                    selectedVibe === vibe
                      ? 'bg-[#0284c7] text-white'
                      : 'bg-[#050811] text-[#94a3b8] hover:text-white border border-[#1e293b]'
                  }`}
                >
                  {vibe}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Product Grid */}
        {filteredProducts.length === 0 ? (
          <div className="py-20 text-center space-y-4">
            <div className="text-5xl">⌚</div>
            <h3 className="text-lg font-bold text-white">No matching watches found</h3>
            <p className="text-xs text-[#94a3b8]">
              Try adjusting your search terms, removing filters, or resetting all options.
            </p>
            <button
              onClick={handleResetFilters}
              className="px-5 py-2.5 rounded-xl bg-[#2563eb] text-white text-xs font-bold cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
      </main>

      {/* 6. Promotional Bestseller Showcase Rail */}
      <section className="py-12 bg-[#040711] border-t border-[#1e293b]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className="text-[11px] font-mono text-[#38bdf8] uppercase font-bold">CURATED EXCELLENCE</span>
              <h2 className="text-xl font-extrabold text-white">CHRONOVA Bestsellers</h2>
            </div>
            <button
              onClick={() => {
                setActiveNavTab('WATCHES')
                setSortBy('bestsellers')
              }}
              className="text-xs text-[#38bdf8] font-bold hover:underline cursor-pointer"
            >
              View All Bestsellers →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {bestsellers.map((product) => (
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
        </div>
      </section>

      {/* 7. Footer */}
      <footer className="bg-[#02050b] border-t border-[#1e293b] py-12 text-xs text-[#64748b]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-white font-black text-base">CHRONOVA</span>
              <span className="text-[10px] font-mono text-[#38bdf8]">Find Your Time.</span>
            </div>
            <p className="text-xs text-[#94a3b8]">
              India's premier luxury and connected horology destination. Authentic manufacturer warranty and pan-India express courier.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="text-white font-bold font-mono uppercase text-xs">Customer Service</h4>
            <ul className="space-y-1">
              <li>Track Order Status</li>
              <li>Doorstep Warranty Assistance</li>
              <li>Free 7-Day Exchange</li>
              <li>Authentication Certificate</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="text-white font-bold font-mono uppercase text-xs">Top Collections</h4>
            <ul className="space-y-1">
              <li>Titan Ceramic & Automatic</li>
              <li>Casio G-Shock & Edifice</li>
              <li>Seiko Presage & Prospex</li>
              <li>AMOLED Smartwatches & Apple Watch</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="text-white font-bold font-mono uppercase text-xs">Payment & Security</h4>
            <p className="text-xs text-[#94a3b8]">
              Secured by 256-bit SSL encryption. Supporting UPI, Cards, NetBanking, and Razorpay Test Mode.
            </p>
            <div className="pt-2 text-[10px] font-mono text-[#34d399]">
              ✓ Verified Merchant Checkout Active
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 mt-8 border-t border-[#1e293b]/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px]">
          <div>© 2026 CHRONOVA Timepieces Inc. All rights reserved.</div>
          <div className="font-mono text-[#94a3b8]">Designed for luxury watch connoisseurs in India</div>
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
