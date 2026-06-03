<script setup lang="ts">
import {ref, computed} from 'vue'
import {useSeoMeta} from '@unhead/vue'
import {supabase} from '@/supabase'
import {MANDATOR_ID} from '@/lib/shop/config'
import {formatPrice} from '@/lib/shop/format'
import {shippingCentsForCountry} from '@/lib/shop/shipping'
import {useCart} from '@/composables/useCart'

useSeoMeta({
    title: 'Cart | ECLIPSE BOUNDARIES',
    robots: 'noindex, nofollow',
})

const {items, totalCents, currency, setQuantity, removeItem} = useCart()

// Stripe Checkout is configured to accept these shipping destinations, so we
// only offer the matching countries here.
const SHIPPING_COUNTRIES = [
    {code: 'CH', name: 'Switzerland'},
    {code: 'DE', name: 'Germany'},
    {code: 'AT', name: 'Austria'},
    {code: 'FR', name: 'France'},
    {code: 'IT', name: 'Italy'},
]

const buyerName = ref('')
const buyerEmail = ref('')
const line1 = ref('')
const line2 = ref('')
const postalCode = ref('')
const city = ref('')
const country = ref('CH')

const checkoutLoading = ref(false)
const error = ref<string | null>(null)
const emailTouched = ref(false)
const agbAccepted = ref(false)

const selectedCountryName = computed(
    () => SHIPPING_COUNTRIES.find(c => c.code === country.value)?.name ?? '',
)
const shippingCents = computed(() => shippingCentsForCountry(country.value) ?? 0)
const grandTotalCents = computed(() => totalCents.value + shippingCents.value)

const isValidEmail = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail.value.trim()))

const emailError = computed(() => {
    if (!emailTouched.value || !buyerEmail.value.trim()) return ''
    return isValidEmail.value ? '' : 'Please enter a valid email address'
})

const canCheckout = computed(() =>
    items.value.length > 0
    && buyerName.value.trim()
    && isValidEmail.value
    && line1.value.trim()
    && postalCode.value.trim()
    && city.value.trim()
    && country.value
    && agbAccepted.value,
)

async function handleCheckout() {
    if (!canCheckout.value) return
    checkoutLoading.value = true
    error.value = null

    try {
        const {data, error: fnError} = await supabase.functions.invoke('webshop-create-checkout', {
            body: {
                mandator_id: MANDATOR_ID,
                buyer: {name: buyerName.value.trim(), email: buyerEmail.value.trim()},
                shipping_address: {
                    line1: line1.value.trim(),
                    line2: line2.value.trim() || undefined,
                    postal_code: postalCode.value.trim(),
                    city: city.value.trim(),
                    country: country.value,
                },
                items: items.value.map(i => ({
                    product_id: i.product_id,
                    variant_id: i.variant_id,
                    quantity: i.quantity,
                })),
                agb_accepted_at: new Date().toISOString(),
                success_url: `${window.location.origin}/shop/success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${window.location.origin}/shop/cart`,
            },
        })

        if (fnError || !data?.checkout_url) {
            error.value = data?.error || 'Could not start checkout. Please try again.'
            checkoutLoading.value = false
            return
        }

        window.location.href = data.checkout_url
    } catch {
        error.value = 'Something went wrong. Please try again.'
        checkoutLoading.value = false
    }
}
</script>

