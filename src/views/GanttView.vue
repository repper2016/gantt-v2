<template>
  <div class="gantt-view">
    <!-- 甘特图表格区域 -->
    <div class="gantt-section">
            <!--
        甘特图组件完整配置说明：
        === 基础数据 ===
        :data - 甘特图任务数据

        === Tooltip 工具提示配置 ===
        :tooltip-enabled - 是否启用hover工具提示
        :tooltip-delay - 鼠标悬停多少毫秒后显示tooltip
        :tooltip-hide-delay - 鼠标移出后多少毫秒隐藏tooltip

        === 时间轴配置 ===
        :timeline-visible - 是否显示顶部概览时间轴

        === 连接线配置 ===
        :connection-editable - 连接线是否支持拖拽编辑
        :connection-default-color - 连接线默认颜色值

        === 视图模式配置 ===
        :current-view-mode - 当前视图模式: day/month/year

        === 对话框配置 ===
        :show-settings-dialog - 是否显示设置对话框

        === 表格配置 ===
        :table-width - 左侧表格初始宽度(px)，默认400px
        :fixed-columns - 是否固定第一列和最后一列，支持列宽拖拽调整和单元格内联编辑

        === 甘特图显示配置 ===
        :show-task-name - 是否显示任务名称
        :show-progress - 是否显示进度条
        :show-progress-handle - 是否显示进度拖拽控制柄
        :show-connections - 是否显示连接线
        :show-connection-labels - 是否显示连接线标签
        :show-plan-nodes - 是否显示计划节点
        :show-milestones - 是否显示里程碑
        :show-critical-path - 是否显示关键路径
        :enable-three-level-nodes - 是否启用三级节点
        :allow-parent-drag - 父节点是否可拖拽
        :allow-parent-edit - 父节点是否可编辑
        :allow-parent-connection - 父节点是否可以连线
        :highlight-task-lineage - 点击节点是否高亮显示血缘关系
        :link-parent-child-dates - 父子节点时间是否关联，true时拖拽父节点会同步移动子节点
      -->
      <GanttChart
        ref="ganttChart"
        :data="ganttData"
        :dependencies="dependencies"
        :height="ganttHeight"
        :table-width="tableWidth"
        :columns="columns"
        :link-parent-child-dates="linkParentChildDates"
        :tooltip-enabled.sync="tooltipEnabled"
        :tooltip-delay="tooltipDelay"
        :tooltip-hide-delay="tooltipHideDelay"
        :timeline-visible="timelineVisible"
        :connection-editable="connectionEditable"
        :connection-default-color="connectionDefaultColor"
        :current-view-mode="currentViewMode"
        :show-settings-dialog="showSettingsDialog"
        :show-task-name="showTaskName"
        :show-progress="showProgress"
        :show-progress-handle="showProgressHandle"
        :show-connections="showConnections"
        :show-connection-labels="showConnectionLabels"
        :show-plan-nodes="showPlanNodes"
        :show-milestones="showMilestones"
        :show-critical-path="showCriticalPath"
        :enable-three-level-nodes="enableThreeLevelNodes"
        :allow-parent-drag="allowParentDrag"
        :allow-parent-edit="allowParentEdit"
        :allow-parent-connection="allowParentConnection"
        :fixed-columns="false"
        :highlight-task-lineage="highlightTaskLineage"
        :enable-context-menu="enableContextMenu"
        :allow-drag-outside="allowDragOutside"
        :drag-outside-config="dragOutsideConfig"
        :milestone-linkable="milestoneLinkable"
        :connection-style="'smart'"
        :show-task-names="true"
        @update:showSettingsDialog="$emit('update:showSettingsDialog', $event)"
        @update:tooltipEnabled="handleTooltipEnabledChange"
        @update:tooltipDelay="handleTooltipDelayChange"
        @update:tooltipHideDelay="handleTooltipHideDelayChange"
        @update:timelineVisible="handleTimelineVisibleChange"
        @update:currentViewMode="handleViewModeChange"
        @settings-dialog-close="handleSettingsClose"
        @view-mode-change="handleViewModeChange"
        @dependency-updated="refreshChart"
      />
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import GanttChart from '../components/GanttChart.vue'

