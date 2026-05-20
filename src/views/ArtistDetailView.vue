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
        <router-link to="/" class="brand-link">ECLIPSE BOUNDARIES</router-link>

        <div v-if="loading" class="state">Loading…</div>
        <div v-else-if="notFound" class="state">
            <h1>Artist not found</h1>
            <router-link to="/" class="back-link">← Back to home</router-link>
        </div>
        <article v-else-if="artist" class="artist-card">
            <div v-if="artist.picture_url" class="artist-picture-wrap">
                <img
                    :src="artist.picture_url"
                    :alt="`${artist.name} portrait`"
                    class="artist-picture"
                    loading="eager"
                />
            </div>
            <div v-else class="artist-picture-placeholder" aria-hidden="true">
                {{ artist.name.charAt(0).toUpperCase() }}
            </div>
            <h1 class="artist-name">{{ artist.name }}</h1>
        </article>

        <section
            v-if="artist && hasAbout(artist)"
            class="artist-about-card"
            aria-label="About the artist"
        >
            <p class="artist-about-text">{{ artist.about }}</p>
        </section>

        <button v-if="artist" type="button" class="back-link" @click="onBack">
            ← Back
        </button>
    </main>
</template>

<style scoped>
.artist-detail {
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

.artist-card {
    width: 100%;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 15px rgba(108, 92, 231, 0.2);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-bottom: 28px;
}

.artist-picture-wrap {
    width: 100%;
    aspect-ratio: 1 / 1;
    background: #1a1a1a;
}

.artist-picture {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}

.artist-picture-placeholder {
    width: 100%;
    aspect-ratio: 1 / 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #6c5ce7 0%, #1a1a1a 100%);
    color: white;
    font-family: 'Matter-Heavy', sans-serif;
    font-size: 6rem;
    letter-spacing: 0;
}

.artist-name {
    margin: 24px 24px 0;
    font-family: 'Matter-Heavy', sans-serif;
    font-size: 1.6rem;
    color: #1a1a1a;
    text-align: center;
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

.back-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    align-self: center;
    margin-top: 4px;
    padding: 10px 20px;
    background: rgba(255, 255, 255, 0.95);
    border: none;
    border-radius: 10px;
    color: #1a1a1a;
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 0.95rem;
    text-decoration: none;
    box-shadow: 0 4px 15px rgba(108, 92, 231, 0.2);
    cursor: pointer;
    transition: box-shadow 0.25s ease, transform 0.25s ease;
}

.back-link:hover {
    box-shadow: 0 6px 20px rgba(108, 92, 231, 0.4);
    transform: translateX(-2px);
}
</style>