<template>
    <div class="container">
        <div class="shop-header">
            <router-link to="/shop" class="back-link">&#8592; Continue shopping</router-link>
        </div>

        <h1 class="page-title">Your cart</h1>

        <div v-if="items.length === 0" class="state-card">
            <p class="state-text">Your cart is empty.</p>
            <router-link to="/shop" class="back-button">Browse the shop</router-link>
        </div>

        <template v-else>
            <div class="cart-list">
                <div v-for="item in items" :key="item.variant_id" class="cart-row">
                    <div class="cart-row-info">
                        <span class="cart-row-title">{{ item.title }}</span>
                        <span class="cart-row-size">Size: {{ item.size }}</span>
                        <span class="cart-row-price">{{ formatPrice(item.price_cents, item.currency) }}</span>
                    </div>
                    <div class="cart-row-actions">
                        <div class="quantity-selector">
                            <button
                                class="qty-btn"
                                @click="setQuantity(item.variant_id, item.quantity - 1)"
                            >-</button>
                            <span class="qty-value">{{ item.quantity }}</span>
                            <button
                                class="qty-btn"
                                @click="setQuantity(item.variant_id, item.quantity + 1)"
                            >+</button>
                        </div>
                        <button class="remove-btn" @click="removeItem(item.variant_id)">Remove</button>
                    </div>
                </div>
            </div>

            <div class="buyer-section">
                <h2 class="section-heading">Shipping details</h2>
                <div class="form-group">
                    <input v-model="buyerName" type="text" placeholder="Full Name" class="form-input" />
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
                    <input v-model="line1" type="text" placeholder="Address" class="form-input" />
                </div>
                <div class="form-group">
                    <input v-model="line2" type="text" placeholder="Address line 2 (optional)" class="form-input" />
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <input v-model="postalCode" type="text" placeholder="Postal Code" class="form-input" />
                    </div>
                    <div class="form-group">
                        <input v-model="city" type="text" placeholder="City" class="form-input" />
                    </div>
                </div>
                <div class="form-group">
                    <select v-model="country" class="form-input">
                        <option v-for="c in SHIPPING_COUNTRIES" :key="c.code" :value="c.code">
                            {{ c.name }}
                        </option>
                    </select>
                </div>
            </div>

            <div class="order-summary">
                <div class="summary-card">
                    <div class="summary-row">
                        <span>Subtotal</span>
                        <span>{{ formatPrice(totalCents, currency) }}</span>
                    </div>
                    <div class="summary-row summary-shipping">
                        <span>Shipping{{ selectedCountryName ? ` (${selectedCountryName})` : '' }}</span>
                        <span>{{ formatPrice(shippingCents, currency) }}</span>
                    </div>
                    <div class="summary-divider"></div>
                    <div class="summary-row summary-total-row">
                        <span>Total</span>
                        <span class="summary-total">{{ formatPrice(grandTotalCents, currency) }}</span>
                    </div>
                </div>
            </div>

            <p v-if="error" class="error-message">{{ error }}</p>

            <label class="agb-consent">
                <input
                    v-model="agbAccepted"
                    type="checkbox"
                    class="agb-checkbox"
                />
                <span class="agb-text">
                    I have read and accept the
                    <a href="/legal/agb" target="_blank" rel="noopener noreferrer">AGB</a>
                    and the
                    <a href="/legal/datenschutz" target="_blank" rel="noopener noreferrer">Datenschutzerklärung</a>.
                </span>
            </label>

            <button
                class="checkout-button"
                :disabled="!canCheckout || checkoutLoading"
                @click="handleCheckout"
            >
                {{ checkoutLoading ? 'Redirecting...' : `Pay ${formatPrice(grandTotalCents, currency)}` }}
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
    align-items: stretch;
    width: 100%;
    max-width: 560px;
    gap: 20px;
}

.shop-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
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

.cart-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.cart-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 12px;
    padding: 16px 20px;
    box-shadow: 0 4px 15px rgba(108, 92, 231, 0.2);
}

.cart-row-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
}

.cart-row-title {
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 1rem;
    color: #1a1a1a;
}

.cart-row-size,
.cart-row-price {
    font-family: 'Matter-Regular', sans-serif;
    font-size: 0.85rem;
    color: #777;
}

.cart-row-actions {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
    flex-shrink: 0;
}

.quantity-selector {
    display: flex;
    align-items: center;
    gap: 10px;
}

.qty-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 2px solid #1a1a1a;
    background: transparent;
    color: #1a1a1a;
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 1.1rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
}

.qty-btn:hover {
    background: #1a1a1a;
    color: white;
}

.qty-value {
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 1rem;
    color: #1a1a1a;
    min-width: 20px;
    text-align: center;
}

.remove-btn {
    background: none;
    border: none;
    color: #999;
    font-family: 'Matter-Regular', sans-serif;
    font-size: 0.8rem;
    cursor: pointer;
    padding: 0;
    text-decoration: underline;
}

.remove-btn:hover {
    color: #e74c3c;
}

.buyer-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.section-heading {
    font-family: 'Matter-Heavy', sans-serif;
    font-size: 1.1rem;
    color: white;
    margin: 0;
    letter-spacing: 1px;
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

.order-summary {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.summary-card {
    width: 100%;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 12px;
    padding: 16px 24px;
    box-shadow: 0 4px 15px rgba(108, 92, 231, 0.2);
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

.summary-shipping {
    color: #777;
}

.summary-divider {
    height: 1px;
    background: #eee;
    margin: 2px 0;
}

.summary-total-row {
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 1rem;
    color: #1a1a1a;
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

.agb-consent {
    width: 100%;
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 14px 18px;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 8px;
    box-shadow: 0 4px 15px rgba(108, 92, 231, 0.2);
    cursor: pointer;
}

.agb-checkbox {
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    margin-top: 2px;
    accent-color: #1a1a1a;
    cursor: pointer;
}

.agb-text {
    font-family: 'Matter-Regular', sans-serif;
    font-size: 0.9rem;
    line-height: 1.4;
    color: #1a1a1a;
}

.agb-text a {
    color: #6C5CE7;
    text-decoration: underline;
}

.agb-text a:hover {
    opacity: 0.8;
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
    .page-title {
        font-size: 1.3rem;
    }

    .cart-row {
        padding: 14px 16px;
    }
}
</style>
