<script setup lang="ts">
import {ref, onUnmounted, watch} from 'vue'
import {useRoute} from 'vue-router'
import {useCart} from '@/composables/useCart'

const route = useRoute()
const {count: cartCount} = useCart()

// Primary destinations shown in the bar and the drawer.
const destinations = [
    {label: 'Events', to: '/events'},
    {label: 'Residents', to: '/residents'},
    {label: 'About Us', to: '/about'},
    {label: 'Shop', to: '/shop'},
    {label: 'Radio', to: '/radio'},
]

const socials = [
    {label: 'YouTube', href: 'https://www.youtube.com/@eclipse_boundaries'},
    {label: 'Instagram', href: 'https://www.instagram.com/eclipse_boundaries/'},
    {label: 'TikTok', href: 'https://tiktok.com/@eclipse_boundaries'},
]

const drawerOpen = ref(false)
function toggleDrawer() {
    drawerOpen.value = !drawerOpen.value
}
function closeDrawer() {
    drawerOpen.value = false
}

// Close the drawer on navigation and lock body scroll while it's open.
watch(() => route.fullPath, closeDrawer)
watch(drawerOpen, (open) => {
    document.body.style.overflow = open ? 'hidden' : ''
})
onUnmounted(() => {
    document.body.style.overflow = ''
})
</script>

<template>
    <header class="app-nav">
        <div class="nav-inner">
            <router-link
                to="/"
                class="wordmark"
                aria-label="ECLIPSE BOUNDARIES — home"
            >
                ECLIPSE BOUNDARIES
            </router-link>

            <nav class="desktop-links" aria-label="Primary">
                <router-link
                    v-for="item in destinations"
                    :key="item.to"
                    :to="item.to"
                    class="nav-link"
                >
                    {{ item.label }}
                </router-link>
                <router-link to="/shop/cart" class="cart-link" aria-label="Cart">
                    <svg viewBox="0 0 24 24" class="cart-icon" aria-hidden="true">
                        <path
                            d="M3 3h2l.4 2M7 13h10l3.5-8H6.5M7 13L5.4 5M7 13l-2 4h12"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.8"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />
                        <circle cx="9" cy="20" r="1.4" fill="currentColor" />
                        <circle cx="17" cy="20" r="1.4" fill="currentColor" />
                    </svg>
                    <span v-if="cartCount > 0" class="cart-badge">{{ cartCount }}</span>
                </router-link>
            </nav>

            <button
                class="hamburger"
                :aria-expanded="drawerOpen"
                aria-label="Open menu"
                @click="toggleDrawer"
            >
                <span v-if="cartCount > 0" class="hamburger-badge">{{ cartCount }}</span>
                <span class="bar" />
                <span class="bar" />
                <span class="bar" />
            </button>
        </div>
    </header>

    <transition name="drawer-fade">
        <div v-if="drawerOpen" class="drawer-overlay" @click="closeDrawer" />
    </transition>
    <transition name="drawer-slide">
        <aside v-if="drawerOpen" class="drawer" aria-label="Menu">
            <button class="drawer-close" aria-label="Close menu" @click="closeDrawer">×</button>
            <nav class="drawer-links">
                <router-link
                    v-for="item in destinations"
                    :key="item.to"
                    :to="item.to"
                    class="drawer-link"
                >
                    {{ item.label }}
                </router-link>
                <router-link to="/shop/cart" class="drawer-link drawer-cart">
                    Cart
                    <span v-if="cartCount > 0" class="cart-badge inline">{{ cartCount }}</span>
                </router-link>
            </nav>
            <div class="drawer-footer">
                <div class="drawer-socials">
                    <a
                        v-for="s in socials"
                        :key="s.href"
                        :href="s.href"
                        target="_blank"
                        rel="noopener noreferrer"
                    >{{ s.label }}</a>
                </div>
                <div class="drawer-legal">
                    <router-link to="/legal/impressum">Impressum</router-link>
                    <router-link to="/legal/datenschutz">Datenschutz</router-link>
                    <router-link to="/legal/agb">AGB</router-link>
                </div>
            </div>
        </aside>
    </transition>
</template>

<style scoped>
@font-face {
    font-family: 'Matter-SemiBold';
    src: url('/fonts/Matter-SemiBold.otf') format('opentype');
    font-weight: normal;
    font-style: normal;
}

@font-face {
    font-family: 'Matter-Heavy';
    src: url('/fonts/Matter-Heavy.otf') format('opentype');
    font-weight: normal;
    font-style: normal;
}

.app-nav {
    position: sticky;
    top: 0;
    z-index: 50;
    display: flex;
    justify-content: center;
    padding: 14px 16px;
    /* The wrapper spans full width but is transparent — let clicks fall through
       its empty areas to content scrolled underneath the floating pill. */
    pointer-events: none;
}

