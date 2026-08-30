'use client'

import React, { useState, useMemo } from 'react'
import {
  CHRONOVA_CATALOG,
  ALL_BRANDS,
  ALL_CATEGORIES,
  ALL_VIBES,
} from '../../data/chronovaCatalog'
import type { ChronovaProduct, CartItem, WatchBrand, WatchCategory, WatchVibe } from './types'
import { ProductCard } from './ProductCard'
import { ProductDetailModal } from './ProductDetailModal'
import { CartDrawer } from './CartDrawer'
import { CheckoutModal } from './CheckoutModal'

export const ChronovaStore: React.FC = () => {
  // Navigation & Filtering State
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [selectedBrand, setSelectedBrand] = useState<string>('All Brands')
  const [selectedVibe, setSelectedVibe] = useState<string>('All Vibes')
  const [selectedGender, setSelectedGender] = useState<'All' | 'Men' | 'Women' | 'Unisex'>('All')
  const [priceFilter, setPriceFilter] = useState<'all' | 'under5k' | '5k-10k' | '10k-25k' | 'above25k'>('all')
  const [sortBy, setSortBy] = useState<'featured' | 'newest' | 'rating' | 'price-asc' | 'price-desc' | 'discount'>('featured')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [activeCollection, setActiveCollection] = useState<string | null>(null)

  // Cart & Wishlist
  const [cartItems, setCartItems] = useState<CartItem[]>([
    {
      product: CHRONOVA_CATALOG[0],
      quantity: 1,
      selected_color: 'Midnight Obsidian',
    },
  ])
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set([CHRONOVA_CATALOG[1].id, CHRONOVA_CATALOG[4].id]))
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<ChronovaProduct | null>(null)

  // Filter & Sort Engine
  const filteredProducts = useMemo(() => {
    return CHRONOVA_CATALOG.filter((product) => {
      // 1. Navigation / Collection Filter
      if (activeCollection === 'SMARTWATCHES' && !product.specs.display_type && product.category !== 'Smart Watches') return false
      if (activeCollection === 'WATCHES' && (product.specs.display_type || product.category === 'Smart Watches')) return false
      if (activeCollection === 'AUTOMATIC' && !product.specs.movement.includes('Automatic') && product.category !== 'Automatic Watches') return false
      if (activeCollection === 'SPORTS' && product.category !== 'Sports Watches' && product.category !== 'Fitness Watches' && product.vibe !== 'Sport') return false
      if (activeCollection === 'NEW ARRIVALS' && !product.is_new_arrival) return false
      if (activeCollection === 'SALE' && product.discount_percent < 15) return false
      if (activeCollection === 'MEN' && product.gender === 'Women') return false
      if (activeCollection === 'WOMEN' && product.gender === 'Men') return false

      // 2. Category Match
      if (selectedCategory !== 'All' && product.category !== selectedCategory) {
        return false
      }

      // 3. Brand Match
      if (selectedBrand !== 'All Brands' && product.brand !== selectedBrand) {
        return false
      }

      // 4. Vibe Match
      if (selectedVibe !== 'All Vibes' && product.vibe !== selectedVibe) {
        return false
      }

      // 5. Gender Match
      if (selectedGender !== 'All' && product.gender !== selectedGender) {
        return false
      }

      // 6. Price Range Match
      if (priceFilter === 'under5k' && product.price_rupees >= 5000) return false
      if (priceFilter === '5k-10k' && (product.price_rupees < 5000 || product.price_rupees > 10000)) return false
      if (priceFilter === '10k-25k' && (product.price_rupees < 10000 || product.price_rupees > 25000)) return false
      if (priceFilter === 'above25k' && product.price_rupees <= 25000) return false

      // 7. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchName = product.name.toLowerCase().includes(q)
        const matchBrand = product.brand.toLowerCase().includes(q)
        const matchSeries = product.series.toLowerCase().includes(q)
        const matchModel = product.model.toLowerCase().includes(q)
        const matchCategory = product.category.toLowerCase().includes(q)
        const matchSpecs = product.specs.movement.toLowerCase().includes(q) || product.specs.case_material.toLowerCase().includes(q)
        if (!matchName && !matchBrand && !matchSeries && !matchModel && !matchCategory && !matchSpecs) {
          return false
        }
      }

      return true
    }).sort((a, b) => {
      if (sortBy === 'price-asc') return a.price_rupees - b.price_rupees
      if (sortBy === 'price-desc') return b.price_rupees - a.price_rupees
      if (sortBy === 'rating') return b.rating - a.rating
      if (sortBy === 'newest') return (b.is_new_arrival ? 1 : 0) - (a.is_new_arrival ? 1 : 0)
      if (sortBy === 'discount') return b.discount_percent - a.discount_percent
      return (b.is_bestseller ? 1 : 0) - (a.is_bestseller ? 1 : 0)
    })
  }, [activeCollection, selectedCategory, selectedBrand, selectedVibe, selectedGender, priceFilter, searchQuery, sortBy])

  // Cart Handlers
  const handleAddToCart = (product: ChronovaProduct, quantity: number = 1, selectedColor?: string) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id)
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        )
      }
      return [...prev, { product, quantity, selected_color: selectedColor }]
    })
  }

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    setCartItems((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, quantity } : item))
    )
  }

  const handleRemoveItem = (productId: string) => {
    setCartItems((prev) => prev.filter((item) => item.product.id !== productId))
  }

  const handleToggleWishlist = (product: ChronovaProduct) => {
    setWishlistIds((prev) => {
      const next = new Set(prev)
      if (next.has(product.id)) next.delete(product.id)
      else next.add(product.id)
      return next
    })
  }

  const handleInstantBuy = (product: ChronovaProduct, quantity: number = 1, selectedColor?: string) => {
    setCartItems([{ product, quantity, selected_color: selectedColor }])
    setCheckoutOpen(true)
  }

  const handleResetFilters = () => {
    setSelectedCategory('All')
    setSelectedBrand('All Brands')
    setSelectedVibe('All Vibes')
    setSelectedGender('All')
    setPriceFilter('all')
    setSearchQuery('')
    setActiveCollection(null)
  }

  const navLinks = [
    { label: 'ALL WATCHES', collection: null },
    { label: 'MEN', collection: 'MEN' },
    { label: 'WOMEN', collection: 'WOMEN' },
    { label: 'SMARTWATCHES', collection: 'SMARTWATCHES' },
    { label: 'AUTOMATIC', collection: 'AUTOMATIC' },
    { label: 'SPORTS', collection: 'SPORTS' },
    { label: 'NEW ARRIVALS', collection: 'NEW ARRIVALS' },
    { label: 'SALE', collection: 'SALE' },
  ]

  return (
    <div className="w-full min-h-screen bg-[#050811] text-[#e2e8f0] font-sans antialiased pb-20">
      {/* Top Banner */}
      <div className="w-full bg-[#091224] border-b border-[#1e293b] py-2 px-4 text-center text-xs font-mono text-[#93c5fd]">
        ✨ FESTIVE EDITION: Free 48-Hour Insured Express Delivery + 1 Year Extended Warranty Across India
      </div>

      {/* Main Luxury Header */}
      <header className="sticky top-0 z-40 bg-[#050811]/95 backdrop-blur-md border-b border-[#1e293b] px-4 py-3 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={handleResetFilters}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#38bdf8] via-[#2563eb] to-[#e5a944] p-0.5 flex items-center justify-center shadow-lg shadow-blue-500/10">
              <div className="w-full h-full bg-[#090e1a] rounded-[10px] flex items-center justify-center text-white font-serif text-xl font-black">
                ⧖
              </div>
            </div>
            <div>
              <div className="text-xl font-black text-white tracking-tight flex items-center gap-1.5 font-serif">
                <span>CHRONOVA</span>
              </div>
              <p className="text-[10px] text-[#38bdf8] font-mono tracking-widest uppercase">Find Your Time.</p>
            </div>
          </div>

          {/* Global Instant Search Bar */}
          <div className="flex-1 max-w-md hidden md:block">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search watches, smartwatches, brands, and collections..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#0b132b] border border-[#1e293b] text-xs text-white placeholder-[#64748b] focus:outline-none focus:border-[#38bdf8] transition font-sans"
              />
              <span className="absolute left-3 top-3 text-xs text-[#64748b]">🔍</span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-xs text-[#94a3b8] hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Header Utilities: Wishlist & Cart */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#0b132b] border border-[#1e293b] text-xs text-[#94a3b8]">
              <span>❤️</span>
              <span>{wishlistIds.size}</span>
            </div>

            <button
              onClick={() => setCartOpen(true)}
              className="relative px-4 py-2 rounded-xl bg-[#2563eb] hover:bg-[#3b82f6] text-white text-xs font-bold transition cursor-pointer flex items-center gap-2 shadow-md shadow-blue-500/20"
            >
              <span>🛒</span>
              <span className="hidden sm:inline">Bag</span>
              <span className="px-1.5 py-0.5 rounded-full bg-white text-[#2563eb] text-[10px] font-mono font-bold">
                {cartItems.reduce((s, i) => s + i.quantity, 0)}
              </span>
            </button>
          </div>
        </div>

        {/* Secondary Category Navigation Bar */}
        <div className="max-w-7xl mx-auto mt-3 pt-2 border-t border-[#1e293b]/60 flex items-center gap-1 sm:gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
          {navLinks.map((link) => (
            <button
              key={link.label}
              onClick={() => setActiveCollection(link.collection)}
              className={`px-3 py-1.5 rounded-lg font-bold uppercase tracking-wider text-[11px] whitespace-nowrap transition cursor-pointer ${
                activeCollection === link.collection
                  ? 'bg-[#38bdf8] text-[#050811] shadow'
                  : 'text-[#94a3b8] hover:text-white hover:bg-[#1e293b]/50'
              }`}
            >
              {link.label}
            </button>
          ))}
        </div>

        {/* Mobile Search Bar */}
        <div className="mt-3 md:hidden">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search 150+ watches & smartwatches..."
            className="w-full px-3 py-2 rounded-xl bg-[#0b132b] border border-[#1e293b] text-xs text-white placeholder-[#64748b] focus:outline-none focus:border-[#38bdf8]"
          />
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-4">
        <div className="rounded-3xl bg-gradient-to-r from-[#080e1e] via-[#0d1c3a] to-[#080e1e] border border-[#1e3a8a]/40 p-6 sm:p-12 relative overflow-hidden shadow-2xl">
          <div className="max-w-2xl space-y-4 z-10 relative">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#38bdf8]/10 border border-[#38bdf8]/30 text-[#38bdf8] text-xs font-mono font-bold">
              <span>★</span>
              <span>150+ MODELS IN STOCK · OFFICIAL BRAND WARRANTY</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight uppercase font-serif">
              TIME THAT MOVES WITH YOU
            </h1>
            <p className="text-xs sm:text-sm text-[#94a3b8] leading-relaxed max-w-xl">
              From everyday classics to smart performance, discover a watch for every moment. Explore 150+ curated timepieces from Titan, Seiko, Fossil, Apple Watch, Garmin, and Casio.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => {
                  setActiveCollection('WATCHES')
                  setSelectedCategory('All')
                }}
                className="px-6 py-3.5 rounded-xl bg-[#2563eb] hover:bg-[#3b82f6] text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-lg shadow-blue-500/25"
              >
                SHOP WATCHES
              </button>

              <button
                onClick={() => {
                  setActiveCollection('SMARTWATCHES')
                  setSelectedCategory('Smart Watches')
                }}
                className="px-6 py-3.5 rounded-xl bg-[#0b132b] hover:bg-[#1e293b] border border-[#38bdf8]/40 text-[#38bdf8] font-bold text-xs uppercase tracking-wider transition cursor-pointer"
              >
                EXPLORE SMARTWATCHES
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Shop by Vibe Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-white uppercase tracking-wider font-mono">
            SHOP BY VIBE
          </h2>
          {selectedVibe !== 'All Vibes' && (
            <button onClick={() => setSelectedVibe('All Vibes')} className="text-xs text-[#38bdf8] hover:underline">
              Clear Vibe Filter
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2">
          {ALL_VIBES.map((vibe) => (
            <button
              key={vibe}
              onClick={() => setSelectedVibe(selectedVibe === vibe ? 'All Vibes' : vibe)}
              className={`p-3 rounded-2xl text-center border transition cursor-pointer flex flex-col items-center justify-center gap-1 ${
                selectedVibe === vibe
                  ? 'border-[#38bdf8] bg-[#0b132b] text-[#38bdf8] font-bold shadow'
                  : 'border-[#1e293b] bg-[#080d1a] text-[#94a3b8] hover:text-white hover:border-[#334155]'
              }`}
            >
              <span className="text-base">
                {vibe === 'Everyday' ? '☕' : vibe === 'Office' ? '💼' : vibe === 'Street' ? '🛹' : vibe === 'Sport' ? '⚡' : vibe === 'Party' ? '✨' : vibe === 'Travel' ? '✈️' : vibe === 'Minimal' ? '⚪' : '💎'}
              </span>
              <span className="text-xs font-mono">{vibe}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Filter & Sort Controls */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-3 border-t border-[#1e293b]/60">
        {/* Brand Selector Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full scrollbar-none">
          <span className="text-xs text-[#64748b] font-medium mr-1 shrink-0">Brand:</span>
          <button
            onClick={() => setSelectedBrand('All Brands')}
            className={`px-3 py-1 rounded-lg text-xs font-mono whitespace-nowrap transition cursor-pointer ${
              selectedBrand === 'All Brands'
                ? 'bg-[#38bdf8] text-[#050811] font-bold'
                : 'bg-[#090e1a] text-[#94a3b8] hover:text-white border border-[#1e293b]'
            }`}
          >
            All Brands
          </button>
          {ALL_BRANDS.map((b) => (
            <button
              key={b}
              onClick={() => setSelectedBrand(b)}
              className={`px-3 py-1 rounded-lg text-xs font-mono whitespace-nowrap transition cursor-pointer ${
                selectedBrand === b
                  ? 'bg-[#38bdf8] text-[#050811] font-bold'
                  : 'bg-[#090e1a] text-[#94a3b8] hover:text-white border border-[#1e293b]'
              }`}
            >
              {b}
            </button>
          ))}
        </div>

        {/* Secondary Filter Dropdowns & Sort */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Category Dropdown */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-[#0b132b] border border-[#1e293b] text-[#cbd5e1] focus:outline-none focus:border-[#38bdf8] cursor-pointer"
            >
              <option value="All">All 12 Categories</option>
              {ALL_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Price Filter */}
            <select
              value={priceFilter}
              onChange={(e: any) => setPriceFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-[#0b132b] border border-[#1e293b] text-[#cbd5e1] focus:outline-none focus:border-[#38bdf8] cursor-pointer"
            >
              <option value="all">All Prices</option>
              <option value="under5k">Under ₹5,000</option>
              <option value="5k-10k">₹5,000 - ₹10,000</option>
              <option value="10k-25k">₹10,000 - ₹25,000</option>
              <option value="above25k">Above ₹25,000</option>
            </select>

            {/* Gender Filter */}
            <select
              value={selectedGender}
              onChange={(e: any) => setSelectedGender(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-[#0b132b] border border-[#1e293b] text-[#cbd5e1] focus:outline-none focus:border-[#38bdf8] cursor-pointer"
            >
              <option value="All">All Genders</option>
              <option value="Men">Men</option>
              <option value="Women">Women</option>
              <option value="Unisex">Unisex</option>
            </select>
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#64748b]">Sort:</span>
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-[#0b132b] border border-[#1e293b] text-[#cbd5e1] focus:outline-none focus:border-[#38bdf8] cursor-pointer"
            >
              <option value="featured">Featured / Bestsellers</option>
              <option value="newest">Newest Arrivals</option>
              <option value="rating">Highest Rated</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="discount">Biggest Discount</option>
            </select>
          </div>
        </div>

        {/* Results Metadata */}
        <div className="flex items-center justify-between text-xs text-[#94a3b8] pt-1">
          <div>
            Showing <strong className="text-white">{filteredProducts.length}</strong> of 160 timepieces
            {selectedBrand !== 'All Brands' && <span> in <strong className="text-[#38bdf8]">{selectedBrand}</strong></span>}
            {selectedCategory !== 'All' && <span> · <strong className="text-[#38bdf8]">{selectedCategory}</strong></span>}
            {selectedVibe !== 'All Vibes' && <span> · Vibe: <strong className="text-[#38bdf8]">{selectedVibe}</strong></span>}
          </div>

          {(selectedBrand !== 'All Brands' || selectedCategory !== 'All' || selectedVibe !== 'All Vibes' || selectedGender !== 'All' || searchQuery || priceFilter !== 'all' || activeCollection) && (
            <button
              onClick={handleResetFilters}
              className="text-[#38bdf8] hover:underline cursor-pointer"
            >
              Reset Filters ↺
            </button>
          )}
        </div>
      </section>

      {/* Main 160+ Watch Products Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-2">
        {filteredProducts.length === 0 ? (
          <div className="py-20 text-center text-[#64748b] space-y-3 bg-[#090e1a] rounded-3xl border border-[#1e293b]">
            <div className="text-4xl">🔍</div>
            <div className="text-base font-bold text-white">No matching timepieces found</div>
            <p className="text-xs text-[#94a3b8] max-w-sm mx-auto">
              Try adjusting your search criteria or resetting filters to explore our full 160+ watch collection.
            </p>
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 bg-[#2563eb] hover:bg-[#3b82f6] text-white rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Show All Watches
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onSelectProduct={(p) => setSelectedProduct(p)}
                onAddToCart={(p) => handleAddToCart(p, 1)}
                onToggleWishlist={handleToggleWishlist}
                isWishlisted={wishlistIds.has(product.id)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modals */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={handleAddToCart}
          onInstantBuy={handleInstantBuy}
        />
      )}

      <CartDrawer
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onProceedToCheckout={() => setCheckoutOpen(true)}
      />

      <CheckoutModal
        isOpen={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        items={cartItems}
        onOrderSuccess={(orderId, paymentId) => {
          setCartItems([])
        }}
      />
    </div>
  )
}
