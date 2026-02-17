<script setup lang="ts">
import {ref, onMounted} from 'vue'
import EventCard from "@/components/EventCard.vue";

interface Link {
    title: string
    link: string
}

const links = ref<Link[]>([])

onMounted(async () => {
    try {
        const response = await fetch('/data/links.json')
        links.value = await response.json()
    } catch (error) {
        console.error('Error loading links:', error)
    }
})
</script>

<template>
    <div class="gradient-background">
        <div class="container">
            <h1 class="title">ECLIPSE BOUNDARIES</h1>

            <EventCard />

            <div class="links-section">
                <a
                    v-for="link in links"
                    :key="link.link"
                    :href="link.link"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="link-button"
                >
                    {{ link.title }}
                </a>
            </div>

            <div class="social-section">
                <a
                    href="https://www.youtube.com/@eclipse_boundaries"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="social-link"
                >
                    YouTube
                </a>
                <a
                    href="https://www.instagram.com/eclipse_boundaries/"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="social-link"
                >
                    Instagram
                </a>
                <a
                    href="https://tiktok.com/@eclipse_boundaries"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="social-link"
                >
                    TikTok
                </a>
            </div>
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

.gradient-background {
    background: linear-gradient(300deg, white, #73c3fe);
    background-size: 120% 120%;
    animation: gradient-animation 12s ease infinite;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
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

.container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    max-width: 500px;
    gap: 40px;
}

.title {
    font-family: 'Matter-Heavy', sans-serif;
    font-size: 2.5rem;
    font-weight: 700;
    letter-spacing: 3px;
    text-align: left;
    color: white;
    margin: 0;
    text-transform: uppercase;
    text-shadow: 0 2px 4px rgba(115, 195, 254, 0.3);
}

.links-section {
    display: flex;
    flex-direction: column;
    width: 100%;
    gap: 15px;
}

.link-button {
    display: block;
    padding: 16px 24px;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 8px;
    text-decoration: none;
    color: #1a1a1a;
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 1.3rem;
    font-weight: 600;
    text-align: left;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(115, 195, 254, 0.2);
    cursor: pointer;
}

.link-button:hover {
    box-shadow: 0 6px 20px rgba(115, 195, 254, 0.4);
}

.social-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    justify-content: center;
    align-items: center;
    margin-top: 20px;
}

.social-link {
    text-decoration: none;
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.95rem;
    font-family: 'Matter-SemiBold', sans-serif;
    transition: all 0.3s ease;
    cursor: pointer;
}

.social-link:hover {
    color: white;
    text-decoration: underline;
}

@media (max-width: 600px) {
    .container {
        gap: 30px;
    }

    .title {
        font-size: 2rem;
        letter-spacing: 2px;
    }

    .link-button {
        padding: 14px 20px;
        font-size: 1rem;
    }

    .social-button {
        width: 50px;
        height: 50px;
    }

    .icon {
        font-size: 1.2rem;
    }
}
</style>
