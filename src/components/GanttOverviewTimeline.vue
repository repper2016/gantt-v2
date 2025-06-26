<template>
  <div v-if="isVisible" class="linear-timeline-overview">
    <div class="timeline-header">
      <div class="timeline-title">
        <h3>📊 Project Timeline Overview</h3>
        <span class="milestone-count">{{ milestones.length }} Milestones</span>
      </div>
    </div>

    <!-- 线性时间轴容器 -->
    <div
      class="linear-timeline-container"
      ref="timelineContainer"
      @scroll="handleScroll"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseUp"
    >
      <div class="timeline-track" :style="{ width: totalWidth + 'px' }">
        <!-- 时间轴主线 -->
        <div class="timeline-line"></div>

        <!-- 今天标记 -->
        <div
          v-if="todayPosition >= 0"
          class="today-marker"
          :style="{ left: todayPosition + 'px' }"
          title="Click to jump to today"
          @click="scrollToToday"
        >
          <div class="today-line"></div>
          <div class="today-label">Today</div>
        </div>

                <!-- 里程碑节点 -->
        <div
          v-for="milestone in visibleMilestones"
          :key="milestone.id"
          class="milestone-node"
          :class="getMilestoneClass(milestone)"
          :style="getMilestoneStyle(milestone)"
          :title="getMilestoneTooltip(milestone)"
          @click="selectMilestone(milestone)"
          @mousedown.stop
        >
          <!-- 节点圆圈 -->
          <div class="milestone-circle">
            <span class="milestone-icon">{{ getMilestoneIcon(milestone) }}</span>
          </div>

          <!-- 节点名称（上方） -->
          <div class="milestone-name">{{ milestone.name }}</div>

          <!-- 日期标签（下方） -->
          <div class="milestone-date">{{ formatMilestoneDate(milestone.startDate) }}</div>
        </div>
      </div>
    </div>

    <!-- 滚动指示器 -->
    <div v-if="canScroll" class="scroll-indicators">
      <button
        v-if="canScrollLeft"
        class="scroll-btn scroll-left"
        @click="scrollLeft"
        title="Scroll Left"
      >
        ◀
      </button>
      <button
        v-if="canScrollRight"
        class="scroll-btn scroll-right"
        @click="scrollRight"
        title="Scroll Right"
      >
        ▶
      </button>
    </div>
  </div>
</template>

<script>
import moment from 'moment'

