<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSeoMeta } from '@unhead/vue'
import { supabase } from '@/supabase'

interface Artist {
    id: string
    name: string
    picture_url: string | null
    about: string | null
}

function hasAbout(a: Artist | null): boolean {
    return !!a?.about && a.about.trim().length > 0
}

const route = useRoute()
const router = useRouter()
const artistId = route.params.artistId as string

function onBack() {
    if (window.history.length > 1) {
        router.back()
    } else {
        router.push('/')
    }
}

const artist = ref<Artist | null>(null)
const loading = ref(true)
const notFound = ref(false)

onMounted(async () => {
    const { data, error } = await supabase
        .from('artists')
        .select('id, name, picture_url, about')
        .eq('id', artistId)
        .maybeSingle()

    if (error || !data) {
        notFound.value = true
        loading.value = false
        return
    }

    artist.value = data as Artist
    loading.value = false
})

useSeoMeta({
    title: () => artist.value
        ? `${artist.value.name} | ECLIPSE BOUNDARIES`
        : 'Loading… | ECLIPSE BOUNDARIES',
    robots: 'noindex',
})
</script>

<template>
    <main class="artist-detail">
        <button type="button" class="page-back" @click="onBack">← Back</button>

        <div v-if="loading" class="state">Loading…</div>
        <div v-else-if="notFound" class="state">
            <h1>Artist not found</h1>
            <router-link to="/residents" class="page-back">← All residents</router-link>
        </div>
        <article v-else-if="artist" class="artist-layout">
            <div class="artist-portrait">
                <img
                    v-if="artist.picture_url"
                    :src="artist.picture_url"
                    :alt="`${artist.name} portrait`"
                    class="artist-picture"
                    loading="eager"
                />
                <div v-else class="artist-picture placeholder" aria-hidden="true">
                    {{ artist.name.charAt(0).toUpperCase() }}
                </div>
            </div>

            <div class="artist-info">
                <h1 class="artist-name">{{ artist.name }}</h1>
                <section
                    v-if="hasAbout(artist)"
                    class="artist-about-card"
                    aria-label="About the artist"
                >
                    <p class="artist-about-text">{{ artist.about }}</p>
                </section>
            </div>
        </article>
    </main>
</template>

<style scoped>
.artist-detail {
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

/* Two columns: portrait left, name + bio right. */
.artist-layout {
    display: grid;
    grid-template-columns: minmax(0, 360px) 1fr;
    align-items: start;
    gap: 32px;
    width: 100%;
}

.artist-portrait {
    width: 100%;
    aspect-ratio: 1 / 1;
    border-radius: 16px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.95);
    box-shadow: 0 4px 15px rgba(108, 92, 231, 0.2);
}

.artist-picture {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}

.artist-picture.placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #6c5ce7 0%, #1a1a1a 100%);
    color: white;
    font-family: 'Matter-Heavy', sans-serif;
    font-size: 6rem;
}

.artist-info {
    display: flex;
    flex-direction: column;
    gap: 20px;
    min-width: 0;
}

.artist-name {
    margin: 0;
    font-family: 'Matter-Heavy', sans-serif;
    font-size: clamp(2rem, 5vw, 3.25rem);
    line-height: 1.05;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: white;
    text-shadow: 0 4px 24px rgba(108, 92, 231, 0.4);
    overflow-wrap: break-word;
}

.artist-about-card {
    width: 100%;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 12px;
    padding: 20px 24px;
    box-shadow: 0 4px 15px rgba(108, 92, 231, 0.2);
}

.artist-about-text {
    margin: 0;
    font-family: 'Matter-Regular', sans-serif;
    font-size: 0.98rem;
    line-height: 1.55;
    color: #1a1a1a;
    white-space: pre-wrap;
    overflow-wrap: break-word;
}

@media (max-width: 720px) {
    .artist-layout {
        grid-template-columns: 1fr;
        gap: 22px;
    }

    .artist-portrait {
        max-width: 420px;
    }

    .artist-name {
        font-size: clamp(2rem, 9vw, 2.75rem);
    }
}
</style>
