<script setup lang="ts">
import {ref, onMounted} from 'vue'
import {useSeoMeta, useHead} from '@unhead/vue'
import {supabase} from '@/supabase'
import {MANDATOR_ID} from '@/lib/shop/config'

interface TeamMember {
    id: string
    full_name: string
    image_url: string | null
    general_roles: string[]
    description: string | null
}

const members = ref<TeamMember[]>([])
const loading = ref(true)

function hasDescription(m: TeamMember): boolean {
    return !!m.description && m.description.trim().length > 0
}

onMounted(async () => {
    // The `team_members` table is owned by the Syvora ERP and is mandator-scoped
    // — the anon key's RLS does not filter by tenant, so we must scope by
    // mandator ourselves. Only publicly-visible members are shown.
    const {data, error} = await supabase
        .from('team_members')
        .select('id, full_name, image_url, general_roles, description')
        .eq('mandator_id', MANDATOR_ID)
        .eq('is_publicly_visible', true)
        .order('full_name', {ascending: true})

    if (error) {
        console.error('Failed to load team:', error)
    }
    if (data) {
        members.value = data as TeamMember[]
    }
    loading.value = false
})

useSeoMeta({
    title: 'About Us | ECLIPSE BOUNDARIES',
    description: 'The people behind the ECLIPSE BOUNDARIES collective.',
})

useHead({
    link: [{rel: 'canonical', href: 'https://eclipseboundaries.ch/about'}],
})
</script>

<template>
    <main class="page">
        <h1 class="page-title">About Us</h1>

        <div v-if="loading" class="state">Loading…</div>
        <p v-else-if="!members.length" class="state">No team members to show yet.</p>

        <div v-else class="grid">
            <article v-for="member in members" :key="member.id" class="card">
                <div class="portrait-wrap">
                    <img
                        v-if="member.image_url"
                        :src="member.image_url"
                        :alt="`${member.full_name} portrait`"
                        class="portrait"
                        loading="lazy"
                    />
                    <div v-else class="portrait placeholder" aria-hidden="true">
                        {{ member.full_name.charAt(0).toUpperCase() }}
                    </div>
                </div>
                <h2 class="name">{{ member.full_name }}</h2>
                <p v-if="member.general_roles.length" class="roles">
                    {{ member.general_roles.join(' · ') }}
                </p>
                <p v-if="hasDescription(member)" class="description">
                    {{ member.description }}
                </p>
            </article>
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
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 24px;
}

.card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 16px;
    padding: 16px;
    box-shadow: 0 4px 15px rgba(108, 92, 231, 0.2);
}

.portrait-wrap {
    width: 100%;
    aspect-ratio: 1 / 1;
    border-radius: 12px;
    overflow: hidden;
    background: rgba(108, 92, 231, 0.1);
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
    background: linear-gradient(135deg, #6c5ce7 0%, #1a1a1a 100%);
    font-family: 'Matter-Heavy', sans-serif;
    font-size: 3rem;
    color: white;
}

.name {
    margin: 0;
    font-family: 'Matter-Heavy', sans-serif;
    font-size: 1.25rem;
    color: #1a1a1a;
    overflow-wrap: break-word;
}

.roles {
    margin: 0;
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #6c5ce7;
}

.description {
    margin: 0;
    font-family: 'Matter-Regular', sans-serif;
    font-size: 0.95rem;
    line-height: 1.55;
    color: #1a1a1a;
    white-space: pre-wrap;
    overflow-wrap: break-word;
}

@media (max-width: 600px) {
    .grid {
        grid-template-columns: 1fr;
        gap: 16px;
    }
}
</style>
