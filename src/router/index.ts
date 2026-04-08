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
    ],
})

export default router
