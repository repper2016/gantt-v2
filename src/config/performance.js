import { isDebuggingEnabled } from './features'

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

/**
 * 甘特图性能优化配置
 * 提供可配置的性能参数和优化策略
 */

export const PERFORMANCE_CONFIG = {
  // 渲染优化
  RENDERING: {
    RAF_THROTTLE: 8,           // RAF节流时间(ms) - 120fps
    DRAG_THROTTLE: 4,          // 拖拽节流时间(ms) - 回到高响应频率
    SCROLL_THROTTLE: 16,       // 滚动节流时间(ms) - 60fps
    RESIZE_THROTTLE: 100,      // 调整大小节流时间(ms)
    TOOLTIP_THROTTLE: 50,      // Tooltip节流时间(ms)

    // 批处理配置
    BATCH_SIZE: 10,            // DOM更新批处理大小
    BATCH_DELAY: 0,            // 批处理延迟(ms)

    // 缓存配置
    CACHE_ENABLED: true,       // 启用缓存
    CACHE_TTL: 300000,         // 缓存生存时间(ms) - 5分钟
    MAX_CACHE_SIZE: 1000       // 最大缓存条目数
  },

  // 虚拟滚动
  VIRTUAL_SCROLL: {
    ENABLED_THRESHOLD: 100,    // 超过多少任务启用虚拟滚动
    BUFFER_SIZE: 10,           // 缓冲区大小(前后各渲染多少行)
    ITEM_HEIGHT: 40,           // 每个任务行高度(px)
    OVERSCAN: 5                // 预渲染额外行数
  },

  // 内存管理
  MEMORY: {
    GC_INTERVAL: 60000,        // 垃圾回收间隔(ms) - 1分钟
    MAX_LISTENERS: 100,        // 最大事件监听器数量
    CLEANUP_DELAY: 1000,       // 清理延迟(ms)

    // 对象池配置
    OBJECT_POOL_SIZE: 50,      // 对象池大小
    REUSE_OBJECTS: true        // 启用对象复用
  },

  // 事件优化
  EVENTS: {
    PASSIVE_LISTENERS: true,   // 使用被动事件监听器
    CAPTURE_PHASE: false,      // 使用冒泡阶段
    DEBOUNCE_DELAY: 100,       // 防抖延迟(ms)

    // 特定事件配置
    MOUSE_MOVE_THROTTLE: 8,    // 鼠标移动节流
    WHEEL_THROTTLE: 16,        // 滚轮事件节流
    TOUCH_THROTTLE: 8          // 触摸事件节流
  },

  // 连接线优化
  DEPENDENCIES: {
    USE_CACHE: true,           // 使用连接线缓存
    CACHE_SIZE: 500,           // 连接线缓存大小
    RECALC_THRESHOLD: 10,      // 重新计算阈值

    // 渲染优化
    USE_SIMPLE_PATH: false,    // 使用简单路径(性能优先)
    CURVE_PRECISION: 4,        // 曲线精度
    MIN_SEGMENT_LENGTH: 10     // 最小线段长度
  },

  // 工具提示优化
  TOOLTIP: {
    SHOW_DELAY: 1000,          // 显示延迟(ms)
    HIDE_DELAY: 300,           // 隐藏延迟(ms)
    UPDATE_THROTTLE: 50,       // 更新节流(ms)

    // 内容优化
    MAX_CONTENT_LENGTH: 500,   // 最大内容长度
    CACHE_CONTENT: true,       // 缓存内容
    PRELOAD_CONTENT: false     // 预加载内容
  },

  // 调试配置
  DEBUG: {
    ENABLED: false,            // 启用调试模式
    LOG_PERFORMANCE: false,    // 记录性能日志
    SHOW_FPS: false,           // 显示FPS
    MEASURE_RENDER_TIME: false // 测量渲染时间
  }
}

/**
 * 性能监控器
 */
export class PerformanceMonitor {
  constructor() {
    this.metrics = {
      renderTime: [],
      fps: 0,
      memoryUsage: 0,
      cacheHitRate: 0
    }

    this.isMonitoring = false
    this.rafId = null
    this.lastFrameTime = 0
    this.frameCount = 0
  }

  start() {
    if (this.isMonitoring) return

    this.isMonitoring = true
    this.lastFrameTime = performance.now()
    this.frameCount = 0

    this.measure()
  }

  stop() {
    this.isMonitoring = false
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  measure() {
    if (!this.isMonitoring) return

    const now = performance.now()
    const deltaTime = now - this.lastFrameTime

    // 计算FPS
    this.frameCount++
    if (deltaTime >= 1000) {
      this.metrics.fps = Math.round((this.frameCount * 1000) / deltaTime)
      this.frameCount = 0
      this.lastFrameTime = now
    }

    // 测量内存使用
    if (performance.memory) {
      this.metrics.memoryUsage = performance.memory.usedJSHeapSize / 1048576 // MB
    }

    this.rafId = requestAnimationFrame(() => this.measure())
  }

  addRenderTime(time) {
    this.metrics.renderTime.push(time)
    if (this.metrics.renderTime.length > 100) {
      this.metrics.renderTime.shift()
    }
  }

  getAverageRenderTime() {
    if (this.metrics.renderTime.length === 0) return 0
    const sum = this.metrics.renderTime.reduce((a, b) => a + b, 0)
    return sum / this.metrics.renderTime.length
  }

  getMetrics() {
    return {
      ...this.metrics,
      averageRenderTime: this.getAverageRenderTime()
    }
  }
}

/**
 * 缓存管理器
 */
export class CacheManager {
  constructor(maxSize = 1000, ttl = 300000) {
    this.cache = new Map()
    this.maxSize = maxSize
    this.ttl = ttl
    this.hitCount = 0
    this.missCount = 0
  }

