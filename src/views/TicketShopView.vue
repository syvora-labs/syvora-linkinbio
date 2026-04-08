<script setup lang="ts">
import {ref, computed, onMounted} from 'vue'
import {useRoute} from 'vue-router'
import {supabase} from '@/supabase'

interface Event {
    id: string
    title: string
    artwork_url: string
    location: string
    event_date: string
}

interface TicketPhase {
    id: string
    name: string
    description: string | null
    price_cents: number
    currency: string
    quantity: number
    sold_count: number
    remaining: number
    sale_start: string | null
    sale_end: string | null
}

interface PhaseSelection {
    phaseId: string
    quantity: number
}

const route = useRoute()
const eventId = route.params.eventId as string

const event = ref<Event | null>(null)
const phases = ref<TicketPhase[]>([])
const loading = ref(true)
const checkoutLoading = ref(false)
const error = ref<string | null>(null)

const selections = ref<Map<string, number>>(new Map())

const buyerName = ref('')
const buyerEmail = ref('')
const buyerBirthdate = ref('')
const buyerCountry = ref('')
const buyerZipcode = ref('')
const buyerCity = ref('')

const SERVICE_FEE_CENTS = 150

const subtotalCents = computed(() => {
    let total = 0
    for (const phase of phases.value) {
        const qty = selections.value.get(phase.id) || 0
        total += phase.price_cents * qty
    }
    return total
})

const totalItems = computed(() => {
    let count = 0
    for (const qty of selections.value.values()) {
        count += qty
    }
    return count
})

const serviceFeeCents = computed(() => totalItems.value * SERVICE_FEE_CENTS)

const totalCents = computed(() => subtotalCents.value + serviceFeeCents.value)

const emailTouched = ref(false)

const isValidEmail = computed(() => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail.value.trim())
})

const emailError = computed(() => {
    if (!emailTouched.value || !buyerEmail.value.trim()) return ''
    return isValidEmail.value ? '' : 'Please enter a valid email address'
})

const canCheckout = computed(() => {
    return totalItems.value > 0
        && buyerName.value.trim()
        && isValidEmail.value
        && buyerBirthdate.value
        && buyerCountry.value.trim()
        && buyerZipcode.value.trim()
        && buyerCity.value.trim()
})

function formatPrice(cents: number): string {
    return `CHF ${(cents / 100).toFixed(2)}`
}

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

function getQuantity(phaseId: string): number {
    return selections.value.get(phaseId) || 0
}

function updateQuantity(phaseId: string, delta: number) {
    const phase = phases.value.find(p => p.id === phaseId)
    if (!phase) return

    const current = getQuantity(phaseId)
    const next = Math.max(0, Math.min(phase.remaining, current + delta))

    const updated = new Map(selections.value)
    if (next === 0) {
        updated.delete(phaseId)
    } else {
        updated.set(phaseId, next)
    }
    selections.value = updated
}

onMounted(async () => {
    try {
        // Fetch event details
        const {data: eventData, error: eventError} = await supabase
            .from('events')
            .select('id, title, artwork_url, location, event_date')
            .eq('id', eventId)
            .single()

        if (eventError || !eventData) {
            error.value = 'Event not found.'
            loading.value = false
            return
        }

        event.value = eventData

        // Fetch ticket phases via edge function
        const {data: fnData, error: fnError} = await supabase.functions.invoke(
            'get-ticket-phases',
            {body: {event_id: eventId}},
        )

        if (fnError) {
            error.value = 'Could not load ticket information.'
            loading.value = false
            return
        }

        phases.value = fnData.phases ?? []
    } catch (e) {
        error.value = 'Something went wrong. Please try again.'
    } finally {
        loading.value = false
    }
})

async function handleCheckout() {
    if (!canCheckout.value) return

    checkoutLoading.value = true
    error.value = null

    try {
        const items: PhaseSelection[] = []
        for (const [phaseId, quantity] of selections.value.entries()) {
            if (quantity > 0) {
                items.push({phaseId, quantity})
            }
        }

        const {data, error: fnError} = await supabase.functions.invoke(
            'create-checkout',
            {
                body: {
                    event_id: eventId,
                    items,
                    buyer_name: buyerName.value.trim(),
                    buyer_email: buyerEmail.value.trim(),
                    buyer_birthdate: buyerBirthdate.value,
                    buyer_country: buyerCountry.value.trim(),
                    buyer_zipcode: buyerZipcode.value.trim(),
                    buyer_city: buyerCity.value.trim(),
                    service_fee_cents: SERVICE_FEE_CENTS,
                    success_url: `${window.location.origin}/event/${eventId}/tickets/success?session_id={CHECKOUT_SESSION_ID}`,
                    cancel_url: window.location.href,
                },
            },
        )

        if (fnError || !data?.checkout_url) {
            error.value = data?.error || 'Could not create checkout session.'
            checkoutLoading.value = false
            return
        }

        window.location.href = data.checkout_url
    } catch (e) {
        error.value = 'Something went wrong. Please try again.'
        checkoutLoading.value = false
    }
}
</script>

