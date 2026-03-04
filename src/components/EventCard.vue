<script setup lang="ts">
import {ref, onMounted} from 'vue'
import {supabase} from '@/supabase'

interface Event {
    title: string
    artwork_url: string
    location: string
    event_date: string
    ticket_link: string
}

const event = ref<Event | null>(null)

onMounted(async () => {
    const {data, error} = await supabase
        .from('events')
        .select('title, artwork_url, location, event_date, ticket_link')
        .eq('is_draft', false)
        .eq('is_archived', false)
        .gte('event_date', new Date().toISOString())
        .order('event_date', {ascending: true})
        .limit(1)
        .maybeSingle()

    if (data) {
        event.value = data
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
</script>

<template>
    <div v-if="event" class="event-card">
        <img :src="event.artwork_url" :alt="event.title" class="event-cover" />
        <div class="event-details">
            <h2 class="event-title">{{ event.title }}</h2>
            <p class="event-location">{{ event.location }}</p>
            <p class="event-date">{{ formatEventDate(event.event_date) }}</p>
            <a
                :href="event.ticket_link"
                target="_blank"
                rel="noopener noreferrer"
                class="ticket-button"
            >
                TICKETS
            </a>
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
}
</style>