  get(key) {
    const entry = this.cache.get(key)

    if (!entry) {
      this.missCount++
      return null
    }

    // 检查是否过期
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key)
      this.missCount++
      return null
    }

    this.hitCount++
    return entry.value
  }

  set(key, value) {
    // 清理过期条目
    this.cleanup()

    // 如果超过最大大小，删除最旧的条目
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now()
    })
  }

  cleanup() {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key)
      }
    }
  }

  clear() {
    this.cache.clear()
    this.hitCount = 0
    this.missCount = 0
  }

  getHitRate() {
    const total = this.hitCount + this.missCount
    return total === 0 ? 0 : this.hitCount / total
  }

  getStats() {
    return {
      size: this.cache.size,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: this.getHitRate()
    }
  }
}

/**
 * 节流函数
 */
export function throttle(func, wait) {
  let timeout = null
  let lastCallTime = 0

  return function throttled(...args) {
    const now = Date.now()

    if (now - lastCallTime >= wait) {
      lastCallTime = now
      return func.apply(this, args)
    }

    if (!timeout) {
      timeout = setTimeout(() => {
        timeout = null
        lastCallTime = Date.now()
        func.apply(this, args)
      }, wait - (now - lastCallTime))
    }
  }
}

/**
 * 防抖函数
 */
export function debounce(func, wait) {
  let timeout = null

  return function debounced(...args) {
    clearTimeout(timeout)
    timeout = setTimeout(() => {
      func.apply(this, args)
    }, wait)
  }
}

/**
 * RAF节流
 */
export function rafThrottle(func) {
  let rafId = null
  let lastArgs = null

  return function rafThrottled(...args) {
    lastArgs = args

    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        rafId = null
        func.apply(this, lastArgs)
      })
    }
  }
}

/**
 * 批处理器
 */
export class BatchProcessor {
  constructor(batchSize = 10, delay = 0) {
    this.batchSize = batchSize
    this.delay = delay
    this.queue = []
    this.timeoutId = null
  }

  add(item) {
    this.queue.push(item)

    if (this.queue.length >= this.batchSize) {
      this.flush()
    } else if (!this.timeoutId && this.delay > 0) {
      this.timeoutId = setTimeout(() => this.flush(), this.delay)
    }
  }

  flush() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }

    if (this.queue.length === 0) return

    const batch = this.queue.splice(0)
    this.processBatch(batch)
  }

  processBatch(batch) {
    // 子类需要实现这个方法
    // 默认实现：逐个处理
    batch.forEach(item => {
      if (typeof item === 'function') {
        item()
      }
    })
  }
}

/**
 * 全局性能配置管理器
 */
export class GlobalPerformanceConfig {
  constructor() {
    this.history = []
    this.maxHistorySize = 100
  }

  adaptToPerformance(metrics) {
    // 记录性能数据
    this.history.push({
      ...metrics,
      timestamp: Date.now()
    })

    // 限制历史记录大小
    if (this.history.length > this.maxHistorySize) {
      this.history.shift()
    }

    // 根据性能指标自动调整配置
    this.autoTunePerformance(metrics)
  }

  autoTunePerformance(metrics) {
    // 如果FPS过低，启用性能优化
    if (metrics.fps < 30) {
      PERFORMANCE_CONFIG.RENDERING.RAF_THROTTLE = 16 // 降低到60fps
    } else if (metrics.fps > 55) {
      PERFORMANCE_CONFIG.RENDERING.RAF_THROTTLE = 8 // 提升到120fps
    }

    // 如果渲染时间过长，调整批处理大小
    if (metrics.renderTime > 16) {
      PERFORMANCE_CONFIG.RENDERING.BATCH_SIZE = Math.max(5, PERFORMANCE_CONFIG.RENDERING.BATCH_SIZE - 1)
    } else if (metrics.renderTime < 8) {
      PERFORMANCE_CONFIG.RENDERING.BATCH_SIZE = Math.min(20, PERFORMANCE_CONFIG.RENDERING.BATCH_SIZE + 1)
    }

    // 如果内存使用过高，启用更激进的缓存清理
    if (metrics.memoryUsage > 100) { // 100MB
      PERFORMANCE_CONFIG.RENDERING.CACHE_TTL = Math.max(60000, PERFORMANCE_CONFIG.RENDERING.CACHE_TTL - 30000)
    }
  }

  clearHistory() {
    this.history = []
  }

  getMetrics() {
    return {
      historySize: this.history.length,
      config: PERFORMANCE_CONFIG
    }
  }
}

// 导出单例实例
export const performanceMonitor = new PerformanceMonitor()
export const cacheManager = new CacheManager(
  PERFORMANCE_CONFIG.RENDERING.MAX_CACHE_SIZE,
  PERFORMANCE_CONFIG.RENDERING.CACHE_TTL
)
export const globalPerformanceConfig = new GlobalPerformanceConfig()

export default PERFORMANCE_CONFIG
