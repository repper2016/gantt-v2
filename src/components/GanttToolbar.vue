<template>
  <div class="gantt-toolbar">

    <!-- 左侧操作按钮组 -->
    <div class="toolbar-left">
      <!-- Add 按钮 -->
      <el-dropdown size="small" @command="handleAddCommand" trigger="click">
        <el-button size="small" type="primary" icon="el-icon-plus">
          Add<i class="el-icon-arrow-down el-icon--right"></i>
        </el-button>
        <el-dropdown-menu slot="dropdown">
          <el-dropdown-item command="task" icon="el-icon-document">Task</el-dropdown-item>
          <el-dropdown-item command="deliverable" icon="el-icon-folder">Deliverable</el-dropdown-item>
          <el-dropdown-item command="milestone" icon="el-icon-flag">Milestone</el-dropdown-item>
        </el-dropdown-menu>
      </el-dropdown>

      <!-- Delete 按钮 -->
      <el-button
        size="small"
        type="danger"
        icon="el-icon-delete"
        :disabled="selectedTaskCount === 0"
        @click="handleBatchDelete"
      >
        Delete
      </el-button>

      <!-- Edit 按钮（占位） -->
      <el-button size="small" icon="el-icon-edit" disabled>
        Edit
      </el-button>

      <!-- View 下拉菜单 -->
      <el-dropdown size="small" @command="handleViewCommand" trigger="click">
        <el-button size="small" icon="el-icon-view">
          View<i class="el-icon-arrow-down el-icon--right"></i>
        </el-button>
        <el-dropdown-menu slot="dropdown">
          <el-dropdown-item command="expand-all" icon="el-icon-folder-opened">Expand All</el-dropdown-item>
          <el-dropdown-item command="collapse-all" icon="el-icon-folder">Collapse All</el-dropdown-item>
          <el-dropdown-item divided command="critical-path" icon="el-icon-connection">
            {{ showCriticalPath ? 'Hide' : 'Show' }} Critical Path
          </el-dropdown-item>
        </el-dropdown-menu>
      </el-dropdown>

      <!-- Column Display 按钮 -->
      <el-button size="small" icon="el-icon-setting" @click="showColumnConfig">
        Column Display
      </el-button>
    </div>

    <!-- 中间区域 - 日期范围选择器 -->
    <div class="toolbar-center">
      <div class="date-range-group" style="display:none">
        <span class="date-label">Date Range:</span>
        <el-date-picker
          v-model="dateRangePicker"
          type="daterange"
          range-separator="至"
          start-placeholder="Start Date"
          end-placeholder="End Date"
          size="small"
          value-format="yyyy-MM-dd"
          @change="handleDateRangePickerChange"
          class="date-range-picker"
        />
      </div>
    </div>

    <!-- 右侧导航按钮组 -->
    <div class="toolbar-right">


      <!-- 时间轴导航 -->
      <div class="timeline-nav">
        <el-button size="small" icon="el-icon-arrow-left" @click="navigateTimeline('prev')" title="Previous Period"></el-button>
        <el-button size="small" @click="jumpToToday" class="today-btn">Today</el-button>
        <el-button size="small" icon="el-icon-arrow-right" @click="navigateTimeline('next')" title="Next Period"></el-button>
      </div>

      <!-- 数据操作按钮 -->
      <div class="data-operations">
        <el-dropdown size="small" @command="handleDataOperation" trigger="click">
          <el-button size="small" icon="el-icon-operation">
            Operations<i class="el-icon-arrow-down el-icon--right"></i>
          </el-button>
          <el-dropdown-menu slot="dropdown">
            <!-- 删除手动生成测试数据的入口 -->
            <!-- <el-dropdown-item command="generate-data" icon="el-icon-data-line">Generate Test Data</el-dropdown-item> -->
            <!-- <el-dropdown-item command="generate-400-blue" icon="el-icon-data-board">Generate 400 Blue Data</el-dropdown-item> -->
            <el-dropdown-item command="export-data" icon="el-icon-download">Export Data</el-dropdown-item>
            <el-dropdown-item command="import-data" icon="el-icon-upload2">Import Data</el-dropdown-item>
            <el-dropdown-item divided command="clear-data" icon="el-icon-delete">Clear All Data</el-dropdown-item>
          </el-dropdown-menu>
        </el-dropdown>
      </div>

      <!-- 视图控制组 -->
      <div class="view-controls">
        <!-- Auto范围按钮 -->
        <el-button size="small" type="text" @click="autoRange" class="auto-range-btn" title="Auto adjust date range">
          Auto
        </el-button>

        <!-- 视图模式切换 -->
        <div class="view-mode-group">
          <el-select v-model="localViewMode" size="small" @change="handleViewModeChange" class="view-mode-select">
            <el-option value="day" label="Day"></el-option>
            <el-option value="month" label="Month"></el-option>
            <el-option value="quarter" label="Quarter"></el-option>
            <el-option value="year" label="Year"></el-option>
          </el-select>
        </div>
      </div>

      <!-- 季度切换 -->
      <div class="quarter-nav">
        <span class="quarter-label">Quarter</span>
        <el-button size="small" icon="el-icon-arrow-left" @click="navigateQuarter('prev')" title="Previous Quarter"></el-button>
        <span class="quarter-text">{{ currentQuarter }}</span>
        <el-button size="small" icon="el-icon-arrow-right" @click="navigateQuarter('next')" title="Next Quarter"></el-button>
      </div>
            <!-- Save 按钮 -->
            <div class="save-section">
        <el-button size="small" type="success" icon="el-icon-check" @click="handleSave" class="save-btn">
          Save
        </el-button>
      </div>
    </div>
  </div>
