<template>
  <div class="gantt-timeline" ref="timelineContainer" :style="{ width: timelineWidth + 'px', minWidth: timelineWidth + 'px', overflowX: 'hidden' }">
    <!-- 主时间轴 -->
    <div class="timeline-scale-top" ref="scaleTop" :style="{ width: timelineWidth + 'px', minWidth: timelineWidth + 'px' }">
      <div
        v-for="period in mainPeriods"
        :key="period.key"
        class="scale-item scale-main"
        :style="{ width: period.width + 'px' }"
      >
        {{ period.label }}
      </div>
    </div>

    <!-- 子时间轴 -->
    <div class="timeline-scale-bottom" ref="scaleBottom" :style="{ width: timelineWidth + 'px', minWidth: timelineWidth + 'px' }">
      <div
        v-for="unit in subPeriods"
        :key="unit.key"
        class="scale-item scale-sub"
        :class="{
          'is-today': unit.isToday,
          'is-weekend': unit.isWeekend,
          'is-saturday': unit.isSaturday,
          'is-sunday': unit.isSunday,
          'is-holiday': unit.isHoliday,
          'is-month-start': unit.isMonthStart
        }"
        :style="{ width: unit.width + 'px' }"
        :title="getTimelineCellTooltip(unit)"
      >
        {{ unit.label }}
      </div>
    </div>

    <!-- 额外的右侧空间，确保时间轴足够宽 -->
    <div class="timeline-extra-space" :style="{ width: '100px', height: '1px' }"></div>
  </div>
</template>

<script>
import moment from 'moment'
import holidayService from '@/services/holidayService'

