<script setup lang="ts">
import {ref, onMounted, onUnmounted} from 'vue'
import {useRoute} from 'vue-router'
import {useSeoMeta} from '@unhead/vue'
import {supabase} from '@/supabase'
import {useCart} from '@/composables/useCart'

useSeoMeta({
    title: 'Order confirmed | ECLIPSE BOUNDARIES',
    robots: 'noindex, nofollow',
})

const route = useRoute()
const sessionId = route.query.session_id as string | undefined

const {clear} = useCart()

type OrderStatus = 'pending' | 'paid' | 'fulfilled' | 'cancelled' | 'refunded'
const status = ref<OrderStatus | null>(null)
const orderId = ref<string | null>(null)
const settled = ref(false)
const error = ref(false)

let timer: ReturnType<typeof setTimeout> | null = null
let attempts = 0
const MAX_ATTEMPTS = 15 // ~30s of polling

// The Stripe success redirect fires before the webhook lands, so the order may
// still be `pending` for a few seconds. Poll the status edge function until it
// settles (or we give up and show a soft "processing" message).
async function poll() {
    if (!sessionId) {
        error.value = true
        return
    }
    try {
        const {data} = await supabase.functions.invoke('webshop-order-status', {
            body: {session_id: sessionId},
        })
        if (data?.id) orderId.value = data.id
        if (data?.status) {
            status.value = data.status
            if (data.status !== 'pending') {
                settled.value = true
                clear()
                return
            }
        }
    } catch {
        // Swallow and retry — transient errors shouldn't stop the poll.
    }

    attempts += 1
    if (attempts >= MAX_ATTEMPTS) {
        // Payment almost certainly succeeded; the webhook is just slow. Clear
        // the cart and show the optimistic confirmation.
        settled.value = true
        clear()
        return
    }
    timer = setTimeout(poll, 2000)
}

onMounted(poll)
onUnmounted(() => {
    if (timer) clearTimeout(timer)
})
</script>

<template>
    <div class="container">
        <div class="success-card">
            <template v-if="error">
                <h2 class="success-title">Missing order reference</h2>
                <p class="success-text">We couldn't find your order. If you were charged, please contact us.</p>
            </template>

            <template v-else-if="!settled">
                <div class="spinner"></div>
                <h2 class="success-title">Processing your payment…</h2>
                <p class="success-text">This usually takes just a few seconds.</p>
            </template>

            <template v-else-if="status === 'refunded'">
                <h2 class="success-title">Order refunded</h2>
                <p class="success-text">
                    An item sold out while you were checking out, so your payment was refunded.
                    Nothing was charged.
                </p>
            </template>

            <template v-else>
                <div class="check-icon">&#10003;</div>
                <h2 class="success-title">Order confirmed</h2>
                <p class="success-text">
                    Thank you for your order. You'll receive a confirmation email shortly.
                </p>
            </template>

            <router-link
                v-if="settled && status !== 'refunded' && orderId"
                :to="{name: 'shop-order', params: {orderId}}"
                class="home-button"
            >
                VIEW ORDER DETAILS
            </router-link>
            <router-link to="/shop" class="home-button secondary">BACK TO SHOP</router-link>
            <router-link to="/" class="home-button secondary">BACK TO HOME</router-link>
        </div>
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
    align-items: center;
    width: 100%;
    max-width: 500px;
    gap: 24px;
    padding-top: clamp(32px, 10vh, 96px);
}

.success-card {
    width: 100%;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 12px;
    padding: 40px 24px;
    text-align: center;
    box-shadow: 0 4px 15px rgba(108, 92, 231, 0.2);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
}

.check-icon {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: #1a1a1a;
    color: white;
    font-size: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
}

.spinner {
    width: 48px;
    height: 48px;
    border: 4px solid #ece9fb;
    border-top-color: #6C5CE7;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.success-title {
    font-family: 'Matter-Heavy', sans-serif;
    font-size: 1.4rem;
    color: #1a1a1a;
    margin: 0;
}

.success-text {
    font-family: 'Matter-Regular', sans-serif;
    font-size: 0.95rem;
    color: #555;
    margin: 0;
    max-width: 340px;
}

.home-button {
    display: inline-block;
    padding: 14px 32px;
    background: #1a1a1a;
    border-radius: 8px;
    text-decoration: none;
    color: white;
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 1rem;
    transition: background 0.3s ease;
    margin-top: 8px;
}

.home-button:hover {
    background: #333;
}

.home-button.secondary {
    background: transparent;
    color: #777;
    padding: 8px 32px;
    font-size: 0.9rem;
    margin-top: 0;
}

.home-button.secondary:hover {
    color: #1a1a1a;
    background: transparent;
}

@media (max-width: 600px) {
    .back-link {
        font-size: 1.3rem;
    }

    .success-card {
        padding: 32px 20px;
    }

    .success-title {
        font-size: 1.2rem;
    }
}
</style>
