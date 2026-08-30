'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
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
  const [activeMegaMenu, setActiveMegaMenu] = useState<string | null>(null)
  const [showPromoBar, setShowPromoBar] = useState<boolean>(true)
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false)
  const [filterDrawerOpen, setFilterDrawerOpen] = useState<boolean>(false)

  const catalogRef = useRef<HTMLDivElement>(null)

  const scrollToCatalog = () => {
    if (catalogRef.current) {
      catalogRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }

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

  // Featured Curations for Homepage Rails
  const bestsellers = useMemo(() => CHRONOVA_CATALOG.filter((p) => p.is_bestseller).slice(0, 4), [])
  const newDrops = useMemo(() => CHRONOVA_CATALOG.filter((p) => p.is_new_arrival).slice(0, 4), [])
  const smartEdits = useMemo(() => CHRONOVA_CATALOG.filter((p) => p.category === 'Smart Watches').slice(0, 4), [])
  const automaticPicks = useMemo(() => CHRONOVA_CATALOG.filter((p) => p.category === 'Automatic Watches').slice(0, 4), [])

  const totalCartCount = cartItems.reduce((acc, i) => acc + i.quantity, 0)

  // Circular Category Strip Config
  const categoryStrips = [
    { label: 'Men Watches', cat: 'MEN', img: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=400&auto=format&fit=crop&q=80' },
    { label: 'Women Watches', cat: 'WOMEN', img: 'https://images.unsplash.com/photo-1526045612212-70caf35c14df?w=400&auto=format&fit=crop&q=80' },
    { label: 'Smartwatches', cat: 'SMARTWATCHES', img: 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=400&auto=format&fit=crop&q=80' },
    { label: 'Automatic', cat: 'AUTOMATIC', img: 'https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?w=400&auto=format&fit=crop&q=80' },
    { label: 'Chronographs', cat: 'WATCHES', img: 'https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?w=400&auto=format&fit=crop&q=80' },
    { label: 'Sports & Diver', cat: 'WATCHES', img: 'https://images.unsplash.com/photo-1510017803434-a899398421b3?w=400&auto=format&fit=crop&q=80' },
    { label: 'Bestsellers', cat: 'BESTSELLERS', img: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&auto=format&fit=crop&q=80' },
    { label: 'Sale Flat 30%', cat: 'SALE', img: 'https://images.unsplash.com/photo-1594576722512-582bcd46fba3?w=400&auto=format&fit=crop&q=80' },
  ]

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans antialiased selection:bg-slate-900 selection:text-white">
      {/* 1. Promotional Header (Dismissible) */}
      {showPromoBar && (
        <div className="bg-slate-900 px-4 py-2 text-center text-xs font-semibold text-white tracking-wider flex items-center justify-between">
          <div className="flex-1 text-center">
            🔥 <strong className="text-amber-400">CHRONOVA FESTIVAL OF TIME</strong> · GET EXTRA 10% OFF WITH CODE <span className="bg-white/20 px-2 py-0.5 rounded font-mono font-bold">CHRONOVA10</span> · FREE SHIPPING ACROSS INDIA
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

      {/* 2. Main Navigation Header (Fastrack-Class Multi-Level Structure) */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20 gap-4 sm:gap-8">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen((p) => !p)}
              className="lg:hidden p-2 text-slate-700 hover:text-slate-900 text-xl cursor-pointer"
            >
              ☰
            </button>

            {/* Logo */}
            <div
              onClick={() => {
                setActiveNavTab('WATCHES')
                handleResetFilters()
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
                placeholder="Search watches, smartwatches & brands (e.g. Titan, AMOLED, Fastrack, Casio)..."
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

            {/* Header Right Actions (Account, Wishlist, Bag) */}
            <div className="flex items-center gap-3 sm:gap-5 shrink-0">
              {/* Account / Support */}
              <button
                onClick={() => alert('Customer Portal: 100% Official Brand Warranty & Doorstep Service Support.')}
                className="hidden sm:flex flex-col items-center text-slate-700 hover:text-slate-900 cursor-pointer"
              >
                <span className="text-lg">👤</span>
                <span className="text-[10px] font-bold">Account</span>
              </button>

              {/* Wishlist Button */}
              <button
                onClick={() => {
                  setWishlistOpenOnly((prev) => !prev)
                  scrollToCatalog()
                }}
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

              {/* Shopping Bag Button */}
              <button
                onClick={() => setIsCartOpen(true)}
                className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-slate-900 hover:bg-blue-600 text-white transition shadow-sm cursor-pointer"
              >
                <span className="text-base">🛍️</span>
                <span className="text-xs font-black tracking-wide hidden sm:inline">BAG</span>
                <span className="w-5 h-5 rounded-full bg-white text-slate-900 text-xs font-black font-mono flex items-center justify-center">
                  {totalCartCount}
                </span>
              </button>
            </div>
          </div>

          {/* Navigation Bar with Category Mega Menu */}
          <nav className="hidden lg:flex items-center justify-center gap-8 py-3 border-t border-slate-100 text-xs font-bold tracking-wider uppercase text-slate-700">
            {[
              { id: 'MEN', label: 'MEN' },
              { id: 'WOMEN', label: 'WOMEN' },
              { id: 'WATCHES', label: 'WATCHES' },
              { id: 'SMARTWATCHES', label: 'SMARTWATCHES' },
              { id: 'NEW ARRIVALS', label: 'NEW ARRIVALS' },
              { id: 'BESTSELLERS', label: 'BESTSELLERS' },
              { id: 'COLLECTIONS', label: 'COLLECTIONS' },
              { id: 'SALE', label: 'SALE', highlight: true },
            ].map((tab) => (
              <div
                key={tab.id}
                onMouseEnter={() => setActiveMegaMenu(tab.id)}
                onMouseLeave={() => setActiveMegaMenu(null)}
                className="relative py-1"
              >
                <button
                  onClick={() => {
                    setActiveNavTab(tab.id)
                    setWishlistOpenOnly(false)
                    scrollToCatalog()
                  }}
                  className={`transition cursor-pointer pb-1 border-b-2 ${
                    activeNavTab === tab.id
                      ? 'text-slate-900 border-slate-900 font-black'
                      : tab.highlight
                      ? 'text-rose-600 border-transparent hover:border-rose-600'
                      : 'text-slate-600 border-transparent hover:text-slate-900 hover:border-slate-300'
                  }`}
                >
                  {tab.label}
                </button>

                {/* Mega Menu Dropdown */}
                {activeMegaMenu === tab.id && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-[600px] bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 grid grid-cols-3 gap-6 z-50 normal-case">
                    {tab.id === 'MEN' && (
                      <>
                        <div className="space-y-2">
                          <h4 className="font-extrabold text-xs text-slate-900 uppercase">Movement & Style</h4>
                          <ul className="text-xs text-slate-600 space-y-1.5">
                            <li className="hover:text-blue-600 cursor-pointer" onClick={() => { setActiveNavTab('MEN'); setSelectedCategory('Analog Watches'); scrollToCatalog(); }}>Analog Classics</li>
                            <li className="hover:text-blue-600 cursor-pointer" onClick={() => { setActiveNavTab('MEN'); setSelectedCategory('Chronograph'); scrollToCatalog(); }}>Chronographs</li>
                            <li className="hover:text-blue-600 cursor-pointer" onClick={() => { setActiveNavTab('MEN'); setSelectedCategory('Automatic Watches'); scrollToCatalog(); }}>Automatic Skeletals</li>
                            <li className="hover:text-blue-600 cursor-pointer" onClick={() => { setActiveNavTab('MEN'); setSelectedCategory('Sports Watches'); scrollToCatalog(); }}>Sports & Outdoor</li>
                          </ul>
                        </div>
                        <div className="space-y-2">
                          <h4 className="font-extrabold text-xs text-slate-900 uppercase">Popular Brands</h4>
                          <ul className="text-xs text-slate-600 space-y-1.5">
                            <li className="hover:text-blue-600 cursor-pointer" onClick={() => { setSelectedBrand('Titan'); scrollToCatalog(); }}>Titan Regalia & Octane</li>
                            <li className="hover:text-blue-600 cursor-pointer" onClick={() => { setSelectedBrand('Casio'); scrollToCatalog(); }}>Casio G-Shock & Edifice</li>
                            <li className="hover:text-blue-600 cursor-pointer" onClick={() => { setSelectedBrand('Fastrack'); scrollToCatalog(); }}>Fastrack Stunners & Tees</li>
                            <li className="hover:text-blue-600 cursor-pointer" onClick={() => { setSelectedBrand('Seiko'); scrollToCatalog(); }}>Seiko 5 Sports & Presage</li>
                          </ul>
                        </div>
                        <div className="space-y-2">
                          <h4 className="font-extrabold text-xs text-slate-900 uppercase">Connected</h4>
                          <ul className="text-xs text-slate-600 space-y-1.5">
                            <li className="hover:text-blue-600 cursor-pointer" onClick={() => { setSelectedCategory('Smart Watches'); scrollToCatalog(); }}>Bluetooth Calling Smart</li>
                            <li className="hover:text-blue-600 cursor-pointer" onClick={() => { setSelectedBrand('Garmin'); scrollToCatalog(); }}>Garmin GPS Outdoor</li>
                            <li className="hover:text-blue-600 cursor-pointer" onClick={() => { setSelectedBrand('Samsung'); scrollToCatalog(); }}>Samsung Galaxy Watch</li>
                          </ul>
                        </div>
                      </>
                    )}

                    {tab.id === 'WOMEN' && (
                      <>
                        <div className="space-y-2">
                          <h4 className="font-extrabold text-xs text-slate-900 uppercase">Styles & Dials</h4>
                          <ul className="text-xs text-slate-600 space-y-1.5">
                            <li className="hover:text-blue-600 cursor-pointer" onClick={() => { setActiveNavTab('WOMEN'); setSelectedCategory('Minimal Watches'); scrollToCatalog(); }}>Minimalist Sunray</li>
                            <li className="hover:text-blue-600 cursor-pointer" onClick={() => { setActiveNavTab('WOMEN'); setSelectedCategory('Dress Watches'); scrollToCatalog(); }}>Rose Gold & Metal</li>
                            <li className="hover:text-blue-600 cursor-pointer" onClick={() => { setActiveNavTab('WOMEN'); setSelectedCategory('Casual Watches'); scrollToCatalog(); }}>Italian Leather Straps</li>
                          </ul>
                        </div>
                        <div className="space-y-2">
                          <h4 className="font-extrabold text-xs text-slate-900 uppercase">Top Brands</h4>
                          <ul className="text-xs text-slate-600 space-y-1.5">
                            <li className="hover:text-blue-600 cursor-pointer" onClick={() => { setSelectedBrand('Titan'); scrollToCatalog(); }}>Titan Raga Aurora</li>
                            <li className="hover:text-blue-600 cursor-pointer" onClick={() => { setSelectedBrand('Fossil'); scrollToCatalog(); }}>Fossil Jacqueline</li>
                            <li className="hover:text-blue-600 cursor-pointer" onClick={() => { setSelectedBrand('Sonata'); scrollToCatalog(); }}>Sonata Wedding Edit</li>
                          </ul>
                        </div>
                        <div className="space-y-2">
                          <h4 className="font-extrabold text-xs text-slate-900 uppercase">Smart Edits</h4>
                          <ul className="text-xs text-slate-600 space-y-1.5">
                            <li className="hover:text-blue-600 cursor-pointer" onClick={() => { setSelectedBrand('Noise'); scrollToCatalog(); }}>Noise ColorFit Sleek</li>
                            <li className="hover:text-blue-600 cursor-pointer" onClick={() => { setSelectedBrand('Apple Watch'); scrollToCatalog(); }}>Apple Watch SE Gold</li>
                          </ul>
                        </div>
                      </>
                    )}

                    {tab.id === 'SMARTWATCHES' && (
                      <>
                        <div className="space-y-2">
                          <h4 className="font-extrabold text-xs text-slate-900 uppercase">Features</h4>
                          <ul className="text-xs text-slate-600 space-y-1.5">
                            <li className="hover:text-blue-600 cursor-pointer" onClick={() => { setSelectedCategory('Smart Watches'); scrollToCatalog(); }}>Ultra AMOLED Displays</li>
                            <li className="hover:text-blue-600 cursor-pointer" onClick={() => { setSelectedCategory('Fitness Watches'); scrollToCatalog(); }}>Built-in Multi-Band GPS</li>
                            <li className="hover:text-blue-600 cursor-pointer" onClick={() => { setSelectedCategory('Smart Watches'); scrollToCatalog(); }}>BT Calling & Mic</li>
                          </ul>
                        </div>
                        <div className="space-y-2">
                          <h4 className="font-extrabold text-xs text-slate-900 uppercase">Flagship Brands</h4>
                          <ul className="text-xs text-slate-600 space-y-1.5">
                            <li className="hover:text-blue-600 cursor-pointer" onClick={() => { setSelectedBrand('Apple Watch'); scrollToCatalog(); }}>Apple Watch Ultra 2 & S9</li>
                            <li className="hover:text-blue-600 cursor-pointer" onClick={() => { setSelectedBrand('Samsung'); scrollToCatalog(); }}>Samsung Galaxy Watch 6</li>
                            <li className="hover:text-blue-600 cursor-pointer" onClick={() => { setSelectedBrand('Garmin'); scrollToCatalog(); }}>Garmin Fenix & Forerunner</li>
                          </ul>
                        </div>
                        <div className="space-y-2">
                          <h4 className="font-extrabold text-xs text-slate-900 uppercase">Value & Fitness</h4>
                          <ul className="text-xs text-slate-600 space-y-1.5">
                            <li className="hover:text-blue-600 cursor-pointer" onClick={() => { setSelectedBrand('Amazfit'); scrollToCatalog(); }}>Amazfit Cheetah & GTR</li>
                            <li className="hover:text-blue-600 cursor-pointer" onClick={() => { setSelectedBrand('Noise'); scrollToCatalog(); }}>Noise ColorFit Pro</li>
                            <li className="hover:text-blue-600 cursor-pointer" onClick={() => { setSelectedBrand('boAt'); scrollToCatalog(); }}>boAt Wave & Lunar</li>
                          </ul>
                        </div>
                      </>
                    )}

                    {tab.id === 'COLLECTIONS' && (
                      <>
                        <div className="space-y-2">
                          <h4 className="font-extrabold text-xs text-slate-900 uppercase">Shop By Vibe</h4>
                          <ul className="text-xs text-slate-600 space-y-1.5">
                            <li className="hover:text-blue-600 cursor-pointer" onClick={() => { setSelectedVibe('Everyday'); scrollToCatalog(); }}>Everyday Essentials</li>
                            <li className="hover:text-blue-600 cursor-pointer" onClick={() => { setSelectedVibe('Office'); scrollToCatalog(); }}>Office & Corporate</li>
                            <li className="hover:text-blue-600 cursor-pointer" onClick={() => { setSelectedVibe('Street'); scrollToCatalog(); }}>Street & Urban Vibe</li>
                            <li className="hover:text-blue-600 cursor-pointer" onClick={() => { setSelectedVibe('Party'); scrollToCatalog(); }}>Evening Party Glam</li>
                          </ul>
                        </div>
                        <div className="space-y-2">
                          <h4 className="font-extrabold text-xs text-slate-900 uppercase">Horology Series</h4>
                          <ul className="text-xs text-slate-600 space-y-1.5">
                            <li className="hover:text-blue-600 cursor-pointer" onClick={() => { setSelectedCategory('Automatic Watches'); scrollToCatalog(); }}>Skeleton Automatic</li>
                            <li className="hover:text-blue-600 cursor-pointer" onClick={() => { setSelectedCategory('Luxury Watches'); scrollToCatalog(); }}>Swiss & Japanese Luxury</li>
                            <li className="hover:text-blue-600 cursor-pointer" onClick={() => { setSelectedCategory('Chronograph'); scrollToCatalog(); }}>Precision Tachymeters</li>
                          </ul>
                        </div>
                        <div className="space-y-2">
                          <h4 className="font-extrabold text-xs text-slate-900 uppercase">Budget Curations</h4>
                          <ul className="text-xs text-slate-600 space-y-1.5">
                            <li className="hover:text-blue-600 cursor-pointer" onClick={() => { setMaxPrice(5000); scrollToCatalog(); }}>Under ₹5,000</li>
                            <li className="hover:text-blue-600 cursor-pointer" onClick={() => { setMaxPrice(10000); scrollToCatalog(); }}>Under ₹10,000</li>
                            <li className="hover:text-blue-600 cursor-pointer" onClick={() => { setMaxPrice(25000); scrollToCatalog(); }}>Under ₹25,000</li>
                          </ul>
                        </div>
                      </>
                    )}

                    {(tab.id === 'WATCHES' || tab.id === 'NEW ARRIVALS' || tab.id === 'BESTSELLERS' || tab.id === 'SALE') && (
                      <div className="col-span-3 text-center py-2">
                        <p className="text-xs text-slate-600">
                          Click to browse all <strong>{tab.label}</strong> in our 190-timepiece catalog.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
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
          placeholder="Search 190+ watches & smartwatches..."
          className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900"
        />
      </div>

      {/* 3. Hero Section (Clean, Bright, Luxury Fashion-Commerce, Zero 3D) */}
      <section className="relative overflow-hidden bg-gradient-to-r from-slate-100 via-slate-50 to-amber-50/40 border-b border-slate-200 py-12 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-900 text-white text-xs font-bold font-mono tracking-wider">
              <span>⌚ THE 2026 WATCH & SMART COLLECTION</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tight uppercase leading-none">
              FIND YOUR <span className="text-blue-700">TIME.</span>
            </h1>

            <p className="text-base sm:text-lg text-slate-600 max-w-xl font-medium leading-relaxed">
              Designed for every moment. Built for your style. Discover India's premier collection of 190 precision mechanical, quartz, and connected smartwatches.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                onClick={() => {
                  setActiveNavTab('WATCHES')
                  setSelectedCategory('All')
                  scrollToCatalog()
                }}
                className="px-8 py-4 rounded-xl bg-slate-900 hover:bg-blue-600 text-white text-xs font-extrabold uppercase tracking-widest transition shadow-lg shadow-slate-900/10 cursor-pointer"
              >
                SHOP WATCHES →
              </button>

              <button
                onClick={() => {
                  setActiveNavTab('SMARTWATCHES')
                  setSelectedCategory('Smart Watches')
                  scrollToCatalog()
                }}
                className="px-8 py-4 rounded-xl bg-white hover:bg-slate-50 text-slate-900 border border-slate-300 text-xs font-extrabold uppercase tracking-widest transition shadow-sm cursor-pointer"
              >
                SHOP SMARTWATCHES →
              </button>
            </div>
          </div>

          {/* Hero Studio Photography (Clean Crisp Watch Studio Shot) */}
          <div className="lg:col-span-5 relative">
            <div className="relative w-full aspect-square rounded-3xl bg-white border border-slate-200 p-10 flex items-center justify-center overflow-hidden shadow-xl">
              <img
                src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80"
                alt="Chronova Flagship Watch"
                className="max-h-full max-w-full object-contain filter drop-shadow-[0_15px_25px_rgba(0,0,0,0.1)] transition-transform duration-500 hover:scale-105"
              />
              <div className="absolute bottom-4 left-4 right-4 p-3.5 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200 flex items-center justify-between shadow-md">
                <div>
                  <div className="text-[10px] font-mono font-bold text-blue-700 uppercase">Titan Edge Ceramic Classic</div>
                  <div className="text-sm font-black text-slate-900">₹18,995</div>
                </div>
                <span className="px-2.5 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold">
                  ★ 4.9 · 128 Reviews
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Category Discovery Strips (Circular Cards immediately below Hero) */}
      <section className="py-8 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 font-mono">
            SHOP BY CATEGORY
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-4 text-center">
            {categoryStrips.map((cat, idx) => (
              <div
                key={idx}
                onClick={() => {
                  setActiveNavTab(cat.cat)
                  scrollToCatalog()
                }}
                className="group flex flex-col items-center gap-2 cursor-pointer"
              >
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-slate-100 border-2 border-slate-200 group-hover:border-slate-900 p-2 overflow-hidden flex items-center justify-center transition-all duration-300 shadow-xs group-hover:shadow-md">
                  <img src={cat.img} alt={cat.label} className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300" />
                </div>
                <span className="text-[11px] sm:text-xs font-bold text-slate-700 group-hover:text-slate-900">
                  {cat.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Brand Discovery Grid (15 Official Partner Brands) */}
      <section className="py-8 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">
              OFFICIAL BRAND PARTNERS (15 BRANDS)
            </span>
            {selectedBrand !== 'All' && (
              <button
                onClick={() => setSelectedBrand('All')}
                className="text-xs text-blue-700 font-bold hover:underline cursor-pointer"
              >
                Clear Brand Filter ({selectedBrand})
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
            {ALL_BRANDS.map((brand) => (
              <button
                key={brand}
                onClick={() => {
                  setSelectedBrand(selectedBrand === brand ? 'All' : brand)
                  scrollToCatalog()
                }}
                className={`px-5 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition cursor-pointer border shadow-xs ${
                  selectedBrand === brand
                    ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400 hover:text-slate-900'
                }`}
              >
                {brand}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Editorial Story Rails: A WATCH FOR EVERY MOOD / SHOP BY VIBE */}
      <section className="py-12 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className="text-xs font-bold font-mono text-blue-700 uppercase tracking-wider">CURATED STYLES</span>
              <h2 className="text-2xl font-black text-slate-900">A Watch For Every Mood</h2>
            </div>
            <span className="text-xs text-slate-500 font-medium">8 Style Vibes</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {ALL_VIBES.map((vibe) => (
              <button
                key={vibe}
                onClick={() => {
                  setSelectedVibe(selectedVibe === vibe ? 'All' : vibe)
                  scrollToCatalog()
                }}
                className={`p-3 rounded-2xl border text-center transition cursor-pointer ${
                  selectedVibe === vibe
                    ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-white hover:border-slate-400'
                }`}
              >
                <span className="block text-sm mb-1">
                  {vibe === 'Everyday' && '☕'}
                  {vibe === 'Office' && '💼'}
                  {vibe === 'Street' && '🛹'}
                  {vibe === 'Sport' && '⚡'}
                  {vibe === 'Party' && '✨'}
                  {vibe === 'Travel' && '✈️'}
                  {vibe === 'Minimal' && '⚪'}
                  {vibe === 'Premium' && '👑'}
                </span>
                <span className="text-xs font-bold">{vibe}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Curated Rail: Bestsellers of the Season */}
      <section className="py-12 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className="text-xs font-bold font-mono text-blue-700 uppercase tracking-wider">TOP RATED</span>
              <h2 className="text-2xl font-black text-slate-900">Bestsellers of the Season</h2>
            </div>
            <button
              onClick={() => {
                setActiveNavTab('BESTSELLERS')
                scrollToCatalog()
              }}
              className="text-xs text-blue-700 font-bold hover:underline cursor-pointer"
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

      {/* 8. Main Catalog & Interactive Filtering */}
      <main ref={catalogRef} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Filter Controls Bar */}
        <div className="p-5 rounded-3xl bg-slate-50 border border-slate-200 mb-8 space-y-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-base font-black text-slate-900">
                Showing {filteredProducts.length} of {CHRONOVA_CATALOG.length} Watches
              </span>
              {(selectedBrand !== 'All' || selectedCategory !== 'All' || selectedVibe !== 'All' || searchQuery || maxPrice < 100000) && (
                <button
                  onClick={handleResetFilters}
                  className="px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold hover:bg-rose-100 transition cursor-pointer"
                >
                  Reset All Filters ✕
                </button>
              )}
            </div>

            {/* Sorting Dropdown */}
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="text-slate-500">Sort By:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 font-bold focus:outline-none focus:border-slate-900 cursor-pointer"
              >
                <option value="featured">Featured Relevance</option>
                <option value="bestsellers">Bestsellers</option>
                <option value="newest">New Arrivals 2026</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="rating">Top Customer Rated</option>
                <option value="discount">Highest Discount</option>
              </select>
            </div>
          </div>

          {/* Filter Pills (Categories) */}
          <div className="space-y-2 pt-3 border-t border-slate-200">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              <span className="text-slate-500 font-mono text-[11px] font-bold shrink-0">Category:</span>
              <button
                onClick={() => setSelectedCategory('All')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                  selectedCategory === 'All'
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                All Categories
              </button>
              {ALL_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Price Filter Slider & Gender Filters */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-mono text-[11px] font-bold">Gender:</span>
                {['All', 'Men', 'Women', 'Unisex'].map((g) => (
                  <button
                    key={g}
                    onClick={() => setSelectedGender(g as any)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                      selectedGender === g
                        ? 'bg-blue-700 text-white'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3 text-xs">
                <span className="text-slate-500 font-mono text-[11px] font-bold">Max Price: ₹{maxPrice.toLocaleString('en-IN')}</span>
                <input
                  type="range"
                  min="2000"
                  max="100000"
                  step="1000"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="w-32 sm:w-44 accent-slate-900 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Product Grid (4 columns desktop, 3 tablet, 2 mobile) */}
        {filteredProducts.length === 0 ? (
          <div className="py-24 text-center space-y-4">
            <div className="text-5xl">⌚</div>
            <h3 className="text-xl font-bold text-slate-900">No matching watches found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              We couldn't find any watches matching your exact filter combination. Try resetting filters.
            </p>
            <button
              onClick={handleResetFilters}
              className="px-6 py-3 rounded-full bg-slate-900 hover:bg-blue-600 text-white text-xs font-bold transition cursor-pointer"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
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

      {/* 9. Curated Rail: Smartwatch Connected Edit */}
      <section className="py-12 bg-slate-50 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className="text-xs font-bold font-mono text-blue-700 uppercase tracking-wider">CONNECTED PERFORMANCE</span>
              <h2 className="text-2xl font-black text-slate-900">Smartwatch & Fitness Edit</h2>
            </div>
            <button
              onClick={() => {
                setActiveNavTab('SMARTWATCHES')
                scrollToCatalog()
              }}
              className="text-xs text-blue-700 font-bold hover:underline cursor-pointer"
            >
              Explore All Smartwatches →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {smartEdits.map((product) => (
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

      {/* 10. Curated Rail: Automatic & Skeleton Collection */}
      <section className="py-12 bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className="text-xs font-bold font-mono text-blue-700 uppercase tracking-wider">PURE MECHANICAL ART</span>
              <h2 className="text-2xl font-black text-slate-900">Automatic & Skeleton Series</h2>
            </div>
            <button
              onClick={() => {
                setActiveNavTab('AUTOMATIC')
                scrollToCatalog()
              }}
              className="text-xs text-blue-700 font-bold hover:underline cursor-pointer"
            >
              View Mechanical Watches →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {automaticPicks.map((product) => (
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

      {/* 11. Multi-Column Fastrack-Class Footer */}
      <footer className="bg-slate-900 text-slate-400 py-16 text-xs">
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
              <li className="hover:text-white cursor-pointer" onClick={() => { setSelectedBrand('Titan'); scrollToCatalog(); }}>Titan Regalia & Ceramic</li>
              <li className="hover:text-white cursor-pointer" onClick={() => { setSelectedBrand('Casio'); scrollToCatalog(); }}>Casio G-Shock & Edifice</li>
              <li className="hover:text-white cursor-pointer" onClick={() => { setSelectedBrand('Fastrack'); scrollToCatalog(); }}>Fastrack Stunners</li>
              <li className="hover:text-white cursor-pointer" onClick={() => { setSelectedBrand('Seiko'); scrollToCatalog(); }}>Seiko 5 Sports & Presage</li>
              <li className="hover:text-white cursor-pointer" onClick={() => { setSelectedBrand('Apple Watch'); scrollToCatalog(); }}>Apple Watch Series 9 & Ultra</li>
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
