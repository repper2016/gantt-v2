// 功能开关配置
export const FEATURE_CONFIG = {
  // 性能监控功能
  performanceMonitoring: {
    // 是否启用性能监控面板
    enabled: process.env.NODE_ENV === 'development',
    // 是否启用内存监控
    memoryMonitoring: process.env.NODE_ENV === 'development',
    // 是否启用FPS监控
    fpsMonitoring: process.env.NODE_ENV === 'development'
  },

  // UI显示功能
  ui: {
    // 是否显示Timeline Overview（项目时间轴概览）
    showTimelineOverview: false,
    // 是否启用表格筛选功能
    enableTableFilters: true,
    // 是否限制拖拽面板宽度
    limitPanelDragWidth: false
  },

  // 任务类型管理
  taskTypes: {
    // 是否启用任务类型系统
    enabled: true,
    // 任务类型配置
    types: {
      deliverable: {
        name: 'Deliverable',
        icon: '📦',
        iconClass: 'el-icon-notebook-2', // 可以覆盖icon的CSS类
        iconSize: '16px', // 可以覆盖icon的CSS类
        iconColor: '#6b60b6',
        allowChildren: true,
        rootOnly: true
      },
      task: {
        name: 'Task',
        icon: '📋',
        iconClass: 'el-icon-tickets', // 可以覆盖icon的CSS类
        iconSize: '16px', // 图标尺寸
        iconColor: '#3498db', // 图标颜色
        color: '#3498db',
        allowChildren: true,
        rootOnly: false
      },
      milestone: {
        name: 'Milestone',
        icon: '🎯',
        iconClass: 'el-icon-collection-tag', // 可以覆盖icon的CSS类
        iconSize: '16px', // 图标尺寸
        iconColor: '#e74c3c', // 图标颜色
        color: '#e74c3c',
        allowChildren: false,
        rootOnly: true
      }
    }
  },

  // 调试功能
  debugging: {
    // 是否启用控制台输出（完全禁用所有console）
    consoleOutput: true,
    // 是否启用错误报告
    errorReporting: true,
    // 是否启用性能日志
    performanceLogs: true
  },

  // 实验性功能
  experimental: {
    // 虚拟滚动
    virtualScrolling: true,
    // 智能缓存
    intelligentCaching: true,
    // 自动优化
    autoOptimization: true
  }
}

// 获取功能状态的辅助函数
export const isFeatureEnabled = (featurePath) => {
  const keys = featurePath.split('.')
  let current = FEATURE_CONFIG

  for (const key of keys) {
    if (current[key] === undefined) {
      return false
    }
    current = current[key]
  }

  return current === true
}

// 检查UI功能是否启用
export const isUIFeatureEnabled = (type = 'showTimelineOverview') => {
  return FEATURE_CONFIG.ui[type] === true
}

// 获取任务类型配置
export const getTaskTypeConfig = (type) => {
  if (!FEATURE_CONFIG.taskTypes.enabled) {
    return null
  }
  return FEATURE_CONFIG.taskTypes.types[type] || null
}

// 获取所有任务类型
export const getAllTaskTypes = () => {
  if (!FEATURE_CONFIG.taskTypes.enabled) {
    return []
  }
  return Object.keys(FEATURE_CONFIG.taskTypes.types).map(key => ({
    key,
    ...FEATURE_CONFIG.taskTypes.types[key]
  }))
}

// 验证任务类型是否可以添加子任务
export const canAddChildTask = (parentType) => {
  const config = getTaskTypeConfig(parentType)
  return config ? config.allowChildren : true
}

// 验证任务类型是否只能在根节点
export const isRootOnlyType = (type) => {
  const config = getTaskTypeConfig(type)
  return config ? config.rootOnly : false
}

// 检查调试功能是否启用
export const isDebuggingEnabled = (type = 'consoleOutput') => {
  return FEATURE_CONFIG.debugging[type] === true
}

// 检查性能监控是否启用
export const isPerformanceMonitoringEnabled = (type = 'enabled') => {
  return FEATURE_CONFIG.performanceMonitoring[type] === true
}

// 动态切换功能状态（仅开发环境）
export const toggleFeature = (featurePath, enabled) => {
  if (process.env.NODE_ENV !== 'development') {
    return false
  }

  const keys = featurePath.split('.')
  let current = FEATURE_CONFIG

  for (let i = 0; i < keys.length - 1; i++) {
    if (current[keys[i]] === undefined) {
      return false
    }
    current = current[keys[i]]
  }

  const lastKey = keys[keys.length - 1]
  if (current[lastKey] !== undefined) {
    current[lastKey] = enabled
    return true
  }

  return false
}

// 获取当前功能配置摘要
export const getFeatureSummary = () => {
  return {
    performanceMonitoring: FEATURE_CONFIG.performanceMonitoring.enabled,
    debugging: FEATURE_CONFIG.debugging.consoleOutput,
    experimental: Object.values(FEATURE_CONFIG.experimental).some(v => v),
    ui: FEATURE_CONFIG.ui,
    taskTypes: FEATURE_CONFIG.taskTypes.enabled
  }
}

// 开发环境下的功能控制工具
if (process.env.NODE_ENV === 'development') {
  window.FeatureConfig = {
    toggle: toggleFeature,
    isEnabled: isFeatureEnabled,
    summary: getFeatureSummary,
    enableDebugging: () => toggleFeature('debugging.consoleOutput', true),
    disableDebugging: () => toggleFeature('debugging.consoleOutput', false),
    // 强制重新加载配置
    forceReload: () => {
      location.reload()
    }
  }
}