</template>

<script>
import { mapState, mapActions } from 'vuex'
import moment from 'moment'

export default {
  name: 'GanttToolbar',
  props: {
    // 当前视图模式
    currentViewMode: {
      type: String,
      default: 'month'
    },
    // 是否显示关键路径
    showCriticalPath: {
      type: Boolean,
      default: false
    },
    // 选中的任务数量
    selectedTaskCount: {
      type: Number,
      default: 0
    },
    // 日期范围
    dateRange: {
      type: Array,
      default: () => []
    }
  },

  data() {
    return {
      // 本地日期范围数据
      localDateRange: [],
      // 本地视图模式
      localViewMode: 'month',
      // 当前季度显示
      currentQuarter: '2025',
      // 日期范围选择器
      dateRangePicker: null
    }
  },

  computed: {
    ...mapState(['ganttData'])
  },

  mounted() {
    try {
      // 初始化日期范围
      this.initializeDateRange()
      // 初始化季度显示
      this.updateQuarterDisplay()

      // 页面渲染完成后延迟执行Auto的点击操作
      this.$nextTick(() => {
        setTimeout(() => {
          // 确保数据已加载后再执行Auto操作
          if (this.ganttData && this.ganttData.length > 0) {
            console.log('[GanttToolbar] 自动执行Auto范围调整')
            this.autoRange()
          }
        }, 500) // 延迟500ms确保所有组件都已渲染完成
      })
    } catch (error) {
      console.error('GanttToolbar mounted error:', error)
      // 设置安全的默认值
      const today = moment()
      this.localDateRange = [
        today.clone().subtract(1, 'month').format('YYYY-MM-DD'),
        today.clone().add(1, 'month').format('YYYY-MM-DD')
      ]
      this.currentQuarter = today.year().toString()
    }
  },

  watch: {
    dateRange: {
      handler(newVal) {
        if (newVal && Array.isArray(newVal) && newVal.length === 2 &&
            newVal[0] && newVal[1] &&
            typeof newVal[0] === 'string' && typeof newVal[1] === 'string') {
          this.localDateRange = [...newVal]
          // 同步到日期选择器
          this.dateRangePicker = [...newVal]
        }
      },
      immediate: true
    },
    // 监听本地日期范围变化，同步到日期选择器
    localDateRange: {
      handler(newVal) {
        if (newVal && Array.isArray(newVal) && newVal.length === 2) {
          this.dateRangePicker = [...newVal]
        }
      },
      immediate: true
    },
    currentViewMode: {
      handler(newVal) {
        if (newVal && newVal !== this.localViewMode) {
          this.localViewMode = newVal
        }
      },
      immediate: true
    }
  },

  errorCaptured(err, vm, info) {
    console.error('GanttToolbar error captured:', err, info)
    // 阻止错误继续向上传播
    return false
  },

  methods: {
    ...mapActions([
      'addNewTask',
      'deleteTask',
      'toggleTaskCollapsed',
      'setLineageHighlight',
      'clearLineageHighlight',
      'jumpToToday',
      'generateLargeDataset'
    ]),

    // 处理Add命令
    handleAddCommand(command) {
      // 触发显示添加任务弹框，并传递任务类型
      this.$emit('show-add-dialog', command)
    },

    // 处理批量删除
    handleBatchDelete() {
      if (this.selectedTaskCount === 0) return

      this.$confirm('确定要删除选中的任务吗？此操作不可撤销。', '确认删除', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => {
        this.$emit('batch-delete')
        this.$message.success('删除成功')
      }).catch(() => {
        // 用户取消删除
      })
    },

    // 处理View命令
    handleViewCommand(command) {
      switch (command) {
        case 'expand-all':
          this.$emit('expand-all')
          break
        case 'collapse-all':
          this.$emit('collapse-all')
          break
        case 'critical-path':
          this.$emit('toggle-critical-path')
          break
      }
    },

    // 显示列配置对话框
    showColumnConfig() {
      this.$emit('show-column-config')
    },

    // 处理日期范围变化
    handleDateRangeChange(dateRange) {
      if (dateRange && dateRange.length === 2) {
        this.$emit('date-range-change', dateRange)
      }
    },

    // 处理日期选择器变化
    handleDateRangePickerChange(dateRange) {
      console.log('[GanttToolbar] 日期选择器变化:', dateRange)

      if (dateRange && Array.isArray(dateRange) && dateRange.length === 2) {
        // 更新本地日期范围
        this.localDateRange = [...dateRange]

        // 触发变化事件
        this.handleDateRangeChange(dateRange)

        // 显示更新提示
        this.$message({
          message: `日期范围已更新: ${dateRange[0]} ~ ${dateRange[1]}`,
          type: 'success',
          duration: 2000
        })
      } else if (dateRange === null) {
        // 清空日期范围时，执行Auto操作
        console.log('[GanttToolbar] 日期范围已清空，执行Auto操作')
        this.$nextTick(() => {
          this.autoRange()
        })
      }
    },

    // 自动设置日期范围 - 改进为与GanttChart的autoRangeDebounced保持一致
    autoRange() {
      console.log('[GanttToolbar] 执行Auto范围调整')

      // 如果没有数据，设置默认范围
      if (!this.ganttData || this.ganttData.length === 0) {
        const today = moment()
        this.localDateRange = [
          today.clone().subtract(1, 'month').format('YYYY-MM-DD'),
          today.clone().add(1, 'month').format('YYYY-MM-DD')
        ]
        this.handleDateRangeChange(this.localDateRange)
        return
      }

      // 根据任务数据自动计算合适的日期范围
      let minDate = null
      let maxDate = null

      // 递归遍历所有任务，包括计划日期
      const traverseTasks = (tasks) => {
        if (!Array.isArray(tasks)) return

        tasks.forEach(task => {
          // 检查开始日期
          if (task.startDate && typeof task.startDate === 'string') {
            const startDate = moment(task.startDate)
            if (startDate.isValid() && (!minDate || startDate.isBefore(minDate))) {
              minDate = startDate
            }
          }
          // 检查结束日期
          if (task.endDate && typeof task.endDate === 'string') {
            const endDate = moment(task.endDate)
            if (endDate.isValid() && (!maxDate || endDate.isAfter(maxDate))) {
              maxDate = endDate
            }
          }
          // 检查计划开始日期
          if (task.planStartDate && typeof task.planStartDate === 'string') {
            const planStartDate = moment(task.planStartDate)
            if (planStartDate.isValid() && (!minDate || planStartDate.isBefore(minDate))) {
              minDate = planStartDate
            }
          }
          // 检查计划结束日期
          if (task.planEndDate && typeof task.planEndDate === 'string') {
            const planEndDate = moment(task.planEndDate)
            if (planEndDate.isValid() && (!maxDate || planEndDate.isAfter(maxDate))) {
              maxDate = planEndDate
            }
          }
          // 递归处理子任务
          if (task.children && task.children.length > 0) {
            traverseTasks(task.children)
          }
        })
      }

      traverseTasks(this.ganttData)

      if (minDate && maxDate) {
        // 添加缓冲时间，让视图更宽松，但确保最早任务尽可能靠左
        const timeSpan = maxDate.diff(minDate, 'days')
        let leftBufferDays = 3  // 左侧缓冲很小，确保最早任务靠左
        let rightBufferDays = 15 // 右侧缓冲正常

        // 根据项目时间跨度和视图模式调整缓冲时间
        if (this.localViewMode === 'year') {
          // year视图：减少缓冲，最大化显示密度
          if (timeSpan <= 365) {
            leftBufferDays = 1   // 一年内项目：左侧1天缓冲
            rightBufferDays = 7  // 右侧7天缓冲
          } else if (timeSpan <= 1095) { // 3年内
            leftBufferDays = 3   // 3年内项目：左侧3天缓冲
            rightBufferDays = 15 // 右侧15天缓冲
          } else {
            leftBufferDays = 7   // 超长项目：左侧7天缓冲
            rightBufferDays = 30 // 右侧30天缓冲
          }
        } else if (timeSpan <= 30) {
          leftBufferDays = 2   // 短项目：左侧2天缓冲
          rightBufferDays = 7  // 右侧7天缓冲
        } else if (timeSpan <= 90) {
          leftBufferDays = 3   // 中期项目：左侧3天缓冲
          rightBufferDays = 15 // 右侧15天缓冲
        } else if (timeSpan <= 365) {
          leftBufferDays = 5   // 长期项目：左侧5天缓冲
          rightBufferDays = 30 // 右侧30天缓冲
        } else {
          leftBufferDays = 7   // 超长项目：左侧7天缓冲
          rightBufferDays = 60 // 右侧60天缓冲
        }

        const startDate = minDate.clone().subtract(leftBufferDays, 'days').format('YYYY-MM-DD')
        const endDate = maxDate.clone().add(rightBufferDays, 'days').format('YYYY-MM-DD')

        this.localDateRange = [startDate, endDate]
        this.handleDateRangeChange(this.localDateRange)

        // 显示友好的提示信息，与GanttChart保持一致
        this.$message({
          message: `Date range auto-set: ${minDate.clone().subtract(leftBufferDays, 'days').format('MMM DD')} ~ ${maxDate.clone().add(rightBufferDays, 'days').format('MMM DD, YYYY')} (${this.ganttData.length} tasks)`,
          type: 'success',
          duration: 2000
        })
      } else {
        // 如果没有找到有效日期，设置默认范围
        const today = moment()
        this.localDateRange = [
          today.clone().subtract(1, 'month').format('YYYY-MM-DD'),
          today.clone().add(1, 'month').format('YYYY-MM-DD')
        ]
        this.handleDateRangeChange(this.localDateRange)
      }
    },

    // 处理视图模式变化
    handleViewModeChange(mode) {
      this.$emit('view-mode-change', mode)
      // 每次切换视图模式后自动执行Auto操作
      this.$nextTick(() => {
        this.autoRange()
      })
    },

                // 导航时间轴 - 基于当前可视范围的日期时间做prev和next
    navigateTimeline(direction) {
      if (!this.localDateRange || this.localDateRange.length !== 2 ||
          !this.localDateRange[0] || !this.localDateRange[1]) {
        console.warn('无效的日期范围，初始化中...')
        this.initializeDateRange()
        return
      }

      // 验证日期有效性
      const startMoment = moment(this.localDateRange[0])
      const endMoment = moment(this.localDateRange[1])

      if (!startMoment.isValid() || !endMoment.isValid()) {
        console.warn('日期格式无效，重新初始化')
        this.initializeDateRange()
        return
      }

      // 计算当前时间范围的总天数（与initializeDateRange保持一致）
      const currentRangeDays = endMoment.diff(startMoment, 'days')
      console.log(`[时间轴导航] 当前可视范围: ${currentRangeDays} 天`)

      // 使用与initializeDateRange相同的视图模式判断逻辑
      const months = endMoment.diff(startMoment, 'months')
      const years = endMoment.diff(startMoment, 'years')

      // 基于视图范围大小决定移动策略（保持与Auto功能一致）
      let moveAmount, moveUnit

      if (years >= 2) {
        // 超长期项目：按年移动
        moveAmount = Math.max(1, Math.ceil(years / 4))
        moveUnit = 'years'
      } else if (months >= 12) {
        // 长期项目：按季度移动
        moveAmount = Math.max(1, Math.ceil(months / 4))
        moveUnit = 'quarters'
      } else if (months >= 6) {
        // 中期项目：按月移动
        moveAmount = Math.max(1, Math.ceil(months / 3))
        moveUnit = 'months'
      } else if (currentRangeDays > 60) {
        // 中短期项目：按月移动
        moveAmount = 1
        moveUnit = 'month'
      } else if (currentRangeDays > 30) {
        // 短期项目：按周移动
        moveAmount = Math.max(1, Math.ceil(currentRangeDays / 7))
        moveUnit = 'weeks'
      } else {
        // 超短期项目：按天移动
        moveAmount = Math.max(3, Math.ceil(currentRangeDays / 3))
        moveUnit = 'days'
      }

      // 根据方向确定移动方向
      const multiplier = direction === 'next' ? 1 : -1
      const actualMoveAmount = moveAmount * multiplier

      console.log(`[时间轴导航] 移动配置: ${actualMoveAmount} ${moveUnit}, 方向: ${direction}`)

      // 执行移动 - 同时移动起始和结束日期，保持范围大小不变
      const newStartDate = startMoment.clone().add(actualMoveAmount, moveUnit)
      const newEndDate = endMoment.clone().add(actualMoveAmount, moveUnit)

      // 更新日期范围
      this.localDateRange = [
        newStartDate.format('YYYY-MM-DD'),
        newEndDate.format('YYYY-MM-DD')
      ]

      console.log(`[时间轴导航] 新的时间范围: ${this.localDateRange[0]} 到 ${this.localDateRange[1]}`)

      // 触发变化事件
      this.handleDateRangeChange(this.localDateRange)
    },

    // 跳转到今天
    jumpToToday() {
      this.$store.dispatch('jumpToToday') // Vuex action
      this.$emit('jump-to-today')
    },

    // 处理数据操作
    handleDataOperation(command) {
      switch (command) {
        // 删除生成测试数据相关case
        // case 'generate-data':
        //   this.generateLargeDataset(100)
        //   this.$message.success('测试数据已生成')
        //   break
        // case 'generate-400-blue':
        //   this.generate400BlueDataset()
        //   this.$message.success('400条蓝色测试数据已生成')
        //   break
        case 'export-data':
          this.exportData()
          break
        case 'import-data':
          this.importData()
          break
        case 'clear-data':
          this.clearAllData()
          break
      }
    },

    // 导出数据
    exportData() {
      const data = JSON.stringify(this.ganttData, null, 2)
      const blob = new Blob([data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'gantt-data.json'
      a.click()
      URL.revokeObjectURL(url)
      this.$message.success('数据导出成功')
    },

    // 导入数据
    importData() {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.json'
      input.onchange = (e) => {
        const file = e.target.files[0]
        if (file) {
          const reader = new FileReader()
          reader.onload = (event) => {
            try {
              const data = JSON.parse(event.target.result)
              this.$emit('import-data', data)
              this.$message.success('数据导入成功')
            } catch (error) {
              this.$message.error('数据格式错误')
            }
          }
          reader.readAsText(file)
        }
      }
      input.click()
    },

    // 清空所有数据
    clearAllData() {
      this.$confirm('确定要清空所有数据吗？此操作不可撤销。', '确认清空', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => {
        this.$emit('clear-all-data')
        this.$message.success('数据已清空')
      }).catch(() => {
        // 用户取消清空
      })
    },

        // 导航季度
    navigateQuarter(direction) {
      const multiplier = direction === 'next' ? 1 : -1
      const currentYear = moment().year()
      const newYear = currentYear + multiplier
      this.currentQuarter = newYear.toString()

      // 根据新年份设置日期范围
      const startDate = moment().year(newYear).startOf('year').format('YYYY-MM-DD')
      const endDate = moment().year(newYear).endOf('year').format('YYYY-MM-DD')

      this.localDateRange = [startDate, endDate]
      this.handleDateRangeChange(this.localDateRange)

      // 触发季度变化事件
      this.$emit('quarter-change', this.currentQuarter)
    },

    // 初始化日期范围
    initializeDateRange() {
      if (!this.localDateRange || this.localDateRange.length === 0) {
        // 默认显示当前月份前后各一个月
        const today = moment()
        this.localDateRange = [
          today.clone().subtract(1, 'month').startOf('month').format('YYYY-MM-DD'),
          today.clone().add(1, 'month').endOf('month').format('YYYY-MM-DD')
        ]

        // 触发日期范围变化事件
        this.handleDateRangeChange(this.localDateRange)
      }
    },

    // 更新季度显示
    updateQuarterDisplay() {
      this.currentQuarter = moment().year().toString()
    },

    // 获取随机颜色
    getRandomColor() {
      const colors = ['#3498db', '#2ecc71', '#f39c12', '#e74c3c', '#9b59b6', '#1abc9c', '#34495e', '#e67e22']
      return colors[Math.floor(Math.random() * colors.length)]
    },

    // 处理保存操作
    handleSave() {
      this.$emit('save-data')
    }
  }
}
</script>

<style lang="scss" scoped>
.gantt-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: #fff;
  border-bottom: 1px solid #e6e6e6;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  flex-wrap: nowrap;
  gap: 16px;
  min-height: 48px;
  z-index: 100;
  position: relative;

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .toolbar-center {
    display: flex;
    align-items: center;
    gap: 16px;
    flex: 1;
    justify-content: center;
    min-width: 0;

    .date-range-group {
      display: flex;
      align-items: center;
      gap: 8px;

      .date-label {
        font-size: 12px;
        color: #666;
        white-space: nowrap;
      }

      .date-range-picker {
        width: 240px;
      }

      .auto-range-btn {
        padding: 4px 8px;
        font-size: 12px;
      }
    }

    .view-mode-group {
      display: flex;
      align-items: center;
      gap: 8px;

      .view-label {
        font-size: 12px;
        color: #666;
        white-space: nowrap;
      }

      .view-mode-select {
        width: 100px;
      }
    }
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-shrink: 0;

    .save-section {
      display: flex;
      align-items: center;

      .save-btn {
        font-weight: 600;
        min-width: 80px;
      }
    }

    .timeline-nav {
      display: flex;
      align-items: center;
      gap: 4px;

      .today-btn {
        margin: 0 4px;
        min-width: 60px;
      }
    }

    .data-operations {
      // 数据操作按钮组样式
    }

    .view-controls {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 8px;
      border-left: 1px solid #e6e6e6;
      margin-left: 8px;

      .auto-range-btn {
        color: #409eff;
        font-weight: 500;
        padding: 4px 8px;
        margin-right: 8px;
      }

      .auto-range-btn:hover {
        color: #409eff;
        background-color: #ecf5ff;
      }

      .view-mode-group {
        display: flex;
        align-items: center;
        gap: 8px;

        .view-label {
          font-size: 12px;
          color: #666;
          white-space: nowrap;
        }

        .view-mode-select {
          min-width: 90px;
        }
      }
    }

    .quarter-nav {
      display: none;
      align-items: center;
      gap: 8px;

      .quarter-label {
        font-size: 12px;
        color: #666;
        white-space: nowrap;
      }

      .quarter-text {
        font-size: 13px;
        font-weight: 500;
        color: #333;
        min-width: 40px;
        text-align: center;
      }
    }
  }

  // 响应式设计
  @media (max-width: 1200px) {
    .toolbar-center {
      .date-range-group .date-range-picker {
        width: 200px;
      }
    }
  }

  @media (max-width: 768px) {
    flex-wrap: wrap;
    gap: 8px;

    .toolbar-center {
      order: 3;
      width: 100%;
      justify-content: flex-start;
      gap: 8px;

      .date-range-group .date-range-picker {
        width: 180px;
      }
    }
  }
}

// 按钮状态样式
.el-button.is-disabled {
  opacity: 0.6;
}

// 下拉菜单图标样式
.el-icon--right {
  margin-left: 4px;
}
</style>