<template>
    <div class="container">
        <router-link to="/" class="back-link">ECLIPSE BOUNDARIES</router-link>

        <div v-if="loading" class="loading-card">
            <p class="loading-text">Loading tickets...</p>
        </div>

        <div v-else-if="error && !event" class="error-card">
            <p class="error-text">{{ error }}</p>
            <router-link to="/" class="back-button">Back to home</router-link>
        </div>

        <template v-else-if="event">
            <div class="event-header">
                <img :src="event.artwork_url" :alt="event.title" class="event-cover" />
                <div class="event-info">
                    <h2 class="event-title">{{ event.title }}</h2>
                    <p class="event-location">{{ event.location }}</p>
                    <p class="event-date">{{ formatEventDate(event.event_date) }}</p>
                </div>
            </div>

            <div v-if="phases.length === 0" class="no-tickets-card">
                <p class="no-tickets-text">Tickets are not yet available for this event.</p>
                <router-link to="/" class="back-button">Back to home</router-link>
            </div>

            <template v-else>
                <div class="phases-section">
                    <h3 class="section-heading">TICKETS</h3>
                    <div
                        v-for="phase in phases"
                        :key="phase.id"
                        class="phase-card"
                        :class="{'sold-out': phase.remaining <= 0}"
                    >
                        <div class="phase-header">
                            <div class="phase-name-price">
                                <span class="phase-name">{{ phase.name }}</span>
                                <span class="phase-price">{{ formatPrice(phase.price_cents) }}</span>
                            </div>
                            <p v-if="phase.description" class="phase-description">{{ phase.description }}</p>
                            <p v-if="phase.remaining <= 0" class="phase-availability">
                                Sold out
                            </p>
                        </div>
                        <div v-if="phase.remaining > 0" class="quantity-selector">
                            <button
                                class="qty-btn"
                                :disabled="getQuantity(phase.id) <= 0"
                                @click="updateQuantity(phase.id, -1)"
                            >
                                -
                            </button>
                            <span class="qty-value">{{ getQuantity(phase.id) }}</span>
                            <button
                                class="qty-btn"
                                :disabled="getQuantity(phase.id) >= phase.remaining"
                                @click="updateQuantity(phase.id, 1)"
                            >
                                +
                            </button>
                        </div>
                    </div>
                </div>

                <div v-if="totalItems > 0" class="buyer-section">
                    <h3 class="section-heading">YOUR DETAILS</h3>
                    <div class="form-group">
                        <input
                            v-model="buyerName"
                            type="text"
                            placeholder="Full Name"
                            class="form-input"
                        />
                    </div>
                    <div class="form-group">
                        <input
                            v-model="buyerEmail"
                            type="email"
                            placeholder="Email Address"
                            class="form-input"
                            :class="{'input-error': emailError}"
                            @blur="emailTouched = true"
                        />
                        <p v-if="emailError" class="field-error">{{ emailError }}</p>
                    </div>
                    <div class="form-group">
                        <input
                            v-model="buyerBirthdate"
                            type="date"
                            placeholder="Date of Birth"
                            class="form-input"
                            :class="{'placeholder-visible': !buyerBirthdate}"
                        />
                    </div>
                    <div class="form-group">
                        <input
                            v-model="buyerCountry"
                            type="text"
                            placeholder="Country"
                            class="form-input"
                        />
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <input
                                v-model="buyerZipcode"
                                type="text"
                                placeholder="Zip Code"
                                class="form-input"
                            />
                        </div>
                        <div class="form-group">
                            <input
                                v-model="buyerCity"
                                type="text"
                                placeholder="City"
                                class="form-input"
                            />
                        </div>
                    </div>
                </div>

                <div v-if="totalItems > 0" class="order-summary">
                    <h3 class="section-heading summary-heading">SUMMARY</h3>
                    <div class="summary-card">
                        <div
                            v-for="phase in phases"
                            :key="'summary-' + phase.id"
                            class="summary-row"
                        >
                            <template v-if="getQuantity(phase.id) > 0">
                                <span>{{ getQuantity(phase.id) }}x {{ phase.name }}</span>
                                <span>{{ formatPrice(phase.price_cents * getQuantity(phase.id)) }}</span>
                            </template>
                        </div>
                        <div class="summary-row summary-fee">
                            <span>Service fees ({{ totalItems }}x {{ formatPrice(SERVICE_FEE_CENTS) }})</span>
                            <span>{{ formatPrice(serviceFeeCents) }}</span>
                        </div>
                        <div class="summary-divider"></div>
                        <div class="summary-row summary-total-row">
                            <span>Total</span>
                            <span class="summary-total">{{ formatPrice(totalCents) }}</span>
                        </div>
                    </div>
                </div>

                <p v-if="error" class="error-message">{{ error }}</p>

                <button
                    v-if="totalItems > 0"
                    class="checkout-button"
                    :disabled="!canCheckout || checkoutLoading"
                    @click="handleCheckout"
                >
                    {{ checkoutLoading ? 'Redirecting...' : `PAY ${formatPrice(totalCents)}` }}
                </button>
            </template>
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
    text-shadow: 0 2px 4px rgba(115, 195, 254, 0.3);
    transition: opacity 0.3s ease;
}

