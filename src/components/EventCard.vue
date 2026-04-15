<script setup lang="ts">
import {ref, computed, onMounted} from 'vue'
import {supabase} from '@/supabase'

interface Event {
    id: string
    title: string
    artwork_url: string | null
    location: string
    event_date: string
    ticket_link: string | null
}

const events = ref<Event[]>([])

const featured = computed(() => events.value[0] ?? null)
const upcoming = computed(() => events.value.slice(1))

onMounted(async () => {
    const {data} = await supabase
        .from('events')
        .select('id, title, artwork_url, location, event_date, ticket_link')
        .eq('is_draft', false)
        .eq('is_archived', false)
        .gte('event_date', new Date().toISOString())
        .order('event_date', {ascending: true})
        .limit(10)

    if (data) {
        events.value = data
    }
})

function formatEventDate(dateStr: string): string {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

function formatCompactDate(dateStr: string): string {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}
</script>

<template>
    <section v-if="featured" class="events" aria-labelledby="featured-event-heading">
        <article class="event-card">
            <img
                v-if="featured.artwork_url"
                :src="featured.artwork_url"
                :alt="`${featured.title} event artwork — ${formatCompactDate(featured.event_date)} at ${featured.location}`"
                class="event-cover"
                fetchpriority="high"
                loading="eager"
            />
            <div class="event-details">
                <h2 id="featured-event-heading" class="event-title">
                    {{ featured.title }}
                </h2>
                <p class="event-location">{{ featured.location }}</p>
                <p class="event-date">{{ formatEventDate(featured.event_date) }}</p>
                <a
                    v-if="featured.ticket_link"
                    :href="featured.ticket_link"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="ticket-button"
                >
                    TICKETS
                </a>
                <router-link
                    v-else
                    :to="{ name: 'ticket-shop', params: { eventId: featured.id } }"
                    class="ticket-button"
                >
                    TICKETS
                </router-link>
            </div>
        </article>

        <section v-if="upcoming.length" class="upcoming-list" aria-labelledby="upcoming-heading">
            <h2 id="upcoming-heading" class="upcoming-heading">More upcoming shows</h2>
            <template v-for="event in upcoming" :key="event.id">
                <a
                    v-if="event.ticket_link"
                    :href="event.ticket_link"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="upcoming-row"
                >
                    <img
                        v-if="event.artwork_url"
                        :src="event.artwork_url"
                        :alt="`${event.title} — ${formatCompactDate(event.event_date)} at ${event.location}`"
                        class="upcoming-thumb"
                        loading="lazy"
                    />
                    <div class="upcoming-info">
                        <p class="upcoming-title">{{ event.title }}</p>
                        <p class="upcoming-meta">
                            {{ formatCompactDate(event.event_date) }} · {{ event.location }}
                        </p>
                    </div>
                    <span class="upcoming-chevron" aria-hidden="true">→</span>
                </a>
                <router-link
                    v-else
                    :to="{ name: 'ticket-shop', params: { eventId: event.id } }"
                    class="upcoming-row"
                >
                    <img
                        v-if="event.artwork_url"
                        :src="event.artwork_url"
                        :alt="`${event.title} — ${formatCompactDate(event.event_date)} at ${event.location}`"
                        class="upcoming-thumb"
                        loading="lazy"
                    />
                    <div class="upcoming-info">
                        <p class="upcoming-title">{{ event.title }}</p>
                        <p class="upcoming-meta">
                            {{ formatCompactDate(event.event_date) }} · {{ event.location }}
                        </p>
                    </div>
                    <span class="upcoming-chevron" aria-hidden="true">→</span>
                </router-link>
            </template>
        </section>
    </section>
</template>

<style scoped>
.events {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 20px;
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
    font-size: 1.4rem;
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
    border-radius: 8px;
    text-decoration: none;
    color: white;
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 1rem;
    text-align: center;
    transition: background 0.3s ease;
    cursor: pointer;
}

.ticket-button:hover {
    background: #333;
}

.upcoming-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.upcoming-heading {
    font-family: 'Matter-Heavy', sans-serif;
    font-size: 0.85rem;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: white;
    margin: 4px 0 2px;
    text-shadow: 0 2px 4px rgba(115, 195, 254, 0.3);
}

.upcoming-row {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 10px 16px 10px 10px;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 10px;
    text-decoration: none;
    color: #1a1a1a;
    box-shadow: 0 4px 15px rgba(115, 195, 254, 0.2);
    transition: box-shadow 0.25s ease, transform 0.25s ease;
}

.upcoming-row:hover {
    box-shadow: 0 6px 20px rgba(115, 195, 254, 0.4);
    transform: translateX(2px);
}

.upcoming-thumb {
    width: 56px;
    height: 56px;
    border-radius: 8px;
    object-fit: cover;
    flex-shrink: 0;
}

.upcoming-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.upcoming-title {
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 1rem;
    color: #1a1a1a;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.upcoming-meta {
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 0.82rem;
    color: #555;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.upcoming-chevron {
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 1.1rem;
    color: #1a1a1a;
    flex-shrink: 0;
}

@media (max-width: 600px) {
    .event-title {
        font-size: 1.2rem;
    }

    .event-details {
        padding: 16px 20px 20px;
    }

    .ticket-button {
        padding: 12px;
    }

    .upcoming-thumb {
        width: 48px;
        height: 48px;
    }

    .upcoming-title {
        font-size: 0.95rem;
    }

    .upcoming-meta {
        font-size: 0.78rem;
    }
}
</style>
