export type { ChronovaOrder } from '../components/Chronova/types'
import type { ChronovaOrder } from '../components/Chronova/types'
import { fetchCanonicalTransactions } from './backendApi'

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

/**
 * Reconciles local browser Chronova orders with the authoritative backend transaction ledger.
 * If RazorRecover AI or Razorpay has captured/recovered a transaction, the local order status
 * is automatically updated to RECOVERED / PAID & CONFIRMED with payment details.
 */
export async function reconcileChronovaOrdersWithBackend(): Promise<ChronovaOrder[]> {
  if (typeof window === 'undefined') return []
  try {
    const backendTxns = await fetchCanonicalTransactions()
    if (!backendTxns || !Array.isArray(backendTxns) || backendTxns.length === 0) {
      return getStoredChronovaOrders()
    }

    const localOrders = getStoredChronovaOrders()
    let hasChanges = false

    // Index backend transactions by various key identifiers
    const backendMap = new Map<string, any>()
    for (const txn of backendTxns) {
      if (txn.id) {
        backendMap.set(txn.id.toUpperCase(), txn)
        backendMap.set(txn.id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase(), txn)
      }
      if (txn.chronova_order_id) {
        backendMap.set(txn.chronova_order_id.toUpperCase(), txn)
        backendMap.set(txn.chronova_order_id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase(), txn)
      }
      if (txn.razorpay_order_id) {
        backendMap.set(txn.razorpay_order_id.toUpperCase(), txn)
      }
      if (txn.order_id) {
        backendMap.set(String(txn.order_id).toUpperCase(), txn)
      }
    }

    const updatedOrders = localOrders.map((order) => {
      const cleanTxnId = order.transaction_id ? order.transaction_id.toUpperCase() : ''
      const rawTxnId = cleanTxnId.replace(/[^a-zA-Z0-9]/g, '')
      const cleanOrderId = order.order_id ? order.order_id.toUpperCase() : ''
      const rawOrderId = cleanOrderId.replace(/[^a-zA-Z0-9]/g, '')

      const matchedTxn =
        backendMap.get(cleanTxnId) ||
        backendMap.get(rawTxnId) ||
        backendMap.get(cleanOrderId) ||
        backendMap.get(rawOrderId)

      if (matchedTxn) {
        const isBackendRecoveredOrCaptured =
          matchedTxn.status === 'RECOVERED' ||
          matchedTxn.status === 'CAPTURED' ||
          matchedTxn.provider_status === 'captured' ||
          matchedTxn.payment?.status === 'PAYMENT_RECOVERED' ||
          matchedTxn.payment?.status === 'ORDER_CONFIRMED' ||
          matchedTxn.recovery_status === 'RECOVERED'

        const isBackendPendingRecovery =
          matchedTxn.status === 'WAITING_FOR_RECOVERY' ||
          matchedTxn.status === 'IN_PROGRESS' ||
          matchedTxn.recovery_status === 'IN_PROGRESS'

        const rzpPaymentId =
          matchedTxn.recovery_payment_id ||
          matchedTxn.razorpay_payment_id ||
          matchedTxn.provider_payment_id ||
          matchedTxn.payment?.paymentId ||
          order.razorpay_payment_id

        if (isBackendRecoveredOrCaptured && (order.payment_status !== 'PAID' && order.payment_status !== 'RECOVERED')) {
          hasChanges = true
          return {
            ...order,
            payment_status: 'RECOVERED' as const,
            order_status: 'ORDER_CONFIRMED' as const,
            recovery_status: 'RECOVERED' as const,
            razorpay_payment_id: rzpPaymentId,
            verified_at: matchedTxn.verified_at || matchedTxn.captured_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        }

        if (isBackendPendingRecovery && order.payment_status === 'FAILED' && order.recovery_status !== 'IN_PROGRESS') {
          hasChanges = true
          return {
            ...order,
            order_status: 'RECOVERY_IN_PROGRESS' as const,
            recovery_status: 'IN_PROGRESS' as const,
            recovery_operation_id: matchedTxn.recovery_operation_id || order.recovery_operation_id,
            updated_at: new Date().toISOString(),
          }
        }
      }
      return order
    })

    // Add any backend Chronova transactions that aren't present in local browser storage
    for (const txn of backendTxns) {
      if (!txn.chronova_order_id && !txn.id) continue
      const cleanTxnId = txn.id ? txn.id.toUpperCase() : ''
      const cleanOrderId = txn.chronova_order_id ? txn.chronova_order_id.toUpperCase() : ''
      const exists = updatedOrders.some(
        (o) =>
          (o.transaction_id && o.transaction_id.toUpperCase() === cleanTxnId) ||
          (o.order_id && o.order_id.toUpperCase() === cleanOrderId)
      )

      if (!exists && txn.items && Array.isArray(txn.items) && txn.items.length > 0) {
        hasChanges = true
        const isBackendPaid =
          txn.status === 'RECOVERED' ||
          txn.status === 'CAPTURED' ||
          txn.provider_status === 'captured' ||
          txn.payment?.status === 'PAYMENT_RECOVERED' ||
          txn.payment?.status === 'ORDER_CONFIRMED'

        updatedOrders.push({
          order_id: txn.chronova_order_id || `order_cn_${txn.id?.toLowerCase().replace(/^txn-cn-/, '')}`,
          transaction_id: txn.id,
          created_at: txn.created_at || new Date().toISOString(),
          updated_at: txn.updated_at || new Date().toISOString(),
          items: txn.items.map((it: any) => ({
            product_id: it.product_id || it.productId || 'watch-1',
            product_name: it.product_name || it.productName || 'Chronova Watch',
            product_image: it.product_image || it.productImage || '',
            product_category: it.product_category || it.productCategory || 'Watches',
            product_brand: it.product_brand || it.productBrand || 'Chronova',
            product_model: it.product_model || it.productModel || it.product_name,
            quantity: Number(it.quantity || 1),
            unit_price_rupees: Number(it.unit_price_rupees || it.unitPrice || Math.round((txn.amount_minor || 0) / 100)),
            total_price_rupees: Number(it.total_price_rupees || it.totalPrice || Math.round((txn.amount_minor || 0) / 100)),
            selected_color: it.selected_color,
          })),
          total_amount_rupees: txn.amount || Math.round((txn.amount_minor || 0) / 100),
          total_amount_minor: txn.amount_minor || 0,
          currency: txn.currency || 'INR',
          customer: {
            full_name: txn.customer?.full_name || txn.customer?.name || 'Customer',
            email: txn.customer?.email || 'customer@example.com',
            phone: txn.customer?.phone || '',
            address: txn.customer?.address || '',
          },
          payment_status: isBackendPaid ? 'RECOVERED' : 'FAILED',
          order_status: isBackendPaid ? 'ORDER_CONFIRMED' : 'PAYMENT_FAILED',
          recovery_status: isBackendPaid ? 'RECOVERED' : (txn.status === 'WAITING_FOR_RECOVERY' ? 'IN_PROGRESS' : 'NONE'),
          razorpay_payment_id: txn.recovery_payment_id || txn.razorpay_payment_id || txn.provider_payment_id,
          recovery_operation_id: txn.recovery_operation_id,
        })
      }
    }

    // Sort descending by created_at
    updatedOrders.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())

    if (hasChanges) {
      localStorage.setItem(CHRONOVA_ORDERS_KEY, JSON.stringify(updatedOrders))
      window.dispatchEvent(new CustomEvent('chronova:orders-updated', { detail: updatedOrders }))
    }

    return updatedOrders
  } catch (e) {
    console.error('Error reconciling Chronova orders with backend:', e)
    return getStoredChronovaOrders()
  }
}