export default {
  name: 'GanttTimeline',
  props: {
    viewMode: {
      type: String,
      default: 'month'
    },
    startDate: {
      type: Object,
      required: true
    },
    endDate: {
      type: Object,
      required: true
    },
    zoomLevel: {
      type: Number,
      default: 1
    },
    panOffset: {
      type: Number,
      default: 0
    },
    containerWidth: {
      type: Number,
      default: null
    }
  },
  data() {
    return {
      actualWidth: 1200,
      holidaysCache: new Map() // 节假日数据缓存
    }
  },
  computed: {
    // 计算总天数
    totalDays() {
      return this.endDate.diff(this.startDate, 'days') + 1
    },

    // 获取容器可用宽度
    actualContainerWidth() {
      // 优先使用父组件传入的宽度
      if (this.containerWidth && this.containerWidth > 100) {
        return this.containerWidth
      }

      // 使用缓存的宽度
      return this.actualWidth
    },

    // 自适应单位宽度 - 与甘特图保持完全一致的计算逻辑
    unitWidth() {
      // 使用与GanttChart.getDayWidth()完全相同的计算逻辑
      const availableWidth = Math.max(this.actualContainerWidth, 800)

      // 根据视图模式设置合适的单位宽度，保持与甘特图一致
      let baseWidth
      switch(this.viewMode) {
      case 'day':
        // 日视图：每天至少40px，最多80px
        baseWidth = Math.min(Math.max(availableWidth / this.totalDays, 40), 80)
        break
      case 'month':
        // 月视图：每天至少3px，最多20px
        baseWidth = Math.min(Math.max(availableWidth / this.totalDays, 3), 20)
        break
      case 'quarter':
        // 季度视图：每天至少2px，最多10px
        baseWidth = Math.min(Math.max(availableWidth / this.totalDays, 2), 10)
        break
      case 'year':
        // 年视图：优化显示，确保合理的密度和可读性
        if (this.totalDays <= 365) {
          // 一年以内：每天至少2px，最多8px
          baseWidth = Math.min(Math.max(availableWidth / this.totalDays, 2), 8)
        } else if (this.totalDays <= 1095) { // 3年以内
          // 1-3年：每天1.5-4px
          baseWidth = Math.min(Math.max(availableWidth / this.totalDays, 1.5), 4)
        } else if (this.totalDays <= 1825) { // 5年以内
          // 3-5年：每天1-2px
          baseWidth = Math.min(Math.max(availableWidth / this.totalDays, 1), 2)
        } else {
          // 超过5年：每天至少0.8px，保证能显示完整
          baseWidth = Math.max(availableWidth / this.totalDays, 0.8)
        }
        break
      default:
        baseWidth = Math.max(availableWidth / this.totalDays, 3)
      }

      return baseWidth
    },

    timelineWidth() {
      // 计算实际需要的时间轴宽度，基于完整的数据范围
      const totalWidth = this.totalDays * this.unitWidth
      // 确保时间轴至少撑满屏幕宽度，但不小于计算出的总宽度
      const minWidth = Math.max(this.actualContainerWidth, 1200)
      return Math.max(totalWidth, minWidth)
    },

    mainPeriods() {
      const periods = []
      const start = moment(this.startDate)
      const end = moment(this.endDate)

      if (this.viewMode === 'year') {
        // 年视图：第一级按年分组
        const current = start.clone().startOf('year')
        while (current.isSameOrBefore(end, 'year')) {
          const yearStart = moment.max(current.clone().startOf('year'), start)
          const yearEnd = moment.min(current.clone().endOf('year'), end)

          const startPosition = this.getDatePosition(yearStart)
          const endPosition = this.getDatePosition(yearEnd.clone().add(1, 'day'))
          const width = endPosition - startPosition

          periods.push({
            key: current.format('YYYY'),
            label: current.format('YYYY'),
            width,
            startDate: yearStart.format('YYYY-MM-DD'),
            endDate: yearEnd.format('YYYY-MM-DD')
          })

          current.add(1, 'year')
        }
      } else if (this.viewMode === 'quarter') {
        // 季度视图：第一级按年分组
        const current = start.clone().startOf('year')
        while (current.isSameOrBefore(end, 'year')) {
          const yearStart = moment.max(current.clone().startOf('year'), start)
          const yearEnd = moment.min(current.clone().endOf('year'), end)

          const startPosition = this.getDatePosition(yearStart)
          const endPosition = this.getDatePosition(yearEnd.clone().add(1, 'day'))
          const width = endPosition - startPosition

          periods.push({
            key: current.format('YYYY'),
            label: current.format('YYYY'),
            width,
            startDate: yearStart.format('YYYY-MM-DD'),
            endDate: yearEnd.format('YYYY-MM-DD')
          })

          current.add(1, 'year')
        }
      } else if (this.viewMode === 'month') {
        // 月视图：第一级按年分组
        const current = start.clone().startOf('year')
        while (current.isSameOrBefore(end, 'year')) {
          const yearStart = moment.max(current.clone().startOf('year'), start)
          const yearEnd = moment.min(current.clone().endOf('year'), end)

          const startPosition = this.getDatePosition(yearStart)
          const endPosition = this.getDatePosition(yearEnd.clone().add(1, 'day'))
          const width = endPosition - startPosition

          periods.push({
            key: current.format('YYYY'),
            label: current.format('YYYY'),
            width,
            startDate: yearStart.format('YYYY-MM-DD'),
            endDate: yearEnd.format('YYYY-MM-DD')
          })

          current.add(1, 'year')
        }
      } else { // day
        // 日视图：第一级显示年、月、周
        const current = start.clone().startOf('month')
        while (current.isSameOrBefore(end, 'month')) {
          const monthStart = moment.max(current.clone().startOf('month'), start)
          const monthEnd = moment.min(current.clone().endOf('month'), end)

          const startPosition = this.getDatePosition(monthStart)
          const endPosition = this.getDatePosition(monthEnd.clone().add(1, 'day'))
          const width = endPosition - startPosition

          // 根据月份宽度选择合适的标签格式
          let label
          if (width > 100) {
            label = current.format('YYYY MMM') // 完整格式：2024 Jan
          } else if (width > 60) {
            label = current.format('MMM YY') // 短格式：Jan 24
          } else {
            label = current.format('MM/YY') // 最短格式：01/24
          }

          periods.push({
            key: current.format('YYYY-MM'),
            label,
            width,
            startDate: monthStart.format('YYYY-MM-DD'),
            endDate: monthEnd.format('YYYY-MM-DD')
          })

          current.add(1, 'month')
        }
      }

      return periods
    },

    subPeriods() {
      const periods = []
      const start = moment(this.startDate)
      const end = moment(this.endDate)
      const today = moment().startOf('day')

      if (this.viewMode === 'year') {
        // 年视图：显示月份
        const current = start.clone().startOf('month')
        while (current.isSameOrBefore(end, 'month')) {
          const monthStart = moment.max(current.clone().startOf('month'), start)
          const monthEnd = moment.min(current.clone().endOf('month'), end)

          const startPosition = this.getDatePosition(monthStart)
          const endPosition = this.getDatePosition(monthEnd.clone().add(1, 'day'))
          const width = endPosition - startPosition

          // 根据月份宽度选择合适的标签格式
          let label
          if (width > 40) {
            label = current.format('MMM') // 完整月份名：Jan
          } else if (width > 25) {
            label = current.format('MM') // 月份数字：01
          } else {
            label = current.format('M') // 简短月份：1
          }

          periods.push({
            key: current.format('YYYY-MM'),
            label,
            width,
            isToday: current.isSame(today, 'month'),
            date: current.format('YYYY-MM-DD')
          })

          current.add(1, 'month')
        }
      } else if (this.viewMode === 'quarter') {
        // 季度视图：第二级显示季度
        const current = start.clone().startOf('quarter')
        while (current.isSameOrBefore(end, 'quarter')) {
          const quarterStart = moment.max(current.clone().startOf('quarter'), start)
          const quarterEnd = moment.min(current.clone().endOf('quarter'), end)

          const startPosition = this.getDatePosition(quarterStart)
          const endPosition = this.getDatePosition(quarterEnd.clone().add(1, 'day'))
          const width = endPosition - startPosition

          // 季度标签格式：Q1, Q2, Q3, Q4
          const quarterNumber = Math.floor(current.month() / 3) + 1
          let label
          if (width > 40) {
            label = `Q${quarterNumber}`
          } else {
            label = `${quarterNumber}`
          }

          periods.push({
            key: current.format('YYYY-Q') + quarterNumber,
            label,
            width,
            isToday: current.isSame(today, 'quarter'),
            date: current.format('YYYY-MM-DD')
          })

          current.add(1, 'quarter')
        }
      } else if (this.viewMode === 'month') {
        // 月视图：第二级显示月份
        const current = start.clone().startOf('month')
        while (current.isSameOrBefore(end, 'month')) {
          const monthStart = moment.max(current.clone().startOf('month'), start)
          const monthEnd = moment.min(current.clone().endOf('month'), end)

          const startPosition = this.getDatePosition(monthStart)
          const endPosition = this.getDatePosition(monthEnd.clone().add(1, 'day'))
          const width = endPosition - startPosition

          // 根据月份宽度选择合适的标签格式
          let label
          if (width > 50) {
            label = current.format('MMM') // 完整月份名：Jan
          } else if (width > 30) {
            label = current.format('MM') // 月份数字：01
          } else {
            label = current.format('M') // 简短月份：1
          }

          periods.push({
            key: current.format('YYYY-MM'),
            label,
            width,
            isToday: current.isSame(today, 'month'),
            date: current.format('YYYY-MM-DD')
          })

          current.add(1, 'month')
        }
      } else { // day
        // 日视图：第二级显示日期
        const current = start.clone()
        while (current.isSameOrBefore(end, 'day')) {
          const dayOfWeek = current.day()
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
          const isSaturday = dayOfWeek === 6
          const isSunday = dayOfWeek === 0
          const dayOfMonth = current.date()
          const isMonthStart = dayOfMonth === 1 // 修复：正确判断每月1号

          // 获取节假日信息
          const holidayInfo = this.getHolidayInfo(current)

          // 修复标签显示逻辑，避免重叠
          let label = ''

          if (this.unitWidth >= 25) {
            // 宽度足够时显示完整日期
            label = current.format('DD')
          } else if (this.unitWidth >= 15) {
            // 中等宽度时显示简短日期
            label = current.format('D')
          } else if (this.unitWidth >= 8) {
            // 较小宽度时只显示特定日期
            if (dayOfMonth === 1 || dayOfMonth === 15 || dayOfMonth % 10 === 0) {
              label = current.format('D')
            }
          } else {
            // 最小宽度时只显示月初
            if (dayOfMonth === 1) {
              label = current.format('M/D')
            }
          }

          periods.push({
            key: current.format('YYYY-MM-DD'),
            label,
            width: this.unitWidth,
            isToday: current.isSame(today, 'day'),
            isWeekend,
            isSaturday,
            isSunday,
            isHoliday: holidayInfo !== null,
            holidayInfo,
            isMonthStart, // 添加月初标记
            date: current.format('YYYY-MM-DD'),
            actualWidth: this.unitWidth // 添加实际宽度用于样式计算
          })

          current.add(1, 'day')
        }
      }

      return periods
    }
  },

  methods: {
    // 修复日期对齐问题 - 确保日期计算与任务条对齐
    getDatePosition(date) {
      const startOfDay = moment(date).startOf('day')
      const startOfStartDate = moment(this.startDate).startOf('day')
      const daysDiff = startOfDay.diff(startOfStartDate, 'days')
      return daysDiff * this.unitWidth
    },

    // 更新实际宽度
    updateActualWidth() {
      if (this.$refs.timelineContainer) {
        const width = this.$refs.timelineContainer.clientWidth
        if (width > 100) {
          this.actualWidth = width
        } else if (this.$refs.timelineContainer.parentElement) {
          const parentWidth = this.$refs.timelineContainer.parentElement.clientWidth
          if (parentWidth > 100) {
            this.actualWidth = parentWidth
          }
        }
      }
    },

    // 更新时间轴日期范围
    updateTimelineRange(startDate, endDate) {
      // 由于时间轴组件是响应式的，只需触发重新渲染
      // 这个方法主要是为了提供一个接口，让父组件可以通知时间轴更新
      this.$nextTick(() => {
        this.updateActualWidth()
        // 预加载节假日数据
        this.preloadHolidays()
        // 强制重新渲染
        this.$forceUpdate()
      })
    },

    // 获取节假日信息
    getHolidayInfo(date) {
      const dateStr = moment(date).format('YYYY-MM-DD')
      const year = moment(date).year()

      // 从缓存中获取节假日数据
      const yearHolidays = this.holidaysCache.get(year)
      if (yearHolidays) {
        return yearHolidays.find(holiday => holiday.date === dateStr) || null
      }

      return null
    },

    // 获取时间轴单元格的提示信息
    getTimelineCellTooltip(unit) {
      let tooltip = unit.date

      if (unit.isToday) {
        tooltip += ' (Today)'
      }

      if (unit.isHoliday && unit.holidayInfo) {
        tooltip += ` - ${unit.holidayInfo.name}`
      } else if (unit.isSaturday) {
        tooltip += ' (Saturday)'
      } else if (unit.isSunday) {
        tooltip += ' (Sunday)'
      }

      if (unit.isMonthStart) {
        tooltip += ' (Month Start)'
      }

      return tooltip
    },

    // 预加载节假日数据
    async preloadHolidays() {
      try {
        const startYear = this.startDate.year()
        const endYear = this.endDate.year()

        const years = []
        for (let year = startYear; year <= endYear; year++) {
          if (!this.holidaysCache.has(year)) {
            years.push(year)
          }
        }

        if (years.length > 0) {
          console.log(`预加载节假日数据: ${years.join(', ')}`)

          // 并行获取所有年份的节假日数据
          const holidayPromises = years.map(async year => {
            try {
              const holidays = await holidayService.getHolidaysForYear(year)
              this.holidaysCache.set(year, holidays)
              return { year, holidays }
            } catch (error) {
              console.error(`获取${year}年节假日失败:`, error)
              this.holidaysCache.set(year, [])
              return { year, holidays: [] }
            }
          })

          await Promise.all(holidayPromises)

          // 数据加载完成后重新渲染
          this.$forceUpdate()
        }
      } catch (error) {
        console.error('预加载节假日数据失败:', error)
      }
    }
  },

  mounted() {
    // 初始化实际宽度
    this.$nextTick(() => {
      this.updateActualWidth()
      // 初始化时预加载节假日数据
      this.preloadHolidays()
    })

    // 监听窗口大小变化，重新计算
    this.handleResize = () => {
      this.updateActualWidth()
    }
    window.addEventListener('resize', this.handleResize)
  },

  beforeDestroy() {
    if (this.handleResize) {
      window.removeEventListener('resize', this.handleResize)
    }
  },

  watch: {
    containerWidth: {
      handler(newWidth) {
        if (newWidth && newWidth > 100) {
          this.actualWidth = newWidth
        }
      },
      immediate: true
    },
    // 监听日期范围变化，确保时间轴正确更新
    startDate: {
      handler() {
        // 当开始日期变化时，强制重新计算所有位置
        this.$nextTick(() => {
          this.updateActualWidth()
        })
      },
      deep: true
    },
    endDate: {
      handler() {
        // 当结束日期变化时，强制重新计算所有位置
        this.$nextTick(() => {
          this.updateActualWidth()
        })
      },
      deep: true
    }
  }
}
</script>