export default {
  name: 'GanttOverviewTimeline',
  props: {
    tasks: {
      type: Array,
      default: () => []
    },
    startDate: {
      type: Object,
      required: true
    },
    endDate: {
      type: Object,
      required: true
    },
    visible: {
      type: Boolean,
      default: true
    }
  },

  data() {
    return {
      isVisible: this.visible,
      nodeWidth: 120, // 每个节点的宽度
      nodeSpacing: 80, // 节点间距
      scrollLeft: 0,
      containerWidth: 0,
      selectedMilestone: null,
      // 鼠标拖拽相关
      isDragging: false,
      dragStartX: 0,
      dragStartScrollLeft: 0
    }
  },

  computed: {
    // 过滤出一级节点（里程碑）
    milestones() {
      if (!this.tasks || this.tasks.length === 0) {
        return []
      }

      // 只选择一级任务或重要的里程碑任务
      return this.tasks
        .filter(task => {
          // 条件：无父任务的一级任务，或标记为里程碑的任务
          return !task.parentId ||
                 task.type === 'milestone' ||
                 task.isMilestone === true ||
                 task.priority === 'high'
        })
        .sort((a, b) => moment(a.startDate).diff(moment(b.startDate)))
        .slice(0, 50) // 最多显示50个节点，避免性能问题
    },

    // 可见的里程碑（虚拟滚动优化）
    visibleMilestones() {
      if (this.containerWidth === 0) {
        return this.milestones
      }

      const visibleStart = Math.max(0, this.scrollLeft - this.nodeWidth)
      const visibleEnd = this.scrollLeft + this.containerWidth + this.nodeWidth

      return this.milestones.filter((milestone, index) => {
        const nodePosition = index * (this.nodeWidth + this.nodeSpacing)
        return nodePosition >= visibleStart && nodePosition <= visibleEnd
      })
    },

    // 计算总宽度
    totalWidth() {
      return Math.max(
        this.milestones.length * (this.nodeWidth + this.nodeSpacing) + this.nodeSpacing,
        this.containerWidth || 800
      )
    },

    // 今天的位置
    todayPosition() {
      const today = moment()
      const projectStart = moment(this.startDate)
      const projectEnd = moment(this.endDate)

      if (today.isBefore(projectStart) || today.isAfter(projectEnd)) {
        return -1 // 今天不在项目时间范围内
      }

      // 根据里程碑分布计算今天的大概位置
      let position = 0
      for (let i = 0; i < this.milestones.length; i++) {
        const milestone = this.milestones[i]
        const milestoneDate = moment(milestone.startDate)

        if (today.isSameOrBefore(milestoneDate)) {
          // 今天在这个里程碑之前
          const prevMilestone = i > 0 ? this.milestones[i - 1] : null
          if (prevMilestone) {
            const prevDate = moment(prevMilestone.startDate)
            const daysBetween = milestoneDate.diff(prevDate, 'days')
            const daysFromPrev = today.diff(prevDate, 'days')
            const ratio = daysBetween > 0 ? daysFromPrev / daysBetween : 0

            const prevPosition = (i - 1) * (this.nodeWidth + this.nodeSpacing) + this.nodeWidth / 2
            const currentPosition = i * (this.nodeWidth + this.nodeSpacing) + this.nodeWidth / 2
            position = prevPosition + (currentPosition - prevPosition) * ratio
          } else {
            position = this.nodeSpacing
          }
          break
        } else if (i === this.milestones.length - 1) {
          // 今天在最后一个里程碑之后
          position = i * (this.nodeWidth + this.nodeSpacing) + this.nodeWidth + this.nodeSpacing
        }
      }

      return Math.max(this.nodeSpacing, Math.min(position, this.totalWidth - this.nodeSpacing))
    },

    // 滚动控制
    canScroll() {
      return this.totalWidth > this.containerWidth
    },

    canScrollLeft() {
      return this.scrollLeft > 0
    },

    canScrollRight() {
      return this.scrollLeft + this.containerWidth < this.totalWidth
    }
  },

  mounted() {
    this.updateContainerWidth()
    this.setupResizeListener()
    // 默认fit all - 滚动到开始位置
    this.$nextTick(() => {
      this.fitToContent()
    })
  },

  beforeDestroy() {
    this.removeResizeListener()
  },

  watch: {
    visible(newVal) {
      this.isVisible = newVal
    },

    milestones() {
      // 当里程碑数据变化时，重新计算容器宽度
      this.$nextTick(() => {
        this.updateContainerWidth()
        this.fitToContent() // 数据变化后自动fit all
      })
    }
  },

  methods: {
    // 获取里程碑样式
    getMilestoneStyle(milestone) {
      const index = this.milestones.findIndex(m => m.id === milestone.id)
      const left = index * (this.nodeWidth + this.nodeSpacing) + this.nodeSpacing

      return {
        left: `${left}px`,
        width: `${this.nodeWidth}px`
      }
    },

    // 获取里程碑CSS类
    getMilestoneClass(milestone) {
      const classes = []

      if (this.isOverdue(milestone)) {
        classes.push('overdue')
      } else if (this.isCompleted(milestone)) {
        classes.push('completed')
      } else if (this.isInProgress(milestone)) {
        classes.push('in-progress')
      } else {
        classes.push('pending')
      }

      if (this.isToday(milestone)) {
        classes.push('today')
      }

      if (this.selectedMilestone?.id === milestone.id) {
        classes.push('selected')
      }

      return classes
    },

    // 获取里程碑图标
    getMilestoneIcon(milestone) {
      if (this.isCompleted(milestone)) return '✅'
      if (this.isOverdue(milestone)) return '⚠️'
      if (this.isInProgress(milestone)) return '🔄'
      if (milestone.type === 'milestone') return '🎯'
      return '📍'
    },

    // 格式化里程碑日期
    formatMilestoneDate(date) {
      return moment(date).format('YYYY-MM-DD')
    },

    // 获取里程碑提示信息
    getMilestoneTooltip(milestone) {
      const date = moment(milestone.startDate).format('YYYY-MM-DD')
      const progress = milestone.progress || 0
      const status = this.getMilestoneStatus(milestone)

      return `${milestone.name}\nDate: ${date}\nProgress: ${progress}%\nStatus: ${status}`
    },

    // 获取里程碑状态
    getMilestoneStatus(milestone) {
      if (this.isCompleted(milestone)) return 'Completed'
      if (this.isOverdue(milestone)) return 'Overdue'
      if (this.isInProgress(milestone)) return 'In Progress'
      return 'Pending'
    },

    // 状态判断方法
    isCompleted(milestone) {
      return (milestone.progress || 0) >= 100
    },

    isOverdue(milestone) {
      const today = moment()
      const milestoneDate = moment(milestone.endDate || milestone.startDate)
      return today.isAfter(milestoneDate) && !this.isCompleted(milestone)
    },

    isInProgress(milestone) {
      const progress = milestone.progress || 0
      return progress > 0 && progress < 100
    },

    isToday(milestone) {
      const today = moment()
      const milestoneDate = moment(milestone.startDate)
      return today.isSame(milestoneDate, 'day')
    },

    // 选择里程碑
    selectMilestone(milestone) {
      this.selectedMilestone = milestone
      this.$emit('milestone-selected', milestone)
    },

    // 滚动到今天 - 供外部调用
    scrollToToday() {
      if (this.todayPosition < 0) {
        // 今天不在项目时间范围内，显示提示
        this.$message?.info?.('Today is not within the project timeline range.')
        return
      }

      const container = this.$refs.timelineContainer
      if (!container) return

      // 计算滚动位置，让今天居中显示
      const targetScrollLeft = Math.max(0, this.todayPosition - this.containerWidth / 2)

      // 平滑滚动到目标位置
      container.scrollTo({
        left: targetScrollLeft,
        behavior: 'smooth'
      })

      // 如果浏览器不支持smooth，使用直接设置
      setTimeout(() => {
        if (Math.abs(container.scrollLeft - targetScrollLeft) > 10) {
          container.scrollLeft = targetScrollLeft
        }
      }, 100)

      // 显示成功提示
      this.$message?.success?.('Jumped to today!')
    },

    // 适应所有内容 - 默认行为
    fitToContent() {
      if (this.$refs.timelineContainer) {
        this.$refs.timelineContainer.scrollTo({
          left: 0,
          behavior: 'smooth'
        })
      }
    },

    // 滚动控制 - 向左滚动
    scrollToLeft() {
      if (this.$refs.timelineContainer) {
        const container = this.$refs.timelineContainer
        container.scrollBy({
          left: -200,
          behavior: 'smooth'
        })
      }
    },

    scrollRight() {
      if (this.$refs.timelineContainer) {
        const container = this.$refs.timelineContainer
        container.scrollBy({
          left: 200,
          behavior: 'smooth'
        })
      }
    },

    // 鼠标拖拽相关方法
    handleMouseDown(event) {
      // 只处理左键
      if (event.button !== 0) return

      // 检查是否点击在里程碑节点上，如果是则不启动拖拽
      if (event.target.closest('.milestone-node')) return

      this.isDragging = true
      this.dragStartX = event.clientX
      this.dragStartScrollLeft = this.$refs.timelineContainer.scrollLeft

      // 阻止默认行为，避免文本选择
      event.preventDefault()

      // 改变鼠标样式
      this.$refs.timelineContainer.style.cursor = 'grabbing'

      // 添加全局事件监听
      document.addEventListener('mousemove', this.handleMouseMove)
      document.addEventListener('mouseup', this.handleMouseUp)
    },

    handleMouseMove(event) {
      if (!this.isDragging) return

      event.preventDefault()

      const deltaX = event.clientX - this.dragStartX
      const newScrollLeft = this.dragStartScrollLeft - deltaX

      // 限制滚动范围
      const maxScrollLeft = this.totalWidth - this.containerWidth
      const clampedScrollLeft = Math.max(0, Math.min(newScrollLeft, maxScrollLeft))

      this.$refs.timelineContainer.scrollLeft = clampedScrollLeft
    },

    handleMouseUp() {
      if (!this.isDragging) return

      this.isDragging = false
      this.dragStartX = 0
      this.dragStartScrollLeft = 0

      // 恢复鼠标样式
      if (this.$refs.timelineContainer) {
        this.$refs.timelineContainer.style.cursor = 'grab'
      }

      // 移除全局事件监听
      document.removeEventListener('mousemove', this.handleMouseMove)
      document.removeEventListener('mouseup', this.handleMouseUp)
    },

    // 处理滚动事件
    handleScroll(event) {
      this.scrollLeft = event.target.scrollLeft
    },

    // 更新容器宽度
    updateContainerWidth() {
      if (this.$refs.timelineContainer) {
        this.containerWidth = this.$refs.timelineContainer.clientWidth
      }
    },

    // 设置窗口大小监听器
    setupResizeListener() {
      this.resizeHandler = () => {
        this.updateContainerWidth()
      }
      window.addEventListener('resize', this.resizeHandler)
    },

    // 移除窗口大小监听器
    removeResizeListener() {
      if (this.resizeHandler) {
        window.removeEventListener('resize', this.resizeHandler)
      }
    },

    // 提供给父组件调用的方法
    scrollToTodayPosition() {
      this.scrollToToday()
    }
  }
}
</script>

