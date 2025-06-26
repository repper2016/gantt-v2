import moment from 'moment'

/**
 * 节假日数据服务
 * 支持调用外部API获取中国国家节假日数据，并提供缓存机制
 */
class HolidayService {
  constructor() {
    // 节假日数据缓存，按年份存储
    this.holidayCache = new Map()
    // 请求状态缓存，避免重复请求
    this.requestingYears = new Set()
    // 缓存过期时间（24小时）
    this.cacheExpireTime = 24 * 60 * 60 * 1000
  }

  /**
   * 获取指定年份的节假日数据
   * @param {number} year - 年份
   * @returns {Promise<Array>} 节假日数组，格式：[{date: 'YYYY-MM-DD', name: '节假日名称', type: 'holiday'}]
   */
  async getHolidaysForYear(year) {
    // 检查缓存是否存在且未过期
    const cachedData = this.holidayCache.get(year)
    if (cachedData && (Date.now() - cachedData.timestamp) < this.cacheExpireTime) {
      return cachedData.holidays
    }

    // 避免重复请求同一年份
    if (this.requestingYears.has(year)) {
      // 等待请求完成
      await this.waitForRequest(year)
      return this.holidayCache.get(year)?.holidays || []
    }

    this.requestingYears.add(year)

    try {
      const holidays = await this.fetchHolidaysFromAPI(year)

      // 缓存数据
      this.holidayCache.set(year, {
        holidays,
        timestamp: Date.now()
      })

      return holidays
    } catch (error) {
      console.warn(`获取${year}年节假日数据失败，使用默认数据:`, error)
      // 使用默认的节假日数据
      const defaultHolidays = this.getDefaultHolidays(year)
      this.holidayCache.set(year, {
        holidays: defaultHolidays,
        timestamp: Date.now()
      })
      return defaultHolidays
    } finally {
      this.requestingYears.delete(year)
    }
  }

  /**
   * 从API获取节假日数据
   * @param {number} year - 年份
   * @returns {Promise<Array>} 节假日数组
   */
  async fetchHolidaysFromAPI(year) {
    // 使用免费的中国节假日API
    // 这里使用一个模拟的API，实际项目中需要替换为真实的API
    const apiUrl = `https://api.apihubs.cn/holiday/get?field=workday,holiday&year=${year}`

    try {
      // 创建超时控制器
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10秒超时

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status}`)
      }

      const data = await response.json()

      // 解析API返回的数据格式
      if (data && data.data && data.data.holiday) {
        return this.parseAPIHolidays(data.data.holiday, year)
      }

      throw new Error('API返回数据格式不正确')
    } catch (error) {
      // 如果主API失败，尝试备用API
      return await this.fetchFromBackupAPI(year)
    }
  }

  /**
   * 备用API获取节假日数据
   * @param {number} year - 年份
   * @returns {Promise<Array>} 节假日数组
   */
  async fetchFromBackupAPI(year) {
    try {
      // 备用API示例（实际使用时需要替换为可用的API）
      const backupUrl = `https://timor.tech/api/holiday/year/${year}`

      // 创建超时控制器
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000) // 8秒超时

      const response = await fetch(backupUrl, {
        method: 'GET',
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`备用API请求失败: ${response.status}`)
      }

      const data = await response.json()

      if (data && data.holiday) {
        return this.parseBackupAPIHolidays(data.holiday, year)
      }

