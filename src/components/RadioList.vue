<script setup lang="ts">
import {ref, onMounted} from 'vue'
import {supabase} from '@/supabase'

interface Radio {
    title: string
    description: string | null
    release_date: string | null
    artists: string[]
    soundcloud_link: string | null
}

const radios = ref<Radio[]>([])

onMounted(async () => {
    const {data} = await supabase
        .from('radios')
        .select('title, description, release_date, artists, soundcloud_link')
        .eq('is_draft', false)
        .eq('is_archived', false)
        .order('release_date', {ascending: false})

    if (data) {
        radios.value = data
    }
})
</script>

<template>
    <div v-if="radios.length" class="radio-list">
        <h2 class="radio-heading">RADIOS</h2>
        <a
            v-for="radio in radios"
            :key="radio.title"
            :href="radio.soundcloud_link ?? undefined"
            target="_blank"
            rel="noopener noreferrer"
            class="radio-card"
            :class="{ 'no-link': !radio.soundcloud_link }"
        >
            <span class="radio-title">{{ radio.title }}</span>
        </a>
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

.radio-list {
    display: flex;
    flex-direction: column;
    width: 100%;
    gap: 15px;
}

.radio-heading {
    font-family: 'Matter-Heavy', sans-serif;
    font-size: 1.4rem;
    font-weight: 700;
    color: white;
    margin: 0;
    letter-spacing: 2px;
    text-shadow: 0 2px 4px rgba(115, 195, 254, 0.3);
}

.radio-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 16px 24px;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 8px;
    text-decoration: none;
    color: #1a1a1a;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(115, 195, 254, 0.2);
    cursor: pointer;
}

.radio-card:hover {
    box-shadow: 0 6px 20px rgba(115, 195, 254, 0.4);
}

.radio-card.no-link {
    pointer-events: none;
}

.radio-title {
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 1.3rem;
    font-weight: 600;
}

.radio-artists {
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 0.9rem;
    color: #555;
}

.radio-description {
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 0.85rem;
    color: #777;
    margin-top: 4px;
}

@media (max-width: 600px) {
    .radio-card {
        padding: 14px 20px;
    }

    .radio-title {
        font-size: 1rem;
    }

    .radio-heading {
        font-size: 1.2rem;
    }
}
</style>