<style scoped>
.gantt-timeline {
  position: relative;
  background: #ffffff;
  border-bottom: 1px solid #e1e8ed;
  user-select: none;
  width: 100%;
  min-width: 100%;
  overflow: hidden;
  /* DHTMLX风格：简洁白色背景 */
}

.timeline-scale-top,
.timeline-scale-bottom {
  display: flex;
  width: 100%;
  min-width: 100%;
  background: inherit;
  box-sizing: border-box;
}

.timeline-scale-top {
  height: 32px;
  background: #f8f9fa;
  color: #374151;
  font-weight: 600;
  border-bottom: 1px solid #e1e8ed;
  /* DHTMLX风格：浅灰色背景，深灰色文字 */
}

.timeline-scale-bottom {
  height: 28px;
  background: #ffffff;
  color: #6b7280;
  font-weight: 500;
  /* DHTMLX风格：白色背景，中等灰色文字 */
}

.scale-item {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: background-color 0.2s ease;
  background: inherit;
  flex-shrink: 0;
  position: relative;
  box-sizing: border-box;
  outline: none;
  border: none;
  padding: 0;
  margin: 0;
}

.scale-item::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 1px;
  background: #e1e8ed;
  pointer-events: none;
  /* DHTMLX风格：统一的边框颜色 */
}

