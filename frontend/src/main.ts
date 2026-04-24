import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import Lara from '@primeuix/themes/lara'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { createApp } from 'vue'

import App from './App.vue'
import router from './router'
import './style.css'
import 'primeicons/primeicons.css'

const app = createApp(App)
const pinia = createPinia()
const queryClient = new QueryClient()

app.use(pinia)
app.use(router)
app.use(VueQueryPlugin, { queryClient })
app.use(PrimeVue, {
  ripple: true,
  theme: {
    preset: Lara,
  },
})

app.mount('#app')