export default {
  name: 'GanttView',
  components: {
    GanttChart
  },
  props: {
    timelineVisible: {
      type: Boolean,
      default: true
    },
    showSettingsDialog: {
      type: Boolean,
      default: false
    },
    currentViewMode: {
      type: String,
      default: 'month'
    }
  },
  data() {
    return {
      milestoneLinkable: false, // 默认不允许milestone连线
      columns: [
        { id: 'checkbox', prop: 'checkbox', label: 'Select', visible: true, width: 50, minWidth: 50, maxWidth: 50, order: 0, align: 'center', fixed: true },
        { id: 'taskName', prop: 'name', label: 'Deliverable/Task/Milestone ', visible: true, width: 450, minWidth: 250, maxWidth: 600, order: 1, align: 'left', flex: 2, filterable: true },
        { id: 'assignee', prop: 'assignee', label: 'Assignee ', visible: true, width: 250, minWidth: 150, maxWidth: 400, order: 2, align: 'left', flex: 2, filterable: true },
        { id: 'progress', prop: 'progress', label: 'Progress', visible: false, width: 120, minWidth: 80, maxWidth: 120, order: 3, align: 'center', flex: 1, filterable: true },
        { id: 'startDate', prop: 'startDate', label: 'Start Date', visible: true, width: 180, minWidth: 150, maxWidth: 340, order: 4, align: 'center', flex: 1, filterable: true },
        { id: 'endDate', prop: 'endDate', label: 'End Date', visible: true, width: 180, minWidth: 150, maxWidth: 340, order: 5, align: 'center', flex: 1, filterable: true },
        { id: 'duration', prop: 'duration', label: 'Duration', visible: true, width: 100, minWidth: 80, maxWidth: 120, order: 6, align: 'center', flex: 1, filterable: true },
        { id: 'planStartDate', prop: 'planStartDate', label: 'Plan Start', visible: false, width: 180, minWidth: 150, maxWidth: 140, order: 7, align: 'center', flex: 1, filterable: true },
        { id: 'planEndDate', prop: 'planEndDate', label: 'Plan End', visible: false, width: 180, minWidth: 150, maxWidth: 340, order: 8, align: 'center', flex: 1, filterable: true },
        { id: 'status', prop: 'status', label: 'Status', visible: true, width: 150, minWidth: 150, maxWidth: 320, order: 9, align: 'center', flex: 1, filterable: true }
      ],
      // === Tooltip 工具提示配置 ===
      tooltipEnabled: true,              // 是否启用工具提示，默认启用
      tooltipDelay: 5000,               // 工具提示显示延迟(毫秒)，默认1秒
      tooltipHideDelay: 300,            // 工具提示隐藏延迟(毫秒)，默认300毫秒

      // === 连接线配置 ===
      connectionEditable: true,         // 连接线是否可编辑，默认启用编辑功能
      connectionDefaultColor: '#9ca3af', // 连接线默认颜色，默认为灰色

      // === 甘特图显示配置 ===
      showTaskName: false,               // 是否显示任务名称，默认显示
      showProgress: true,               // 是否显示进度条，默认显示
      showProgressHandle: true,         // 是否显示进度拖拽控制柄，默认显示
      showConnections: true,            // 是否显示连接线，默认显示
      showConnectionLabels: true,       // 是否显示连接线标签，默认显示
      showPlanNodes: false,             // 是否显示计划节点，默认隐藏
      showMilestones: true,             // 是否显示里程碑，默认显示
      showCriticalPath: false,          // 是否显示关键路径，默认隐藏
      enableThreeLevelNodes: true,      // 是否启用三级节点，默认启用
      allowParentDrag: true,           // 父节点是否可拖拽，默认禁用
      allowParentEdit: true,           // 父节点是否可编辑，默认禁用
      allowParentConnection: true,     // 父节点可以连线，已添加父子层级约束
      highlightTaskLineage: false,      // 点击节点是否高亮显示血缘关系，默认禁用

      // === 右键菜单配置 ===
      enableContextMenu: false,          // 是否启用右键菜单，默认启用

      // === 甘特图组件高度配置 ===
      ganttHeight: 'calc(100vh - 20px)', // 甘特图组件高度，默认全屏减去20px边距

      // === 拖拽扩展功能配置 ===
      allowDragOutside: true,            // 是否允许拖拽节点到可视区域外部，默认启用
      dragOutsideConfig: {               // 拖拽扩展配置
        enabled: false,                   // 是否启用自动扩展
        expandDays: 30,                  // 每次扩展的天数
        maxExpansions: 10,               // 最大扩展次数，防止无限扩展
        animationDuration: 300           // 扩展动画持续时间(ms)
      },

      // === 父子节点时间关联配置 ===
      linkParentChildDates: false,        // 父子节点时间是否关联，默认不关联（独立编辑）

      // === 表格宽度配置 ===
      tableWidth: 800,                   // 表格初始宽度(px)，支持列宽拖拽调整和单元格内联编辑
    }
  },
  computed: {
    ...mapState(['ganttData', 'dependencies'])
  },
  async created() {
    // 先生成并注入测试数据，确保依赖线渲染
    // await this.$store.dispatch('generateDemoDataset')
    // 再初始化依赖约束引擎，确保拿到最新数据
    this.$store.dispatch('initDependencyEngine')
  },
  methods: {
    // 处理设置对话框关闭
    handleSettingsClose() {
      this.$emit('settings-dialog-close')
    },
    // 处理视图模式变化
    handleViewModeChange(mode) {
      console.log('[调试] GanttView 接收到视图模式变化:', mode)
      this.$emit('view-mode-change', mode)
    },
    // 处理工具提示启用状态变化
    handleTooltipEnabledChange(enabled) {
      this.tooltipEnabled = enabled
      this.$emit('tooltip-enabled-change', enabled)
    },
    // 处理工具提示延迟变化
    handleTooltipDelayChange(delay) {
      this.tooltipDelay = delay
      this.$emit('tooltip-delay-change', delay)
    },
    // 处理工具提示隐藏延迟变化
    handleTooltipHideDelayChange(hideDelay) {
      this.tooltipHideDelay = hideDelay
      this.$emit('tooltip-hide-delay-change', hideDelay)
    },
    // 处理时间轴可见性变化
    handleTimelineVisibleChange(visible) {
      this.$emit('timeline-visible-change', visible)
    },

    // === 甘特图显示配置变化处理方法 ===
    // 处理任务名称显示变化
    handleShowTaskNameChange(show) {
      this.showTaskName = show
      this.$emit('show-task-name-change', show)
    },
    // 处理进度条显示变化
    handleShowProgressChange(show) {
      this.showProgress = show
      this.$emit('show-progress-change', show)
    },
    // 处理进度控制柄显示变化
    handleShowProgressHandleChange(show) {
      this.showProgressHandle = show
      this.$emit('show-progress-handle-change', show)
    },
    // 处理连接线显示变化
    handleShowConnectionsChange(show) {
      this.showConnections = show
      this.$emit('show-connections-change', show)
    },
    // 处理连接线标签显示变化
    handleShowConnectionLabelsChange(show) {
      this.showConnectionLabels = show
      this.$emit('show-connection-labels-change', show)
    },
    // 处理计划节点显示变化
    handleShowPlanNodesChange(show) {
      this.showPlanNodes = show
      this.$emit('show-plan-nodes-change', show)
    },
    // 处理里程碑显示变化
    handleShowMilestonesChange(show) {
      this.showMilestones = show
      this.$emit('show-milestones-change', show)
    },
    // 处理关键路径显示变化
    handleShowCriticalPathChange(show) {
      this.showCriticalPath = show
      this.$emit('show-critical-path-change', show)
    },
    // 处理三级节点启用变化
    handleEnableThreeLevelNodesChange(enable) {
      this.enableThreeLevelNodes = enable
      this.$emit('enable-three-level-nodes-change', enable)
    },
    // 处理父节点拖拽变化
    handleAllowParentDragChange(allow) {
      this.allowParentDrag = allow
      this.$emit('allow-parent-drag-change', allow)
    },
    // 处理父节点编辑变化
    handleAllowParentEditChange(allow) {
      this.allowParentEdit = allow
      this.$emit('allow-parent-edit-change', allow)
    },
    // 处理血缘关系高亮变化
    handleHighlightTaskLineageChange(highlight) {
      this.highlightTaskLineage = highlight
      this.$emit('highlight-task-lineage-change', highlight)
    },

    // === 父子节点时间关联配置变化处理方法 ===
    // 处理父子节点时间关联配置变化
    handleLinkParentChildDatesChange(link) {
      this.linkParentChildDates = link
      this.$emit('link-parent-child-dates-change', link)
      console.log(`[父子时间关联] 配置已更新为: ${link ? '启用关联' : '独立编辑'}`)
    },
    // 处理依赖关系更新后刷新甘特图
    async refreshChart(event) {
      console.log('[GanttView] 开始刷新甘特图', event);
      try {
        // 1. 重新初始化依赖约束引擎
        await this.$store.dispatch('initDependencyEngine');
        console.log('[GanttView] 依赖约束引擎已重新初始化');

        // 2. 等待依赖约束引擎初始化完成
        await this.$nextTick();

        // 3. 调用 GanttChart 组件的 refreshChart 方法
        if (this.$refs.ganttChart) {
          await this.$refs.ganttChart.refreshChart(event);
          console.log('[GanttView] GanttChart 组件刷新完成');
        }

        // 4. 等待 DOM 更新
        await this.$nextTick();
        console.log('[GanttView] DOM 更新完成');

        // 5. 强制更新当前组件
        this.$forceUpdate();
        console.log('[GanttView] 当前组件已强制更新');

        // 6. 等待组件更新完成
        await this.$nextTick();

        // 7. 再次调用 GanttChart 组件的 refreshChart 方法
        if (this.$refs.ganttChart) {
          await this.$refs.ganttChart.refreshChart(event);
          console.log('[GanttView] GanttChart 组件二次刷新完成');
        }

        // 8. 等待 DOM 更新
        await this.$nextTick();
        console.log('[GanttView] 刷新完成');
      } catch (error) {
        console.error('[GanttView] 刷新失败:', error);
      }
    }
  }
}
</script>

<style scoped>
.gantt-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 20px);
  overflow-x: visible;
  overflow-y: hidden;
}

.gantt-section {
  flex: 1;
  min-height: 0;
  height: 100%;
}
</style>
