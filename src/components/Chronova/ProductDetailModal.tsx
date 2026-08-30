'use client'

import React, { useState } from 'react'
import type { ChronovaProduct } from './types'

interface ProductDetailModalProps {
  product: ChronovaProduct
  onClose: () => void
  onAddToCart: (product: ChronovaProduct, qty: number, color?: string) => void
  onInstantBuy: (product: ChronovaProduct, qty: number, color?: string) => void
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  onAddToCart,
  onInstantBuy,
}) => {
  const [selectedImageIdx, setSelectedImageIdx] = useState(0)
  const [selectedColor, setSelectedColor] = useState(product.color_variants[0]?.name || 'Standard')
  const [quantity, setQuantity] = useState(1)
  const [activeTab, setActiveTab] = useState<'specs' | 'reviews' | 'offers' | 'warranty'>('specs')
  const [pincode, setPincode] = useState('560048')
  const [pincodeVerified, setPincodeVerified] = useState(true)

  const formatINR = (amt: number) => `₹${amt.toLocaleString('en-IN')}`

  const galleryImages = product.images.gallery && product.images.gallery.length > 0
    ? product.images.gallery
    : [product.images.primary]

  const currentImage = galleryImages[selectedImageIdx] || product.images.primary

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl my-auto text-slate-900">
        {/* Header with Close */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-mono font-bold uppercase tracking-wider text-blue-700">
              {product.brand} · {product.series}
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500 font-mono">{product.model}</span>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition cursor-pointer"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Modal Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 max-h-[82vh] overflow-y-auto">
          {/* Left Column: Gallery (Clean white studio container) */}
          <div className="md:col-span-6 p-6 flex flex-col justify-between bg-[#f8fafc] border-b md:border-b-0 md:border-r border-slate-200">
            <div className="w-full aspect-square rounded-2xl bg-white border border-slate-200 p-8 flex items-center justify-center overflow-hidden relative shadow-sm">
              <img
                src={currentImage}
                alt={`${product.brand} ${product.name}`}
                className="max-h-full max-w-full object-contain transition-transform duration-300 hover:scale-110 cursor-zoom-in"
              />
              {product.badge && (
                <span className="absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-bold tracking-wider bg-slate-900 text-white shadow-sm">
                  {product.badge.toUpperCase()}
                </span>
              )}
            </div>

            {/* Thumbnail Strip */}
            <div className="flex items-center gap-3 mt-4 overflow-x-auto pb-1">
              {galleryImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImageIdx(idx)}
                  className={`w-16 h-16 rounded-xl bg-white p-1.5 border transition cursor-pointer shrink-0 ${
                    selectedImageIdx === idx
                      ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-sm'
                      : 'border-slate-200 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt={`${product.name} view ${idx + 1}`} className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          </div>

          {/* Right Column: Information, Specs, Offers & Purchase */}
          <div className="md:col-span-6 p-6 space-y-5 bg-white">
            {/* Title & Brand */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-mono text-[11px] font-bold">
                  {product.category}
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-[11px] text-slate-500 font-medium">{product.gender}'s Edition</span>
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                {product.name}
              </h2>

              <div className="flex items-center gap-2 pt-1">
                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-bold text-xs flex items-center gap-1">
                  <span>★</span>
                  <span>{product.rating.toFixed(1)}</span>
                </span>
                <span className="text-xs text-slate-600 font-medium">
                  <strong>{product.review_count} verified ratings</strong> & 100% genuine guaranteed
                </span>
              </div>
            </div>

            {/* Pricing Card */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="flex items-baseline gap-2.5">
                <span className="text-2xl sm:text-3xl font-black text-slate-900">
                  {formatINR(product.price_rupees)}
                </span>
                {product.original_price_rupees > product.price_rupees && (
                  <span className="text-sm text-slate-400 line-through font-mono">
                    {formatINR(product.original_price_rupees)}
                  </span>
                )}
                {product.discount_percent > 0 && (
                  <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                    SAVE {product.discount_percent}%
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Inclusive of all taxes · Free Insured Express Delivery across India
              </p>
            </div>

            {/* Pincode Delivery Check */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">Deliver to:</span>
              <input
                type="text"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                maxLength={6}
                className="w-24 px-2 py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600"
              />
              <button
                onClick={() => setPincodeVerified(true)}
                className="text-blue-600 font-bold hover:underline cursor-pointer"
              >
                Check
              </button>
              {pincodeVerified && (
                <span className="text-[11px] text-emerald-600 font-medium">
                  ✓ Express delivery by tomorrow 5 PM
                </span>
              )}
            </div>

            {/* Colorways Selector */}
            {product.color_variants && product.color_variants.length > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600 font-semibold">Dial / Strap Color:</span>
                  <span className="text-slate-900 font-bold">{selectedColor}</span>
                </div>
                <div className="flex items-center gap-2">
                  {product.color_variants.map((c, idx) => (
                    <button
                      key={c.name}
                      onClick={() => {
                        setSelectedColor(c.name)
                        if (idx < galleryImages.length) {
                          setSelectedImageIdx(idx)
                        }
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono flex items-center gap-2 border transition cursor-pointer ${
                        selectedColor === c.name
                          ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                      }`}
                    >
                      <span className="w-3 h-3 rounded-full border border-slate-300" style={{ backgroundColor: c.hex }} />
                      <span>{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Expandable Tabs for Specs / Reviews / Offers */}
            <div className="border-t border-slate-200 pt-3 space-y-3">
              <div className="flex gap-4 border-b border-slate-200 text-xs font-bold">
                <button
                  onClick={() => setActiveTab('specs')}
                  className={`pb-2 transition cursor-pointer ${
                    activeTab === 'specs'
                      ? 'text-blue-700 border-b-2 border-blue-700'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Specifications
                </button>
                <button
                  onClick={() => setActiveTab('reviews')}
                  className={`pb-2 transition cursor-pointer ${
                    activeTab === 'reviews'
                      ? 'text-blue-700 border-b-2 border-blue-700'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Reviews ({product.reviews.length})
                </button>
                <button
                  onClick={() => setActiveTab('offers')}
                  className={`pb-2 transition cursor-pointer ${
                    activeTab === 'offers'
                      ? 'text-blue-700 border-b-2 border-blue-700'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Bank Offers (3)
                </button>
              </div>

              {/* Specs Content */}
              {activeTab === 'specs' && (
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-400 block text-[10px]">MOVEMENT</span>
                    <span className="text-slate-900 font-bold">{product.specs.movement}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-400 block text-[10px]">CASE SIZE</span>
                    <span className="text-slate-900 font-bold">{product.specs.case_size}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-400 block text-[10px]">CASE MATERIAL</span>
                    <span className="text-slate-900 font-bold">{product.specs.case_material}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-400 block text-[10px]">WATER RESISTANCE</span>
                    <span className="text-slate-900 font-bold">{product.specs.water_resistance}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-400 block text-[10px]">STRAP</span>
                    <span className="text-slate-900 font-bold">{product.specs.strap_material}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-400 block text-[10px]">WARRANTY</span>
                    <span className="text-slate-900 font-bold">{product.specs.warranty}</span>
                  </div>
                </div>
              )}

              {/* Reviews Content */}
              {activeTab === 'reviews' && (
                <div className="space-y-2.5 max-h-44 overflow-y-auto pr-1">
                  {product.reviews.map((rev) => (
                    <div key={rev.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900">{rev.reviewer_name}</span>
                          {rev.verified_purchase && (
                            <span className="text-[10px] text-emerald-600 font-semibold font-mono">✓ Verified Buyer</span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">{rev.date}</span>
                      </div>
                      <div className="text-amber-500 text-xs">{'★'.repeat(rev.rating)}</div>
                      <div className="text-xs font-bold text-slate-900">{rev.title}</div>
                      <p className="text-xs text-slate-600 leading-relaxed">{rev.comment}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Offers Content */}
              {activeTab === 'offers' && (
                <div className="space-y-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
                    <strong>10% Instant Discount</strong> on code <code className="font-bold">CHRONOVA10</code>
                  </div>
                  <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800">
                    <strong>Flat ₹500 Cashback</strong> on Razorpay UPI checkout
                  </div>
                  <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-800">
                    <strong>No Cost EMI</strong> starting at ₹849/month
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-slate-200 flex gap-3">
              <button
                onClick={() => {
                  onAddToCart(product, quantity, selectedColor)
                  onClose()
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-xs transition cursor-pointer border border-slate-300"
              >
                Add to Bag
              </button>

              <button
                onClick={() => {
                  onInstantBuy(product, quantity, selectedColor)
                  onClose()
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-900 hover:bg-blue-600 text-white font-bold text-xs transition cursor-pointer shadow-md flex items-center justify-center gap-1.5"
              >
                <span>Buy Now with Razorpay</span>
                <span>→</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
