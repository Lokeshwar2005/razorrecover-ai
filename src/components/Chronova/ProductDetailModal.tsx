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
  const [activeTab, setActiveTab] = useState<'specs' | 'reviews'>('specs')

  const formatINR = (amt: number) => `₹${amt.toLocaleString('en-IN')}`

  const currentImage = product.images[selectedImageIdx] || product.images[0]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[#090e1a] border border-[#1e293b] rounded-3xl overflow-hidden shadow-2xl my-auto text-[#e2e8f0]">
        {/* Header with Close */}
        <div className="p-4 sm:p-5 bg-[#040711] border-b border-[#1e293b] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#38bdf8]">
              {product.brand} · {product.series}
            </span>
            <span className="text-[#64748b] text-xs">|</span>
            <span className="text-xs text-[#94a3b8]">{product.model}</span>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#1e293b] text-[#94a3b8] hover:text-white flex items-center justify-center transition cursor-pointer"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Modal Grid: Image Gallery Left, Product Info Right */}
        <div className="grid grid-cols-1 md:grid-cols-12 max-h-[80vh] overflow-y-auto">
          {/* Left Column: Multi-Angle Photographic Gallery */}
          <div className="md:col-span-6 p-6 flex flex-col justify-between bg-[#050811] border-b md:border-b-0 md:border-r border-[#1e293b]">
            <div className="w-full aspect-square rounded-2xl bg-[#080d1a] border border-[#1e293b] p-6 flex items-center justify-center overflow-hidden relative">
              <img
                src={currentImage}
                alt={product.name}
                className="max-h-full max-w-full object-contain transition-transform duration-300 hover:scale-110 cursor-zoom-in"
              />
              {product.badge && (
                <span className="absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-bold font-mono bg-[#38bdf8] text-[#050811] shadow">
                  {product.badge.toUpperCase()}
                </span>
              )}
            </div>

            {/* Thumbnail Strip */}
            <div className="flex items-center gap-3 mt-4 overflow-x-auto pb-1">
              {product.images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImageIdx(idx)}
                  className={`w-16 h-16 rounded-xl bg-[#090e1a] p-1.5 border transition cursor-pointer shrink-0 ${
                    selectedImageIdx === idx
                      ? 'border-[#38bdf8] shadow-md shadow-sky-500/20'
                      : 'border-[#1e293b] opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt="thumbnail" className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          </div>

          {/* Right Column: Details, Specs, Reviews, Actions */}
          <div className="md:col-span-6 p-6 space-y-5 bg-[#090e1a]">
            {/* Title & Ratings */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-[#38bdf8]/15 text-[#38bdf8] font-mono text-[11px] font-bold">
                  {product.category}
                </span>
                <span className="text-[11px] text-[#64748b]">·</span>
                <span className="text-[11px] text-[#94a3b8]">{product.gender}'s Collection</span>
              </div>
              <h2 className="text-xl font-extrabold text-white leading-tight">
                {product.name}
              </h2>

              <div className="flex items-center gap-2 pt-1">
                <span className="px-2 py-0.5 rounded bg-[#f59e0b]/20 text-[#f59e0b] font-bold text-xs flex items-center gap-1">
                  <span>★</span>
                  <span>{product.rating.toFixed(1)}</span>
                </span>
                <span className="text-xs text-[#94a3b8]">
                  Based on <strong>{product.review_count} verified customer ratings</strong>
                </span>
              </div>
            </div>

            {/* Pricing Section */}
            <div className="p-4 rounded-2xl bg-[#050811] border border-[#1e293b] space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-white">
                  {formatINR(product.price_rupees)}
                </span>
                {product.original_price_rupees > product.price_rupees && (
                  <span className="text-xs text-[#64748b] line-through font-mono">
                    {formatINR(product.original_price_rupees)}
                  </span>
                )}
                {product.discount_percent > 0 && (
                  <span className="text-xs text-[#ef4444] font-bold font-mono">
                    ({product.discount_percent}% OFF)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#94a3b8]">
                Inclusive of all taxes · Free Insured Express Delivery across India (2-3 Days)
              </p>
            </div>

            {/* Colorways Selector */}
            {product.color_variants && product.color_variants.length > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-[#94a3b8] font-medium">Selected Colorway:</span>
                  <span className="text-white font-bold">{selectedColor}</span>
                </div>
                <div className="flex items-center gap-2">
                  {product.color_variants.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => {
                        setSelectedColor(c.name)
                        if (c.image_index !== undefined && product.images[c.image_index]) {
                          setSelectedImageIdx(c.image_index)
                        }
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono flex items-center gap-2 border transition cursor-pointer ${
                        selectedColor === c.name
                          ? 'border-[#38bdf8] bg-[#0b132b] text-white shadow-sm'
                          : 'border-[#1e293b] bg-[#050811] text-[#94a3b8] hover:text-white'
                      }`}
                    >
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.hex }} />
                      <span>{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tabs for Specs vs Reviews */}
            <div className="border-t border-[#1e293b] pt-4 space-y-3">
              <div className="flex gap-4 border-b border-[#1e293b]">
                <button
                  onClick={() => setActiveTab('specs')}
                  className={`pb-2 text-xs font-bold transition cursor-pointer ${
                    activeTab === 'specs'
                      ? 'text-[#38bdf8] border-b-2 border-[#38bdf8]'
                      : 'text-[#64748b] hover:text-white'
                  }`}
                >
                  Technical Specifications
                </button>
                <button
                  onClick={() => setActiveTab('reviews')}
                  className={`pb-2 text-xs font-bold transition cursor-pointer ${
                    activeTab === 'reviews'
                      ? 'text-[#38bdf8] border-b-2 border-[#38bdf8]'
                      : 'text-[#64748b] hover:text-white'
                  }`}
                >
                  Verified Reviews ({product.reviews.length})
                </button>
              </div>

              {/* Specs Table */}
              {activeTab === 'specs' && (
                <div className="space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                    <div className="p-2.5 rounded-xl bg-[#050811] border border-[#1e293b]">
                      <span className="text-[#64748b] block text-[10px]">MOVEMENT</span>
                      <span className="text-white font-bold">{product.specs.movement}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#050811] border border-[#1e293b]">
                      <span className="text-[#64748b] block text-[10px]">CASE SIZE</span>
                      <span className="text-white font-bold">{product.specs.case_size}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#050811] border border-[#1e293b]">
                      <span className="text-[#64748b] block text-[10px]">CASE MATERIAL</span>
                      <span className="text-white font-bold">{product.specs.case_material}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#050811] border border-[#1e293b]">
                      <span className="text-[#64748b] block text-[10px]">WATER RESISTANCE</span>
                      <span className="text-white font-bold">{product.specs.water_resistance}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#050811] border border-[#1e293b]">
                      <span className="text-[#64748b] block text-[10px]">STRAP</span>
                      <span className="text-white font-bold">{product.specs.strap_material}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#050811] border border-[#1e293b]">
                      <span className="text-[#64748b] block text-[10px]">BATTERY / DISPLAY</span>
                      <span className="text-white font-bold">{product.specs.battery_life || product.specs.display_type}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Reviews List */}
              {activeTab === 'reviews' && (
                <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                  {product.reviews.map((rev) => (
                    <div key={rev.id} className="p-3 rounded-xl bg-[#050811] border border-[#1e293b] space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white">{rev.reviewer_name}</span>
                          {rev.verified_purchase && (
                            <span className="text-[10px] text-[#10b981] font-mono">✓ Verified Buyer</span>
                          )}
                        </div>
                        <span className="text-[10px] text-[#64748b] font-mono">{rev.date}</span>
                      </div>
                      <div className="text-[#f59e0b] text-xs">{'★'.repeat(rev.rating)}</div>
                      <div className="text-xs font-semibold text-white">{rev.title}</div>
                      <p className="text-xs text-[#94a3b8] leading-relaxed">{rev.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons: Add to Cart & Buy Now */}
            <div className="pt-3 border-t border-[#1e293b] flex gap-3">
              <button
                onClick={() => {
                  onAddToCart(product, quantity, selectedColor)
                  onClose()
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-[#1e293b] hover:bg-[#334155] text-white font-bold text-xs transition cursor-pointer border border-[#334155]"
              >
                Add to Cart
              </button>

              <button
                onClick={() => {
                  onInstantBuy(product, quantity, selectedColor)
                  onClose()
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#2563eb] to-[#0284c7] hover:from-[#3b82f6] hover:to-[#0ea5e9] text-white font-bold text-xs transition cursor-pointer shadow-lg shadow-blue-500/25 flex items-center justify-center gap-1.5"
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
