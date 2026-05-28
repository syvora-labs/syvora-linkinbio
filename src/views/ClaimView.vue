<script setup lang="ts">
import {ref, computed, onMounted, nextTick, watch} from 'vue'
import {useRoute} from 'vue-router'
import {useSeoMeta} from '@unhead/vue'
import {supabase} from '@/supabase'
import {COUNTRIES} from '@/data/countries'

type ViewState = 'loading' | 'ready' | 'claims_paused' | 'not_recognised' | 'error' | 'claimed'

interface TicketResolve {
    phaseName: string
    eventTitle: string
    eventLocation: string
    eventDate: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const route = useRoute()
const qrToken = (route.params.qrToken as string)?.toLowerCase() ?? ''

useSeoMeta({
    title: 'Claim your ticket | ECLIPSE BOUNDARIES',
    robots: 'noindex, nofollow',
})

const state = ref<ViewState>('loading')
const ticket = ref<TicketResolve | null>(null)
const submitError = ref<string | null>(null)
const submitting = ref(false)

const buyerName = ref('')
const buyerEmail = ref('')
const buyerBirthdate = ref('')
const buyerCountry = ref('')
const buyerZipcode = ref('')
const buyerCity = ref('')

const countryQuery = ref('')
const countryOpen = ref(false)
const countryHighlight = ref(0)
const countryListEl = ref<HTMLDivElement | null>(null)

const filteredCountries = computed(() => {
    const q = countryQuery.value.trim().toLowerCase()
    if (!q) return COUNTRIES
    const starts: string[] = []
    const contains: string[] = []
    for (const c of COUNTRIES) {
        const lc = c.toLowerCase()
        if (lc.startsWith(q)) starts.push(c)
        else if (lc.includes(q)) contains.push(c)
    }
    return [...starts, ...contains]
})

watch(filteredCountries, () => {
    countryHighlight.value = 0
})

function openCountryDropdown() {
    countryOpen.value = true
    countryHighlight.value = 0
}

function selectCountry(name: string) {
    buyerCountry.value = name
    countryQuery.value = name
    countryOpen.value = false
}

function onCountryInput(e: InputEvent) {
    const value = (e.target as HTMLInputElement).value
    countryQuery.value = value
    buyerCountry.value = ''
    countryOpen.value = true
}

function onCountryBlur() {
    setTimeout(() => {
        countryOpen.value = false
        const exact = COUNTRIES.find(c => c.toLowerCase() === countryQuery.value.trim().toLowerCase())
        if (exact) {
            buyerCountry.value = exact
            countryQuery.value = exact
        } else if (!buyerCountry.value) {
            countryQuery.value = ''
        }
    }, 150)
}

function onCountryKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (!countryOpen.value) {
            countryOpen.value = true
            return
        }
        const max = filteredCountries.value.length - 1
        countryHighlight.value = Math.min(max, countryHighlight.value + 1)
        scrollHighlightedIntoView()
    } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        countryHighlight.value = Math.max(0, countryHighlight.value - 1)
        scrollHighlightedIntoView()
    } else if (e.key === 'Enter') {
        if (countryOpen.value) {
            const choice = filteredCountries.value[countryHighlight.value]
            if (choice) {
                e.preventDefault()
                selectCountry(choice)
            }
        }
    } else if (e.key === 'Escape') {
        countryOpen.value = false
    }
}

function scrollHighlightedIntoView() {
    nextTick(() => {
        const list = countryListEl.value
        if (!list) return
        const item = list.children[countryHighlight.value] as HTMLElement | undefined
        item?.scrollIntoView({block: 'nearest'})
    })
}

const emailTouched = ref(false)

const isValidEmail = computed(() => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail.value.trim())
})

const emailError = computed(() => {
    if (!emailTouched.value || !buyerEmail.value.trim()) return ''
    return isValidEmail.value ? '' : 'Please enter a valid email address'
})

