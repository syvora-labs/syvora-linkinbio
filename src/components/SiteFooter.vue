<script setup lang="ts">
</script>

<template>
    <footer class="site-footer">
        <nav class="legal-nav">
            <router-link to="/legal/impressum">Impressum</router-link>
            <span class="sep">·</span>
            <router-link to="/legal/datenschutz">Datenschutz</router-link>
            <span class="sep">·</span>
            <router-link to="/legal/agb">AGB</router-link>
        </nav>
        <p class="copyright">© {{ new Date().getFullYear() }} ECLIPSE BOUNDARIES</p>
    </footer>
</template>

<style scoped>
@font-face {
    font-family: 'Matter-Regular';
    src: url('/fonts/Matter-Regular.otf') format('opentype');
    font-weight: normal;
    font-style: normal;
}

.site-footer {
    width: 100%;
    padding: 32px 16px 16px;
    margin-top: 32px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    font-family: 'Matter-Regular', sans-serif;
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.75);
    position: relative;
    z-index: 2;
}

.legal-nav {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: center;
}

.legal-nav a {
    color: rgba(255, 255, 255, 0.85);
    text-decoration: none;
    transition: opacity 0.2s ease;
}

.legal-nav a:hover {
    opacity: 0.7;
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
