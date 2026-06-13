<script setup lang="ts">
import {ref, onMounted, computed} from 'vue'
import {useRoute} from 'vue-router'
import {useSeoMeta} from '@unhead/vue'
import {supabase} from '@/supabase'
import {formatPrice} from '@/lib/shop/format'
import {resolveImageUrls} from '@/lib/shop/images'

interface OrderItem {
    product_title: string
    size: string | null
    quantity: number
    unit_price_cents: number
    currency: string
    image_id: string | null
}

interface OrderDetails {
    id: string
    buyer_email: string
    status: string
    total_cents: number
    currency: string
    tracking_number: string | null
    items: OrderItem[]
}

useSeoMeta({
    title: 'Order details | ECLIPSE BOUNDARIES',
    robots: 'noindex, nofollow',
})

const route = useRoute()
const orderId = route.params.orderId as string

interface TimelineStep {
    key: string
    title: string
    sentence: string
    detail: string | null
    state: 'done' | 'current' | 'upcoming'
}

const order = ref<OrderDetails | null>(null)
const imageUrls = ref<Record<string, string>>({})
const loading = ref(true)
const error = ref<string | null>(null)

// Derive a buyer-facing tracking history from the order status + tracking number.
// Statuses flow: pending -> paid -> (fulfilled/shipped). refunded is terminal.
const timeline = computed<TimelineStep[]>(() => {
    const o = order.value
    if (!o) return []

    const received = o.status !== 'pending'
    const shipped = !!o.tracking_number || o.status === 'fulfilled' || o.status === 'shipped'
    const refunded = o.status === 'refunded'

    const steps: TimelineStep[] = []

    steps.push({
        key: 'received',
        title: 'Order received',
        sentence: received
            ? "We've received your order and confirmed your payment. Thank you!"
            : "We've received your order and are confirming your payment.",
        detail: `Order ${o.id.slice(0, 8).toUpperCase()} · ${formatPrice(o.total_cents, o.currency)}`,
        state: received ? 'done' : 'current',
    })

    steps.push({
        key: 'shipped',
        title: 'Order shipped',
        sentence: shipped
            ? 'Your order has been handed to the carrier and is on its way to you.'
            : "We're carefully packing your order. You'll find the tracking number here as soon as it ships.",
        detail: shipped && o.tracking_number ? `Tracking number: ${o.tracking_number}` : null,
        state: shipped ? 'done' : received ? 'current' : 'upcoming',
    })

    if (refunded) {
        steps.push({
            key: 'refunded',
            title: 'Order refunded',
            sentence: 'This order has been refunded. The amount will be returned to your original payment method.',
            detail: null,
            state: 'done',
        })
    }

    return steps
})

onMounted(async () => {
    try {
        const {data, error: fnError} = await supabase.functions.invoke('webshop-order-details', {
            body: {order_id: orderId},
        })
        if (fnError || !data?.order) {
            error.value = 'Order not found.'
            return
        }
        order.value = data.order

        // Resolve thumbnails in the browser, same as the storefront.
        const imageIds = order.value!.items
            .map(i => i.image_id)
            .filter((id): id is string => !!id)
        if (imageIds.length) imageUrls.value = await resolveImageUrls(imageIds)
    } catch {
        error.value = 'Something went wrong. Please try again.'
    } finally {
        loading.value = false
    }
})
</script>

<template>
    <div class="container">
        <router-link to="/shop" class="page-back">← Shop</router-link>

        <h1 class="page-title">Order details</h1>

        <div v-if="loading" class="state-card">
            <p class="state-text">Loading order...</p>
        </div>

        <div v-else-if="error || !order" class="state-card">
            <p class="state-text">{{ error ?? 'Order not found.' }}</p>
            <router-link to="/shop" class="back-button">Back to shop</router-link>
        </div>

        <template v-else>
            <div class="info-card">
                <div class="info-row">
                    <span class="info-label">Order ID</span>
                    <span class="info-value mono">{{ order.id }}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Email</span>
                    <span class="info-value">{{ order.buyer_email }}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Order total</span>
                    <span class="info-value">{{ formatPrice(order.total_cents, order.currency) }}</span>
                </div>
            </div>

            <div class="timeline-section">
                <h2 class="section-heading">Status</h2>
                <div class="timeline-card">
                    <ol class="timeline">
                        <li
                            v-for="step in timeline"
                            :key="step.key"
                            class="timeline-step"
                            :class="step.state"
                        >
                            <span class="timeline-marker"></span>
                            <div class="timeline-content">
                                <span class="timeline-title">{{ step.title }}</span>
                                <span class="timeline-sentence">{{ step.sentence }}</span>
                                <span v-if="step.detail" class="timeline-detail">{{ step.detail }}</span>
                            </div>
                        </li>
                    </ol>
                </div>
            </div>

            <div class="items-section">
                <h2 class="section-heading">Items</h2>
                <div class="items-card">
                    <div v-for="(item, idx) in order.items" :key="idx" class="item-row">
                        <div class="item-thumb">
                            <img
                                v-if="item.image_id && imageUrls[item.image_id]"
                                :src="imageUrls[item.image_id]"
                                :alt="item.product_title"
                            />
                            <div v-else class="item-thumb-placeholder"></div>
                        </div>
                        <div class="item-info">
                            <span class="item-title">{{ item.product_title }}</span>
                            <span v-if="item.size" class="item-meta">Size: {{ item.size }}</span>
                            <span class="item-meta">Qty: {{ item.quantity }}</span>
                        </div>
                        <span class="item-price">
                            {{ formatPrice(item.unit_price_cents * item.quantity, item.currency) }}
                        </span>
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>

