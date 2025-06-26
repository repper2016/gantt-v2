<template>
  <div id="app">
    <!-- 性能监控工具条（仅开发环境且启用时） -->
    <div v-if="showPerformanceBar && isPerformanceMonitoringEnabled" class="performance-bar">
      <span class="performance-metric">
        FPS: <span :class="fpsClass">{{ fps }}</span>
      </span>
      <span class="performance-metric">
        Memory: <span :class="memoryClass">{{ memoryUsage }}MB</span>
        <span v-if="memoryTrend !== 'stable'" class="trend-indicator" :class="memoryTrend">
          {{ memoryTrend === 'increasing' ? '↗' : '↘' }}
        </span>
      </span>
      <span class="performance-metric">
        Render: <span :class="renderTimeClass">{{ averageRenderTime }}ms</span>
      </span>
      <button @click="togglePerformanceBar" class="performance-toggle">×</button>
    </div>

    <!-- 错误边界 -->
    <div v-if="hasError" class="error-boundary">
      <h3>⚠️ Application Error</h3>
      <p>{{ errorMessage }}</p>
      <button @click="reloadApp" class="reload-btn">Reload Application</button>
    </div>

    <!-- 主要内容区域 -->
    <div v-else class="app-content">
      <!-- 使用keep-alive缓存路由组件 -->
      <keep-alive :include="cachedComponents">
        <router-view
          :timeline-visible="shouldShowTimelineOverview && timelineVisible"
          :show-settings-dialog="showSettingsDialog"
          :current-view-mode="currentViewMode"
          @performance-update="handlePerformanceUpdate"
          @error="handleError"
          @settings-dialog-close="closeSettings"
          @view-mode-change="handleViewModeChange"
        />
      </keep-alive>
    </div>

    <!-- 性能监控按钮（开发环境且启用时） -->
    <button
      v-if="!showPerformanceBar && isDevelopment && isPerformanceMonitoringEnabled"
      @click="togglePerformanceBar"
      class="performance-monitor-btn"
      title="Show Performance Monitor"
    >
      📊
    </button>
  </div>
</template>

<script>
import { PerformanceMixin } from '@/mixins/performance'
import { globalPerformanceConfig } from '@/config/performance'
import {
  isPerformanceMonitoringEnabled,
  isDebuggingEnabled,
  getFeatureSummary,
  isUIFeatureEnabled
} from '@/config/features'

