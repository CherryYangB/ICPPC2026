import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './styles/global.css'

createApp(App).use(router).mount('#app')

requestAnimationFrame(() => {
  const loading = document.getElementById('app-loading')
  if (loading) {
    loading.classList.add('hide')
    setTimeout(() => loading.remove(), 400)
  }
})
