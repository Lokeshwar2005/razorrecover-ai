'use client'

import React, { useState } from 'react'
import type { ChronovaProduct } from './types'
import { getAssetUrl } from './utils'

interface ProductDetailModalProps {
  product: ChronovaProduct | null
  onClose: () => void
  onAddToCart: (product: ChronovaProduct, quantity: number, selectedColor?: string) => void
  onInstantBuy: (product: ChronovaProduct, quantity: number, selectedColor?: string) => void
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  onAddToCart,
  onInstantBuy,
}) => {
  if (!product) return null

  const [activeImageIndex, setActiveImageIndex] = useState<number>(0)
  const [selectedColor, setSelectedColor] = useState<string>(
    product.color_variants?.[0]?.name || 'Standard'
  )
  const [quantity, setQuantity] = useState<number>(1)
  const [pincode, setPincode] = useState<string>('')
  const [deliveryStatus, setDeliveryStatus] = useState<string | null>(null)
  const [isZoomed, setIsZoomed] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<'specs' | 'features' | 'warranty' | 'reviews' | 'faq'>('specs')

  const handleCheckDelivery = (e: React.FormEvent) => {
    e.preventDefault()
    if (/^\d{6}$/.test(pincode)) {
      setDeliveryStatus(`✓ Express Delivery available to PIN ${pincode} by Tomorrow, 5 PM. Free insured courier.`)
    } else {
      setDeliveryStatus('❌ Please enter a valid 6-digit Indian PIN code.')
    }
  }

  const currentImage = product.images.gallery[activeImageIndex] || product.images.primary

  const angleLabels = [
    '01. Hero Studio View',
    '02. 45° Perspective',
    '03. Lateral Profile',
    '04. Sapphire Caseback',
    '05. 10X Dial Macro',
    '06. Bracelet & Clasp',
    '07. Fluted Crown Detail',
    '08. Wrist Lifestyle',
    '09. Editorial Still Life',
    '10. Luxury Gift Box',
    '11. Super-LumiNova'
  ]

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 animate-fade-in">
      <div className="relative w-full max-w-6xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-4 sm:my-8 text-left max-h-[92vh] flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-5 sm:right-5 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center justify-center font-bold text-base transition shadow-sm cursor-pointer"
          title="Close Product View"
        >
          ✕
        </button>

        <div className="p-4 sm:p-8 md:p-10 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            {/* LEFT COLUMN: Large Studio Image (Exact Same Image as Outside Card) */}
            <div className="lg:col-span-6 flex flex-col items-center justify-center">
              <div className="relative aspect-square w-full rounded-3xl bg-slate-50 border border-slate-200 p-8 sm:p-10 flex flex-col items-center justify-between overflow-hidden shadow-inner min-h-[380px] sm:min-h-[480px]">
                {/* Badge (Top-Left) */}
                <div className="w-full flex items-center justify-between z-10">
                  {product.badge ? (
                    <span className="px-3.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-black uppercase tracking-wider font-mono shadow-md">
                      {product.badge}
                    </span>
                  ) : <span />}

                  <span className="px-3 py-1 rounded-full bg-white/90 backdrop-blur-md border border-slate-200 text-slate-700 text-[11px] font-mono font-bold shadow-xs">
                    ★ {product.rating} Verified Studio
                  </span>
                </div>

                <div
                  className="flex-1 w-full flex items-center justify-center cursor-zoom-in"
                  onClick={() => setIsZoomed(!isZoomed)}
                  title="Click to zoom"
                >
                  <img
                    src={getAssetUrl(product.images.primary)}
                    alt={product.name}
                    className={`max-h-full max-w-full object-contain filter drop-shadow-xl transition-all duration-300 ${
                      isZoomed ? 'scale-135' : 'hover:scale-105'
                    }`}
                  />
                </div>

                <div className="w-full text-center z-10">
                  <span className="text-[11px] font-mono text-slate-400 font-bold uppercase tracking-wider">
                    {product.brand} Official Studio Photograph
                  </span>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Product Details & Buying Actions */}
            <div className="lg:col-span-6 space-y-6">
              {/* Header Info */}
              <div className="space-y-2">
                <div className="flex items-center gap-2.5">
                  <span className="px-3.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 text-xs font-black font-mono uppercase tracking-wider">
                    {product.brand} Official
                  </span>
                  <span className="text-xs font-bold text-slate-500 font-mono">
                    Model: {product.model}
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
                  {product.name}
                </h1>

                <div className="flex items-center gap-3 pt-1">
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-50 text-amber-900 border border-amber-200 text-xs font-black font-mono">
                    <span>★ {product.rating}</span>
                  </div>
                  <span className="text-xs font-bold text-slate-500">
                    ({product.review_count} Verified Customer Reviews)
                  </span>
                  <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                    {product.stock_status}
                  </span>
                </div>
              </div>

              {/* Pricing Section */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl sm:text-4xl font-black text-slate-900">
                    ₹{product.price_rupees.toLocaleString('en-IN')}
                  </span>
                  {product.discount_percent > 0 && (
                    <>
                      <span className="text-lg text-slate-400 line-through font-semibold">
                        ₹{product.original_price_rupees.toLocaleString('en-IN')}
                      </span>
                      <span className="text-sm font-black text-rose-600 font-mono bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        ({product.discount_percent}% OFF)
                      </span>
                    </>
                  )}
                </div>
                <div className="text-xs font-semibold text-slate-500">
                  Inclusive of all taxes · Free pan-India insured express delivery
                </div>
              </div>

              {/* Bank & Coupon Offers Box */}
              <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-2 text-xs text-amber-950">
                <div className="font-black flex items-center gap-2 text-sm">
                  <span>🏷️ Special Bank & Promo Coupons:</span>
                </div>
                <ul className="space-y-1.5 pl-4 list-disc text-xs font-medium">
                  <li>Use code <strong className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-amber-300">CHRONOVA10</strong> for extra 10% instant discount at checkout.</li>
                  <li>Use code <strong className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-amber-300">WELCOME500</strong> for flat ₹500 off.</li>
                  <li>Flat ₹500 instant cashback on all UPI & Credit Cards via Razorpay.</li>
                </ul>
              </div>

              {/* Colorways Selector */}
              {product.color_variants && product.color_variants.length > 0 && (
                <div className="space-y-2.5">
                  <span className="text-xs font-bold text-slate-800">
                    Dial/Strap Finish: <strong className="text-slate-900 font-black">{selectedColor}</strong>
                  </span>
                  <div className="flex flex-wrap items-center gap-3">
                    {product.color_variants.map((c) => (
                      <button
                        key={c.name}
                        onClick={() => setSelectedColor(c.name)}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                          selectedColor === c.name
                            ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                            : 'border-slate-300 bg-white text-slate-700 hover:border-slate-500'
                        }`}
                      >
                        <span className="w-4 h-4 rounded-full border border-white" style={{ backgroundColor: c.hex }} />
                        <span>{c.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity Stepper & Buy Buttons */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3">
                  <div className="flex items-center border border-slate-300 rounded-xl bg-white overflow-hidden shadow-xs">
                    <button
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="px-4 py-3 text-xs font-black text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                    >
                      −
                    </button>
                    <span className="px-4 py-3 text-sm font-black text-slate-900 font-mono">
                      {quantity}
                    </span>
                    <button
                      onClick={() => setQuantity((q) => Math.min(5, q + 1))}
                      className="px-4 py-3 text-xs font-black text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                    >
                      +
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      onAddToCart(product, quantity, selectedColor)
                      onClose()
                    }}
                    className="flex-1 py-4 rounded-2xl bg-slate-900 hover:bg-blue-600 text-white text-xs sm:text-sm font-black uppercase tracking-wider transition shadow-md cursor-pointer"
                    style={{ color: "#ffffff", backgroundColor: "#0f172a" }}
                  >
                    <span style={{ color: "#ffffff" }}>ADD TO BAG</span>
                  </button>

                  <button
                    onClick={() => {
                      onInstantBuy(product, quantity, selectedColor)
                      onClose()
                    }}
                    className="flex-1 py-4 rounded-2xl bg-blue-700 hover:bg-blue-800 text-white text-xs sm:text-sm font-black uppercase tracking-wider transition shadow-md cursor-pointer"
                    style={{ color: "#ffffff", backgroundColor: "#1d4ed8" }}
                  >
                    <span style={{ color: "#ffffff" }}>BUY NOW</span>
                  </button>
                </div>
              </div>

              {/* Pincode Delivery Check */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-800">Check Delivery Timeline & COD:</span>
                <form onSubmit={handleCheckDelivery} className="flex gap-2">
                  <input
                    type="text"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter 6-digit Indian PIN Code"
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-900"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer"
                    style={{ color: "#ffffff", backgroundColor: "#0f172a" }}
                  >
                    Check
                  </button>
                </form>
                {deliveryStatus && (
                  <div className="text-xs font-bold text-emerald-800 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                    {deliveryStatus}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* LOWER SECTION: Technical Specifications Tabs */}
          <div className="mt-12 pt-8 border-t border-slate-200">
            {/* Tabs Header */}
            <div className="flex border-b border-slate-200 gap-4 sm:gap-8 overflow-x-auto scrollbar-none">
              {[
                { id: 'specs', label: 'SPECIFICATIONS' },
                { id: 'features', label: 'HIGHLIGHTS & CRAFT' },
                { id: 'warranty', label: '2-YEAR WARRANTY' },
                { id: 'reviews', label: `REVIEWS (${product.reviews.length})` },
                { id: 'faq', label: 'FAQS' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as any)}
                  className={`pb-3 text-xs sm:text-sm font-black uppercase tracking-wider border-b-2 transition cursor-pointer whitespace-nowrap ${
                    activeTab === t.id
                      ? 'border-slate-900 text-slate-900'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab Contents */}
            <div className="py-6">
              {activeTab === 'specs' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {Object.entries(product.specs).map(([key, val]) => (
                    <div key={key} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                      <span className="text-xs font-bold uppercase font-mono text-slate-500">
                        {key.replace(/_/g, ' ')}
                      </span>
                      <p className="text-sm font-black text-slate-900">{val ? String(val) : 'N/A'}</p>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'features' && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-700 leading-relaxed font-medium">{product.description}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {product.highlights.map((h, i) => (
                      <div key={i} className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-emerald-700 font-bold text-base">✓</span>
                        <span className="text-xs sm:text-sm font-bold text-slate-800">{h}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'warranty' && (
                <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-4 text-xs sm:text-sm text-slate-700">
                  <h4 className="text-base font-black text-slate-900">
                    Official {product.brand} Doorstep Warranty & Protection
                  </h4>
                  <p className="font-medium">
                    Every timepiece sold on Chronova is 100% genuine and comes directly with official manufacturer warranty coverage.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                    <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-1">
                      <span className="text-xl">🛡️</span>
                      <h5 className="font-black text-slate-900">2 Years Coverage</h5>
                      <p className="text-xs text-slate-500">Complete internal movement and dial calibration warranty.</p>
                    </div>
                    <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-1">
                      <span className="text-xl">🏡</span>
                      <h5 className="font-black text-slate-900">Doorstep Pickup</h5>
                      <p className="text-xs text-slate-500">Free courier pickup from your home for any service claims.</p>
                    </div>
                    <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-1">
                      <span className="text-xl">📜</span>
                      <h5 className="font-black text-slate-900">Official Certificate</h5>
                      <p className="text-xs text-slate-500">Includes stamped warranty card and serialized authenticity seal.</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'reviews' && (
                <div className="space-y-4">
                  {product.reviews.map((rev) => (
                    <div key={rev.id} className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm text-slate-900">{rev.reviewer_name}</span>
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            Verified Buyer
                          </span>
                        </div>
                        <span className="text-xs font-mono text-slate-400">{rev.date}</span>
                      </div>
                      <div className="flex items-center gap-1 text-amber-500 text-sm">
                        {'★'.repeat(rev.rating)}
                        {'☆'.repeat(5 - rev.rating)}
                      </div>
                      <h5 className="font-black text-sm text-slate-900">{rev.title}</h5>
                      <p className="text-xs sm:text-sm text-slate-600 font-medium">{rev.comment}</p>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'faq' && (
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <h5 className="font-black text-sm text-slate-900">Is this watch 100% genuine and original?</h5>
                    <p className="text-xs sm:text-sm text-slate-600 font-medium">Yes, Chronova is an authorized retailer for {product.brand}. Every watch is shipped in original retail box with stamped manufacturer warranty.</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <h5 className="font-black text-sm text-slate-900">What is the return and replacement policy?</h5>
                    <p className="text-xs sm:text-sm text-slate-600 font-medium">We provide a 7-day hassle-free doorstep replacement or full refund policy in case of any sizing or manufacturing defect.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
