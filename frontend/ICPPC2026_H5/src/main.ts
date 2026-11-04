import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { ensureQuestionCards } from './shared/questions'

// 启动即预取题目：失败时自动回退到本地兜底数据，不阻塞渲染
void ensureQuestionCards()

createApp(App).use(router).mount('#app')
