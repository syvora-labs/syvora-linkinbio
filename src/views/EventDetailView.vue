<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSeoMeta, useHead } from '@unhead/vue'
import { supabase } from '@/supabase'
import {
    buildEventMeta,
    buildEventJsonLd,
    buildBreadcrumbJsonLd,
} from '@/lib/seo/templates'
import type { SeoEvent } from '@/lib/seo/types'

interface EventRow extends SeoEvent {}

const route = useRoute()
const router = useRouter()
const eventId = route.params.eventId as string

const event = ref<EventRow | null>(null)
const loading = ref(true)
const notFound = ref(false)

const seo = computed(() =>
    event.value ? buildEventMeta(event.value) : null,
)

onMounted(async () => {
    const { data, error } = await supabase
        .from('events')
        .select('id, title, artwork_url, location, event_date, ticket_link')
        .eq('id', eventId)
        .eq('is_draft', false)
        .eq('is_archived', false)
        .maybeSingle()

    if (error || !data) {
        notFound.value = true
        loading.value = false
        return
    }

    event.value = data as EventRow
    loading.value = false
})

useSeoMeta({
    title: computed(() => seo.value?.title ?? 'Loading… | ECLIPSE BOUNDARIES'),
    description: computed(() => seo.value?.description),
    robots: computed(() => seo.value ? undefined : 'noindex'),
    ogType: computed(() => seo.value ? 'website' : undefined),
    ogTitle: computed(() =>
        seo.value?.tags.find(
            (t) => t.keyAttr === 'property' && t.key === 'og:title',
        )?.content,
    ),
    ogDescription: computed(() =>
        seo.value?.tags.find(
            (t) => t.keyAttr === 'property' && t.key === 'og:description',
        )?.content,
    ),
    ogImage: computed(() =>
        seo.value?.tags.find(
            (t) => t.keyAttr === 'property' && t.key === 'og:image',
        )?.content,
    ),
    ogUrl: computed(() => seo.value?.canonical),
    twitterCard: computed(() => seo.value ? ('summary_large_image' as const) : undefined),
    twitterImage: computed(() =>
        seo.value?.tags.find(
            (t) => t.keyAttr === 'name' && t.key === 'twitter:image',
        )?.content,
    ),
})

useHead(
    computed(() => ({
        link: seo.value
            ? [{ rel: 'canonical', href: seo.value.canonical }]
            : [],
        script: event.value
            ? [
                  {
                      type: 'application/ld+json',
                      innerHTML: JSON.stringify(buildEventJsonLd(event.value)),
                  },
                  {
                      type: 'application/ld+json',
                      innerHTML: JSON.stringify(
                          buildBreadcrumbJsonLd(event.value),
                      ),
                  },
              ]
            : [],
    })),
)

function formatLong(iso: string): string {
    return new Date(iso).toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

function onBuyTickets() {
    if (!event.value) return
    if (event.value.ticket_link) {
        window.open(event.value.ticket_link, '_blank', 'noopener,noreferrer')
        return
    }
    router.push({
        name: 'ticket-shop',
        params: { eventId: event.value.id },
    })
}
</script>

<template>
    <main class="event-detail">
        <div v-if="loading" class="state">Loading…</div>
        <div v-else-if="notFound" class="state">
            <h1>Event not found</h1>
            <router-link to="/">Back to home</router-link>
        </div>
        <article v-else-if="event" class="event-card">
            <img
                v-if="event.artwork_url"
                :src="event.artwork_url"
                :alt="`${event.title} event artwork — ${event.location}`"
                class="event-cover"
                fetchpriority="high"
                loading="eager"
            />
            <div class="event-details">
                <h1 class="event-title">{{ event.title }}</h1>
                <p class="event-location">{{ event.location }}</p>
                <p class="event-date">{{ formatLong(event.event_date) }}</p>
                <button type="button" class="ticket-button" @click="onBuyTickets">
                    TICKETS
                </button>
                <router-link to="/" class="back-link">
                    ← Back to home
                </router-link>
            </div>
        </article>
    </main>
</template>

<style scoped>
.event-detail {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 500px;
    gap: 24px;
}

.state {
    color: white;
    font-family: 'Matter-SemiBold', sans-serif;
    text-align: center;
    padding: 40px 0;
}

.event-card {
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

.event-details {
    padding: 20px 24px 24px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.event-title {
    font-family: 'Matter-Heavy', sans-serif;
    font-size: 1.6rem;
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

.ticket-button {
    display: block;
    margin-top: 12px;
    padding: 14px;
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
}

.ticket-button:hover {
    background: #333;
}

.back-link {
    margin-top: 8px;
    color: #555;
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 0.9rem;
    text-decoration: none;
}

.back-link:hover {
    text-decoration: underline;
}
</style>
