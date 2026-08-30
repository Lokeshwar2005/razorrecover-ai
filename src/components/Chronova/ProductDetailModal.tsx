'use client'

import React, { useState } from 'react'
import type { ChronovaProduct } from './types'

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

  // Ensure initial active image is strictly gallery[0] === primaryImage
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0)
  const [selectedColor, setSelectedColor] = useState<string>(
    product.color_variants?.[0]?.name || 'Standard'
  )
  const [quantity, setQuantity] = useState<number>(1)
  const [pincode, setPincode] = useState<string>('')
  const [deliveryStatus, setDeliveryStatus] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'specs' | 'features' | 'warranty' | 'reviews' | 'faq'>('specs')

  const currentImage = product.images.gallery[activeImageIndex] || product.images.primary

  const handleCheckDelivery = (e: React.FormEvent) => {
    e.preventDefault()
    if (!pincode || pincode.length < 6) {
      setDeliveryStatus('Please enter a valid 6-digit Indian PIN code.')
      return
    }
    setDeliveryStatus(`✓ Express Delivery available to ${pincode} by Tomorrow, 5 PM. Free courier delivery.`)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 md:p-8">
      <div className="relative bg-white rounded-3xl max-w-5xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200 text-left">
        {/* Sticky Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center justify-center font-bold text-base transition shadow-sm cursor-pointer"
          title="Close Product View"
        >
          ✕
        </button>

        <div className="p-6 sm:p-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            {/* LEFT COLUMN: Gallery Thumbnails + Large Studio Image */}
            <div className="lg:col-span-6 flex flex-col-reverse sm:flex-row gap-4 items-start">
              {/* Vertical Thumbnail List */}
              <div className="flex sm:flex-col gap-2.5 overflow-x-auto sm:overflow-y-auto max-h-[460px] pb-2 sm:pb-0 scrollbar-none shrink-0">
                {product.images.gallery.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 bg-slate-50 p-1.5 overflow-hidden transition-all duration-200 cursor-pointer ${
                      activeImageIndex === idx
                        ? 'border-slate-900 shadow-md ring-2 ring-slate-900/10'
                        : 'border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    <img
                      src={img}
                      alt={`${product.name} View ${idx + 1}`}
                      className="w-full h-full object-contain filter drop-shadow-xs"
                    />
                  </button>
                ))}
              </div>

              {/* Main Large Image Container */}
              <div className="relative flex-1 aspect-square w-full rounded-3xl bg-slate-50 border border-slate-200 p-8 flex items-center justify-center overflow-hidden shadow-inner">
                {product.badge && (
                  <span className="absolute top-4 left-4 z-10 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-black uppercase tracking-wider font-mono shadow-md">
                    {product.badge}
                  </span>
                )}
                <img
                  src={currentImage}
                  alt={product.name}
                  className="max-h-full max-w-full object-contain filter drop-shadow-xl transition-all duration-300 hover:scale-105"
                />
              </div>
            </div>

            {/* RIGHT COLUMN: Product Details & Buying Actions */}
            <div className="lg:col-span-6 space-y-6">
              {/* Header Info */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-md bg-blue-50 text-blue-800 border border-blue-200 text-xs font-black font-mono uppercase tracking-wider">
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
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-900 border border-amber-200 text-xs font-bold font-mono">
                    <span>★ {product.rating}</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    ({product.review_count} Verified Customer Reviews)
                  </span>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {product.stock_status}
                  </span>
                </div>
              </div>

              {/* Pricing Section */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-black text-slate-900">
                    ₹{product.price_rupees.toLocaleString('en-IN')}
                  </span>
                  {product.discount_percent > 0 && (
                    <>
                      <span className="text-base text-slate-400 line-through font-semibold">
                        ₹{product.original_price_rupees.toLocaleString('en-IN')}
                      </span>
                      <span className="text-sm font-black text-rose-600 font-mono">
                        ({product.discount_percent}% OFF)
                      </span>
                    </>
                  )}
                </div>
                <div className="text-[11px] font-medium text-slate-500">
                  Inclusive of all taxes · Free pan-India express courier shipping
                </div>
              </div>

              {/* Bank & Coupon Offers Box */}
              <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-1.5 text-xs text-amber-900">
                <div className="font-bold flex items-center gap-1.5">
                  <span>🏷️ Special Bank & Promo Offers:</span>
                </div>
                <ul className="space-y-1 pl-4 list-disc text-[11px]">
                  <li>Use code <strong className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-300">CHRONOVA10</strong> for extra 10% instant discount at checkout.</li>
                  <li>Flat ₹500 off on all major Credit/Debit Cards & UPI via Razorpay.</li>
                </ul>
              </div>

              {/* Colorways Selector */}
              {product.color_variants && product.color_variants.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-800">
                    Selected Dial/Strap Finish: <strong className="text-slate-900 font-black">{selectedColor}</strong>
                  </span>
                  <div className="flex items-center gap-3">
                    {product.color_variants.map((c) => (
                      <button
                        key={c.name}
                        onClick={() => setSelectedColor(c.name)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                          selectedColor === c.name
                            ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                            : 'border-slate-300 bg-white text-slate-700 hover:border-slate-500'
                        }`}
                      >
                        <span className="w-3.5 h-3.5 rounded-full border border-white" style={{ backgroundColor: c.hex }} />
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
                      className="px-3.5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                    >
                      −
                    </button>
                    <span className="px-4 py-2.5 text-xs font-black text-slate-900 font-mono">
                      {quantity}
                    </span>
                    <button
                      onClick={() => setQuantity((q) => Math.min(5, q + 1))}
                      className="px-3.5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                    >
                      +
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      onAddToCart(product, quantity, selectedColor)
                      onClose()
                    }}
                    className="flex-1 py-3.5 rounded-xl bg-slate-900 hover:bg-blue-600 text-white text-xs font-black uppercase tracking-wider transition shadow-md cursor-pointer"
                    style={{ color: "#ffffff", backgroundColor: "#0f172a" }}
                  >
                    ADD TO BAG
                  </button>

                  <button
                    onClick={() => {
                      onInstantBuy(product, quantity, selectedColor)
                      onClose()
                    }}
                    className="flex-1 py-3.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-black uppercase tracking-wider transition shadow-md cursor-pointer"
                    style={{ color: "#ffffff", backgroundColor: "#1d4ed8" }}
                  >
                    BUY NOW WITH RAZORPAY
                  </button>
                </div>
              </div>

              {/* Pincode Delivery Check */}
              <div className="pt-2">
                <form onSubmit={handleCheckDelivery} className="flex gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    placeholder="Enter 6-digit Pincode (e.g. 560001)"
                    className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-900"
                  />
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold uppercase transition cursor-pointer"
                  >
                    CHECK
                  </button>
                </form>
                {deliveryStatus && (
                  <p className="text-xs text-slate-700 font-medium mt-2">
                    {deliveryStatus}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* LOWER SECTION: Full Specifications & Verified Reviews Accordions */}
          <div className="mt-12 pt-8 border-t border-slate-200">
            {/* Tabs */}
            <div className="flex items-center gap-4 sm:gap-8 border-b border-slate-200 overflow-x-auto pb-1 text-xs font-bold uppercase tracking-wider text-slate-500">
              <button
                onClick={() => setActiveTab('specs')}
                className={`pb-2.5 transition cursor-pointer border-b-2 ${
                  activeTab === 'specs' ? 'text-slate-900 border-slate-900 font-black' : 'border-transparent hover:text-slate-900'
                }`}
              >
                Specifications
              </button>
              <button
                onClick={() => setActiveTab('features')}
                className={`pb-2.5 transition cursor-pointer border-b-2 ${
                  activeTab === 'features' ? 'text-slate-900 border-slate-900 font-black' : 'border-transparent hover:text-slate-900'
                }`}
              >
                Key Features
              </button>
              <button
                onClick={() => setActiveTab('warranty')}
                className={`pb-2.5 transition cursor-pointer border-b-2 ${
                  activeTab === 'warranty' ? 'text-slate-900 border-slate-900 font-black' : 'border-transparent hover:text-slate-900'
                }`}
              >
                Warranty & Shipping
              </button>
              <button
                onClick={() => setActiveTab('reviews')}
                className={`pb-2.5 transition cursor-pointer border-b-2 ${
                  activeTab === 'reviews' ? 'text-slate-900 border-slate-900 font-black' : 'border-transparent hover:text-slate-900'
                }`}
              >
                Verified Customer Reviews ({product.reviews.length})
              </button>
            </div>

            {/* Tab Contents */}
            <div className="py-6 text-xs text-slate-700">
              {activeTab === 'specs' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-slate-100">
                      <span className="font-semibold text-slate-500">Movement Calibre:</span>
                      <span className="font-black text-slate-900">{product.specs.movement}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-100">
                      <span className="font-semibold text-slate-500">Case Dimension:</span>
                      <span className="font-black text-slate-900">{product.specs.case_size}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-100">
                      <span className="font-semibold text-slate-500">Case Material:</span>
                      <span className="font-black text-slate-900">{product.specs.case_material}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-100">
                      <span className="font-semibold text-slate-500">Dial Color:</span>
                      <span className="font-black text-slate-900">{product.specs.dial_color}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-slate-100">
                      <span className="font-semibold text-slate-500">Water Resistance:</span>
                      <span className="font-black text-slate-900">{product.specs.water_resistance}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-100">
                      <span className="font-semibold text-slate-500">Strap Material:</span>
                      <span className="font-black text-slate-900">{product.specs.strap_material}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-100">
                      <span className="font-semibold text-slate-500">Glass Crystal:</span>
                      <span className="font-black text-slate-900">{product.specs.glass || 'Sapphire Crystal'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-100">
                      <span className="font-semibold text-slate-500">Warranty:</span>
                      <span className="font-black text-slate-900">{product.specs.warranty}</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'features' && (
                <div className="space-y-4">
                  <p className="leading-relaxed text-slate-600">{product.description}</p>
                  <div className="space-y-2 pt-2">
                    <h4 className="font-black text-slate-900 uppercase">Product Highlights</h4>
                    <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                      {product.highlights.map((h, i) => (
                        <li key={i}>{h}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {activeTab === 'warranty' && (
                <div className="space-y-4 leading-relaxed text-slate-600">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <h4 className="font-black text-slate-900 uppercase">100% Genuine Brand Warranty</h4>
                    <p>All timepieces purchased through CHRONOVA include an official stamped manufacturer warranty card with pan-India authorized service centre coverage.</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <h4 className="font-black text-slate-900 uppercase">Free 7-Day Doorstep Replacement</h4>
                    <p>If your watch arrives damaged or defective, request a free doorstep reverse pickup and replacement within 7 days of delivery.</p>
                  </div>
                </div>
              )}

              {activeTab === 'reviews' && (
                <div className="space-y-6">
                  {product.reviews.map((rev) => (
                    <div key={rev.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900">{rev.reviewer_name}</span>
                          {rev.verified_purchase && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              ✓ Verified Buyer
                            </span>
                          )}
                        </div>
                        <span className="text-slate-400 text-[11px]">{rev.date}</span>
                      </div>
                      <div className="text-amber-500 font-bold">
                        {'★'.repeat(rev.rating)}{'☆'.repeat(5 - rev.rating)}
                      </div>
                      <h5 className="font-black text-slate-900">{rev.title}</h5>
                      <p className="text-slate-600 leading-relaxed">{rev.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
