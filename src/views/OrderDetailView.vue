<script setup lang="ts">
import {ref, onMounted} from 'vue'
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

const order = ref<OrderDetails | null>(null)
const imageUrls = ref<Record<string, string>>({})
const loading = ref(true)
const error = ref<string | null>(null)

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
        <div class="shop-header">
            <router-link to="/shop" class="back-link">&#8592; Shop</router-link>
        </div>

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
                <div class="info-row">
                    <span class="info-label">Tracking number</span>
                    <span v-if="order.tracking_number" class="info-value mono">{{ order.tracking_number }}</span>
                    <span v-else class="info-value muted">Not yet available — added when your order ships</span>
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
}

.shop-header {
    display: flex;
    align-items: center;
}

.back-link {
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 1rem;
    color: white;
    text-decoration: none;
    text-shadow: 0 2px 4px rgba(108, 92, 231, 0.3);
    transition: opacity 0.3s ease;
}

.back-link:hover {
    opacity: 0.8;
}

.page-title {
    font-family: 'Matter-Heavy', sans-serif;
    font-size: 1.6rem;
    color: white;
    margin: 0;
    letter-spacing: 1px;
    text-shadow: 0 2px 4px rgba(108, 92, 231, 0.3);
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

.info-value.muted {
    color: #999;
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

@media (max-width: 600px) {
    .page-title {
        font-size: 1.3rem;
    }
}
</style>
