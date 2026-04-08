<script setup lang="ts">
import {ref, onMounted} from 'vue'
import {useRoute} from 'vue-router'
import {supabase} from '@/supabase'

interface Event {
    title: string
    artwork_url: string
    location: string
    event_date: string
}

const route = useRoute()
const eventId = route.params.eventId as string
const sessionId = route.query.session_id as string | undefined

const orderId = ref(route.query.order_id as string | undefined)

const event = ref<Event | null>(null)
const loading = ref(true)

onMounted(async () => {
    try {
        const {data} = await supabase
            .from('events')
            .select('title, artwork_url, location, event_date')
            .eq('id', eventId)
            .single()

        if (data) {
            event.value = data
        }

        // If order_id not in URL, look it up by session_id
        if (!orderId.value && sessionId) {
            const {data: orderData} = await supabase.functions.invoke(
                'get-order-tickets',
                {body: {session_id: sessionId}},
            )
            if (orderData?.order?.id) {
                orderId.value = orderData.order.id
            }
        }
    } finally {
        loading.value = false
    }
})

function formatEventDate(dateStr: string): string {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}
</script>

<template>
    <div class="container">
        <router-link to="/" class="back-link">ECLIPSE BOUNDARIES</router-link>

        <div class="success-card">
            <div class="check-icon">&#10003;</div>
            <h2 class="success-title">Payment Successful</h2>
            <p class="success-text">
                Your tickets have been confirmed. You will receive a confirmation email shortly.
            </p>

            <template v-if="event">
                <div class="event-summary">
                    <p class="event-name">{{ event.title }}</p>
                    <p class="event-detail">{{ event.location }}</p>
                    <p class="event-detail">{{ formatEventDate(event.event_date) }}</p>
                </div>
            </template>

            <router-link
                v-if="orderId"
                :to="{name: 'view-tickets', params: {orderId}}"
                class="home-button"
            >
                VIEW YOUR TICKETS
            </router-link>
            <router-link to="/" class="home-button secondary">
                BACK TO HOME
            </router-link>
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
}

.back-link {
    font-family: 'Matter-Heavy', sans-serif;
    font-size: 1.6rem;
    font-weight: 700;
    letter-spacing: 3px;
    text-align: left;
    align-self: flex-start;
    color: white;
    text-decoration: none;
    text-transform: uppercase;
    text-shadow: 0 2px 4px rgba(115, 195, 254, 0.3);
    transition: opacity 0.3s ease;
}

.back-link:hover {
    opacity: 0.8;
}

.success-card {
    width: 100%;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 12px;
    padding: 40px 24px;
    text-align: center;
    box-shadow: 0 4px 15px rgba(115, 195, 254, 0.2);
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

.success-title {
    font-family: 'Matter-Heavy', sans-serif;
    font-size: 1.4rem;
    font-weight: 700;
    color: #1a1a1a;
    margin: 0;
}

.success-text {
    font-family: 'Matter-Regular', sans-serif;
    font-size: 0.95rem;
    color: #555;
    margin: 0;
    max-width: 320px;
}

.event-summary {
    padding: 16px 0;
    border-top: 1px solid #eee;
    width: 100%;
}

.event-name {
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 1.1rem;
    color: #1a1a1a;
    margin: 0 0 4px;
}

.event-detail {
    font-family: 'Matter-Regular', sans-serif;
    font-size: 0.9rem;
    color: #777;
    margin: 0;
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
