<template>
    <div class="gradient-background">
        <router-view />
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

.gradient-background {
    background: linear-gradient(300deg, white, #73c3fe);
    background-size: 120% 120%;
    animation: gradient-animation 12s ease infinite;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
}

@keyframes gradient-animation {
    0% {
        background-position: 0% 50%;
    }
    50% {
        background-position: 100% 50%;
    }
    100% {
        background-position: 0% 50%;
    }
}
</style>
