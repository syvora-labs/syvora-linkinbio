import {computed, reactive, watch} from 'vue'
import type {CartItem} from '@/lib/shop/types'

const STORAGE_KEY = 'eb-shop-cart'

function loadInitial(): CartItem[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return []
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed : []
    } catch {
        return []
    }
}

// Module-level singleton state — every component that calls useCart() shares
// the same reactive cart. This project has no Pinia, so a module-scoped
// reactive object is the idiomatic store here.
const state = reactive<{items: CartItem[]}>({items: loadInitial()})

watch(
    () => state.items,
    (items) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
        } catch {
            // Ignore quota / private-mode write failures — the cart still works
            // in memory for the current session.
        }
    },
    {deep: true},
)

function findIndex(variantId: string): number {
    return state.items.findIndex(i => i.variant_id === variantId)
}

function addItem(item: Omit<CartItem, 'quantity'>, quantity = 1) {
    const existing = state.items.find(i => i.variant_id === item.variant_id)
    if (existing) {
        existing.quantity += quantity
    } else {
        state.items.push({...item, quantity})
    }
}

function setQuantity(variantId: string, quantity: number) {
    const idx = findIndex(variantId)
    if (idx < 0) return
    if (quantity <= 0) {
        state.items.splice(idx, 1)
    } else {
        state.items[idx]!.quantity = quantity
    }
}

function removeItem(variantId: string) {
    const idx = findIndex(variantId)
    if (idx >= 0) state.items.splice(idx, 1)
}

function clear() {
    state.items.splice(0, state.items.length)
}

const items = computed(() => state.items)
const count = computed(() => state.items.reduce((sum, i) => sum + i.quantity, 0))
const totalCents = computed(() => state.items.reduce((sum, i) => sum + i.price_cents * i.quantity, 0))
const currency = computed(() => state.items[0]?.currency ?? 'chf')

export function useCart() {
    return {items, count, totalCents, currency, addItem, setQuantity, removeItem, clear}
}