<style scoped>
.linear-timeline-overview {
  background: #ffffff;
  border: 1px solid #e1e5e9;
  border-radius: 8px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  position: relative;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e1e5e9;
  background: #f8f9fa;
}

.timeline-title h3 {
  margin: 0;
  font-size: 18px;
  color: #2c3e50;
  font-weight: 600;
}

.milestone-count {
  font-size: 14px;
  color: #7f8c8d;
  margin-left: 10px;
}

/* 线性时间轴容器 */
.linear-timeline-container {
  height: 120px;
  overflow-x: auto;
  overflow-y: hidden;
  position: relative;
  padding: 15px 0;
  background: #fafbfc;
  cursor: grab;
  user-select: none;
}

.linear-timeline-container:active {
  cursor: grabbing;
}

/* 隐藏滚动条但保持滚动功能 */
.linear-timeline-container::-webkit-scrollbar {
  height: 6px;
}

.linear-timeline-container::-webkit-scrollbar-track {
  background: #f1f3f4;
}

.linear-timeline-container::-webkit-scrollbar-thumb {
  background: #c1c7cd;
  border-radius: 3px;
}

.linear-timeline-container::-webkit-scrollbar-thumb:hover {
  background: #a8aeb5;
}

/* 时间轴轨道 */
.timeline-track {
  position: relative;
  min-height: 90px;
}

