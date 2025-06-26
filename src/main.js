import Vue from 'vue'
// 全量引入Element UI
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'

// 引入甘特图样式
import '@/styles/themes.css'
import '@/styles/themes-dhtmlx.css'
import '@/styles/performance.css'
import '@/styles/gantt-bar.css'

// 功能配置
import { isDebuggingEnabled } from '@/config/features'

import App from './App.vue'
import router from './router'
import store from './store'

// 注册Element UI - 全量注册
Vue.use(ElementUI)

Vue.config.productionTip = false

// 性能监控 - 仅在开发环境
if (process.env.NODE_ENV === 'development') {
  Vue.config.performance = true
}

// 错误处理 - 完全静默处理
Vue.config.errorHandler = (err, vm, info) => {
  // 静默处理错误，不输出到控制台
  // 在生产环境中可以将错误发送到日志服务
}

// 禁用所有 console 输出（如果调试被禁用）
if (!isDebuggingEnabled()) {
  const noop = () => {}
  console.log = noop
  console.warn = noop
  console.error = noop
  console.info = noop
  console.debug = noop
  console.trace = noop
}

// 创建Vue实例
const app = new Vue({
  router,
  store,
  render: h => h(App)
})

// 挂载应用
app.$mount('#app')

// 应用挂载后自动生成mock数据
// app.$store.dispatch('generateDemoDataset')

// 导出应用实例用于测试
export default app
