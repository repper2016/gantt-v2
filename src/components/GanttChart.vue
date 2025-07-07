<template>
  <div class="gantt-chart gantt-performance-mode gpu-accelerated">
    <!-- 甘特图工具栏 -->
    <GanttToolbar
      :current-view-mode="currentViewMode"
      :show-critical-path="ganttDisplayConfig.showCriticalPath"
      :selected-task-count="selectedTasks.length"
      :date-range="chartStartDate && chartEndDate ? [chartStartDate, chartEndDate] : []"
      @show-add-dialog="handleShowAddDialog"
      @batch-delete="handleBatchDelete"
      @expand-all="handleExpandAll"
      @collapse-all="handleCollapseAll"
      @toggle-critical-path="handleToggleCriticalPath"
      @show-column-config="showColumnConfigDialog"
      @date-range-change="handleDateRangeChange"
      @view-mode-change="handleViewModeChange"
      @jump-to-today="handleJumpToToday"
      @quarter-change="handleQuarterChange"
      @import-data="handleImportData"
      @clear-all-data="handleClearAllData"
      @save-data="handleSaveData"
    />

    <!-- 概览时间轴 -->
    <GanttOverviewTimeline
      v-if="timelineVisible"
      ref="ganttOverviewTimeline"
      :tasks="flattenTasks"
      :start-date="chartStartDate"
      :end-date="chartEndDate"
      :visible="timelineVisible"
      @milestone-selected="handleMilestoneSelected"
      @timeline-hidden="handleTimelineHidden"
    />

    <!-- 控制面板已移除，设置按钮已移至Performance Monitor -->

    <!-- 甘特图主体 -->
    <div class="gantt-main render-optimized" ref="ganttMain" :style="{height: height}">
      <!-- 左侧任务列表 -->
      <div
        class="gantt-left gantt-grid-optimized"
        :style="{ width: leftPanelVisible ? leftWidth + 'px' : '0px', height: '100%' }"
        v-show="leftPanelVisible"
      >
        <!-- 使用虚拟滚动表格或普通表格 -->
        <BetterVirtualScrollTable
          v-if="shouldUseVirtualScrolling"
          :data="flatTableDataForVirtual"
          :columns="tableColumns"
          :item-height="virtualScrollConfig.itemHeight"
          :container-height="tableHeight"
          :highlighted-row-id="highlightedRowId"
          :buffer-size="virtualScrollConfig.bufferSize"
          @row-click="handleRowClick"
          @sort="handleVirtualTableSort"
          @scroll="handleVirtualTableScroll"
          ref="virtualTable"
        >
          <!-- 自定义插槽 -->
          <template #name="{ item, value }">
            <div class="task-name-cell">
              <span
                v-if="item.children && item.children.length > 0"
                class="collapse-btn"
                @click.stop="handleToggleCollapse(item.id)"
              >
                {{ item.collapsed ? '▶' : '▼' }}
              </span>
              <span class="task-name" :title="value">{{ value }}</span>
            </div>
          </template>

          <template #progress="{ value }">
            <div class="progress-cell">
              <div class="progress-bar">
                <div
                  class="progress-fill"
                  :style="{ width: value + '%' }"
                ></div>
              </div>
              <span class="progress-text">{{ value }}%</span>
            </div>
          </template>

          <template #status="{ item }">
            <span
              class="status-badge"
              :class="getStatusClass(item)"
            >
              {{ getTaskStatus(item) }}
            </span>
          </template>
        </BetterVirtualScrollTable>

        <!-- 普通表格 -->
        <CustomGanttTable
          v-else
          :tasks="flatTableData"
          :highlighted-row-id="highlightedRowId"
          :table-height="tableHeight"
          :table-width="leftWidth"
          :fixed-columns="fixedColumns"
          :allow-column-resize="true"
          :allow-cell-edit="true"
          :show-action-column="false"
          :actual-gantt-height="actualGanttHeight"
          @row-click="handleRowClick"
          @toggle-collapse="handleToggleCollapse"
          @scroll="handleTableScroll"
          @show-column-config="showColumnConfigDialog"
                  @edit-task="editTask"
        @delete-task="handleDeleteTask"
        @add-sibling-task="handleShowAddSiblingDialog"
        @add-child-task="handleShowAddChildDialog"
          @table-mounted="handleTableMounted"
          @column-reorder="handleColumnReorder"
          @column-resize="handleColumnResize"
          @cell-value-change="handleCellValueChange"
          @filter-change="handleTableFilterChange"
          ref="customTable"
        />

        <!-- Performance Monitor 在左侧面板底部 -->
        <PerformanceMonitor
          :enabled="performanceMonitorEnabled"
          :task-count="flattenTasks.length"
          :visible-task-count="visibleTaskCount"
          :render-time="currentRenderTime"
          @auto-optimize-toggle="handleAutoOptimizeToggle"
          @open-settings="openSettingsDialog"
          class="left-panel-performance-monitor"
        />
      </div>

      <!-- 拖拽分隔线 -->
      <div
        class="gantt-splitter"
        @mousedown="startResize"
        ref="splitter"
        v-show="leftPanelVisible"
      >
        <!-- 隐藏左侧面板按钮 -->
        <button
          class="toggle-panel-btn hide-btn"
          @click="toggleLeftPanel"
          title="Hide Left Panel"
        >
          <i class="el-icon-arrow-left"></i>
        </button>
      </div>

      <!-- 显示左侧面板按钮（当左侧隐藏时显示） -->
      <div
        class="show-panel-btn"
        v-show="!leftPanelVisible"
        @click="toggleLeftPanel"
        title="Show Left Panel"
      >
        <i class="el-icon-arrow-right"></i>
      </div>

      <!-- 右侧图表区域 -->
      <div class="gantt-right" ref="ganttRight" :style="{height: '100%'}">
        <!-- 工具栏 -->
        <!-- <div class="gantt-toolbar">
          <el-button
            size="small"
            :type="ganttDisplayConfig.showCriticalPath ? 'primary' : 'default'"
            @click="toggleCriticalPath"
            icon="el-icon-connection"
            class="critical-path-btn"
          >
            {{ ganttDisplayConfig.showCriticalPath ? '隐藏关键路径' : '显示关键路径' }}
          </el-button>
        </div> -->

        <!-- 整个右侧滚动容器 -->
                  <div
            class="gantt-scroll-container"
            :class="{ 'dragging': isDragging }"
            ref="scrollContainer"
            @scroll="handleRightScroll"
            @mousedown="handleDragStart"
            @mousemove="handleDragMove"
            @mouseup="handleDragEnd"
            @mouseleave="handleDragEnd"
            :style="{height: '100%', overflowX: 'visible', overflowY: 'auto', width: '100%'}"
          >
          <!-- 时间轴头部 - 跟着内容一起滚动 -->
          <div class="gantt-timeline-wrapper">
            <GanttTimeline
              :key="timelineRefreshKey"
              :view-mode="effectiveViewMode"
              :start-date="chartStartDate"
              :end-date="chartEndDate"
              :zoom-level="zoomLevel"
              :pan-offset="panOffset"
              :container-width="rightAreaWidth"
              ref="timeline"
            />
          </div>

          <!-- 甘特图内容区域 -->
          <div
            class="gantt-chart-area"
            ref="chartArea"
            @mousedown="noop"
            @wheel.prevent="noop"
            @click="handleChartAreaClick"
            tabindex="0"
            :style="{
              cursor: isPanning ? 'grabbing' : 'grab',
              minHeight: actualGanttHeight + 'px',
              height: 'auto'
            }"
          >
            <div
              class="gantt-content"
              :style="{
                transform: `translateX(${panOffset}px)`,
                transformOrigin: '0 0',
                minHeight: actualGanttHeight + 'px',
                height: actualGanttHeight + 'px',
                width: rightAreaWidth + 'px'
              }"
            >
              <GanttChartGrid
                :key="'grid-' + timelineRefreshKey"
                :view-mode="effectiveViewMode"
                :start-date="chartStartDate"
                :end-date="chartEndDate"
                :tasks="flattenTasks"
                :zoom-level="zoomLevel"
                :container-width="rightAreaWidth"
              />
              <GanttBars
                ref="ganttBars"
                :tasks="flattenTasks"
                :dependencies="dependencies"
                :view-mode="effectiveViewMode"
                :start-date="chartStartDate.format('YYYY-MM-DD')"
                :end-date="chartEndDate.format('YYYY-MM-DD')"
                :zoom-level="zoomLevel"
                :highlighted-row-id="highlightedRowId"
                :close-modal-trigger="closeModalTrigger"
                :container-width="rightAreaWidth"
                :chart-width="rightAreaWidth"
                :chart-height="actualGanttHeight"
                :left-panel-width="leftPanelVisible ? leftWidth : 0"
                :tooltip-enabled="tooltipEnabled"
                :tooltip-delay="tooltipDelay"
                :tooltip-hide-delay="tooltipHideDelay"
                :show-task-name="ganttDisplayConfig.showTaskName"
                :show-task-names="showTaskNames"
                :show-progress="ganttDisplayConfig.showProgress"
                :show-progress-handle="ganttDisplayConfig.showProgressHandle"
                :show-connections="ganttDisplayConfig.showConnections"
                :show-connection-labels="ganttDisplayConfig.showConnectionLabels"
                :show-dependency-lines="ganttDisplayConfig.showConnections"
                :show-plan-nodes="ganttDisplayConfig.showPlanNodes"
                :show-milestones="ganttDisplayConfig.showMilestones"
                :show-critical-path="ganttDisplayConfig.showCriticalPath"
                :allow-parent-drag="ganttDisplayConfig.allowParentDrag"
                :allow-parent-edit="ganttDisplayConfig.allowParentEdit"
                :highlight-task-lineage="ganttDisplayConfig.highlightTaskLineage"
                :link-parent-child-dates="linkParentChildDates"
                :connection-editable="connectionEditable"
                :connection-default-color="connectionDefaultColor"
                :enable-context-menu="enableContextMenu"
                :allow-drag-outside="allowDragOutside"
                :drag-outside-config="dragOutsideConfig"
                :allow-parent-connection="allowParentConnection"
                :allow-milestone-connection="allowMilestoneConnection"
                @bar-drag="handleBarDrag"
                @bar-resize="handleBarResize"
                @task-update="handleTaskUpdate"
                @task-delete="handleTaskDelete"
                @task-highlight="handleTaskHighlight"
                @request-pan="handleRequestPan"
                @update-chart-width="handleUpdateChartWidth"
                @node-drag-start="handleNodeDragStart"
                @node-drag-end="handleNodeDragEnd"
                @node-drag-outside="handleNodeDragOutside"
                @edit-task="handleEditTaskFromBars"
                @drag-cascade-update-check="handleDragCascadeUpdateCheck"
                @dependency-updated="refreshChart"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 列配置对话框 -->
    <el-dialog
      title="Column Configuration"
      :visible.sync="showColumnDialog"
      width="500px"
      :close-on-click-modal="false"
      :close-on-press-escape="true"
      :append-to-body="true"
      :modal-append-to-body="true"
    >
      <div class="column-config">
        <el-table
          :data="availableColumns"
          size="small"
          max-height="400"
          ref="columnConfigTable"
          row-key="id"
        >
          <el-table-column label="Visible" width="80">
            <template slot-scope="scope">
              <el-checkbox
                v-model="scope.row.visible"
                @change="updateColumnVisibility(scope.row)"
              />
            </template>
          </el-table-column>
          <el-table-column label="Order" width="60">
            <template slot-scope="">
              <span class="drag-handle-column">
                <i class="el-icon-rank"></i>
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="label" label="Column Name" />
          <el-table-column label="Width" width="120">
            <template slot-scope="scope">
              <el-input-number
                v-model="scope.row.width"
                style="width:100%"
                :min="80"
                :max="300"
                size="mini"
                @change="updateColumnWidth(scope.row)"
              />
            </template>
          </el-table-column>
        </el-table>
      </div>
      <span slot="footer" class="dialog-footer">
        <el-button @click="showColumnDialog = false">Cancel</el-button>
        <el-button type="primary" @click="saveColumnConfig">Save</el-button>
      </span>
    </el-dialog>

        <!-- 设置对话框 -->
    <SettingsDialog
      :visible="showSettingsDialog"
      @update:visible="handleSettingsVisibleChange"
      :date-range="dateRange"
      :tooltip-enabled="tooltipEnabled"
      :tooltip-delay="tooltipDelay"
      :tooltip-hide-delay="tooltipHideDelay"
      :timeline-visible="timelineVisible"
      :gray-connection-mode="grayConnectionMode"
      :auto-optimize-enabled="autoOptimizeConfig.enabled"
      :highlighted-connections="highlightedConnections"
      :gantt-display-config="ganttDisplayConfig"
      :connection-editable="connectionEditable"
      :connection-default-color="connectionDefaultColor"
      @date-range-change="handleDateRangeChange"
      @auto-range="autoRangeDebounced"
      @tooltip-enabled-change="toggleTooltip"
      @tooltip-delay-change="updateTooltipDelay"
      @tooltip-hide-delay-change="updateTooltipHideDelay"
      @timeline-visible-change="updateTimelineVisible"
      @gray-connection-mode-change="toggleGrayConnectionMode"
      @clear-highlight="clearLineageHighlight"
      @auto-optimize-change="handleAutoOptimizeToggle"
      @gantt-display-config-change="handleGanttDisplayConfigChange"
      @connection-editable-change="handleConnectionEditableChange"
      @jump-to-today="jumpToTodayEnhanced"
      @show-add-task-dialog="showAddTaskDialog"
      @export-data="exportData"
      @generate-test-data="generateTestData"
      @settings-save="handleSettingsSave"
    />

    <!-- 统一的编辑对话框 -->
    <EditDialog
      :visible="editDialogVisible"
      :type="editDialogType"
      :mode="editDialogMode"
      :task="editingTask"
      :parent-task="parentTask"
      :form="editDialogForm"
      :gantt-data="ganttData"
      :flatten-tasks="flattenTasks"
      @task-updated="handleTaskUpdated"
      @task-added="handleTaskAdded"
      @close="handleEditDialogClose"
    />
  </div>
</template>

<script>
import { mapState, mapGetters, mapActions } from 'vuex'
import moment from 'moment'
import GanttTimeline from './GanttTimeline.vue'
import GanttChartGrid from './GanttChartGrid.vue'
import GanttBars from './GanttBars.vue'
import Sortable from 'sortablejs'
import CustomGanttTable from './CustomGanttTable.vue'
import BetterVirtualScrollTable from './BetterVirtualScrollTable.vue'
import PerformanceMonitor from './PerformanceMonitor.vue'
import GanttOverviewTimeline from './GanttOverviewTimeline.vue'
import SettingsDialog from './SettingsDialog.vue'
import GanttToolbar from './GanttToolbar.vue'
import debounce from 'lodash/debounce'
import { DependencyConstraintEngine } from '@/services/dependencyConstraints'
import EditDialog from './editDialog/index.vue'

