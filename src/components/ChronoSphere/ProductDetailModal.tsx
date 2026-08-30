'use client'

import React, { useState } from 'react'
import type { WatchProduct } from './types'
import { Watch3DViewer } from './Watch3DViewer'

interface ProductDetailModalProps {
  product: WatchProduct | null
  onClose: () => void
  onAddToCart: (product: WatchProduct, quantity?: number, selectedColor?: string) => void
  onInstantBuy: (product: WatchProduct, quantity?: number, selectedColor?: string) => void
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  onAddToCart,
  onInstantBuy,
}) => {
  if (!product) return null

  const [activeMediaTab, setActiveMediaTab] = useState<'gallery' | '3d'>('3d')
  const [selectedImageIdx, setSelectedImageIdx] = useState(0)
  const [selectedColor, setSelectedColor] = useState(product.color_variants?.[0]?.name || 'Midnight Obsidian')
  const [quantity, setQuantity] = useState(1)
  const [activeTab, setActiveTab] = useState<'specs' | 'reviews' | 'shipping'>('specs')

  const formatINR = (amt: number) => `₹${amt.toLocaleString('en-IN')}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-[#090e1a] border border-[#1e293b] rounded-3xl overflow-hidden shadow-2xl my-auto text-[#e2e8f0]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-30 w-9 h-9 rounded-full bg-[#1e293b]/80 hover:bg-[#334155] text-white flex items-center justify-center transition cursor-pointer font-mono"
        >
          ✕
        </button>

        {/* Modal Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[600px]">
          {/* Left Column: Visual Media Gallery / 3D Canvas */}
          <div className="lg:col-span-6 bg-[#040711] p-6 border-b lg:border-b-0 lg:border-r border-[#1e293b] flex flex-col justify-between">
            {/* View Mode Switcher */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-[#2563eb]/20 text-[#38bdf8] font-mono text-[11px] font-bold border border-[#38bdf8]/40">
                  {product.brand}
                </span>
                <span className="text-xs text-[#64748b] font-mono">{product.model}</span>
              </div>

              <div className="flex bg-[#0f172a] p-1 rounded-xl border border-[#1e293b] text-xs">
                <button
                  onClick={() => setActiveMediaTab('3d')}
                  className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    activeMediaTab === '3d'
                      ? 'bg-[#2563eb] text-white shadow'
                      : 'text-[#94a3b8] hover:text-white'
                  }`}
                >
                  <span>🌐</span> 3D Studio
                </button>
                <button
                  onClick={() => setActiveMediaTab('gallery')}
                  className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    activeMediaTab === 'gallery'
                      ? 'bg-[#2563eb] text-white shadow'
                      : 'text-[#94a3b8] hover:text-white'
                  }`}
                >
                  <span>📷</span> Photos
                </button>
              </div>
            </div>

            {/* Media Content Stage */}
            <div className="flex-1 flex items-center justify-center my-2">
              {activeMediaTab === '3d' ? (
                <Watch3DViewer
                  modelName={product.name}
                  brand={product.brand}
                  initialDialColor={product.color_variants?.[0]?.hex || '#1e3a8a'}
                />
              ) : (
                <div className="w-full flex flex-col items-center">
                  <div className="w-full h-80 rounded-2xl bg-gradient-to-b from-[#0f172a] to-[#040711] p-4 flex items-center justify-center border border-[#1e293b]">
                    <img
                      src={product.images[selectedImageIdx] || product.images[0]}
                      alt={product.name}
                      className="max-h-full max-w-full object-contain drop-shadow-[0_20px_35px_rgba(0,0,0,0.8)]"
                    />
                  </div>
                  {/* Thumbnails */}
                  <div className="flex gap-2 mt-4">
                    {product.images.map((img, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedImageIdx(i)}
                        className={`w-14 h-14 rounded-xl border-2 overflow-hidden bg-[#090e1a] p-1 transition cursor-pointer ${
                          selectedImageIdx === i ? 'border-[#38bdf8] scale-105' : 'border-[#1e293b] opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img src={img} alt="" className="w-full h-full object-contain" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-[#1e293b] text-center text-[10px] text-[#94a3b8]">
              <div className="p-2 rounded-xl bg-[#0b132b] border border-[#1e293b]">
                <div className="text-white font-bold mb-0.5">🛡️ 100% Authentic</div>
                <div>Direct Brand Warranty</div>
              </div>
              <div className="p-2 rounded-xl bg-[#0b132b] border border-[#1e293b]">
                <div className="text-white font-bold mb-0.5">⚡ Express Delivery</div>
                <div>2-Day Free Insured Shipping</div>
              </div>
              <div className="p-2 rounded-xl bg-[#0b132b] border border-[#1e293b]">
                <div className="text-white font-bold mb-0.5">🔄 7-Day Returns</div>
                <div>Hassle-free guarantee</div>
              </div>
            </div>
          </div>

          {/* Right Column: Product Info, Options, Tabs, Buy Actions */}
          <div className="lg:col-span-6 p-6 sm:p-8 flex flex-col justify-between overflow-y-auto max-h-[85vh]">
            <div className="space-y-5">
              {/* Brand & Title */}
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-[#38bdf8] tracking-widest uppercase">
                    {product.series} COLLECTION
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-[#10b981]/20 text-[#34d399] font-mono text-[10px] font-bold">
                    {product.stock_status}
                  </span>
                </div>
                <h1 className="text-2xl font-extrabold text-white mt-1 leading-tight">
                  {product.name}
                </h1>
                <div className="flex items-center gap-3 mt-2 text-xs">
                  <div className="flex text-[#f59e0b]">
                    {'★'.repeat(Math.floor(product.rating))}
                    {product.rating % 1 !== 0 && '½'}
                  </div>
                  <span className="font-bold text-white">{product.rating} / 5.0</span>
                  <span className="text-[#64748b]">·</span>
                  <span className="text-[#94a3b8]">{product.review_count} Verified Customer Reviews</span>
                </div>
              </div>

              {/* Price Block */}
              <div className="p-4 rounded-2xl bg-[#0b132b] border border-[#1e293b] flex items-center justify-between">
                <div>
                  <div className="text-2xl font-black text-white">
                    {formatINR(product.price_rupees)}
                  </div>
                  {product.original_price_rupees > product.price_rupees && (
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-[#64748b] line-through">
                        {formatINR(product.original_price_rupees)}
                      </span>
                      <span className="text-xs text-[#34d399] font-bold">
                        Save {formatINR(product.original_price_rupees - product.price_rupees)} ({product.discount_percent}% Off)
                      </span>
                    </div>
                  )}
                </div>
                <div className="text-right text-[10px] text-[#94a3b8]">
                  <div>Includes All Taxes & GST</div>
                  <div className="text-[#38bdf8] font-mono">Free Insured Transit</div>
                </div>
              </div>

              {/* Color Finish Selector */}
              {product.color_variants && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[#cbd5e1] block">
                    Finish / Colorway: <span className="text-[#38bdf8]">{selectedColor}</span>
                  </label>
                  <div className="flex gap-2">
                    {product.color_variants.map((v) => (
                      <button
                        key={v.name}
                        onClick={() => setSelectedColor(v.name)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition cursor-pointer flex items-center gap-2 ${
                          selectedColor === v.name
                            ? 'bg-[#1e293b] border-[#38bdf8] text-white shadow-md'
                            : 'bg-[#0f172a] border-[#1e293b] text-[#94a3b8] hover:border-[#334155]'
                        }`}
                      >
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: v.hex }} />
                        <span>{v.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Information Tabs */}
              <div className="space-y-3 pt-2">
                <div className="flex border-b border-[#1e293b] text-xs font-semibold">
                  <button
                    onClick={() => setActiveTab('specs')}
                    className={`pb-2 px-3 transition cursor-pointer ${
                      activeTab === 'specs'
                        ? 'text-[#38bdf8] border-b-2 border-[#38bdf8]'
                        : 'text-[#94a3b8] hover:text-white'
                    }`}
                  >
                    Specifications
                  </button>
                  <button
                    onClick={() => setActiveTab('reviews')}
                    className={`pb-2 px-3 transition cursor-pointer ${
                      activeTab === 'reviews'
                        ? 'text-[#38bdf8] border-b-2 border-[#38bdf8]'
                        : 'text-[#94a3b8] hover:text-white'
                    }`}
                  >
                    Reviews ({product.reviews.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('shipping')}
                    className={`pb-2 px-3 transition cursor-pointer ${
                      activeTab === 'shipping'
                        ? 'text-[#38bdf8] border-b-2 border-[#38bdf8]'
                        : 'text-[#94a3b8] hover:text-white'
                    }`}
                  >
                    Warranty & Delivery
                  </button>
                </div>

                {/* TAB 1: SPECS */}
                {activeTab === 'specs' && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-[#0b132b] border border-[#1e293b]/60">
                      <span className="text-[#64748b] block text-[10px]">Movement</span>
                      <span className="font-semibold text-white">{product.specs.movement}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#0b132b] border border-[#1e293b]/60">
                      <span className="text-[#64748b] block text-[10px]">Case Dimensions</span>
                      <span className="font-semibold text-white">{product.specs.case_size} · {product.specs.case_material}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#0b132b] border border-[#1e293b]/60">
                      <span className="text-[#64748b] block text-[10px]">Dial & Crystal</span>
                      <span className="font-semibold text-white">{product.specs.dial_color} · {product.specs.display_type || 'Sapphire Glass'}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#0b132b] border border-[#1e293b]/60">
                      <span className="text-[#64748b] block text-[10px]">Water Resistance</span>
                      <span className="font-semibold text-white">{product.specs.water_resistance}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#0b132b] border border-[#1e293b]/60">
                      <span className="text-[#64748b] block text-[10px]">Strap / Bracelet</span>
                      <span className="font-semibold text-white">{product.specs.strap_material} ({product.specs.strap_color})</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#0b132b] border border-[#1e293b]/60">
                      <span className="text-[#64748b] block text-[10px]">Origin</span>
                      <span className="font-semibold text-white">{product.specs.origin || 'International'}</span>
                    </div>
                  </div>
                )}

                {/* TAB 2: REVIEWS */}
                {activeTab === 'reviews' && (
                  <div className="space-y-3 max-h-48 overflow-y-auto pr-1 text-xs">
                    {product.reviews.map((rev) => (
                      <div key={rev.id} className="p-3 rounded-xl bg-[#0b132b] border border-[#1e293b] space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white flex items-center gap-1.5">
                            <span>{rev.reviewer_name}</span>
                            {rev.verified_purchase && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#10b981]/20 text-[#34d399] font-mono">
                                ✓ Verified Buyer
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] text-[#64748b]">{rev.date}</span>
                        </div>
                        <div className="text-[#f59e0b] text-[11px]">{'★'.repeat(rev.rating)}</div>
                        <div className="font-semibold text-[#cbd5e1]">{rev.title}</div>
                        <p className="text-[11px] text-[#94a3b8] leading-relaxed">{rev.comment}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* TAB 3: SHIPPING */}
                {activeTab === 'shipping' && (
                  <div className="p-4 rounded-xl bg-[#0b132b] border border-[#1e293b] text-xs space-y-2 text-[#cbd5e1]">
                    <div>
                      <strong className="text-white">Official Warranty:</strong> {product.specs.warranty}
                    </div>
                    <div>
                      <strong className="text-white">Packaging:</strong> Luxury wooden gift presentation box with serialized certificate of authenticity.
                    </div>
                    <div>
                      <strong className="text-white">Razorpay Protected:</strong> 100% payment encryption and instant verification support.
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions: Quantity + Add to Cart + Buy Now */}
            <div className="pt-6 mt-6 border-t border-[#1e293b] flex items-center gap-3">
              {/* Quantity Controls */}
              <div className="flex items-center bg-[#0f172a] border border-[#1e293b] rounded-xl p-1">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-8 h-8 rounded-lg text-white hover:bg-[#1e293b] flex items-center justify-center font-bold cursor-pointer"
                >
                  -
                </button>
                <span className="w-8 text-center font-mono font-bold text-sm text-white">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                  className="w-8 h-8 rounded-lg text-white hover:bg-[#1e293b] flex items-center justify-center font-bold cursor-pointer"
                >
                  +
                </button>
              </div>

              {/* Add to Cart */}
              <button
                onClick={() => {
                  onAddToCart(product, quantity, selectedColor)
                  onClose()
                }}
                className="flex-1 py-3.5 px-4 rounded-xl bg-[#1e293b] hover:bg-[#334155] text-white font-bold text-xs transition cursor-pointer border border-[#334155] flex items-center justify-center gap-2"
              >
                <span>🛒 Add to Cart</span>
              </button>

              {/* Instant Buy Now */}
              <button
                onClick={() => {
                  onInstantBuy(product, quantity, selectedColor)
                  onClose()
                }}
                className="flex-1 py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#2563eb] to-[#0284c7] hover:from-[#3b82f6] hover:to-[#0ea5e9] text-white font-bold text-xs transition cursor-pointer shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
              >
                <span>⚡ Buy Now with Razorpay</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
