<script setup lang="ts">
import {ref, onMounted} from 'vue'

interface Link {
    title: string
    link: string
}

const links = ref<Link[]>([])

const socials = [
    {label: 'YouTube', href: 'https://www.youtube.com/@eclipse_boundaries'},
    {label: 'Instagram', href: 'https://www.instagram.com/eclipse_boundaries/'},
    {label: 'TikTok', href: 'https://tiktok.com/@eclipse_boundaries'},
]

const year = new Date().getFullYear()

onMounted(async () => {
    try {
        const response = await fetch('/data/links.json')
        links.value = await response.json()
    } catch (error) {
        console.error('Error loading links:', error)
    }
})
</script>

<template>
    <footer class="site-footer">
        <div class="footer-inner">
            <nav class="footer-socials" aria-label="Social media">
                <a
                    v-for="s in socials"
                    :key="s.href"
                    :href="s.href"
                    target="_blank"
                    rel="noopener noreferrer"
                >{{ s.label }}</a>
            </nav>

            <nav v-if="links.length" class="footer-links" aria-label="More links">
                <a
                    v-for="link in links"
                    :key="link.link"
                    :href="link.link"
                    target="_blank"
                    rel="noopener noreferrer"
                >{{ link.title }}</a>
            </nav>

            <nav class="legal-nav" aria-label="Legal">
                <router-link to="/legal/impressum">Impressum</router-link>
                <span class="sep">·</span>
                <router-link to="/legal/datenschutz">Datenschutz</router-link>
                <span class="sep">·</span>
                <router-link to="/legal/agb">AGB</router-link>
            </nav>

            <p class="copyright">© {{ year }} ECLIPSE BOUNDARIES</p>
        </div>
    </footer>
</template>

<style scoped>
@font-face {
    font-family: 'Matter-Regular';
    src: url('/fonts/Matter-Regular.otf') format('opentype');
    font-weight: normal;
    font-style: normal;
}

@font-face {
    font-family: 'Matter-SemiBold';
    src: url('/fonts/Matter-SemiBold.otf') format('opentype');
    font-weight: normal;
    font-style: normal;
}

.site-footer {
    width: 100%;
    padding: 40px 16px 24px;
    margin-top: 48px;
    position: relative;
    z-index: 2;
    border-top: 1px solid rgba(255, 255, 255, 0.12);
}

.footer-inner {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    font-family: 'Matter-Regular', sans-serif;
    color: rgba(255, 255, 255, 0.75);
}

.footer-socials {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 22px;
}

.footer-socials a {
    color: rgba(255, 255, 255, 0.9);
    text-decoration: none;
    font-family: 'Matter-SemiBold', sans-serif;
    font-size: 0.95rem;
    transition: opacity 0.2s ease;
}

.footer-links {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    max-width: 640px;
}

.footer-links a {
    color: rgba(255, 255, 255, 0.7);
    text-decoration: none;
    font-size: 0.82rem;
    text-align: center;
    transition: opacity 0.2s ease;
}

.legal-nav {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: center;
    margin-top: 4px;
}

.legal-nav a {
    color: rgba(255, 255, 255, 0.85);
    text-decoration: none;
    font-size: 0.8rem;
    transition: opacity 0.2s ease;
}

.footer-socials a:hover,
.footer-links a:hover,
.legal-nav a:hover {
    opacity: 0.65;
    text-decoration: underline;
}

.sep {
    opacity: 0.5;
}

.copyright {
    margin: 0;
    opacity: 0.7;
    font-size: 0.75rem;
}
</style>