export default {
  name: 'GanttChart',
  components: {
    GanttTimeline,
    GanttChartGrid,
    GanttBars,
    CustomGanttTable,
    BetterVirtualScrollTable,
    PerformanceMonitor,
    GanttOverviewTimeline,
    SettingsDialog,
    GanttToolbar,
    EditDialog
  },
  props: {
    data: {
      type: Array,
      default: () => []
    },
    // Tooltip配置
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
    // Timeline 可见性控制
    timelineVisible: {
      type: Boolean,
      default: true
    },
    // 设置对话框控制（从App.vue传递）
    showSettingsDialog: {
      type: Boolean,
      default: false
    },
    // 当前视图模式（从App.vue传递）
    currentViewMode: {
      type: String,
      default: 'month'
    },
    // 连接线是否可编辑
    connectionEditable: {
      type: Boolean,
      default: true  // 默认启用连接线编辑
    },
    // 连接线默认颜色（当不可编辑时）
    connectionDefaultColor: {
      type: String,
      default: '#9ca3af'
    },
    // 里程碑节点是否允许连线
    allowMilestoneConnection: {
      type: Boolean,
      default: false // 默认不允许里程碑节点连线
    },

    // === 甘特图显示配置相关props ===
    // 是否显示任务名称
    showTaskName: {
      type: Boolean,
      default: true
    },
    // 是否在节点后面显示任务名称（JIRA风格）
    showTaskNames: {
      type: Boolean,
      default: true
    },
    // 是否显示进度条
    showProgress: {
      type: Boolean,
      default: true
    },
    // 是否显示进度拖拽控制柄
    showProgressHandle: {
      type: Boolean,
      default: true
    },
    // 是否显示连接线
    showConnections: {
      type: Boolean,
      default: false
    },
    // 是否显示连接线标签
    showConnectionLabels: {
      type: Boolean,
      default: true
    },
    // 是否显示计划节点
    showPlanNodes: {
      type: Boolean,
      default: false
    },
    // 是否显示里程碑
    showMilestones: {
      type: Boolean,
      default: true
    },
    // 是否显示关键路径
    showCriticalPath: {
      type: Boolean,
      default: false
    },
    // 是否启用三级节点
    enableThreeLevelNodes: {
      type: Boolean,
      default: true
    },
    // 父节点是否可拖拽
    allowParentDrag: {
      type: Boolean,
      default: false
    },
    // 父节点是否可编辑
    allowParentEdit: {
      type: Boolean,
      default: false
    },
    // 父节点是否可以连线
    allowParentConnection: {
      type: Boolean,
      default: false // 默认不允许父节点连线，保持兼容性
    },
    // 点击节点是否高亮显示血缘关系
    highlightTaskLineage: {
      type: Boolean,
      default: false
    },

    // 是否固定第一列和最后一列（默认不固定）
    fixedColumns: {
      type: Boolean,
      default: false
    },

    // 甘特图组件高度配置
    height: {
      type: String,
      default: '100%'
    },

    // 父子节点时间是否关联配置
    linkParentChildDates: {
      type: Boolean,
      default: false // 默认不关联，父子节点可以独立编辑时间
    },

    // 左侧表格初始宽度配置
    tableWidth: {
      type: Number,
      default: 400 // 默认400px宽度
    },

    // 表格列配置
    columns: {
      type: Array,
      default: () => null // 默认为null，使用store中的默认配置
    },

    // 是否启用右键菜单
    enableContextMenu: {
      type: Boolean,
      default: true
    },

    // 是否允许拖拽节点到可视区域外部并动态扩展时间轴
    allowDragOutside: {
      type: Boolean,
      default: false // 默认不允许，避免意外扩展
    },

    // 拖拽到外部时的自动扩展设置
    dragOutsideConfig: {
      type: Object,
      default: () => ({
        enabled: true,           // 是否启用自动扩展
        expandDays: 30,          // 每次扩展的天数
        maxExpansions: 10,       // 最大扩展次数，防止无限扩展
        animationDuration: 300   // 扩展动画持续时间(ms)
      })
    },
    dependencies: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {

      // 日期范围
      dateRange: [],

      // 缩放和平移
      zoomLevel: 1,
      panOffset: 0,
      isPanning: false,

      // 左侧面板初始宽度（将在mounted中使用prop值）
      leftWidth: 800,

      // 高亮行
      highlightedRowId: null,

      // 模态框控制
      closeModalTrigger: 0,

      // 调整大小相关
      isResizing: false,
      startX: 0,
      startWidth: 0,

      // 节点拖拽状态
      isNodeDragging: false,

      // 列配置对话框
      showColumnDialog: false,

      // 拖拽排序实例
      sortableInstance: null,

      // 表格实例引用
      tableInstance: null,

      // 滚动同步锁
      scrollSyncLock: false,

      // 列配置拖拽排序实例
      columnSortableInstance: null,

      // 右侧区域实际宽度
      rightAreaWidth: 1200,

      // 性能优化相关
      useVirtualScrolling: false,
      performanceMonitorEnabled: true, // 始终显示性能监视器和设置按钮
      renderStartTime: 0,
      currentRenderTime: 0,

      // 虚拟滚动配置
      virtualScrollConfig: {
        itemHeight: 28, // 压缩虚拟滚动行高
        containerHeight: 600,
        bufferSize: 5
      },

      // 自动优化设置
      autoOptimizeConfig: {
        enabled: false,
        maxTasksBeforeVirtual: 500,
        maxRenderTime: 16, // 毫秒
        performanceCheckInterval: 5000 // 毫秒
      },

      // 性能指标
      performanceMetrics: {
        frameCount: 0,
        lastFrameTime: 0,
        averageRenderTime: 0,
        renderTimes: []
      },

      // 表格列配置（用于虚拟滚动）
      tableColumns: [
        { key: 'name', title: 'Task Name', width: 400, minWidth: 150, sortable: false, slot: 'name' },
        { key: 'progress', title: 'Progress', width: 100, minWidth: 80, sortable: true, slot: 'progress' },
        { key: 'startDate', title: 'Start Date', width: 120, minWidth: 100, sortable: true, format: 'date' },
        { key: 'endDate', title: 'End Date', width: 120, minWidth: 100, sortable: true, format: 'date' },
        { key: 'assignee', title: 'Assignee', width: 120, minWidth: 100, sortable: true },
        { key: 'status', title: 'Status', width: 100, minWidth: 80, sortable: true, slot: 'status' }
      ],

      // 拖拽滚动相关
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0,
      scrollStartX: 0,
      scrollStartY: 0,
      dragTarget: null,
      leftPanelHeight: 600, // 新增，左侧面板实际高度

      // 注意：ganttDisplayConfig 已移除，现在使用 computed 属性从 props 计算





      // 父节点拖拽防抖定时器
      parentDragDebounceTimer: null,

      // 时间轴强制刷新key
      timelineRefreshKey: 0,

      // 表格筛选状态
      tableFilters: {},

      taskForm: {
        id: '',
        name: '',
        startDate: '',
        endDate: '',
        progress: 0,
        assignee: '',
        status: '',
        attachments: [],
        links: [],
        parentId: null
      },

      // 编辑对话框数据
      editDialogVisible: false,
      editDialogType: 'task',
      editDialogMode: 'add',
      editingTask: null,
      parentTask: null,
      editDialogForm: {}
    }
  },
  computed: {
    ...mapState({
      ganttData: 'ganttData',
      storeViewMode: 'viewMode',  // 重命名避免冲突
      highlightedConnections: 'highlightedConnections',
      todayMarker: 'todayMarker',
      grayConnectionMode: 'grayConnectionMode',
      selectedTasks: 'selectedTasks'
    }),
    ...mapGetters(['visibleTasks', 'isTaskCollapsed', 'visibleColumns', 'isLeftPanelVisible', 'getTodayDate', 'isTodayMarkerEnabled']),

    // 本地控制的左侧面板可见性
    leftPanelVisible: {
      get() {
        return this.isLeftPanelVisible
      },
      set(value) {
        this.$store.dispatch('toggleLeftPanel', value)
      }
    },

    // 甘特图显示配置 - 从 props 计算得出
    ganttDisplayConfig() {
      return {
        showTaskName: this.showTaskName,
        showTaskNames: true, // 默认显示任务名称标签
        showProgress: this.showProgress,
        showProgressHandle: this.showProgressHandle,
        showConnections: this.showConnections,
        showConnectionLabels: this.showConnectionLabels,
        showPlanNodes: this.showPlanNodes,
        showMilestones: this.showMilestones,
        showCriticalPath: this.showCriticalPath,
        enableThreeLevelNodes: this.enableThreeLevelNodes,
        allowParentDrag: this.allowParentDrag,
        allowParentEdit: this.allowParentEdit,
        highlightTaskLineage: this.highlightTaskLineage
      }
    },

    // 扁平化的任务数据，用于表格显示
    flatTableData() {
      return this.visibleTasks
    },

    // 扁平化的任务数据，用于甘特图显示
    flattenTasks() {
      // 使用筛选后的任务数据 - 实现筛选联动
      return this.$store.getters.filteredTasks
    },

    // 动态列配置
    dynamicColumns() {
      return this.visibleColumns.filter(col =>
        col.id !== 'checkbox' && col.id !== 'taskName'
      )
    },

    // 可用列配置
    availableColumns() {
      // 从store获取完整的列配置，过滤掉固定列
      return this.$store.getters.getColumnConfig.filter(col =>
        col.id !== 'checkbox' && col.id !== 'taskName'
      )
    },

    // 基础日期范围计算（不依赖视图模式）
    baseDateRange() {
      if (this.dateRange && this.dateRange.length === 2 && this.dateRange[0] && this.dateRange[1]) {
        // 如果用户已经设置了日期范围，则使用用户设置的
        return this.dateRange
      }

      // 否则根据任务数据生成基础范围
      if (this.flattenTasks.length === 0) {
        // 如果没有任务，返回默认范围
        const today = moment()
        return [
          today.clone().subtract(30, 'days').format('YYYY-MM-DD'),
          today.clone().add(60, 'days').format('YYYY-MM-DD')
        ]
      }

      // 计算所有任务的时间范围
      let minDate = null
      let maxDate = null

      this.flattenTasks.forEach(task => {
        if (task.startDate) {
          const start = moment(task.startDate)
          if (!minDate || start.isBefore(minDate)) {
            minDate = start
          }
        }
        if (task.endDate) {
          const end = moment(task.endDate)
          if (!maxDate || end.isAfter(maxDate)) {
            maxDate = end
          }
        }
      })

      if (!minDate || !maxDate) {
        // 如果没有找到有效日期，返回默认范围
        const today = moment()
        return [
          today.clone().subtract(30, 'days').format('YYYY-MM-DD'),
          today.clone().add(60, 'days').format('YYYY-MM-DD')
        ]
      }

      // 基础范围：任务范围前后各加15天
      const adjustedStart = minDate.clone().subtract(15, 'days')
      const adjustedEnd = maxDate.clone().add(15, 'days')

      return [
        adjustedStart.format('YYYY-MM-DD'),
        adjustedEnd.format('YYYY-MM-DD')
      ]
    },

    // 自动计算最佳视图模式（基于基础日期范围）
    autoViewMode() {
      const range = this.baseDateRange
      const startDate = moment(range[0])
      const endDate = moment(range[1])
      const daysDiff = endDate.diff(startDate, 'days')
      const monthsDiff = endDate.diff(startDate, 'months')
      const yearsDiff = endDate.diff(startDate, 'years')

      // 根据时间跨度自动选择视图模式
      if (yearsDiff >= 2) {
        return 'year'
      } else if (monthsDiff >= 6) {
        return 'month'
      } else if (daysDiff > 60) {
        return 'month'
      } else {
        return 'day'
      }
    },

    // 当前使用的视图模式
    effectiveViewMode() {
      // 如果用户手动设置了日期范围，使用当前视图模式
      if (this.dateRange && this.dateRange.length > 0) {
        return this.currentViewMode
      }
      // 否则使用自动计算的视图模式
      return this.autoViewMode
    },

    // 根据视图模式调整的最终日期范围
    dynamicDateRange() {
      // 如果用户手动设置了日期范围，直接使用
      if (this.dateRange && this.dateRange.length === 2 && this.dateRange[0] && this.dateRange[1]) {
        return this.dateRange
      }

      // 获取基础范围
      const baseRange = this.baseDateRange
      const minDate = moment(baseRange[0])
      const maxDate = moment(baseRange[1])

      // 根据当前视图模式进行微调
      let adjustedStart, adjustedEnd
      const viewMode = this.effectiveViewMode

      switch (viewMode) {
      case 'day':
        // 日视图：在基础范围上微调
        adjustedStart = minDate.clone().subtract(7, 'days')
        adjustedEnd = maxDate.clone().add(7, 'days')
        break

      case 'month':
        // 月视图：对齐到月边界
        adjustedStart = minDate.clone().startOf('month')
        adjustedEnd = maxDate.clone().endOf('month')
        break

      case 'year':
        // 年视图：对齐到年边界
        adjustedStart = minDate.clone().startOf('year')
        adjustedEnd = maxDate.clone().endOf('year')
        break

      default:
        adjustedStart = minDate
        adjustedEnd = maxDate
      }

      return [
        adjustedStart.format('YYYY-MM-DD'),
        adjustedEnd.format('YYYY-MM-DD')
      ]
    },

    // 图表日期范围
    chartStartDate() {
      const range = this.dynamicDateRange
      return moment(range[0])
    },

    chartEndDate() {
      const range = this.dynamicDateRange
      return moment(range[1])
    },

    // 是否是手动设置的日期范围
    isManualDateRange() {
      return !!(this.dateRange && this.dateRange.length > 0)
    },

    // 预定义颜色
    predefineColors() {
      return [
        '#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6',
        '#1abc9c', '#34495e', '#e67e22', '#8e44ad', '#27ae60'
      ]
    },

    // 对话框标题
    dialogTitle() {
      switch (this.dialogMode) {
      case 'edit':
        return 'Edit Task'
      case 'add-sibling':
        return `Add Sibling Task (Sibling to: ${this.siblingSourceTask?.name || ''})`
      case 'add-child':
        return `Add Child Task (Parent: ${this.childSourceTask?.name || ''})`
      case 'add':
      default:
        return 'Add New Task'
      }
    },

    // 对话框按钮文本
    dialogButtonText() {
      switch (this.dialogMode) {
      case 'edit':
        return 'Save Changes'
      case 'add-sibling':
        return 'Add Sibling Task'
      case 'add-child':
        return 'Add Child Task'
      case 'add':
      default:
        return 'Add Task'
      }
    },

    // 是否显示父任务选择器
    shouldShowParentSelection() {
      return this.dialogMode === 'add' || this.dialogMode === 'edit'
    },

    // 是否显示父任务只读显示
    shouldShowParentDisplay() {
      return this.dialogMode === 'add-sibling' || this.dialogMode === 'add-child'
    },

    // 父任务显示名称
    parentTaskDisplayName() {
      if (this.dialogMode === 'add-child' && this.childSourceTask) {
        return this.childSourceTask.name
      } else if (this.dialogMode === 'add-sibling' && this.siblingSourceTask) {
        // 查找同级任务的父任务名称
        if (this.siblingSourceTask.parentId) {
          const parentTask = this.findTaskById(this.siblingSourceTask.parentId)
          return parentTask ? parentTask.name : '未找到父任务'
        } else {
          return '根级任务'
        }
      }
      return ''
    },

    // 表格高度 - 精确计算可视区域高度
    tableHeight() {
      // 获取ganttMain的实际高度，减去表头高度（62px）
      if (this.$refs.ganttMain && this.$refs.ganttMain.clientHeight > 0) {
        const mainHeight = this.$refs.ganttMain.clientHeight
        const headerHeight = 62
        const availableHeight = mainHeight - headerHeight
        return Math.max(availableHeight, 200)
      }
      return 500
    },

    // 表单验证规则
    taskFormRules() {
      return {
        name: [
          { required: true, message: 'Please enter task name', trigger: 'blur' },
          { min: 1, max: 100, message: 'Task name length should be 1-100 characters', trigger: 'blur' }
        ],
        startDate: [
          { required: true, message: 'Please select start date', trigger: 'change' }
        ],
        endDate: [
          { required: true, message: 'Please select end date', trigger: 'change' }
        ],
        newParentName: [
          {
            validator: (rule, value, callback) => {
              if (this.newTask.parentId === 'new_parent') {
                if (!value || value.trim() === '') {
                  callback(new Error('Please enter parent group name'))
                } else if (value.length > 50) {
                  callback(new Error('Parent name length should be less than 50 characters'))
                } else {
                  callback()
                }
              } else {
                callback()
              }
            },
            trigger: 'blur'
          }
        ]
      }
    },

    // 父级任务选项 - 显示实际任务名称
    parentTaskOptions() {
      const options = []
      const rootTasks = this.ganttData || []

      // 创建所有任务的扁平化列表，用于父任务选择
      const getAllTasks = (tasks) => {
        let allTasks = []
        tasks.forEach(task => {
          // 排除当前正在编辑的任务（防止自己作为自己的父任务）
          if (this.dialogMode === 'edit' && task.id === this.editingTaskId) {
            return
          }
          allTasks.push(task)
          if (task.children) {
            allTasks = allTasks.concat(getAllTasks(task.children))
          }
        })
        return allTasks
      }

      const allTasks = getAllTasks(rootTasks)

      // 按层级分组添加父任务选项
      if (allTasks.length > 0) {
        // 根级任务（没有父任务的任务）
        const rootLevelTasks = allTasks.filter(task => !task.parentId)
        if (rootLevelTasks.length > 0) {
          options.push({
            label: '根级任务',
            options: rootLevelTasks.map(task => ({
              label: task.name,
              value: task.id
            }))
          })
        }

        // 有子任务的任务（可以作为父任务）
        const parentTasks = allTasks.filter(task => task.children && task.children.length > 0)
        if (parentTasks.length > 0) {
          options.push({
            label: '父级任务组',
            options: parentTasks.map(task => ({
              label: task.name,
              value: task.id
            }))
          })
        }
      }

      return options
    },

    // 结束日期选择器选项
    endDatePickerOptions() {
      return {
        disabledDate: (time) => {
          if (!this.newTask.startDate) return false
          return time.getTime() < new Date(this.newTask.startDate).getTime()
        }
      }
    },

    // 计划结束日期选择器选项
    planEndDatePickerOptions() {
      return {
        disabledDate: (time) => {
          if (!this.newTask.planStartDate) return false
          return time.getTime() < new Date(this.newTask.planStartDate).getTime()
        }
      }
    },

    // 决定是否使用虚拟滚动
    shouldUseVirtualScrolling() {
      return this.useVirtualScrolling || (
        this.autoOptimizeConfig.enabled &&
        this.flattenTasks.length > this.autoOptimizeConfig.maxTasksBeforeVirtual
      )
    },

    // 可见任务数量（用于性能监控）
    visibleTaskCount() {
      return this.flattenTasks.filter(task => {
        // 计算当前视口中可见的任务数量
        return true // 简化实现，实际应该根据滚动位置计算
      }).length
    },

    // 平铺表格数据（用于虚拟滚动）
    flatTableDataForVirtual() {
      // 直接用所有已展开的可见任务
      return this.visibleTasks.map(task => ({
        ...task,
        id: task.id || Math.random().toString(36).substr(2, 9)
      }))
    },

    // 动态虚拟滚动容器高度
    dynamicVirtualScrollHeight() {
      // 计算实际内容高度，确保与甘特图右侧内容高度一致
      const contentHeight = Math.max(this.flattenTasks.length * 28, 200) // 压缩行高计算
      // 不超过可用的容器高度
      return Math.min(contentHeight, this.tableHeight)
    },

    // 计算实际需要的甘特图高度
    actualGanttHeight() {
      // 基于扁平化任务数量计算实际高度，每个任务40px行高
      const taskCount = this.flattenTasks.length
      const calculatedHeight = Math.max(taskCount * 28, 200) // 压缩行高，最小200px

      // 如果任务数量较少，避免过多空白区域
      if (taskCount <= 5) {
        return Math.max(taskCount * 40, 200)
      }

      return calculatedHeight
    },

    // 动态甘特图最小高度CSS变量
    ganttHeightStyle() {
      return {
        '--gantt-min-height': `${this.actualGanttHeight  }px`
      }
    },
    taskDialogTitle: {
      get() {
        switch (this.dialogMode) {
        case 'edit':
          return 'Edit Task'
        case 'add-sibling':
          return `Add Sibling Task (Sibling to: ${this.siblingSourceTask?.name || ''})`
        case 'add-child':
          return `Add Child Task (Parent: ${this.childSourceTask?.name || ''})`
        case 'add':
        default:
          return 'Add New Task'
        }
      },
      set(value) {
        // 我们不需要实际设置值，因为标题是根据mode自动计算的
        console.warn('taskDialogTitle is computed based on dialogMode and should not be set directly')
      }
    }
  },
  methods: {
    ...mapActions(['toggleTaskCollapsed', 'jumpToToday', 'clearLineageHighlight', 'setLineageHighlight']),

    // 切换关键路径显示
    toggleCriticalPath() {
      this.ganttDisplayConfig.showCriticalPath = !this.ganttDisplayConfig.showCriticalPath

      // 通知设置对话框更新配置
      this.$emit('gantt-display-config-change', this.ganttDisplayConfig)

      // 显示消息提示
      this.$message({
        message: `${this.ganttDisplayConfig.showCriticalPath ? '显示' : '隐藏'}关键路径`,
        type: 'success',
        duration: 1500
      })
    },

    // 处理节点拖拽请求平移视图
    handleRequestPan(panRequest) {
      if (panRequest.direction === 'right') {
        // 向右平移视图（内容向左移动）
        this.panOffset += panRequest.amount
      } else if (panRequest.direction === 'left') {
        // 向左平移视图（内容向右移动）
        this.panOffset -= panRequest.amount
      }

      // 如果需要更新时间轴
      if (panRequest.updateTimeline) {
        if (panRequest.extendLeft) {
          // 向左扩展时间轴（增加更早的日期）
          const currentStartDate = this.chartStartDate.clone()
          // 根据视图模式决定扩展的天数
          let daysToExtend = 7 // 默认扩展一周

          if (this.effectiveViewMode === 'day') {
            daysToExtend = 7
          } else if (this.effectiveViewMode === 'week') {
            daysToExtend = 14
          } else if (this.effectiveViewMode === 'month') {
            daysToExtend = 30
          }

          // 更新开始日期
          this.chartStartDate = currentStartDate.subtract(daysToExtend, 'days')

          // 直接更新时间轴刷新键，而不是调用可能不存在的方法
          this.timelineRefreshKey = Date.now()
        } else if (panRequest.extendRight) {
          // 向右扩展时间轴（增加更晚的日期）
          const currentEndDate = this.chartEndDate.clone()
          // 根据视图模式决定扩展的天数
          let daysToExtend = 7 // 默认扩展一周

          if (this.effectiveViewMode === 'day') {
            daysToExtend = 7
          } else if (this.effectiveViewMode === 'week') {
            daysToExtend = 14
          } else if (this.effectiveViewMode === 'month') {
            daysToExtend = 30
          }

          // 更新结束日期
          this.chartEndDate = currentEndDate.add(daysToExtend, 'days')

          // 直接更新时间轴刷新键，而不是调用可能不存在的方法
          this.timelineRefreshKey = Date.now()
        }
      }

      // 更新时间轴和网格的位置
      this.timelineRefreshKey = Date.now()

      // 强制更新视图
      this.$nextTick(() => {
        this.$forceUpdate()
      })
    },

    // 处理甘特图宽度更新请求
    handleUpdateChartWidth(updateInfo) {
      console.log('[宽度更新] 收到宽度更新请求:', updateInfo)

      // 根据方向和数量更新甘特图宽度
      if (updateInfo.direction === 'left') {
        // 向左扩展甘特图宽度，需要增加左侧空间
        this.updateRightAreaWidth()
        console.log('[宽度更新] 向左扩展，重新计算宽度')
      } else if (updateInfo.direction === 'right') {
        // 向右扩展甘特图宽度，立即增加足够的宽度
        const expandAmount = Math.max(updateInfo.amount * 3, 500) // 确保足够的扩展空间
        this.rightAreaWidth += expandAmount
        console.log('[宽度更新] 向右扩展，增加宽度:', expandAmount, '新宽度:', this.rightAreaWidth)

        // 同时检查是否需要扩展时间轴日期范围
        const currentEndDate = this.chartEndDate
        const daysToAdd = Math.ceil(expandAmount / this.getDayWidth())
        const newEndDate = currentEndDate.clone().add(daysToAdd + 15, 'days') // 额外增加15天缓冲

        console.log('[时间轴扩展] 准备扩展时间轴，增加天数:', daysToAdd + 15)

        // 更新日期范围以支持向右扩展
        this.dateRange = [
          this.chartStartDate.format('YYYY-MM-DD'),
          newEndDate.format('YYYY-MM-DD')
        ]
      }

      // 强制更新所有相关组件
      this.$nextTick(() => {
        // 重新计算宽度确保一致性
        this.updateRightAreaWidth()

        // 强制更新主要组件
        this.$forceUpdate()

        // 更新时间轴和甘特图组件
        if (this.$refs.timeline) {
          this.$refs.timeline.$forceUpdate()
        }
        if (this.$refs.ganttBars) {
          this.$refs.ganttBars.$forceUpdate()
        }

        console.log('[宽度更新] 组件更新完成，最终宽度:', this.rightAreaWidth)
      })
    },

    // 显示设置对话框
    openSettingsDialog() {
      this.$emit('update:showSettingsDialog', true)
    },

    // 处理设置对话框可见性变化
    handleSettingsVisibleChange(visible) {
      this.$emit('update:showSettingsDialog', visible)
      if (!visible) {
        this.$emit('settings-dialog-close')
      }
    },

    // 甘特图显示配置变更处理
    handleGanttDisplayConfigChange(config) {
      this.ganttDisplayConfig = { ...config }
    },

    // 处理连接线编辑配置变化
    handleConnectionEditableChange(editable) {
      // 通知父组件连接线编辑配置已更改
      this.$emit('connection-editable-change', editable)
    },

    // 处理设置保存
    handleSettingsSave(settings) {
      // 批量更新设置
      this.dateRange = settings.dateRange
      this.$emit('update:tooltipEnabled', settings.tooltipEnabled)
      this.$emit('update:tooltipDelay', settings.tooltipDelay)
      this.$emit('update:tooltipHideDelay', settings.tooltipHideDelay)
      this.$emit('update:timelineVisible', settings.timelineVisible)

      if (settings.grayConnectionMode !== this.grayConnectionMode) {
        this.toggleGrayConnectionMode()
      }

      if (settings.autoOptimizeEnabled !== this.autoOptimizeConfig.enabled) {
        this.handleAutoOptimizeToggle(settings.autoOptimizeEnabled)
      }

      // 更新甘特图显示配置
      if (settings.ganttDisplayConfig) {
        this.ganttDisplayConfig = { ...settings.ganttDisplayConfig }
      }

      this.$message.success('Settings saved successfully')
    },

    // 更新tooltip延迟设置
    updateTooltipDelay(value) {
      this.$emit('update:tooltipDelay', value)
    },

    updateTooltipHideDelay(value) {
      this.$emit('update:tooltipHideDelay', value)
    },

    updateTimelineVisible(value) {
      this.$emit('update:timelineVisible', value)
    },

    // 更新右侧区域宽度
    updateRightAreaWidth() {
      const totalDays = this.chartEndDate.diff(this.chartStartDate, 'days') + 1
      const dayWidth = this.getDayWidth()
      const containerWidth = this.$refs.ganttRight?.clientWidth || 0

      // 计算所有任务中最大的结束日期
      let maxEndDate = this.chartEndDate.clone()

      // 遍历所有任务找到最大结束日期
      this.flattenTasks.forEach(task => {
        if (task.endDate) {
          const taskEndDate = moment(task.endDate)
          if (taskEndDate.isAfter(maxEndDate)) {
            maxEndDate = taskEndDate.clone()
          }
        }
      })

      // 计算最大结束日期与当前图表结束日期的差值
      const extraDays = Math.max(0, maxEndDate.diff(this.chartEndDate, 'days'))

      // 如果有任务超出当前结束日期，增加额外的宽度
      const contentWidth = (totalDays + extraDays) * dayWidth

      // 根据视图模式调整最小宽度
      let minWidth = 800
      switch(this.effectiveViewMode) {
      case 'day':
        minWidth = 1200 // 日视图需要更宽的空间
        break
      case 'week':
        minWidth = 1000
        break
      case 'month':
        minWidth = 800
        break
      case 'year':
        minWidth = 1200 // 年视图确保撑满屏幕，与时间轴保持一致
        break
      }

      // 设置最终宽度，确保足够容纳所有任务和拖拽操作
      // 增加适当的缓冲空间以支持向右拖拽和动态渲染
      const bufferWidth = 200 // 适中的缓冲空间，支持向右拖拽时的动态扩展
      this.rightAreaWidth = Math.max(contentWidth + bufferWidth, containerWidth, minWidth)

      // console.log(`[宽度计算] 视图模式: ${this.effectiveViewMode}, 总天数: ${totalDays}, 额外天数: ${extraDays}, 天宽度: ${dayWidth}px, 内容宽度: ${contentWidth}px, 容器宽度: ${containerWidth}px, 最终宽度: ${this.rightAreaWidth}px`)

      // 如果有任务超出当前日期范围，考虑自动扩展日期范围
      if (extraDays > 0) {
        console.log(`[日期范围] 检测到任务超出当前日期范围 ${extraDays} 天，自动调整时间轴`)
      }

      this.$nextTick(() => this.$forceUpdate())
    },

    // 日期格式化
    formatDate(date) {
      if (!date) return '-'
      return moment(date).format('MM/DD/YYYY')
    },

    // 获取任务状态
    getTaskStatus(task) {
      if (!task.progress) return 'Not Started'
      if (task.progress >= 100) return 'Completed'
      if (task.progress > 0) return 'In Progress'
      return 'Not Started'
    },

    // 获取状态样式类
    getStatusClass(task) {
      const status = this.getTaskStatus(task)
      return {
        'status-completed': status === 'Completed',
        'status-progress': status === 'In Progress',
        'status-not-started': status === 'Not Started'
      }
    },

    // 获取行样式类
    getRowClassName({ row, rowIndex }) {
      let className = ''
      if (row.children && row.children.length > 0) {
        className += 'parent-row '
      }
      if (this.highlightedRowId === row.id) {
        className += 'highlighted-row '
      }
      return className
    },

    // 处理折叠/展开
    handleToggleCollapse(taskId) {
      // 调用store action（确保状态更新）
      this.toggleTaskCollapsed(taskId)

      // 强制右侧甘特图组件更新
      this.$nextTick(() => {
        // 触发右侧组件重新渲染
        if (this.$refs.ganttRight) {
          this.$forceUpdate()
        }
      })
    },

    // 处理行点击
    handleRowClick(row) {
      this.highlightedRowId = row.id
    },

    // 处理右侧滚动
    handleRightScroll(event) {
      // 如果正在拖拽，不处理滚动同步
      // 拖拽时的滚动变化由拖拽逻辑单独处理
      if (this.isDragging) {
        return
      }

      const {scrollLeft} = event.target
      const {scrollTop} = event.target

      // 防止滚动循环同步
      if (this.scrollSyncLock) return
      this.scrollSyncLock = true

      // 延迟执行同步，确保当前滚动事件处理完成
      this.$nextTick(() => {
        this.performScrollSync(scrollLeft, scrollTop, 'right')

        // 释放锁
        this.scrollSyncLock = false
      })
    },

    // 统一的滚动同步方法
    performScrollSync(scrollLeft, scrollTop, source = 'unknown') {
      // 如果是甘特图拖拽或右侧滚动引起的，不同步水平滚动到左侧表格
      const shouldSyncHorizontal = source !== 'right' && source !== 'drag'

      if (this.shouldUseVirtualScrolling) {
        // 虚拟滚动表格同步
        const {virtualTable} = this.$refs
        if (virtualTable) {
          // 条件同步水平滚动
          if (shouldSyncHorizontal) {
            const virtualTableContainer = virtualTable.$refs?.container
            if (virtualTableContainer && Math.abs(virtualTableContainer.scrollLeft - scrollLeft) > 1) {
              virtualTableContainer.scrollLeft = scrollLeft
            }
          }

          // 同步垂直滚动 - 优先使用scrollTo方法
          if (virtualTable.scrollTo && Math.abs((virtualTable.scrollData?.scrollTop || 0) - scrollTop) > 1) {
            virtualTable.scrollTo(scrollTop)
          } else {
            const virtualTableBody = virtualTable.$refs?.body
            if (virtualTableBody && Math.abs(virtualTableBody.scrollTop - scrollTop) > 1) {
              virtualTableBody.scrollTop = scrollTop
            }
          }
        }
      } else {
        // 普通表格同步
        const {customTable} = this.$refs
        if (customTable) {
          const customTableBody = customTable.$refs?.tableBody
          if (customTableBody) {
            // 条件同步水平滚动 - 避免甘特图拖拽影响左侧表格水平滚动
            if (shouldSyncHorizontal && Math.abs(customTableBody.scrollLeft - scrollLeft) > 1) {
              customTableBody.scrollLeft = scrollLeft
            }
            // 垂直滚动始终同步
            if (Math.abs(customTableBody.scrollTop - scrollTop) > 1) {
              customTableBody.scrollTop = scrollTop
            }
          }
        }
      }
    },

    // 空操作
    noop() {},

    // 处理节点拖拽开始
    handleNodeDragStart(task) {
      console.log('[甘特图] 节点拖拽开始，禁用背景交互:', task.name)
      this.isNodeDragging = true
    },

    // 处理节点拖拽结束
    handleNodeDragEnd() {
      console.log('[甘特图] 节点拖拽结束，恢复背景交互')
      this.isNodeDragging = false
    },

    // 处理节点拖拽到可视区域外部
    handleNodeDragOutside(dragInfo) {
      if (!this.allowDragOutside || !this.dragOutsideConfig.enabled) {
        console.log('[甘特图] 拖拽扩展功能已禁用')
        return
      }

      const { direction, distance, task } = dragInfo
      const expandDays = this.dragOutsideConfig.expandDays || 30

      console.log(`[甘特图] 节点拖拽到外部: ${direction}, 距离: ${distance}px, 任务: ${task.name}`)

      // 根据拖拽方向扩展时间轴
      if (direction === 'left') {
        this.expandTimelineLeft(expandDays)
      } else if (direction === 'right') {
        this.expandTimelineRight(expandDays)
      }
    },

    // 向左扩展时间轴
    expandTimelineLeft(days) {
      if (!this.chartStartDate) return

      const newStartDate = this.chartStartDate.clone().subtract(days, 'days')
      console.log(`[甘特图] 向左扩展时间轴 ${days} 天: ${newStartDate.format('YYYY-MM-DD')}`)

      // 更新日期范围
      this.dateRange = [
        newStartDate.format('YYYY-MM-DD'),
        this.chartEndDate.format('YYYY-MM-DD')
      ]

      // 触发时间轴刷新
      this.refreshTimeline()

      // 显示扩展提示
      this.$message({
        message: `时间轴已向左扩展 ${days} 天`,
        type: 'info',
        duration: 2000
      })
    },

    // 向右扩展时间轴
    expandTimelineRight(days) {
      if (!this.chartEndDate) return

      const newEndDate = this.chartEndDate.clone().add(days, 'days')
      console.log(`[甘特图] 向右扩展时间轴 ${days} 天: ${newEndDate.format('YYYY-MM-DD')}`)

      // 更新日期范围
      this.dateRange = [
        this.chartStartDate.format('YYYY-MM-DD'),
        newEndDate.format('YYYY-MM-DD')
      ]

      // 触发时间轴刷新
      this.refreshTimeline()

      // 显示扩展提示
      this.$message({
        message: `时间轴已向右扩展 ${days} 天`,
        type: 'info',
        duration: 2000
      })
    },

    // 刷新时间轴
    refreshTimeline() {
      this.timelineRefreshKey++
      this.$nextTick(() => {
        this.updateRightAreaWidth()
      })
    },

    // 处理来自GanttBars组件的编辑任务事件
    handleEditTaskFromBars(task) {
      // 设置编辑模式
      this.editDialogMode = 'edit'
      this.editDialogType = task.type || 'task'

      // 设置编辑任务数据
      this.editingTask = { ...task }

      // 查找并设置父任务
      if (task.parentId) {
        this.parentTask = this.findParentTask(task.parentId)
      } else {
        this.parentTask = null
      }

      // 显示编辑对话框
      this.editDialogVisible = true
    },
    // 处理图表区域点击
    handleChartAreaClick() {
      this.highlightedRowId = null
      // 清除连接高亮
      this.$store.dispatch('clearLineageHighlight')
    },

    // 处理任务栏拖拽
    handleBarDrag(payload) {
      // 添加父子节点时间关联配置到payload中
      const enhancedPayload = {
        ...payload,
        linkParentChildDates: this.linkParentChildDates // 传递父子节点时间关联配置
      }

      // 父节点拖拽时使用requestAnimationFrame和更短防抖
      if (payload.isParentNode) {
        if (this.parentDragDebounceTimer) {
          cancelAnimationFrame(this.parentDragDebounceTimer)
        }
        this.parentDragDebounceTimer = requestAnimationFrame(() => {
          this.$store.dispatch('updateGanttItem', enhancedPayload)

          // 检查并更新甘特图宽度和时间轴
          this.checkAndUpdateChartWidth(payload)
        })
      } else {
        this.$store.dispatch('updateGanttItem', enhancedPayload)

        // 检查并更新甘特图宽度和时间轴
        this.checkAndUpdateChartWidth(payload)
      }
    },

    // 处理任务栏调整大小
    handleBarResize(payload) {
      // 添加父子节点时间关联配置到payload中
      const enhancedPayload = {
        ...payload,
        linkParentChildDates: this.linkParentChildDates // 传递父子节点时间关联配置
      }

      this.$store.dispatch('updateGanttItem', enhancedPayload)
      // 自定义表格会自动响应store变化，不需要强制刷新

      // 检查并更新甘特图宽度和时间轴
      this.checkAndUpdateChartWidth(payload)
    },

    // 检查并更新甘特图宽度和时间轴
    checkAndUpdateChartWidth(payload) {
      // 使用nextTick确保状态已更新
      this.$nextTick(() => {
        // 更新甘特图宽度
        this.updateRightAreaWidth()

        // 如果任务移动超出当前日期范围，自动扩展日期范围
        let needsUpdate = false
        let newStartDate = this.chartStartDate.clone()
        let newEndDate = this.chartEndDate.clone()

        // 检查开始日期（向左扩展）
        if (payload.startDate) {
          const taskStartMoment = moment(payload.startDate)
          if (taskStartMoment.isBefore(this.chartStartDate)) {
            newStartDate = taskStartMoment.clone().subtract(15, 'days') // 额外增加15天缓冲
            needsUpdate = true
            console.log('[日期范围] 任务超出左边界，自动扩展开始日期到:', newStartDate.format('YYYY-MM-DD'))
          }
        }

        // 检查结束日期（向右扩展）
        if (payload.endDate) {
          const taskEndMoment = moment(payload.endDate)
          if (taskEndMoment.isAfter(this.chartEndDate)) {
            newEndDate = taskEndMoment.clone().add(15, 'days') // 额外增加15天缓冲
            needsUpdate = true
            console.log('[日期范围] 任务超出右边界，自动扩展结束日期到:', newEndDate.format('YYYY-MM-DD'))
          }
        }

        if (needsUpdate) {
          // 更新日期范围
          this.dateRange = [
            newStartDate.format('YYYY-MM-DD'),
            newEndDate.format('YYYY-MM-DD')
          ]

          console.log('[时间轴更新] 日期范围已更新，正在刷新时间轴组件')

          // 立即更新右侧区域宽度以支持向右拖拽
          this.updateRightAreaWidth()

          // 强制刷新时间轴组件 - 使用多重刷新确保正确渲染
          this.$nextTick(() => {
            // 再次确保右侧区域宽度正确
            this.updateRightAreaWidth()

            // 刷新时间轴组件
            if (this.$refs.timeline) {
              // 先更新时间轴的实际宽度
              if (this.$refs.timeline.updateActualWidth) {
                this.$refs.timeline.updateActualWidth()
              }
              // 然后强制更新组件
              this.$refs.timeline.$forceUpdate()
              console.log('[时间轴更新] 时间轴组件已强制更新')
            }

            // 强制更新甘特图主要组件
            this.$forceUpdate()

            // 再次在下一个tick中确保所有变化都已应用
            this.$nextTick(() => {
              if (this.$refs.timeline) {
                this.$refs.timeline.$forceUpdate()
              }
              // 确保甘特图内容区域也正确更新
              if (this.$refs.ganttBars) {
                this.$refs.ganttBars.$forceUpdate()
              }
            })
          })
        }
      })
    },

    // 处理任务更新
    handleTaskUpdate(payload) {
      // 添加父子节点时间关联配置到payload中
      const enhancedPayload = {
        ...payload,
        linkParentChildDates: this.linkParentChildDates // 传递父子节点时间关联配置
      }

      this.$store.dispatch('updateGanttItem', enhancedPayload)
      // 自定义表格会自动响应store变化，不需要强制刷新
      this.autoRangeDebounced() // 修改后自动 range
    },

    // 处理任务删除
    handleTaskDelete(taskId) {
      this.$store.dispatch('deleteTask', taskId)
      this.autoRangeDebounced() // 删除后自动 range
    },

    // 处理任务高亮
    handleTaskHighlight(taskId) {
      this.highlightedRowId = taskId
    },

    // 更新日期范围
    handleDateRangeChange(range) {
      this.dateRange = range
      // 当用户手动设置日期范围时，启用视图模式选择
      if (range && range.length === 2) {
        // 保持当前视图模式
      } else {
        // 如果清空了日期范围，回到自动模式
        this.$emit('update:currentViewMode', this.autoViewMode)
      }
    },

    // 重置日期范围到自动模式
    resetDateRange() {
      this.dateRange = []
      // 当重置日期范围时，自动选择合适的视图模式
      this.$nextTick(() => {
        this.$emit('update:currentViewMode', this.autoViewMode)
      })
    },

    // 显示添加任务对话框
    showAddTaskDialog() {
      this.resetTaskForm()
      this.showAddDialog = true
      // 设置默认开始日期为今天
      this.newTask.startDate = moment().format('YYYY-MM-DD')
      this.newTask.endDate = moment().add(7, 'days').format('YYYY-MM-DD')
    },

    // 切换tooltip显示
    toggleTooltip(enabled) {
      // 处理从SettingsDialog传递的布尔值或事件对象
      const isEnabled = typeof enabled === 'boolean' ? enabled : enabled.target.checked
      this.$emit('update:tooltipEnabled', isEnabled)
      this.$message({
        message: `Tooltips ${isEnabled ? 'enabled' : 'disabled'}`,
        type: 'info',
        duration: 1500
      })
    },

    // 拖拽滚动 - 开始拖拽
    handleDragStart(event) {
      // 只在左键点击时开始拖拽
      if (event.button !== 0) return

      // 检查是否点击在空白区域（避免干扰其他交互）
      const {target} = event

      // 更精确的检查，避免干扰任务栏、连接线、时间轴等交互元素
      const excludeSelectors = [
        '.gantt-bar', '.bar-progress', '.bar-resize-handle',
        '.dependency-line', '.dependency-arrow', '.dependency-label',
        '.scale-item', '.timeline-scale-top', '.timeline-scale-bottom',
        'input', 'button', 'select', '.el-button', '.el-input',
        '.grid-line', '.task-milestone'
      ]

      // 检查是否点击了排除的元素
      const isExcluded = excludeSelectors.some(selector => {
        return target.closest(selector) || target.matches(selector)
      })

      if (isExcluded) {
        return
      }

      // 添加延迟，避免与双击等事件冲突
      setTimeout(() => {
        if (!this.isDragging) { // 确保在延迟期间没有被其他事件取消
          this.isDragging = true
          this.dragStartX = event.clientX
          this.dragStartY = event.clientY
          this.dragTarget = this.$refs.scrollContainer

          if (this.dragTarget) {
            this.scrollStartX = this.dragTarget.scrollLeft
            this.scrollStartY = this.dragTarget.scrollTop
          }

          // 改变鼠标样式
          document.body.style.cursor = 'grabbing'
          document.body.style.userSelect = 'none'
        }
      }, 50) // 50ms延迟

      // 阻止默认行为
      event.preventDefault()
    },

    // 拖拽滚动 - 拖拽移动
    handleDragMove(event) {
      if (!this.isDragging || !this.dragTarget) return

      const deltaX = this.dragStartX - event.clientX
      const deltaY = this.dragStartY - event.clientY

      // 计算新的滚动位置
      const newScrollLeft = this.scrollStartX + deltaX
      const newScrollTop = this.scrollStartY + deltaY

      // 更新滚动位置
      this.dragTarget.scrollLeft = newScrollLeft
      this.dragTarget.scrollTop = newScrollTop

      // 甘特图拖拽只同步垂直滚动，不同步水平滚动
      // 因为拖拽是为了平移时间轴，不是为了查看表格的更多列
      this.syncLeftTableScrollVerticalOnly(newScrollTop)

      event.preventDefault()
    },

    // 同步左侧表格滚动（供拖拽滚动使用）
    syncLeftTableScroll(scrollLeft, scrollTop) {
      // 防止滚动循环同步
      if (this.scrollSyncLock) return
      this.scrollSyncLock = true

      // 使用统一的同步方法
      this.$nextTick(() => {
        this.performScrollSync(scrollLeft, scrollTop, 'drag')

        // 释放锁
        this.scrollSyncLock = false
      })
    },

    // 仅同步左侧表格的垂直滚动（供甘特图拖拽使用）
    syncLeftTableScrollVerticalOnly(scrollTop) {
      // 防止滚动循环同步
      if (this.scrollSyncLock) return
      this.scrollSyncLock = true

      this.$nextTick(() => {
        // 只同步垂直滚动，不同步水平滚动
        if (this.shouldUseVirtualScrolling) {
          // 虚拟滚动表格同步
          const {virtualTable} = this.$refs
          if (virtualTable) {
            // 同步垂直滚动 - 优先使用scrollTo方法
            if (virtualTable.scrollTo && Math.abs((virtualTable.scrollData?.scrollTop || 0) - scrollTop) > 1) {
              virtualTable.scrollTo(scrollTop)
            } else {
              const virtualTableBody = virtualTable.$refs?.body
              if (virtualTableBody && Math.abs(virtualTableBody.scrollTop - scrollTop) > 1) {
                virtualTableBody.scrollTop = scrollTop
              }
            }
          }
        } else {
          // 普通表格同步
          const {customTable} = this.$refs
          if (customTable) {
            const customTableBody = customTable.$refs?.tableBody
            if (customTableBody && Math.abs(customTableBody.scrollTop - scrollTop) > 1) {
              customTableBody.scrollTop = scrollTop
            }
          }
        }

        // 释放锁
        this.scrollSyncLock = false
      })
    },

    // 拖拽滚动 - 结束拖拽
    handleDragEnd(event) {
      if (!this.isDragging) return
      this.isDragging = false
      this.dragTarget = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      if (this.parentDragDebounceTimer) {
        cancelAnimationFrame(this.parentDragDebounceTimer)
        this.parentDragDebounceTimer = null
      }
      event.preventDefault()
    },

    // 导出数据
    exportData() {
      // 导出甘特图数据
      const data = {
        ganttData: this.$store.state.ganttData,
        dependencies: this.$store.state.dependencies
      }
      const dataStr = JSON.stringify(data, null, 2)
      const dataBlob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(dataBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'gantt-data.json'
      link.click()
      URL.revokeObjectURL(url)
    },

    // 显示列配置对话框
    showColumnConfigDialog() {
      this.showColumnDialog = true
      // 在下一个tick初始化拖拽排序
      this.$nextTick(() => {
        this.initColumnConfigSortable()
      })
    },

    // 初始化列配置表格的拖拽排序
    initColumnConfigSortable() {
      if (!this.$refs.columnConfigTable || !this.$refs.columnConfigTable.$el) return

      const tbody = this.$refs.columnConfigTable.$el.querySelector('.el-table__body-wrapper tbody')
      if (!tbody) return

      // 销毁现有的排序实例
      if (this.columnSortableInstance) {
        this.columnSortableInstance.destroy()
      }

      this.columnSortableInstance = Sortable.create(tbody, {
        animation: 150,
        handle: '.drag-handle-column',
        onEnd: (evt) => {
          this.handleColumnConfigReorder(evt.oldIndex, evt.newIndex)
        }
      })
    },

    // 处理列配置重新排序
    handleColumnConfigReorder(oldIndex, newIndex) {
      if (oldIndex === newIndex) return

      // 获取当前的列配置数组（创建副本）
      const columns = JSON.parse(JSON.stringify(this.availableColumns))

      // 重新排序
      const movedColumn = columns.splice(oldIndex, 1)[0]
      columns.splice(newIndex, 0, movedColumn)

      // 更新order属性
      columns.forEach((col, index) => {
        col.order = index
      })

      // 更新store
      this.$store.dispatch('updateColumnConfig', columns)

      // 强制刷新
      this.$forceUpdate()

      // 重新初始化拖拽
      this.$nextTick(() => {
        this.initColumnConfigSortable()
      })
    },

    // 编辑任务
    editTask(task) {
      console.log('编辑任务:', task)

      // 设置编辑对话框参数
      this.editDialogType = task.type || 'task'
      this.editDialogMode = 'edit'
      this.editingTask = {
        ...task,
        childrenTasks: this.findChildrenTasks(task.id)
      }
      this.parentTask = this.findParentTask(task.parentId)
      this.editDialogVisible = true
    },


    // 添加子任务
    addChildTask(task) {
      console.log('添加子任务:', task)

      // 检查是否可以添加子任务
      if (task.type === 'milestone') {
        this.$message.warning('Milestone类型不能添加子任务')
        return
      }

      // 设置对话框参数
      this.editDialogType = 'task' // 子任务默认类型为task
      this.editDialogMode = 'add-child'
      this.editingTask = null
      this.parentTask = task

      // 设置默认日期范围
      const today = moment().format('YYYY-MM-DD')
      this.editDialogForm = {
        startDate: today,
        endDate: moment().add(7, 'days').format('YYYY-MM-DD'),
        type: 'task',
        progress: 0,
        status: 'Not Started',
        assignee: '',
        title: '',
        description: '',
        parentId: task.id
      }

      // 显示对话框
      this.editDialogVisible = true
    },

    // 处理删除任务
    handleDeleteTask(task) {
      console.log('删除任务:', task)
      this.$store.dispatch('deleteTask', task.id)

      // 刷新视图
      this.refreshTableData()
      this.refreshChart()

      this.$message.success(`任务 "${task.name}" 已删除`)
    },

    // 开始调整大小
    startResize(event) {
      this.isResizing = true
      this.startX = event.clientX
      this.startWidth = this.leftWidth

      // 添加鼠标移动和释放事件监听
      document.addEventListener('mousemove', this.handleResize)
      document.addEventListener('mouseup', this.endResize)

      event.preventDefault()
    },

    // 处理调整大小
    handleResize(event) {
      if (!this.isResizing) return

      const deltaX = event.clientX - this.startX
      // 移除宽度限制，允许自由拖拽
      // 只保留最小宽度100px以确保基本可用性
      const newWidth = Math.max(100, this.startWidth + deltaX)
      this.leftWidth = newWidth
    },

    // 结束调整大小
    endResize() {
      this.isResizing = false
      document.removeEventListener('mousemove', this.handleResize)
      document.removeEventListener('mouseup', this.endResize)

      // 大小调整完成后更新右侧宽度
      this.$nextTick(() => {
        this.updateRightAreaWidth()
      })
    },

    // 切换左侧面板
    toggleLeftPanel() {
      this.$store.dispatch('toggleLeftPanel')
      // 面板切换后更新右侧宽度
      this.$nextTick(() => {
        setTimeout(() => {
          this.updateRightAreaWidth()
        }, 300) // 等待过渡动画完成
      })
    },

    // 更新列可见性
    updateColumnVisibility(column) {
      this.$store.dispatch('updateColumnVisibility', {
        id: column.id,
        visible: column.visible
      })
    },

    // 更新列宽度
    updateColumnWidth(column) {
      this.$store.dispatch('updateColumnWidth', {
        id: column.id,
        width: column.width
      })
    },

    // 保存列配置
    saveColumnConfig() {
      // 触发视图更新以应用新的列宽度配置
      this.$nextTick(() => {
        if (this.$refs.customTable) {
          this.$refs.customTable.$forceUpdate()
        }
        this.refreshChart()
      })

      this.showColumnDialog = false
      this.$message.success('Column configuration saved!')
    },

    // 添加新任务
    addNewTask() {
      this.$refs.addTaskForm.validate(async (valid) => {
        if (!valid) {
          this.$message.error('请正确填写所有必填字段')
          return false
        }

        this.addingTask = true

        try {
          // 验证日期逻辑 - 开始时间不能晚于结束时间
          if (moment(this.newTask.startDate).isAfter(moment(this.newTask.endDate))) {
            this.$message.error('开始日期不能晚于结束日期!')
            this.addingTask = false
            return false
          }

          // 验证计划日期逻辑 - 计划开始时间不能晚于计划结束时间
          if (this.newTask.planStartDate && this.newTask.planEndDate) {
            if (moment(this.newTask.planStartDate).isAfter(moment(this.newTask.planEndDate))) {
              this.$message.error('计划开始日期不能晚于计划结束日期!')
              this.addingTask = false
              return false
            }
          }

          // 根据对话框模式执行不同逻辑
          if (this.dialogMode === 'edit') {
            // 编辑任务时也需要验证类型限制
            try {
              const isRoot = !this.editingParentTask
              const parentType = this.editingParentTask ? (this.editingParentTask.type || 'task') : null

              this.$store.commit('VALIDATE_TASK_TYPE', {
                taskType: this.newTask.type || 'task',
                parentType,
                isRoot
              })
            } catch (error) {
              this.$message.error(error.message)
              this.addingTask = false
              return false
            }

            // 编辑任务逻辑
            await this.updateExistingTask()
            return
          }

          // 验证任务类型限制
          try {
            const isRoot = !this.editingParentTask
            const parentType = this.editingParentTask ? (this.editingParentTask.type || 'task') : null

            this.$store.commit('VALIDATE_TASK_TYPE', {
              taskType: this.newTask.type || 'task',
              parentType,
              isRoot
            })
          } catch (error) {
            this.$message.error(error.message)
            return false
          }

          // 生成任务ID
          const taskId = this.generateUniqueTaskId()

          // 处理父级任务逻辑
          let parentTask = null
          let newParentTask = null
          let insertPosition = null

          if (this.newTask.parentId === 'new_parent') {
            // 创建新的父级任务组
            const parentId = this.generateUniqueTaskId()
            newParentTask = {
              id: parentId,
              name: this.newTask.newParentName.trim(),
              children: [],
              level: 0,
              color: this.newTask.color,
              isParentNode: true
            }
            parentTask = newParentTask
          } else if (this.newTask.parentId && this.newTask.parentId !== null) {
            // 查找现有父级任务
            const findTask = (tasks, id) => {
              for (const task of tasks) {
                if (task.id === id) return task
                if (task.children) {
                  const found = findTask(task.children, id)
                  if (found) return found
                }
              }
              return null
            }
            parentTask = findTask(this.ganttData, this.newTask.parentId)
          }

          // 如果是同级任务，需要计算插入位置
          if (this.dialogMode === 'add-sibling' && this.siblingSourceTask) {
            insertPosition = this.findSiblingInsertPosition(this.siblingSourceTask)
          }

          // 创建新任务对象
          const newTask = {
            id: taskId,
            name: this.newTask.name.trim(),
            startDate: this.newTask.startDate,
            endDate: this.newTask.endDate,
            planStartDate: this.newTask.planStartDate || null,
            planEndDate: this.newTask.planEndDate || null,
            progress: parseInt(this.newTask.progress) || 0,
            priority: this.newTask.priority || 'medium',
            color: this.newTask.color,
            description: this.newTask.description || '',
            level: parentTask ? 1 : 0,
            children: [],
            parentId: parentTask ? parentTask.id : null
          }

          // 添加到store
          const taskData = {
            task: newTask,
            parentTask,
            newParentTask,
            insertPosition // 同级任务的插入位置
          }

          await this.$store.dispatch('addTaskWithParent', taskData)

          this.showAddDialog = false
          this.resetTaskForm()

          // 根据模式显示不同的成功消息
          const successMessage = this.dialogMode === 'add-sibling'
            ? `同级任务 "${newTask.name}" 添加成功!`
            : this.dialogMode === 'add-child'
              ? `子任务 "${newTask.name}" 添加成功!`
              : `任务 "${newTask.name}" 添加成功!`

          this.$message.success(successMessage)
          this.autoRangeDebounced() // 新增后自动 range
        } catch (error) {
          this.$message.error('添加任务失败，请重试。')
        } finally {
          this.addingTask = false
        }
      })
    },

    // 更新现有任务
    async updateExistingTask() {
      try {
        // 额外验证：确保日期逻辑正确
        if (moment(this.newTask.startDate).isAfter(moment(this.newTask.endDate))) {
          throw new Error('开始日期不能晚于结束日期')
        }

        if (this.newTask.planStartDate && this.newTask.planEndDate) {
          if (moment(this.newTask.planStartDate).isAfter(moment(this.newTask.planEndDate))) {
            throw new Error('计划开始日期不能晚于计划结束日期')
          }
        }

        // 获取原始任务数据以检查是否有日期变更
        const originalTask = this.findTaskById(this.editingTaskId)
        const hasDateChange = (
          this.newTask.startDate !== originalTask.startDate ||
          this.newTask.endDate !== originalTask.endDate
        )

        // 构建更新数据
        const updates = {
          name: this.newTask.name,
          type: this.newTask.type,
          startDate: this.newTask.startDate,
          endDate: this.newTask.endDate,
          planStartDate: this.newTask.planStartDate || null,
          planEndDate: this.newTask.planEndDate || null,
          progress: this.newTask.progress,
          priority: this.newTask.priority,
          color: this.newTask.color,
          description: this.newTask.description
        }

        // 如果修改了父任务，需要特殊处理
        if (this.newTask.parentId !== originalTask.parentId) {
          updates.parentId = this.newTask.parentId
        }

        // 先更新当前任务
        this.$store.dispatch('updateGanttItem', {
          id: this.editingTaskId,
          updates
        })

        // 如果有日期变更，触发统一的任务时间变更处理
        if (hasDateChange) {
          console.log('[任务编辑] 检测到日期变更，触发级联更新检查')

          await this.$store.dispatch('handleTaskTimeChange', {
            taskId: this.editingTaskId,
            newStartDate: this.newTask.startDate,
            newEndDate: this.newTask.endDate,
            source: 'task-edit'
          })
        }

        this.$message.success('任务编辑成功')
        this.showAddDialog = false
        this.resetTaskForm()
        this.autoRangeDebounced() // 编辑后自动 range
      } catch (error) {
        console.error('更新任务失败:', error)
        this.$message.error(error.message || '任务更新失败')
        this.addingTask = false
      }
    },

    // 重置任务表单
    resetTaskForm() {
      // 重置对话框模式和相关状态
      this.dialogMode = 'add'
      this.editingTaskId = null
      this.editingParentTask = null
      this.editingSiblingTask = null
      this.siblingSourceTask = null
      this.childSourceTask = null

      // 重置表单数据
      this.newTask = {
        name: '',
        parentId: null,
        newParentName: '',
        startDate: '',
        endDate: '',
        planStartDate: '',
        planEndDate: '',
        progress: 0,
        priority: 'medium',
        color: '#3498db',
        description: ''
      }

      // 重置表单验证状态
      if (this.$refs.addTaskForm) {
        this.$refs.addTaskForm.resetFields()
        this.$refs.addTaskForm.clearValidate()
      }
    },

    // 查找同级任务的插入位置
    findSiblingInsertPosition(sourceTask) {
      // 查找源任务在其父级中的位置
      if (!sourceTask.parentId) {
        // 如果源任务是根级任务，在根级数组中查找位置
        const rootIndex = this.ganttData.findIndex(group => {
          return group.children && group.children.some(child => child.id === sourceTask.id)
        })
        if (rootIndex !== -1) {
          const group = this.ganttData[rootIndex]
          const childIndex = group.children.findIndex(child => child.id === sourceTask.id)
          return {
            parentGroup: group,
            insertIndex: childIndex + 1 // 插入到源任务后面
          }
        }
      } else {
        // 查找父级任务并确定插入位置
        const findParentAndIndex = (tasks, parentId, taskId) => {
          for (const task of tasks) {
            if (task.id === parentId && task.children) {
              const index = task.children.findIndex(child => child.id === taskId)
              if (index !== -1) {
                return {
                  parentTask: task,
                  insertIndex: index + 1
                }
              }
            }
            if (task.children) {
              const result = findParentAndIndex(task.children, parentId, taskId)
              if (result) return result
            }
          }
          return null
        }

        return findParentAndIndex(this.ganttData, sourceTask.parentId, sourceTask.id)
      }
      return null
    },

    // 根据ID查找任务
    findTaskById(taskId) {
      const findInTasks = (tasks, id) => {
        for (const task of tasks) {
          if (task.id === id) return task
          if (task.children) {
            const found = findInTasks(task.children, id)
            if (found) return found
          }
        }
        return null
      }
      return findInTasks(this.ganttData, taskId)
    },

    // 验证日期范围
    validateDateRange() {
      if (this.newTask.startDate && this.newTask.endDate) {
        if (moment(this.newTask.startDate).isAfter(moment(this.newTask.endDate))) {
          this.$message.warning('Start date cannot be after end date!')
          // 自动调整结束日期
          this.newTask.endDate = this.newTask.startDate
        }
      }
      // 验证表单字段
      if (this.$refs.addTaskForm) {
        this.$refs.addTaskForm.validateField('startDate')
        this.$refs.addTaskForm.validateField('endDate')
      }
    },

    // 验证计划日期范围
    validatePlanDateRange() {
      if (this.newTask.planStartDate && this.newTask.planEndDate) {
        if (moment(this.newTask.planStartDate).isAfter(moment(this.newTask.planEndDate))) {
          this.$message.warning('Plan start date cannot be after plan end date!')
          // 自动调整计划结束日期
          this.newTask.planEndDate = this.newTask.planStartDate
        }
      }
    },

    // 处理表格挂载
    handleTableMounted(tableInstance) {
      this.tableInstance = tableInstance
    },

    // 处理表格滚动 - 同步到右侧甘特图
    handleTableScroll(event) {
      // 如果正在拖拽甘特图，不处理表格滚动同步
      if (this.isDragging) return

      const {scrollTop} = event.target
      const {scrollLeft} = event.target // CustomGanttTable 也可能处理水平滚动

      // 防止滚动循环同步
      if (this.scrollSyncLock) return
      this.scrollSyncLock = true

      // 表格滚动同步

      // 同步垂直滚动到右侧甘特图
      const rightScrollContainer = this.$refs.scrollContainer
      if (rightScrollContainer && Math.abs(rightScrollContainer.scrollTop - scrollTop) > 1) {
        rightScrollContainer.scrollTop = scrollTop
      }

      // 使用nextTick确保DOM更新完成后释放锁
      this.$nextTick(() => {
        this.scrollSyncLock = false
      })
    },

    // 处理虚拟表格滚动
    handleVirtualTableScroll({ scrollTop }) {
      // 如果正在拖拽甘特图，不处理虚拟表格滚动同步
      if (this.isDragging) return

      // 防止滚动循环同步
      if (this.scrollSyncLock) return
      this.scrollSyncLock = true

      // 同步右侧甘特图的垂直滚动位置
      const rightScrollContainer = this.$refs.scrollContainer
      if (rightScrollContainer && Math.abs(rightScrollContainer.scrollTop - scrollTop) > 1) {
        rightScrollContainer.scrollTop = scrollTop
      }

      // 使用nextTick确保DOM更新完成后释放锁
      this.$nextTick(() => {
        this.scrollSyncLock = false
      })
    },

    // 处理列重新排序
    handleColumnReorder() {
      // 列重新排序后的处理
      this.$forceUpdate()
    },

    // 处理列宽拖拽调整
    handleColumnResize(resizeData) {
      console.log('[列宽调整] 列:', resizeData.columnId, '新宽度:', resizeData.newWidth)

      try {
        // 更新store中的列配置
        this.$store.dispatch('updateColumnWidth', {
          columnId: resizeData.columnId,
          width: resizeData.newWidth
        })

        // 强制更新表格布局
        this.$nextTick(() => {
          if (this.$refs.customTable) {
            this.$refs.customTable.initTableLayout()
          }
        })
      } catch (error) {
        console.error('[列宽调整] 更新失败:', error)
        this.$message.error('Column width update failed')
      }
    },

    // 处理单元格值变化
    handleCellValueChange(changeData) {
      console.log('[单元格编辑] 任务:', changeData.taskId, '字段:', changeData.field, '新值:', changeData.newValue)

      try {
        // 验证数据有效性
        if (!changeData.taskId || !changeData.field) {
          console.warn('[单元格编辑] 无效的编辑数据')
          return
        }

        // 查找任务以检查类型
        const task = this.findTaskById(changeData.taskId)
        const updates = {
          [changeData.field]: changeData.newValue
        }

        // 如果是milestone类型任务，并且修改的是日期字段，需要同步另一个日期字段
        if (task && task.type === 'milestone') {
          if (changeData.field === 'startDate') {
            updates.endDate = changeData.newValue
            console.log('[Milestone同步] startDate修改，同步endDate:', changeData.newValue)
          } else if (changeData.field === 'endDate') {
            updates.startDate = changeData.newValue
            console.log('[Milestone同步] endDate修改，同步startDate:', changeData.newValue)
          }
        }

        // 检查是否是日期字段的变更
        const isDateChange = ['startDate', 'endDate'].includes(changeData.field)

        // 更新任务数据 - 包含日期验证
        this.$store.dispatch('updateGanttItem', {
          id: changeData.taskId,
          updates
        })

        // 如果是日期变更，检查是否需要级联更新
        if (isDateChange) {
          this.$nextTick(async () => {
            const updatedTask = this.findTaskById(changeData.taskId)
            await this.checkAndHandleCascadeUpdate(changeData.taskId, updatedTask.startDate, updatedTask.endDate)
          })
        }

        // 显示成功提示
        if (task && task.type === 'milestone' && (changeData.field === 'startDate' || changeData.field === 'endDate')) {
          this.$message.success('Milestone date updated (start and end dates synchronized)')
        } else {
          this.$message.success('Task updated successfully')
        }

        // 强制更新甘特图显示
        this.$nextTick(() => {
          this.$forceUpdate()
          if (this.$refs.ganttBars) {
            this.$refs.ganttBars.$forceUpdate()
          }
        })
      } catch (error) {
        console.error('[单元格编辑] 更新失败:', error)
        // 显示具体的错误信息
        this.$message.error(error.message || 'Task update failed')
      }
    },

    // 处理表格筛选变化
    handleTableFilterChange(filterData) {
      console.log('Table filter changed:', filterData)

      // 将筛选状态保存到store中 - 实现筛选联动
      this.$store.dispatch('setTableFilters', filterData.activeFilters)

      // 触发甘特图重新渲染以应用筛选
      this.$nextTick(() => {
        this.$forceUpdate()

        // 强制更新甘特图组件
        if (this.$refs.ganttBars) {
          this.$refs.ganttBars.$forceUpdate()
        }
        if (this.$refs.ganttChartGrid) {
          this.$refs.ganttChartGrid.$forceUpdate()
        }
      })

      // 显示筛选提示
      if (Object.keys(filterData.activeFilters).length > 0) {
        this.$message({
          message: `Filter applied to ${filterData.column}`,
          type: 'info',
          duration: 1500
        })
      } else {
        this.$message({
          message: 'All filters cleared',
          type: 'info',
          duration: 1500
        })
      }
    },

    // 查找任务的父任务
    findParentTask(taskId) {
      const findParent = (tasks, targetId) => {
        for (const task of tasks) {
          if (task.children) {
            for (const child of task.children) {
              if (child.id === targetId) {
                return task
              }
              // 递归查找子任务中的父任务
              const found = findParent(child.children || [], targetId)
              if (found) return found
            }
          }
        }
        return null
      }

      return findParent(this.ganttData, taskId)
    },

    // 处理添加子任务
    addChildTask(parentTask) {
      // 验证父任务类型是否可以添加子任务
      const parentType = parentTask.type || 'task'

      // 检查milestone类型不能有子任务
      if (parentType === 'milestone') {
        this.$message.error('Milestone类型不能添加子任务')
        return
      }

      // 设置弹框模式
      this.dialogMode = 'add'
      this.editingTaskId = null
      this.editingParentTask = parentTask

      // 重置表单并设置默认值
      this.resetTaskForm()
      this.newTask = {
        ...this.newTask,
        name: 'New Subtask',
        type: 'task',
        startDate: moment().format('YYYY-MM-DD'),
        endDate: moment().add(7, 'days').format('YYYY-MM-DD'),
        color: this.getRandomTaskColor()
      }

      // 显示弹框
      this.showAddDialog = true
    },

    // 处理添加同级任务
    addSiblingTask(task) {
      console.log('添加同级任务:', task)

      // 获取父任务
      const parentTask = this.findParentTask(task.id)

      // 检查父任务类型是否允许添加同级任务
      if (parentTask && parentTask.type === 'milestone') {
        this.$message.warning('Milestone类型下不能添加同级任务')
        return
      }

      // 设置对话框参数
      this.editDialogType = task.type || 'task' // 同级任务类型与当前任务相同
      this.editDialogMode = 'add-sibling'
      this.editingTask = task // 传入兄弟任务以便查找父任务
      this.parentTask = parentTask

      // 设置默认日期范围
      const today = moment().format('YYYY-MM-DD')
      this.editDialogForm = {
        startDate: today,
        endDate: this.editDialogType === 'milestone' ? today : moment().add(7, 'days').format('YYYY-MM-DD'),
        type: task.type || 'task',
        progress: 0,
        status: 'Not Started',
        assignee: '',
        title: '',
        description: '',
        parentId: parentTask ? parentTask.id : null
      }

      // 显示对话框
      this.editDialogVisible = true
    },



    // 处理视图模式变化
    handleViewModeChange(newMode) {
      console.log('[调试] handleViewModeChange 被调用，模式:', newMode)

      // 向父组件发送视图模式变化事件
      this.$emit('view-mode-change', newMode)

      // 如果没有手动设置日期范围，视图模式改变时可能需要重新计算日期范围
      if (!this.isManualDateRange) {
        this.$forceUpdate()
      }

      // 重新计算每天的宽度和总宽度
      this.$nextTick(() => {
        // 先更新容器宽度，确保后续计算正确
        this.updateRightAreaWidth()

        // 直接调用重绘方法
        this.handleResize()

        // 强制重新计算依赖线
        if (this.$refs.ganttBars) {
          this.$refs.ganttBars.clearDependencyCache()
          this.$refs.ganttBars.$forceUpdate()
        }

        // 再次更新宽度，确保所有计算都基于新的视图模式
        this.$nextTick(() => {
          this.updateRightAreaWidth()

          // 更新时间轴
          if (this.$refs.timeline) {
            this.$refs.timeline.$forceUpdate()
          }

          console.log('[视图模式切换] 已完成视图更新，当前模式:', newMode, '宽度:', this.rightAreaWidth)
        })
      })
    },

    // 跳转到今天
    jumpToToday() {
      this.$store.dispatch('jumpToToday')

      // 计算今天的位置并滚动到今天
      this.$nextTick(() => {
        const today = moment()

        // 如果今天不在当前日期范围内，先调整日期范围
        if (!today.isBetween(this.chartStartDate, this.chartEndDate, 'day', '[]')) {
          // 自动调整日期范围以包含今天
          const newStart = today.clone().subtract(15, 'days')
          const newEnd = today.clone().add(45, 'days')

          this.dateRange = [newStart.format('YYYY-MM-DD'), newEnd.format('YYYY-MM-DD')]

          // 等待日期范围更新后再滚动
          this.$nextTick(() => {
            setTimeout(() => {
              this.scrollToToday()
            }, 100) // 给一点时间让组件重新渲染
          })
        } else {
          this.scrollToToday()
        }

        // 显示成功提示
        this.$message({
          message: 'Jumped to today!',
          type: 'success',
          duration: 2000
        })
      })
    },

    // 滚动到今天的位置
    scrollToToday() {
      const today = moment()
      const daysDiff = today.diff(this.chartStartDate, 'days')
      const dayWidth = this.getDayWidth()
      const scrollLeft = daysDiff * dayWidth

      if (this.$refs.scrollContainer) {
        const container = this.$refs.scrollContainer
        // 滚动到今天位置，并居中显示
        const targetScrollLeft = Math.max(0, scrollLeft - container.clientWidth / 2)

        // 使用scrollTo进行平滑滚动
        container.scrollTo({
          left: targetScrollLeft,
          behavior: 'smooth'
        })

        // 如果浏览器不支持smooth，使用直接设置
        setTimeout(() => {
          if (container.scrollLeft !== targetScrollLeft) {
            container.scrollLeft = targetScrollLeft
          }
        }, 100)
      }
    },

    // 清除血缘关系高亮
    clearLineageHighlight() {
      this.$store.dispatch('clearLineageHighlight')
      this.$message({
        message: 'Highlight cleared',
        type: 'info',
        duration: 1500
      })
    },

    // 计算每日宽度 - 与其他组件保持一致
    getDayWidth() {
      // 确保容器宽度有效
      const availableWidth = Math.max(this.rightAreaWidth, 800)
      const totalDays = this.chartEndDate.diff(this.chartStartDate, 'days') + 1

      // 根据视图模式设置合适的单位宽度
      let baseWidth
      switch(this.effectiveViewMode) {
      case 'day':
        // 日视图：每天至少40px，最多80px
        baseWidth = Math.min(Math.max(availableWidth / totalDays, 40), 80)
        break
      case 'week':
        // 周视图：每天至少15px，最多30px
        baseWidth = Math.min(Math.max(availableWidth / totalDays, 15), 30)
        break
      case 'month':
        // 月视图：每天至少3px，最多20px
        baseWidth = Math.min(Math.max(availableWidth / totalDays, 3), 20)
        break
      case 'quarter':
        // 季度视图：每天至少2px，最多10px
        baseWidth = Math.min(Math.max(availableWidth / totalDays, 2), 10)
        break
      case 'year':
        // 年视图：确保撑满屏幕，提高最小宽度，与时间轴保持一致
        baseWidth = Math.max(availableWidth / totalDays, 3)
        break
      default:
        baseWidth = Math.max(availableWidth / totalDays, 3)
      }

      // console.log(`[天宽度计算] 视图模式: ${this.effectiveViewMode}, 可用宽度: ${availableWidth}px, 总天数: ${totalDays}, 每天宽度: ${baseWidth}px`)
      return baseWidth
    },

    // 处理任务点击（血缘关系高亮）
    handleTaskClick(taskId) {
      this.$store.dispatch('setLineageHighlight', taskId)
    },

    // 初始化性能监控
    initPerformanceMonitoring() {
      if (!this.performanceMonitorEnabled) return

      // 开始帧率监控
      this.startFrameRateMonitoring()

      // 定期检查性能
      this.performanceCheckTimer = setInterval(() => {
        this.checkPerformanceAndOptimize()
      }, this.autoOptimizeConfig.performanceCheckInterval)
    },

    // 清理性能监控
    cleanupPerformanceMonitoring() {
      if (this.performanceCheckTimer) {
        clearInterval(this.performanceCheckTimer)
      }
      if (this.frameRateAnimationId) {
        cancelAnimationFrame(this.frameRateAnimationId)
      }
    },

    // 开始帧率监控
    startFrameRateMonitoring() {
      let frameCount = 0
      let lastTime = performance.now()

      const countFrames = (currentTime) => {
        frameCount++

        if (currentTime - lastTime >= 1000) {
          this.performanceMetrics.frameCount = frameCount
          frameCount = 0
          lastTime = currentTime
        }

        this.frameRateAnimationId = requestAnimationFrame(countFrames)
      }

      this.frameRateAnimationId = requestAnimationFrame(countFrames)
    },

    // 检查自动优化
    checkAutoOptimization() {
      // 根据任务数量自动启用虚拟滚动
      if (this.flattenTasks.length > this.autoOptimizeConfig.maxTasksBeforeVirtual) {
        this.useVirtualScrolling = true
        this.$message({
          message: `Virtual scrolling auto-enabled for ${this.flattenTasks.length} tasks`,
          type: 'info',
          duration: 3000
        })
      }
    },

    // 开始性能监控
    startPerformanceMonitoring() {
      if (this.performanceTimer) {
        clearInterval(this.performanceTimer)
      }

      this.performanceTimer = setInterval(() => {
        this.checkPerformanceAndOptimize()
      }, this.autoOptimizeConfig.performanceCheckInterval)
    },

    // 停止性能监控
    stopPerformanceMonitoring() {
      if (this.performanceTimer) {
        clearInterval(this.performanceTimer)
        this.performanceTimer = null
      }
    },

    // 性能检查和优化
    checkPerformanceAndOptimize() {
      if (!this.autoOptimizeConfig.enabled) return

      const avgRenderTime = this.performanceMetrics.averageRenderTime
      const taskCount = this.flattenTasks.length

      // 如果渲染时间过长，自动启用虚拟滚动
      if (avgRenderTime > this.autoOptimizeConfig.maxRenderTime && !this.useVirtualScrolling) {
        this.useVirtualScrolling = true

        this.$message({
          message: `Virtual scrolling auto-enabled due to slow rendering (${Math.round(avgRenderTime)}ms avg)`,
          type: 'warning',
          duration: 4000
        })
      }
    },

    // 记录渲染时间
    recordRenderTime() {
      if (this.renderStartTime > 0) {
        const renderTime = performance.now() - this.renderStartTime
        this.currentRenderTime = Math.round(renderTime)

        // 更新平均渲染时间
        this.performanceMetrics.renderTimes.push(renderTime)
        if (this.performanceMetrics.renderTimes.length > 20) {
          this.performanceMetrics.renderTimes.shift()
        }

        this.performanceMetrics.averageRenderTime =
          this.performanceMetrics.renderTimes.reduce((a, b) => a + b, 0) /
          this.performanceMetrics.renderTimes.length
      }
    },

    // 开始渲染计时
    startRenderTiming() {
      this.renderStartTime = performance.now()
    },

    // 处理虚拟表格排序
    handleVirtualTableSort(sortInfo) {
      // 实现排序逻辑
      const { column, direction } = sortInfo

      this.flatTableData.sort((a, b) => {
        let aVal = this.getColumnValue(a, column)
        let bVal = this.getColumnValue(b, column)

        // 处理不同数据类型的排序
        if (column.includes('Date')) {
          aVal = new Date(aVal).getTime()
          bVal = new Date(bVal).getTime()
        } else if (typeof aVal === 'string') {
          aVal = aVal.toLowerCase()
          bVal = bVal.toLowerCase()
        }

        if (direction === 'asc') {
          return aVal > bVal ? 1 : -1
        } else {
          return aVal < bVal ? 1 : -1
        }
      })
    },

    // 获取列值（用于排序）
    getColumnValue(item, key) {
      return key.split('.').reduce((obj, k) => obj && obj[k], item)
    },

    // 处理性能监控自动优化切换
    handleAutoOptimizeToggle(enabled) {
      this.autoOptimizeConfig.enabled = enabled

      if (enabled) {
        this.checkAutoOptimization()
        this.startPerformanceMonitoring()
        this.$message({
          message: `Auto Optimization enabled. Monitoring ${this.flattenTasks.length} tasks for performance.`,
          type: 'success',
          duration: 3000
        })
      } else {
        this.stopPerformanceMonitoring()
        this.$message({
          message: 'Auto Optimization disabled',
          type: 'info',
          duration: 2000
        })
      }
    },

    // 切换虚拟滚动
    toggleVirtualScrolling() {
      this.useVirtualScrolling = !this.useVirtualScrolling

      this.$message({
        message: `Virtual scrolling ${this.useVirtualScrolling ? 'enabled' : 'disabled'}`,
        type: 'success',
        duration: 2000
      })
    },

    // 切换性能监控
    togglePerformanceMonitor() {
      this.performanceMonitorEnabled = !this.performanceMonitorEnabled
    },

    // 导出性能数据
    exportPerformanceData() {
      const data = {
        timestamp: new Date().toISOString(),
        taskCount: this.flattenTasks.length,
        visibleTaskCount: this.visibleTaskCount,
        renderTime: this.currentRenderTime,
        metrics: this.performanceMetrics,
        config: {
          virtualScrolling: this.useVirtualScrolling,
          autoOptimize: this.autoOptimizeConfig
        }
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `gantt-performance-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
    },

    // 优化大数据渲染
    optimizeForLargeData() {
      const taskCount = this.flattenTasks.length

      if (taskCount > 1000) {
        // 启用虚拟滚动
        this.useVirtualScrolling = true

        // 调整缓冲区大小
        this.virtualScrollConfig.bufferSize = Math.min(10, Math.ceil(taskCount / 100))

        // 降低更新频率
        this.performanceCheckInterval = 10000

        // 大数据集优化完成
      }
    },

    // 重置性能优化设置
    resetPerformanceSettings() {
      this.useVirtualScrolling = false
      this.autoOptimizeConfig.enabled = false
      this.performanceMetrics = {
        frameCount: 0,
        lastFrameTime: 0,
        averageRenderTime: 0,
        renderTimes: []
      }

      this.$message({
        message: 'Performance settings reset to default',
        type: 'info',
        duration: 2000
      })
    },

    // 更新表格高度
    updateTableHeight() {
      if (this.$refs.customTable && this.$refs.customTable.updateTableHeight) {
        this.$refs.customTable.updateTableHeight()
      }
    },

    // 生成测试数据
    async generateTestData(command) {
      try {
        if (command === 'clear') {
          this.$store.commit('SET_GANTT_DATA', [])
          this.$store.commit('SET_COLLAPSED_TASKS', []) // 清空折叠，全部展开
          this.$message.success('All data cleared!')
          this.$nextTick(() => {
            this.updateRightAreaWidth()
            this.$forceUpdate()
          })
          return
        }

        const count = parseInt(command)
        this.$message.info(`Generating ${count} tasks...`)

        const result = await this.$store.dispatch('generateLargeDataset', count)

        // 如果生成的任务数量超过阈值，自动启用虚拟滚动
        if (count >= 500) {
          this.useVirtualScrolling = true
          this.$store.commit('SET_COLLAPSED_TASKS', []) // 清空折叠，全部展开
          this.$message.success(`Generated ${result.totalTasks} tasks! Virtual scrolling enabled automatically.`)
        } else {
          this.$store.commit('SET_COLLAPSED_TASKS', []) // 清空折叠，全部展开
          this.$message.success(`Generated ${result.totalTasks} tasks!`)
        }

        // 测试数据生成完成
        this.$nextTick(() => {
          this.updateRightAreaWidth()
          this.$forceUpdate()
        })
        this.autoRangeDebounced()
      } catch (error) {
        this.$message.error('Failed to generate test data')
      }
    },

    // 处理任务聚焦
    handleFocusTask(task) {

      // 高亮任务
      this.highlightedRowId = task.id

      // 滚动到任务位置（在表格中）
      this.$nextTick(() => {
        // 如果使用虚拟滚动
        if (this.shouldUseVirtualScrolling && this.$refs.virtualTable) {
          const taskIndex = this.flatTableDataForVirtual.findIndex(item => item.id === task.id)
          if (taskIndex >= 0) {
            const scrollTop = taskIndex * this.virtualScrollConfig.itemHeight
            if (this.$refs.virtualTable.scrollToPosition) {
              this.$refs.virtualTable.scrollToPosition(scrollTop)
            }
          }
        }
        // 如果使用普通表格
        else if (this.$refs.customTable) {
          const taskIndex = this.flatTableData.findIndex(item => item.id === task.id)
          if (taskIndex >= 0) {
            // 检查scrollToRow方法是否存在
            if (typeof this.$refs.customTable.scrollToRow === 'function') {
              this.$refs.customTable.scrollToRow(taskIndex)
            } else {
              // 如果方法不存在，使用基础的scrollTo方法
              const rowTop = taskIndex * 28 // 每行28px高度
              if (typeof this.$refs.customTable.scrollTo === 'function') {
                this.$refs.customTable.scrollTo(rowTop)
              }
            }
          }
        }
      })

      // 触发高亮效果
      this.handleTaskHighlight(task.id)
    },

    // 初始化日期范围
    initializeDateRange() {
      // 基于现有任务数据计算合适的日期范围
      if (!this.flattenTasks || this.flattenTasks.length === 0) {
        // 如果没有任务，设置默认日期范围（从今天开始的3个月）
        const today = moment()
        const startDate = today.clone().subtract(1, 'month')
        const endDate = today.clone().add(2, 'months')

        this.dateRange = [
          startDate.format('YYYY-MM-DD'),
          endDate.format('YYYY-MM-DD')
        ]

        return
      }

      // 找到所有任务的最早和最晚日期
      let minDate = null
      let maxDate = null

      this.flattenTasks.forEach(task => {
        // 检查开始日期
        if (task.startDate) {
          const startDate = moment(task.startDate)
          if (!minDate || startDate.isBefore(minDate)) {
            minDate = startDate
          }
        }

        // 检查结束日期
        if (task.endDate) {
          const endDate = moment(task.endDate)
          if (!maxDate || endDate.isAfter(maxDate)) {
            maxDate = endDate
          }
        }

        // 检查计划日期
        if (task.planStartDate) {
          const planStartDate = moment(task.planStartDate)
          if (!minDate || planStartDate.isBefore(minDate)) {
            minDate = planStartDate
          }
        }

        if (task.planEndDate) {
          const planEndDate = moment(task.planEndDate)
          if (!maxDate || planEndDate.isAfter(maxDate)) {
            maxDate = planEndDate
          }
        }
      })

      // 如果没有找到有效日期，使用默认范围
      if (!minDate || !maxDate) {
        const today = moment()
        minDate = today.clone().subtract(1, 'month')
        maxDate = today.clone().add(2, 'months')
      }

      // 添加缓冲时间，让视图更宽松
      const timeSpan = maxDate.diff(minDate, 'days')
      const bufferDays = 15 // 默认缓冲15天

      // 根据项目时间跨度和视图模式调整缓冲时间，确保最早任务靠左显示
      let leftBufferDays = 3  // 左侧缓冲很小，确保最早任务靠左
      let rightBufferDays = 15 // 右侧缓冲正常

      if (this.currentViewMode === 'year') {
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

      const adjustedStartDate = minDate.clone().subtract(leftBufferDays, 'days')
      const adjustedEndDate = maxDate.clone().add(rightBufferDays, 'days')

      // 设置计算出的日期范围
      this.dateRange = [
        adjustedStartDate.format('YYYY-MM-DD'),
        adjustedEndDate.format('YYYY-MM-DD')
      ]

      // 根据时间跨度自动设置合适的视图模式
      const totalDays = adjustedEndDate.diff(adjustedStartDate, 'days')
      const months = adjustedEndDate.diff(adjustedStartDate, 'months')
      const years = adjustedEndDate.diff(adjustedStartDate, 'years')

      // 先设置日期范围，再设置视图模式
      this.$nextTick(() => {
        if (years >= 2) {
          this.$emit('update:currentViewMode', 'year')
        } else if (months >= 12) {
          this.$emit('update:currentViewMode', 'quarter')
        } else if (months >= 6) {
          this.$emit('update:currentViewMode', 'month')
        } else if (totalDays > 60) {
          this.$emit('update:currentViewMode', 'month')
        } else {
          this.$emit('update:currentViewMode', 'day')
        }
      })

      // 显示友好的提示信息
      this.$message({
        message: `Date range auto-set: ${adjustedStartDate.format('MMM DD')} ~ ${adjustedEndDate.format('MMM DD, YYYY')} (${this.flattenTasks.length} tasks)`,
        type: 'success',
        duration: 2000
      })
      this.$nextTick(() => {
        // 强制刷新 dateRange 绑定，确保 el-date-picker 选择框能动态更新
        this.dateRange = [...this.dateRange]
      })
    },
    updateLeftPanelHeight() {
      this.$nextTick(() => {
        // 确保ganttMain容器已正确渲染
        if (this.$refs.ganttMain && this.$refs.ganttMain.clientHeight > 0) {
          const left = this.$refs.ganttMain.querySelector('.gantt-left')
          if (left && left.clientHeight > 0) {
            // 使用与tableHeight相同的计算逻辑，确保一致性
            const mainHeight = this.$refs.ganttMain.clientHeight
            const headerHeight = 64
            this.leftPanelHeight = Math.max(mainHeight - headerHeight, 400)
          }
        }
      })
    },
    autoRangeDebounced: debounce(function() {
      this.initializeDateRange()
      this.$nextTick(() => {
        // 强制刷新 dateRange 绑定，确保 el-date-picker 选择框能动态更新
        this.dateRange = [...this.dateRange]
      })
    }, 200),

    // Timeline 相关方法
    handleMilestoneSelected(milestone) {
      // 跳转到里程碑日期的逻辑
      if (milestone.startDate) {
        const milestoneDate = moment(milestone.startDate)
        // 这里可以添加滚动到对应日期的逻辑
        this.$message({
          message: `Milestone selected: ${milestone.name}`,
          type: 'info',
          duration: 2000
        })
      }
    },

    handleTimelineHidden() {
      // 时间轴概览被隐藏的处理逻辑
      this.$emit('timeline-hidden')
    },

    // 增强Today按钮功能，同时控制timeline
    jumpToTodayEnhanced() {
      // 调用原有的jumpToToday方法
      this.jumpToToday()

      // 同时让timeline也跳转到今天
      if (this.$refs.ganttOverviewTimeline) {
        this.$refs.ganttOverviewTimeline.scrollToToday()
      }
    },

    // 切换连接线灰色模式
    toggleGrayConnectionMode() {
      this.$store.dispatch('toggleGrayConnectionMode')
      this.$message({
        message: `连接线已切换为${this.grayConnectionMode ? '彩色' : '灰色'}模式`,
        type: 'info',
        duration: 2000
      })
    },

    // === 工具栏相关事件处理方法 ===

    // 处理显示添加任务弹框
    handleShowAddDialog(type = 'task') {
      // 设置对话框参数
      this.editDialogType = type
      this.editDialogMode = 'add'
      this.editingTask = null
      this.parentTask = null

      // 如果是milestone类型，设置相同的开始和结束日期
      if (type === 'milestone') {
        const today = moment().format('YYYY-MM-DD')
        this.editDialogForm = {
          startDate: today,
          endDate: today
        }
      } else {
        this.editDialogForm = {}
      }

      this.editDialogVisible = true
    },

    // 处理对话框关闭
    handleEditDialogClose() {
      this.editDialogVisible = false
      this.editingTask = null
      this.parentTask = null
    },

    // 处理任务更新
    async handleTaskUpdated(updatedTask) {
      try {
        console.log('更新任务数据:', updatedTask)

        // 确保更新所有必要字段，特别是状态字段
        const updates = {
          ...updatedTask,
          name: updatedTask.title,  // 同时更新 name 字段
          title: updatedTask.title,
          status: updatedTask.status || 'Not Started',  // 确保状态字段有值
          progress: updatedTask.progress || 0,
          startDate: updatedTask.startDate,
          endDate: updatedTask.endDate,
          assignee: updatedTask.assignee,
          links: updatedTask.links || [],
          parentId: updatedTask.parentId,
          childrenTasks: updatedTask.childrenTasks || []
        }

        console.log('准备更新的数据:', updates)

        // 更新任务数据
        await this.$store.dispatch('updateGanttItem', {
          id: updatedTask.id,
          updates,
          isParentNode: updatedTask.childrenTasks && updatedTask.childrenTasks.length > 0,
          linkParentChildDates: this.$store.state.linkParentChildDates
        })

        // 更新表格数据
        this.refreshTableData()

        // 更新甘特图视图
        this.$nextTick(() => {
          // 强制刷新视图
          this.$forceUpdate()

          // 更新右侧区域宽度
          this.updateRightAreaWidth()

          // 刷新时间轴
          this.timelineRefreshKey++

          // 刷新甘特图
          this.refreshChart()
        })

        this.$message.success('Task updated successfully!')
      } catch (error) {
        console.error('更新任务失败:', error)
        this.$message.error('Update failed, please try again')
      }
    },

    // 处理任务添加
    async handleTaskAdded(taskData) {
      try {
        // 生成任务ID
        const taskId = this.generateUniqueTaskId()

        // 构建完整的任务数据
        const newTask = {
          id: taskId,
          name: taskData.title,
          title: taskData.title,
          type: taskData.type,
          startDate: taskData.startDate,
          endDate: taskData.endDate,
          progress: taskData.progress || 0,
          status: taskData.status || 'Not Started',
          assignee: taskData.assignee || '',
          links: taskData.links || [],
          children: [],
          parentId: taskData.parentId,
          collapsed: false
        }

        // 根据不同模式处理任务添加
        if (taskData.mode === 'add-child') {
          // 添加子任务
          await this.$store.dispatch('addNewTask', {
            task: newTask,
            parentId: taskData.parentId,
            mode: 'add-child'
          })
        } else if (taskData.mode === 'add-sibling') {
          // 添加同级任务
          await this.$store.dispatch('addNewTask', {
            task: newTask,
            parentId: taskData.parentId,
            mode: 'add-sibling'
          })
        } else {
          // 普通添加
          await this.$store.dispatch('addNewTask', {
            task: newTask,
            parentId: taskData.parentId,
            mode: 'add'
          })
        }

        // 更新 localStorage
        const ganttData = JSON.parse(localStorage.getItem('ganttData') || '[]')
        ganttData.push(newTask)
        localStorage.setItem('ganttData', JSON.stringify(ganttData))

        // 刷新视图
        await this.refreshTableData()
        await this.refreshChart()

        // 滚动到新添加的任务
        this.$nextTick(() => {
          this.scrollToTask(newTask.id)
        })

        // 显示成功消息
        this.$message.success('任务添加成功')

        // 关闭对话框
        this.editDialogVisible = false
      } catch (error) {
        console.error('添加任务失败:', error)
        this.$message.error('添加任务失败，请重试')
      }
    },

    // 处理编辑对话框关闭
    handleEditDialogClose() {
      this.editDialogVisible = false
      this.editingTask = null
      this.parentTask = null
      this.editDialogForm = {}
    },

    // 处理批量删除
    handleBatchDelete() {
      const selectedIds = this.selectedTasks
      if (selectedIds.length === 0) return

      // 批量删除选中的任务
      selectedIds.forEach(taskId => {
        this.$store.dispatch('deleteTask', parseInt(taskId))
      })

      this.$message.success(`${selectedIds.length} tasks have been deleted`)
    },

    // 处理展开所有任务
    handleExpandAll() {
      // 确保collapsedTasks是数组
      const currentCollapsed = Array.isArray(this.collapsedTasks) ? this.collapsedTasks : []
      const expandTasks = []

      // 遍历所有任务，收集有子任务的任务ID并设置为展开状态
      const collectExpandableTasks = (tasks) => {
        if (!Array.isArray(tasks)) return

        tasks.forEach(task => {
          if (task && task.children && Array.isArray(task.children) && task.children.length > 0) {
            // 从collapsedTasks中移除该任务ID，即设置为展开状态
            const index = currentCollapsed.indexOf(task.id)
            if (index > -1) {
              expandTasks.push(task.id)
            }
            collectExpandableTasks(task.children)
          }
        })
      }

      collectExpandableTasks(this.ganttData)

      // 批量移除collapsed状态
      const newCollapsedTasks = currentCollapsed.filter(id => !expandTasks.includes(id))
      this.$store.commit('SET_COLLAPSED_TASKS', newCollapsedTasks)
      this.$message.success('All tasks have been expanded')
    },

    // 处理收起所有任务
    handleCollapseAll() {
      const collapseTasks = []

      // 遍历所有任务，收集有子任务的任务ID并设置为收起状态
      const collectCollapsableTasks = (tasks) => {
        if (!Array.isArray(tasks)) return

        tasks.forEach(task => {
          if (task && task.children && Array.isArray(task.children) && task.children.length > 0) {
            collapseTasks.push(task.id)
            collectCollapsableTasks(task.children)
          }
        })
      }

      collectCollapsableTasks(this.ganttData)

      // 设置所有可收起任务为collapsed状态
      this.$store.commit('SET_COLLAPSED_TASKS', collapseTasks)
      this.$message.success('All tasks have been collapsed')
    },

    // 处理切换关键路径显示
    handleToggleCriticalPath() {
      this.ganttDisplayConfig.showCriticalPath = !this.ganttDisplayConfig.showCriticalPath
      this.$message.success(
        `Critical path ${this.ganttDisplayConfig.showCriticalPath ? 'enabled' : 'disabled'}`
      )
    },

    // 显示列配置对话框
    showColumnConfigDialog() {
      this.showColumnDialog = true
    },

    // 处理日期范围变化
    handleDateRangeChange(dateRange) {
      if (dateRange && dateRange.length === 2) {
        this.dateRange = [...dateRange]
        this.$nextTick(() => {
          // 触发甘特图重新渲染
          this.refreshChart()
        })
      }
    },

    // 处理视图模式变化
    handleViewModeChange(mode) {
      this.$store.dispatch('setViewMode', mode)
      this.$emit('view-mode-change', mode)
      this.$message.success(`View mode changed to ${mode}`)
    },

    // 处理跳转到今天
    handleJumpToToday() {
      this.$store.dispatch('jumpToToday')
      this.jumpToTodayEnhanced()
      this.$message.success('Jumped to today')
    },

    // 处理季度变化
    handleQuarterChange(quarter) {
      // 根据季度设置日期范围
      const year = parseInt(quarter)
      const startDate = moment().year(year).quarter(1).startOf('quarter')
      const endDate = moment().year(year).quarter(4).endOf('quarter')

      this.dateRange = [
        startDate.format('YYYY-MM-DD'),
        endDate.format('YYYY-MM-DD')
      ]

      this.$message.success(`Date range set to ${year}`)
    },

    // 处理数据导入
    handleImportData(data) {
      try {
        // 验证数据格式
        if (Array.isArray(data)) {
          this.$store.commit('SET_GANTT_DATA', data)
          this.$message.success('Data imported successfully')

          // 重新初始化日期范围
          this.$nextTick(() => {
            this.initializeDateRange()
          })
        } else {
          throw new Error('Invalid data format')
        }
      } catch (error) {
        this.$message.error('Import failed: Invalid data format')
      }
    },

    // 处理清空所有数据
    handleClearAllData() {
      this.$store.commit('SET_GANTT_DATA', [])
      this.$message.success('All data has been cleared')
    },

    // 处理全量保存
    handleSaveData() {
      try {
        // 获取完整的甘特图数据
        const {ganttData} = this.$store.state
        const {dependencies} = this.$store.state
        const {columnConfig} = this.$store.state

        // 构建保存数据对象
        const saveData = {
          timestamp: new Date().toISOString(),
          version: '1.0',
          ganttData,
          dependencies: dependencies || [],
          columnConfig: columnConfig || [],
          totalTasks: this.flattenTasks.length,
          metadata: {
            chartStartDate: this.chartStartDate,
            chartEndDate: this.chartEndDate,
            viewMode: this.currentViewMode
          }
        }

        // 保存到本地存储
        localStorage.setItem('gantt-chart-data', JSON.stringify(saveData))

        // 同时导出为文件
        const dataStr = JSON.stringify(saveData, null, 2)
        const dataBlob = new Blob([dataStr], { type: 'application/json' })
        const url = URL.createObjectURL(dataBlob)
        const link = document.createElement('a')
        link.href = url
        link.download = `gantt-data-${moment().format('YYYY-MM-DD_HH-mm-ss')}.json`
        link.click()
        URL.revokeObjectURL(url)

        // 显示成功消息
        this.$message.success(`Successfully saved ${this.flattenTasks.length} tasks to file and local storage`)

        console.log('[全量保存] 数据保存成功:', {
          任务数量: this.flattenTasks.length,
          依赖关系数量: dependencies?.length || 0,
          列配置数量: columnConfig?.length || 0,
          保存时间: saveData.timestamp
        })
      } catch (error) {
        console.error('[全量保存] 保存失败:', error)
        this.$message.error(`Save failed: ${  error.message}`)
      }
    },

    // 刷新甘特图
    async refreshChart(event) {
      console.log('[GanttChart] 开始刷新甘特图', event)

      try {
        // 1. 重新初始化依赖约束引擎
        await this.$store.dispatch('initDependencyEngine')

        // 2. 等待依赖约束引擎初始化完成
        await this.$nextTick()

        // 3. 清除GanttBars组件的缓存
        if (this.$refs.ganttBars) {
          this.$refs.ganttBars.clearDependencyCache()
        }

        // 4. 等待缓存清除完成
        await this.$nextTick()

        // 5. 更新右侧区域宽度
        this.updateRightAreaWidth()

        // 6. 等待宽度更新完成
        await this.$nextTick()

        // 7. 强制更新所有组件
        if (this.$refs.ganttBars) {
          this.$refs.ganttBars.$forceUpdate()
        }
        this.$forceUpdate()

        // 8. 等待组件更新完成
        await this.$nextTick()

        // 9. 触发重新布局
        window.dispatchEvent(new Event('resize'))

        // 10. 通知父组件刷新完成
        this.$emit('refresh-complete', event)

        console.log('[GanttChart] 刷新完成')
      } catch (error) {
        console.error('[GanttChart] 刷新失败:', error)
        throw error
      }
    },

    // 生成唯一任务ID
    generateUniqueTaskId() {
      let id
      const existingIds = this.getAllTaskIds()
      do {
        // 使用时间戳 + 随机数 + 递增计数器确保唯一性
        id = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      } while (existingIds.includes(id))

      return id
    },

    // 获取所有现有任务ID
    getAllTaskIds() {
      const ids = []
      const collectIds = (tasks) => {
        tasks.forEach(task => {
          ids.push(task.id)
          if (task.children && task.children.length > 0) {
            collectIds(task.children)
          }
        })
      }
      collectIds(this.ganttData)
      return ids
    },

    // 获取随机任务颜色
    getRandomTaskColor() {
      const colors = ['#3498db', '#2ecc71', '#f39c12', '#e74c3c', '#9b59b6', '#1abc9c', '#34495e', '#e67e22']
      return colors[Math.floor(Math.random() * colors.length)]
    },

    // 检查并处理级联更新
    async checkAndHandleCascadeUpdate(taskId, newStartDate, newEndDate) {
      try {
        console.log(`[级联更新] 开始检查任务 ${taskId} 的级联更新需求`)
        console.log(`[级联更新] 新时间范围: ${newStartDate} ~ ${newEndDate}`)

        // 动态导入依赖约束引擎
        const { DependencyConstraintEngine } = await import('@/services/dependencyConstraints')

        // 获取当前所有任务和依赖关系
        const allTasks = this.$store.getters.allTasks || []
        const dependencies = this.$store.state.dependencies || []

        console.log(`[级联更新] 找到 ${allTasks.length} 个任务, ${dependencies.length} 个依赖关系`)
        console.log('[级联更新] 依赖关系数据:', dependencies)

        // 确保taskId类型与依赖关系中的ID类型一致
        const normalizedTaskId = typeof taskId === 'string' ? parseInt(taskId) : taskId
        console.log(`[级联更新] 原任务ID: ${taskId} (${typeof taskId}), 标准化后: ${normalizedTaskId} (${typeof normalizedTaskId})`)

        // 创建依赖约束引擎实例
        const constraintEngine = new DependencyConstraintEngine(allTasks, dependencies)

        // 检查是否需要级联更新
        if (!constraintEngine.checkNeedsCascadeUpdate(normalizedTaskId)) {
          console.log('[级联更新] 任务无后续依赖，无需级联更新')
          return
        }

        console.log('[级联更新] 任务有后续依赖，继续检查受影响的任务')

        // 获取受影响的任务列表
        const affectedTasks = constraintEngine.getAffectedTasksPreview(normalizedTaskId, newStartDate, newEndDate)

        if (affectedTasks.length === 0) {
          console.log('[级联更新] 无任务受到影响，无需级联更新')
          return
        }

        console.log(`[级联更新] 发现 ${affectedTasks.length} 个任务受影响`, affectedTasks)

        // 弹出确认框
        await this.showCascadeUpdateConfirmDialog(affectedTasks)

      } catch (error) {
        console.error('[级联更新] 检查失败:', error)
        console.error('[级联更新] 错误堆栈:', error.stack)
        this.$message.warning('级联更新检查失败，请手动检查相关任务的时间安排')
      }
    },

    // 显示级联更新确认弹框
    async showCascadeUpdateConfirmDialog(affectedTasks) {
      // 构建受影响任务的描述文本
      const taskDescriptions = affectedTasks.map(task => {
        const currentRange = `${task.currentStart} ~ ${task.currentEnd}`
        const newRange = `${task.newStart} ~ ${task.newEnd}`
        return `• ${task.taskName}: ${currentRange} → ${newRange} (${task.dependencyType} ${task.lag > 0 ? '+' : ''}${task.lag}d)`
      }).join('\n')

      const message = `检测到以下 ${affectedTasks.length} 个任务需要根据依赖关系更新时间：\n\n${taskDescriptions}\n\n是否立即更新这些任务的时间安排？`

      try {
        await this.$confirm(message, '级联更新确认', {
          confirmButtonText: '立即更新',
          cancelButtonText: '取消',
          type: 'warning',
          customClass: 'cascade-update-confirm-dialog',
          beforeClose: (action, instance, done) => {
            if (action === 'confirm') {
              this.executeCascadeUpdate(affectedTasks)
                .then(() => {
                  done()
                })
                .catch((error) => {
                  console.error('[级联更新] 执行失败:', error)
                  this.$message.error(`级联更新执行失败：${  error.message}`)
                  done()
                })
            } else {
              // 取消时恢复原始位置
              affectedTasks.forEach(task => {
                this.$store.commit('UPDATE_GANTT_ITEM', {
                  id: task.taskId,
                  updates: {
                    startDate: task.currentStart,
                    endDate: task.currentEnd
                  }
                })
              })
              done()
            }
          }
        })
      } catch (error) {
        if (error === 'cancel') {
          console.log('[级联更新] 用户取消了级联更新')
          this.$message.info('已取消级联更新')
        } else {
          console.error('[级联更新] 确认弹框异常:', error)
        }
      }
    },

    // 处理拖拽级联更新检查
    handleDragCascadeUpdateCheck(payload) {
      console.log('[拖拽级联更新] 收到拖拽结束检查请求:', payload)

      // 使用统一的任务时间变更处理
      this.$store.dispatch('handleTaskTimeChange', {
        taskId: payload.taskId,
        newStartDate: payload.newStartDate,
        newEndDate: payload.newEndDate,
        source: 'drag-end'
      })
    },

    // 执行级联更新
    async executeCascadeUpdate(affectedTasks) {
      let loadingInstance = null
      try {
        loadingInstance = this.$loading({
          lock: true,
          text: '正在执行级联更新...',
          background: 'rgba(0, 0, 0, 0.7)'
        })

        // 调用store的批量更新action
        const updateResults = await this.$store.dispatch('batchUpdateTasks', {
          updates: affectedTasks,
          reason: 'Dependency cascade update'
        })

        // 统计更新结果
        const successCount = updateResults.filter(r => r.success).length
        const failureCount = updateResults.filter(r => !r.success).length

        // 显示结果提示
        if (failureCount === 0) {
          this.$message.success(`级联更新完成！成功更新了 ${successCount} 个任务的时间安排`)
        } else {
          this.$message.warning(`级联更新部分完成：成功 ${successCount} 个，失败 ${failureCount} 个任务`)

          // 显示失败的任务详情
          const failedTasks = updateResults.filter(r => !r.success)
          console.warn('[级联更新] 失败的任务:', failedTasks)
        }

        // 强制刷新甘特图
        this.$nextTick(() => {
          this.$forceUpdate()
          if (this.$refs.ganttBars) {
            this.$refs.ganttBars.$forceUpdate()
          }
          if (this.$refs.ganttChartGrid) {
            this.$refs.ganttChartGrid.$forceUpdate()
          }
        })

        this.autoRangeDebounced() // 更新后自动调整视图范围

      } catch (error) {
        console.error('[级联更新] 执行失败:', error)
        this.$message.error(`级联更新执行失败：${  error.message}`)
        throw error
      } finally {
        if (loadingInstance) {
          loadingInstance.close()
        }
      }
    },
    applyUpdates(updates) {
      updates.forEach(update => {
        const task = this.tasks.find(t => t.id === update.taskId)
        if (task) {
          task.startDate = update.newStart
          task.endDate = update.newEnd
          // 触发任务更新事件或其他必要的操作
          this.$emit('task-updated', task)
        }
      })
    },
    async addTask(task) {
      try {
        // 验证任务数据
        if (!task.name || !task.startDate || !task.endDate) {
          throw new Error('任务信息不完整')
        }

        // 格式化日期
        const formattedTask = {
          ...task,
          startDate: moment(task.startDate).format('YYYY-MM-DD HH:mm:ss'),
          endDate: moment(task.endDate).format('YYYY-MM-DD HH:mm:ss')
        }

        // 添加任务
        await this.$store.dispatch('addTask', formattedTask)

        // 刷新图表
        this.refreshChart()

        return true
      } catch (error) {
        console.error('添加任务失败:', error)
        throw error
      }
    },

    // 处理任务更新事件
    async handleTaskUpdated(updatedTask) {
      try {
        // 更新任务数据
        await this.$store.dispatch('updateGanttItem', {
          id: updatedTask.id,
          updates: updatedTask,
          isParentNode: updatedTask.childrenTasks && updatedTask.childrenTasks.length > 0,
          linkParentChildDates: this.$store.state.linkParentChildDates
        })

        // 更新甘特图视图
        this.$nextTick(() => {
          // 强制刷新视图
          this.$forceUpdate()

          // 更新右侧区域宽度
          this.updateRightAreaWidth()
          // 刷新时间轴
          this.timelineRefreshKey++
        })

        this.$message.success('任务更新成功！')
      } catch (error) {
        console.error('更新任务失败:', error)
        this.$message.error('更新失败，请重试')
      }
    },

    // 处理任务添加
    handleTaskAdded(newTask) {
      // 更新表格数据
      this.refreshTableData()

      // 更新甘特图视图
      this.$nextTick(() => {
        this.refreshChart()

        // 滚动到新添加的任务
        this.scrollToTask(newTask.id)
      })
    },

    // 滚动到指定任务
    scrollToTask(taskId) {
      const taskElement = document.querySelector(`[data-task-id="${taskId}"]`)
      if (taskElement) {
        taskElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    },

    // 显示编辑任务对话框
    handleShowEditDialog(task) {
      this.editDialogType = task.type || 'task'
      this.editDialogMode = 'edit'
      this.editingTask = {
        ...task,
        childrenTasks: this.findChildrenTasks(task.id)
      }
      this.parentTask = this.findParentTask(task.parentId)
      this.editDialogVisible = true
    },

    // 显示添加子任务对话框
    handleShowAddChildDialog(task) {
      console.log('显示添加子任务对话框:', task)
      if (!task) return

      // 检查父任务类型是否允许添加子任务
      if (task.type === 'milestone') {
        this.$message.warning('Milestone类型不能添加子任务')
        return
      }

      // 设置对话框参数
      this.editDialogType = 'task' // 子任务只能是task类型
      this.editDialogMode = 'add-child'
      this.editingTask = null
      this.parentTask = task

      // 设置默认日期范围
      const today = moment().format('YYYY-MM-DD')
      this.editDialogForm = {
        startDate: today,
        endDate: moment().add(7, 'days').format('YYYY-MM-DD')
      }

      this.editDialogVisible = true
    },

    // 显示添加同级任务对话框
    handleShowAddSiblingDialog(task) {
      console.log('显示添加同级任务对话框:', task)
      if (!task) return

      // 获取父任务
      const parentTask = this.findParentTask(task.parentId)

      // 检查父任务类型是否允许添加同级任务
      if (parentTask && parentTask.type === 'milestone') {
        this.$message.warning('Milestone类型下不能添加同级任务')
        return
      }

      // 设置对话框参数
      this.editDialogType = task.type // 同级任务类型与当前任务相同
      this.editDialogMode = 'add-sibling'
      this.editingTask = null
      this.parentTask = parentTask

      // 设置默认日期范围
      const today = moment().format('YYYY-MM-DD')
      this.editDialogForm = {
        startDate: today,
        endDate: this.editDialogType === 'milestone' ? today : moment().add(7, 'days').format('YYYY-MM-DD')
      }

      this.editDialogVisible = true
    },

    // 显示编辑对话框
    showEditDialog(task) {
      if (!task) return
      this.editDialogType = task.type || 'task'
      this.editDialogMode = 'edit'
      this.editingTask = {
        ...task,
        childrenTasks: this.findChildrenTasks(task.id)
      }
      this.parentTask = this.findParentTask(task.parentId)
    },

    // 显示添加同级任务对话框
    findParentTask(parentId) {
      if (!parentId) return null
      return this.flattenTasks.find(task => task.id === parentId)
    },

    // 查找子任务
    findChildrenTasks(parentId) {
      if (!parentId) return []
      return this.flattenTasks.filter(task => task.parentId === parentId)
    },

    // 刷新表格数据
    refreshTableData() {
      // 通知表格组件刷新数据
      if (this.$refs.customTable) {
        this.$refs.customTable.refreshData()
      }
      // 更新右侧区域宽度
      this.$nextTick(() => {
        this.updateRightAreaWidth()
      })
    }
  },
  mounted() {
    // 初始化表格宽度配置
    this.leftWidth = this.tableWidth || 400

    // 初始化列配置
    if (this.columns && Array.isArray(this.columns)) {
      // 处理列配置
    }
    // 初始化表格宽度配置
    this.leftWidth = this.tableWidth || 400

    // 初始化列配置
    if (this.columns && Array.isArray(this.columns)) {
      // 如果传入了列配置，使用传入的配置更新store
      this.$store.dispatch('updateColumnConfig', this.columns)
      console.log('[列配置] 使用prop传入的列配置:', this.columns)
    }

    // 初始化
    this.$emit('update:currentViewMode', this.$store.state.viewMode || 'month')

    // 自动初始化日期范围 - 使用autoRangeDebounced代替initializeDateRange
    this.$nextTick(() => {
      // 页面渲染完成后延迟执行Auto操作，确保与GanttToolbar同步
      setTimeout(() => {
        console.log('[GanttChart] 自动执行初始化日期范围')
        this.autoRangeDebounced()
      }, 200) // 比GanttToolbar稍早执行，确保数据初始化
    })

    // 监听右侧区域宽度变化
    this.$nextTick(() => {
      // 初始更新一次宽度
      this.updateRightAreaWidth()

      if (this.$refs.ganttRight && window.ResizeObserver) {
        this.resizeObserver = new ResizeObserver(() => {
          // 延迟一下，确保所有布局都稳定
          setTimeout(() => {
            this.updateRightAreaWidth()
            // 同时更新表格高度
            this.updateTableHeight()
          }, 50)
        })
        this.resizeObserver.observe(this.$refs.ganttRight)
      }

      // 再次延迟更新，确保在组件挂载后立即获得正确的宽度
      setTimeout(() => {
        this.updateRightAreaWidth()
        this.updateTableHeight()
      }, 100)
    })

    this.initPerformanceMonitoring()
    this.checkAutoOptimization()
    this.updateRightAreaWidth()
    window.addEventListener('resize', this.updateRightAreaWidth)
    this.updateLeftPanelHeight()
    window.addEventListener('resize', this.updateLeftPanelHeight)
    this.$nextTick(() => {
      this.updateTableHeight()
      window.addEventListener('resize', this.updateTableHeight)
    })

    // 初始化列拖拽
    this.initColumnConfigSortable()

    // 监听键盘事件
    document.addEventListener('keydown', this.handleKeyDown)

    // 设置组件的引用以便外部访问
    if (typeof window !== 'undefined') {
      window.ganttChart = this

      // 添加级联更新测试方法
      window.testCascadeUpdate = (taskId, newStartDate, newEndDate) => {
        console.log('[测试] 手动触发级联更新检查')
        return this.checkAndHandleCascadeUpdate(taskId, newStartDate, newEndDate)
      }

      console.log('[级联更新] 测试方法已添加到window.testCascadeUpdate')
      console.log('[级联更新] 使用方法: window.testCascadeUpdate(11, "2024-01-20", "2024-01-25")')
    }

    // 滚动条联动
    this.$nextTick(() => {
      const leftTableBody = this.$refs.customTable?.$refs?.tableBody
      const rightScrollContainer = this.$refs.scrollContainer
      if (leftTableBody && rightScrollContainer) {
        let isSyncingLeft = false
        let isSyncingRight = false
        leftTableBody.addEventListener('scroll', () => {
          if (isSyncingLeft) { isSyncingLeft = false; return }
          isSyncingRight = true
          rightScrollContainer.scrollTop = leftTableBody.scrollTop
        })
        rightScrollContainer.addEventListener('scroll', () => {
          if (isSyncingRight) { isSyncingRight = false; return }
          isSyncingLeft = true
          leftTableBody.scrollTop = rightScrollContainer.scrollTop
        })
      }
    })
  },
  updated() {
    // 在组件更新后也检查一下高度
    this.$nextTick(() => {
      this.updateTableHeight()
    })
  },
  beforeDestroy() {
    // 清理事件监听器
    if (this.sortableInstance) {
      this.sortableInstance.destroy()
    }
    if (this.columnSortableInstance) {
      this.columnSortableInstance.destroy()
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
    }

    // 清理拖拽状态
    if (this.isDragging) {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    // 清理父节点拖拽防抖定时器
    if (this.parentDragDebounceTimer) {
      clearTimeout(this.parentDragDebounceTimer)
      this.parentDragDebounceTimer = null
    }

    this.cleanupPerformanceMonitoring()
    this.stopPerformanceMonitoring()
    window.removeEventListener('resize', this.updateRightAreaWidth)
    window.removeEventListener('resize', this.updateLeftPanelHeight)
    window.removeEventListener('resize', this.updateTableHeight)
  },
  // 监听数据变化，及时进行性能优化
  watch: {
    // 监听表格宽度变化
    tableWidth: {
      handler(newWidth) {
        if (newWidth && typeof newWidth === 'number') {
          this.leftWidth = newWidth
          console.log(`[表格宽度] 已更新为: ${newWidth}px`)
        }
      },
      immediate: false
    },

    // 监听父子节点时间关联配置变化
    linkParentChildDates: {
      handler(newValue) {
        // 更新store中的配置
        this.$store.dispatch('setLinkParentChildDates', newValue)
        console.log(`[父子时间关联] 配置已更新: ${newValue ? '启用关联' : '独立编辑'}`)
      },
      immediate: true // 立即执行一次
    },

    // 监听列配置变化
    columns: {
      handler(newColumns) {
        if (newColumns && Array.isArray(newColumns)) {
          // 更新store中的列配置
          this.$store.dispatch('updateColumnConfig', newColumns)
          console.log('[列配置] 配置已更新:', newColumns)
        }
      },
      deep: true,
      immediate: false // 不立即执行，因为在mounted中已经处理
    },

    flattenTasks() {
      this.updateRightAreaWidth()
    },
    chartStartDate() {
      this.updateRightAreaWidth()
    },
    chartEndDate() {
      this.updateRightAreaWidth()
    },
    dateRange() {
      this.updateRightAreaWidth()
    },
    ganttData: {
      handler() {
        this.updateRightAreaWidth()
      },
      deep: true
    }
  }
}
</script>

<style scoped>
.gantt-chart {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f8fafc;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
}

/* gantt-controls已移除，设置功能已迁移到Performance Monitor */

.operation-tips {
  display: flex;
  align-items: center;
  gap: 20px;
  color: rgba(255, 255, 255, 0.9);
}

.tip-text {
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.view-mode-selector {
  display: flex;
  align-items: center;
  gap: 10px;
}

.view-mode-selector label {
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
}

.tooltip-controls,
.gantt-display-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  margin-left: 20px;
  gap: 10px;
  max-width: 650px;
}

.tooltip-controls label,
.gantt-display-controls label {
  display: flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  font-size: 13px;
}

.tooltip-checkbox {
  margin-right: 8px;
  cursor: pointer;
  transform: scale(1.2);
}

.tooltip-label {
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.view-mode-select {
  padding: 6px 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.15);
  color: #ffffff;
  font-size: 14px;
  min-width: 120px;
  backdrop-filter: blur(5px);
  transition: all 0.3s ease;
}

.view-mode-select:focus {
  outline: none;
  border-color: rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.25);
}

/* 移除 .gantt-actions 样式，使用 .quick-actions */

.btn {
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  position: relative;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.15);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
}

.btn:hover {
  background: rgba(255, 255, 255, 0.25);
  border-color: rgba(255, 255, 255, 0.4);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.btn-primary {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: #ffffff;
  border: none;
}

.btn-primary:hover {
  background: linear-gradient(135deg, #43a3f4 0%, #00e6f0 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(79, 172, 254, 0.4);
}

.btn-secondary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
  border: none;
}

.btn-secondary:hover {
  background: linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

.btn-today {
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
  color: #ffffff;
  border: none;
}

.btn-today:hover {
  background: linear-gradient(135deg, #f8638a 0%, #fdd835 100%);
  box-shadow: 0 6px 20px rgba(250, 112, 154, 0.4);
}

.btn-highlight {
  background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%);
  color: #4a5568;
  border: none;
}

.btn-reset {
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 8px;
  border-radius: 6px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-reset:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: rotate(180deg);
}

.btn-icon {
  font-size: 16px;
}

.gantt-main {
  display: flex;
  height: 100%;
  min-height: 0;
  border-top:1px solid #ddd;
}

.gantt-left {
  height: 100%;
  min-height: 0;
}

.gantt-right {
  height: 100%;
  min-height: 0;
  overflow-x: visible;
  overflow-y: hidden;
}

.gantt-splitter {
  width: 8px;
  background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
  cursor: col-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: background 0.3s ease;
}

.gantt-splitter:hover {
  background: linear-gradient(135deg, #cbd5e0 0%, #a0aec0 100%);
}

.toggle-panel-btn {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #e2e8f0;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.toggle-panel-btn:hover {
  background: #ffffff;
  border-color: #cbd5e0;
  transform: scale(1.1);
}

.show-panel-btn {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  width: 32px;
  height: 48px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.show-panel-btn:hover {
  background: linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%);
  transform: translateY(-50%) translateX(4px);
}

.gantt-scroll-container {
  height: 100%;
  overflow-x: visible;
  overflow-y: auto;
  scroll-behavior: smooth;
  cursor: grab;
}

.gantt-scroll-container:active {
  cursor: grabbing;
}

.gantt-scroll-container.dragging {
  cursor: grabbing;
  user-select: none;
}

.gantt-scroll-container::-webkit-scrollbar {
  width: 12px;
  height: 12px;
}

.gantt-scroll-container::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 6px;
}

.gantt-scroll-container::-webkit-scrollbar-thumb {
  background: linear-gradient(135deg, #cbd5e0 0%, #a0aec0 100%);
  border-radius: 6px;
  border: 2px solid #f1f5f9;
}

.gantt-scroll-container::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(135deg, #a0aec0 0%, #718096 100%);
}

.gantt-timeline-wrapper {
  position: sticky;
  top: 0;
  z-index: 50;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-bottom: 2px solid #e2e8f0;
}

.gantt-chart-area {
  position: relative;
  background: #ffffff;
  /* 使用动态计算的高度，避免不必要的空白区域 */
  height: auto;
  min-height: 200px;
  /* 确保内容溢出时正确处理，水平方向允许溢出 */
  overflow-x: visible;
  /* 精确控制高度，避免底部空白 */
  box-sizing: border-box;
}

.gantt-content {
  position: relative;
  transition: transform 0.1s ease-out;
  overflow: visible;
}

/* 对话框样式优化 - 修复层级问题，确保模态框在最顶层 */
.el-dialog__wrapper {
  z-index: 10001 !important;
}

.el-dialog {
  border-radius: 12px;
  overflow: hidden;
  z-index: 10002 !important;
}

.el-dialog__header {
  background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
  color: #ffffff;
  padding: 20px 24px;
}

.el-dialog__title {
  font-size: 18px;
  font-weight: 600;
  color: #ffffff;
}

.el-dialog__body {
  padding: 24px;
  background: #f8fafc;
}



.el-form-item__label {
  font-weight: 600;
  color: #374151;
}

.el-input__inner {
  border-radius: 8px;
  border: 1px solid #d1d5db;
  transition: all 0.3s ease;
}

.el-input__inner:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.el-select .el-input__inner {
  border-radius: 8px;
}

.el-date-editor .el-input__inner {
  border-radius: 8px;
}

.el-button {
  border-radius: 8px;
  font-weight: 600;
  transition: all 0.3s ease;
}

.el-button--primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
}

.el-button--primary:hover {
  background: linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.dialog-footer {
  padding: 16px 24px;
  background: #ffffff;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .gantt-controls {
    flex-direction: column;
    gap: 16px;
    padding: 16px;
  }

  .date-range-controls {
    flex-wrap: wrap;
    gap: 12px;
  }

  .gantt-actions {
    flex-wrap: wrap;
    justify-content: center;
  }

  .btn {
    padding: 8px 12px;
    font-size: 13px;
  }

  .gantt-left {
    min-width: 250px;
  }
}

/* 滚动条样式优化 - 全局应用淡灰色细窄样式 */
.gantt-scroll-container::-webkit-scrollbar,
.custom-gantt-table::-webkit-scrollbar,
.virtual-scroll-table::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.gantt-scroll-container::-webkit-scrollbar-track,
.custom-gantt-table::-webkit-scrollbar-track,
.virtual-scroll-table::-webkit-scrollbar-track {
  background: #f7f8fa;
  border-radius: 3px;
}

.gantt-scroll-container::-webkit-scrollbar-thumb,
.custom-gantt-table::-webkit-scrollbar-thumb,
.virtual-scroll-table::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
  border: 1px solid #f7f8fa;
}

.gantt-scroll-container::-webkit-scrollbar-thumb:hover,
.custom-gantt-table::-webkit-scrollbar-thumb:hover,
.virtual-scroll-table::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

/* ElementUI 日期选择器样式优化 */
.date-range-picker .el-input__inner {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  color: #ffffff;
  font-size: 14px;
  transition: all 0.3s ease;
  backdrop-filter: blur(5px);
}

.date-range-picker .el-input__inner:focus {
  border-color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.95);
  color: #374151;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.2);
}

.date-range-picker .el-input__inner::placeholder {
  color: rgba(255, 255, 255, 0.7);
}

/* 时间轴包装器背景修复 */
.gantt-timeline-wrapper {
  position: sticky;
  top: 0;
  z-index: 50;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-bottom: 2px solid #e2e8f0;
  /* 确保背景完全覆盖 */
  width: 100%;
  min-width: 100%;
}

/* 甘特图内容区域背景修复 */
.gantt-chart-area {
  position: relative;
  background: #ffffff;
  min-height: 600px;
  /* 确保背景完全覆盖 */
  width: 100%;
}

/* gantt-content样式已在上方定义，避免重复 */

/* 表格样式优化 */
.custom-gantt-table {
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* 加载动画 */
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.loading {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* 悬浮效果 */
.hover-lift {
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.hover-lift:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

/* 渐变文字 */
.gradient-text {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: 700;
}

/* 玻璃态效果 */
.glass-effect {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

/* 高亮边框动画 */
@keyframes borderGlow {
  0%, 100% {
    border-color: #667eea;
    box-shadow: 0 0 5px rgba(102, 126, 234, 0.3);
  }
  50% {
    border-color: #764ba2;
    box-shadow: 0 0 20px rgba(118, 75, 162, 0.5);
  }
}

.glow-border {
  animation: borderGlow 2s ease-in-out infinite;
}

.btn.btn-highlight:hover {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}

/* 性能优化按钮样式 */
.btn.btn-performance {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: #ffffff;
  border: none;
}

.btn.btn-performance:hover {
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.btn.btn-performance.active {
  background: linear-gradient(135deg, #047857 0%, #065f46 100%);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
}

.btn.btn-monitor {
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  color: #ffffff;
  border: none;
}

.btn.btn-monitor:hover {
  background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
}

.btn.btn-monitor.active {
  background: linear-gradient(135deg, #6d28d9 0%, #5b21b6 100%);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
}

.btn.btn-auto-optimize {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: #ffffff;
  border: none;
}

.btn.btn-auto-optimize:hover {
  background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}

.btn.btn-auto-optimize.active {
  background: linear-gradient(135deg, #b45309 0%, #92400e 100%);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* 虚拟滚动表格自定义样式 */
.task-name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.collapse-btn {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 2px;
  transition: background-color 0.2s ease;
  user-select: none;
  font-size: 12px;
}

.collapse-btn:hover {
  background: rgba(102, 126, 234, 0.1);
}

.task-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.progress-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: #f1f5f9;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981 0%, #059669 100%);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 11px;
  font-weight: 500;
  color: #6b7280;
  min-width: 35px;
  text-align: right;
}

.status-badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-badge.status-completed {
  background: rgba(16, 185, 129, 0.1);
  color: #059669;
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.status-badge.status-progress {
  background: rgba(59, 130, 246, 0.1);
  color: #2563eb;
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.status-badge.status-not-started {
  background: rgba(107, 114, 128, 0.1);
  color: #6b7280;
  border: 1px solid rgba(107, 114, 128, 0.2);
}

/* 左侧面板性能监控器样式 */
.left-panel-performance-monitor {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-top: 1px solid #e2e8f0;
  padding: 8px;
  font-size: 11px;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
  display: none;
}

.gantt-left {
  position: relative; /* 确保定位上下文 */
}

/* 测试数据按钮样式 */
.btn.btn-test {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: #ffffff;
  border: none;
}

.btn.btn-test:hover {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3);
}

/* highlighted-row-background 统一样式 */
.highlighted-row-background {

  /* 确保高度和位置与表格行一致 */
  height: 28px; /* 修复高亮行背景高度 */
  position: absolute;
  left: 0;
  right: 0;
  z-index: 1;
}

.gantt-chart-area .timeline-row.highlighted {

  height: 28px; /* 修复时间轴高亮行高度 */
}

.gantt-right .timeline-row:hover {
  background: #f8f9fa;
}

.gantt-right .timeline-row {
  transition: background-color 0.15s ease;
  border-bottom: 1px solid #f0f3f6;
  /* DHTMLX风格：快速过渡和细边框 */
  height: 28px; /* 修复时间轴行高度 */
  min-height: 28px; /* 修复时间轴最小行高度 */
  box-sizing: border-box;
}

/* 显示控制选项 */
.display-controls-group {
  margin-bottom: 20px;
}

.control-label {
  font-weight: 600;
  margin-bottom: 10px;
}

.control-options {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.control-option {
  display: flex;
  align-items: center;
  gap: 5px;
}

.control-option input[type="checkbox"] {
  margin-right: 5px;
}

.btn.btn-gray-connections {
  background: linear-gradient(135deg, #9ca3af 0%, #718096 100%);
  color: #ffffff;
  border: none;
}

.btn.btn-gray-connections:hover {
  background: linear-gradient(135deg, #718096 0%, #5b636e 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(123, 133, 148, 0.3);
}

.btn.btn-gray-connections.active {
  background: linear-gradient(135deg, #5b636e 0%, #474e5d 100%);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* 工具栏样式 */
.gantt-toolbar {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #e1e8ed;
  gap: 8px;
}

.critical-path-btn {
  font-size: 12px;
}

/* 彻底解决弹框中下拉组件被遮挡问题 */
.el-dialog {
  z-index: 3000 !important;
}

.el-dialog__wrapper {
  z-index: 3000 !important;
}

/* Element UI 下拉组件的最高层级 */
.el-select-dropdown {
  z-index: 10000 !important;
}

.el-picker-panel {
  z-index: 10000 !important;
}

.el-color-dropdown {
  z-index: 10000 !important;
}

.el-color-picker__panel {
  z-index: 10000 !important;
}

/* 确保Element UI的popper组件在弹框上方 */
.el-popper {
  z-index: 10000 !important;
}

/* 确保弹框内输入组件本身不会遮挡下拉 */
.el-dialog__body .el-input {
  z-index: auto;
}

.el-dialog__body .el-select {
  z-index: auto;
}

.el-dialog__body .el-date-picker {
  z-index: auto;
}

/* Element UI date picker和select的特殊处理 */
.el-date-picker .el-picker-panel {
  z-index: 10001 !important;
}

.el-select .el-select-dropdown {
  z-index: 10001 !important;
}

.gantt-chart-grid {
  width: 100%;
  height: 100%;
}

/* 级联更新确认弹框样式 */
::v-deep .cascade-update-confirm-dialog .el-message-box__message {
  white-space: pre-line;
  max-height: 300px;
  overflow-y: auto;
  font-family: 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.4;
}

::v-deep .cascade-update-confirm-dialog .el-message-box__btns {
  padding-top: 15px;
}

::v-deep .cascade-update-confirm-dialog .el-button--primary {
  background-color: #409eff;
  border-color: #409eff;
}

::v-deep .cascade-update-confirm-dialog .el-button--primary:hover {
  background-color: #66b1ff;
  border-color: #66b1ff;
}
</style>
