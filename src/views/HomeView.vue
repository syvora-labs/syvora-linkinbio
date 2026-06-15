<script setup lang="ts">
import {ref, computed, onMounted} from 'vue'
import {useSeoMeta, useHead} from '@unhead/vue'
import {supabase} from '@/supabase'
import {buildHomeMeta, buildMusicGroupJsonLd} from '@/lib/seo/templates'

interface NextEvent {
    id: string
    title: string
    artwork_url: string | null
    location: string
    event_date: string
}

interface Link {
    title: string
    link: string
}

const nextEvent = ref<NextEvent | null>(null)
const links = ref<Link[]>([])
const loaded = ref(false)

onMounted(async () => {
    const [eventRes] = await Promise.all([
        supabase
            .from('events')
            .select('id, title, artwork_url, location, event_date')
            .eq('is_draft', false)
            .eq('is_archived', false)
            .gte('event_date', new Date().toISOString())
            .order('event_date', {ascending: true})
            .limit(1),
        fetch('/data/links.json')
            .then((r) => r.json())
            .then((data: Link[]) => {
                links.value = data
            })
            .catch((error) => console.error('Error loading links:', error)),
    ])

    if (eventRes.data && eventRes.data.length) {
        nextEvent.value = eventRes.data[0] as NextEvent
    }
    loaded.value = true
})

