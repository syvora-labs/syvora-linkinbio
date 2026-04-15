import { createApp } from 'vue'
import { createHead } from '@unhead/vue'
import App from './App.vue'
import router from './router'
import './styles.css'

const head = createHead()

createApp(App).use(head).use(router).mount('#app')