/* The liquid-glass pill itself — a wide bar: wordmark left, links right. */
.nav-inner {
    pointer-events: auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 26px;
    width: 100%;
    max-width: 1100px;
    padding: 9px 14px 9px 24px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(18px) saturate(170%);
    -webkit-backdrop-filter: blur(18px) saturate(170%);
    border: 1px solid rgba(255, 255, 255, 0.25);
    box-shadow:
        0 8px 30px rgba(40, 24, 90, 0.22),
        inset 0 1px 1px rgba(255, 255, 255, 0.45),
        inset 0 -1px 1px rgba(255, 255, 255, 0.08);
}

.wordmark {
    font-family: 'Matter-Heavy', sans-serif;
    font-size: 1rem;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: white;
    text-decoration: none;
    white-space: nowrap;
    text-shadow: 0 2px 8px rgba(108, 92, 231, 0.35);
}

.desktop-links {
    display: flex;
    align-items: center;
    gap: 28px;
}

.nav-link {
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 0.95rem;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.85);
    text-decoration: none;
    position: relative;
    padding: 4px 0;
    text-shadow: 0 2px 8px rgba(108, 92, 231, 0.35);
    transition: color 0.2s ease;
}

.nav-link::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: -2px;
    width: 100%;
    height: 2px;
    background: white;
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 0.25s ease;
}

.nav-link:hover,
.nav-link.router-link-active {
    color: white;
}

.nav-link:hover::after,
.nav-link.router-link-active::after {
    transform: scaleX(1);
}

.cart-link {
    position: relative;
    display: inline-flex;
    align-items: center;
    color: rgba(255, 255, 255, 0.85);
    transition: color 0.2s ease;
}

.cart-link:hover {
    color: white;
}

.cart-icon {
    width: 24px;
    height: 24px;
    filter: drop-shadow(0 2px 6px rgba(108, 92, 231, 0.35));
}

.cart-badge {
    position: absolute;
    top: -8px;
    right: -10px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 9px;
    background: white;
    color: #1a1a1a;
    font-family: 'Matter-Heavy', sans-serif;
    font-size: 0.7rem;
    line-height: 18px;
    text-align: center;
}

.cart-badge.inline {
    position: static;
    margin-left: 8px;
    background: #1a1a1a;
    color: #fff;
}

/* Hamburger — hidden on desktop */
.hamburger {
    display: none;
    position: relative;
    flex-direction: column;
    gap: 5px;
    width: 40px;
    height: 40px;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    cursor: pointer;
}

.hamburger .bar {
    width: 24px;
    height: 2px;
    background: white;
    border-radius: 2px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
}

.hamburger-badge {
    position: absolute;
    top: 0;
    right: 0;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: 8px;
    background: white;
    color: #1a1a1a;
    font-family: 'Matter-Heavy', sans-serif;
    font-size: 0.62rem;
    line-height: 16px;
    text-align: center;
}

/* Drawer */
.drawer-overlay {
    position: fixed;
    inset: 0;
    z-index: 60;
    background: rgba(10, 8, 24, 0.5);
    backdrop-filter: blur(2px);
}

.drawer {
    position: fixed;
    top: 0;
    right: 0;
    z-index: 61;
    width: min(82vw, 340px);
    height: 100%;
    padding: 80px 28px 28px;
    display: flex;
    flex-direction: column;
    background: #ffffff;
    box-shadow: -8px 0 40px rgba(0, 0, 0, 0.25);
}

.drawer-close {
    position: absolute;
    top: 20px;
    right: 24px;
    background: transparent;
    border: none;
    color: #1a1a1a;
    font-size: 2rem;
    line-height: 1;
    cursor: pointer;
}

.drawer-links {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.drawer-link {
    display: flex;
    align-items: center;
    padding: 14px 0;
    font-family: 'Matter-Heavy', sans-serif;
    font-size: 1.6rem;
    letter-spacing: 1px;
    color: #1a1a1a;
    text-decoration: none;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.drawer-link.router-link-active {
    color: #6c5ce7;
}

.drawer-cart {
    font-size: 1.2rem;
    font-family: 'Matter-SemiBold', sans-serif;
}

.drawer-footer {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
    font-family: 'Matter-Regular', sans-serif;
}

.drawer-socials {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
}

.drawer-socials a {
    color: #1a1a1a;
    text-decoration: none;
    font-size: 0.9rem;
}

.drawer-legal {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
}

.drawer-legal a {
    color: #888;
    text-decoration: none;
    font-size: 0.78rem;
}

.drawer-socials a:hover,
.drawer-legal a:hover {
    text-decoration: underline;
}

/* Transitions */
.drawer-fade-enter-active,
.drawer-fade-leave-active {
    transition: opacity 0.25s ease;
}

.drawer-fade-enter-from,
.drawer-fade-leave-to {
    opacity: 0;
}

.drawer-slide-enter-active,
.drawer-slide-leave-active {
    transition: transform 0.3s ease;
}

.drawer-slide-enter-from,
.drawer-slide-leave-to {
    transform: translateX(100%);
}

@media (max-width: 760px) {
    .desktop-links {
        display: none;
    }

    .hamburger {
        display: flex;
    }

    .nav-inner {
        display: flex;
        width: 100%;
        justify-content: space-between;
        padding: 7px 8px 7px 20px;
    }
}
</style>
