import { isDebuggingEnabled } from '@/config/features'

// 安全的控制台输出函数
const safeConsole = {
  log: (...args) => {
    if (isDebuggingEnabled()) {
      console.log(...args)
    }
  },
  warn: (...args) => {
    if (isDebuggingEnabled()) {
      console.warn(...args)
    }
  },
  error: (...args) => {
    if (isDebuggingEnabled()) {
      console.error(...args)
    }
  }
}

// 性能优化Mixin
export const PerformanceMixin = {
  data() {
    return {
      // 防抖定时器
      debounceTimers: {},
      // 节流定时器
      throttleTimers: {},
      // 观察者实例
      observers: [],
      // 内存监控历史
      memoryHistory: [],
      // 上次内存检查时间
      lastMemoryCheck: 0
    }
  },

  methods: {
    // 防抖函数
    debounce(func, delay = 300, key = 'default') {
      if (this.debounceTimers[key]) {
        clearTimeout(this.debounceTimers[key])
      }

      this.debounceTimers[key] = setTimeout(() => {
        func.apply(this, arguments)
        delete this.debounceTimers[key]
      }, delay)
    },

    // 节流函数
    throttle(func, delay = 16, key = 'default') {
      if (this.throttleTimers[key]) {
        return
      }

      this.throttleTimers[key] = setTimeout(() => {
        func.apply(this, arguments)
        delete this.throttleTimers[key]
      }, delay)
    },

    // RAF优化的滚动处理
    optimizedScroll(callback) {
      let ticking = false

      return (event) => {
        if (!ticking) {
          requestAnimationFrame(() => {
            callback(event)
            ticking = false
          })
          ticking = true
        }
      }
    },

    // 批量DOM更新
    batchDOMUpdate(updates) {
      requestAnimationFrame(() => {
        updates.forEach(update => update())
      })
    },

    // 延迟执行
    defer(callback, delay = 0) {
      return new Promise(resolve => {
        setTimeout(() => {
          const result = callback()
          resolve(result)
        }, delay)
      })
    },

    // 创建优化的观察者
    createOptimizedObserver(target, callback, options = {}) {
      if (!window.ResizeObserver) return null

      const observer = new ResizeObserver(
        this.throttle(callback, options.throttle || 100, `observer-${this.observers.length}`)
      )

      observer.observe(target)
      this.observers.push(observer)

      return observer
    },

    // 内存使用检查（优化版）
    checkMemoryUsage() {
      const now = Date.now()

      // 避免频繁检查
      if (now - this.lastMemoryCheck < 3000) {
        return this.memoryHistory[this.memoryHistory.length - 1] || null
      }

      this.lastMemoryCheck = now

      if (window.performance && window.performance.memory) {
        const {memory} = window.performance
        const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024)
        const totalMB = Math.round(memory.totalJSHeapSize / 1024 / 1024)
        const limitMB = Math.round(memory.jsHeapSizeLimit / 1024 / 1024)

        // 记录内存历史
        this.recordMemoryUsage(usedMB, totalMB, limitMB)

        // 获取当前环境的阈值
        const isDev = process.env.NODE_ENV === 'development'
        const baseThreshold = 100
        const warningThreshold = isDev ? baseThreshold * 2 : baseThreshold
        const errorThreshold = isDev ? baseThreshold * 3 : baseThreshold * 2

        // 智能警告逻辑（仅在开发环境且启用调试时）
        if (isDev && isDebuggingEnabled()) {
          this.analyzeMemoryUsage(usedMB, totalMB, limitMB, warningThreshold, errorThreshold)
        }

        return { used: usedMB, total: totalMB, limit: limitMB }
      }
      return null
    },

    // 记录内存使用历史
    recordMemoryUsage(used, total, limit) {
      this.memoryHistory.push({
        used,
        total,
        limit,
        timestamp: Date.now()
      })

      // 限制历史记录数量
      if (this.memoryHistory.length > 10) {
        this.memoryHistory.shift()
      }
    },

    // 分析内存使用情况（仅开发环境且启用调试时）
    analyzeMemoryUsage(used, total, limit, warningThreshold, errorThreshold) {
      if (process.env.NODE_ENV !== 'development' || !isDebuggingEnabled()) return

      // 计算内存使用趋势
      const trend = this.getMemoryTrend()
      const utilizationPercent = Math.round((used / limit) * 100)

      // 严重内存问题才警告
      if (used > errorThreshold) {
        safeConsole.error('Memory usage is very high', {
          current: `${used}MB`,
          threshold: `${errorThreshold}MB`,
          trend
        })
      } else if (used > warningThreshold && trend === 'increasing' && utilizationPercent > 70) {
        safeConsole.warn('Memory usage is increasing', {
          current: `${used}MB`,
          trend,
          utilization: `${utilizationPercent}%`
        })
      }
    },

    // 获取内存使用趋势
    getMemoryTrend() {
      if (this.memoryHistory.length < 3) return 'stable'

      const recent = this.memoryHistory.slice(-3)
      const isIncreasing = recent.every((curr, index) => {
        if (index === 0) return true
        return curr.used > recent[index - 1].used
      })

      const isDecreasing = recent.every((curr, index) => {
        if (index === 0) return true
        return curr.used < recent[index - 1].used
      })

      if (isIncreasing) return 'increasing'
      if (isDecreasing) return 'decreasing'
      return 'stable'
    },

    // 获取内存优化建议
    getMemoryOptimizationSuggestions() {
      const suggestions = []

      // 检查定时器数量
      const timerCount = Object.keys(this.debounceTimers).length + Object.keys(this.throttleTimers).length
      if (timerCount > 10) {
        suggestions.push('Large number of uncleaned timers detected')
      }

      // 检查观察者数量
      if (this.observers.length > 5) {
        suggestions.push('Large number of uncleaned observers detected')
      }

      return suggestions
    },

    // 强制垃圾回收（仅开发环境）
    forceGarbageCollection() {
      if (process.env.NODE_ENV === 'development' && window.gc) {
        window.gc()

        // 延迟检查内存
        setTimeout(() => {
          this.checkMemoryUsage()
        }, 1000)
      }
    },

    // 组件性能计时
    measurePerformance(name, func) {
      const start = performance.now()
      const result = func()
      const end = performance.now()

      // 仅在开发环境且超过阈值时记录
      if (process.env.NODE_ENV === 'development' && (end - start) > 32 && isDebuggingEnabled()) {
        safeConsole.warn(`Performance: ${name} took ${(end - start).toFixed(2)}ms`)
      }

      return result
    },

    // 内存使用监控（非阻塞）
    monitorMemoryUsage(interval = 5000) {
      if (this.memoryMonitorTimer) {
        clearInterval(this.memoryMonitorTimer)
      }

      this.memoryMonitorTimer = setInterval(() => {
        // 使用RAF确保不阻塞主线程
        requestAnimationFrame(() => {
          this.checkMemoryUsage()
        })
      }, interval)
    },

    // 停止内存监控
    stopMemoryMonitoring() {
      if (this.memoryMonitorTimer) {
        clearInterval(this.memoryMonitorTimer)
        this.memoryMonitorTimer = null
      }
    }
  },

  beforeDestroy() {
    // 清理所有定时器
    Object.values(this.debounceTimers).forEach(timer => clearTimeout(timer))
    Object.values(this.throttleTimers).forEach(timer => clearTimeout(timer))

    // 清理所有观察者
    this.observers.forEach(observer => {
      if (observer && observer.disconnect) {
        observer.disconnect()
      }
    })

    // 停止内存监控
    this.stopMemoryMonitoring()

    // 清空引用
    this.debounceTimers = {}
    this.throttleTimers = {}
    this.observers = []
    this.memoryHistory = []
  }
}

