import Vue from 'vue'
import VueRouter from 'vue-router'

Vue.use(VueRouter)

// 路由懒加载
const GanttView = () => import(/* webpackChunkName: "gantt-view" */ '../views/GanttView.vue')
const HolidayTestView = () => import(/* webpackChunkName: "holiday-test" */ '../views/HolidayTestView.vue')

const routes = [
  {
    path: '/',
    name: 'GanttView',
    component: GanttView,
    meta: {
      title: 'Gantt Chart',
      keepAlive: true // 缓存组件实例
    }
  },
  {
    path: '/holiday-test',
    name: 'HolidayTestView',
    component: HolidayTestView,
    meta: {
      title: 'Holiday Feature Test',
      keepAlive: false
    }
  },
  {
    path: '*',
    redirect: '/'
  }
]

const router = new VueRouter({
  mode: 'history',
  base: process.env.BASE_URL,
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else {
      return { x: 0, y: 0 }
    }
  }
})

// 路由守卫 - 设置页面标题
router.beforeEach((to, from, next) => {
  if (to.meta.title) {
    document.title = to.meta.title
  }
  next()
})

export default router