.timeline-scale-bottom .scale-item::after {
  background: #f0f3f6;
  /* 更浅的分隔线 */
}

.timeline-scale-bottom .scale-item {
  font-size: 11px;
  min-height: 28px;
}

.scale-item.is-today {
  background: rgba(74, 144, 226, 0.08) !important;
  color: #4a90e2 !important;
  font-weight: 700;
  z-index: 10;
  /* DHTMLX蓝色主题 */
}

.scale-item.is-today::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(74, 144, 226, 0.05);
  border-left: 2px solid #4a90e2;
  border-right: 2px solid #4a90e2;
  pointer-events: none;
}

.scale-item.is-weekend {
  background: rgba(107, 114, 128, 0.04);
  color: #9ca3af;
  /* 更淡的周末颜色 */
}

/* 周六特殊样式 - 蓝色主题 */
.scale-item.is-saturday {
  background: rgba(59, 130, 246, 0.12) !important;
  color: #2563eb !important;
  font-weight: 600;
  position: relative;
  /* 周六用蓝色高亮 */
}

.scale-item.is-saturday::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.15) 100%);
  border-left: 2px solid #3b82f6;
  pointer-events: none;
  z-index: -1;
}

/* 周日特殊样式 - 红色主题 */
.scale-item.is-sunday {
  background: rgba(239, 68, 68, 0.12) !important;
  color: #dc2626 !important;
  font-weight: 600;
  position: relative;
  /* 周日用红色高亮 */
}