// 虚拟滚动优化Mixin
export const VirtualScrollMixin = {
  data() {
    return {
      virtualScrollEnabled: false,
      visibleStartIndex: 0,
      visibleEndIndex: 0,
      itemHeight: 40,
      containerHeight: 600,
      bufferSize: 5
    }
  },

  computed: {
    visibleItemCount() {
      return Math.ceil(this.containerHeight / this.itemHeight) + this.bufferSize * 2
    },

    totalHeight() {
      return this.items ? this.items.length * this.itemHeight : 0
    },

    visibleItems() {
      if (!this.items || !this.virtualScrollEnabled) {
        return this.items || []
      }

      const start = Math.max(0, this.visibleStartIndex - this.bufferSize)
      const end = Math.min(this.items.length, this.visibleEndIndex + this.bufferSize)

      return this.items.slice(start, end).map((item, index) => ({
        ...item,
        virtualIndex: start + index,
        top: (start + index) * this.itemHeight
      }))
    }
  },

  methods: {
    updateVisibleRange(scrollTop) {
      const start = Math.floor(scrollTop / this.itemHeight)
      const end = start + this.visibleItemCount

      this.visibleStartIndex = start
      this.visibleEndIndex = end
    },

    handleVirtualScroll(event) {
      if (!this.virtualScrollEnabled) return

      this.throttle(() => {
        this.updateVisibleRange(event.target.scrollTop)
      }, 16, 'virtual-scroll')
    }
  }
}

// 组件性能监控Mixin
export const ComponentPerformanceMixin = {
  data() {
    return {
      renderTimes: [],
      maxRenderTimes: 10,
      renderCount: 0
    }
  },

  beforeUpdate() {
    this._updateStartTime = performance.now()
  },

  updated() {
    if (this._updateStartTime) {
      const renderTime = performance.now() - this._updateStartTime
      this.renderCount++

      this.renderTimes.push(renderTime)
      if (this.renderTimes.length > this.maxRenderTimes) {
        this.renderTimes.shift()
      }

      // 仅在开发环境且渲染时间过长且启用调试时警告
      if (process.env.NODE_ENV === 'development' && renderTime > 32 && isDebuggingEnabled()) {
        safeConsole.warn(`Component ${this.$options.name || 'Unknown'} render time: ${renderTime.toFixed(2)}ms`)
      }
    }
  },

  computed: {
    averageRenderTime() {
      if (this.renderTimes.length === 0) return 0
      return this.renderTimes.reduce((sum, time) => sum + time, 0) / this.renderTimes.length
    }
  }
}