const canSubmit = computed(() => {
    return buyerName.value.trim()
        && isValidEmail.value
        && buyerBirthdate.value
        && buyerCountry.value.trim()
        && buyerZipcode.value.trim()
        && buyerCity.value.trim()
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

onMounted(async () => {
    if (!UUID_RE.test(qrToken)) {
        state.value = 'not_recognised'
        return
    }

    try {
        const {data, error} = await supabase
            .from('tickets')
            .select('id, status, ticket_phases!inner(name, is_active), events!inner(title, location, event_date)')
            .eq('qr_token', qrToken)
            .maybeSingle()

        if (error) {
            console.error('Ticket resolve error:', error)
            state.value = 'error'
            return
        }

        if (!data) {
            // Anon RLS filters out non-unclaimed or non-free-phase tickets.
            // We can't distinguish "already claimed" from "unknown" — and the
            // spec deliberately keeps them indistinguishable.
            state.value = 'not_recognised'
            return
        }

        const phase = Array.isArray(data.ticket_phases) ? data.ticket_phases[0] : data.ticket_phases
        const event = Array.isArray(data.events) ? data.events[0] : data.events

        if (!phase || !event) {
            state.value = 'not_recognised'
            return
        }

        ticket.value = {
            phaseName: phase.name,
            eventTitle: event.title,
            eventLocation: event.location,
            eventDate: event.event_date,
        }

        state.value = phase.is_active === false ? 'claims_paused' : 'ready'
    } catch (e) {
        console.error('Ticket resolve threw:', e)
        state.value = 'error'
    }
})

async function handleSubmit() {
    if (!canSubmit.value || submitting.value) return

    submitting.value = true
    submitError.value = null

    try {
        const {data, error: fnError} = await supabase.functions.invoke(
            'claim-free-ticket',
            {
                body: {
                    qr_token: qrToken,
                    buyer_name: buyerName.value.trim(),
                    buyer_email: buyerEmail.value.trim().toLowerCase(),
                    buyer_birthdate: buyerBirthdate.value,
                    buyer_country: buyerCountry.value.trim(),
                    buyer_zipcode: buyerZipcode.value.trim(),
                    buyer_city: buyerCity.value.trim(),
                },
            },
        )

        if (fnError || data?.error) {
            const code = data?.error ?? 'internal_error'
            if (code === 'ticket_already_claimed') {
                state.value = 'not_recognised'
                return
            }
            if (code === 'ticket_not_found' || code === 'ticket_not_claimable') {
                state.value = 'not_recognised'
                return
            }
            if (code === 'claims_paused') {
                state.value = 'claims_paused'
                return
            }
            if (code === 'invalid_input') {
                submitError.value = 'Some details are missing or invalid. Please check the form and try again.'
                submitting.value = false
                return
            }
            submitError.value = 'Something went wrong. Please try again.'
            submitting.value = false
            return
        }

        state.value = 'claimed'
    } catch (e) {
        submitError.value = 'Something went wrong. Please try again.'
        submitting.value = false
    }
}
</script>

<template>
    <div class="container">
        <router-link to="/" class="back-link">ECLIPSE BOUNDARIES</router-link>

        <div v-if="state === 'loading'" class="loading-card">
            <p class="loading-text">Loading...</p>
        </div>

        <div v-else-if="state === 'not_recognised'" class="info-card">
            <h2 class="info-title">This ticket isn't available</h2>
            <p class="info-text">
                It may have already been claimed, or the link is invalid. If you think this is a
                mistake, please contact the organiser.
            </p>
            <router-link to="/" class="primary-button">Back to home</router-link>
        </div>

        <div v-else-if="state === 'claims_paused'" class="info-card">
            <h2 class="info-title">Claims are paused</h2>
            <p class="info-text">
                Claims for this ticket are paused right now. Please try again later or contact the
                organiser.
            </p>
            <router-link to="/" class="primary-button">Back to home</router-link>
        </div>

        <div v-else-if="state === 'error'" class="info-card">
            <h2 class="info-title">Something went wrong</h2>
            <p class="info-text">
                We couldn't load this ticket. Please refresh the page or try again later.
            </p>
            <router-link to="/" class="primary-button">Back to home</router-link>
        </div>

        <div v-else-if="state === 'claimed' && ticket" class="info-card">
            <div class="check-icon">&#10003;</div>
            <h2 class="info-title">Your ticket is locked in</h2>
            <p class="info-text">
                A confirmation email is on its way to {{ buyerEmail }}. The paper strip and the
                digital ticket both work at the door.
            </p>
            <div class="event-summary">
                <p class="event-name">{{ ticket.eventTitle }}</p>
                <p class="event-detail">{{ ticket.phaseName }}</p>
                <p class="event-detail">{{ ticket.eventLocation }}</p>
                <p class="event-detail">{{ formatEventDate(ticket.eventDate) }}</p>
            </div>
            <router-link to="/" class="primary-button">Back to home</router-link>
        </div>

        <template v-else-if="state === 'ready' && ticket">
            <div class="event-card">
                <h2 class="event-title">{{ ticket.eventTitle }}</h2>
                <p class="event-detail">{{ ticket.eventLocation }}</p>
                <p class="event-detail">{{ formatEventDate(ticket.eventDate) }}</p>
                <div class="phase-badge">{{ ticket.phaseName }}</div>
            </div>

            <div class="buyer-section">
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
                <div class="form-group country-group">
                    <input
                        :value="countryQuery"
                        type="text"
                        placeholder="Country"
                        class="form-input"
                        autocomplete="off"
                        role="combobox"
                        aria-autocomplete="list"
                        :aria-expanded="countryOpen"
                        @input="onCountryInput"
                        @focus="openCountryDropdown"
                        @blur="onCountryBlur"
                        @keydown="onCountryKeydown"
                    />
                    <div
                        v-if="countryOpen && filteredCountries.length > 0"
                        ref="countryListEl"
                        class="country-dropdown"
                        role="listbox"
                    >
                        <button
                            v-for="(name, idx) in filteredCountries"
                            :key="name"
                            type="button"
                            class="country-option"
                            :class="{'highlighted': idx === countryHighlight}"
                            role="option"
                            :aria-selected="idx === countryHighlight"
                            @mousedown.prevent="selectCountry(name)"
                            @mouseenter="countryHighlight = idx"
                        >
                            {{ name }}
                        </button>
                    </div>
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

            <p class="claim-note">
                We'll email your ticket QR to the address above. The paper strip and the digital
                ticket both work at the door.
            </p>

            <p v-if="submitError" class="error-message">{{ submitError }}</p>

            <button
                class="primary-button submit-button"
                :disabled="!canSubmit || submitting"
                @click="handleSubmit"
            >
                {{ submitting ? 'Claiming...' : 'CLAIM TICKET' }}
            </button>
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

.loading-card,
.info-card {
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

.loading-text {
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 1rem;
    color: #555;
    margin: 0;
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

.info-title {
    font-family: 'Matter-Heavy', sans-serif;
    font-size: 1.4rem;
    font-weight: 700;
    color: #1a1a1a;
    margin: 0;
}

.info-text {
    font-family: 'Matter-Regular', sans-serif;
    font-size: 0.95rem;
    color: #555;
    margin: 0;
    max-width: 360px;
    line-height: 1.4;
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

.event-card {
    width: 100%;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 12px;
    padding: 20px 24px;
    box-shadow: 0 4px 15px rgba(108, 92, 231, 0.2);
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.event-title {
    font-family: 'Matter-Heavy', sans-serif;
    font-size: 1.4rem;
    font-weight: 700;
    color: #1a1a1a;
    margin: 0 0 4px;
}

.event-card .event-detail {
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 0.95rem;
    color: #555;
}

.phase-badge {
    align-self: flex-start;
    font-family: 'Matter-Heavy', sans-serif;
    font-size: 0.7rem;
    letter-spacing: 1.5px;
    color: #1a1a1a;
    border: 1px solid #1a1a1a;
    padding: 4px 10px;
    border-radius: 4px;
    text-transform: uppercase;
    margin-top: 8px;
}

.buyer-section {
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
    text-shadow: 0 2px 4px rgba(108, 92, 231, 0.3);
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
    box-shadow: 0 4px 15px rgba(108, 92, 231, 0.2);
    outline: none;
    transition: box-shadow 0.3s ease;
}

.form-input::placeholder {
    color: #999;
}

.form-input:focus {
    box-shadow: 0 4px 20px rgba(108, 92, 231, 0.4);
}

.form-input.input-error {
    box-shadow: 0 0 0 2px #e74c3c, 0 4px 15px rgba(108, 92, 231, 0.2);
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

.country-group {
    position: relative;
}

.country-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    z-index: 20;
    max-height: 240px;
    overflow-y: auto;
    background: rgba(255, 255, 255, 0.98);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(108, 92, 231, 0.35);
    padding: 4px 0;
    display: flex;
    flex-direction: column;
}

.country-option {
    width: 100%;
    text-align: left;
    padding: 10px 20px;
    background: transparent;
    border: none;
    font-family: 'Matter-Regular', sans-serif;
    font-size: 0.95rem;
    color: #1a1a1a;
    cursor: pointer;
    transition: background 0.15s ease;
}

.country-option.highlighted,
.country-option:hover {
    background: rgba(108, 92, 231, 0.12);
}

.claim-note {
    font-family: 'Matter-Regular', sans-serif;
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.85);
    text-align: center;
    margin: 0;
    line-height: 1.4;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.error-message {
    font-family: 'Matter-Regular', sans-serif;
    font-size: 0.9rem;
    color: #e74c3c;
    text-align: center;
    margin: 0;
    background: rgba(255, 255, 255, 0.95);
    padding: 10px 16px;
    border-radius: 8px;
}

.primary-button {
    display: inline-block;
    padding: 14px 32px;
    background: #1a1a1a;
    border: none;
    border-radius: 8px;
    text-decoration: none;
    color: white;
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 1rem;
    text-align: center;
    cursor: pointer;
    transition: background 0.3s ease;
    margin-top: 8px;
}

.primary-button:hover:not(:disabled) {
    background: #333;
}

.primary-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.submit-button {
    width: 100%;
    padding: 16px;
    font-size: 1.1rem;
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

    .info-card {
        padding: 32px 20px;
    }

    .info-title {
        font-size: 1.2rem;
    }

    .submit-button {
        padding: 14px;
        font-size: 1rem;
    }
}
</style>