<style scoped>
@font-face {
    font-family: 'Matter-Heavy';
    src: url('/fonts/Matter-Heavy.otf') format('opentype');
    font-weight: normal;
    font-style: normal;
}

@font-face {
    font-family: 'Matter-SemiBold';
    src: url('/fonts/Matter-SemiBold.otf') format('opentype');
    font-weight: normal;
    font-style: normal;
}

@font-face {
    font-family: 'Matter-Regular';
    src: url('/fonts/Matter-Regular.otf') format('opentype');
    font-weight: normal;
    font-style: normal;
}

.container {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    width: 100%;
    max-width: 560px;
    gap: 20px;
    padding-top: clamp(16px, 4vh, 48px);
}

.state-card {
    width: 100%;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 12px;
    padding: 32px 24px;
    text-align: center;
    box-shadow: 0 4px 15px rgba(108, 92, 231, 0.2);
}

.state-text {
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 1rem;
    color: #555;
    margin: 0 0 16px;
}

.back-button {
    display: inline-block;
    padding: 12px 24px;
    background: #1a1a1a;
    border-radius: 8px;
    text-decoration: none;
    color: white;
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 0.95rem;
    transition: background 0.3s ease;
}

.back-button:hover {
    background: #333;
}

.info-card {
    width: 100%;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 12px;
    padding: 20px 24px;
    box-shadow: 0 4px 15px rgba(108, 92, 231, 0.2);
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.info-row {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.info-label {
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 0.75rem;
    color: #999;
    text-transform: uppercase;
    letter-spacing: 1px;
}

.info-value {
    font-family: 'Matter-Regular', sans-serif;
    font-size: 0.95rem;
    color: #1a1a1a;
    word-break: break-word;
}

.info-value.mono {
    font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
    font-size: 0.85rem;
}

.section-heading {
    font-family: 'Matter-Heavy', sans-serif;
    font-size: 1.1rem;
    color: white;
    margin: 0 0 12px;
    letter-spacing: 1px;
    text-shadow: 0 2px 4px rgba(108, 92, 231, 0.3);
}

.items-card {
    width: 100%;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 12px;
    padding: 8px 24px;
    box-shadow: 0 4px 15px rgba(108, 92, 231, 0.2);
    display: flex;
    flex-direction: column;
}

.item-row {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 0;
    border-bottom: 1px solid #eee;
}

.item-row:last-child {
    border-bottom: none;
}

.item-thumb {
    width: 56px;
    height: 56px;
    flex-shrink: 0;
    border-radius: 8px;
    overflow: hidden;
    background: #f0f0f3;
}

.item-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}

.item-thumb-placeholder {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #ece9fb, #f6f5fc);
}

.item-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.item-title {
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 1rem;
    color: #1a1a1a;
}

.item-meta {
    font-family: 'Matter-Regular', sans-serif;
    font-size: 0.85rem;
    color: #777;
}

.item-price {
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 0.95rem;
    color: #1a1a1a;
    white-space: nowrap;
    flex-shrink: 0;
}

.timeline-card {
    width: 100%;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 12px;
    padding: 22px 24px;
    box-shadow: 0 4px 15px rgba(108, 92, 231, 0.2);
}

.timeline {
    list-style: none;
    margin: 0;
    padding: 0;
}

.timeline-step {
    position: relative;
    padding: 0 0 22px 28px;
}

.timeline-step:last-child {
    padding-bottom: 0;
}

/* Connecting line running down to the next step. */
.timeline-step::before {
    content: '';
    position: absolute;
    left: 6px;
    top: 16px;
    bottom: 0;
    width: 2px;
    background: #e5e3f0;
}

.timeline-step:last-child::before {
    display: none;
}

.timeline-step.done::before {
    background: #6c5ce7;
}

.timeline-marker {
    position: absolute;
    left: 0;
    top: 3px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #fff;
    border: 2px solid #d6d3e8;
    box-sizing: border-box;
}

.timeline-step.done .timeline-marker {
    background: #6c5ce7;
    border-color: #6c5ce7;
}

.timeline-step.current .timeline-marker {
    border-color: #6c5ce7;
    box-shadow: 0 0 0 4px rgba(108, 92, 231, 0.15);
}

.timeline-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.timeline-title {
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 1rem;
    color: #1a1a1a;
}

.timeline-step.upcoming .timeline-title {
    color: #9b97b0;
}

.timeline-sentence {
    font-family: 'Matter-Regular', sans-serif;
    font-size: 0.9rem;
    color: #555;
    line-height: 1.45;
}

.timeline-step.upcoming .timeline-sentence {
    color: #aaa;
}

.timeline-detail {
    font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
    font-size: 0.8rem;
    color: #6c5ce7;
    margin-top: 2px;
    word-break: break-word;
}

@media (max-width: 600px) {
    .page-title {
        font-size: 1.3rem;
    }
}
</style>
