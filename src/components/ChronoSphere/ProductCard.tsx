'use client'

import React, { useState } from 'react'
import type { WatchProduct } from './types'

interface ProductCardProps {
  product: WatchProduct
  onSelectProduct: (product: WatchProduct) => void
  onAddToCart: (product: WatchProduct) => void
  onToggleWishlist?: (product: WatchProduct) => void
  isWishlisted?: boolean
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onSelectProduct,
  onAddToCart,
  onToggleWishlist,
  isWishlisted = false,
}) => {
  const [isHovered, setIsHovered] = useState(false)
  const [addedAnimation, setAddedAnimation] = useState(false)

  const formatINR = (amt: number) => `₹${amt.toLocaleString('en-IN')}`

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation()
    onAddToCart(product)
    setAddedAnimation(true)
    setTimeout(() => setAddedAnimation(false), 1200)
  }

  const handleWishlist = (e: React.MouseEvent) => {
    e.stopPropagation()
    onToggleWishlist?.(product)
  }

  const primaryImage = product.images[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80'
  const hoverImage = product.images[1] || primaryImage

  return (
    <div
      onClick={() => onSelectProduct(product)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative bg-[#090e1a] hover:bg-[#0d1629] border border-[#1e293b] hover:border-[#38bdf8]/60 rounded-2xl p-4 transition-all duration-300 flex flex-col justify-between cursor-pointer shadow-lg hover:shadow-2xl hover:shadow-blue-500/10"
    >
      {/* Top Floating Badges */}
      <div className="flex items-center justify-between z-10 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {product.badge && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase font-mono ${
                product.badge === 'Bestseller'
                  ? 'bg-[#e5a944]/20 text-[#e5a944] border border-[#e5a944]/40'
                  : product.badge === 'Limited Edition'
                  ? 'bg-[#a855f7]/20 text-[#c084fc] border border-[#a855f7]/40'
                  : 'bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/40'
              }`}
            >
              {product.badge}
            </span>
          )}
          {product.discount_percent > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-[#10b981]/20 text-[#34d399] border border-[#10b981]/40 text-[10px] font-bold font-mono">
              {product.discount_percent}% OFF
            </span>
          )}
        </div>

        <button
          onClick={handleWishlist}
          title={isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
            isWishlisted
              ? 'bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]'
              : 'bg-[#1e293b]/60 text-[#64748b] hover:text-white hover:bg-[#1e293b]'
          }`}
        >
          {isWishlisted ? '♥' : '♡'}
        </button>
      </div>

      {/* Product Image Stage */}
      <div className="w-full h-48 sm:h-52 rounded-xl bg-gradient-to-b from-[#0f172a] to-[#060b19] flex items-center justify-center overflow-hidden relative mb-4 p-3 border border-[#1e293b]/50">
        <img
          src={isHovered ? hoverImage : primaryImage}
          alt={product.name}
          className="max-h-full max-w-full object-contain transition-transform duration-500 group-hover:scale-110 drop-shadow-[0_12px_24px_rgba(0,0,0,0.6)]"
          loading="lazy"
        />

        {/* Quick View Button on Hover */}
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-2">
          <span className="px-3 py-1.5 rounded-xl bg-white/90 text-[#090e1a] font-bold text-xs shadow-xl flex items-center gap-1.5">
            <span>👁️</span> Quick View & 3D
          </span>
        </div>
      </div>

      {/* Product Info */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono text-[#38bdf8] font-bold uppercase tracking-wider text-[11px]">
            {product.brand}
          </span>
          <span className="text-[10px] text-[#64748b] font-mono">{product.specs.case_size}</span>
        </div>

        <h3 className="font-bold text-sm text-white line-clamp-1 group-hover:text-[#38bdf8] transition-colors">
          {product.name}
        </h3>

        {/* Feature Specs Tag */}
        <div className="text-[11px] text-[#94a3b8] flex items-center gap-1.5 flex-wrap">
          <span className="px-1.5 py-0.5 rounded bg-[#1e293b] text-[#94a3b8] text-[10px]">
            {product.specs.movement.split(' ')[0]}
          </span>
          <span className="text-[#64748b]">·</span>
          <span className="text-[11px] text-[#94a3b8]">{product.category.replace(" Watches", "")}</span>
        </div>

        {/* Rating & Reviews */}
        <div className="flex items-center gap-1.5 text-xs">
          <div className="flex text-[#f59e0b] text-xs">
            {'★'.repeat(Math.floor(product.rating))}
            {product.rating % 1 !== 0 && '½'}
          </div>
          <span className="font-bold text-white text-xs">{product.rating}</span>
          <span className="text-[10px] text-[#64748b]">({product.review_count})</span>
        </div>

        {/* Price & Cart Action */}
        <div className="pt-2 border-t border-[#1e293b] flex items-center justify-between">
          <div>
            <div className="text-base font-extrabold text-white">
              {formatINR(product.price_rupees)}
            </div>
            {product.original_price_rupees > product.price_rupees && (
              <div className="text-[10px] text-[#64748b] line-through">
                {formatINR(product.original_price_rupees)}
              </div>
            )}
          </div>

          <button
            onClick={handleAddToCart}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all duration-200 cursor-pointer flex items-center gap-1.5 shadow-md ${
              addedAnimation
                ? 'bg-[#10b981] text-white scale-105'
                : 'bg-[#2563eb] hover:bg-[#3b82f6] text-white shadow-blue-500/20'
            }`}
          >
            {addedAnimation ? (
              <>
                <span>✓</span>
                <span>Added</span>
              </>
            ) : (
              <>
                <span>+</span>
                <span>Add</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
