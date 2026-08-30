'use client'

import React, { useState } from 'react'
import type { CartItem, AppliedCoupon } from './types'

interface CartDrawerProps {
  isOpen: boolean
  onClose: () => void
  items: CartItem[]
  onUpdateQuantity: (productId: string, quantity: number) => void
  onRemoveItem: (productId: string) => void
  onProceedToCheckout: () => void
  appliedCoupon?: AppliedCoupon | null
  onApplyCoupon?: (coupon: AppliedCoupon | null) => void
}

export const AVAILABLE_COUPONS = [
  { code: 'CHRONOVA10', discountPercent: 10, description: '10% Instant Discount on All Watches' },
  { code: 'WELCOME500', flatDiscount: 500, description: 'Flat ₹500 Off on your order' },
  { code: 'VIP20', discountPercent: 20, description: '20% Mega VIP Member Discount' },
  { code: 'SUMMER15', discountPercent: 15, description: '15% Seasonal Collection Discount' },
]

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onProceedToCheckout,
  appliedCoupon,
  onApplyCoupon,
}) => {
  if (!isOpen) return null

  const [inputCode, setInputCode] = useState('')
  const [couponError, setCouponError] = useState('')
  const [localCoupon, setLocalCoupon] = useState<AppliedCoupon | null>(appliedCoupon || null)

  const activeCoupon = appliedCoupon !== undefined ? appliedCoupon : localCoupon

  const formatINR = (amt: number) => `₹${amt.toLocaleString('en-IN')}`

  const subtotal = items.reduce((acc, item) => acc + item.product.price_rupees * item.quantity, 0)
  
  let discountAmount = 0
  if (activeCoupon) {
    if (activeCoupon.discountPercent) {
      discountAmount = Math.round((subtotal * activeCoupon.discountPercent) / 100)
    } else if (activeCoupon.flatDiscount) {
      discountAmount = Math.min(subtotal, activeCoupon.flatDiscount)
    }
  }
  const finalTotal = Math.max(0, subtotal - discountAmount)

  const applyPromo = (code: string) => {
    const found = AVAILABLE_COUPONS.find((c) => c.code.toUpperCase() === code.trim().toUpperCase())
    if (found) {
      const couponObj: AppliedCoupon = {
        code: found.code,
        discountPercent: found.discountPercent,
        flatDiscount: found.flatDiscount,
        description: found.description,
      }
      setLocalCoupon(couponObj)
      onApplyCoupon?.(couponObj)
      setCouponError('')
      setInputCode('')
    } else {
      setCouponError('Invalid coupon code. Try CHRONOVA10 or WELCOME500')
    }
  }

  const removePromo = () => {
    setLocalCoupon(null)
    onApplyCoupon?.(null)
    setCouponError('')
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <div className="w-screen max-w-lg bg-white border-l border-slate-200 text-slate-900 flex flex-col justify-between shadow-2xl">
          {/* Header */}
          <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🛍️</span>
              <div>
                <h2 className="text-lg font-black tracking-tight text-slate-900">YOUR SHOPPING BAG</h2>
                <p className="text-xs text-slate-500 font-semibold font-mono">
                  {items.reduce((s, i) => s + i.quantity, 0)} items in bag
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm transition cursor-pointer border border-slate-200 shadow-xs"
              title="Close Bag"
            >
              ✕
            </button>
          </div>

          {/* Free Shipping Alert */}
          <div className="bg-emerald-50 px-6 py-3 border-b border-emerald-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
              <span>🚚</span>
              <span>FREE Insured Express Pan-India Delivery Unlocked!</span>
            </div>
            <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
              Active
            </span>
          </div>

          {/* Items List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {items.length === 0 ? (
              <div className="py-20 text-center text-slate-400 space-y-4">
                <div className="text-5xl">⌚</div>
                <div className="text-base font-black text-slate-800">Your shopping bag is empty</div>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Browse our authentic 190-watch collection across 15 official brands to discover your next signature timepiece.
                </p>
                <button
                  onClick={onClose}
                  className="mt-4 px-6 py-3 bg-slate-900 hover:bg-blue-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-md"
                  style={{ color: "#ffffff", backgroundColor: "#0f172a" }}
                >
                  Explore Watches →
                </button>
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.product.id}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex gap-4 relative group shadow-xs"
                >
                  {/* Thumbnail */}
                  <div className="w-24 h-24 rounded-xl bg-white p-2 border border-slate-200 shrink-0 flex items-center justify-center">
                    <img
                      src={item.product.images.primary}
                      alt={item.product.name}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>

                  {/* Details */}
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-blue-700 uppercase font-black">
                          {item.product.brand}
                        </span>
                        <button
                          onClick={() => onRemoveItem(item.product.id)}
                          className="text-slate-400 hover:text-rose-600 text-sm transition cursor-pointer p-1"
                          title="Remove item"
                        >
                          🗑️
                        </button>
                      </div>
                      <h4 className="text-sm font-black text-slate-900 line-clamp-1">
                        {item.product.name}
                      </h4>
                      {item.selected_color && (
                        <span className="text-xs text-slate-500 font-medium">Color: {item.selected_color}</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200">
                      <div className="text-sm font-black text-slate-900">
                        {formatINR(item.product.price_rupees * item.quantity)}
                      </div>

                      {/* Quantity Stepper */}
                      <div className="flex items-center bg-white border border-slate-300 rounded-lg shadow-xs">
                        <button
                          onClick={() => onUpdateQuantity(item.product.id, Math.max(1, item.quantity - 1))}
                          className="w-7 h-7 text-xs text-slate-700 hover:bg-slate-100 flex items-center justify-center font-bold cursor-pointer"
                        >
                          -
                        </button>
                        <span className="w-7 text-center text-xs font-mono font-black text-slate-900">{item.quantity}</span>
                        <button
                          onClick={() => onUpdateQuantity(item.product.id, Math.min(10, item.quantity + 1))}
                          className="w-7 h-7 text-xs text-slate-700 hover:bg-slate-100 flex items-center justify-center font-bold cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer & Coupon Box */}
          {items.length > 0 && (
            <div className="p-6 border-t border-slate-200 bg-slate-50 space-y-4">
              {/* Coupon Engine */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center justify-between">
                  <span>🎟️ Apply Promo Coupon:</span>
                  {activeCoupon && (
                    <button
                      onClick={removePromo}
                      className="text-rose-600 hover:underline text-[11px] font-bold cursor-pointer"
                    >
                      Remove Coupon
                    </button>
                  )}
                </label>

                {activeCoupon ? (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-emerald-800 text-xs bg-emerald-200 px-2 py-0.5 rounded">
                          {activeCoupon.code}
                        </span>
                        <span className="text-xs font-bold text-emerald-900">
                          {activeCoupon.discountPercent ? `${activeCoupon.discountPercent}% OFF` : `₹${activeCoupon.flatDiscount} OFF`}
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-700">{activeCoupon.description}</p>
                    </div>
                    <span className="text-lg">✓</span>
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (inputCode) applyPromo(inputCode)
                    }}
                    className="space-y-2"
                  >
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={inputCode}
                        onChange={(e) => setInputCode(e.target.value)}
                        placeholder="Enter coupon (e.g. CHRONOVA10)"
                        className="flex-1 px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 uppercase font-mono font-bold focus:outline-none focus:border-slate-900"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider transition cursor-pointer"
                        style={{ color: "#ffffff", backgroundColor: "#0f172a" }}
                      >
                        Apply
                      </button>
                    </div>
                    {couponError && (
                      <div className="text-xs font-semibold text-rose-600">
                        {couponError}
                      </div>
                    )}
                  </form>
                )}

                {/* Available Quick Coupon Chips */}
                {!activeCoupon && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {AVAILABLE_COUPONS.map((c) => (
                      <button
                        key={c.code}
                        onClick={() => applyPromo(c.code)}
                        className="text-[10px] font-mono font-bold px-2 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 transition cursor-pointer"
                      >
                        🏷️ {c.code} ({c.discountPercent ? `${c.discountPercent}%` : `₹${c.flatDiscount}`})
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Price Calculation */}
              <div className="space-y-2 text-xs pt-2 border-t border-slate-200">
                <div className="flex justify-between text-slate-600">
                  <span className="font-medium">Bag Subtotal:</span>
                  <span className="text-slate-900 font-bold">{formatINR(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>Coupon Discount ({activeCoupon?.code}):</span>
                    <span>-{formatINR(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span className="font-medium">Insured Express Courier Shipping:</span>
                  <span className="text-emerald-700 font-black">FREE</span>
                </div>
                <div className="flex justify-between text-slate-900 font-black text-base pt-2 border-t border-slate-200">
                  <span>Total Payable:</span>
                  <span className="text-blue-700 text-lg font-black">{formatINR(finalTotal)}</span>
                </div>
              </div>

              {/* Checkout Button */}
              <button
                onClick={() => {
                  onClose()
                  onProceedToCheckout()
                }}
                className="w-full py-4 px-5 rounded-2xl bg-slate-900 hover:bg-blue-600 text-white font-black text-sm uppercase tracking-wider transition cursor-pointer shadow-lg flex items-center justify-center gap-2"
                style={{ color: "#ffffff", backgroundColor: "#0f172a" }}
              >
                <span>PROCEED TO CHECKOUT</span>
                <span>→</span>
              </button>

              <div className="text-[11px] text-center text-slate-500 font-medium">
                🔒 256-Bit SSL Encrypted Razorpay Test Gateway
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