      throw new Error('备用API返回数据格式不正确')
    } catch (error) {
      console.warn(`备用API也失败，使用本地默认数据:`, error)
      throw error
    }
  }

  /**
   * 解析主API返回的节假日数据
   * @param {Object} holidayData - API返回的节假日数据
   * @param {number} year - 年份
   * @returns {Array} 标准化的节假日数组
   */
  parseAPIHolidays(holidayData, year) {
    const holidays = []

    // 根据实际API格式解析数据
    Object.keys(holidayData).forEach(dateStr => {
      const holidayInfo = holidayData[dateStr]
      if (holidayInfo && holidayInfo.holiday) {
        holidays.push({
          date: dateStr,
          name: holidayInfo.name || '节假日',
          type: 'holiday',
          isWorkday: holidayInfo.workday || false
        })
      }
    })

    return holidays
  }

  /**
   * 解析备用API返回的节假日数据
   * @param {Object} holidayData - 备用API返回的节假日数据
   * @param {number} year - 年份
   * @returns {Array} 标准化的节假日数组
   */
  parseBackupAPIHolidays(holidayData, year) {
    const holidays = []

    Object.keys(holidayData).forEach(dateStr => {
      const dayInfo = holidayData[dateStr]
      if (dayInfo && dayInfo.holiday) {
        holidays.push({
          date: dateStr,
          name: dayInfo.name || '节假日',
          type: 'holiday',
          isWorkday: dayInfo.type === 1 // 1表示工作日，0表示休息日
        })
      }
    })

    return holidays
  }

  /**
   * 获取默认的节假日数据（用于API失败时的兜底）
   * @param {number} year - 年份
   * @returns {Array} 默认节假日数组
   */
  getDefaultHolidays(year) {
    // 返回一些固定的中国节假日
    const defaultHolidays = [
      { month: 1, day: 1, name: '元旦' },
      { month: 2, day: [10, 11, 12, 13, 14, 15, 16], name: '春节', dynamic: true },
      { month: 4, day: [4, 5, 6], name: '清明节', dynamic: true },
      { month: 5, day: [1, 2, 3], name: '劳动节' },
      { month: 6, day: [14, 15, 16], name: '端午节', dynamic: true },
      { month: 9, day: [15, 16, 17], name: '中秋节', dynamic: true },
      { month: 10, day: [1, 2, 3, 4, 5, 6, 7], name: '国庆节' }
    ]

    const holidays = []

    defaultHolidays.forEach(holiday => {
      if (Array.isArray(holiday.day)) {
        holiday.day.forEach(day => {
          const date = moment(`${year}-${holiday.month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`)
          if (date.isValid()) {
            holidays.push({
              date: date.format('YYYY-MM-DD'),
              name: holiday.name,
              type: 'holiday',
              isDefault: true
            })
          }
        })
      } else {
        const date = moment(`${year}-${holiday.month.toString().padStart(2, '0')}-${holiday.day.toString().padStart(2, '0')}`)
        if (date.isValid()) {
          holidays.push({
            date: date.format('YYYY-MM-DD'),
            name: holiday.name,
            type: 'holiday',
            isDefault: true
          })
        }
      }
    })

    return holidays
  }

  /**
   * 等待指定年份的请求完成
   * @param {number} year - 年份
   * @returns {Promise<void>}
   */
  async waitForRequest(year) {
    let attempts = 0
    const maxAttempts = 50 // 最多等待5秒

    while (this.requestingYears.has(year) && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100))
      attempts++
    }
  }

  /**
   * 批量获取多个年份的节假日数据
   * @param {Array<number>} years - 年份数组
   * @returns {Promise<Map>} 年份到节假日数组的映射
   */
  async getHolidaysForYears(years) {
    const results = new Map()

    // 并行请求所有年份的数据
    const promises = years.map(async year => {
      try {
        const holidays = await this.getHolidaysForYear(year)
        results.set(year, holidays)
      } catch (error) {
        console.error(`获取${year}年节假日失败:`, error)
        results.set(year, [])
      }
    })

    await Promise.all(promises)
    return results
  }

  /**
   * 判断指定日期是否为节假日
   * @param {string|moment.Moment} date - 日期
   * @returns {Promise<Object|null>} 节假日信息或null
   */
  async isHoliday(date) {
    const momentDate = moment(date)
    const year = momentDate.year()
    const dateStr = momentDate.format('YYYY-MM-DD')

    const holidays = await this.getHolidaysForYear(year)
    return holidays.find(holiday => holiday.date === dateStr) || null
  }

  /**
   * 清除指定年份的缓存
   * @param {number} year - 年份，如果不指定则清除所有缓存
   */
  clearCache(year = null) {
    if (year) {
      this.holidayCache.delete(year)
    } else {
      this.holidayCache.clear()
    }
  }

  /**
   * 预加载指定日期范围内的节假日数据
   * @param {moment.Moment} startDate - 开始日期
   * @param {moment.Moment} endDate - 结束日期
   * @returns {Promise<Map>} 年份到节假日的映射
   */
  async preloadHolidays(startDate, endDate) {
    const startYear = moment(startDate).year()
    const endYear = moment(endDate).year()

    const years = []
    for (let year = startYear; year <= endYear; year++) {
      years.push(year)
    }

    return await this.getHolidaysForYears(years)
  }
}

// 创建全局单例实例
const holidayService = new HolidayService()

export default holidayService
