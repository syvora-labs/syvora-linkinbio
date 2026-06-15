import {createRouter, createWebHistory} from 'vue-router'
import HomeView from '@/views/HomeView.vue'

const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '/',
            name: 'home',
            component: HomeView,
        },
        {
            path: '/events',
            name: 'events',
            component: () => import('@/views/EventsView.vue'),
        },
        {
            path: '/residents',
            name: 'residents',
            component: () => import('@/views/ResidentsView.vue'),
        },
        {
            path: '/about',
            name: 'about',
            component: () => import('@/views/AboutView.vue'),
        },
        {
            path: '/radio',
            name: 'radio',
            component: () => import('@/views/RadioView.vue'),
        },
        {
            path: '/event/:eventId',
            name: 'event-detail',
            component: () => import('@/views/EventDetailView.vue'),
        },
        {
            path: '/event/:eventId/tickets',
            name: 'ticket-shop',
            component: () => import('@/views/TicketShopView.vue'),
        },
        {
            path: '/event/:eventId/tickets/success',
            name: 'ticket-success',
            component: () => import('@/views/TicketSuccessView.vue'),
        },
        {
            path: '/tickets/order/:orderId',
            name: 'view-tickets',
            component: () => import('@/views/ViewTicketsView.vue'),
        },
        {
            path: '/artist/:artistId',
            name: 'artist-detail',
            component: () => import('@/views/ArtistDetailView.vue'),
        },
        {
            path: '/shop',
            name: 'shop',
            component: () => import('@/views/ShopView.vue'),
        },
        {
            path: '/shop/cart',
            name: 'shop-cart',
            component: () => import('@/views/CartView.vue'),
        },
        {
            path: '/shop/success',
            name: 'shop-success',
            component: () => import('@/views/ShopSuccessView.vue'),
        },
        {
            path: '/shop/product/:slug',
            name: 'shop-product',
            component: () => import('@/views/ProductDetailView.vue'),
        },
        {
            path: '/shop/order/:orderId',
            name: 'shop-order',
            component: () => import('@/views/OrderDetailView.vue'),
        },
        {
            path: '/legal/:slug(impressum|datenschutz|agb)',
            name: 'legal',
            component: () => import('@/views/LegalView.vue'),
        },
        {
            path: '/claim/:qrToken',
            name: 'claim',
            component: () => import('@/views/ClaimView.vue'),
        },
    ],
})

export default router
