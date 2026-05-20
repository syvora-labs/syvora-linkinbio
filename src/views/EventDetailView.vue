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

interface ArtistLink {
    id: string
    name: string
}

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
const artistsByName = ref<Map<string, ArtistLink>>(new Map())
const loading = ref(true)
const notFound = ref(false)

function artistIdForLineupEntry(name: string): string | null {
    return artistsByName.value.get(name)?.id ?? null
}

const sortedLineup = computed(() => {
    const list = event.value?.lineup ?? []
    return [...list].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
})

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

    const lineup = (data as EventRow).lineup ?? []
    if (lineup.length > 0) {
        const { data: artists } = await supabase
            .from('artists')
            .select('id, name')
            .in('name', lineup)
        if (artists) {
            const map = new Map<string, ArtistLink>()
            for (const a of artists as ArtistLink[]) {
                map.set(a.name, a)
            }
            artistsByName.value = map
        }
    }
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
        <router-link to="/" class="brand-link">ECLIPSE BOUNDARIES</router-link>

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
            <h2 id="lineup-heading" class="lineup-heading">LINEUP A-Z</h2>
            <ul class="lineup-list">
                <li
                    v-for="(artist, idx) in sortedLineup"
                    :key="`${idx}-${artist}`"
                    class="lineup-item-wrap"
                >
                    <router-link
                        v-if="artistIdForLineupEntry(artist)"
                        :to="{ name: 'artist-detail', params: { artistId: artistIdForLineupEntry(artist)! } }"
                        class="lineup-item lineup-item-link"
                    >
                        <span>{{ artist }}</span>
                        <span class="lineup-chevron" aria-hidden="true">→</span>
                    </router-link>
                    <div v-else class="lineup-item">
                        {{ artist }}
                    </div>
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

.brand-link {
    font-family: 'Matter-Heavy', sans-serif;
    font-size: 1.6rem;
    font-weight: 700;
    letter-spacing: 3px;
    align-self: flex-start;
    color: white;
    text-decoration: none;
    text-transform: uppercase;
    text-shadow: 0 2px 4px rgba(108, 92, 231, 0.3);
    transition: opacity 0.3s ease;
}

.brand-link:hover {
    opacity: 0.8;
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
    overflow-wrap: break-word;
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

.lineup-item-wrap {
    width: 100%;
}

.lineup-item {
    display: block;
    width: 100%;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 10px;
    padding: 14px 20px;
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 1rem;
    color: #1a1a1a;
    box-shadow: 0 4px 15px rgba(108, 92, 231, 0.2);
}

.lineup-item-link {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    text-decoration: none;
    transition: box-shadow 0.25s ease, transform 0.25s ease;
}

.lineup-item-link:hover {
    box-shadow: 0 6px 20px rgba(108, 92, 231, 0.4);
    transform: translateX(2px);
}

.lineup-chevron {
    font-size: 1.1rem;
    color: #1a1a1a;
    flex-shrink: 0;
}

.standalone-back {
    align-self: center;
    margin-top: 4px;
}
</style>
