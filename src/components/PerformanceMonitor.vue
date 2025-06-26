<template>
  <div v-if="enabled" class="performance-monitor" :class="{ collapsed: isCollapsed }">
    <!-- 控制按钮 -->
    <div class="monitor-header" @click="toggleCollapse">
      <span class="monitor-title">
        🔍 Performance Monitor
      </span>
      <span class="collapse-icon">{{ isCollapsed ? '📈' : '📉' }}</span>
    </div>

    <!-- 性能指标面板 -->
    <div v-show="!isCollapsed" class="monitor-content">
      <!-- 实时指标 -->
      <div class="metrics-section">
        <h4>Real-time Metrics</h4>
        <div class="metrics-grid">
          <div class="metric-item">
            <span class="metric-label">FPS:</span>
            <span class="metric-value" :class="getFpsClass(fps)">{{ fps.toFixed(1) }}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Memory:</span>
            <span class="metric-value">{{ formatMemory(memoryUsage) }}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Render Time:</span>
            <span class="metric-value" :class="getRenderTimeClass(renderTime)">{{ renderTime }}ms</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Tasks:</span>
            <span class="metric-value">{{ taskCount }}</span>
          </div>
        </div>
      </div>

      <!-- 性能图表 -->
      <div class="chart-section">
        <h4>Performance Chart</h4>
        <div class="chart-container" ref="chartContainer">
          <canvas ref="performanceChart" width="300" height="100"></canvas>
        </div>
      </div>

      <!-- 详细统计 -->
      <div class="stats-section">
        <h4>Detailed Stats</h4>
        <div class="stats-list">
          <div class="stat-row">
            <span>Visible Tasks:</span>
            <span>{{ visibleTaskCount }}</span>
          </div>
          <div class="stat-row">
            <span>DOM Nodes:</span>
            <span>{{ domNodeCount }}</span>
          </div>
          <div class="stat-row">
            <span>Event Listeners:</span>
            <span>{{ eventListenerCount }}</span>
          </div>
          <div class="stat-row">
            <span>Scroll Events/s:</span>
            <span>{{ scrollEventsPerSecond }}</span>
          </div>
        </div>
      </div>

      <!-- 性能建议 -->
      <div v-if="suggestions.length > 0" class="suggestions-section">
        <h4>Performance Suggestions</h4>
        <ul class="suggestions-list">
          <li v-for="suggestion in suggestions" :key="suggestion.id" :class="suggestion.severity">
            <span class="suggestion-icon">{{ getSuggestionIcon(suggestion.severity) }}</span>
            {{ suggestion.message }}
          </li>
        </ul>
      </div>

      <!-- 控制按钮 -->
      <div class="monitor-actions">
        <button class="btn btn-small" @click="resetMetrics">Reset</button>
        <button class="btn btn-small" @click="exportReport">Export Report</button>
        <button class="btn btn-small" @click="toggleAutoOptimize">
          {{ autoOptimizeEnabled ? 'Disable' : 'Enable' }} Auto Optimize
        </button>
        <!-- 设置按钮 -->
        <button class="btn btn-settings" @click="openSettings" title="All Settings">
          <span class="btn-icon">⚙️</span>
          Settings
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'PerformanceMonitor',
  props: {
    enabled: {
      type: Boolean,
      default: true
    },
    taskCount: {
      type: Number,
      default: 0
    },
    visibleTaskCount: {
      type: Number,
      default: 0
    },
    renderTime: {
      type: Number,
      default: 0
    }
  },

  data() {
    return {
      isCollapsed: true,
      fps: 60,
      memoryUsage: 0,
      domNodeCount: 0,
      eventListenerCount: 0,
      scrollEventsPerSecond: 0,
      autoOptimizeEnabled: false,

      // 性能历史数据
      performanceHistory: {
        fps: [],
        renderTime: [],
        memory: []
      },

      // 建议系统
      suggestions: [],

      // 计时器
      fpsCounter: 0,
      lastFpsTime: 0,
      scrollEventCount: 0,
      scrollEventTimer: null,

      // 监控间隔
      monitoringInterval: null,
      chartUpdateInterval: null
    }
  },

  mounted() {
    this.startMonitoring()
    this.initChart()
  },

  beforeDestroy() {
    this.stopMonitoring()
  },

  methods: {
    // 开始性能监控
    startMonitoring() {
      this.monitoringInterval = setInterval(() => {
        this.updateMetrics()
        this.analyzeSuggestions()
      }, 1000)

      this.chartUpdateInterval = setInterval(() => {
        this.updateChart()
      }, 500)

      // FPS 监控
      this.measureFPS()
    },

    // 停止性能监控
    stopMonitoring() {
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval)
      }
      if (this.chartUpdateInterval) {
        clearInterval(this.chartUpdateInterval)
      }
      if (this.scrollEventTimer) {
        clearInterval(this.scrollEventTimer)
      }
    },

    // 测量 FPS
    measureFPS() {
      let frames = 0
      let lastTime = performance.now()

      const countFrame = (currentTime) => {
        frames++

        if (currentTime - lastTime >= 1000) {
          this.fps = frames
          frames = 0
          lastTime = currentTime

          // 记录到历史数据
          this.recordMetric('fps', this.fps)
        }

        requestAnimationFrame(countFrame)
      }

      requestAnimationFrame(countFrame)
    },

    // 更新性能指标
    updateMetrics() {
      // 内存使用情况
      if (performance.memory) {
        this.memoryUsage = performance.memory.usedJSHeapSize
        this.recordMetric('memory', this.memoryUsage)
      }

      // DOM 节点数量
      this.domNodeCount = document.querySelectorAll('*').length

      // 事件监听器数量（估算）
      this.eventListenerCount = this.estimateEventListeners()

      // 记录渲染时间
      this.recordMetric('renderTime', this.renderTime)
    },

    // 估算事件监听器数量
    estimateEventListeners() {
      // 简单估算：每个有交互的元素大约有2-3个监听器
      const interactiveElements = document.querySelectorAll(
        'button, input, select, textarea, [onclick], [onchange], .draggable, .resizable'
      ).length
      return interactiveElements * 2.5
    },

    // 记录指标到历史数据
    recordMetric(type, value) {
      const history = this.performanceHistory[type]
      history.push(value)

      // 保持最近50个数据点
      if (history.length > 50) {
        history.shift()
      }
    },

    // 分析性能建议
    analyzeSuggestions() {
      const newSuggestions = []

      // FPS 过低警告
      if (this.fps < 30) {
        newSuggestions.push({
          id: 'low-fps',
          severity: 'error',
          message: `Low FPS detected (${this.fps.toFixed(1)}). Consider reducing task count or enabling virtual scrolling.`
        })
      } else if (this.fps < 50) {
        newSuggestions.push({
          id: 'medium-fps',
          severity: 'warning',
          message: `FPS could be improved (${this.fps.toFixed(1)}). Monitor for performance bottlenecks.`
        })
      }

      // 内存使用过高
      const memoryMB = this.memoryUsage / 1024 / 1024
      if (memoryMB > 100) {
        newSuggestions.push({
          id: 'high-memory',
          severity: 'warning',
          message: `High memory usage (${memoryMB.toFixed(1)}MB). Consider implementing data pagination.`
        })
      }

      // 渲染时间过长
      if (this.renderTime > 16) {
        newSuggestions.push({
          id: 'slow-render',
          severity: 'warning',
          message: `Slow rendering detected (${this.renderTime}ms). Optimize component updates.`
        })
      }

      // 任务数量过多
      if (this.taskCount > 1000) {
        newSuggestions.push({
          id: 'too-many-tasks',
          severity: 'info',
          message: `Large dataset (${this.taskCount} tasks). Virtual scrolling is recommended.`
        })
      }

      // DOM 节点过多
      if (this.domNodeCount > 5000) {
        newSuggestions.push({
          id: 'too-many-nodes',
          severity: 'warning',
          message: `High DOM complexity (${this.domNodeCount} nodes). Consider component optimization.`
        })
      }

      this.suggestions = newSuggestions
    },

    // 初始化性能图表
    initChart() {
      const canvas = this.$refs.performanceChart
      if (!canvas) return

      this.chartContext = canvas.getContext('2d')
      this.chartWidth = canvas.width
      this.chartHeight = canvas.height
    },

    // 更新性能图表
    updateChart() {
      if (!this.chartContext) return

      const ctx = this.chartContext
      const width = this.chartWidth
      const height = this.chartHeight

      // 清空画布
      ctx.clearRect(0, 0, width, height)

      // 绘制 FPS 曲线
      this.drawMetricLine(ctx, this.performanceHistory.fps, '#10b981', 0, 60, height * 0.3)

      // 绘制渲染时间曲线
      this.drawMetricLine(ctx, this.performanceHistory.renderTime, '#f59e0b', 0, 50, height * 0.3, height * 0.35)

      // 绘制内存使用曲线
      const memoryMB = this.performanceHistory.memory.map(m => m / 1024 / 1024)
      this.drawMetricLine(ctx, memoryMB, '#ef4444', 0, 200, height * 0.3, height * 0.7)

      // 绘制图例
      this.drawLegend(ctx)
    },

    // 绘制指标曲线
    drawMetricLine(ctx, data, color, minVal, maxVal, chartHeight, offsetY = 0) {
      if (data.length < 2) return

      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.beginPath()

      const stepX = this.chartWidth / (data.length - 1)

      data.forEach((value, index) => {
        const x = index * stepX
        const normalizedValue = Math.max(0, Math.min(1, (value - minVal) / (maxVal - minVal)))
        const y = offsetY + chartHeight - (normalizedValue * chartHeight)

        if (index === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })

      ctx.stroke()
    },

    // 绘制图例
    drawLegend(ctx) {
      const legends = [
        { color: '#10b981', label: 'FPS' },
        { color: '#f59e0b', label: 'Render (ms)' },
        { color: '#ef4444', label: 'Memory (MB)' }
      ]

      ctx.font = '10px Arial'
      legends.forEach((legend, index) => {
        ctx.fillStyle = legend.color
        ctx.fillRect(5, 5 + index * 15, 10, 10)
        ctx.fillStyle = '#374151'
        ctx.fillText(legend.label, 20, 14 + index * 15)
      })
    },

    // 切换折叠状态
    toggleCollapse() {
      this.isCollapsed = !this.isCollapsed
    },

    // 重置指标
    resetMetrics() {
      this.performanceHistory = {
        fps: [],
        renderTime: [],
        memory: []
      }
      this.suggestions = []
    },

    // 导出性能报告
    exportReport() {
      const report = {
        timestamp: new Date().toISOString(),
        metrics: {
          fps: this.fps,
          memoryUsage: this.memoryUsage,
          renderTime: this.renderTime,
          taskCount: this.taskCount,
          visibleTaskCount: this.visibleTaskCount,
          domNodeCount: this.domNodeCount
        },
        history: this.performanceHistory,
        suggestions: this.suggestions
      }

      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `performance-report-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
    },

    // 切换自动优化
    toggleAutoOptimize() {
      this.autoOptimizeEnabled = !this.autoOptimizeEnabled
      this.$emit('auto-optimize-toggle', this.autoOptimizeEnabled)
    },

    // 打开设置对话框
    openSettings() {
      this.$emit('open-settings')
    },

    // 记录滚动事件
    recordScrollEvent() {
      this.scrollEventCount++

      if (!this.scrollEventTimer) {
        this.scrollEventTimer = setInterval(() => {
          this.scrollEventsPerSecond = this.scrollEventCount
          this.scrollEventCount = 0
        }, 1000)
      }
    },

    // 获取 FPS 样式类
    getFpsClass(fps) {
      if (fps >= 55) return 'good'
      if (fps >= 30) return 'warning'
      return 'error'
    },

    // 获取渲染时间样式类
    getRenderTimeClass(time) {
      if (time <= 8) return 'good'
      if (time <= 16) return 'warning'
      return 'error'
    },

    // 格式化内存显示
    formatMemory(bytes) {
      if (bytes === 0) return '0 B'
      const k = 1024
      const sizes = ['B', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))  } ${  sizes[i]}`
    },

    // 获取建议图标
    getSuggestionIcon(severity) {
      switch (severity) {
      case 'error': return '🔴'
      case 'warning': return '🟡'
      case 'info': return '🔵'
      default: return '📋'
      }
    }
  }
}
</script>