export default {
  name: 'App',
  mixins: [PerformanceMixin],

  data() {
    return {
      // 性能监控数据
      fps: 0,
      memoryUsage: 0,
      memoryTrend: 'stable',
      averageRenderTime: 0,
      showPerformanceBar: false,



      // 错误处理
      hasError: false,
      errorMessage: '',

      // 缓存的组件
      cachedComponents: ['GanttView'],

      // 性能监控定时器
      performanceTimer: null,
      fpsCounter: 0,
      lastFrameTime: 0,

      // Timeline 控制
      timelineVisible: true,

      // 设置对话框控制
      showSettingsDialog: false,

      // 视图模式控制
      currentViewMode: 'month'
    }
  },

  computed: {
    isDevelopment() {
      return process.env.NODE_ENV === 'development'
    },

    isPerformanceMonitoringEnabled() {
      return isPerformanceMonitoringEnabled()
    },

    // 是否显示Timeline Overview
    shouldShowTimelineOverview() {
      return isUIFeatureEnabled('showTimelineOverview')
    },

    fpsClass() {
      if (this.fps >= 55) return 'performance-good'
      if (this.fps >= 30) return 'performance-warning'
      return 'performance-error'
    },

    memoryClass() {
      const isDev = this.isDevelopment
      const warningThreshold = isDev ? 200 : 100
      const errorThreshold = isDev ? 300 : 200

      if (this.memoryUsage <= warningThreshold) return 'performance-good'
      if (this.memoryUsage <= errorThreshold) return 'performance-warning'
      return 'performance-error'
    },

    renderTimeClass() {
      if (this.averageRenderTime <= 8) return 'performance-good'
      if (this.averageRenderTime <= 16) return 'performance-warning'
      return 'performance-error'
    }
  },

  watch: {
    // 监听视图模式变化，无需额外处理，v-model已经更新了值
    currentViewMode(newVal) {
      // 视图模式变化时可以添加额外逻辑，比如日志记录
      console.log('视图模式切换到:', newVal)
    }
  },

  mounted() {
    this.initializePerformanceMonitoring()
    this.setupErrorHandling()
    this.initializeTheme()

    // 在开发环境且启用性能监控时自动显示
    if (this.isDevelopment && this.isPerformanceMonitoringEnabled) {
      this.showPerformanceBar = true
    }
  },

  beforeDestroy() {
    this.cleanupPerformanceMonitoring()
  },

  methods: {
    // 初始化主题 - 固定使用DHTMLX主题
    initializeTheme() {
      // 直接应用DHTMLX主题到body，确保全局样式生效
      document.body.className = 'gantt-theme-dhtmlx'
    },

    // 初始化性能监控
    initializePerformanceMonitoring() {
      if (!this.isDevelopment || !this.isPerformanceMonitoringEnabled) return

      this.startFPSMonitoring()
      this.startMemoryMonitoring()
    },

    // 启动FPS监控
    startFPSMonitoring() {
      let frameCount = 0
      let lastTime = performance.now()

      const countFPS = () => {
        frameCount++
        const currentTime = performance.now()

        if (currentTime - lastTime >= 1000) {
          this.fps = Math.round(frameCount * 1000 / (currentTime - lastTime))
          frameCount = 0
          lastTime = currentTime
        }

        requestAnimationFrame(countFPS)
      }

      requestAnimationFrame(countFPS)
    },

    // 启动内存监控（优化版）
    startMemoryMonitoring() {
      // 使用更长的间隔减少性能开销
      this.performanceTimer = setInterval(() => {
        // 使用RAF确保不阻塞主线程
        requestAnimationFrame(() => {
          this.updateMemoryUsage()
        })
      }, 5000) // 5秒间隔
    },

    // 更新内存使用情况
    updateMemoryUsage() {
      const memoryInfo = this.checkMemoryUsage()
      if (memoryInfo) {
        this.memoryUsage = memoryInfo.used
        this.memoryTrend = this.getMemoryTrend()

        // 向性能配置报告
        globalPerformanceConfig.adaptToPerformance({
          fps: this.fps,
          renderTime: this.averageRenderTime,
          memoryUsage: this.memoryUsage
        })
      }
    },

    // 处理性能数据更新
    handlePerformanceUpdate(data) {
      if (data.renderTime) {
        this.averageRenderTime = Math.round(data.renderTime * 100) / 100
      }

      // 动态调整性能配置
      globalPerformanceConfig.adaptToPerformance({
        fps: this.fps,
        renderTime: this.averageRenderTime,
        memoryUsage: this.memoryUsage
      })
    },

    // 错误处理设置
    setupErrorHandling() {
      // 全局错误处理 - 静默处理
      window.addEventListener('error', this.handleGlobalError)
      window.addEventListener('unhandledrejection', this.handleUnhandledRejection)
    },

    // 处理全局错误 - 静默处理
    handleGlobalError(event) {
      this.handleError(event.error.message)
    },

    // 处理未捕获的Promise拒绝 - 静默处理
    handleUnhandledRejection(event) {
      this.handleError(`Promise rejected: ${event.reason}`)
    },

    // 处理组件错误
    handleError(message) {
      this.hasError = true
      this.errorMessage = message

      // 发送错误报告（生产环境）
      if (process.env.NODE_ENV === 'production') {
        this.sendErrorReport(message)
      }
    },

    // 发送错误报告 - 静默处理
    sendErrorReport(error) {
      // 这里可以集成错误监控服务，如Sentry
      // 不输出到控制台
    },

    // 重新加载应用
    reloadApp() {
      this.hasError = false
      this.errorMessage = ''
      window.location.reload()
    },

    // 强制垃圾回收
    forceGC() {
      if (window.gc) {
        window.gc()
        this.updateMemoryUsage()
      } else {
        alert('Garbage Collection is not exposed. Please start Chrome with --js-flags="--expose-gc"')
      }
    },

    // 切换Timeline可见性
    toggleTimeline() {
      this.timelineVisible = !this.timelineVisible
    },

    // 打开设置对话框
    openSettings() {
      this.showSettingsDialog = true
    },

    // 关闭设置对话框
    closeSettings() {
      this.showSettingsDialog = false
    },

    // 处理视图模式变化
    handleViewModeChange(mode) {
      this.currentViewMode = mode
      console.log('从子组件收到视图模式变化:', mode)
    },

    // 直接处理下拉框变化
    onViewModeChange(event) {
      console.log('[调试] 视图模式下拉框变化:', this.currentViewMode)
      // 手动触发子组件的视图模式更新
      if (this.$route.name === 'GanttView') {
        const ganttView = this.$children.find(child => child.$options.name === 'GanttView')
        if (ganttView && ganttView.$refs.ganttChart) {
          console.log('[调试] 找到甘特图组件，准备调用handleViewModeChange')
          // 确保立即执行
          this.$nextTick(() => {
            ganttView.$refs.ganttChart.handleViewModeChange(this.currentViewMode)
            console.log('[调试] handleViewModeChange 已调用')
          })
        } else {
          console.error('[调试] 未找到甘特图组件或其引用')
        }
      } else {
        console.warn('[调试] 当前路由不是GanttView')
      }
    },

    // 切换性能监控条的显示状态
    togglePerformanceBar() {
      this.showPerformanceBar = !this.showPerformanceBar
    },

    // 清除性能数据
    clearPerformanceData() {
      this.fps = 0
      this.averageRenderTime = 0
      this.updateMemoryUsage()
    },

    // 清理性能监控
    cleanupPerformanceMonitoring() {
      if (this.performanceTimer) {
        clearInterval(this.performanceTimer)
      }
    }
  },

  errorCaptured(err, vm, info) {
    this.handleError(err.message)
    // 阻止错误继续向上传播
    return false
  },

  // 开发环境下的调试信息
  created() {
    if (this.isDevelopment && isDebuggingEnabled()) {
      console.log('--- Vue Gantt Project Debugging ---')
      console.log('Feature Flags:', getFeatureSummary())
      console.log('Initial Performance Config:', globalPerformanceConfig.getCurrentSettings())
      console.log('------------------------------------')
    }
  }
}
</script>

