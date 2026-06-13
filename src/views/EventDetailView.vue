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

function normalizeArtistKey(name: string): string {
    return name.trim().toLowerCase()
}

function artistIdForLineupEntry(name: string): string | null {
    return artistsByName.value.get(normalizeArtistKey(name))?.id ?? null
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
        .maybeSingle()

    if (error || !data) {
        notFound.value = true
        loading.value = false
        return
    }

    event.value = data as EventRow
    loading.value = false

    const lineup = (data as EventRow).lineup ?? []
    const filteredLineup = lineup
        .map((n) => n.trim())
        .filter((n) => n.length > 0)
    if (filteredLineup.length > 0) {
        // Case-insensitive match via PostgREST `or` with `ilike` (no wildcards =
        // case-insensitive exact match). Double-quote the value so commas etc.
        // inside an artist name don't break the filter; strip embedded quotes.
        const orFilter = filteredLineup
            .map((n) => `name.ilike."${n.replace(/"/g, '')}"`)
            .join(',')
        const { data: artists, error: artistsError } = await supabase
            .from('artists')
            .select('id, name')
            .or(orFilter)
        if (artistsError) {
            console.error('Failed to fetch lineup artists:', artistsError)
        }
        if (artists) {
            const map = new Map<string, ArtistLink>()
            for (const a of artists as ArtistLink[]) {
                map.set(normalizeArtistKey(a.name), a)
            }
            artistsByName.value = map
        }
    }
})

function tagContent(
    keyAttr: 'name' | 'property',
    key: string,
): string | undefined {
    return seo.value?.tags.find(
        (t) => t.keyAttr === keyAttr && t.key === key,
    )?.content
}

useSeoMeta({
    title: computed(() => seo.value?.title ?? 'Loading… | ECLIPSE BOUNDARIES'),
    description: computed(() => seo.value?.description),
    robots: computed(() => seo.value ? undefined : 'noindex'),
    ogType: computed(() => seo.value ? 'website' : undefined),
    ogSiteName: computed(() => tagContent('property', 'og:site_name')),
    ogLocale: computed(() => tagContent('property', 'og:locale')),
    ogTitle: computed(() => tagContent('property', 'og:title')),
    ogDescription: computed(() => tagContent('property', 'og:description')),
    ogImage: computed(() => tagContent('property', 'og:image')),
    ogUrl: computed(() => seo.value?.canonical),
    twitterCard: computed(() => seo.value ? ('summary_large_image' as const) : undefined),
    twitterTitle: computed(() => tagContent('name', 'twitter:title')),
    twitterDescription: computed(() => tagContent('name', 'twitter:description')),
    twitterImage: computed(() => tagContent('name', 'twitter:image')),
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
        <router-link to="/events" class="page-back">← Events</router-link>

        <div v-if="loading" class="state">Loading…</div>
        <div v-else-if="notFound" class="state">
            <h1>Event not found</h1>
            <router-link to="/events" class="page-back">← All events</router-link>
        </div>
        <article v-else-if="event" class="event-layout">
            <div class="event-poster">
                <img
                    v-if="event.artwork_url"
                    :src="event.artwork_url"
                    :alt="`${event.title} event artwork — ${event.location}`"
                    class="event-poster-img"
                    fetchpriority="high"
                    loading="eager"
                />
                <div v-else class="event-poster-img placeholder" aria-hidden="true">
                    {{ event.title.charAt(0).toUpperCase() }}
                </div>
            </div>

            <div class="event-info">
                <h1 class="event-title">{{ event.title }}</h1>
                <div class="event-meta">
                    <p class="event-location">{{ event.location }}</p>
                    <p class="event-date">{{ formatLong(event.event_date) }}</p>
                </div>
                <button type="button" class="ticket-button" @click="onBuyTickets">
                    TICKETS
                </button>

                <section
                    v-if="hasDescription(event)"
                    class="event-description-card"
                    aria-label="Event description"
                >
                    <p class="event-description-text">{{ event.description }}</p>
                </section>

                <section
                    v-if="hasLineup(event)"
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
            </div>
        </article>
    </main>
</template>

<style scoped>
.event-detail {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    width: 100%;
    max-width: 900px;
    gap: 4px;
    padding-top: clamp(16px, 4vh, 48px);
}

.state {
    color: white;
    font-family: 'Matter-SemiBold', sans-serif;
    text-align: center;
    padding: 40px 0;
}

/* Two columns: artwork left, details + lineup right. */
.event-layout {
    display: grid;
    grid-template-columns: minmax(0, 400px) 1fr;
    align-items: start;
    gap: 32px;
    width: 100%;
}

.event-poster {
    width: 100%;
    border-radius: 16px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.95);
    box-shadow: 0 4px 15px rgba(108, 92, 231, 0.2);
}

.event-poster-img {
    width: 100%;
    aspect-ratio: 1 / 1;
    object-fit: cover;
    display: block;
}

.event-poster-img.placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #6c5ce7 0%, #1a1a1a 100%);
    color: white;
    font-family: 'Matter-Heavy', sans-serif;
    font-size: 6rem;
}

.event-info {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
}

.event-title {
    margin: 0;
    font-family: 'Matter-Heavy', sans-serif;
    font-size: clamp(1.9rem, 4.5vw, 3rem);
    line-height: 1.08;
    color: white;
    text-shadow: 0 4px 24px rgba(108, 92, 231, 0.4);
    overflow-wrap: break-word;
}

.event-meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.event-location,
.event-date {
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 1rem;
    color: rgba(255, 255, 255, 0.9);
    margin: 0;
}

.ticket-button {
    align-self: flex-start;
    display: inline-block;
    margin-top: 4px;
    padding: 14px 40px;
    background: #1a1a1a;
    border: none;
    border-radius: 8px;
    text-decoration: none;
    color: white;
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 1rem;
    text-align: center;
    cursor: pointer;
    transition: background 0.3s ease, transform 0.2s ease;
}

.ticket-button:hover {
    background: #333;
    transform: translateY(-2px);
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

@media (max-width: 720px) {
    .event-layout {
        grid-template-columns: 1fr;
        gap: 22px;
    }

    .event-poster {
        max-width: 420px;
    }

    .event-title {
        font-size: clamp(1.8rem, 8vw, 2.5rem);
    }
}
</style>
