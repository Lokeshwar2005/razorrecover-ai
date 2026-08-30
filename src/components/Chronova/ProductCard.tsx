'use client'

import React, { useState } from 'react'
import type { ChronovaProduct } from './types'

interface ProductCardProps {
  product: ChronovaProduct
  onSelectProduct: (product: ChronovaProduct) => void
  onAddToCart: (product: ChronovaProduct) => void
  onToggleWishlist: (product: ChronovaProduct) => void
  isWishlisted: boolean
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onSelectProduct,
  onAddToCart,
  onToggleWishlist,
  isWishlisted,
}) => {
  const [hovered, setHovered] = useState(false)
  const [imgError, setImgError] = useState(false)

  const formatINR = (amt: number) => `₹${amt.toLocaleString('en-IN')}`

  const primaryImg = product.images.primary
  const secondaryImg = product.images.gallery[1] || primaryImg

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative bg-white border border-slate-200 hover:border-slate-400 rounded-2xl overflow-hidden flex flex-col justify-between transition-all duration-300 shadow-sm hover:shadow-xl"
    >
      {/* Badges & Wishlist */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
        <div className="flex flex-col gap-1">
          {product.badge && (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider bg-slate-900 text-white shadow-sm">
              {product.badge.toUpperCase()}
            </span>
          )}
          {product.discount_percent > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-600 text-white shadow-sm">
              {product.discount_percent}% OFF
            </span>
          )}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleWishlist(product)
          }}
          className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm border border-slate-200 text-slate-700 flex items-center justify-center transition-transform hover:scale-110 shadow-sm pointer-events-auto cursor-pointer"
          title={isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
        >
          <span className={isWishlisted ? 'text-rose-600' : 'text-slate-400'}>
            {isWishlisted ? '❤️' : '🤍'}
          </span>
        </button>
      </div>

      {/* Product Photographic Thumbnail (1:1 Aspect Ratio, Clean Off-White Background) */}
      <div
        onClick={() => onSelectProduct(product)}
        className="relative w-full aspect-square bg-[#f8fafc] p-6 flex items-center justify-center overflow-hidden cursor-pointer"
      >
        {imgError ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 space-y-1">
            <span className="text-3xl">⌚</span>
            <span className="text-[10px] font-mono">Image preview</span>
          </div>
        ) : (
          <img
            src={hovered ? secondaryImg : primaryImg}
            alt={`${product.brand} ${product.name}`}
            loading="lazy"
            onError={() => setImgError(true)}
            className="max-h-full max-w-full object-contain transition-transform duration-500 ease-out group-hover:scale-105"
          />
        )}

        {/* Quick View Button on Hover */}
        <div className="absolute inset-x-4 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onSelectProduct(product)
            }}
            className="w-full py-2 bg-white/95 backdrop-blur-md hover:bg-slate-900 hover:text-white text-slate-900 border border-slate-300 rounded-xl text-xs font-bold transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>👁️ Quick View</span>
          </button>
        </div>
      </div>

      {/* Product Details */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3 bg-white">
        <div onClick={() => onSelectProduct(product)} className="cursor-pointer space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-blue-700 font-bold tracking-wider uppercase">{product.brand}</span>
            <span className="text-slate-500">{product.category}</span>
          </div>

          <h3 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-1 group-hover:text-blue-600 transition-colors">
            {product.name}
          </h3>

          {/* Rating & Gender */}
          <div className="flex items-center gap-1.5 text-xs pt-0.5">
            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-bold text-[10px] flex items-center gap-0.5">
              <span>★</span>
              <span>{product.rating.toFixed(1)}</span>
            </span>
            <span className="text-[11px] text-slate-500">({product.review_count})</span>
            <span className="text-slate-300 text-[10px]">·</span>
            <span className="text-[11px] text-slate-600 font-medium">{product.gender}</span>
          </div>
        </div>

        {/* Price & Add to Cart */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm sm:text-base font-black text-slate-900">
                {formatINR(product.price_rupees)}
              </span>
              {product.original_price_rupees > product.price_rupees && (
                <span className="text-[11px] text-slate-400 line-through font-mono">
                  {formatINR(product.original_price_rupees)}
                </span>
              )}
            </div>
            <div className="text-[10px] text-emerald-600 font-semibold">
              ✓ Free Express Shipping
            </div>
          </div>

          <button
            onClick={() => onAddToCart(product)}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-blue-600 text-white text-xs font-bold transition shadow-sm flex items-center gap-1 cursor-pointer shrink-0"
            title="Add to Bag"
          >
            <span>+</span>
            <span className="hidden sm:inline">Add</span>
          </button>
        </div>
      </div>
    </div>
  )
}
