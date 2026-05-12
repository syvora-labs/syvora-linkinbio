<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSeoMeta, useHead } from '@unhead/vue'
import EventCard from '@/components/EventCard.vue'
import RadioList from '@/components/RadioList.vue'
import { buildHomeMeta, buildMusicGroupJsonLd } from '@/lib/seo/templates'

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

const homeMeta = buildHomeMeta()

useSeoMeta({
    title: homeMeta.title,
    description: homeMeta.description,
    ogType: 'website',
    ogSiteName: 'ECLIPSE BOUNDARIES',
    ogTitle: 'ECLIPSE BOUNDARIES',
    ogDescription: 'Electronic events in Lucerne & Switzerland.',
    ogUrl: homeMeta.canonical,
    ogImage: 'https://eclipseboundaries.ch/og-default.jpg',
    ogLocale: 'en_US',
    twitterCard: 'summary_large_image',
    twitterTitle: 'ECLIPSE BOUNDARIES',
    twitterDescription: 'Electronic events in Lucerne & Switzerland.',
    twitterImage: 'https://eclipseboundaries.ch/og-default.jpg',
})

useHead({
    link: [{ rel: 'canonical', href: homeMeta.canonical }],
    script: [
        {
            type: 'application/ld+json',
            // Client-side homepage JSON-LD is the lightweight brand-only form.
            // The richer ItemList of events is injected by the Edge middleware.
            innerHTML: JSON.stringify(buildMusicGroupJsonLd([])),
        },
    ],
})
</script>

<template>
    <main class="container">
        <header>
            <h1 class="title">ECLIPSE BOUNDARIES</h1>
        </header>

        <EventCard />

        <nav aria-label="External links" class="links-section">
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
        </nav>

        <RadioList />

        <nav aria-label="Social media" class="social-section">
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
        </nav>
    </main>
</template>

<style scoped>
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
    text-shadow: 0 2px 4px rgba(108, 92, 231, 0.3);
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
    box-shadow: 0 4px 15px rgba(108, 92, 231, 0.2);
    cursor: pointer;
}

.link-button:hover {
    box-shadow: 0 6px 20px rgba(108, 92, 231, 0.4);
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
}
</style>
