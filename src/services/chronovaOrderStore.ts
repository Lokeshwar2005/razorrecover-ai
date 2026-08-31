export type { ChronovaOrder } from '../components/Chronova/types'
import type { ChronovaOrder } from '../components/Chronova/types'

const CHRONOVA_ORDERS_KEY = 'chronova_orders'

export function getStoredChronovaOrders(): ChronovaOrder[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(CHRONOVA_ORDERS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed
      }
    }
  } catch (e) {
    console.error('Error reading Chronova orders from localStorage:', e)
  }
  return []
}

export function saveChronovaOrder(order: ChronovaOrder): ChronovaOrder[] {
  if (typeof window === 'undefined') return [order]
  try {
    const orders = getStoredChronovaOrders()
    const existingIndex = orders.findIndex(
      (o) =>
        (o.order_id && o.order_id.toLowerCase() === order.order_id.toLowerCase()) ||
        (o.transaction_id && o.transaction_id.toUpperCase() === order.transaction_id.toUpperCase())
    )

    let updatedOrders: ChronovaOrder[]
    if (existingIndex >= 0) {
      // Merge updates
      orders[existingIndex] = {
        ...orders[existingIndex],
        ...order,
        updated_at: new Date().toISOString(),
      }
      updatedOrders = [...orders]
    } else {
      updatedOrders = [order, ...orders]
    }

    localStorage.setItem(CHRONOVA_ORDERS_KEY, JSON.stringify(updatedOrders))
    window.dispatchEvent(new CustomEvent('chronova:orders-updated', { detail: updatedOrders }))
    return updatedOrders
  } catch (e) {
    console.error('Error saving Chronova order to localStorage:', e)
    return [order]
  }
}

export function updateChronovaOrder(
  orderIdOrTxnId: string,
  updates: Partial<ChronovaOrder>
): ChronovaOrder | null {
  if (typeof window === 'undefined') return null
  try {
    const orders = getStoredChronovaOrders()
    const target = orderIdOrTxnId.trim().toUpperCase()
    const idx = orders.findIndex(
      (o) =>
        o.order_id.toUpperCase() === target ||
        o.transaction_id.toUpperCase() === target ||
        o.order_id.replace('ORDER_CN_', '').toUpperCase() === target.replace('ORDER_CN_', '') ||
        o.transaction_id.replace('TXN-CN-', '').toUpperCase() === target.replace('TXN-CN-', '')
    )

    if (idx >= 0) {
      const updated: ChronovaOrder = {
        ...orders[idx],
        ...updates,
        updated_at: new Date().toISOString(),
      }
      orders[idx] = updated
      localStorage.setItem(CHRONOVA_ORDERS_KEY, JSON.stringify(orders))
      window.dispatchEvent(new CustomEvent('chronova:orders-updated', { detail: orders }))
      return updated
    }
  } catch (e) {
    console.error('Error updating Chronova order:', e)
  }
  return null
}

export function findChronovaOrder(orderIdOrTxnId: string): ChronovaOrder | null {
  const orders = getStoredChronovaOrders()
  const target = orderIdOrTxnId.trim().toUpperCase()
  return (
    orders.find(
      (o) =>
        o.order_id.toUpperCase() === target ||
        o.transaction_id.toUpperCase() === target ||
        o.order_id.replace('ORDER_CN_', '').toUpperCase() === target.replace('ORDER_CN_', '') ||
        o.transaction_id.replace('TXN-CN-', '').toUpperCase() === target.replace('TXN-CN-', '')
    ) || null
  )
}