<style scoped>
.performance-monitor {
  position: fixed;
  top: 20px;
  right: 20px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  max-width: 350px;
  transition: all 0.3s ease;
}

.performance-monitor.collapsed {
  width: auto;
}

.monitor-header {
  padding: 12px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
  border-radius: 12px 12px 0 0;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  user-select: none;
}

.monitor-title {
  font-weight: 600;
  font-size: 14px;
}

.collapse-icon {
  font-size: 12px;
  opacity: 0.8;
}

.monitor-content {
  padding: 16px;
  max-height: 500px;
  overflow-y: auto;
}

.metrics-section,
.chart-section,
.stats-section,
.suggestions-section {
  margin-bottom: 16px;
}

.metrics-section h4,
.chart-section h4,
.stats-section h4,
.suggestions-section h4 {
  margin: 0 0 8px 0;
  font-size: 12px;
  font-weight: 600;
  color: #374151;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.metrics-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.metric-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  background: #f8fafc;
  border-radius: 6px;
  font-size: 12px;
}

.metric-label {
  color: #6b7280;
  font-weight: 500;
}

.metric-value {
  font-weight: 600;
  font-family: 'Courier New', monospace;
}

.metric-value.good { color: #10b981; }
.metric-value.warning { color: #f59e0b; }
.metric-value.error { color: #ef4444; }

.chart-container {
  background: #f8fafc;
  border-radius: 6px;
  padding: 8px;
  border: 1px solid #e2e8f0;
}

.stats-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 8px;
  font-size: 12px;
  background: #f8fafc;
  border-radius: 4px;
}

.suggestions-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.suggestions-list li {
  padding: 8px;
  border-radius: 6px;
  font-size: 12px;
  display: flex;
  align-items: flex-start;
  gap: 6px;
}

.suggestions-list li.error {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.suggestions-list li.warning {
  background: #fffbeb;
  color: #d97706;
  border: 1px solid #fed7aa;
}

.suggestions-list li.info {
  background: #eff6ff;
  color: #2563eb;
  border: 1px solid #bfdbfe;
}

.suggestion-icon {
  font-size: 10px;
  margin-top: 1px;
}

.monitor-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  flex-wrap: wrap;
}

.btn {
  padding: 6px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #ffffff;
  color: #374151;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.btn.btn-small {
  padding: 4px 8px;
  font-size: 10px;
}

.btn-settings {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #4a90e2 !important;
  color: #ffffff !important;
  border-color: #4a90e2 !important;
  font-weight: 600;
}

.btn-settings:hover {
  background: #357abd !important;
  border-color: #357abd !important;
}

.btn-icon {
  font-size: 12px;
}

/* 滚动条样式 */
.monitor-content::-webkit-scrollbar {
  width: 4px;
}

.monitor-content::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 2px;
}

.monitor-content::-webkit-scrollbar-thumb {
  background: #cbd5e0;
  border-radius: 2px;
}

.monitor-content::-webkit-scrollbar-thumb:hover {
  background: #a0aec0;
}
</style>
