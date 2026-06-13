<script setup lang="ts">
import {ref, onMounted} from 'vue'
import {useSeoMeta, useHead} from '@unhead/vue'
import {supabase} from '@/supabase'

interface Artist {
    id: string
    name: string
    picture_url: string | null
}

const artists = ref<Artist[]>([])
const loading = ref(true)

onMounted(async () => {
    // Residents are the artists managed by the collective — flagged `is_managed`
    // in the ERP-owned `artists` table. Guest/lineup-only artists are excluded.
    const {data, error} = await supabase
        .from('artists')
        .select('id, name, picture_url')
        .eq('is_managed', true)
        .order('name', {ascending: true})

    if (error) {
        // e.g. PostgREST 42501 if anon lacks column-level SELECT on is_managed.
        console.error('Failed to load residents:', error)
    }
    if (data) {
        artists.value = data as Artist[]
    }
    loading.value = false
})

useSeoMeta({
    title: 'Residents | ECLIPSE BOUNDARIES',
    description: 'The artists of the ECLIPSE BOUNDARIES collective.',
})

useHead({
    link: [{rel: 'canonical', href: 'https://eclipseboundaries.ch/residents'}],
})
</script>

<template>
    <main class="page">
        <h1 class="page-title">Residents</h1>

        <div v-if="loading" class="state">Loading…</div>
        <p v-else-if="!artists.length" class="state">No residents to show yet.</p>

        <div v-else class="grid">
            <router-link
                v-for="artist in artists"
                :key="artist.id"
                :to="{ name: 'artist-detail', params: { artistId: artist.id } }"
                class="card"
            >
                <div class="portrait-wrap">
                    <img
                        v-if="artist.picture_url"
                        :src="artist.picture_url"
                        :alt="`${artist.name} portrait`"
                        class="portrait"
                        loading="lazy"
                    />
                    <div v-else class="portrait placeholder" aria-hidden="true">
                        {{ artist.name.charAt(0).toUpperCase() }}
                    </div>
                </div>
                <span class="name">{{ artist.name }}</span>
            </router-link>
        </div>
    </main>
</template>

<style scoped>
.page {
    width: 100%;
    max-width: 1100px;
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

.grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 20px;
}

.card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    text-decoration: none;
    color: white;
}

.portrait-wrap {
    width: 100%;
    aspect-ratio: 1 / 1;
    border-radius: 12px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.95);
    box-shadow: 0 4px 15px rgba(108, 92, 231, 0.2);
    transition: transform 0.25s ease, box-shadow 0.25s ease;
}

.card:hover .portrait-wrap {
    transform: translateY(-4px);
    box-shadow: 0 6px 20px rgba(108, 92, 231, 0.4);
}

.portrait {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}

.portrait.placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.95);
    font-family: 'Matter-Heavy', sans-serif;
    font-size: 3rem;
    color: #6C5CE7;
}

.name {
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 1.05rem;
    text-align: center;
}

@media (max-width: 600px) {
    .grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 14px;
    }
}
</style>