.back-link:hover {
    opacity: 0.8;
}

.loading-card,
.error-card,
.no-tickets-card {
    width: 100%;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 12px;
    padding: 32px 24px;
    text-align: center;
    box-shadow: 0 4px 15px rgba(115, 195, 254, 0.2);
}

.loading-text,
.error-text,
.no-tickets-text {
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

.event-header {
    width: 100%;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 15px rgba(115, 195, 254, 0.2);
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

.event-location,
.event-date {
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 0.95rem;
    color: #555;
    margin: 0;
}

.phases-section {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.section-heading {
    font-family: 'Matter-Heavy', sans-serif;
    font-size: 1.1rem;
    font-weight: 700;
    color: white;
    margin: 0;
    letter-spacing: 2px;
    text-shadow: 0 2px 4px rgba(115, 195, 254, 0.3);
}

.phase-card {
    width: 100%;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 12px;
    padding: 20px 24px;
    box-shadow: 0 4px 15px rgba(115, 195, 254, 0.2);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
}

.phase-card.sold-out {
    opacity: 0.5;
}

.phase-header {
    flex: 1;
    min-width: 0;
}

.phase-name-price {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
}

.phase-name {
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 1.1rem;
    font-weight: 600;
    color: #1a1a1a;
}

.phase-price {
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 1rem;
    color: #1a1a1a;
    white-space: nowrap;
}

.phase-description {
    font-family: 'Matter-Regular', sans-serif;
    font-size: 0.85rem;
    color: #777;
    margin: 4px 0 0;
}

.phase-availability {
    font-family: 'Matter-Regular', sans-serif;
    font-size: 0.8rem;
    color: #999;
    margin: 4px 0 0;
}

.quantity-selector {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
}

.qty-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 2px solid #1a1a1a;
    background: transparent;
    color: #1a1a1a;
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 1.2rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
}

.qty-btn:hover:not(:disabled) {
    background: #1a1a1a;
    color: white;
}

.qty-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
}

.qty-value {
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 1.1rem;
    color: #1a1a1a;
    min-width: 24px;
    text-align: center;
}

.buyer-section {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.form-row {
    display: flex;
    gap: 12px;
    width: 100%;
}

.form-row .form-group {
    flex: 1;
}

.form-group {
    width: 100%;
}

.form-input {
    width: 100%;
    padding: 14px 20px;
    background: rgba(255, 255, 255, 0.95);
    border: none;
    border-radius: 8px;
    font-family: 'Matter-Regular', sans-serif;
    font-size: 1rem;
    color: #1a1a1a;
    box-shadow: 0 4px 15px rgba(115, 195, 254, 0.2);
    outline: none;
    transition: box-shadow 0.3s ease;
}

.form-input::placeholder {
    color: #999;
}

.form-input:focus {
    box-shadow: 0 4px 20px rgba(115, 195, 254, 0.4);
}

.form-input.input-error {
    box-shadow: 0 0 0 2px #e74c3c, 0 4px 15px rgba(115, 195, 254, 0.2);
}

.field-error {
    font-family: 'Matter-Regular', sans-serif;
    font-size: 0.8rem;
    color: #e74c3c;
    margin: 6px 0 0;
}

.form-input[type="date"] {
    -webkit-appearance: none;
}

.form-input.placeholder-visible {
    color: #999;
}

.summary-heading {
    margin-bottom: 4px;
}

.order-summary {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.summary-card {
    width: 100%;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 12px;
    padding: 16px 24px;
    box-shadow: 0 4px 15px rgba(115, 195, 254, 0.2);
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.summary-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-family: 'Matter-Regular', sans-serif;
    font-size: 0.95rem;
    color: #1a1a1a;
}

.summary-fee {
    color: #777;
    font-size: 0.9rem;
}

.summary-divider {
    height: 1px;
    background: #eee;
    margin: 4px 0;
}

.summary-total-row {
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 1rem;
}

.summary-total {
    font-family: 'Matter-Heavy', sans-serif;
    font-size: 1.2rem;
}

.error-message {
    font-family: 'Matter-Regular', sans-serif;
    font-size: 0.9rem;
    color: #e74c3c;
    text-align: center;
    margin: 0;
}

.checkout-button {
    width: 100%;
    padding: 16px;
    background: #1a1a1a;
    border: none;
    border-radius: 8px;
    color: white;
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 1.1rem;
    text-align: center;
    cursor: pointer;
    transition: background 0.3s ease;
}

.checkout-button:hover:not(:disabled) {
    background: #333;
}

.checkout-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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

    .phase-card {
        padding: 16px 20px;
        flex-direction: column;
        align-items: stretch;
    }

    .quantity-selector {
        justify-content: center;
        margin-top: 8px;
    }

    .phase-name-price {
        flex-direction: column;
        gap: 2px;
    }

    .checkout-button {
        padding: 14px;
        font-size: 1rem;
    }
}
</style>
