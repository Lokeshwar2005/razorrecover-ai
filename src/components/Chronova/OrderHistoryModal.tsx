'use client'

import React, { useState, useEffect, useMemo } from 'react'
import type { ChronovaOrder } from './types'
import { resolveProductImageUrl } from './utils'
import { getStoredChronovaOrders } from '../../services/chronovaOrderStore'

interface OrderHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  onRetryOrder?: (order: ChronovaOrder) => void
}

export const OrderHistoryModal: React.FC<OrderHistoryModalProps> = ({
  isOpen,
  onClose,
  onRetryOrder,
}) => {
  const [orders, setOrders] = useState<ChronovaOrder[]>([])
  const [filter, setFilter] = useState<'all' | 'paid' | 'failed'>('all')
  const [search, setSearch] = useState<string>('')
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)

  const reloadOrders = () => {
    setOrders(getStoredChronovaOrders())
  }

  useEffect(() => {
    if (isOpen) {
      reloadOrders()
    }
  }, [isOpen])

  useEffect(() => {
    const handleUpdated = () => {
      reloadOrders()
    }
    window.addEventListener('chronova:orders-updated', handleUpdated)
    return () => window.removeEventListener('chronova:orders-updated', handleUpdated)
  }, [])

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Filter by status
      if (filter === 'paid' && order.payment_status !== 'PAID' && order.payment_status !== 'RECOVERED') {
        return false
      }
      if (filter === 'failed' && (order.payment_status === 'PAID' || order.payment_status === 'RECOVERED')) {
        return false
      }

      // Filter by search query
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const orderIdMatch = order.order_id.toLowerCase().includes(q)
        const txnIdMatch = order.transaction_id.toLowerCase().includes(q)
        const prodMatch = order.items.some((i) => i.product_name.toLowerCase().includes(q) || (i.product_brand && i.product_brand.toLowerCase().includes(q)))
        const rzpMatch = (order.razorpay_payment_id && order.razorpay_payment_id.toLowerCase().includes(q)) || (order.razorpay_order_id && order.razorpay_order_id.toLowerCase().includes(q))
        return orderIdMatch || txnIdMatch || prodMatch || rzpMatch
      }

      return true
    })
  }, [orders, filter, search])

  const formatINR = (amt: number) => `₹${Math.round(amt).toLocaleString('en-IN')}`

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 md:p-8 animate-in fade-in duration-200">
      <div className="relative bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 text-left overflow-hidden">
        {/* Header */}
        <div className="bg-white/95 backdrop-blur-sm px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-lg shadow-sm">
              📦
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900">
                  MY ORDER HISTORY
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-slate-100 text-slate-700 rounded-full border border-slate-200">
                  {orders.length} {orders.length === 1 ? 'Order' : 'Orders'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Official Chronova purchase ledger & real-time autonomous recovery lifecycle.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center justify-center font-bold text-sm transition cursor-pointer"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Filter / Search Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            {[
              { id: 'all', label: 'All Orders', count: orders.length },
              {
                id: 'paid',
                label: 'Paid / Confirmed',
                count: orders.filter((o) => o.payment_status === 'PAID' || o.payment_status === 'RECOVERED').length,
              },
              {
                id: 'failed',
                label: 'Payment Failed',
                count: orders.filter((o) => o.payment_status !== 'PAID' && o.payment_status !== 'RECOVERED').length,
              },
            ].map((pill) => (
              <button
                key={pill.id}
                onClick={() => setFilter(pill.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  filter === pill.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
                }`}
              >
                <span>{pill.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    filter === pill.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {pill.count}
                </span>
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Search by order, txn, watch..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-1.5 pl-8 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 font-mono"
            />
            <span className="absolute left-2.5 top-2 text-xs text-slate-400">🔍</span>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1.5 text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Orders List Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center text-2xl mx-auto">
                ⌚
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                  {search ? 'No matching orders found' : 'No Chronova orders yet'}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {search
                    ? `No orders matched your search "${search}". Try searching by order reference or product name.`
                    : 'Select a luxury timepiece from our catalog to place an order or test our AI recovery flow.'}
                </p>
              </div>
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-blue-600 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-md"
              >
                Browse Watch Catalog
              </button>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const isPaid = order.payment_status === 'PAID' || order.payment_status === 'RECOVERED'
              const isRecovered = order.recovery_status === 'RECOVERED'
              const isExpanded = expandedOrderId === order.order_id
              const firstItem = order.items[0]

              return (
                <div
                  key={order.order_id}
                  className={`rounded-2xl border transition overflow-hidden bg-white ${
                    isPaid
                      ? 'border-emerald-200 hover:border-emerald-300 shadow-sm'
                      : 'border-rose-200 hover:border-rose-300 shadow-sm'
                  }`}
                >
                  {/* Order Summary Row */}
                  <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 flex-1 min-w-0">
                      {/* Product Thumbnail with Safe Placeholder Fallback */}
                      <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center relative">
                        {firstItem?.product_image ? (
                          <img
                            src={resolveProductImageUrl(firstItem.product_image)}
                            alt={firstItem.product_name || 'Chronova Watch'}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none'
                            }}
                          />
                        ) : (
                          <span className="text-xl">⌚</span>
                        )}
                      </div>

                      {/* Product & Order References */}
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-bold text-xs text-slate-900">
                            #{order.order_id}
                          </span>
                          <span className="font-mono text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                            {order.transaction_id}
                          </span>
                          {isPaid ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-300 text-[10px] font-black font-mono">
                              <span>✓ PAID & CONFIRMED</span>
                              {isRecovered && <span>· ⚡ RECOVERED</span>}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-300 text-[10px] font-black font-mono">
                              <span>✕ PAYMENT FAILED</span>
                            </span>
                          )}
                        </div>

                        <div className="text-xs font-bold text-slate-800 truncate flex items-center gap-1.5">
                          <span>
                            {order.items && order.items.length > 1
                              ? `${order.items[0]?.product_name} (+${order.items.length - 1} other item${order.items.length > 2 ? 's' : ''})`
                              : (firstItem ? `${firstItem.product_name} (x${firstItem.quantity})` : 'Chronova Luxury Timepiece')}
                          </span>
                          {order.items && order.items.length > 1 && (
                            <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 text-[9px] font-mono font-bold">
                              {order.items.length} ITEMS
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-500 font-mono flex items-center gap-3">
                          <span>Date: {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          {order.razorpay_payment_id && (
                            <span className="text-emerald-700 font-bold">RZP: {order.razorpay_payment_id}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Amount & Actions */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 gap-2 shrink-0">
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400 font-mono">TOTAL AMOUNT</div>
                        <div className="text-base font-black text-slate-900 font-mono">
                          {formatINR(order.total_amount_rupees)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {!isPaid && onRetryOrder && (
                          <button
                            onClick={() => {
                              onClose()
                              onRetryOrder(order)
                            }}
                            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-blue-600 text-white font-bold text-[11px] uppercase tracking-wider transition cursor-pointer shadow-sm flex items-center gap-1"
                          >
                            <span>⚡</span>
                            <span>Retry</span>
                          </button>
                        )}

                        <button
                          onClick={() => setExpandedOrderId(isExpanded ? null : order.order_id)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
                        >
                          {isExpanded ? 'Hide ▲' : 'Details ▼'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Lifecycle & Order Spec Details */}
                  {isExpanded && (
                    <div className="bg-slate-50/80 border-t border-slate-200 p-4 sm:p-5 space-y-4 text-xs">
                      {/* Section 0: Purchased Products List (All Items) */}
                      <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-2.5">
                        <div className="text-[10px] font-mono text-slate-400 font-bold uppercase flex items-center justify-between">
                          <span>Purchased Items ({order.items.length})</span>
                          <span className="text-slate-900 font-bold font-mono">Total: {formatINR(order.total_amount_rupees)}</span>
                        </div>
                        <div className="space-y-2">
                          {order.items.map((item, idx) => {
                            const imgSrc = resolveProductImageUrl(item.product_image || item.productImage || item.imageUrl || item.image_url)
                            const pBrand = item.product_brand || item.productBrand || item.brand || 'Chronova'
                            const pModel = item.product_model || item.productModel || item.model || item.product_name
                            return (
                              <div key={idx} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                                <div className="w-14 h-14 rounded-lg bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center relative">
                                  {imgSrc ? (
                                    <img
                                      src={imgSrc}
                                      alt={item.product_name}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        const target = e.target as HTMLElement
                                        target.style.display = 'none'
                                        const parent = target.parentElement
                                        if (parent && !parent.querySelector('.img-fallback-text')) {
                                          const span = document.createElement('span')
                                          span.className = 'img-fallback-text text-[9px] font-mono text-slate-400 text-center p-1 leading-tight'
                                          span.innerText = 'Product image unavailable'
                                          parent.appendChild(span)
                                        }
                                      }}
                                    />
                                  ) : (
                                    <span className="text-xs font-mono text-slate-400 text-center p-1">Product image unavailable</span>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0 space-y-0.5">
                                  <div className="font-bold text-slate-900 text-xs truncate">
                                    {item.product_name}
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-mono">
                                    {pBrand} · Model: {pModel}
                                    {item.product_category && <span> · {item.product_category}</span>}
                                    {item.selected_color && <span> · Color: {item.selected_color}</span>}
                                  </div>
                                  <div className="text-[11px] text-slate-700 font-mono flex items-center justify-between pt-0.5">
                                    <span>Qty: <strong>{item.quantity}</strong> × {formatINR(item.unit_price_rupees || item.unit_price || 0)}</span>
                                    <span className="font-bold text-slate-900">{formatINR(item.total_price_rupees || (item.unit_price_rupees * item.quantity))}</span>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Section 1: Customer & Delivery Info */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-white rounded-xl border border-slate-200">
                        <div>
                          <div className="text-[10px] font-mono text-slate-400 font-bold uppercase">Customer Information</div>
                          <div className="font-bold text-slate-900 text-xs mt-0.5">
                            {order.customer?.full_name || order.customer?.name || 'Information unavailable'}
                          </div>
                          <div className="text-slate-500 text-[11px]">
                            {order.customer?.email || 'Information unavailable'} · {order.customer?.phone || 'Information unavailable'}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-mono text-slate-400 font-bold uppercase">Delivery Destination</div>
                          <div className="text-slate-800 text-xs mt-0.5 font-medium">
                            {order.customer?.address || [order.customer?.address_line1, order.customer?.address_line2, order.customer?.city, order.customer?.state, order.customer?.pincode].filter(Boolean).join(', ') || 'Information unavailable'}
                          </div>
                        </div>
                      </div>

                      {/* Section 2: Failure & Recovery Details (if degraded) */}
                      {!isPaid && order.failure_reason && (
                        <div className="p-3.5 bg-rose-50/70 rounded-xl border border-rose-200 space-y-1 text-rose-900">
                          <div className="font-bold flex items-center justify-between text-xs">
                            <span>✕ Gateway Failure Analysis</span>
                            <span className="font-mono text-[10px] bg-rose-200 text-rose-800 px-1.5 py-0.5 rounded">
                              {order.failure_code || 'GATEWAY_ERROR'}
                            </span>
                          </div>
                          <p className="text-[11px] text-rose-800 leading-relaxed">
                            {order.failure_reason}
                          </p>
                          <div className="pt-1 flex items-center gap-1.5 text-[10px] font-mono text-rose-700">
                            <span>Recommended Recovery:</span>
                            <strong className="text-slate-900">{order.recommended_action || 'Send payment retry link'}</strong>
                          </div>
                        </div>
                      )}

                      {/* Section 3: Recovery Confirmation (if recovered) */}
                      {isPaid && isRecovered && (
                        <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 space-y-1 text-emerald-900">
                          <div className="font-bold flex items-center gap-1.5 text-xs text-emerald-800">
                            <span>⚡ Autonomous Recovery Success</span>
                          </div>
                          <p className="text-[11px] text-emerald-800 leading-relaxed">
                            Payment was verified and captured through RazorRecover AI. Dropped checkout was autonomously recovered without merchant intervention.
                          </p>
                          {order.verified_at && (
                            <div className="text-[10px] font-mono text-emerald-700">
                              Settlement Verified: {new Date(order.verified_at).toLocaleString('en-IN')}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Section 4: Lifecycle Progression Steps */}
                      <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-2">
                        <div className="text-[10px] font-mono text-slate-400 font-bold uppercase">Order Lifecycle Trace</div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700">1. Order Placed ✓</span>
                          <span>➔</span>
                          {!isPaid ? (
                            <>
                              <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">2. Payment Failed ✕</span>
                              <span>➔</span>
                              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">3. AI Recovery Active ⚡</span>
                            </>
                          ) : isRecovered ? (
                            <>
                              <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800">2. Initial Degradation</span>
                              <span>➔</span>
                              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800">3. Retry Dispatched</span>
                              <span>➔</span>
                              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">4. Recovered & Confirmed ✓</span>
                            </>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">2. Direct Settlement Paid ✓</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-mono shrink-0">
          <span>🔒 256-Bit Cryptographically Sealed</span>
          <button
            onClick={onClose}
            className="text-slate-700 hover:text-slate-900 font-bold cursor-pointer"
          >
            Close Order History
          </button>
        </div>
      </div>
    </div>
  )
}
