'use client'

import React, { useState } from 'react'
import type { ChronovaProduct } from './types'
import { getAssetUrl } from './utils'

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

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl bg-white border border-slate-200 hover:border-slate-400 hover:shadow-xl transition-all duration-300 overflow-hidden text-left shadow-xs">
      {/* Top Media Area */}
      <div className="relative w-full aspect-square bg-slate-50 border-b border-slate-100 p-5 flex items-center justify-center overflow-hidden">
        {/* Badge (Top-Left) */}
        {product.badge && (
          <span className="absolute top-3.5 left-3.5 z-10 px-3 py-1 rounded-md bg-slate-900 text-white text-xs font-black uppercase tracking-wider font-mono shadow-xs">
            {product.badge}
          </span>
        )}

        {/* Wishlist Heart Button (Top-Right) */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleWishlist(product)
          }}
          className={`absolute top-3.5 right-3.5 z-10 w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-base shadow-xs transition hover:scale-110 cursor-pointer ${
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
              <span className="text-4xl block mb-1">⌚</span>
              <span className="text-xs font-mono font-bold uppercase text-slate-500">Image Unavailable</span>
            </div>
          ) : (
            <img
              src={getAssetUrl(imgSrc)}
              alt={product.name}
              loading="lazy"
              onError={() => setHasError(true)}
              className="max-h-full max-w-full object-contain filter drop-shadow-sm group-hover:scale-105 transition-transform duration-300"
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
            className="absolute bottom-3 left-3 right-3 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs font-black uppercase tracking-wider shadow-md opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-slate-900 hover:text-white cursor-pointer hidden sm:block text-center"
          >
            QUICK VIEW 👁️
          </button>
        )}
      </div>

      {/* Product Information Area */}
      <div className="p-5 flex flex-col flex-1 justify-between gap-3.5 bg-white">
        <div onClick={() => onSelectProduct(product)} className="cursor-pointer space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black font-mono text-blue-700 uppercase tracking-wider">
              {product.brand}
            </span>
            <span className="text-xs font-bold text-slate-500">
              {product.gender}
            </span>
          </div>

          <h3 className="text-base font-black text-slate-900 line-clamp-2 leading-snug group-hover:text-blue-700 transition">
            {product.name}
          </h3>

          <div className="flex items-center gap-2 pt-0.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 text-xs font-black font-mono">
              ★ {product.rating}
            </span>
            <span className="text-xs text-slate-500 font-semibold">
              ({product.review_count} reviews)
            </span>
          </div>
        </div>

        {/* Pricing & Add to Cart */}
        <div className="space-y-3 pt-3 border-t border-slate-100">
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-lg sm:text-xl font-black text-slate-900">
                ₹{product.price_rupees.toLocaleString('en-IN')}
              </span>
              {product.discount_percent > 0 && (
                <span className="text-xs sm:text-sm text-slate-400 line-through font-semibold">
                  ₹{product.original_price_rupees.toLocaleString('en-IN')}
                </span>
              )}
            </div>
            {product.discount_percent > 0 && (
              <span className="text-xs font-black text-rose-600 font-mono bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                {product.discount_percent}% OFF
              </span>
            )}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation()
              onAddToCart(product)
            }}
            className="w-full py-3.5 px-4 rounded-xl bg-slate-900 hover:bg-blue-600 text-white text-xs sm:text-sm font-black uppercase tracking-wider transition shadow-sm cursor-pointer flex items-center justify-center gap-2 active:scale-98"
            style={{ color: "#ffffff", backgroundColor: "#0f172a" }}
          >
            <span className="text-base">+</span> ADD TO BAG
          </button>
        </div>
      </div>
    </div>
  )
}
