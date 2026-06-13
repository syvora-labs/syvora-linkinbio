<script setup lang="ts">
import {ref, computed, onMounted} from 'vue'
import {useSeoMeta, useHead} from '@unhead/vue'
import {supabase} from '@/supabase'

interface EventRow {
    id: string
    title: string
    artwork_url: string | null
    location: string
    event_date: string
}

const upcoming = ref<EventRow[]>([])
const past = ref<EventRow[]>([])
const loading = ref(true)

onMounted(async () => {
    const nowIso = new Date().toISOString()

    const [upcomingRes, pastRes] = await Promise.all([
        supabase
            .from('events')
            .select('id, title, artwork_url, location, event_date')
            .eq('is_draft', false)
            .eq('is_archived', false)
            .gte('event_date', nowIso)
            .order('event_date', {ascending: true}),
        supabase
            .from('events')
            .select('id, title, artwork_url, location, event_date')
            .eq('is_draft', false)
            .eq('is_archived', false)
            .lt('event_date', nowIso)
            .order('event_date', {ascending: false})
            .limit(24),
    ])

    if (upcomingRes.data) upcoming.value = upcomingRes.data as EventRow[]
    if (pastRes.data) past.value = pastRes.data as EventRow[]
    loading.value = false
})

const hasNothing = computed(
    () => !loading.value && !upcoming.value.length && !past.value.length,
)

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

useSeoMeta({
    title: 'Events | ECLIPSE BOUNDARIES',
    description: 'Upcoming and past ECLIPSE BOUNDARIES events.',
})

useHead({
    link: [{rel: 'canonical', href: 'https://eclipseboundaries.ch/events'}],
})
</script>

<template>
    <main class="page">
        <h1 class="page-title">Events</h1>

        <div v-if="loading" class="state">Loading…</div>
        <p v-else-if="hasNothing" class="state">No events to show yet.</p>

        <template v-else>
            <section v-if="upcoming.length" class="event-section" aria-labelledby="upcoming-h">
                <h2 id="upcoming-h" class="section-label">Upcoming</h2>
                <div class="event-list">
                    <router-link
                        v-for="event in upcoming"
                        :key="event.id"
                        :to="{ name: 'event-detail', params: { eventId: event.id } }"
                        class="event-row"
                    >
                        <img
                            v-if="event.artwork_url"
                            :src="event.artwork_url"
                            :alt="`${event.title} artwork`"
                            class="thumb"
                            loading="lazy"
                        />
                        <div v-else class="thumb placeholder" aria-hidden="true" />
                        <div class="info">
                            <span class="title">{{ event.title }}</span>
                            <span class="meta">{{ formatDate(event.event_date) }} · {{ event.location }}</span>
                        </div>
                        <span class="chevron" aria-hidden="true">→</span>
                    </router-link>
                </div>
            </section>

            <section v-if="past.length" class="event-section" aria-labelledby="past-h">
                <h2 id="past-h" class="section-label">Past</h2>
                <div class="event-list">
                    <router-link
                        v-for="event in past"
                        :key="event.id"
                        :to="{ name: 'event-detail', params: { eventId: event.id } }"
                        class="event-row past"
                    >
                        <img
                            v-if="event.artwork_url"
                            :src="event.artwork_url"
                            :alt="`${event.title} artwork`"
                            class="thumb"
                            loading="lazy"
                        />
                        <div v-else class="thumb placeholder" aria-hidden="true" />
                        <div class="info">
                            <span class="title">{{ event.title }}</span>
                            <span class="meta">{{ formatDate(event.event_date) }} · {{ event.location }}</span>
                        </div>
                        <span class="chevron" aria-hidden="true">→</span>
                    </router-link>
                </div>
            </section>
        </template>
    </main>
</template>

<style scoped>
.page {
    width: 100%;
    max-width: 760px;
    margin: 0 auto;
    padding-top: clamp(24px, 6vh, 64px);
}

.page-title {
    font-family: 'Matter-Heavy', sans-serif;
    font-size: clamp(2.5rem, 8vw, 5rem);
    text-transform: uppercase;
    letter-spacing: 2px;
    color: white;
    margin: 0 0 32px;
    text-shadow: 0 4px 24px rgba(108, 92, 231, 0.4);
}

.state {
    font-family: 'Matter-SemiBold', sans-serif;
    color: rgba(255, 255, 255, 0.85);
}

.event-section {
    margin-bottom: 36px;
}

.section-label {
    font-family: 'Matter-Heavy', sans-serif;
    font-size: 0.85rem;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.85);
    margin: 0 0 14px;
}

.event-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.event-row {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.95);
    box-shadow: 0 4px 15px rgba(108, 92, 231, 0.2);
    text-decoration: none;
    color: #1a1a1a;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.event-row:hover {
    transform: translateX(3px);
    box-shadow: 0 6px 20px rgba(108, 92, 231, 0.4);
}

.event-row.past {
    opacity: 0.82;
}

.thumb {
    width: 64px;
    height: 64px;
    flex-shrink: 0;
    border-radius: 8px;
    object-fit: cover;
}

.thumb.placeholder {
    background: rgba(0, 0, 0, 0.06);
}

.info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
}

.title {
    font-family: 'Matter-Heavy', sans-serif;
    font-size: 1.05rem;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.meta {
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 0.82rem;
    color: #555;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.chevron {
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 1.1rem;
    flex-shrink: 0;
}
</style>
