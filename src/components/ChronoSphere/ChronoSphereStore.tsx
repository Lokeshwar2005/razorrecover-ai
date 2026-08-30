'use client'

import React, { useState, useMemo } from 'react'
import {
  WATCH_CATALOG,
  ALL_BRANDS,
  ALL_CATEGORIES,
} from '../../data/watchCatalog'
import type { WatchProduct, CartItem, WatchBrand, WatchCategory } from './types'
import { ProductCard } from './ProductCard'
import { ProductDetailModal } from './ProductDetailModal'
import { CartDrawer } from './CartDrawer'
import { CheckoutModal } from './CheckoutModal'
import { CustomerRecoveryModal } from './CustomerRecoveryModal'
import { useTransactionStore } from '../../services/canonicalTransactionStore'

export interface ChronoSphereStoreProps {
  onNavigateToRazorRecover?: (tab?: string, txnId?: string) => void
  isDualView?: boolean
}

export const ChronoSphereStore: React.FC<ChronoSphereStoreProps> = ({
  onNavigateToRazorRecover,
  isDualView = false,
}) => {
  // Filters & Search
  const [selectedBrand, setSelectedBrand] = useState<string>('All Brands')
  const [selectedCategory, setSelectedCategory] = useState<string>('All Categories')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [priceFilter, setPriceFilter] = useState<'all' | 'under5k' | '5k-20k' | '20k-50k' | 'above50k'>('all')
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc' | 'rating' | 'discount'>('featured')

  // Cart & Wishlist
  const [cartItems, setCartItems] = useState<CartItem[]>([
    {
      product: WATCH_CATALOG[0], // Pre-populate flagship watch for easy 1-click test
      quantity: 1,
      selected_color: 'Midnight Obsidian',
    },
  ])
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set([WATCH_CATALOG[1].id]))
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)

  // Modals
  const [selectedProduct, setSelectedProduct] = useState<WatchProduct | null>(null)
  const [recoveryModalOpen, setRecoveryModalOpen] = useState(false)
  const [activeRecoveryTxnId, setActiveRecoveryTxnId] = useState<string | null>(null)

  // Canonical Store Connection
  const transactions = useTransactionStore((s) => s.transactions)

  // Find if any ChronoSphere transaction currently has an active recovery action
  const latestRecoveryTxn = useMemo(() => {
    return transactions.find(
      (t) => (t.merchant_id === 'mer_chronosphere_luxury' || t.id.startsWith('TXN-CS')) && (t.status === 'STOPPED' || t.status === 'IN_PROGRESS' || t.recovery_operation_id)
    )
  }, [transactions])

  // Filter & Sort Engine
  const filteredProducts = useMemo(() => {
    return WATCH_CATALOG.filter((product) => {
      // 1. Brand Match
      if (selectedBrand !== 'All Brands' && product.brand !== selectedBrand) {
        return false
      }

      // 2. Category Match
      if (selectedCategory !== 'All Categories' && product.category !== selectedCategory) {
        return false
      }

      // 3. Price Filter
      if (priceFilter === 'under5k' && product.price_rupees >= 5000) return false
      if (priceFilter === '5k-20k' && (product.price_rupees < 5000 || product.price_rupees > 20000)) return false
      if (priceFilter === '20k-50k' && (product.price_rupees < 20000 || product.price_rupees > 50000)) return false
      if (priceFilter === 'above50k' && product.price_rupees <= 50000) return false

      // 4. Search Query
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
      if (sortBy === 'discount') return b.discount_percent - a.discount_percent
      return (b.featured ? 1 : 0) - (a.featured ? 1 : 0)
    })
  }, [selectedBrand, selectedCategory, priceFilter, searchQuery, sortBy])

  // Cart Operations
  const handleAddToCart = (product: WatchProduct, quantity: number = 1, selectedColor?: string) => {
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

  const handleToggleWishlist = (product: WatchProduct) => {
    setWishlistIds((prev) => {
      const next = new Set(prev)
      if (next.has(product.id)) next.delete(product.id)
      else next.add(product.id)
      return next
    })
  }

  const handleInstantBuy = (product: WatchProduct, quantity: number = 1, selectedColor?: string) => {
    setCartItems([{ product, quantity, selected_color: selectedColor }])
    setCheckoutOpen(true)
  }

  return (
    <div className="w-full min-h-screen bg-[#050811] text-[#e2e8f0] font-sans antialiased pb-20">
      {/* Top Banner: Dual Ecosystem Context */}
      <div className="w-full bg-[#091224] border-b border-[#1e3a8a]/60 py-2 px-4 text-xs font-mono flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[#93c5fd]">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#38bdf8] animate-pulse" />
          <span className="font-bold uppercase tracking-wider">WEBSITE A: ChronoSphere Luxury Watches</span>
          <span className="text-[#64748b]">|</span>
          <span className="text-[#38bdf8]">120+ Timepieces · Razorpay Test Mode Gateway</span>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateToRazorRecover && (
            <button
              onClick={() => onNavigateToRazorRecover('Opportunities')}
              className="px-3 py-1 bg-[#1e40af] hover:bg-[#2563eb] text-white rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-blue-500/20"
            >
              <span>View in RazorRecover AI</span>
              <span>→</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Luxury Header */}
      <header className="sticky top-0 z-40 bg-[#050811]/90 backdrop-blur-md border-b border-[#1e293b] px-4 py-3 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setSelectedBrand('All Brands'); setSelectedCategory('All Categories'); setSearchQuery(''); }}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#e5a944] via-[#38bdf8] to-[#2563eb] p-0.5 flex items-center justify-center shadow-lg shadow-blue-500/10">
              <div className="w-full h-full bg-[#090e1a] rounded-[10px] flex items-center justify-center text-white font-serif text-xl font-black">
                Ω
              </div>
            </div>
            <div>
              <div className="text-xl font-extrabold text-white tracking-tight flex items-center gap-1.5">
                <span>ChronoSphere</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#e5a944]/20 text-[#e5a944] border border-[#e5a944]/40 font-mono font-bold">
                  LUXURY
                </span>
              </div>
              <p className="text-[10px] text-[#94a3b8] font-mono">Haute Horlogerie & Smart Timepieces</p>
            </div>
          </div>

          {/* Global Instant Search Bar */}
          <div className="flex-1 max-w-md hidden md:block">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search 120+ watches (e.g. Titan, Seiko, Apple Watch, Chronograph...)"
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#0b132b] border border-[#1e293b] text-xs text-white placeholder-[#64748b] focus:outline-none focus:border-[#38bdf8] transition font-sans"
              />
              <span className="absolute left-3 top-2.5 text-xs text-[#64748b]">🔍</span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2 text-xs text-[#94a3b8] hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Right Header Controls: Cart & VIP Recovery Link */}
          <div className="flex items-center gap-3">
            {/* Active Recovery Notification Button */}
            {latestRecoveryTxn && (
              <button
                onClick={() => {
                  setActiveRecoveryTxnId(latestRecoveryTxn.id)
                  setRecoveryModalOpen(true)
                }}
                className="px-3 py-1.5 rounded-xl bg-[#10b981]/20 hover:bg-[#10b981]/30 border border-[#10b981]/50 text-[#6ee7b7] text-xs font-bold transition cursor-pointer flex items-center gap-1.5 animate-pulse"
              >
                <span>📬</span>
                <span className="hidden sm:inline">Recovery Action Ready</span>
              </button>
            )}

            {/* Cart Drawer Trigger */}
            <button
              onClick={() => setCartOpen(true)}
              className="relative px-4 py-2 rounded-xl bg-[#0b132b] hover:bg-[#152244] border border-[#1e293b] hover:border-[#38bdf8]/50 text-white text-xs font-bold transition cursor-pointer flex items-center gap-2"
            >
              <span>🛒</span>
              <span className="hidden sm:inline">Cart</span>
              <span className="px-1.5 py-0.5 rounded-full bg-[#2563eb] text-white text-[10px] font-mono">
                {cartItems.reduce((s, i) => s + i.quantity, 0)}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className="mt-3 md:hidden">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search 120+ luxury watches..."
            className="w-full px-3 py-2 rounded-xl bg-[#0b132b] border border-[#1e293b] text-xs text-white placeholder-[#64748b] focus:outline-none focus:border-[#38bdf8]"
          />
        </div>
      </header>

      {/* Hero Showcase Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-4">
        <div className="rounded-3xl bg-gradient-to-r from-[#091224] via-[#0d1c3a] to-[#091224] border border-[#1e3a8a]/50 p-6 sm:p-10 relative overflow-hidden shadow-2xl">
          <div className="max-w-2xl space-y-4 z-10 relative">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#38bdf8]/10 border border-[#38bdf8]/30 text-[#38bdf8] text-xs font-mono font-bold">
              <span>★</span>
              <span>2026 FLAGSHIP COLLECTION · 120+ MODELS IN STOCK</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
              Precision Crafted Timepieces.
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#38bdf8] via-[#60a5fa] to-[#e5a944]">
                Seamlessly Recovered.
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-[#94a3b8] leading-relaxed max-w-xl">
              Experience authentic luxury chronographs, automatic mechanicals, and flagship smartwatches from Titan, Seiko, Apple Watch, Garmin, and Casio with real-time Razorpay Test Mode checkout.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => {
                  setSelectedProduct(WATCH_CATALOG[0])
                }}
                className="px-5 py-3 rounded-xl bg-gradient-to-r from-[#2563eb] to-[#0284c7] hover:from-[#3b82f6] hover:to-[#0ea5e9] text-white font-bold text-xs transition cursor-pointer shadow-lg shadow-blue-500/25 flex items-center gap-2"
              >
                <span>🌐 Open 3D Watch Studio</span>
                <span>→</span>
              </button>

              <button
                onClick={() => handleInstantBuy(WATCH_CATALOG[0])}
                className="px-5 py-3 rounded-xl bg-[#0b132b] hover:bg-[#1e293b] border border-[#334155] text-white font-bold text-xs transition cursor-pointer flex items-center gap-2"
              >
                <span>⚡ Test Instant Checkout</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Brand & Category Navigation Bar */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-3">
        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#2563eb] text-white shadow-md shadow-blue-500/20'
                  : 'bg-[#0b132b] text-[#94a3b8] hover:text-white border border-[#1e293b] hover:border-[#334155]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Brand Selector Chips & Secondary Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {/* Brand Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            <span className="text-xs text-[#64748b] font-medium mr-1">Brand:</span>
            {ALL_BRANDS.map((b) => (
              <button
                key={b}
                onClick={() => setSelectedBrand(b)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition cursor-pointer ${
                  selectedBrand === b
                    ? 'bg-[#38bdf8] text-[#050811] font-bold shadow'
                    : 'bg-[#090e1a] text-[#94a3b8] hover:text-white border border-[#1e293b]'
                }`}
              >
                {b}
              </button>
            ))}
          </div>

          {/* Sort & Price Filter Controls */}
          <div className="flex items-center gap-2 text-xs">
            <select
              value={priceFilter}
              onChange={(e: any) => setPriceFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-[#0b132b] border border-[#1e293b] text-[#cbd5e1] focus:outline-none focus:border-[#38bdf8] cursor-pointer"
            >
              <option value="all">All Prices</option>
              <option value="under5k">Under ₹5,000</option>
              <option value="5k-20k">₹5,000 - ₹20,000</option>
              <option value="20k-50k">₹20,000 - ₹50,000</option>
              <option value="above50k">Above ₹50,000</option>
            </select>

            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-[#0b132b] border border-[#1e293b] text-[#cbd5e1] focus:outline-none focus:border-[#38bdf8] cursor-pointer"
            >
              <option value="featured">Featured Collection</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="rating">Highest Rated</option>
              <option value="discount">Biggest Discount</option>
            </select>
          </div>
        </div>

        {/* Results Metadata */}
        <div className="flex items-center justify-between text-xs text-[#94a3b8] pt-1">
          <div>
            Showing <strong className="text-white">{filteredProducts.length}</strong> of 120+ luxury timepieces
            {selectedBrand !== 'All Brands' && <span> in <strong className="text-[#38bdf8]">{selectedBrand}</strong></span>}
            {selectedCategory !== 'All Categories' && <span> · <strong className="text-[#38bdf8]">{selectedCategory}</strong></span>}
          </div>

          {(selectedBrand !== 'All Brands' || selectedCategory !== 'All Categories' || searchQuery || priceFilter !== 'all') && (
            <button
              onClick={() => {
                setSelectedBrand('All Brands')
                setSelectedCategory('All Categories')
                setSearchQuery('')
                setPriceFilter('all')
              }}
              className="text-[#38bdf8] hover:underline cursor-pointer"
            >
              Reset Filters ↺
            </button>
          )}
        </div>
      </section>

      {/* Main 120+ Watch Products Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-4">
        {filteredProducts.length === 0 ? (
          <div className="py-20 text-center text-[#64748b] space-y-3 bg-[#090e1a] rounded-3xl border border-[#1e293b]">
            <div className="text-4xl">🔍</div>
            <div className="text-base font-bold text-white">No matching timepieces found</div>
            <p className="text-xs text-[#94a3b8] max-w-sm mx-auto">
              Try adjusting your search criteria or resetting filters to explore our full 120+ watch collection.
            </p>
            <button
              onClick={() => {
                setSelectedBrand('All Brands')
                setSelectedCategory('All Categories')
                setSearchQuery('')
                setPriceFilter('all')
              }}
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

      {/* Interactive Modals */}
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
        onNavigateToRazorRecover={onNavigateToRazorRecover}
      />

      {recoveryModalOpen && activeRecoveryTxnId && (
        <CustomerRecoveryModal
          isOpen={recoveryModalOpen}
          onClose={() => setRecoveryModalOpen(false)}
          transactionId={activeRecoveryTxnId}
          onNavigateToRazorRecover={onNavigateToRazorRecover}
        />
      )}
    </div>
  )
}
