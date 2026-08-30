'use client'

import React, { useState } from 'react'
import type { ChronovaProduct } from './types'

interface QuickViewModalProps {
  product: ChronovaProduct | null
  onClose: () => void
  onAddToCart: (product: ChronovaProduct, qty: number, color?: string) => void
  onOpenFullDetail: (product: ChronovaProduct) => void
  onToggleWishlist: (product: ChronovaProduct) => void
  isWishlisted: boolean
}

export const QuickViewModal: React.FC<QuickViewModalProps> = ({
  product,
  onClose,
  onAddToCart,
  onOpenFullDetail,
  onToggleWishlist,
  isWishlisted,
}) => {
  if (!product) return null

  const [selectedColor, setSelectedColor] = useState<string>(
    product.color_variants?.[0]?.name || ''
  )
  const [quantity, setQuantity] = useState<number>(1)
  const [activeImage, setActiveImage] = useState<string>(product.images.primary)

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
      />

      {/* Modal Card */}
      <div className="relative bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 z-10 overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm transition cursor-pointer"
          title="Close Quick View"
        >
          ✕
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 items-center">
          {/* Left: Product Image */}
          <div className="space-y-3">
            <div className="relative aspect-square rounded-2xl bg-slate-50 border border-slate-200 p-6 flex items-center justify-center overflow-hidden">
              {product.badge && (
                <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider font-mono">
                  {product.badge}
                </span>
              )}
              <img
                src={activeImage}
                alt={product.name}
                className="max-h-full max-w-full object-contain filter drop-shadow-md transition-transform duration-300 hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none'
                }}
              />
            </div>

            {/* Thumbnail selector if multiple */}
            {product.images.gallery.length > 1 && (
              <div className="flex items-center gap-2 justify-center">
                {product.images.gallery.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImage(img)}
                    className={`w-12 h-12 rounded-xl bg-slate-50 border-2 p-1 overflow-hidden transition cursor-pointer ${
                      activeImage === img ? 'border-slate-900 shadow-xs' : 'border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    <img src={img} alt={`View ${idx + 1}`} className="w-full h-full object-contain" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Product Info */}
          <div className="space-y-4 text-left">
            <div>
              <span className="text-xs font-black font-mono text-blue-700 uppercase tracking-wider">
                {product.brand} · {product.category}
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-1 leading-tight">
                {product.name}
              </h3>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold font-mono">
                  ★ {product.rating}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  ({product.review_count} verified reviews)
                </span>
              </div>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-2.5 pt-1">
              <span className="text-2xl font-black text-slate-900">
                ₹{product.price_rupees.toLocaleString('en-IN')}
              </span>
              {product.discount_percent > 0 && (
                <>
                  <span className="text-sm text-slate-400 line-through font-semibold">
                    ₹{product.original_price_rupees.toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs font-black text-rose-600 font-mono">
                    ({product.discount_percent}% OFF)
                  </span>
                </>
              )}
            </div>

            {/* Short Description */}
            <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
              {product.description}
            </p>

            {/* Color Variant Selector */}
            {product.color_variants && product.color_variants.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-xs font-bold text-slate-700">
                  Color: <span className="font-normal text-slate-500">{selectedColor}</span>
                </span>
                <div className="flex items-center gap-2">
                  {product.color_variants.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => {
                        setSelectedColor(c.name)
                        if (c.image_url) setActiveImage(c.image_url)
                      }}
                      className={`w-6 h-6 rounded-full border-2 transition cursor-pointer ${
                        selectedColor === c.name ? 'border-slate-900 scale-110 shadow-xs' : 'border-slate-200 hover:border-slate-400'
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Quantity Stepper & Actions */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center border border-slate-300 rounded-xl bg-slate-50 overflow-hidden">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                  >
                    −
                  </button>
                  <span className="px-3 py-1.5 text-xs font-black text-slate-900 font-mono">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(5, q + 1))}
                    className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={() => {
                    onAddToCart(product, quantity, selectedColor)
                    onClose()
                  }}
                  className="flex-1 py-3 rounded-xl bg-slate-900 hover:bg-blue-600 text-white text-xs font-black uppercase tracking-wider transition shadow-sm cursor-pointer"
                >
                  ADD TO BAG
                </button>

                <button
                  onClick={() => onToggleWishlist(product)}
                  className={`w-11 h-11 rounded-xl border flex items-center justify-center text-base transition cursor-pointer ${
                    isWishlisted ? 'border-rose-300 bg-rose-50 text-rose-600' : 'border-slate-200 hover:border-slate-400 text-slate-600'
                  }`}
                  title="Wishlist"
                >
                  {isWishlisted ? '❤️' : '🤍'}
                </button>
              </div>

              <button
                onClick={() => {
                  onClose()
                  onOpenFullDetail(product)
                }}
                className="w-full py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-900 text-xs font-bold uppercase tracking-wider transition cursor-pointer text-center"
              >
                VIEW FULL SPECIFICATIONS & REVIEWS →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
