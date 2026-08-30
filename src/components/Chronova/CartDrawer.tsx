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
        className="absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-[#090e1a] border-l border-[#1e293b] text-[#e2e8f0] flex flex-col justify-between shadow-2xl">
          {/* Header */}
          <div className="p-5 border-b border-[#1e293b] flex items-center justify-between bg-[#040711]">
            <div className="flex items-center gap-2">
              <span className="text-xl">🛍️</span>
              <h2 className="text-base font-extrabold text-white">Your Chronova Bag</h2>
              <span className="px-2 py-0.5 rounded-full bg-[#2563eb]/20 text-[#38bdf8] font-mono text-xs font-bold">
                {items.reduce((sum, i) => sum + i.quantity, 0)} Items
              </span>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[#1e293b] text-[#94a3b8] hover:text-white flex items-center justify-center transition cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* Shipping Tracker */}
          <div className="bg-[#0b132b] px-5 py-2.5 border-b border-[#1e293b] text-xs font-mono">
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-[#38bdf8] font-bold">✓ Premium Insured Delivery:</span>
              <span className="text-[#34d399] font-bold">FREE</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[#1e293b] overflow-hidden">
              <div className="w-full h-full bg-gradient-to-r from-[#38bdf8] to-[#10b981]" />
            </div>
          </div>

          {/* Items List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {items.length === 0 ? (
              <div className="py-16 text-center text-[#64748b] space-y-3">
                <div className="text-4xl">⌚</div>
                <div className="text-sm font-semibold text-white">Your bag is currently empty</div>
                <p className="text-xs text-[#94a3b8] max-w-xs mx-auto">
                  Explore our catalog of 190 timepieces to find your signature watch.
                </p>
                <button
                  onClick={onClose}
                  className="mt-4 px-4 py-2 bg-[#2563eb] hover:bg-[#3b82f6] text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Browse Watches →
                </button>
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.product.id}
                  className="p-3.5 rounded-2xl bg-[#0b132b] border border-[#1e293b] flex gap-3 relative group"
                >
                  {/* Thumbnail */}
                  <div className="w-20 h-20 rounded-xl bg-[#040711] p-1.5 border border-[#1e293b] shrink-0 flex items-center justify-center">
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
                        <span className="text-[10px] font-mono text-[#38bdf8] uppercase font-bold">
                          {item.product.brand}
                        </span>
                        <button
                          onClick={() => onRemoveItem(item.product.id)}
                          className="text-[#64748b] hover:text-[#ef4444] text-xs transition cursor-pointer p-1"
                          title="Remove item"
                        >
                          🗑️
                        </button>
                      </div>
                      <h4 className="text-xs font-bold text-white line-clamp-1">
                        {item.product.name}
                      </h4>
                      {item.selected_color && (
                        <span className="text-[10px] text-[#94a3b8]">Color: {item.selected_color}</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#1e293b]/60">
                      <div className="text-xs font-extrabold text-white">
                        {formatINR(item.product.price_rupees * item.quantity)}
                      </div>

                      {/* Quantity Stepper */}
                      <div className="flex items-center bg-[#090e1a] border border-[#1e293b] rounded-lg">
                        <button
                          onClick={() => onUpdateQuantity(item.product.id, Math.max(1, item.quantity - 1))}
                          className="w-6 h-6 text-xs text-white hover:bg-[#1e293b] flex items-center justify-center cursor-pointer"
                        >
                          -
                        </button>
                        <span className="w-6 text-center text-xs font-mono text-white">{item.quantity}</span>
                        <button
                          onClick={() => onUpdateQuantity(item.product.id, Math.min(10, item.quantity + 1))}
                          className="w-6 h-6 text-xs text-white hover:bg-[#1e293b] flex items-center justify-center cursor-pointer"
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
            <div className="p-5 border-t border-[#1e293b] bg-[#040711] space-y-4">
              {/* Promo Form */}
              <form onSubmit={handleApplyPromo} className="space-y-1">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    placeholder="Promo Code (e.g. CHRONOVA10)"
                    className="flex-1 px-3 py-2 rounded-xl bg-[#090e1a] border border-[#1e293b] text-xs text-white uppercase font-mono focus:outline-none focus:border-[#38bdf8]"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 rounded-xl bg-[#1e293b] hover:bg-[#334155] text-white text-xs font-bold transition cursor-pointer"
                  >
                    Apply
                  </button>
                </div>
                {promoMessage && (
                  <div className={`text-[10px] font-mono ${promoMessage.startsWith('✓') ? 'text-[#34d399]' : 'text-[#ef4444]'}`}>
                    {promoMessage}
                  </div>
                )}
              </form>

              {/* Price Calculation */}
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-[#94a3b8]">
                  <span>Subtotal:</span>
                  <span className="text-white">{formatINR(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-[#34d399]">
                    <span>VIP Member Discount ({discountPercent}%):</span>
                    <span>-{formatINR(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[#94a3b8]">
                  <span>Insured Express Delivery:</span>
                  <span className="text-[#34d399]">FREE</span>
                </div>
                <div className="flex justify-between text-white font-extrabold text-sm pt-2 border-t border-[#1e293b]">
                  <span>Total Due:</span>
                  <span className="text-[#38bdf8] text-base">{formatINR(finalTotal)}</span>
                </div>
              </div>

              {/* Checkout Button */}
              <button
                onClick={() => {
                  onClose()
                  onProceedToCheckout()
                }}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#2563eb] to-[#0284c7] hover:from-[#3b82f6] hover:to-[#0ea5e9] text-white font-bold text-sm transition cursor-pointer shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
              >
                <span>Proceed to Checkout</span>
                <span>→</span>
              </button>

              <div className="text-[10px] text-center text-[#64748b]">
                🔒 256-Bit SSL Encrypted Razorpay Test Gateway
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
