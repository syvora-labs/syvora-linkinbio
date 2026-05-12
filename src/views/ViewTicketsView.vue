<script setup lang="ts">
import {ref, onMounted} from 'vue'
import {useRoute} from 'vue-router'
import {useSeoMeta} from '@unhead/vue'
import {supabase} from '@/supabase'
import QRCode from 'qrcode'

interface Event {
    title: string
    artwork_url: string
    location: string
    event_date: string
}

interface Order {
    id: string
    buyer_name: string
    status: string
    total_cents: number
    currency: string
    created_at: string
}

interface Ticket {
    id: string
    qr_token: string
    status: string
    checked_in_at: string | null
    phase_name: string
    qrDataUrl?: string
}

const route = useRoute()
const orderId = route.params.orderId as string

useSeoMeta({
    title: 'Your tickets | ECLIPSE BOUNDARIES',
    robots: 'noindex, nofollow',
})

const event = ref<Event | null>(null)
const order = ref<Order | null>(null)
const tickets = ref<Ticket[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

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

function formatPrice(cents: number): string {
    return `CHF ${(cents / 100).toFixed(2)}`
}

onMounted(async () => {
    try {
        const {data, error: fnError} = await supabase.functions.invoke(
            'get-order-tickets',
            {body: {order_id: orderId}},
        )

        if (fnError || !data?.order) {
            error.value = data?.error || 'Could not load tickets.'
            loading.value = false
            return
        }

        order.value = data.order
        event.value = data.event

        // Generate QR codes for each ticket
        const enrichedTickets: Ticket[] = []
        for (const ticket of data.tickets) {
            const qrDataUrl = await QRCode.toDataURL(ticket.qr_token, {
                width: 200,
                margin: 2,
                color: {
                    dark: '#1a1a1a',
                    light: '#ffffff',
                },
            })
            enrichedTickets.push({...ticket, qrDataUrl})
        }

        tickets.value = enrichedTickets
    } catch (e) {
        error.value = 'Something went wrong. Please try again.'
    } finally {
        loading.value = false
    }
})
</script>

<template>
    <div class="container">
        <router-link to="/" class="back-link">ECLIPSE BOUNDARIES</router-link>

        <div v-if="loading" class="status-card">
            <p class="status-text">Loading your tickets...</p>
        </div>

        <div v-else-if="error" class="status-card">
            <p class="status-text">{{ error }}</p>
            <router-link to="/" class="action-button">Back to home</router-link>
        </div>

        <template v-else-if="order && event">
            <div class="event-header">
                <img :src="event.artwork_url" :alt="event.title" class="event-cover" />
                <div class="event-info">
                    <h2 class="event-title">{{ event.title }}</h2>
                    <p class="event-detail">{{ event.location }}</p>
                    <p class="event-detail">{{ formatEventDate(event.event_date) }}</p>
                </div>
            </div>

            <div class="order-info">
                <div class="order-row">
                    <span>{{ order.buyer_name }}</span>
                    <span>{{ formatPrice(order.total_cents) }}</span>
                </div>
                <p class="ticket-count">{{ tickets.length }} ticket{{ tickets.length !== 1 ? 's' : '' }}</p>
            </div>

            <div class="tickets-section">
                <h3 class="section-heading">YOUR TICKETS</h3>
                <div
                    v-for="(ticket, index) in tickets"
                    :key="ticket.id"
                    class="ticket-card"
                    :class="{'checked-in': ticket.status === 'checked_in', 'cancelled': ticket.status === 'cancelled'}"
                >
                    <div class="ticket-header">
                        <span class="ticket-number">#{{ index + 1 }}</span>
                        <span class="ticket-phase">{{ ticket.phase_name }}</span>
                        <span v-if="ticket.status === 'checked_in'" class="ticket-badge badge-checked">Checked in</span>
                        <span v-else-if="ticket.status === 'cancelled'" class="ticket-badge badge-cancelled">Cancelled</span>
                    </div>
                    <div v-if="ticket.status === 'valid' && ticket.qrDataUrl" class="qr-container">
                        <img :src="ticket.qrDataUrl" :alt="`QR code for ticket #${index + 1}`" class="qr-code" />
                        <p class="qr-hint">Present this QR code at the door</p>
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
    text-shadow: 0 2px 4px rgba(108, 92, 231, 0.3);
    transition: opacity 0.3s ease;
}

.back-link:hover {
    opacity: 0.8;
}

.status-card {
    width: 100%;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 12px;
    padding: 32px 24px;
    text-align: center;
    box-shadow: 0 4px 15px rgba(108, 92, 231, 0.2);
}

.status-text {
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 1rem;
    color: #555;
    margin: 0 0 16px;
}

.action-button {
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

.action-button:hover {
    background: #333;
}

.event-header {
    width: 100%;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 15px rgba(108, 92, 231, 0.2);
}

.event-cover {
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    display: block;
}

.event-info {
    padding: 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.event-title {
    font-family: 'Matter-Heavy', sans-serif;
    font-size: 1.4rem;
    font-weight: 700;
    color: #1a1a1a;
    margin: 0;
}

.event-detail {
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 0.95rem;
    color: #555;
    margin: 0;
}

.order-info {
    width: 100%;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 12px;
    padding: 16px 24px;
    box-shadow: 0 4px 15px rgba(108, 92, 231, 0.2);
}

.order-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 1rem;
    color: #1a1a1a;
}

.ticket-count {
    font-family: 'Matter-Regular', sans-serif;
    font-size: 0.85rem;
    color: #777;
    margin: 4px 0 0;
}

.tickets-section {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.section-heading {
    font-family: 'Matter-Heavy', sans-serif;
    font-size: 1.1rem;
    font-weight: 700;
    color: white;
    margin: 0;
    letter-spacing: 2px;
    text-shadow: 0 2px 4px rgba(108, 92, 231, 0.3);
}

.ticket-card {
    width: 100%;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 12px;
    padding: 20px 24px;
    box-shadow: 0 4px 15px rgba(108, 92, 231, 0.2);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
}

.ticket-card.checked-in {
    opacity: 0.6;
}

.ticket-card.cancelled {
    opacity: 0.4;
}

.ticket-header {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
}

.ticket-number {
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 0.85rem;
    color: #999;
}

.ticket-phase {
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 1rem;
    color: #1a1a1a;
    flex: 1;
}

.ticket-badge {
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 0.75rem;
    padding: 4px 10px;
    border-radius: 20px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.badge-checked {
    background: #e8f5e9;
    color: #2e7d32;
}

.badge-cancelled {
    background: #fce4ec;
    color: #c62828;
}

.qr-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
}

.qr-code {
    width: 200px;
    height: 200px;
    border-radius: 8px;
}

.qr-hint {
    font-family: 'Matter-Regular', sans-serif;
    font-size: 0.8rem;
    color: #999;
    margin: 0;
}

@media (max-width: 600px) {
    .container {
        gap: 20px;
    }

    .back-link {
        font-size: 1.3rem;
    }

    .event-title {
        font-size: 1.2rem;
    }

    .event-info {
        padding: 16px 20px;
    }

    .ticket-card {
        padding: 16px 20px;
    }
}
</style>