<style lang="scss">
/* =========================================================
   全局样式与性能优化
   ========================================================= */

/* 引入基础主题 */
@import '~@/styles/themes.css';
@import '~@/styles/themes-dhtmlx.css'; /* 新增：引入DHTMLX主题 */
@import '~@/styles/performance.css'; /* 性能相关样式 */

/* ===== 全局样式重置与基础设定 ===== */
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

html, body {
  height: 100%;
  width: 100%;
  overflow: hidden; /* 防止根元素滚动 */
  font-family: var(--gantt-font-family, sans-serif);
  background-color: var(--gantt-bg-primary, #fff);
  color: var(--gantt-text-primary, #333);
}

#app {
  position: relative;
  display: flex;
  flex-direction: column;
}

.app-content {
  flex-grow: 1;
  overflow-x: visible;
  overflow-y: hidden;
}

/* ===== 性能监控条 ===== */
.performance-bar {
  position: fixed;
  display:none;
  top: 10px;
  right: 10px;
  z-index: var(--gantt-z-tooltip, 1000);
  background: rgba(0, 0, 0, 0.75);
  color: white;
  padding: 8px 12px;
  border-radius: var(--gantt-border-radius-md, 6px);
  font-size: 13px;
  // display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: var(--gantt-shadow-lg, 0 10px 15px -3px rgba(0, 0, 0, 0.1));
  backdrop-filter: blur(5px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.3s ease;
}

.performance-metric {
  display: flex;
  align-items: center;
  gap: 6px;
}

.performance-metric span {
  font-weight: bold;
}

.performance-good { color: #4ade80; }
.performance-warning { color: #facc15; }
.performance-error { color: #f87171; }

.trend-indicator {
  font-size: 16px;
}
.trend-indicator.increasing { color: #f87171; }
.trend-indicator.decreasing { color: #4ade80; }

.performance-action {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  font-size: 16px;
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.2s ease;
}

.performance-action:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

.view-mode-select {
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  color: white;
  padding: 2px 6px;
  font-size: 12px;
  margin-left: 6px;
  cursor: pointer;
}

.view-mode-select option {
  background: #333;
  color: white;
}

.performance-toggle {
  background: none;
  border: none;
  color: white;
  font-size: 20px;
  cursor: pointer;
  margin-left: 8px;
}

.performance-monitor-btn {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 50px;
  height: 50px;
  background-color: rgba(26, 115, 232, 0.9);
  color: white;
  border: none;
  border-radius: 50%;
  font-size: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  z-index: 999;
  transition: all 0.3s ease;
}

.performance-monitor-btn:hover {
  transform: scale(1.1);
  background-color: #1a73e8;
}

/* ===== 错误边界 ===== */
.error-boundary {
  padding: 24px;
  text-align: center;
  background-color: #fff5f5;
  border: 1px solid #e53e3e;
  color: #c53030;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.error-boundary h3 {
  font-size: 24px;
  margin-bottom: 16px;
}

.error-boundary p {
  margin-bottom: 24px;
  max-width: 600px;
}

.reload-btn {
  padding: 10px 20px;
  background-color: #e53e3e;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}


</style>