const eventDate = computed(() => {
    if (!nextEvent.value) return ''
    return new Date(nextEvent.value.event_date).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
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
    link: [{rel: 'canonical', href: homeMeta.canonical}],
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
    <main class="home">
        <section class="hero" aria-label="ECLIPSE BOUNDARIES">
            <h1 class="hero-title">ECLIPSE BOUNDARIES</h1>
        </section>

        <div class="home-row">
            <aside class="hub" aria-label="What's on">
                <div class="hub-card">
                <router-link
                    v-if="nextEvent"
                    :to="{ name: 'event-detail', params: { eventId: nextEvent.id } }"
                    class="next-event"
                >
                    <img
                        v-if="nextEvent.artwork_url"
                        :src="nextEvent.artwork_url"
                        :alt="`${nextEvent.title} artwork`"
                        class="next-art"
                        loading="eager"
                    />
                    <div class="next-body">
                        <span class="next-label">Next event</span>
                        <span class="next-title">{{ nextEvent.title }}</span>
                        <span class="next-meta">{{ eventDate }}</span>
                        <span class="next-meta">{{ nextEvent.location }}</span>
                        <span class="next-cta">Get tickets →</span>
                    </div>
                </router-link>

                <div v-else-if="loaded" class="no-event">
                    <span class="next-label">Events</span>
                    <p class="no-event-text">No upcoming shows right now.</p>
                    <router-link to="/events" class="no-event-link">See past events →</router-link>
                </div>

                <div v-else class="next-event skeleton" aria-hidden="true">
                    <div class="next-art" />
                    <div class="next-body">
                        <span class="sk-line w40" />
                        <span class="sk-line w80" />
                        <span class="sk-line w60" />
                    </div>
                </div>

                <nav class="hub-jumps" aria-label="Explore">
                    <router-link to="/shop">Shop</router-link>
                    <span class="dot">·</span>
                    <router-link to="/radio">Radio</router-link>
                    <span class="dot">·</span>
                    <router-link to="/residents">Residents</router-link>
                    <span class="dot">·</span>
                    <router-link to="/about">About Us</router-link>
                </nav>
                </div>
            </aside>

            <nav v-if="links.length" class="home-links" aria-label="Links">
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
        </div>
    </main>
</template>

<style scoped>
.home {
    width: 100%;
    max-width: 1100px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 40px;
    /* Pull the hero toward the top of the viewport, just under the nav. */
    min-height: calc(100vh - 80px);
    padding-top: clamp(24px, 8vh, 96px);
}

.hero {
    /* Offset toward the top-left. */
    align-self: flex-start;
}

.hero-title {
    margin: 0;
    font-family: 'Matter-Heavy', sans-serif;
    font-weight: 700;
    text-transform: uppercase;
    line-height: 1;
    letter-spacing: 1px;
    color: white;
    /* One row: scale with viewport width so the full wordmark always fits.
       6vw keeps the ~18-char heavy wordmark inside the viewport down to
       ~320px; the 5rem cap keeps it inside the 1100px container on desktop. */
    white-space: nowrap;
    font-size: clamp(1rem, 6vw, 5rem);
    text-shadow: 0 4px 24px rgba(108, 92, 231, 0.4);
}

.home-row {
    width: 100%;
    display: flex;
    align-items: flex-start;
    gap: 24px;
}

.hub {
    width: 100%;
    max-width: 440px;
    flex-shrink: 0;
}

.home-links {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.link-button {
    display: block;
    padding: 16px 20px;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 12px;
    text-decoration: none;
    color: #1a1a1a;
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 1.05rem;
    box-shadow: 0 4px 15px rgba(108, 92, 231, 0.2);
    transition: box-shadow 0.25s ease, transform 0.2s ease;
}

.link-button:hover {
    box-shadow: 0 6px 20px rgba(108, 92, 231, 0.4);
    transform: translateY(-2px);
}

.hub-card {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 20px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.95);
    box-shadow: 0 4px 15px rgba(108, 92, 231, 0.2);
}

.next-event {
    display: flex;
    gap: 16px;
    text-decoration: none;
    color: #1a1a1a;
}

.next-art {
    width: 96px;
    height: 96px;
    flex-shrink: 0;
    border-radius: 10px;
    object-fit: cover;
    background: rgba(0, 0, 0, 0.06);
}

.next-body {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
}

.next-label {
    font-family: 'Matter-Heavy', sans-serif;
    font-size: 0.7rem;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #888;
}

.next-title {
    font-family: 'Matter-Heavy', sans-serif;
    font-size: 1.25rem;
    line-height: 1.15;
    color: #1a1a1a;
}

.next-meta {
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 0.85rem;
    color: #555;
}

.next-cta {
    margin-top: 8px;
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 0.9rem;
    color: #6C5CE7;
    transition: transform 0.2s ease;
}

.next-event:hover .next-cta {
    transform: translateX(3px);
}

.no-event {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.no-event-text {
    font-family: 'Matter-SemiBold', sans-serif;
    color: #555;
    margin: 0;
}

.no-event-link {
    font-family: 'Matter-SemiBold', sans-serif;
    color: #6C5CE7;
    text-decoration: none;
    font-size: 0.9rem;
}

.hub-jumps {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px 10px;
    padding-top: 16px;
    border-top: 1px solid rgba(0, 0, 0, 0.1);
    font-family: 'Matter-SemiBold', sans-serif;
}

.hub-jumps a {
    color: #1a1a1a;
    text-decoration: none;
    font-size: 0.95rem;
    transition: color 0.2s ease;
}

.hub-jumps a:hover {
    color: #6C5CE7;
    text-decoration: underline;
}

.hub-jumps .dot {
    color: #bbb;
}

/* Loading skeleton */
.skeleton .sk-line,
.skeleton .next-art {
    background: rgba(0, 0, 0, 0.08);
    border-radius: 6px;
    animation: pulse 1.4s ease-in-out infinite;
}

.skeleton .sk-line {
    height: 14px;
    margin-bottom: 6px;
}

.sk-line.w40 {
    width: 40%;
}

.sk-line.w60 {
    width: 60%;
}

.sk-line.w80 {
    width: 80%;
}

@keyframes pulse {
    0%, 100% {
        opacity: 0.5;
    }
    50% {
        opacity: 1;
    }
}

@media (max-width: 860px) {
    .home {
        gap: 32px;
        min-height: 0;
        padding-top: clamp(16px, 4vh, 48px);
    }

    .home-row {
        flex-direction: column;
        gap: 16px;
    }

    .hub {
        max-width: 100%;
    }
}
</style>
