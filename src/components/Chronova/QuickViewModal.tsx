'use client'

import React, { useState } from 'react'
import type { ChronovaProduct } from './types'

interface QuickViewModalProps {
  product: ChronovaProduct | null
  onClose: () => void
  onAddToCart: (product: ChronovaProduct, quantity: number, selectedColor?: string) => void
  onOpenFullDetail?: (product: ChronovaProduct) => void
  onSelectProduct?: (product: ChronovaProduct) => void
  onToggleWishlist?: (product: ChronovaProduct) => void
  isWishlisted?: boolean
}

export const QuickViewModal: React.FC<QuickViewModalProps> = ({
  product,
  onClose,
  onAddToCart,
  onOpenFullDetail,
  onSelectProduct,
  onToggleWishlist,
  isWishlisted,
}) => {
  if (!product) return null

  const [activeImageIndex, setActiveImageIndex] = useState<number>(0)
  const [selectedColor, setSelectedColor] = useState<string>(
    product.color_variants?.[0]?.name || 'Standard'
  )
  const [quantity, setQuantity] = useState<number>(1)

  const currentImage = product.images.gallery[activeImageIndex] || product.images.primary

  const handleOpenDetail = () => {
    onClose()
    if (onOpenFullDetail) onOpenFullDetail(product)
    else if (onSelectProduct) onSelectProduct(product)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6">
      <div className="relative bg-white rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl border border-slate-200 text-left">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center justify-center font-bold text-sm transition cursor-pointer"
        >
          ✕
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 sm:p-8">
          {/* Media Area */}
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="relative w-full aspect-square bg-slate-50 border border-slate-200 rounded-2xl p-6 flex items-center justify-center overflow-hidden">
              {product.badge && (
                <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-slate-900 text-white text-[11px] font-black uppercase font-mono shadow-xs">
                  {product.badge}
                </span>
              )}
              <img
                src={currentImage}
                alt={product.name}
                className="max-h-full max-w-full object-contain filter drop-shadow-md"
              />
            </div>

            {/* Gallery Thumbnails */}
            <div className="flex gap-2">
              {product.images.gallery.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImageIndex(idx)}
                  className={`w-14 h-14 rounded-xl border-2 bg-slate-50 p-1 overflow-hidden transition cursor-pointer ${
                    activeImageIndex === idx
                      ? 'border-slate-900 shadow-xs'
                      : 'border-slate-200 hover:border-slate-400'
                  }`}
                >
                  <img src={img} alt="Thumbnail" className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          </div>

          {/* Product Summary */}
          <div className="flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black font-mono text-blue-700 uppercase">
                  {product.brand}
                </span>
                <span className="text-xs font-semibold text-slate-500 font-mono">
                  {product.model}
                </span>
              </div>

              <h2 className="text-xl font-black text-slate-900 leading-tight">
                {product.name}
              </h2>

              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 text-xs font-black font-mono">
                  ★ {product.rating}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  ({product.review_count} reviews)
                </span>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  {product.stock_status}
                </span>
              </div>

              {/* Price */}
              <div className="pt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">
                  ₹{product.price_rupees.toLocaleString('en-IN')}
                </span>
                {product.discount_percent > 0 && (
                  <span className="text-sm text-slate-400 line-through font-semibold">
                    ₹{product.original_price_rupees.toLocaleString('en-IN')}
                  </span>
                )}
                {product.discount_percent > 0 && (
                  <span className="text-xs font-black text-rose-600 font-mono bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                    {product.discount_percent}% OFF
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-600 line-clamp-3 pt-1">
                {product.description}
              </p>

              {/* Key Specs */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 gap-2 text-xs text-slate-700">
                <div>Movement: <strong className="text-slate-900 font-bold block">{product.specs.movement}</strong></div>
                <div>Case Size: <strong className="text-slate-900 font-bold block">{product.specs.case_size}</strong></div>
                <div>Water Resist: <strong className="text-slate-900 font-bold block">{product.specs.water_resistance}</strong></div>
                <div>Warranty: <strong className="text-slate-900 font-bold block">{product.specs.warranty}</strong></div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3">
                {/* Quantity */}
                <div className="flex items-center border border-slate-300 rounded-xl bg-white shadow-xs">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  >
                    −
                  </button>
                  <span className="px-3 py-2 text-xs font-black text-slate-900 font-mono">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(5, q + 1))}
                    className="px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={() => {
                    onAddToCart(product, quantity, selectedColor)
                    onClose()
                  }}
                  className="flex-1 py-3 px-4 rounded-xl bg-slate-900 hover:bg-blue-600 text-white text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-md"
                  style={{ color: "#ffffff", backgroundColor: "#0f172a" }}
                >
                  ADD TO BAG
                </button>
              </div>

              <button
                onClick={handleOpenDetail}
                className="w-full py-2.5 rounded-xl border border-slate-300 text-slate-800 hover:bg-slate-100 text-xs font-bold uppercase tracking-wider transition cursor-pointer text-center"
              >
                View Full Product Specifications & Reviews →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
