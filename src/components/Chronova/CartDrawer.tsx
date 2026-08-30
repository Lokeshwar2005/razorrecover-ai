'use client'

import React, { useState } from 'react'
import type { CartItem } from './types'

interface CartDrawerProps {
  isOpen: boolean
  onClose: () => void
  items: CartItem[]
  onUpdateQuantity: (productId: string, qty: number) => void
  onRemoveItem: (productId: string) => void
  onProceedToCheckout: () => void
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onProceedToCheckout,
}) => {
  if (!isOpen) return null

  const [promoCode, setPromoCode] = useState('')
  const [discountPercent, setDiscountPercent] = useState(0)
  const [promoMessage, setPromoMessage] = useState('')

  const formatINR = (amt: number) => `₹${amt.toLocaleString('en-IN')}`

  const subtotal = items.reduce((acc, item) => acc + item.product.price_rupees * item.quantity, 0)
  const discountAmount = Math.round((subtotal * discountPercent) / 100)
  const finalTotal = Math.max(0, subtotal - discountAmount)

  const handleApplyPromo = (e: React.FormEvent) => {
    e.preventDefault()
    if (promoCode.trim().toUpperCase() === 'CHRONOVA10' || promoCode.trim().toUpperCase() === 'TIME10') {
      setDiscountPercent(10)
      setPromoMessage('✓ 10% Welcome Discount Applied!')
    } else if (promoCode.trim().toUpperCase() === 'VIP20') {
      setDiscountPercent(20)
      setPromoMessage('✓ 20% VIP Member Discount Applied!')
    } else {
      setPromoMessage('⚠️ Invalid promo code. Try CHRONOVA10')
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white border-l border-slate-200 text-slate-900 flex flex-col justify-between shadow-2xl">
          {/* Header */}
          <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2">
              <span className="text-xl">🛍️</span>
              <h2 className="text-base font-black text-slate-900">Your Shopping Bag</h2>
              <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 font-mono text-xs font-bold">
                {items.reduce((sum, i) => sum + i.quantity, 0)} Items
              </span>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center transition cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* Shipping Tracker */}
          <div className="bg-emerald-50 px-5 py-2.5 border-b border-emerald-200 text-xs">
            <div className="flex justify-between text-[11px] mb-1 text-emerald-800">
              <span className="font-bold">✓ Insured Express Courier:</span>
              <span className="font-extrabold">FREE FOR ALL ORDERS</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-emerald-200 overflow-hidden">
              <div className="w-full h-full bg-emerald-600" />
            </div>
          </div>

          {/* Items List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {items.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-3">
                <div className="text-4xl">⌚</div>
                <div className="text-sm font-bold text-slate-800">Your shopping bag is empty</div>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Browse our curated 190-watch collection to discover your next signature timepiece.
                </p>
                <button
                  onClick={onClose}
                  className="mt-4 px-4 py-2 bg-slate-900 hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Explore Watches →
                </button>
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.product.id}
                  className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex gap-3 relative group shadow-xs"
                >
                  {/* Thumbnail */}
                  <div className="w-20 h-20 rounded-xl bg-white p-1.5 border border-slate-200 shrink-0 flex items-center justify-center">
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
                        <span className="text-[10px] font-mono text-blue-700 uppercase font-bold">
                          {item.product.brand}
                        </span>
                        <button
                          onClick={() => onRemoveItem(item.product.id)}
                          className="text-slate-400 hover:text-rose-600 text-xs transition cursor-pointer p-1"
                          title="Remove item"
                        >
                          🗑️
                        </button>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 line-clamp-1">
                        {item.product.name}
                      </h4>
                      {item.selected_color && (
                        <span className="text-[10px] text-slate-500">Color: {item.selected_color}</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200">
                      <div className="text-xs font-black text-slate-900">
                        {formatINR(item.product.price_rupees * item.quantity)}
                      </div>

                      {/* Quantity Stepper */}
                      <div className="flex items-center bg-white border border-slate-300 rounded-lg">
                        <button
                          onClick={() => onUpdateQuantity(item.product.id, Math.max(1, item.quantity - 1))}
                          className="w-6 h-6 text-xs text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                        >
                          -
                        </button>
                        <span className="w-6 text-center text-xs font-mono font-bold text-slate-900">{item.quantity}</span>
                        <button
                          onClick={() => onUpdateQuantity(item.product.id, Math.min(10, item.quantity + 1))}
                          className="w-6 h-6 text-xs text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
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

          {/* Footer */}
          {items.length > 0 && (
            <div className="p-5 border-t border-slate-200 bg-slate-50 space-y-4">
              {/* Promo Form */}
              <form onSubmit={handleApplyPromo} className="space-y-1">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    placeholder="Enter Coupon (e.g. CHRONOVA10)"
                    className="flex-1 px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 uppercase font-mono focus:outline-none focus:border-blue-600"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer"
                  >
                    Apply
                  </button>
                </div>
                {promoMessage && (
                  <div className={`text-[10px] font-medium ${promoMessage.startsWith('✓') ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {promoMessage}
                  </div>
                )}
              </form>

              {/* Price Calculation */}
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Bag Subtotal:</span>
                  <span className="text-slate-900 font-semibold">{formatINR(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Coupon Discount ({discountPercent}%):</span>
                    <span>-{formatINR(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>Insured Express Shipping:</span>
                  <span className="text-emerald-700 font-bold">FREE</span>
                </div>
                <div className="flex justify-between text-slate-900 font-black text-sm pt-2 border-t border-slate-200">
                  <span>Order Total:</span>
                  <span className="text-blue-700 text-base">{formatINR(finalTotal)}</span>
                </div>
              </div>

              {/* Checkout Button */}
              <button
                onClick={() => {
                  onClose()
                  onProceedToCheckout()
                }}
                className="w-full py-3.5 px-4 rounded-xl bg-slate-900 hover:bg-blue-600 text-white font-bold text-sm transition cursor-pointer shadow-md flex items-center justify-center gap-2"
              >
                <span>Proceed to Checkout</span>
                <span>→</span>
              </button>

              <div className="text-[10px] text-center text-slate-500 font-medium">
                🔒 256-Bit SSL Encrypted Razorpay Test Gateway
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