/* 时间轴主线 */
.timeline-line {
  position: absolute;
  top: 45px;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #3498db, #2ecc71);
  border-radius: 2px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* 今天标记 */
.today-marker {
  position: absolute;
  top: 25px;
  transform: translateX(-50%);
  z-index: 10;
  cursor: pointer;
  transition: all 0.2s ease;
}

.today-marker:hover {
  transform: translateX(-50%) scale(1.05);
}

.today-marker:active {
  transform: translateX(-50%) scale(0.95);
}

.today-line {
  width: 2px;
  height: 28px; /* 修复今日线高度 */
  background: #e74c3c;
  margin: 0 auto;
  position: relative;
}

.today-line::before {
  content: '';
  position: absolute;
  top: -3px;
  left: -3px;
  width: 8px;
  height: 8px;
  background: #e74c3c;
  border-radius: 50%;
}

.today-label {
  text-align: center;
  font-size: 9px;
  color: #e74c3c;
  font-weight: 600;
  margin-top: 3px;
  background: white;
  padding: 1px 3px;
  border-radius: 2px;
  border: 1px solid #e74c3c;
  white-space: nowrap;
}

/* 里程碑节点 */
.milestone-node {
  position: absolute;
  top: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  transition: all 0.3s ease;
  z-index: 5;
}

.milestone-node:hover {
  transform: translateY(-1px);
  z-index: 8;
}

.milestone-node.selected {
  z-index: 9;
}

/* 里程碑圆圈 */
.milestone-circle {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid white;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;
  margin-top: 33px;
  margin-bottom: 8px;
}

.milestone-icon {
  font-size: 12px;
}

/* 里程碑名称 */
.milestone-name {
  position: absolute;
  top: 5px;
  left: 50%;
  transform: translateX(-50%);
  background: white;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
  border: 1px solid #e1e5e9;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* 里程碑日期 */
.milestone-date {
  position: absolute;
  top: 65px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 9px;
  color: #7f8c8d;
  font-weight: 500;
  background: white;
  padding: 1px 4px;
  border-radius: 2px;
  border: 1px solid #e1e5e9;
  white-space: nowrap;
  z-index: 10;
}

/* 状态样式 */
.milestone-node.completed .milestone-circle {
  background: #2ecc71;
  border-color: #27ae60;
}

.milestone-node.completed .milestone-name {
  color: #27ae60;
  border-color: #2ecc71;
}

.milestone-node.in-progress .milestone-circle {
  background: #3498db;
  border-color: #2980b9;
}

.milestone-node.in-progress .milestone-name {
  color: #2980b9;
  border-color: #3498db;
}

.milestone-node.overdue .milestone-circle {
  background: #e74c3c;
  border-color: #c0392b;
  animation: pulse 2s infinite;
}

.milestone-node.overdue .milestone-name {
  color: #c0392b;
  border-color: #e74c3c;
}

.milestone-node.pending .milestone-circle {
  background: #95a5a6;
  border-color: #7f8c8d;
}

.milestone-node.pending .milestone-name {
  color: #7f8c8d;
  border-color: #95a5a6;
}

.milestone-node.today .milestone-circle {
  border-color: #e74c3c;
  box-shadow: 0 0 0 2px rgba(231, 76, 60, 0.3);
}

.milestone-node.selected .milestone-circle {
  transform: scale(1.05);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.03);
    opacity: 0.8;
  }
}

/* 滚动指示器 */
.scroll-indicators {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 100%;
  display: flex;
  justify-content: space-between;
  pointer-events: none;
  z-index: 20;
}

.scroll-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(52, 152, 219, 0.9);
  color: white;
  border: none;
  cursor: pointer;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  transition: all 0.2s ease;
  margin: 0 10px;
}

.scroll-btn:hover {
  background: #2980b9;
  transform: scale(1.1);
}

.scroll-left {
  margin-left: 10px;
}

.scroll-right {
  margin-right: 10px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .timeline-header {
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
  }

  .milestone-name {
    font-size: 10px;
    max-width: 70px;
    padding: 2px 4px;
  }

  .milestone-date {
    font-size: 8px;
  }

  .nodeWidth {
    width: 100px;
  }

  .nodeSpacing {
    margin: 60px;
  }
}
</style>
