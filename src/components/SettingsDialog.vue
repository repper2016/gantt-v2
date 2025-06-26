<template>
  <el-dialog
    title="Gantt Chart Settings"
    :visible.sync="dialogVisible"
    width="600px"
    class="settings-dialog"
    :before-close="handleClose"
    :close-on-click-modal="false"
      :close-on-press-escape="true"
      :append-to-body="true"
      :modal-append-to-body="true"
  >
    <div class="settings-content">
      <!-- 日期范围设置 -->
      <div class="setting-section">
        <h3>日期范围设置</h3>
        <div class="setting-item">
          <label>Date Range:</label>
          <el-date-picker
            v-model="localDateRange"
            type="daterange"
            start-placeholder="Start Date"
            end-placeholder="End Date"
            value-format="yyyy-MM-dd"
            format="yyyy-MM-dd"
            @change="handleDateRangeChange"
            class="date-range-picker"
            size="medium"
            :clearable="true"
          />
          <el-button
            type="primary"
            size="small"
            @click="autoRange"
            style="margin-left: 10px;"
          >
            Auto Range
          </el-button>
        </div>
      </div>

      <!-- 显示设置 -->
      <div class="setting-section">
        <h3>显示设置</h3>

        <div class="setting-item">
          <el-checkbox v-model="localTooltipEnabled">
            Enable Tooltip
          </el-checkbox>
        </div>
        <div class="setting-item" v-if="localTooltipEnabled">
          <label>Tooltip Delay (ms):</label>
          <el-input-number
            v-model="localTooltipDelay"
            :min="0"
            :max="5000"
            @change="updateTooltipDelay"
            size="small"
            style="width: 120px; margin-left: 10px;"
          />
        </div>
        <div class="setting-item" v-if="localTooltipEnabled">
          <label>Tooltip Hide Delay (ms):</label>
          <el-input-number
            v-model="localTooltipHideDelay"
            :min="0"
            :max="2000"
            @change="updateTooltipHideDelay"
            size="small"
            style="width: 120px; margin-left: 10px;"
          />
        </div>
        <div class="setting-item">
          <el-checkbox v-model="localTimelineVisible">
            Show Overview Timeline
          </el-checkbox>
        </div>
      </div>

      <!-- Connection Settings -->
      <div class="setting-section">
        <h3>Connection Settings</h3>
        <div class="setting-item">
          <el-checkbox v-model="localGrayConnectionMode">
            Gray Connection Lines
          </el-checkbox>
        </div>
        <div class="setting-item">
          <label class="setting-label">Highlight Task Dependencies</label>
          <el-switch v-model="localGanttDisplayConfig.highlightTaskLineage" @change="updateGanttDisplayConfig" />
          <div class="setting-description" v-if="localGanttDisplayConfig.highlightTaskLineage">
            <i class="el-icon-info"></i>
            Click task nodes to highlight upstream and downstream dependencies
          </div>
        </div>
        <div class="setting-item">
          <label class="setting-label">Editable Connections</label>
          <el-switch v-model="localConnectionEditable" @change="updateConnectionEditable" />
          <div class="setting-description" v-if="!localConnectionEditable">
            <i class="el-icon-info"></i>
            When disabled, all connection lines use default gray color and cannot be double-clicked to edit
          </div>
        </div>
        <div class="setting-item">
          <el-button
            type="warning"
            size="small"
            @click="clearHighlight"
            :disabled="!hasHighlight"
          >
            Clear Highlight
          </el-button>
        </div>
      </div>

      <!-- Performance Optimization -->
      <div class="setting-section">
        <h3>Performance Optimization</h3>
        <div class="setting-item">
          <el-checkbox v-model="localAutoOptimizeEnabled">
            Auto Optimization
          </el-checkbox>
        </div>
      </div>

      <!-- Gantt Display Settings -->
      <div class="setting-section">
        <h3>Gantt Display Settings</h3>
        <el-row :gutter="20">
          <el-col :span="12">
            <div class="setting-item">
              <label class="setting-label">Task Name</label>
              <el-switch v-model="localGanttDisplayConfig.showTaskName" @change="updateGanttDisplayConfig" />
            </div>
          </el-col>
          <el-col :span="12">
            <div class="setting-item">
              <label class="setting-label">Show Progress</label>
              <el-switch v-model="localGanttDisplayConfig.showProgress" @change="updateGanttDisplayConfig" />
            </div>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <div class="setting-item">
              <label class="setting-label">Progress Dragging</label>
              <el-switch v-model="localGanttDisplayConfig.showProgressHandle" @change="updateGanttDisplayConfig" />
            </div>
          </el-col>
          <el-col :span="12">
            <div class="setting-item">
              <label class="setting-label">Connections</label>
              <el-switch v-model="localGanttDisplayConfig.showConnections" @change="updateGanttDisplayConfig" />
            </div>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <div class="setting-item">
              <label class="setting-label">Connection Labels</label>
              <el-switch v-model="localGanttDisplayConfig.showConnectionLabels" @change="updateGanttDisplayConfig" />
            </div>
          </el-col>
          <el-col :span="12">
            <div class="setting-item">
              <label class="setting-label">Plan Nodes</label>
              <el-switch v-model="localGanttDisplayConfig.showPlanNodes" @change="updateGanttDisplayConfig" />
            </div>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <div class="setting-item">
              <label class="setting-label">Milestones</label>
              <el-switch v-model="localGanttDisplayConfig.showMilestones" @change="updateGanttDisplayConfig" />
            </div>
          </el-col>
          <el-col :span="12">
            <div class="setting-item">
              <label class="setting-label">Critical Path</label>
              <el-switch v-model="localGanttDisplayConfig.showCriticalPath" @change="updateGanttDisplayConfig" />
            </div>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <div class="setting-item">
              <label class="setting-label">Three-level Nodes</label>
              <el-switch v-model="localGanttDisplayConfig.enableThreeLevelNodes" @change="updateGanttDisplayConfig" />
            </div>
          </el-col>
          <el-col :span="12">
            <div class="setting-item">
              <label class="setting-label">Parent Node Draggable</label>
              <el-switch v-model="localGanttDisplayConfig.allowParentDrag" @change="updateGanttDisplayConfig" />
            </div>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <div class="setting-item">
              <label class="setting-label">Parent Node Editable</label>
              <el-switch v-model="localGanttDisplayConfig.allowParentEdit" @change="updateGanttDisplayConfig" />
            </div>
          </el-col>
        </el-row>
      </div>

      <!-- Data Operations -->
      <div class="setting-section">
        <h3>Data Operations</h3>
        <div class="setting-item">
          <el-button type="primary" @click="jumpToToday">
            <i class="el-icon-date"></i> Jump to Today
          </el-button>
          <el-button type="success" @click="showAddTaskDialog">
            <i class="el-icon-plus"></i> Add Task
          </el-button>
          <el-button type="info" @click="exportData">
            <i class="el-icon-download"></i> Export Data
          </el-button>
        </div>
      </div>
    </div>

    <span slot="footer" class="dialog-footer">
      <el-button @click="handleClose">Cancel</el-button>
      <el-button type="primary" @click="handleSave">Save Settings</el-button>
    </span>
  </el-dialog>
