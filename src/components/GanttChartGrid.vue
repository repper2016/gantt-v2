<template>
  <div class="gantt-grid" :style="{ width: gridWidth + 'px', minWidth: gridWidth + 'px', height: '100%' }">
    <!-- 垂直网格线 -->
    <div class="grid-lines" :style="{ width: gridWidth + 'px', minWidth: gridWidth + 'px', height: '100%' }">
      <div
        v-for="line in gridLines"
        :key="line.key"
        class="grid-line"
        :class="{ 'major': line.isMajor, 'today': line.isToday }"
        :style="{ left: line.position + 'px' }"
      ></div>
    </div>

    <!-- 水平行网格 -->
    <div class="grid-rows">
      <div
        v-for="(task, index) in tasks"
        :key="`grid-row-${task.id}-${index}`"
        class="grid-row"
        :class="{
          'even': index % 2 === 0,
          'odd': index % 2 === 1
        }"
        :style="{
          height: '28px', // 压缩网格行高
                      top: (index * 28) + 'px' // 压缩网格行间距
        }"
      >
        <!-- 横向标尺线 -->
        <div class="horizontal-ruler" :style="{ width: gridWidth + 'px' }"></div>
      </div>
    </div>
  </div>
</template>

<script>
import moment from 'moment'

export default {
  name: 'GanttChartGrid',
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
    tasks: {
      type: Array,
      default: () => []
    },
    zoomLevel: {
      type: Number,
      default: 1
    },
    containerWidth: {
      type: Number,
      default: null
    }
  },
  computed: {
    // 计算总天数
    totalDays() {
      return this.endDate.diff(this.startDate, 'days') + 1
    },

    // 获取容器可用宽度 - 与Timeline和Bars组件保持一致
    actualContainerWidth() {
      if (this.containerWidth) {
        return this.containerWidth
      }

      let width = 1200 // 默认值

      if (this.$el) {
        width = this.$el.clientWidth
        if (width < 100) {
          let parent = this.$el.parentElement
          while (parent && width < 100) {
            width = parent.clientWidth
            parent = parent.parentElement
          }
        }
      }

      return Math.max(width, 800)
    },

    // 自适应单位宽度 - 与Timeline和Bars完全一致
    unitWidth() {
      const availableWidth = Math.max(this.actualContainerWidth, 800)

      // 根据视图模式设置合适的单位宽度，与Timeline完全一致
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
      case 'year':
        // 年视图：优化显示，确保合理的密度和可读性，与Timeline保持一致
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

    // 计算网格总宽度，基于完整的数据范围
    gridWidth() {
      // 网格应该覆盖整个数据范围，确保向右滚动时能看到完整的网格
      return this.totalDays * this.unitWidth
    },

    // 日期位置计算方法 - 与Timeline和Bars保持一致
    getDatePosition() {
      return (date) => {
        const startOfDay = moment(date).startOf('day')
        const startOfStartDate = moment(this.startDate).startOf('day')
        const daysDiff = startOfDay.diff(startOfStartDate, 'days')
        return daysDiff * this.unitWidth
      }
    },

    gridLines() {
      const lines = []
      const start = moment(this.startDate).startOf('day')
      const end = moment(this.endDate).startOf('day')
      const today = moment().startOf('day')

      if (this.viewMode === 'year') {
        // 年视图：按月显示网格线
        const current = start.clone().startOf('month')
        while (current.isSameOrBefore(end, 'month')) {
          const monthStart = moment.max(current.clone().startOf('month'), start)
          const position = this.getDatePosition(monthStart)
          const isToday = current.isSame(today, 'month')

          lines.push({
            key: current.format('YYYY-MM'),
            position,
            isMajor: current.month() === 0, // 年份开始
            isToday
          })
          current.add(1, 'month')
        }
      } else if (this.viewMode === 'month') {
        // 月视图：按天显示网格线
        const current = start.clone()
        while (current.isSameOrBefore(end, 'day')) {
          const position = this.getDatePosition(current)
          const isWeekStart = current.day() === 1 // 周一
          const isMonthStart = current.date() === 1
          const isToday = current.isSame(today, 'day')

          lines.push({
            key: current.format('YYYY-MM-DD'),
            position,
            isMajor: isMonthStart,
            isWeekStart,
            isToday
          })
          current.add(1, 'day')
        }
      } else { // day
        // 日视图：按天显示网格线，突出周开始
        const current = start.clone()
        while (current.isSameOrBefore(end, 'day')) {
          const position = this.getDatePosition(current)
          const isWeekStart = current.day() === 1
          const isToday = current.isSame(today, 'day')

          lines.push({
            key: current.format('YYYY-MM-DD'),
            position,
            isMajor: isWeekStart,
            isToday
          })
          current.add(1, 'day')
        }
      }

      return lines
    }
  },

  mounted() {
    // 监听窗口大小变化
    this.handleResize = () => {
      this.$forceUpdate()
    }
    window.addEventListener('resize', this.handleResize)

    this.$nextTick(() => {
      setTimeout(() => {
        this.$forceUpdate()
      }, 100)
    })
  },

  beforeDestroy() {
    if (this.handleResize) {
      window.removeEventListener('resize', this.handleResize)
    }
  },

  watch: {
    startDate() {
      this.$nextTick(() => {
        this.$forceUpdate()
      })
    },
    endDate() {
      this.$nextTick(() => {
        this.$forceUpdate()
      })
    },
    containerWidth() {
      this.$nextTick(() => {
        this.$forceUpdate()
      })
    },
    viewMode() {
      this.$nextTick(() => {
        this.$forceUpdate()
      })
    }
  }
}
</script>

<style scoped>
.gantt-grid {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.grid-lines {
  position: relative;
  height: 100%;
}

.grid-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background-color: #f0f0f0;
  z-index: 1;
}

.grid-line.major {
  background-color: #e1e5e9;
  width: 2px;
}

.grid-line.today {
  background-color: #ff4757;
  width: 2px;
  box-shadow: 0 0 4px rgba(255, 71, 87, 0.3);
  z-index: 5;
}

.grid-rows {
  position: absolute;
  height: 100%;
  top: 0;
  z-index: 2;
}

.grid-row {
  position: absolute;
  left: 0;
  right: 0;
  border-bottom: 1px solid #e1e5e9;
  transition: background-color 0.2s ease;
  pointer-events: none;
  z-index: 1;
  box-sizing: border-box;
}

.horizontal-ruler {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  border-bottom: 1px solid #e1e5e9;
  background: transparent;
  z-index: 3;
  pointer-events: none;
  /* 宽度由内联样式动态设置，确保覆盖完整数据范围 */
}

/* 确保网格线可见 */
.grid-rows {
  background: transparent;
  width: 100%;
  height: 100%;
}
</style>
