<script setup lang="ts">
import AppNav from '@/components/AppNav.vue'
import SiteFooter from '@/components/SiteFooter.vue'
</script>

<template>
    <div class="gradient-background">
        <AppNav />
        <main class="main-content">
            <router-view />
        </main>
        <SiteFooter />
    </div>
</template>

<style scoped>
.gradient-background {
    position: relative;
    background: linear-gradient(300deg, white, #6C5CE7);
    background-size: 120% 120%;
    animation: gradient-animation 12s ease infinite;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    /* `clip` (not `hidden`) clips horizontal overflow WITHOUT making this a
       scroll container — `overflow-x: hidden` would, which silently disables
       position: sticky on the nav inside. */
    overflow-x: clip;
}

.main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    width: 100%;
    padding: 0 20px 20px;
    position: relative;
    z-index: 2;
}

.gradient-background::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 1;
    opacity: 0.45;
    mix-blend-mode: overlay;
    background-image: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.6' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-size: 200px 200px;
}

@keyframes gradient-animation {
    0% {
        background-position: 0% 50%;
    }

    50% {
        background-position: 100% 50%;
    }

    100% {
        background-position: 0% 50%;
    }
}
</style>