</template>

<script>
export default {
  name: 'SettingsDialog',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    dateRange: {
      type: Array,
      default: () => null
    },
    tooltipEnabled: {
      type: Boolean,
      default: false
    },
    tooltipDelay: {
      type: Number,
      default: 1000
    },
    tooltipHideDelay: {
      type: Number,
      default: 300
    },
    timelineVisible: {
      type: Boolean,
      default: true
    },
    grayConnectionMode: {
      type: Boolean,
      default: false
    },
    autoOptimizeEnabled: {
      type: Boolean,
      default: false
    },
    highlightedConnections: {
      type: Object,
      default: () => ({ isHighlightMode: false })
    },
    // 甘特图显示配置
    ganttDisplayConfig: {
      type: Object,
      default: () => ({
        showTaskName: true,
        showProgress: true,
        showProgressHandle: true,
        showConnections: true,
        showConnectionLabels: true,
        showPlanNodes: false,
        showMilestones: true,
        showCriticalPath: false,
        enableThreeLevelNodes: true,
        allowParentDrag: false,
        allowParentEdit: false,
        highlightTaskLineage: false
      })
    },
    // 连接线配置
    connectionEditable: {
      type: Boolean,
      default: false
    },
    connectionDefaultColor: {
      type: String,
      default: '#9ca3af'
    }
  },
  data() {
    return {
      // 本地状态，避免直接修改props
      localDateRange: null,
      localTooltipEnabled: false,
      localTooltipDelay: 1000,
      localTooltipHideDelay: 300,
      localTimelineVisible: true,
      localGrayConnectionMode: false,
      localAutoOptimizeEnabled: false,
      localConnectionEditable: true, // 默认启用连接线编辑功能
      // 甘特图显示配置本地状态
      localGanttDisplayConfig: {
        showTaskName: true,
        showProgress: true,
        showProgressHandle: true,
        showConnections: true,
        showConnectionLabels: true,
        showPlanNodes: false,
        showMilestones: true,
        showCriticalPath: false,
        enableThreeLevelNodes: true,
        allowParentDrag: false,
        allowParentEdit: false,
        highlightTaskLineage: false
      }
    }
  },
  computed: {
    dialogVisible: {
      get() {
        return this.visible
      },
      set(value) {
        this.$emit('update:visible', value)
      }
    },
    hasHighlight() {
      return this.highlightedConnections && this.highlightedConnections.isHighlightMode
    }
  },
  watch: {
    visible(newVal) {
      if (newVal) {
        // 当对话框打开时，同步props到本地状态
        this.syncPropsToLocal()
      }
    },
    // 监听本地状态变化，实时同步到父组件
    localTooltipEnabled(newVal) {
      this.$emit('tooltip-enabled-change', newVal)
    },
    localTimelineVisible(newVal) {
      this.$emit('timeline-visible-change', newVal)
    },
    localGrayConnectionMode(newVal) {
      this.$emit('gray-connection-mode-change', newVal)
    },
    localAutoOptimizeEnabled(newVal) {
      this.$emit('auto-optimize-change', newVal)
    },
    localConnectionEditable(newVal) {
      this.$emit('connection-editable-change', newVal)
    }
  },
  mounted() {
    this.syncPropsToLocal()
  },
  methods: {
    // 同步props到本地状态
    syncPropsToLocal() {
      this.localDateRange = this.dateRange ? [...this.dateRange] : null
      this.localTooltipEnabled = this.tooltipEnabled
      this.localTooltipDelay = this.tooltipDelay
      this.localTooltipHideDelay = this.tooltipHideDelay
      this.localTimelineVisible = this.timelineVisible
      this.localGrayConnectionMode = this.grayConnectionMode
      this.localAutoOptimizeEnabled = this.autoOptimizeEnabled
      this.localConnectionEditable = this.connectionEditable
      // 同步甘特图显示配置
      this.localGanttDisplayConfig = { ...this.ganttDisplayConfig }
    },

    // 日期范围变化处理
    handleDateRangeChange(value) {
      this.$emit('date-range-change', value)
    },

    // 自动范围
    autoRange() {
      this.$emit('auto-range')
    },

    // Tooltip设置更新
    updateTooltipDelay(value) {
      this.$emit('tooltip-delay-change', value)
    },

    updateTooltipHideDelay(value) {
      this.$emit('tooltip-hide-delay-change', value)
    },

    // 连接线设置
    clearHighlight() {
      this.$emit('clear-highlight')
    },

    // 甘特图显示配置更新
    updateGanttDisplayConfig() {
      this.$emit('gantt-display-config-change', this.localGanttDisplayConfig)
    },

    // 更新连接线编辑配置
    updateConnectionEditable() {
      this.$emit('connection-editable-change', this.localConnectionEditable)
    },

    // 数据操作
    jumpToToday() {
      this.$emit('jump-to-today')
    },

    showAddTaskDialog() {
      this.$emit('show-add-task-dialog')
    },

    exportData() {
      this.$emit('export-data')
    },

    // 对话框操作
    handleClose() {
      this.dialogVisible = false
    },

    handleSave() {
      // 可以在这里进行批量更新
      this.$emit('settings-save', {
        dateRange: this.localDateRange,
        tooltipEnabled: this.localTooltipEnabled,
        tooltipDelay: this.localTooltipDelay,
        tooltipHideDelay: this.localTooltipHideDelay,
        timelineVisible: this.localTimelineVisible,
        grayConnectionMode: this.localGrayConnectionMode,
        autoOptimizeEnabled: this.localAutoOptimizeEnabled,
        ganttDisplayConfig: this.localGanttDisplayConfig
      })
      this.dialogVisible = false
    }
  }
}
</script>

<style scoped>
.settings-dialog {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.settings-content {
  max-height: 500px;
  overflow-y: auto;
}

.setting-section {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e8e8e8;
}

.setting-section:last-child {
  border-bottom: none;
}

.setting-section h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-label {
  font-size: 14px;
  color: #666;
  margin-right: 12px;
  min-width: 80px;
}

.date-range-picker {
  width: 280px;
}

.dialog-footer {
  text-align: right;
}

.setting-description {
  margin-top: 8px;
  margin-left: 8px;
  font-size: 12px;
  color: #909399;
  line-height: 1.4;
  padding-left: 20px;
  position: relative;
}

.setting-description .el-icon-info {
  position: absolute;
  left: 0;
  top: 1px;
  color: #409EFF;
}
</style>
