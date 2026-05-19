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

function hasDescription(e: EventRow | null): boolean {
    return !!e?.description && e.description.trim().length > 0
}

function hasLineup(e: EventRow | null): boolean {
    return !!e?.lineup && e.lineup.length > 0
}

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
        .select('id, title, artwork_url, location, event_date, ticket_link, description, lineup')
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
        query: route.query.unlock ? { unlock: route.query.unlock } : undefined,
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
            </div>
        </article>

        <section
            v-if="event && hasDescription(event)"
            class="event-description-card"
            aria-label="Event description"
        >
            <p class="event-description-text">{{ event.description }}</p>
        </section>

        <section
            v-if="event && hasLineup(event)"
            class="event-lineup"
            aria-labelledby="lineup-heading"
        >
            <h2 id="lineup-heading" class="lineup-heading">LINEUP</h2>
            <ul class="lineup-list">
                <li
                    v-for="artist in event.lineup ?? []"
                    :key="artist"
                    class="lineup-item"
                >
                    {{ artist }}
                </li>
            </ul>
        </section>

        <router-link v-if="event" to="/" class="back-link standalone-back">
            ← Back to home
        </router-link>
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
    box-shadow: 0 4px 15px rgba(108, 92, 231, 0.2);
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

.event-description-card {
    width: 100%;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 12px;
    padding: 20px 24px;
    box-shadow: 0 4px 15px rgba(108, 92, 231, 0.2);
}

.event-description-text {
    margin: 0;
    font-family: 'Matter-Regular', sans-serif;
    font-size: 0.98rem;
    line-height: 1.55;
    color: #1a1a1a;
    white-space: pre-wrap;
}

.event-lineup {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.lineup-heading {
    font-family: 'Matter-Heavy', sans-serif;
    font-size: 0.85rem;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: white;
    margin: 4px 0 2px;
    text-shadow: 0 2px 4px rgba(108, 92, 231, 0.3);
}

.lineup-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.lineup-item {
    background: rgba(255, 255, 255, 0.95);
    border-radius: 10px;
    padding: 14px 20px;
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 1rem;
    color: #1a1a1a;
    box-shadow: 0 4px 15px rgba(108, 92, 231, 0.2);
}

.standalone-back {
    align-self: center;
    margin-top: 4px;
}
</style>
