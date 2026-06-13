<script setup lang="ts">
import {ref, onMounted} from 'vue'
import {useSeoMeta, useHead} from '@unhead/vue'
import {supabase} from '@/supabase'

interface Radio {
    title: string
    release_date: string | null
    soundcloud_link: string | null
}

const radios = ref<Radio[]>([])
const loading = ref(true)

onMounted(async () => {
    const {data} = await supabase
        .from('radios')
        .select('title, release_date, soundcloud_link')
        .eq('is_draft', false)
        .eq('is_archived', false)
        .order('release_date', {ascending: false})

    if (data) {
        radios.value = data as Radio[]
    }
    loading.value = false
})

useSeoMeta({
    title: 'Radio | ECLIPSE BOUNDARIES',
    description: 'Mixes and radio sessions from the ECLIPSE BOUNDARIES collective.',
})

useHead({
    link: [{rel: 'canonical', href: 'https://eclipseboundaries.ch/radio'}],
})
</script>

<template>
    <main class="page">
        <h1 class="page-title">Radio</h1>

        <div v-if="loading" class="state">Loading…</div>
        <p v-else-if="!radios.length" class="state">No sessions published yet.</p>

        <div v-else class="radio-list">
            <a
                v-for="radio in radios"
                :key="radio.title"
                :href="radio.soundcloud_link ?? undefined"
                :target="radio.soundcloud_link ? '_blank' : undefined"
                rel="noopener noreferrer"
                class="radio-card"
                :class="{ 'no-link': !radio.soundcloud_link }"
            >
                <div class="radio-head">
                    <span class="radio-title">{{ radio.title }}</span>
                    <span v-if="radio.soundcloud_link" class="radio-play" aria-hidden="true">▶</span>
                </div>
            </a>
        </div>
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

.radio-list {
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.radio-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 18px 20px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.95);
    box-shadow: 0 4px 15px rgba(108, 92, 231, 0.2);
    text-decoration: none;
    color: #1a1a1a;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.radio-card:not(.no-link):hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(108, 92, 231, 0.4);
}

.radio-card.no-link {
    pointer-events: none;
}

.radio-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.radio-title {
    font-family: 'Matter-Heavy', sans-serif;
    font-size: 1.2rem;
    line-height: 1.2;
}

.radio-play {
    flex-shrink: 0;
    font-size: 0.85rem;
    color: #6C5CE7;
}
</style>
