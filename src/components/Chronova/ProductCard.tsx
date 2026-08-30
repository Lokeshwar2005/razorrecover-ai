'use client'

import React, { useState } from 'react'
import type { ChronovaProduct } from './types'

interface ProductCardProps {
  product: ChronovaProduct
  onSelectProduct: (product: ChronovaProduct) => void
  onAddToCart: (product: ChronovaProduct) => void
  onToggleWishlist: (product: ChronovaProduct) => void
  onQuickView?: (product: ChronovaProduct) => void
  isWishlisted: boolean
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onSelectProduct,
  onAddToCart,
  onToggleWishlist,
  onQuickView,
  isWishlisted,
}) => {
  const [imgSrc, setImgSrc] = useState<string>(product.images.primary)
  const [hasError, setHasError] = useState<boolean>(false)
  const [isHovered, setIsHovered] = useState<boolean>(false)

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative flex flex-col justify-between rounded-2xl bg-white border border-slate-200 hover:border-slate-400 hover:shadow-lg transition-all duration-300 overflow-hidden text-left"
    >
      {/* Top Media Area */}
      <div className="relative w-full aspect-square bg-slate-50 border-b border-slate-100 p-4 flex items-center justify-center overflow-hidden">
        {/* Badge (Top-Left) */}
        {product.badge && (
          <span className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-md bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider font-mono shadow-xs">
            {product.badge}
          </span>
        )}

        {/* Wishlist Heart Button (Top-Right) */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleWishlist(product)
          }}
          className={`absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/90 backdrop-blur-xs border border-slate-200 flex items-center justify-center text-sm shadow-xs transition hover:scale-110 cursor-pointer ${
            isWishlisted ? 'text-rose-600 bg-rose-50 border-rose-200' : 'text-slate-500 hover:text-rose-600'
          }`}
          title={isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
        >
          {isWishlisted ? '❤️' : '🤍'}
        </button>

        {/* Product Image */}
        <div
          onClick={() => onSelectProduct(product)}
          className="w-full h-full flex items-center justify-center cursor-pointer"
        >
          {hasError ? (
            <div className="text-center p-4 text-slate-400">
              <span className="text-3xl block mb-1">⌚</span>
              <span className="text-[10px] font-mono font-bold uppercase">Image Unavailable</span>
            </div>
          ) : (
            <img
              src={imgSrc}
              alt={product.name}
              loading="lazy"
              onError={() => {
                setHasError(true)
              }}
              className="max-h-full max-w-full object-contain filter drop-shadow-xs group-hover:scale-105 transition-transform duration-300"
            />
          )}
        </div>

        {/* Quick View Floating Button on Desktop Hover */}
        {onQuickView && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onQuickView(product)
            }}
            className="absolute bottom-2 left-2 right-2 py-2 rounded-xl bg-white/95 backdrop-blur-md border border-slate-300 text-slate-900 text-[11px] font-extrabold uppercase tracking-wider shadow-md opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-slate-900 hover:text-white cursor-pointer hidden sm:block"
          >
            QUICK VIEW 👁️
          </button>
        )}
      </div>

      {/* Product Information Area */}
      <div className="p-3.5 sm:p-4 flex flex-col flex-1 justify-between gap-3">
        <div onClick={() => onSelectProduct(product)} className="cursor-pointer space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold font-mono text-blue-700 uppercase tracking-wide">
              {product.brand}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              {product.gender}
            </span>
          </div>

          <h3 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-1 group-hover:text-blue-700 transition">
            {product.name}
          </h3>

          <div className="flex items-center gap-1.5 pt-0.5">
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold font-mono">
              ★ {product.rating}
            </span>
            <span className="text-[10px] text-slate-500">
              ({product.review_count})
            </span>
          </div>
        </div>

        {/* Pricing & Add to Cart */}
        <div className="space-y-2.5 pt-1 border-t border-slate-100">
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm sm:text-base font-black text-slate-900">
                ₹{product.price_rupees.toLocaleString('en-IN')}
              </span>
              {product.discount_percent > 0 && (
                <span className="text-[11px] text-slate-400 line-through font-semibold">
                  ₹{product.original_price_rupees.toLocaleString('en-IN')}
                </span>
              )}
            </div>
            {product.discount_percent > 0 && (
              <span className="text-[10px] font-black text-rose-600 font-mono">
                {product.discount_percent}% OFF
              </span>
            )}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation()
              onAddToCart(product)
            }}
            className="w-full py-2 rounded-xl bg-slate-900 hover:bg-blue-600 text-white text-[11px] font-extrabold uppercase tracking-wider transition shadow-xs cursor-pointer flex items-center justify-center gap-1"
          >
            <span>+</span> ADD TO BAG
          </button>
        </div>
      </div>
    </div>
  )
}
