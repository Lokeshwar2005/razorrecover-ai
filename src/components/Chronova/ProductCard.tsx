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
  const formatINR = (amt: number) => `₹${amt.toLocaleString('en-IN')}`

  const primaryImage = product.images[0] || 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800&auto=format&fit=crop&q=80'
  const secondaryImage = product.images[1] || primaryImage

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative bg-[#0b101d] border border-[#1e293b] hover:border-[#38bdf8]/50 rounded-2xl overflow-hidden flex flex-col justify-between transition-all duration-300 shadow-md hover:shadow-xl hover:shadow-sky-500/10"
    >
      {/* Badges & Wishlist Trigger */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
        <div className="flex flex-col gap-1">
          {product.badge && (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono tracking-wider bg-[#38bdf8] text-[#050811] shadow">
              {product.badge.toUpperCase()}
            </span>
          )}
          {product.discount_percent > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-[#ef4444] text-white shadow">
              {product.discount_percent}% OFF
            </span>
          )}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleWishlist(product)
          }}
          className="w-8 h-8 rounded-full bg-[#050811]/80 backdrop-blur-md border border-[#1e293b] text-white flex items-center justify-center transition-transform hover:scale-110 pointer-events-auto cursor-pointer"
          title={isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
        >
          <span className={isWishlisted ? 'text-[#ef4444]' : 'text-[#94a3b8]'}>
            {isWishlisted ? '❤️' : '🤍'}
          </span>
        </button>
      </div>

      {/* Product Photographic Thumbnail (Zero 3D) */}
      <div
        onClick={() => onSelectProduct(product)}
        className="relative w-full aspect-square bg-[#050811] p-4 flex items-center justify-center overflow-hidden cursor-pointer"
      >
        <img
          src={hovered ? secondaryImage : primaryImage}
          alt={product.name}
          loading="lazy"
          className="max-h-full max-w-full object-contain transition-transform duration-500 ease-out group-hover:scale-105"
        />

        {/* Quick View Button on Hover */}
        <div className="absolute inset-x-4 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onSelectProduct(product)
            }}
            className="w-full py-2 bg-[#0b132b]/95 backdrop-blur-md hover:bg-[#1e293b] text-[#38bdf8] border border-[#38bdf8]/40 rounded-xl text-xs font-bold transition shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>👁️ Quick View</span>
          </button>
        </div>
      </div>

      {/* Product Details */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3 bg-[#0b101d]">
        <div onClick={() => onSelectProduct(product)} className="cursor-pointer space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-[#38bdf8] font-bold tracking-wider uppercase">{product.brand}</span>
            <span className="text-[#64748b]">{product.category}</span>
          </div>

          <h3 className="text-xs sm:text-sm font-bold text-white line-clamp-1 group-hover:text-[#38bdf8] transition-colors">
            {product.name}
          </h3>

          {/* Rating */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="px-1.5 py-0.5 rounded bg-[#f59e0b]/20 text-[#f59e0b] font-bold text-[10px] flex items-center gap-0.5">
              <span>★</span>
              <span>{product.rating.toFixed(1)}</span>
            </span>
            <span className="text-[11px] text-[#64748b]">({product.review_count})</span>
            <span className="text-[#334155] text-[10px]">·</span>
            <span className="text-[10px] text-[#94a3b8]">{product.gender}</span>
          </div>
        </div>

        {/* Price & Add to Cart */}
        <div className="pt-2 border-t border-[#1e293b]/70 flex items-center justify-between gap-2">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm sm:text-base font-extrabold text-white">
                {formatINR(product.price_rupees)}
              </span>
              {product.original_price_rupees > product.price_rupees && (
                <span className="text-[11px] text-[#64748b] line-through font-mono">
                  {formatINR(product.original_price_rupees)}
                </span>
              )}
            </div>
            <div className="text-[10px] text-[#10b981] font-medium font-mono">
              Free Express Shipping
            </div>
          </div>

          <button
            onClick={() => onAddToCart(product)}
            className="px-3 py-2 rounded-xl bg-[#2563eb] hover:bg-[#3b82f6] text-white text-xs font-bold transition shadow-md shadow-blue-500/20 flex items-center gap-1 cursor-pointer shrink-0"
            title="Add to Cart"
          >
            <span>+</span>
            <span className="hidden sm:inline">Add</span>
          </button>
        </div>
      </div>
    </div>
  )
}
