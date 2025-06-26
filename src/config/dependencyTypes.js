// 依赖关系类型配置
export const DEPENDENCY_TYPES = {
  FS: 'Finish-To-Start',
  SS: 'Start-To-Start',
  FF: 'Finish-To-Finish',
  SF: 'Start-To-Finish'
}

// 依赖类型详细配置
export const DEPENDENCY_TYPE_CONFIG = {
  FS: {
    id: 'FS',
    name: 'Finish-To-Start',
    shortName: 'FS',
    description: '前导任务完成后，后续任务才能开始',
    icon: '→',
    color: '#3498db',
    // 连接点配置：从前导任务的结束点到后续任务的开始点
    fromPoint: 'end',
    toPoint: 'start'
  },
  SS: {
    id: 'SS',
    name: 'Start-To-Start',
    shortName: 'SS',
    description: '前导任务开始后，后续任务才能开始',
    icon: '⇉',
    color: '#2ecc71',
    // 连接点配置：从前导任务的开始点到后续任务的开始点
    fromPoint: 'start',
    toPoint: 'start'
  },
  FF: {
    id: 'FF',
    name: 'Finish-To-Finish',
    shortName: 'FF',
    description: '前导任务完成后，后续任务才能完成',
    icon: '⇇',
    color: '#f39c12',
    // 连接点配置：从前导任务的结束点到后续任务的结束点
    fromPoint: 'end',
    toPoint: 'end'
  },
  SF: {
    id: 'SF',
    name: 'Start-To-Finish',
    shortName: 'SF',
    description: '前导任务开始后，后续任务才能完成',
    icon: '↰',
    color: '#e74c3c',
    // 连接点配置：从前导任务的开始点到后续任务的结束点
    fromPoint: 'start',
    toPoint: 'end'
  }
}

// 获取依赖类型配置
export function getDependencyTypeConfig(type) {
  return DEPENDENCY_TYPE_CONFIG[type] || DEPENDENCY_TYPE_CONFIG.FS
}

// 获取所有依赖类型选项（用于下拉框）
export function getDependencyTypeOptions() {
  return Object.values(DEPENDENCY_TYPE_CONFIG).map(config => ({
    value: config.id,
    label: `${config.shortName} - ${config.name}`,
    description: config.description,
    icon: config.icon,
    color: config.color
  }))
}

// 验证依赖类型
export function isValidDependencyType(type) {
  return Object.keys(DEPENDENCY_TYPE_CONFIG).includes(type)
}

// 默认依赖类型
export const DEFAULT_DEPENDENCY_TYPE = 'FS'

// 依赖关系计算配置
export const DEPENDENCY_CALCULATION_CONFIG = {
  // 默认lag值（天数）
  defaultLag: 0,
  // lag值范围
  lagRange: {
    min: -999,
    max: 999
  },
  // lag值步长
  lagStep: 1,
  // 支持的lag时间单位
  lagUnits: {
    d: { name: 'day', days: 1, displayName: '天' },
    days: { name: 'day', days: 1, displayName: '天' },
    day: { name: 'day', days: 1, displayName: '天' },
    '天': { name: 'day', days: 1, displayName: '天' }
  }
}

/**
 * 解析lag字符串，支持单位后缀
 * @param {string|number} lagInput - lag输入值，可以是数字或带单位的字符串
 * @returns {object} 解析结果 { value: number, unit: string, days: number }
 */
export function parseLagValue(lagInput) {
  // 如果是数字，直接返回（默认单位为天）
  if (typeof lagInput === 'number') {
    return {
      value: lagInput,
      unit: 'day',
      days: lagInput,
      displayText: `${lagInput}d`
    }
  }

  // 如果是字符串，解析单位
  if (typeof lagInput === 'string') {
    const trimmed = lagInput.trim()

    // 匹配数字和单位的正则表达式
    const match = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*([a-zA-Z]*|天)?$/)

    if (!match) {
      // 解析失败，返回默认值
      return {
        value: 0,
        unit: 'day',
        days: 0,
        displayText: '0d',
        error: `无效的lag格式: ${lagInput}`
      }
    }

    const numericValue = parseFloat(match[1])
    const unitStr = (match[2] || 'd').toLowerCase()

    // 查找匹配的单位配置
    const unitConfig = DEPENDENCY_CALCULATION_CONFIG.lagUnits[unitStr]

    if (!unitConfig) {
      return {
        value: numericValue,
        unit: 'day',
        days: numericValue, // 未知单位默认按天处理
        displayText: `${numericValue}d`,
        warning: `未知单位 "${match[2]}"，按天处理`
      }
    }

    return {
      value: numericValue,
      unit: unitConfig.name,
      days: numericValue * unitConfig.days,
      displayText: `${numericValue}${unitStr === '天' ? '天' : 'd'}`
    }
  }

  // 其他类型，返回默认值
  return {
    value: 0,
    unit: 'day',
    days: 0,
    displayText: '0d',
    error: `无效的lag类型: ${typeof lagInput}`
  }
}

/**
 * 格式化lag值显示
 * @param {number} lagDays - lag天数
 * @returns {string} 格式化后的显示文本
 */
export function formatLagDisplay(lagDays) {
  if (lagDays === 0) return ''

  const absValue = Math.abs(lagDays)
  const sign = lagDays > 0 ? '+' : ''

  if (absValue === 1) {
    return `${sign}${lagDays}d`
  } else {
    return `${sign}${lagDays}d`
  }
}

/**
 * 验证lag值的有效性
 * @param {number} lagDays - lag天数
 * @returns {object} 验证结果 { valid: boolean, message?: string }
 */
export function validateLagValue(lagDays) {
  if (typeof lagDays !== 'number' || isNaN(lagDays)) {
    return {
      valid: false,
      message: 'Lag值必须是有效数字'
    }
  }

  const { min, max } = DEPENDENCY_CALCULATION_CONFIG.lagRange

  if (lagDays < min || lagDays > max) {
    return {
      valid: false,
      message: `Lag值必须在 ${min} 到 ${max} 天之间`
    }
  }

  return { valid: true }
}
