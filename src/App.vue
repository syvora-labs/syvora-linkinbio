<template>
    <div class="gradient-background">
        <router-view />
    </div>
</template>

<style scoped>
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