.scale-item.is-sunday::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(239, 68, 68, 0.15) 100%);
  border-left: 2px solid #ef4444;
  pointer-events: none;
  z-index: -1;
}

/* 节假日特殊样式 - 金色主题 */
.scale-item.is-holiday {
  background: rgba(245, 158, 11, 0.15) !important;
  color: #d97706 !important;
  font-weight: 700;
  position: relative;
  z-index: 20;
  /* 节假日用金色高亮，优先级最高 */
}

.scale-item.is-holiday::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(245, 158, 11, 0.2) 100%);
  border-left: 3px solid #f59e0b;
  border-right: 1px solid #f59e0b;
  pointer-events: none;
  z-index: -1;
}

.scale-item.is-holiday::after {
  content: '🎉';
  position: absolute;
  top: 2px;
  right: 2px;
  font-size: 8px;
  line-height: 1;
  pointer-events: none;
  /* 节假日小图标 */
}

.scale-item.is-month-start {
  /* background: #eee !important;
  color: #ccc !important;
  font-weight: 600;
  z-index: 5; */
  /* 统一使用DHTMLX蓝色 */
}

.scale-item.is-month-start::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-left: 2px solid #4a90e2;
  background: rgba(74, 144, 226, 0.03);
  pointer-events: none;
}

