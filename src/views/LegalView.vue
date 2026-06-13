<script setup lang="ts">
import {ref, watch} from 'vue'
import {useRoute} from 'vue-router'
import {useSeoMeta, useHead} from '@unhead/vue'
import {marked} from 'marked'

type Slug = 'impressum' | 'datenschutz' | 'agb'

const TITLES: Record<Slug, string> = {
    impressum: 'Impressum',
    datenschutz: 'Datenschutzerklärung',
    agb: 'AGB',
}

const route = useRoute()
const html = ref('')
const loading = ref(true)
const notFound = ref(false)

const currentSlug = ref<Slug | null>(null)

useSeoMeta({
    robots: 'noindex, nofollow',
})

async function loadSlug(slug: Slug) {
    loading.value = true
    notFound.value = false
    html.value = ''
    try {
        const response = await fetch(`/legal/${slug}.md`)
        if (!response.ok) {
            notFound.value = true
            return
        }
        const markdown = await response.text()
        html.value = await marked.parse(markdown)
        currentSlug.value = slug
    } catch (e) {
        notFound.value = true
    } finally {
        loading.value = false
    }
}

watch(
    () => route.params.slug,
    (raw) => {
        const slug = String(raw) as Slug
        if (slug === 'impressum' || slug === 'datenschutz' || slug === 'agb') {
            loadSlug(slug)
            useSeoMeta({title: `${TITLES[slug]} | ECLIPSE BOUNDARIES`})
            useHead({
                link: [{rel: 'canonical', href: `https://eclipseboundaries.ch/legal/${slug}`}],
            })
        } else {
            notFound.value = true
            loading.value = false
        }
    },
    {immediate: true},
)
</script>

<template>
    <div class="container">
        <router-link to="/" class="page-back">← Home</router-link>

        <article class="legal-card">
            <p v-if="loading" class="status">Loading…</p>
            <p v-else-if="notFound" class="status">Page not found.</p>
            <div v-else class="legal-content" v-html="html" />
        </article>
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

@font-face {
    font-family: 'Matter-Regular';
    src: url('/fonts/Matter-Regular.otf') format('opentype');
    font-weight: normal;
    font-style: normal;
}

.container {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 720px;
    gap: 24px;
    padding-top: clamp(16px, 4vh, 48px);
}

.legal-card {
    width: 100%;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 12px;
    padding: 36px 40px;
    box-shadow: 0 4px 15px rgba(108, 92, 231, 0.2);
    color: #1a1a1a;
}

.status {
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 1rem;
    color: #555;
    margin: 0;
    text-align: center;
}

.legal-content {
    font-family: 'Matter-Regular', sans-serif;
    font-size: 0.95rem;
    line-height: 1.6;
    color: #1a1a1a;
}

.legal-content :deep(h1) {
    font-family: 'Matter-Heavy', sans-serif;
    font-size: 1.6rem;
    margin: 0 0 20px;
}

.legal-content :deep(h2) {
    font-family: 'Matter-Heavy', sans-serif;
    font-size: 1.15rem;
    margin: 28px 0 10px;
}

.legal-content :deep(h3) {
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 1rem;
    margin: 20px 0 8px;
}

.legal-content :deep(p) {
    margin: 0 0 12px;
}

.legal-content :deep(ul),
.legal-content :deep(ol) {
    margin: 0 0 12px;
    padding-left: 24px;
}

.legal-content :deep(li) {
    margin-bottom: 4px;
}

.legal-content :deep(strong) {
    font-family: 'Matter-SemiBold', sans-serif;
}

.legal-content :deep(a) {
    color: #6C5CE7;
    text-decoration: underline;
}

.legal-content :deep(a:hover) {
    opacity: 0.8;
}

@media (max-width: 600px) {
    .container {
        gap: 20px;
    }

    .legal-card {
        padding: 24px 20px;
    }

    .legal-content {
        font-size: 0.9rem;
    }

    .legal-content :deep(h1) {
        font-size: 1.4rem;
    }
}
</style>