.timeline-scale-top .scale-item {
  font-weight: 600;
  text-shadow: none;
  /* 移除文字阴影，保持简洁 */
}

.scale-item:hover {
  background-color: rgba(74, 144, 226, 0.08);
  color: #4a90e2;
  /* DHTMLX悬停效果 */
}

.scale-item.is-today:hover {
  background: rgba(74, 144, 226, 0.12) !important;
}

@media (max-width: 768px) {
  .scale-item {
    font-size: 10px;
  }

  .timeline-scale-bottom .scale-item {
    font-size: 9px;
  }

  .timeline-scale-top {
    height: 28px;
  }

  .timeline-scale-bottom {
    height: 24px;
  }
}

.scale-item:empty::after {
  background: transparent;
}

.scale-item[style*="width: 1px"],
.scale-item[style*="width: 2px"],
.scale-item[style*="width: 3px"] {
  font-size: 0;
  padding: 0;
}

.scale-item[style*="width: 1px"]::after,
.scale-item[style*="width: 2px"]::after,
.scale-item[style*="width: 3px"]::after {
  display: none;
}

.gantt-timeline::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: inherit;
  z-index: -1;
}

/* 组合样式 - 节假日优先级最高 */
.scale-item.is-holiday.is-today {
  background: linear-gradient(135deg,
    rgba(245, 158, 11, 0.2) 0%,
    rgba(74, 144, 226, 0.1) 100%) !important;
  box-shadow: inset 0 0 0 2px #f59e0b, inset 0 0 0 4px rgba(74, 144, 226, 0.3);
}

.scale-item.is-holiday.is-saturday {
  background: linear-gradient(135deg,
    rgba(245, 158, 11, 0.18) 0%,
    rgba(59, 130, 246, 0.08) 100%) !important;
}

.scale-item.is-holiday.is-sunday {
  background: linear-gradient(135deg,
    rgba(245, 158, 11, 0.18) 0%,
    rgba(239, 68, 68, 0.08) 100%) !important;
}

/* 今天与月初的组合样式 */
.scale-item.is-today.is-month-start {
  background: linear-gradient(45deg,
    rgba(74, 144, 226, 0.08) 0%,
    rgba(74, 144, 226, 0.08) 50%,
    rgba(74, 144, 226, 0.06) 50%,
    rgba(74, 144, 226, 0.06) 100%) !important;
}

.scale-item.is-today.is-month-start::before {
  border-left: 2px solid #4a90e2;
  border-right: 2px solid #4a90e2;
}

/* 今天与周六的组合样式 */
.scale-item.is-today.is-saturday {
  background: linear-gradient(135deg,
    rgba(74, 144, 226, 0.15) 0%,
    rgba(59, 130, 246, 0.12) 100%) !important;
  box-shadow: inset 0 0 0 2px #4a90e2;
}

/* 今天与周日的组合样式 */
.scale-item.is-today.is-sunday {
  background: linear-gradient(135deg,
    rgba(74, 144, 226, 0.12) 0%,
    rgba(239, 68, 68, 0.12) 100%) !important;
  box-shadow: inset 0 0 0 2px #4a90e2;
}

/* 悬停效果增强 */
.scale-item.is-saturday:hover {
  background: rgba(59, 130, 246, 0.18) !important;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);
}

.scale-item.is-sunday:hover {
  background: rgba(239, 68, 68, 0.18) !important;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(239, 68, 68, 0.2);
}

.scale-item.is-holiday:hover {
  background: rgba(245, 158, 11, 0.22) !important;
  transform: translateY(-1px);
  box-shadow: 0 3px 6px rgba(245, 158, 11, 0.3);
}
</style>
