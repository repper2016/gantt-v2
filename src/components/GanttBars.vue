<template>
  <div
    class="gantt-bars"
    :style="{ '--bars-min-height': Math.max(tasks.length * 28, 200) + 'px' }"
    @dblclick="handleGlobalDblClick"
    @click="handleComponentClick"
  >
    <!-- 高亮行背景 -->
    <div
      v-if="highlightedRowId !== null"
      class="highlighted-row-background"
      :style="{
        top: getHighlightedRowTop() + 'px',
        width: chartWidth + 'px',
        height: '28px',
      }"
    ></div>

    <!-- 任务条 -->
    <div
      v-for="bar in taskBars"
      :key="bar.task.id"
      class="gantt-bar-container"
      :data-task-id="bar.task.id"
      :style="{
        top: bar.index * 28 + 'px',
        left: bar.left + 'px',
        width: bar.width + 'px',
      }"
      @dblclick.stop="onBarDblClick(bar, $event)"
    >
      <!-- 计划日期范围背景（如果有计划日期且启用） -->
      <div
        v-if="
          showPlanNodes &&
          bar.planLeft !== undefined &&
          bar.planWidth !== undefined
        "
        class="plan-date-range"
        :style="{
          left: bar.planLeft - bar.left + 'px',
          width: bar.planWidth + 'px',
        }"
      ></div>

      <!-- Milestone 类型特殊显示 -->
      <div
        v-if="bar.task.type === 'milestone'"
        class="gantt-milestone-marker"
        :class="{
          dragging: bar.isDragging,
          selected: selectedTask && selectedTask.id === bar.task.id,
          highlighted: highlightedRowId === bar.task.id,
          'lineage-highlighted': isTaskHighlighted(bar.task.id),
          'lineage-dimmed': isTaskDimmed(bar.task.id),
          'lineage-source': getTaskHighlightType(bar.task.id) === 'source',
          'lineage-upstream': getTaskHighlightType(bar.task.id) === 'upstream',
          'lineage-downstream':
            getTaskHighlightType(bar.task.id) === 'downstream',
        }"
        @mousedown="onBarMouseDown(bar, $event)"
        @click.stop="selectTask(bar.task)"
        @dblclick.stop="onBarDblClick(bar, $event)"
        @contextmenu.prevent="
          enableContextMenu && showTaskContextMenu(bar.task, $event)
        "
        @mouseenter="showTooltip(bar.task, $event)"
        @mouseleave="hideTooltip"
        @mousemove="updateTooltipPosition($event)"
      >
        <!-- Milestone 图标 -->
        <div class="milestone-diamond">
          <span
            class="milestone-icon"
            :class="getTaskTypeConfig(bar.task.type)?.iconClass"
            :style="{
              fontSize: getTaskTypeConfig(bar.task.type)?.iconSize || '16px',
              color: getTaskTypeConfig(bar.task.type)?.iconColor || '#f39c12',
            }"
          >
            <!-- 如果有iconClass配置，则不显示emoji图标 -->
            <template v-if="!getTaskTypeConfig(bar.task.type)?.iconClass">
              {{ getTaskTypeConfig(bar.task.type)?.icon || "🏁" }}
            </template>
          </span>
        </div>

        <!-- Milestone 标题 -->
        <div class="milestone-title" v-if="showTaskName">
          {{ bar.task.name }}
        </div>

        <!-- Milestone连接点 -->
        <div
          v-if="showConnections && milestoneLinkable"
          class="milestone-connection-points"
        >
          <!-- 左侧连接点 - 开始点 -->
          <div
            class="milestone-connection-point milestone-connection-left milestone-connection-start"
            :class="{
              active: connectionState,
              connecting:
                connectionState &&
                connectionState.fromBar.task.id === bar.task.id &&
                connectionState.fromPoint === 'start',
            }"
            @mousedown.stop="startConnection(bar, 'start', $event)"
            @mouseenter="handleConnectionHover(bar, 'start')"
            @mouseleave="handleConnectionLeave"
            title="Connect from milestone start (for SS/SF dependencies)"
          >
            <div class="connection-dot connection-dot-start"></div>
          </div>

          <!-- 右侧连接点 - 结束点 -->
          <div
            class="milestone-connection-point milestone-connection-right milestone-connection-end"
            :class="{
              active: connectionState,
              connecting:
                connectionState &&
                connectionState.fromBar.task.id === bar.task.id &&
                connectionState.fromPoint === 'end',
            }"
            @mousedown.stop="startConnection(bar, 'end', $event)"
            @mouseenter="handleConnectionHover(bar, 'end')"
            @mouseleave="handleConnectionLeave"
            title="Connect from milestone end (for FS/FF dependencies)"
          >
            <div class="connection-dot connection-dot-end"></div>
          </div>
        </div>
      </div>

      <!-- 普通任务条 -->
      <div
        v-else
        class="gantt-bar"
        :class="{
          dragging: bar.isDragging,
          connecting:
            connectionState && connectionState.fromBar.task.id === bar.task.id,
          selected: selectedTask && selectedTask.id === bar.task.id,
          'parent-task': bar.task.isParentNode,
          'parent-dragging': bar.task.isParentNode && bar.isDragging,
          highlighted: highlightedRowId === bar.task.id,
          'lineage-highlighted': isTaskHighlighted(bar.task.id),
          'lineage-dimmed': isTaskDimmed(bar.task.id),
          'lineage-source': getTaskHighlightType(bar.task.id) === 'source',
          'lineage-upstream': getTaskHighlightType(bar.task.id) === 'upstream',
          'lineage-downstream':
            getTaskHighlightType(bar.task.id) === 'downstream',
          'critical-path': bar.isCriticalPath,
        }"
        :style="{ backgroundColor: bar.task.color }"
        @mousedown="onBarMouseDown(bar, $event)"
        @click.stop="selectTask(bar.task)"
        @dblclick.stop="onBarDblClick(bar, $event)"
        @contextmenu.prevent="
          enableContextMenu && showTaskContextMenu(bar.task, $event)
        "
        @mouseenter="showTooltip(bar.task, $event)"
        @mouseleave="hideTooltip"
        @mousemove="updateTooltipPosition($event)"
      >
        <!-- 父级节点指示器 -->
        <div
          v-if="bar.task.isParentNode"
          class="parent-indicator"
          :data-collapsed="isTaskCollapsed(bar.task.id) ? 'true' : 'false'"
          @click.stop="toggleTaskCollapse(bar.task.id)"
        ></div>
        <!-- 进度条 -->
        <div
          class="gantt-bar-progress"
          :style="{
            width:
              Math.max(bar.task.progress, bar.task.progress === 0 ? 8 : 0) +
              (bar.task.progress === 0 ? 'px' : '%'),
            minWidth: bar.task.progress === 0 ? '8px' : 'auto',
          }"
        >
          <!-- Bryntum风格的底部三角形进度拖拽手柄 -->
          <div
            v-if="
              !bar.task.isParentNode &&
              showProgressHandle &&
              bar.task.progress > 0
            "
            class="gantt-progress-handle-container"
            @mousedown.stop="startProgressDrag(bar, $event)"
            :title="`拖拽调整进度: ${bar.task.progress}%`"
          >
            <div class="gantt-progress-handle"></div>
          </div>
          <!-- 百分比显示 - 紧跟在进度手柄后面 -->
          <div
            class="gantt-bar-progress-text"
            v-if="showProgress && bar.task.progress > 0"
          >
            {{ bar.task.progress }}%
          </div>
        </div>

        <!-- 任务文本 -->
        <div class="gantt-bar-text">
          <span class="task-name" v-if="showTaskName">
            <!-- 任务类型图标 - 支持iconClass覆盖 -->
            <span
              v-if="bar.task.type"
              class="task-type-icon"
              :class="getTaskTypeConfig(bar.task.type)?.iconClass"
              :style="{
                fontSize: getTaskTypeConfig(bar.task.type)?.iconSize || '14px',
                color: getTaskTypeConfig(bar.task.type)?.iconColor || '#666',
              }"
              :title="getTaskTypeConfig(bar.task.type)?.name"
            >
              <!-- 如果有iconClass配置，则不显示emoji图标 -->
              <template v-if="!getTaskTypeConfig(bar.task.type)?.iconClass">
                {{ getTaskTypeConfig(bar.task.type)?.icon }}
              </template>
            </span>
            {{ bar.task.name }}
          </span>
        </div>

        <!-- 左侧调整手柄 - 移到节点外面 -->
        <div
          v-if="!bar.task.isParentNode"
          class="resize-handle left"
          @mousedown.stop.prevent="startResize(bar, 'left', $event)"
        ></div>

        <!-- 右侧调整手柄 - 移到节点外面 -->
        <div
          v-if="!bar.task.isParentNode"
          class="resize-handle right"
          @mousedown.stop.prevent="startResize(bar, 'right', $event)"
        ></div>

        <!-- 删除按钮 - 需要检查删除权限 -->
        <div
          v-if="!bar.task.isParentNode && hasPermission(bar.task, 'deletable')"
          class="task-delete-btn"
          @click.stop="deleteTaskDirectly(bar.task)"
          title="Delete Task"
        >
          ×
        </div>
      </div>

      <!-- dhtmlx风格的外部连接点（如果启用） -->
      <div
        v-if="
          showConnections &&
          (allowParentConnection || !bar.task.isParentNode) &&
          bar.task.type !== 'milestone'
        "
        class="gantt-connection-points"
      >
        <!-- 左侧连接点 - 任务开始点，向左外偏移更远，避免与拖拽手柄重叠 -->
        <div
          class="gantt-connection-point gantt-connection-point-left gantt-connection-start"
          :class="{
            active: connectionState,
            connecting:
              connectionState &&
              connectionState.fromBar.task.id === bar.task.id &&
              connectionState.fromPoint === 'start',
          }"
          @mousedown.stop="startConnection(bar, 'start', $event)"
          @mouseenter="handleConnectionHover(bar, 'start')"
          @mouseleave="handleConnectionLeave"
          style="left: -16px"
          title="Connect from task start (for SS/SF dependencies)"
        >
          <div class="gantt-connection-dot gantt-connection-dot-start"></div>
        </div>

        <!-- 右侧连接点 - 任务结束点，向右外偏移更远，避免与拖拽手柄重叠 -->
        <div
          class="gantt-connection-point gantt-connection-point-right gantt-connection-end"
          :class="{
            active: connectionState,
            connecting:
              connectionState &&
              connectionState.fromBar.task.id === bar.task.id &&
              connectionState.fromPoint === 'end',
          }"
          @mousedown.stop="startConnection(bar, 'end', $event)"
          @mouseenter="handleConnectionHover(bar, 'end')"
          @mouseleave="handleConnectionLeave"
          style="right: -16px"
          title="Connect from task end (for FS/FF dependencies)"
        >
          <div class="gantt-connection-dot gantt-connection-dot-end"></div>
        </div>

        <!-- 任务名称标签 (JIRA风格) - 显示在甘特条右侧 -->
        <div
          v-if="showTaskNames && !bar.task.isParentNode"
          class="gantt-task-name-label"
          :style="{
            left: bar.width + 8 + 'px',
            top: '8px',
          }"
        >
          {{
            bar.task.name.length > 25
              ? bar.task.name.substring(0, 25) + "..."
              : bar.task.name
          }}
        </div>
      </div>
    </div>

    <!-- 依赖线层：智能pointer-events，只有线条可点击，其他区域穿透 -->
    <svg
      v-if="internalShowDependencyLines"
      class="gantt-dependency-lines"
      :width="chartWidth"
      :height="chartHeight"
      style="
        position: absolute;
        top: 0;
        left: 0;
        z-index: 3;
        pointer-events: none;
      "
    >
      <!-- SVG箭头标记定义 -->
      <defs>
        <!-- 标准箭头标记 - 优化版 -->
        <marker
          id="arrow-default"
          markerWidth="8"
          markerHeight="8"
          refX="8"
          refY="4"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M 0,0 L 8,4 L 0,8 L 2,4 Z" fill="#666" stroke="none" />
        </marker>

        <!-- 高亮箭头标记 -->
        <marker
          id="arrow-highlight"
          markerWidth="8"
          markerHeight="8"
          refX="8"
          refY="4"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M 0,0 L 8,4 L 0,8 L 2,4 Z" fill="#1976d2" stroke="none" />
        </marker>

        <!-- 选中箭头标记 -->
        <marker
          id="arrow-selected"
          markerWidth="8"
          markerHeight="8"
          refX="8"
          refY="4"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M 0,0 L 8,4 L 0,8 L 2,4 Z" fill="#f50057" stroke="none" />
        </marker>

        <!-- 增强的终点指示器 -->
        <marker
          v-for="color in arrowColors"
          :key="`endPoint-${color.replace('#', '')}`"
          :id="`endPoint-${color.replace('#', '')}`"
          markerWidth="8"
          markerHeight="8"
          refX="4"
          refY="4"
          orient="auto"
          markerUnits="strokeWidth"
          viewBox="0 0 8 8"
        >
          <circle
            cx="4"
            cy="4"
            r="3"
            :fill="color"
            stroke="white"
            stroke-width="1"
          />
        </marker>

        <!-- 阴影滤镜定义 -->
        <filter
          id="connectionShadow"
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
        >
          <feDropShadow dx="1" dy="1" stdDeviation="1" flood-opacity="0.2" />
        </filter>
      </defs>
      <g
        v-for="line in visibleDependencyLines"
        :key="line.key"
        class="gantt-dependency-group"
        v-show="shouldShowDependencyLine(line)"
        :data-from="line.from"
        :data-to="line.to"
      >
        <g class="gantt-link-container">
          <!-- 扩大的隐形点击区域，确保pointer-events:auto -->
          <path
            :d="line.path"
            stroke="transparent"
            stroke-width="16"
            fill="none"
            class="gantt-link-hit-area"
            style="cursor: pointer; pointer-events: auto"
            @click.stop="selectDependencyLine(line, $event)"
            @dblclick.stop="
              connectionEditable && openLinkEditModal(line, $event)
            "
            @contextmenu.prevent="showDependencyContextMenu(line, $event)"
          />
          <!-- 可视化连接线 -->
          <path
            :d="line.path"
            :stroke="
              line.selected
                ? '#ff4757'
                : isDependencyHighlighted(line)
                ? '#1890ff'
                : getConnectionLineColor(line)
            "
            :stroke-width="
              line.selected ? 1.5 : isDependencyHighlighted(line) ? 1.5 : 1
            "
            fill="none"
            :marker-end="
              line.selected
                ? 'url(#arrow-selected)'
                : isDependencyHighlighted(line)
                ? 'url(#arrow-highlighted)'
                : 'url(#arrow-default)'
            "
            class="gantt-dependency-line-visual"
            :class="{
              selected: line.selected,
              highlighted: isDependencyHighlighted(line),
              dimmed:
                highlightedConnections.isHighlightMode &&
                !isDependencyHighlighted(line),
              'gray-mode':
                grayConnectionMode &&
                !line.selected &&
                !isDependencyHighlighted(line),
              bezier: connectionStyle === 'bezier',
            }"
            style="
              pointer-events: auto;
              stroke-linecap: square;
              stroke-linejoin: round;
            "
          />

          <!-- 为连接到结束点的连线添加额外的终点指示器 -->
          <circle
            v-if="isEndPointConnection(line)"
            :cx="getEndPointIndicatorX(line)"
            :cy="getEndPointIndicatorY(line)"
            r="4"
            :fill="
              line.selected
                ? '#ff4757'
                : isDependencyHighlighted(line)
                ? '#1890ff'
                : getConnectionLineColor(line)
            "
            stroke="white"
            stroke-width="2"
            class="gantt-end-point-indicator"
            style="pointer-events: auto; cursor: pointer; display: none"
            filter="url(#connectionShadow)"
            @click.stop="selectDependencyLine(line, $event)"
            @dblclick.stop="
              connectionEditable && openLinkEditModal(line, $event)
            "
          />
        </g>

        <!-- 依赖线标签 - 只有在启用时才显示 -->
        <g
          v-if="showConnectionLabels && line.label"
          class="gantt-link-label-group"
        >
          <!-- 标签背景 -->
          <rect
            :x="line.labelX - 15"
            :y="line.labelY - 8"
            width="30"
            height="16"
            rx="8"
            class="gantt-link-label-bg"
            fill="rgba(255, 255, 255, 0.15)"
            stroke="rgba(0, 0, 0, 0.1)"
            stroke-width="0.5"
          />
          <!-- 标签文字 -->
          <text
            :x="line.labelX"
            :y="line.labelY + 3"
            class="gantt-link-label-text"
            :class="{ selected: line.selected }"
            fill="#666"
            font-size="10"
            text-anchor="middle"
            font-family="Arial, sans-serif"
            @click.stop="selectDependencyLine(line, $event)"
            @dblclick.stop="
              connectionEditable && editDependencyLabel(line, $event)
            "
          >
            {{ line.label }}
          </text>
        </g>
      </g>
    </svg>
    <!-- 预览连线层：pointer-events:none，确保不阻挡下层事件 -->
    <svg
      v-if="connectionPreview"
      class="gantt-connection-preview"
      :width="chartWidth"
      :height="chartHeight"
      style="
        position: absolute;
        top: 0;
        left: 0;
        z-index: 2;
        pointer-events: none;
      "
    >
      <line
        :x1="connectionPreview.startX"
        :y1="connectionPreview.startY"
        :x2="connectionPreview.endX"
        :y2="connectionPreview.endY"
        stroke="#1890ff"
        stroke-width="1.5"
        stroke-dasharray="3,3"
        stroke-linecap="round"
        opacity="0.9"
        filter="url(#connectionShadow)"
      />
      <circle
        :cx="connectionPreview.endX"
        :cy="connectionPreview.endY"
        r="3"
        fill="#1890ff"
        opacity="0.9"
        filter="url(#connectionShadow)"
      />
    </svg>

    <!-- 右键菜单 -->
    <div
      v-if="enableContextMenu && contextMenu.visible"
      class="gantt-context-menu"
      :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
    >
      <!-- 任务右键菜单 -->
      <template v-if="contextMenu.type === 'task'">
        <div class="context-menu-header">
          {{ contextMenu.task?.name || "任务操作" }}
        </div>
        <div
          class="context-menu-item"
          @click="editTaskFromMenu"
          v-if="hasPermission(contextMenu.task, 'editable')"
        >
          <i class="el-icon-edit"></i> 编辑任务
        </div>
        <div
          class="context-menu-item"
          @click="deleteTaskFromMenu"
          v-if="hasPermission(contextMenu.task, 'deletable')"
        >
          <i class="el-icon-delete"></i> 删除任务
        </div>
        <div
          class="context-menu-item"
          @click="addChildTaskFromMenu"
          v-if="hasPermission(contextMenu.task, 'editable')"
        >
          <i class="el-icon-plus"></i> 添加子任务
        </div>
        <div
          class="context-menu-item"
          @click="addSiblingTaskFromMenu"
          v-if="hasPermission(contextMenu.task, 'editable')"
        >
          <i class="el-icon-circle-plus"></i> 添加同级任务
        </div>
      </template>

      <!-- 依赖线右键菜单 -->
      <template v-else-if="contextMenu.type === 'dependency'">
        <div class="context-menu-header">连线操作</div>
        <div
          class="context-menu-item"
          @click="editDependencyFromMenu"
          v-if="connectionEditable"
        >
          <i class="el-icon-edit"></i> 编辑连线
        </div>
        <div
          class="context-menu-item"
          @click="deleteDependencyFromMenu"
          v-if="connectionEditable"
        >
          <i class="el-icon-delete"></i> 删除连线
        </div>
      </template>
    </div>

    <!-- 任务编辑功能已移至GanttChart统一弹框 -->

    <!-- 连接线编辑弹框 -->
    <el-dialog
      title="Edit Connection"
      :visible.sync="linkEditModal.visible"
      width="500px"
      class="gantt-dialog gantt-link-edit-dialog gantt-bars-dialog"
      :close-on-click-modal="false"
      :close-on-press-escape="true"
      :append-to-body="true"
      :modal-append-to-body="true"
      @close="closeLinkEditModal"
    >
      <div class="gantt-link-edit-content">
        <div class="gantt-link-info" v-if="linkEditModal.link">
          <p><strong>From:</strong> {{ linkEditModal.link.fromTaskName }}</p>
          <p><strong>To:</strong> {{ linkEditModal.link.toTaskName }}</p>
        </div>

        <el-form label-width="120px" size="medium" ref="linkEditForm">
          <el-form-item label="Dependency Type">
            <el-select
              v-model="linkEditModal.type"
              placeholder="Select dependency type"
              class="gantt-dependency-type-selector"
              @change="onDependencyTypeChange"
              disabled
            >
              <el-option
                v-for="option in dependencyTypeOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
                class="gantt-dependency-type-option"
              >
                <span
                  class="dependency-type-icon"
                  :style="{ color: option.color }"
                >
                  {{ option.icon }}
                </span>
                <span class="dependency-type-label">{{ option.label }}</span>
                <div class="dependency-type-description">
                  {{ option.description }}
                </div>
              </el-option>
            </el-select>
          </el-form-item>

          <el-form-item label="Lag (Days)">
            <el-input-number
              v-model="linkEditModal.lag"
              :min="-999"
              :max="999"
              :step="1"
              :precision="0"
              placeholder="Enter lag value"
              class="gantt-lag-input"
              controls-position="right"
            >
              <template slot="append">days</template>
            </el-input-number>
            <div class="lag-help-text">
              <div class="lag-explanation">
                <strong>Lag说明：</strong>
                <ul>
                  <li><strong>正数 (+)：</strong> 延迟执行，推迟后续任务</li>
                  <li>
                    <strong>负数 (-)：</strong> 提前执行，后续任务提前启动
                  </li>
                  <li><strong>0：</strong> 无延迟，按依赖类型的默认规则执行</li>
                </ul>
              </div>
              <div class="lag-current-info" v-if="linkEditModal.link">
                <strong>当前配置：</strong>
                {{ getDependencyDescription(linkEditModal.type) }}
                <span v-if="linkEditModal.lag !== 0" class="lag-effect">
                  {{
                    getLagEffectDescription(
                      linkEditModal.type,
                      linkEditModal.lag
                    )
                  }}
                </span>
              </div>
            </div>
          </el-form-item>

          <el-form-item label="Label">
            <el-input
              v-model="linkEditModal.label"
              placeholder="Enter connection label"
              clearable
            />
          </el-form-item>

          <el-form-item label="Color">
            <div class="gantt-color-selector">
              <div
                class="gantt-color-preview"
                :style="{ backgroundColor: linkEditModal.color }"
              >
                <span class="color-text">{{ linkEditModal.color }}</span>
              </div>
              <div class="gantt-color-options">
                <div
                  v-for="color in availableColors"
                  :key="color"
                  class="gantt-color-option"
                  :class="{ selected: linkEditModal.color === color }"
                  :style="{ backgroundColor: color }"
                  @click="linkEditModal.color = color"
                ></div>
              </div>
            </div>
          </el-form-item>
        </el-form>
      </div>

      <div slot="footer" class="dialog-footer">
        <div>
          <el-button
            type="danger"
            @click="deleteLinkFromModal"
            v-if="connectionEditable"
          >
            Delete Connection
          </el-button>
        </div>
        <div>
          <el-button @click="closeLinkEditModal"> Cancel </el-button>
          <el-button
            type="primary"
            @click="saveLinkChanges"
            :loading="linkEditModal.saving"
          >
            Save Changes
          </el-button>
        </div>
      </div>
    </el-dialog>

    <!-- Tooltip -->
    <div
      v-if="tooltip.visible"
      class="gantt-tooltip"
      :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
      @mouseenter="onTooltipMouseEnter"
      @mouseleave="onTooltipMouseLeave"
    >
      <div class="tooltip-header">
        <div class="tooltip-title">{{ tooltip.task.name }}</div>
        <div
          class="tooltip-progress"
          :class="getTooltipStatusClass(tooltip.task)"
        >
          {{ tooltip.task.progress || 0 }}%
        </div>
      </div>
      <div class="tooltip-content">
        <div class="tooltip-row">
          <span class="tooltip-label">Start:</span>
          <span class="tooltip-value">{{
            formatTooltipDate(tooltip.task.startDate)
          }}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">End:</span>
          <span class="tooltip-value">{{
            formatTooltipDate(tooltip.task.endDate)
          }}</span>
        </div>
        <div class="tooltip-row" v-if="tooltip.task.planStartDate">
          <span class="tooltip-label">Plan Start:</span>
          <span class="tooltip-value plan-date-tooltip">{{
            formatTooltipDate(tooltip.task.planStartDate)
          }}</span>
        </div>
        <div class="tooltip-row" v-if="tooltip.task.planEndDate">
          <span class="tooltip-label">Plan End:</span>
          <span class="tooltip-value plan-date-tooltip">{{
            formatTooltipDate(tooltip.task.planEndDate)
          }}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Status:</span>
          <span
            class="tooltip-value status"
            :class="getTooltipStatusClass(tooltip.task)"
          >
            {{ getTaskStatus(tooltip.task) }}
          </span>
        </div>
        <div class="tooltip-row" v-if="tooltip.task.milestone">
          <span class="tooltip-label">Type:</span>
          <span class="tooltip-value milestone">Milestone</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import moment from "moment";
import { mapState, mapActions, mapGetters } from "vuex";
import { getTaskTypeConfig } from "@/config/features";
import {
  getDependencyTypeOptions,
  getDependencyTypeConfig,
} from "@/config/dependencyTypes";
import { DependencyConstraintEngine } from "@/services/dependencyConstraints";

export default {
  name: "GanttBars",
  props: {
    tasks: {
      type: Array,
      required: true,
    },
    dependencies: {
      type: Array,
      default: () => [],
    },
    startDate: {
      type: String,
      required: true,
    },
    endDate: {
      type: String,
      required: true,
    },
    unitWidth: {
      type: Number,
      required: false,
    },
    chartWidth: {
      type: Number,
      required: true,
    },
    chartHeight: {
      type: Number,
      required: true,
    },
    containerWidth: {
      type: Number,
      default: null,
    },
    viewMode: {
      type: String,
      default: "month",
    },
    leftPanelWidth: {
      type: Number,
      default: 0,
    },
    selectedTask: {
      type: Object,
      default: null,
    },
    highlightedRowId: {
      type: [String, Number],
      default: null,
    },
    // Tooltip配置
    tooltipEnabled: {
      type: Boolean,
      default: false,
    },
    tooltipDelay: {
      type: Number,
      default: 1000,
    },
    tooltipHideDelay: {
      type: Number,
      default: 300,
    },
    // 节点显示配置选项
    showTaskName: {
      type: Boolean,
      default: true,
    },
    showProgress: {
      type: Boolean,
      default: true,
    },
    showProgressHandle: {
      type: Boolean,
      default: true,
    },
    // 新增配置项
    showConnections: {
      type: Boolean,
      default: true,
    },
    showConnectionLabels: {
      type: Boolean,
      default: false,
    },
    showPlanNodes: {
      type: Boolean,
      default: false,
    },
    showMilestones: {
      type: Boolean,
      default: true,
    },
    showCriticalPath: {
      type: Boolean,
      default: false,
    },
    allowParentDrag: {
      type: Boolean,
      default: false, // 默认不允许父节点拖拽
    },
    allowParentEdit: {
      type: Boolean,
      default: false, // 默认不允许父节点编辑
    },
    highlightTaskLineage: {
      type: Boolean,
      default: false, // 点击节点是否高亮显示血缘关系
    },
    // 连接线是否可编辑
    connectionEditable: {
      type: Boolean,
      default: true, // 默认启用连接线编辑
    },
    // 连接线默认颜色（当不可编辑时）
    connectionDefaultColor: {
      type: String,
      default: "#9ca3af",
    },
    showDependencyLines: {
      type: Boolean,
      default: true, // 控制依赖线显示
    },
    // 父子节点时间是否关联配置
    linkParentChildDates: {
      type: Boolean,
      default: false, // 默认不关联，父子节点独立编辑
    },

    // 是否启用右键菜单
    enableContextMenu: {
      type: Boolean,
      default: true,
    },

    // 是否允许拖拽到可视区域外部
    allowDragOutside: {
      type: Boolean,
      default: false,
    },

    // 是否在甘特条后显示任务名称
    showTaskNames: {
      type: Boolean,
      default: true, // 默认显示任务名称
    },

    // 拖拽到外部时的配置
    dragOutsideConfig: {
      type: Object,
      default: () => ({
        enabled: true,
        expandDays: 30,
        maxExpansions: 10,
        animationDuration: 300,
      }),
    },

    // 父节点连线控制配置
    allowParentConnection: {
      type: Boolean,
      default: false, // 默认不允许父节点连线，保持兼容性
    },

    // 连线样式模式：'z-shaped' | 'traditional' | 'bezier' | 'smart'
    connectionStyle: {
      type: String,
      default: "smart", // 默认使用Z字形连线
      //default: 'z-shaped', // 默认使用Z字形连线
      validator: (value) =>
        ["z-shaped", "traditional", "bezier", "smart"].includes(value),
    },
    milestoneLinkable: {
      type: Boolean,
      default: false, // 默认不允许milestone连线
    },
  },
  data() {
    return {
      // 内部状态管理依赖线显示，避免直接修改prop
      internalShowDependencyLines: this.showDependencyLines,
      dragState: null,
      resizeState: null,
      connectionState: null,
      connectionPreview: null,
      temporarilyHideDependencies: false, // 控制拖拽时隐藏依赖线
      hidingTaskId: null, // 当前正在拖拽的任务ID，用于只隐藏相关的依赖线
      hidingTaskIds: [], // 存储需要隐藏连线的任务ID列表（父节点及其子节点）
      // dependencyLinesReady: false, // 已移除，防止连线闪烁
      isSourceNodeDragging: false, // 是否正在拖拽高亮源节点
      isLineageNodeDragging: false, // 是否正在拖拽血缘关系中的节点
      preventNextBarClick: false, // 阻止resize后的点击事件
      selectedDependency: null,
      // selectedTask移除，避免与prop重复

      // 性能优化相关
      rafId: null,
      pendingUpdates: null,
      updateThrottle: null,
      resizeThrottle: null,
      isDragOptimized: false,

      // 连线避障和缓存优化
      _dependencyLayoutCache: null, // 布局计算缓存，在mounted中初始化
      _layoutHash: null, // 布局哈希值
      _visibleAreaCache: null, // 可视区域缓存
      lineOffsetMap: null, // 连线偏移映射，在mounted中初始化
      connectionConflictMap: null, // 连线冲突检测映射，在mounted中初始化
      scrollUpdateTimer: null, // 滚动更新计时器

      colorPicker: {
        visible: false,
        x: 0,
        y: 0,
        targetLine: null,
      },
      connectionHint: {
        visible: false,
        x: 0,
        y: 0,
        text: "",
      },
      availableColors: [
        "#3498db",
        "#e74c3c",
        "#2ecc71",
        "#f39c12",
        "#9b59b6",
        "#1abc9c",
        "#34495e",
        "#e67e22",
        "#8e44ad",
        "#27ae60",
        "#16a085",
        "#c0392b",
        "#d35400",
        "#7f8c8d",
        "#2c3e50",
      ],
      // 任务编辑功能已移至GanttChart统一弹框
      // Element UI 相关
      predefineColors: [
        "#3498db",
        "#e74c3c",
        "#2ecc71",
        "#f39c12",
        "#9b59b6",
        "#1abc9c",
        "#34495e",
        "#e67e22",
        "#8e44ad",
        "#27ae60",
      ],
      // Tooltip 相关
      tooltip: {
        visible: false,
        x: 0,
        y: 0,
        task: null,
      },
      linkEditModal: {
        visible: false,
        link: null,
        label: "",
        color: "#3498db",
        type: "FS",
        lag: 0,
        originalState: null,
        saving: false,
      },
      progressDragState: null,
      tooltipConfig: {
        enabled: this.tooltipEnabled,
        delay: this.tooltipDelay,
        hideDelay: this.tooltipHideDelay,
      },
      tooltipTimer: null, // tooltip显示计时器
      tooltipHideTimer: null, // tooltip隐藏计时器
      scrollLeft: 0,
      preDragLineageSource: null,
      dragDelayTimer: null, // 拖拽延迟定时器
      dragPreventedByDblClick: false, // 全局双击防拖拽标志

      // 右键菜单相关
      contextMenu: {
        visible: false,
        x: 0,
        y: 0,
        type: null, // 'task' 或 'dependency'
        task: null,
        dependency: null,
      },

      // 拖拽扩展监听状态
      dragOutsideMonitoring: {
        enabled: false,
        task: null,
        expansionCount: 0,
        lastDirection: null,
      },
    };
  },
  watch: {
    // 监听prop变化，同步到内部状态
    showDependencyLines: {
      handler(newVal) {
        this.internalShowDependencyLines = newVal;
      },
      immediate: true,
    },
  },
  computed: {
    ...mapState({
      storeDependencies: "dependencies",
      highlightedConnections: "highlightedConnections",
      grayConnectionMode: "grayConnectionMode",
    }),
    ...mapGetters([
      "getDependencyLabel",
      "isTaskSelected",
      "isTaskHighlighted",
      "isTaskDimmed",
      "getTaskHighlightType",
      "isDependencyHighlighted",
    ]),

    // 计算总天数
    totalDays() {
      return moment(this.endDate).diff(moment(this.startDate), "days") + 1;
    },

    // 获取容器可用宽度
    actualContainerWidth() {
      // 优先使用父组件传入的宽度
      if (this.containerWidth) {
        return this.containerWidth;
      }

      // 尝试从多个层级获取实际容器宽度
      let width = 1200; // 默认值

      if (this.$el) {
        // 先尝试从组件元素本身获取
        width = this.$el.clientWidth;

        // 如果元素本身宽度为0或很小，尝试从父级获取
        if (width < 100) {
          let parent = this.$el.parentElement;
          while (parent && width < 100) {
            width = parent.clientWidth;
            parent = parent.parentElement;
          }
        }
      }

      return Math.max(width, 800); // 确保最小宽度
    },

    // 计算属性：获取实际单位宽度
    actualUnitWidth() {
      // 优先使用props传入的unitWidth
      if (this.unitWidth) {
        return this.unitWidth;
      }

      // 如果没有传入，则自动计算
      const availableWidth = Math.max(this.actualContainerWidth, 800);

      let baseWidth;
      switch (this.viewMode) {
        case "day":
          baseWidth = Math.min(
            Math.max(availableWidth / this.totalDays, 40),
            80
          );
          break;
        case "month":
          baseWidth = Math.min(
            Math.max(availableWidth / this.totalDays, 3),
            20
          );
          break;
        case "quarter":
          baseWidth = Math.min(
            Math.max(availableWidth / this.totalDays, 2),
            10
          );
          break;
        case "year":
          baseWidth = Math.min(Math.max(availableWidth / this.totalDays, 1), 5);
          break;
        default:
          baseWidth = Math.max(availableWidth / this.totalDays, 3);
      }

      return baseWidth;
    },

    actualChartWidth() {
      // 优先使用props传入的chartWidth
      if (this.chartWidth) {
        return this.chartWidth;
      }

      // 如果没有传入，则自动计算
      if (!this.startDate || !this.endDate) return 1200;
      const daysDiff = moment(this.endDate).diff(
        moment(this.startDate),
        "days"
      );
      return Math.max(daysDiff * this.actualUnitWidth, 1200);
    },

    actualChartHeight() {
      // 优先使用props传入的chartHeight
      if (this.chartHeight) {
        return this.chartHeight;
      }

      // 如果没有传入，则自动计算
      return this.tasks.length * 40 + 100;
    },

    uniqueColors() {
      const colors = new Set(["#3498db", "#ff4757", "#666"]); // 默认颜色
      this.dependencies.forEach((dep) => {
        if (dep.color) colors.add(dep.color);
      });
      return Array.from(colors);
    },

    // 计算关键路径任务ID集合
    criticalPathTaskIds() {
      // 如果未启用关键路径显示，返回空集合
      if (!this.showCriticalPath) {
        return new Set();
      }

      // 计算关键路径并返回ID集合
      const criticalPathIds = this.calculateCriticalPath();
      return new Set(criticalPathIds);
    },

    // 获取任务持续时间（计算属性）
    taskDuration() {
      return (task) => {
        if (!task.startDate || !task.endDate) return 1; // 默认至少1天
        const start = moment(task.startDate);
        const end = moment(task.endDate);
        // 计算持续天数（包括开始和结束日）
        return end.diff(start, "days") + 1;
      };
    },

    taskBars() {
      return this.tasks.map((task, index) => {
        const left = this.getDatePosition(task.startDate);
        const endLeft = this.getDatePosition(task.endDate);
        const width = Math.max(endLeft - left, 60); // 最小宽度60px

        // 计划日期位置（如果有）
        let planLeft, planWidth;
        if (task.planStartDate && task.planEndDate) {
          planLeft = this.getDatePosition(task.planStartDate);
          const planEndLeft = this.getDatePosition(task.planEndDate);
          planWidth = Math.max(planEndLeft - planLeft, 60);
        }

        // 检查是否为关键路径任务
        const isCriticalPath = this.criticalPathTaskIds.has(task.id);

        return {
          task,
          index,
          left,
          width,
          planLeft,
          planWidth,
          isCriticalPath,
          isDragging: this.dragState && this.dragState.bar.task.id === task.id,
        };
      });
    },

    dependencyLines() {
      // 计算最新的连线，响应selectedDependency变化
      // 强制依赖selectedDependency，确保选中状态变化时重新计算
      const selectedKey = this.selectedDependency
        ? `${this.selectedDependency.from}-${this.selectedDependency.to}`
        : null;

      // console.log('[调试] dependencyLines计算，选中连线:', selectedKey)
      return this.calculateDependencyLines();
    },

    // 判断任务是否在高亮连接中
    isTaskInHighlight() {
      return (taskId) => {
        if (!this.highlightedConnections.sourceTaskId) return false;
        return (
          taskId === this.highlightedConnections.sourceTaskId ||
          this.highlightedConnections.relatedTaskIds.includes(taskId)
        );
      };
    },

    // 判断任务是否为连接源
    isConnectionSource() {
      return (taskId) => {
        return taskId === this.highlightedConnections.sourceTaskId;
      };
    },

    // 获取与指定任务相关的所有任务ID
    getRelatedTasks() {
      return (taskId) => {
        const relatedIds = new Set();
        this.dependencies.forEach((dep) => {
          if (dep.from === taskId) {
            relatedIds.add(dep.to);
          }
          if (dep.to === taskId) {
            relatedIds.add(dep.from);
          }
        });
        return Array.from(relatedIds);
      };
    },

    // 判断依赖关系是否被高亮
    isDependencyHighlighted() {
      return (line) => {
        if (!this.highlightedConnections.isHighlightMode) return false;

        return this.highlightedConnections.relatedDependencies.some(
          (dep) => dep.from === line.from && dep.to === line.to
        );
      };
    },

    // 获取任务高亮类型
    getTaskHighlightType() {
      return (taskId) => {
        if (!this.highlightedConnections.isHighlightMode) return null;

        if (taskId === this.highlightedConnections.sourceTaskId) {
          return "source";
        } else if (this.highlightedConnections.upstreamTasks.includes(taskId)) {
          return "upstream";
        } else if (
          this.highlightedConnections.downstreamTasks.includes(taskId)
        ) {
          return "downstream";
        }

        return null;
      };
    },

    // 判断任务是否被高亮
    isTaskHighlighted() {
      return (taskId) => {
        return this.highlightedConnections.relatedTaskIds.includes(taskId);
      };
    },

    // 判断任务是否被淡化
    isTaskDimmed() {
      return (taskId) => {
        return (
          this.highlightedConnections.isHighlightMode &&
          !this.highlightedConnections.relatedTaskIds.includes(taskId)
        );
      };
    },

    // 所有可用颜色（包括灰色）
    allAvailableColors() {
      const grayColor = "#9e9e9e"; // bryntum风格的灰色
      return [...this.availableColors, grayColor];
    },

    // 获取依赖类型选项
    dependencyTypeOptions() {
      return this.$store.getters.dependencyTypeOptions || [];
    },

    // 获取所有需要箭头标记的颜色
    arrowColors() {
      const colors = new Set();

      // 添加默认颜色
      colors.add("#666");
      colors.add("#3498db");
      colors.add("#ff4757"); // 选中状态
      colors.add("#1890ff"); // 高亮状态

      // 添加可用颜色
      this.availableColors.forEach((color) => colors.add(color));

      // 添加依赖线中使用的颜色
      this.dependencies.forEach((dep) => {
        if (dep.color) colors.add(dep.color);
      });

      return Array.from(colors);
    },

    visibleDependencyLines() {
      // 仅渲染可见区的依赖线，提升性能
      if (!this.internalShowDependencyLines || this.temporarilyHideDependencies)
        return [];
      const visibleTaskIds = this.getVisibleTaskIds(); // 获取可见任务ID
      return this.dependencyLines.filter(
        (line) =>
          visibleTaskIds.includes(line.from) || visibleTaskIds.includes(line.to)
      );
    },
  },
  watch: {
    closeModalTrigger() {
      // 当父组件触发关闭模态框时
      this.closeTaskEditor();
    },
    highlightedRowId: {
      handler(newVal, oldVal) {
        // 强制更新以确保高亮样式应用
        this.$forceUpdate();
      },
      immediate: true,
    },
    // 监听任务数据变化，清除依赖线缓存
    tasks: {
      handler(newTasks, oldTasks) {
        if (newTasks !== oldTasks) {
          this.clearDependencyCache();
        }
      },
    },
    // 监听依赖关系变化，清除缓存
    storeDependencies: {
      handler(newDeps, oldDeps) {
        if (newDeps !== oldDeps) {
          this.clearDependencyCache();
        }
      },
    },
    // 监听时间轴变化，清除缓存
    actualUnitWidth(newVal, oldVal) {
      if (newVal !== oldVal) {
        this.clearDependencyCache();
      }
    },
    // 监听视图模式变化
    viewMode(newMode, oldMode) {
      if (newMode !== oldMode) {
        this.clearDependencyCache();
        this.$nextTick(() => {
          this.$forceUpdate();
        });
      }
    },
    // 监听日期范围变化
    startDate() {
      this.clearDependencyCache();
      this.$nextTick(() => {
        this.$forceUpdate();
      });
    },
    endDate() {
      this.clearDependencyCache();
      this.$nextTick(() => {
        this.$forceUpdate();
      });
    },
    // 监听tooltip配置变化
    tooltipEnabled(newVal) {
      this.tooltipConfig.enabled = newVal;
      if (!newVal) {
        this.hideTooltip();
      }
    },
    tooltipDelay(newVal) {
      this.tooltipConfig.delay = newVal;
    },
    tooltipHideDelay(newVal) {
      this.tooltipConfig.hideDelay = newVal;
    },
    // 监听连线选中状态变化
    selectedDependency: {
      handler(newVal, oldVal) {
        console.log("[调试] selectedDependency变化:", newVal, oldVal);
        // 选中状态变化时，清除缓存并强制更新
        this._cachedDependencyLines = null;
        this.$forceUpdate();
      },
      deep: true,
    },
  },
  mounted() {
    // 初始化缓存Map对象，避免undefined错误
    this.initializeCacheMaps();

    this.setupEventListeners();
    this.$el.addEventListener("click", this.handleComponentClick);
    document.addEventListener("click", this.handleGlobalClick);

    // 监听窗口大小变化，重新计算
    this.handleResize = this.optimizedUpdate(() => {
      this.clearDependencyCache();
      this.$forceUpdate();
    }, 100); // 降低窗口大小变化的响应频率

    window.addEventListener("resize", this.handleResize);

    // 初始化时强制更新一次
    this.$nextTick(() => {
      // 直接更新，不再使用dependencyLinesReady控制闪烁
      this.clearDependencyCache();
      this.$forceUpdate();
    });

    // 监听父级滚动容器的scroll事件
    this.$nextTick(() => {
      let parent = this.$el;
      while (parent && !parent.classList.contains("gantt-scroll-container")) {
        parent = parent.parentElement;
      }
      this._ganttScrollContainer = parent;
      if (parent) {
        parent.addEventListener("scroll", this.handleParentScroll, {
          passive: true,
        });
        this.scrollLeft = parent.scrollLeft;
      }
    });

    // 初始化父节点指示器状态
    this.$nextTick(() => {
      this.updateParentIndicators();
    });

    // 添加全局点击事件监听，用于关闭右键菜单
    document.addEventListener("click", this.hideContextMenu);
    document.addEventListener("contextmenu", this.hideContextMenu);

    // 首次渲染后强制刷新依赖线，解决初始化只显示部分连线问题
    this.$nextTick(() => {
      this.$forceUpdate();
    });
  },
  beforeDestroy() {
    // 强制清理拖拽状态，防止内存泄漏
    this.forceClearDragState();

    // 清理所有计时器，防止内存泄漏
    if (this.tooltipTimer) {
      clearTimeout(this.tooltipTimer);
    }
    if (this.tooltipHideTimer) {
      clearTimeout(this.tooltipHideTimer);
    }

    // 移除全局事件监听器
    document.removeEventListener("mousemove", this.handleMouseMove);
    document.removeEventListener("mouseup", this.handleMouseUp);
    document.removeEventListener("click", this.handleGlobalClick);

    if (this._ganttScrollContainer) {
      this._ganttScrollContainer.removeEventListener(
        "scroll",
        this.handleParentScroll
      );
    }

    // 移除全局事件监听
    document.removeEventListener("click", this.hideContextMenu);
    document.removeEventListener("contextmenu", this.hideContextMenu);

    // 清理缓存Map对象，防止内存泄漏
    if (this._dependencyLayoutCache) {
      this._dependencyLayoutCache.clear();
      this._dependencyLayoutCache = null;
    }
    if (this.lineOffsetMap) {
      this.lineOffsetMap.clear();
      this.lineOffsetMap = null;
    }
    if (this.connectionConflictMap) {
      this.connectionConflictMap.clear();
      this.connectionConflictMap = null;
    }
    if (this.scrollUpdateTimer) {
      clearTimeout(this.scrollUpdateTimer);
      this.scrollUpdateTimer = null;
    }
  },
  methods: {
    ...mapActions([
      "addDependency",
      "updateDependencyLabel",
      "removeDependency",
    ]),

    // 检查任务是否已折叠
    isTaskCollapsed(taskId) {
      return this.$store.getters.isTaskCollapsed(taskId);
    },

    setupEventListeners() {
      // 移除被动监听器，保持原有的事件处理能力
      document.addEventListener("mousemove", this.handleMouseMove);
      document.addEventListener("mouseup", this.handleMouseUp);
    },

    removeEventListeners() {
      document.removeEventListener("mousemove", this.handleMouseMove);
      document.removeEventListener("mouseup", this.handleMouseUp);

      // 清理RAF
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }

      // 清理节流
      if (this.updateThrottle) {
        clearTimeout(this.updateThrottle);
        this.updateThrottle = null;
      }
    },

    // 优化的防抖更新函数
    optimizedUpdate(updateFn, delay = 16) {
      if (this.updateThrottle) {
        clearTimeout(this.updateThrottle);
      }

      this.updateThrottle = setTimeout(() => {
        updateFn();
      }, delay);
    },

    // 批量处理DOM更新
    batchDOMUpdate(updates) {
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
      }

      this.rafId = requestAnimationFrame(() => {
        updates.forEach((update) => update());
      });
    },

    getDatePosition(date) {
      // 防护措施：确保输入有效
      if (!date || !this.startDate || !this.actualUnitWidth) {
        return 0;
      }

      // 确保日期从开始的整天算起
      const startOfDay = moment(date).startOf("day");
      const startOfStartDate = moment(this.startDate).startOf("day");
      const daysDiff = startOfDay.diff(startOfStartDate, "days");

      // 使用与Timeline相同的单位宽度直接计算
      const result = daysDiff * this.actualUnitWidth;

      // 防护：确保返回有效数值
      return isNaN(result) ? 0 : result;
    },

    getPositionDate(position) {
      // 使用与Timeline一致的计算方式
      const days = position / this.actualUnitWidth;
      return moment(this.startDate)
        .startOf("day")
        .add(Math.round(days), "days");
    },

    onBarMouseDown(bar, event) {
      // 调试信息：输出拖拽事件触发情况
      console.log("[拖拽调试] onBarMouseDown 触发", {
        taskId: bar.task.id,
        taskName: bar.task.name,
        button: event.button,
        target: event.target.className,
        dragPreventedByDblClick: this.dragPreventedByDblClick,
      });

      // 只处理左键点击（button=0），右键点击不触发拖动
      if (event.button !== 0) {
        console.log("[拖拽调试] 非左键点击，忽略拖拽");
        return;
      }

      // 双击后短时间内禁止拖拽
      if (this.dragPreventedByDblClick) {
        console.log("[拖拽调试] 双击后禁止拖拽期间，忽略拖拽");
        event.preventDefault();
        return;
      }

      console.log("[拖拽调试] 设置拖拽延迟定时器，150ms后开始拖拽");
      // 拖拽延迟判定，150ms后才允许拖拽
      this.dragDelayTimer = setTimeout(() => {
        if (!this.dragPreventedByDblClick) {
          console.log("[拖拽调试] 延迟时间到，开始执行拖拽");
          this.startDrag(bar, event);
        } else {
          console.log("[拖拽调试] 延迟期间发生双击，取消拖拽");
        }
        this.dragDelayTimer = null;
      }, 150);
    },

    onBarDblClick(bar, event) {
      if (this.dragDelayTimer) {
        clearTimeout(this.dragDelayTimer);
        this.dragDelayTimer = null;
      }
      this.dragPreventedByDblClick = true;
      setTimeout(() => {
        this.dragPreventedByDblClick = false;
      }, 300);
      this.editTask(bar.task);
    },

    startDrag(bar, event) {
      if (this.dragPreventedByDblClick) {
        return;
      }
      // 阻止在连接模式下拖拽任务
      if (this.connectionState) {
        return;
      }

      // 如果点击的是父节点的展开/折叠图标，不进行拖拽
      if (bar.task.isParentNode && event.target.closest(".parent-indicator")) {
        // 处理折叠/展开逻辑已经在parent-indicator的click事件中处理
        // 这里只需阻止拖拽即可
        return;
      }

      // 检查父节点拖拽配置，如果不允许父节点拖拽且当前是父节点，则阻止拖拽
      if (bar.task.isParentNode && !this.allowParentDrag) {
        console.log("父节点拖拽已禁用");
        return;
      }

      // 检查任务拖拽权限 - 右侧节点每一行都需要有编辑权限控制
      if (!this.hasPermission(bar.task, "movable")) {
        this.$message.warning("该任务不允许拖拽移动");
        event.preventDefault();
        return;
      }

      // 拖拽前暂存高亮血缘状态
      this._preDragLineageSource =
        this.$store.state.highlightedConnections?.sourceTaskId;
      console.log(
        "[调试] startDrag 被调用",
        bar.task.id,
        "高亮源:",
        this._preDragLineageSource
      );

      // 只隐藏与当前拖拽节点相关的血缘关系线
      if (
        this._preDragLineageSource &&
        this._preDragLineageSource === bar.task.id
      ) {
        // 只有当拖拽的是高亮源节点时才清除高亮
        this.$store.dispatch("clearLineageHighlight");
        console.log("[调试] 已清空高亮血缘 - 拖拽的是源节点");
        this._isSourceNodeDragging = true;
      } else if (this._preDragLineageSource) {
        // 检查当前拖拽的节点是否在高亮的血缘关系中
        const isInLineage = this.isTaskHighlighted(bar.task.id);
        if (isInLineage) {
          // 只有当拖拽的节点在血缘关系中时才清除高亮
          this.$store.dispatch("clearLineageHighlight");
          console.log("[调试] 已清空高亮血缘 - 拖拽的节点在血缘关系中");
          this._isLineageNodeDragging = true;
        } else {
          // 拖拽的节点不在血缘关系中，不需要清除高亮
          console.log("[调试] 保留高亮血缘 - 拖拽的节点不在血缘关系中");
          this._isLineageNodeDragging = false;
          this._isSourceNodeDragging = false;
        }
      }

      // 父节点拖拽时隐藏所有子节点的相关连线
      if (bar.task.isParentNode) {
        // 获取所有子节点ID
        const childTaskIds = this.getAllChildTaskIds(bar.task.id);
        // 隐藏父节点及其所有子节点的连接线
        this.hidingTaskIds = [bar.task.id, ...childTaskIds];
        this.temporarilyHideDependencies = true;

        // 显示拖拽提示
        console.log(`开始拖拽父节点: ${bar.task.name}，将同时移动所有子节点`);

        // 添加视觉反馈
        const barElement = event.target.closest(".gantt-bar");
        if (barElement) {
          barElement.classList.add("parent-dragging-active");
        }
      } else {
        // 普通节点只隐藏与当前节点相关的依赖连接线
        this.hidingTaskId = bar.task.id;
        this.temporarilyHideDependencies = false;
      }

      // 立即阻止事件传播，防止触发背景拖拽
      event.preventDefault();
      event.stopPropagation();

      // 通知父组件开始拖拽，禁用背景交互
      this.$emit("node-drag-start", bar.task);

      // 如果启用了拖拽扩展功能，设置监听
      if (this.allowDragOutside && this.dragOutsideConfig.enabled) {
        this.dragOutsideMonitoring = {
          enabled: true,
          task: bar.task,
          expansionCount: 0,
        };
      }

      setTimeout(() => {
        this.dragState = {
          bar,
          startX: event.clientX,
          startLeft: bar.left,
          originalStartDate: moment(bar.task.startDate),
          originalEndDate: moment(bar.task.endDate),
          isParentNode: bar.task.isParentNode, // 标记是否为父级节点
          // 父节点拖拽优化参数
          lastUpdateTime: Date.now(),
          lastDaysDelta: 0,
          dragStartTime: Date.now(), // 记录拖拽开始时间
          dragVelocity: 0, // 记录拖拽速度
          lastX: event.clientX, // 记录上一次鼠标位置
          smoothingFactor: 0.3, // 平滑因子，值越小移动越平滑
        };
        this.clearDependencyCache();

        console.log("[调试] dragState 已设置", this.dragState);
      }, 0);

      this.internalShowDependencyLines = false; // 拖拽时隐藏依赖线
    },

    // 获取任务的所有子任务ID（递归）
    getAllChildTaskIds(taskId) {
      const childIds = [];

      const findChildren = (tasks, parentId) => {
        for (const task of tasks) {
          if (task.id === parentId) {
            if (task.children && task.children.length > 0) {
              task.children.forEach((child) => {
                childIds.push(child.id);
                // 递归查找子节点的子节点
                findChildren(tasks, child.id);
              });
            }
            return true;
          }

          if (task.children && task.children.length > 0) {
            if (findChildren(task.children, parentId)) {
              return true;
            }
          }
        }
        return false;
      };

      findChildren(this.tasks, taskId);
      return childIds;
    },

    // 折叠/展开任务
    toggleTaskCollapse(taskId) {
      // 调用store的折叠/展开动作
      this.$store.dispatch("toggleTaskCollapsed", taskId);

      // 更新父节点指示器的显示
      this.$nextTick(() => {
        this.updateParentIndicators();
      });
    },

    // 更新父节点指示器的显示（已简化，事件绑定现在直接在模板中处理）
    updateParentIndicators() {
      // 由于事件现在直接在模板中绑定，这个方法现在主要用于强制更新
      this.$forceUpdate();
    },

    startResize(bar, direction, event) {
      // 阻止父节点的大小调整
      if (bar.task.isParentNode) {
        return;
      }

      // 阻止事件冒泡和默认行为
      event.stopPropagation();
      event.preventDefault();

      // 设置标志，阻止下一次点击事件
      this.preventNextBarClick = true;

      this.resizeState = {
        bar,
        direction,
        startX: event.clientX,
        startLeft: bar.left,
        startWidth: bar.width,
        originalStartDate: moment(bar.task.startDate),
        originalEndDate: moment(bar.task.endDate),
      };

      // 添加调整大小时的样式类
      const barElement = event.target.closest(".gantt-bar");
      if (barElement) {
        barElement.classList.add("resizing");
      }

      // 调整开始后清除缓存
      this.clearDependencyCache();
    },

    startConnection(bar, point, event) {
      this.connectionState = {
        fromBar: bar,
        fromPoint: point,
        startX: event.clientX,
        startY: event.clientY,
      };

      // 显示连接提示
      if (!this.$el || typeof this.$el.getBoundingClientRect !== "function") {
        console.warn("startConnection: 组件未正确挂载或$el无效");
        return;
      }

      const rect = this.$el.getBoundingClientRect();
      this.connectionHint = {
        visible: true,
        x: event.clientX - rect.left + this.scrollLeft,
        y: event.clientY - rect.top - 30,
        text: "Drag to another task to create connection",
      };

      // 连接开始后清除缓存
      this.clearDependencyCache();
      event.preventDefault();
      this.internalShowDependencyLines = false; // 连线时隐藏依赖线
    },

    handleConnectionHover(bar, point) {
      if (
        this.connectionState &&
        this.connectionState.fromBar.task.id !== bar.task.id
      ) {
        // 当拖拽到有效目标时显示提示
        this.connectionHint.text = `Release to connect to "${bar.task.name}"`;
      }
    },

    handleConnectionLeave() {
      if (this.connectionState) {
        this.connectionHint.text = "Drag to another task to create connection";
      }
    },

    handleMouseMove(event) {
      // 简化RAF优化，确保不阻塞正常事件处理
      if (this.dragState) {
        this.handleDragMove(event);
      } else if (this.resizeState) {
        this.handleResizeMove(event);
      } else if (this.connectionState) {
        this.handleConnectionMove(event);
      } else if (this.progressDragState) {
        this.handleProgressDragMove(event);
      }
    },

    handleDragMove(event) {
      if (this.dragPreventedByDblClick) {
        return;
      }
      if (!this.dragState) {
        return;
      }

      // 简单的节流：跳过重复的鼠标位置
      if (this.dragState.lastMouseX === event.clientX) {
        return;
      }
      this.dragState.lastMouseX = event.clientX;

      const deltaX = event.clientX - this.dragState.startX;
      const newLeft = this.dragState.startLeft + deltaX;
      const newStartDate = this.getPositionDate(newLeft);
      const duration = this.dragState.originalEndDate.diff(
        this.dragState.originalStartDate,
        "days"
      );
      const newEndDate = newStartDate.clone().add(duration, "days");
      const daysDelta = newStartDate.diff(
        this.dragState.originalStartDate,
        "days"
      );

      // 简化拖拽逻辑，直接更新无延迟
      this.pendingUpdates = {
        id: this.dragState.bar.task.id,
        updates: {
          startDate: newStartDate.format("YYYY-MM-DD"),
          endDate: newEndDate.format("YYYY-MM-DD"),
        },
        isParentNode: this.dragState.isParentNode,
        daysDelta,
      };

      // 优化拖拽超出可视范围的处理
      // 获取父滚动容器
      const scrollContainer = this._ganttScrollContainer;
      if (scrollContainer) {
        // 检查是否需要自动滚动
        const containerRect = scrollContainer.getBoundingClientRect();
        const mouseX = event.clientX;
        const scrollMargin = 80; // 增加边缘检测范围，更早开始滚动

        // 记录当前拖拽方向
        if (!this.dragState.lastMouseX) {
          this.dragState.lastMouseX = mouseX;
        }
        const dragDirection =
          mouseX < this.dragState.lastMouseX ? "left" : "right";
        this.dragState.lastMouseX = mouseX;

        // 如果鼠标接近左边缘或向左拖拽时超出左边缘，向左滚动
        if (
          mouseX < containerRect.left + scrollMargin ||
          (dragDirection === "left" &&
            mouseX < containerRect.left + containerRect.width * 0.3)
        ) {
          // 基础滚动速度
          let scrollSpeed = Math.max(
            15,
            (scrollMargin - (mouseX - containerRect.left)) / 1
          );

          // 如果鼠标已经超出左边缘或接近左边缘，加速滚动
          if (mouseX <= containerRect.left + 20) {
            // 鼠标已经超出或接近左边缘，大幅加速滚动
            scrollSpeed = Math.max(scrollSpeed, 40);
          }

          // 应用滚动
          scrollContainer.scrollLeft = Math.max(
            0,
            scrollContainer.scrollLeft - scrollSpeed
          );
          this.scrollLeft = scrollContainer.scrollLeft;

          // 检查是否已经滚动到最左侧，如果是则需要动态平移视图
          if (scrollContainer.scrollLeft <= 0 && dragDirection === "left") {
            // 计算需要的平移量
            const panAmount = Math.min(50, Math.max(10, scrollSpeed / 2));

            // 触发视图平移事件，通知父组件更新panOffset和时间轴
            this.$emit("request-pan", {
              direction: "right", // 向右平移视图，使内容向左移动
              amount: panAmount,
              updateTimeline: true, // 告知父组件需要更新时间轴
              extendLeft: true, // 指示需要向左扩展时间轴
            });

            // 更新拖拽状态，调整位置以保持拖拽的连续性
            if (this.dragState) {
              this.dragState.startX -= panAmount;
              if (this.dragState.lastClientX) {
                this.dragState.lastClientX -= panAmount;
              }
            }

            // 通知父组件更新甘特图宽度
            this.$emit("update-chart-width", {
              direction: "left",
              amount: panAmount,
            });
          }

          // 强制更新视图，确保拖拽元素位置正确
          this.$forceUpdate();
        }
        // 如果鼠标接近右边缘或向右拖拽时超出右边缘，向右滚动
        else if (
          mouseX > containerRect.right - scrollMargin ||
          (dragDirection === "right" &&
            mouseX > containerRect.right - containerRect.width * 0.3)
        ) {
          // 基础滚动速度
          let scrollSpeed = Math.max(
            15,
            (mouseX - (containerRect.right - scrollMargin)) / 1
          );

          // 如果鼠标已经超出右边缘或接近右边缘，加速滚动
          if (mouseX >= containerRect.right - 20) {
            // 鼠标已经超出或接近右边缘，大幅加速滚动
            scrollSpeed = Math.max(scrollSpeed, 40);
          }

          // 应用滚动
          scrollContainer.scrollLeft += scrollSpeed;
          this.scrollLeft = scrollContainer.scrollLeft;

          // 检查是否需要向右扩展视图
          const maxScroll =
            scrollContainer.scrollWidth - scrollContainer.clientWidth;
          if (
            scrollContainer.scrollLeft >= maxScroll - 50 &&
            dragDirection === "right"
          ) {
            // 触发视图平移事件，通知父组件更新时间轴
            this.$emit("request-pan", {
              direction: "right",
              amount: 0, // 不需要平移，只需要扩展
              updateTimeline: true,
              extendRight: true, // 指示需要向右扩展时间轴
            });

            // 通知父组件更新甘特图宽度
            this.$emit("update-chart-width", {
              direction: "right",
              amount: scrollSpeed,
            });
          }

          // 检查是否拖拽到外部并触发扩展
          if (this.dragOutsideMonitoring.enabled) {
            this.checkDragOutside(event, "right");
          }

          // 强制更新视图，确保拖拽元素位置正确
          this.$forceUpdate();
        }
      }

      // 发送数据更新事件，添加linkParentChildDates配置
      if (this.pendingUpdates) {
        this.$emit("bar-drag", {
          ...this.pendingUpdates,
          linkParentChildDates: this.linkParentChildDates, // 传递父子节点时间关联配置
        });
        this.pendingUpdates = null;
      }
    },

    handleResizeMove(event) {
      if (!this.resizeState) {
        return;
      }

      const deltaX = event.clientX - this.resizeState.startX;
      const minWidth = 60; // 最小宽度限制

      let updates = null;

      if (this.resizeState.direction === "left") {
        const newLeft = this.resizeState.startLeft + deltaX;
        const maxLeft =
          this.resizeState.startLeft + this.resizeState.startWidth - minWidth;
        const constrainedLeft = Math.min(newLeft, maxLeft);
        const newStartDate = this.getPositionDate(constrainedLeft);

        updates = {
          id: this.resizeState.bar.task.id,
          updates: {
            startDate: newStartDate.format("YYYY-MM-DD"),
          },
        };
      } else {
        const newWidth = this.resizeState.startWidth + deltaX;
        const constrainedWidth = Math.max(newWidth, minWidth);
        const newEndPosition = this.resizeState.startLeft + constrainedWidth;
        const newEndDate = this.getPositionDate(newEndPosition);

        updates = {
          id: this.resizeState.bar.task.id,
          updates: {
            endDate: newEndDate.format("YYYY-MM-DD"),
          },
        };
      }

      if (updates) {
        this.pendingUpdates = updates;

        // 优化拖拽超出可视范围的处理
        const scrollContainer = this._ganttScrollContainer;
        if (scrollContainer) {
          // 检查是否需要自动滚动
          const containerRect = scrollContainer.getBoundingClientRect();
          const mouseX = event.clientX;
          const scrollMargin = 50; // 距离边缘多少像素开始滚动

          // 如果鼠标接近右边缘，向右滚动
          if (mouseX > containerRect.right - scrollMargin) {
            const scrollSpeed = Math.max(
              5,
              (mouseX - (containerRect.right - scrollMargin)) / 2
            );
            scrollContainer.scrollLeft += scrollSpeed;
            this.scrollLeft = scrollContainer.scrollLeft;
          }
        }

        // 立即更新，不使用动画
        this.clearDependencyCache();
        this.$forceUpdate();

        // 发送resize更新事件，添加linkParentChildDates配置
        if (this.pendingUpdates) {
          this.$emit("bar-resize", {
            ...this.pendingUpdates,
            linkParentChildDates: this.linkParentChildDates, // 传递父子节点时间关联配置
          });
          this.pendingUpdates = null;
        }
      }
    },

    handleConnectionMove(event) {
      if (!this.connectionState) {
        return;
      }
      // 防止undefined错误：安全检查event和this.$el
      if (!event || !this.$el) {
        console.warn("handleConnectionMove: event或$el无效");
        return;
      }
      // 获取SVG容器（预览连线所在SVG）的rect
      const svgPreview =
        this.$el && typeof this.$el.querySelector === "function"
          ? this.$el.querySelector(".gantt-connection-preview")
          : null;
      const svgRect = svgPreview
        ? svgPreview.getBoundingClientRect()
        : this.$el.getBoundingClientRect();
      // 鼠标在SVG容器内的坐标
      const mouseX = event.clientX - svgRect.left;
      const mouseY = event.clientY - svgRect.top;
      const { fromBar } = this.connectionState;
      if (!fromBar) {
        console.warn("handleConnectionMove: fromBar无效");
        return;
      }
      // 计算起始连接点位置（同样以SVG容器为基准）
      let startX, startY;
      const elRect = this.$el.getBoundingClientRect();
      if (this.connectionState.fromPoint === "start") {
        startX = fromBar.left - (elRect.left - svgRect.left) - 16; // 与连接点位置保持一致
        startY = fromBar.index * 28 + 14; // 修复连线起始Y坐标
      } else {
        startX =
          fromBar.left + fromBar.width - (elRect.left - svgRect.left) + 16; // 与连接点位置保持一致
        startY = fromBar.index * 28 + 14; // 修复连线起始Y坐标
      }
      // 判断鼠标是否悬停在有效目标节点上
      let endX = mouseX;
      let endY = mouseY;
      const targetElement = document.elementFromPoint(
        event.clientX,
        event.clientY
      );
      if (targetElement && targetElement.classList.contains("gantt-bar")) {
        // 获取目标节点中心点的屏幕坐标
        const barRect = targetElement.getBoundingClientRect();
        const barCenterX = (barRect.left + barRect.right) / 2;
        const barCenterY = (barRect.top + barRect.bottom) / 2;
        // 换算为SVG容器内坐标
        endX = barCenterX - svgRect.left;
        endY = barCenterY - svgRect.top;
      }
      // 设置连接预览（以SVG容器为基准的坐标）
      this.connectionPreview = {
        startX,
        startY,
        endX,
        endY,
      };
      // 更新连接提示位置（使用SVG内坐标）
      this.connectionHint.x = mouseX + 10;
      this.connectionHint.y = mouseY - 30;
      this.connectionHint.visible = true;
      // 连线坐标计算完成 - 彻底消除滚动/偏移影响
    },

    handleMouseUp(event) {
      if (this.connectionState) {
        // 检查是否释放在另一个任务条上
        const targetElement = document.elementFromPoint(
          event.clientX,
          event.clientY
        );
        const targetBar = this.findBarFromElement(targetElement);

        if (
          targetBar &&
          targetBar.task.id !== this.connectionState.fromBar.task.id
        ) {
          // 检查是否已存在相同连接
          const exists = this.dependencies.find(
            (dep) =>
              dep.from === this.connectionState.fromBar.task.id &&
              dep.to === targetBar.task.id
          );

          if (!exists) {
            // 确定连接到目标任务的哪个点
            const targetPoint = this.getTargetConnectionPoint(event, targetBar);

            // 根据连接点类型确定依赖类型
            const dependencyType = this.getDependencyTypeFromPoints(
              this.connectionState.fromPoint,
              targetPoint
            );

            // 松手后创建真正的连接线 - 包含依赖类型信息
            this.addDependency({
              from: this.connectionState.fromBar.task.id,
              to: targetBar.task.id,
              type: dependencyType,
              lag: 0,
              color: this.getRandomColor(),
            });

            console.log("[调试] 依赖关系创建", {
              from: this.connectionState.fromBar.task.name,
              to: targetBar.task.name,
              fromPoint: this.connectionState.fromPoint,
              toPoint: targetPoint,
              type: dependencyType,
            });
          }
        }

        // 清理连接预览
        this.connectionPreview = null;
        this.connectionHint.visible = false;
      }

      // 父节点拖拽结束时的特殊处理
      if (this.dragState && this.dragState.isParentNode) {
        console.log(`父节点拖拽结束: ${this.dragState.bar.task.name}`);

        // 最后一次发送更新，确保所有更改都被保存
        if (this.pendingUpdates) {
          this.$emit("bar-drag", {
            ...this.pendingUpdates,
            linkParentChildDates: this.linkParentChildDates, // 传递父子节点时间关联配置
          });
          this.pendingUpdates = null;
        }
      }

      // 检查是否需要级联更新（在清理拖拽状态之前）
      if (this.dragState || this.resizeState) {
        const draggedTask =
          this.dragState?.bar?.task || this.resizeState?.bar?.task;
        if (draggedTask) {
          // 获取拖拽前的时间数据
          const originalStart =
            this.dragState?.originalStartDate?.format("YYYY-MM-DD") ||
            this.resizeState?.originalStartDate?.format("YYYY-MM-DD");
          const originalEnd =
            this.dragState?.originalEndDate?.format("YYYY-MM-DD") ||
            this.resizeState?.originalEndDate?.format("YYYY-MM-DD");

          // 获取当前任务的最新时间数据
          // 从store中获取最新的任务数据，确保获取到拖拽后的时间
          const currentTask = this.$store.getters.getTaskById(draggedTask.id);
          const currentStart = currentTask
            ? currentTask.startDate
            : draggedTask.startDate;
          const currentEnd = currentTask
            ? currentTask.endDate
            : draggedTask.endDate;

          console.log(`[拖拽级联更新] 检查任务 ${draggedTask.id} 时间变化:`, {
            originalStart,
            originalEnd,
            currentStart,
            currentEnd,
            hasDragState: !!this.dragState,
            hasResizeState: !!this.resizeState,
            currentTask: currentTask ? "found" : "not found",
          });

          // 检查时间是否发生了变化
          if (
            originalStart &&
            originalEnd &&
            (originalStart !== currentStart || originalEnd !== currentEnd)
          ) {
            console.log(
              `[拖拽级联更新] 检测到任务 ${draggedTask.id} 时间变化，触发级联更新检查`
            );

            // 使用统一的任务时间变更处理
            this.$store.dispatch("handleTaskTimeChange", {
              taskId: draggedTask.id,
              newStartDate: currentStart,
              newEndDate: currentEnd,
              source: this.dragState ? "drag" : "resize",
            });
          } else {
            console.log(
              `[拖拽级联更新] 任务 ${draggedTask.id} 时间未发生变化，跳过级联更新检查`
            );
          }
        } else {
          console.log(`[拖拽级联更新] 未找到拖拽的任务对象`);
        }
      } else {
        console.log(`[拖拽级联更新] 没有拖拽或调整状态`);
      }

      // 通知父组件拖拽结束，恢复背景交互
      this.$emit("node-drag-end");

      // 强制清理所有状态，确保拖拽能够正确结束
      this.forceClearDragState();

      // 操作结束后清除缓存，让依赖线重新计算
      this.clearDependencyCache();

      // 清除隐藏依赖线的标记
      this.hidingTaskId = null;
      this.hidingTaskIds = []; // 清除子任务ID列表
      this.temporarilyHideDependencies = false;

      // 移除父节点拖拽的视觉效果
      if (this.$el && typeof this.$el.querySelectorAll === "function") {
        const parentDraggingElements = this.$el.querySelectorAll(
          ".parent-dragging-active"
        );
        parentDraggingElements.forEach((element) => {
          element.classList.remove("parent-dragging-active");
        });
      }

      // 拖拽结束后恢复血缘高亮
      if (
        this._preDragLineageSource &&
        (this._isSourceNodeDragging || this._isLineageNodeDragging)
      ) {
        // 延迟一点点再恢复高亮，确保UI先更新
        setTimeout(() => {
          this.$store.dispatch(
            "setLineageHighlight",
            this._preDragLineageSource
          );
          console.log("[调试] 拖拽结束恢复高亮", this._preDragLineageSource);
          this._preDragLineageSource = null;
          this._isSourceNodeDragging = false;
          this._isLineageNodeDragging = false;
        }, 50);
      }
      this.internalShowDependencyLines = true; // 拖拽结束后恢复依赖线
    },

    // 强制清理拖拽状态，防止"停不下来"
    forceClearDragState() {
      this.dragState = null;
      this.resizeState = null;
      this.connectionState = null;
      this.progressDragState = null;
      this.pendingUpdates = null;
      this.hidingTaskId = null;

      // 安全检查：确保组件已挂载且$el是有效的DOM元素
      if (!this.$el || typeof this.$el.querySelectorAll !== "function") {
        console.warn("forceClearDragState: 组件未正确挂载或$el无效");
        return;
      }

      // 清理所有拖拽状态的CSS类
      const progressDraggingElements =
        this.$el.querySelectorAll(".progress-dragging");
      progressDraggingElements.forEach((element) => {
        element.classList.remove("progress-dragging");
      });

      // 重置进度拖拽手柄样式
      const progressHandles = this.$el.querySelectorAll(
        ".gantt-progress-handle-container"
      );
      progressHandles.forEach((handle) => {
        handle.style.transform = "";
        handle.style.opacity = "";
      });

      if (this.updateThrottle) {
        cancelAnimationFrame(this.updateThrottle);
        this.updateThrottle = null;
      }
      if (this.resizeThrottle) {
        cancelAnimationFrame(this.resizeThrottle);
        this.resizeThrottle = null;
      }
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }

      // 清理拖拽外部监听状态
      this.dragOutsideMonitoring = {
        enabled: false,
        task: null,
        expansionCount: 0,
        lastDirection: null,
      };

      console.log("拖拽状态已强制清理");
    },

    // 检查拖拽是否到外部区域
    checkDragOutside(event, direction) {
      if (
        !this.dragOutsideMonitoring.enabled ||
        !this.dragOutsideMonitoring.task
      ) {
        return;
      }

      // 获取容器边界
      const scrollContainer = this._ganttScrollContainer;
      if (!scrollContainer) return;

      const containerRect = scrollContainer.getBoundingClientRect();
      const mouseX = event.clientX;
      const threshold = 50; // 触发扩展的边界距离

      let shouldExpand = false;
      let expandDirection = direction;

      // 检查是否超出边界
      if (direction === "left" && mouseX < containerRect.left + threshold) {
        shouldExpand = true;
        expandDirection = "left";
      } else if (
        direction === "right" &&
        mouseX > containerRect.right - threshold
      ) {
        shouldExpand = true;
        expandDirection = "right";
      }

      // 防止频繁扩展
      if (
        shouldExpand &&
        this.dragOutsideMonitoring.lastDirection !== expandDirection &&
        this.dragOutsideMonitoring.expansionCount <
          this.dragOutsideConfig.maxExpansions
      ) {
        // 计算拖拽距离
        const distance =
          direction === "left"
            ? containerRect.left - mouseX
            : mouseX - containerRect.right;

        // 触发扩展事件
        this.$emit("node-drag-outside", {
          direction: expandDirection,
          distance: Math.max(0, distance),
          task: this.dragOutsideMonitoring.task,
        });

        // 更新监听状态
        this.dragOutsideMonitoring.lastDirection = expandDirection;
        this.dragOutsideMonitoring.expansionCount++;

        console.log(
          `[拖拽扩展] 触发${expandDirection}扩展, 距离: ${distance}px, 扩展次数: ${this.dragOutsideMonitoring.expansionCount}`
        );
      }
    },

    findBarFromElement(element) {
      let current = element;
      while (current) {
        if (
          current.classList &&
          current.classList.contains("gantt-bar-container")
        ) {
          // 通过data-task-id属性找到对应的任务条
          const taskId = current.getAttribute("data-task-id");
          if (taskId) {
            return this.taskBars.find(
              (bar) => bar.task.id.toString() === taskId
            );
          }
        }
        current = current.parentElement;
      }
      return null;
    },

    // 确定目标连接点类型
    getTargetConnectionPoint(event, targetBar) {
      // 安全检查：确保组件已挂载且$el是有效的DOM元素
      if (!this.$el || typeof this.$el.querySelector !== "function") {
        console.warn("getTargetConnectionPoint: 组件未正确挂载或$el无效");
        return "start";
      }

      // 获取目标任务条的边界
      const targetElement = this.$el.querySelector(
        `[data-task-id="${targetBar.task.id}"]`
      );
      if (!targetElement) return "start";

      const targetRect = targetElement.getBoundingClientRect();
      const mouseX = event.clientX;

      // 根据鼠标位置确定连接到左侧还是右侧
      const targetCenter = (targetRect.left + targetRect.right) / 2;

      return mouseX < targetCenter ? "start" : "end";
    },

    // 根据连接点类型确定依赖类型
    getDependencyTypeFromPoints(fromPoint, toPoint) {
      // 根据源点和目标点的组合确定依赖类型
      if (fromPoint === "end" && toPoint === "start") {
        return "FS"; // Finish-To-Start (最常见)
      } else if (fromPoint === "start" && toPoint === "start") {
        return "SS"; // Start-To-Start
      } else if (fromPoint === "end" && toPoint === "end") {
        return "FF"; // Finish-To-Finish
      } else if (fromPoint === "start" && toPoint === "end") {
        return "SF"; // Start-To-Finish
      }

      // 默认返回最常见的FS类型
      return "FS";
    },

    getRandomColor() {
      return this.availableColors[
        Math.floor(Math.random() * this.availableColors.length)
      ];
    },

    selectDependencyLine(line, event) {
      event.stopPropagation();
      console.log("[调试] 连线被点击", line);

      // 设置选中的依赖线
      this.selectedDependency = { from: line.from, to: line.to };

      // 隐藏颜色选择器
      this.hideColorPicker();

      // 清除依赖线缓存，强制重新计算选中状态
      this.clearDependencyCache();

      // 发出连线选中事件
      this.$emit("dependency-select", line);
    },

    editDependencyLabel(line, event) {
      event.stopPropagation();
      const currentLabel = line.label || "";
      const newLabel = prompt("Enter dependency label:", currentLabel);

      if (newLabel !== null) {
        this.updateDependencyLabel({
          from: line.from,
          to: line.to,
          label: newLabel.trim(),
        });
      }
    },

    deleteDependencyLine(line, event) {
      event.stopPropagation();
      if (confirm("Are you sure you want to delete this connection?")) {
        this.removeDependency({
          from: line.from,
          to: line.to,
        });
        this.selectedDependency = null;
      }
    },

    showColorPicker(line, event) {
      event.stopPropagation();

      // 安全检查：确保组件已挂载且$el是有效的DOM元素
      if (!this.$el || typeof this.$el.getBoundingClientRect !== "function") {
        console.warn("showColorPicker: 组件未正确挂载或$el无效");
        return;
      }

      const rect = this.$el.getBoundingClientRect();
      this.colorPicker = {
        visible: true,
        x: event.clientX - rect.left + this.scrollLeft,
        y: event.clientY - rect.top,
        targetLine: line,
      };
    },

    hideColorPicker() {
      this.colorPicker.visible = false;
      this.colorPicker.targetLine = null;
    },

    changeLineColor(color) {
      if (this.colorPicker.targetLine) {
        // 更新依赖关系的颜色
        this.$store.commit("UPDATE_DEPENDENCY_COLOR", {
          from: this.colorPicker.targetLine.from,
          to: this.colorPicker.targetLine.to,
          color,
        });
      }
      this.hideColorPicker();
    },

    handleComponentClick(event) {
      if (!this.selectedDependency) {
        return;
      }

      const isConnectionElement =
        event.target.closest(".gantt-dependency-group") ||
        event.target.closest(".gantt-link-container") ||
        event.target.classList.contains("gantt-dependency-line-visual") ||
        event.target.classList.contains("gantt-link-hit-area") ||
        event.target.classList.contains("gantt-end-point-indicator") ||
        event.target.classList.contains("gantt-link-label-text");

      if (!isConnectionElement) {
        console.log("[调试] 点击空白处，清除连线选中状态");
        this.selectedDependency = null;
        this.clearDependencyCache(); // 触发重新渲染
      }
    },

    handleGlobalClick(event) {
      // 安全检查：确保组件已挂载且$el是有效的DOM元素
      if (
        this.$el &&
        typeof this.$el.contains === "function" &&
        !this.$el.contains(event.target)
      ) {
        this.selectedDependency = null;
        // 清除选择状态由父组件处理
        this.$emit("task-select", null);
        this.hideColorPicker();
      }
    },

    // 选择任务
    selectTask(task) {
      // 如果是拖拽操作后的点击，则忽略
      if (this.preventNextBarClick) {
        this.preventNextBarClick = false;
        return;
      }

      // 发出事件让父组件处理选择状态，而不是直接修改prop
      this.$emit("task-select", task);
      this.$emit("task-highlight", task.id);

      // 根据配置决定是否触发血缘关系高亮
      if (this.highlightTaskLineage) {
        // 启用血缘关系高亮
        this.$store.dispatch("toggleLineageHighlight", task.id);
      } else if (this.$store.state.highlightedConnections?.sourceTaskId) {
        // 如果当前有高亮但配置已禁用，清除高亮
        this.$store.dispatch("clearLineageHighlight");
      }
    },

    editTask(task) {
      console.log("[调试] editTask被调用", task);
      // 触发编辑事件，由父组件处理
      this.$emit('edit-task', task);
    },

    // 任务编辑方法已移至GanttChart统一处理

    deleteTaskDirectly(task) {
      // 检查删除权限 - 右侧节点每一行都需要有编辑权限控制
      if (!this.hasPermission(task, "deletable")) {
        this.$message.warning("该任务不允许删除");
        return;
      }

      if (confirm(`Are you sure you want to delete task "${task.name}"?`)) {
        this.$emit("task-delete", task.id);
      }
    },

    // 检查任务权限方法 - 与左侧表格保持一致
    hasPermission(task, permission) {
      // 防止 undefined 错误：安全检查任务对象
      if (!task || typeof task !== "object") {
        console.warn("hasPermission: 任务对象无效", task);
        return true; // 默认允许操作（向后兼容）
      }

      // 如果任务没有权限配置，默认允许所有操作（向后兼容）
      if (!task.permissions || typeof task.permissions !== "object") {
        return true;
      }

      // 特殊处理：父节点的编辑权限
      // 父节点应该可以编辑，除非明确设置为false
      if (
        permission === "editable" &&
        task.children &&
        task.children.length > 0
      ) {
        // 父节点默认可编辑，除非权限明确设置为false
        return task.permissions[permission] !== false;
      }

      // 检查具体权限
      return task.permissions[permission] === true;
    },

    // Milestone 相关方法
    editMilestone(task) {
      // 快速编辑milestone状态
      const currentProgress = task.progress || 0;
      const options = [
        "0% - Not Started",
        "50% - In Progress",
        "100% - Completed",
      ];
      const selectedIndex =
        currentProgress >= 100 ? 2 : currentProgress > 0 ? 1 : 0;

      this.$prompt("Select milestone status:", "Edit Milestone", {
        inputType: "select",
        inputOptions: options,
        inputValue: options[selectedIndex],
        showInput: false,
        showCancelButton: true,
        confirmButtonText: "Update",
        cancelButtonText: "Cancel",
      })
        .then(({ value }) => {
          let newProgress;
          switch (value) {
            case "0% - Not Started":
              newProgress = 0;
              break;
            case "50% - In Progress":
              newProgress = 50;
              break;
            case "100% - Completed":
              newProgress = 100;
              break;
            default:
              newProgress = currentProgress;
          }

          this.$emit("task-update", {
            id: task.id,
            updates: { progress: newProgress },
          });
        })
        .catch(() => {
          // 用户取消
        });
    },

    isMilestoneOverdue(task) {
      if ((task.progress || 0) >= 100) return false;
      const today = moment();
      const endDate = moment(task.endDate || task.startDate);
      return today.isAfter(endDate);
    },

    getMilestoneStatus(task) {
      if ((task.progress || 0) >= 100) return "Completed";
      if (this.isMilestoneOverdue(task)) return "Overdue";
      if ((task.progress || 0) > 0) return "In Progress";
      return "Not Started";
    },

    getMilestoneIcon(task) {
      if ((task.progress || 0) >= 100) return "✅";
      if (this.isMilestoneOverdue(task)) return "⚠️";
      if ((task.progress || 0) > 0) return "🔄";
      return "🎯";
    },

    // Tooltip 相关方法
    showTooltip(task, event) {
      // 检查是否启用tooltip
      if (!this.tooltipConfig.enabled) {
        return;
      }

      // 清除隐藏计时器
      if (this.tooltipHideTimer) {
        clearTimeout(this.tooltipHideTimer);
        this.tooltipHideTimer = null;
      }

      // 如果已经显示了相同任务的tooltip，直接更新位置
      if (
        this.tooltip.visible &&
        this.tooltip.task &&
        this.tooltip.task.id === task.id
      ) {
        this.updateTooltipPosition(event);
        return;
      }

      // 清除之前的显示计时器
      if (this.tooltipTimer) {
        clearTimeout(this.tooltipTimer);
      }

      // 设置延迟显示
      this.tooltipTimer = setTimeout(() => {
        this.calculateTooltipPosition(event, task);
        this.tooltipTimer = null;
      }, this.tooltipConfig.delay);
    },

    calculateTooltipPosition(event, task) {
      const tooltipWidth = 280;
      const tooltipHeight = 200;
      const padding = 10;
      const extraBottomPadding = 20; // 底部额外边距

      // 获取Gantt区域容器
      const container = this._ganttScrollContainer;
      if (!container) {
        // 兜底：无容器时退回window定位
        let x = event.clientX + 15;
        let y = event.clientY - 80;
        if (x + tooltipWidth > window.innerWidth - padding) {
          x = event.clientX - tooltipWidth - 15;
        }
        if (x < padding) x = padding;
        if (y + tooltipHeight > window.innerHeight - padding) {
          y = event.clientY - tooltipHeight - 15;
        }
        if (y < padding) y = event.clientY + 25;
        this.tooltip = {
          visible: true,
          x: Math.max(
            padding,
            Math.min(x, window.innerWidth - tooltipWidth - padding)
          ),
          y: Math.max(
            padding,
            Math.min(y, window.innerHeight - tooltipHeight - padding)
          ),
          task,
        };
        return;
      }

      // 获取容器边界信息
      const containerRect = container.getBoundingClientRect();

      // 计算相对于容器的鼠标位置
      const relativeX = event.clientX - containerRect.left;
      const relativeY = event.clientY - containerRect.top;

      // 计算在容器内的绝对位置（考虑滚动）
      let x = relativeX + container.scrollLeft + 15; // 默认在鼠标右侧
      let y = relativeY + container.scrollTop - 80; // 默认在鼠标上方

      // 容器可视区域边界
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const scrollTop = container.scrollTop;
      const scrollLeft = container.scrollLeft;

      // 增强边界计算 - 考虑视口边界和额外边距
      const viewportBottom = scrollTop + containerHeight - extraBottomPadding;
      const viewportTop = scrollTop + padding;
      const viewportRight = scrollLeft + containerWidth - padding;
      const viewportLeft = scrollLeft + padding;

      // 智能位置调整 - 水平方向
      if (x + tooltipWidth > viewportRight) {
        // tooltip超出右边界，调整到鼠标左侧
        x = relativeX + scrollLeft - tooltipWidth - 15;
      }
      if (x < viewportLeft) {
        // tooltip超出左边界，贴近左边界
        x = viewportLeft;
      }

      // 智能位置调整 - 垂直方向（重点优化底部遮挡问题）
      // 增强底部检测：距离底部80px以内认为是底部区域
      const isNearBottom =
        relativeY + scrollTop + tooltipHeight + 80 >
        scrollTop + containerHeight;

      if (isNearBottom) {
        // 底部区域：强制放置在鼠标上方
        const topY = relativeY + scrollTop - tooltipHeight - 30;
        if (topY >= viewportTop) {
          // 上方有足够空间，放置在上方
          y = topY;
        } else {
          // 上方空间不足，计算最佳位置
          const availableTopSpace = relativeY + scrollTop - viewportTop;
          const availableBottomSpace = viewportBottom - (relativeY + scrollTop);

          if (availableTopSpace >= availableBottomSpace) {
            // 上方空间更大，尽量放在上方
            y = Math.max(
              viewportTop,
              relativeY + scrollTop - tooltipHeight - 10
            );
          } else {
            // 下方空间更大，但确保不被遮挡
            y = Math.min(
              relativeY + scrollTop + 30,
              viewportBottom - tooltipHeight
            );
          }
        }
      } else {
        // 非底部区域：正常判断
        if (y + tooltipHeight > viewportBottom) {
          // tooltip超出下边界，调整到鼠标上方
          const newY = relativeY + scrollTop - tooltipHeight - 15;
          if (newY >= viewportTop) {
            y = newY;
          } else {
            // 上下都放不下，选择遮挡最少的位置
            const topOverflow = viewportTop - newY;
            const bottomOverflow = y + tooltipHeight - viewportBottom;

            if (topOverflow <= bottomOverflow) {
              y = viewportTop;
            } else {
              y = viewportBottom - tooltipHeight;
            }
          }
        }
        if (y < viewportTop) {
          // tooltip超出上边界，调整到鼠标下方
          const newY = relativeY + scrollTop + 25;
          if (newY + tooltipHeight <= viewportBottom) {
            y = newY;
          } else {
            // 下方空间不足，贴近上边界
            y = viewportTop;
          }
        }
      }

      // 最终边界保护 - 确保tooltip完全在可视范围内
      x = Math.max(viewportLeft, Math.min(x, viewportRight - tooltipWidth));
      y = Math.max(viewportTop, Math.min(y, viewportBottom - tooltipHeight));

      // 设置tooltip位置
      this.tooltip = {
        visible: true,
        x: Math.round(x),
        y: Math.round(y),
        task,
      };
    },

    hideTooltip() {
      // 清除显示计时器
      if (this.tooltipTimer) {
        clearTimeout(this.tooltipTimer);
        this.tooltipTimer = null;
      }

      // 设置延迟隐藏，给用户时间移动到tooltip上
      if (this.tooltipHideTimer) {
        clearTimeout(this.tooltipHideTimer);
      }

      this.tooltipHideTimer = setTimeout(() => {
        this.tooltip.visible = false;
        this.tooltipHideTimer = null;
      }, this.tooltipConfig.hideDelay);
    },

    // 鼠标进入tooltip时取消隐藏
    onTooltipMouseEnter() {
      if (this.tooltipHideTimer) {
        clearTimeout(this.tooltipHideTimer);
        this.tooltipHideTimer = null;
      }
    },

    // 鼠标离开tooltip时隐藏
    onTooltipMouseLeave() {
      this.hideTooltip();
    },

    updateTooltipPosition(event) {
      if (this.tooltip.visible && this.tooltip.task) {
        this.calculateTooltipPosition(event, this.tooltip.task);
      }
    },

    formatTooltipDate(dateString) {
      if (!dateString) return "-";
      return moment(dateString).format("MMM DD, YYYY");
    },

    getTaskStatus(task) {
      if (!task.progress) return "Not Started";
      if (task.progress >= 100) return "Completed";
      if (task.progress > 0) return "In Progress";
      return "Not Started";
    },

    getTooltipStatusClass(task) {
      const status = this.getTaskStatus(task);
      return {
        "status-completed": status === "Completed",
        "status-progress": status === "In Progress",
        "status-not-started": status === "Not Started",
      };
    },

    // 获取高亮行的垂直位置
    getHighlightedRowTop() {
      if (this.highlightedRowId === null) return 0;

      // 在taskBars中找到高亮任务的索引
      const highlightedBar = this.taskBars.find(
        (bar) => String(bar.task.id) === String(this.highlightedRowId)
      );

      if (highlightedBar) {
        return highlightedBar.index * 28; // 修复为28px行高
      }

      return 0;
    },

    // 计算依赖线 - 分离出独立方法便于优化
    calculateDependencyLines() {
      if (!this.dependencies || this.dependencies.length === 0) {
        return [];
      }

      // 使用布局缓存 - 检查是否需要重新计算
      if (this.isLayoutCached()) {
        return this._cachedDependencyLines;
      }

      // 清除连线冲突缓存，准备重新计算
      if (
        this.connectionConflictMap &&
        typeof this.connectionConflictMap.clear === "function"
      ) {
        this.connectionConflictMap.clear();
      } else {
        this.connectionConflictMap = new Map();
      }

      if (
        this.lineOffsetMap &&
        typeof this.lineOffsetMap.clear === "function"
      ) {
        this.lineOffsetMap.clear();
      } else {
        this.lineOffsetMap = new Map();
      }

      // 创建任务映射以提升查找性能
      const taskBarMap = new Map();
      this.taskBars.forEach((bar) => {
        taskBarMap.set(bar.task.id, bar);
      });

      const lines = [];

      for (const dep of this.dependencies) {
        const fromBar = taskBarMap.get(dep.from);
        const toBar = taskBarMap.get(dep.to);

        if (!fromBar || !toBar) {
          continue;
        }

        // 根据依赖类型计算连接点位置
        let fromX, toX;
        const fromY = (fromBar.index || 0) * 28 + 14; // 修复连线Y坐标计算，28px行高的中心位置
        const toY = (toBar.index || 0) * 28 + 14; // 修复连线Y坐标计算，28px行高的中心位置

        // 获取依赖类型，默认为FS
        const dependencyType = dep.type || "FS";

        // 根据依赖类型和任务类型计算源任务连接点
        fromX = this.getConnectionPoint(fromBar, dependencyType, "from");

        // 根据依赖类型和任务类型计算目标任务连接点
        toX = this.getConnectionPoint(toBar, dependencyType, "to");

        // 检查坐标有效性
        if (isNaN(fromX) || isNaN(fromY) || isNaN(toX) || isNaN(toY)) {
          console.warn(
            "Invalid coordinates detected, skipping dependency line:",
            {
              fromX,
              fromY,
              toX,
              toY,
              fromBar,
              toBar,
              dep,
            }
          );
          continue;
        }

        // 调试信息：连接点位置（仅在开发模式下）
        if (process.env.NODE_ENV === "development") {
          // console.log(`[连线计算] ${fromBar.task.name} -> ${toBar.task.name}`, {
          //   type: dependencyType,
          //   fromX, toX,
          //   fromTask: `${fromBar.task.name} (${fromBar.left}, ${fromBar.left + fromBar.width})`,
          //   toTask: `${toBar.task.name} (${toBar.left}, ${toBar.left + toBar.width})`
          // })
        }

        // 全新的分段连线算法 - 确保箭头始终可见
        let path = this.calculateOptimizedPath(
          fromX,
          fromY,
          toX,
          toY,
          dependencyType,
          fromBar,
          toBar
        );

        // 确保箭头不被任务条遮挡 - 适用于所有连线样式
        path = this.ensureArrowVisibility(path, dependencyType, fromBar, toBar);

        // 特殊处理milestone连线，确保箭头不被diamond形状遮挡
        const isMilestoneTarget = toBar.task.type === "milestone";
        if (isMilestoneTarget) {
          path = this.adjustMilestoneArrowPath(path, dependencyType, toBar);
        }

        // 调试模式：输出连线信息
        if (process.env.NODE_ENV === "development") {
          // console.log(`[连线调试] ${fromBar.task.name} -> ${toBar.task.name}`, {
          //   type: dependencyType,
          //   from: { x: fromX, y: fromY },
          //   to: { x: toX, y: toY },
          //   path: path,
          //   isEndPoint: dependencyType === 'FF' || dependencyType === 'SF'
          // })
        }

        // 生成连接线标签：结合依赖类型、lag和自定义标签
        const label = this.generateConnectionLabel(dep);

        // 计算标签位置：在连线中间点附近
        // 计算标签位置的动态偏移
        const baseOffset = 20;
        const rowDiff = Math.abs(toBar.index - fromBar.index);
        const dynamicOffset = baseOffset + Math.min(rowDiff * 5, 30);

        let midX, midY;
        if (fromY === toY) {
          // 同一行时，标签在水平线中间
          midX = (fromX + toX) / 2;
          midY = fromY - 5; // 稍微偏上，避免与连线重叠
        } else {
          // 不同行时，标签位置在垂直线段的中间
          if (toX < fromX) {
            // 复杂路径的标签位置
            midX = fromX + Math.max(dynamicOffset, 40);
            midY = fromY + (toY - fromY) / 2;
          } else {
            midX = fromX + dynamicOffset;
            midY = fromY + (toY - fromY) / 2;
          }
        }

        // 确保标签位置有效
        midX = isNaN(midX) ? fromX : midX;
        midY = isNaN(midY) ? fromY : midY;

        const isSelected =
          this.selectedDependency &&
          this.selectedDependency.from === dep.from &&
          this.selectedDependency.to === dep.to;

        lines.push({
          key: `${dep.from}-${dep.to}`,
          path,
          from: dep.from,
          to: dep.to,
          color: dep.color || "#666",
          type: dep.type || "FS",
          lag: dep.lag || 0,
          label,
          labelX: midX,
          labelY: midY,
          colorButtonX: midX - 30,
          colorButtonY: midY - 15,
          deleteButtonX: midX + 30,
          deleteButtonY: midY - 15,
          selected: isSelected,
          dependency: dep, // 添加完整的依赖对象引用，用于箭头显示
          fromBar: fromBar, // 添加源任务条引用
          toBar: toBar, // 添加目标任务条引用
        });
      }

      // 缓存计算结果
      this._cachedDependencyLines = lines;

      return lines;
    },

    // 清除依赖线缓存 - 增强版本
    clearDependencyCache() {
      console.log("[GanttBars] 清除依赖线缓存");
      // 清除依赖线计算缓存
      this._cachedDependencyLines = null;
      // 清除布局缓存
      this._layoutHash = null;
      this._visibleAreaCache = null;
      // 清除连线偏移和冲突检测映射
      this.lineOffsetMap = new Map();
      this.connectionConflictMap = new Map();
      // 强制重新计算
      this.$nextTick(() => {
        this.calculateDependencyLines();
      });
    },

    // 初始化缓存Map对象
    initializeCacheMaps() {
      console.log("[GanttBars] 初始化缓存Map");
      this._dependencyLayoutCache = new Map();
      this.lineOffsetMap = new Map();
      this.connectionConflictMap = new Map();
      this._visibleAreaCache = null;
      this._layoutHash = null;
    },

    // 验证缓存Map对象状态 - 调试用
    validateCacheMaps() {
      const status = {
        _dependencyLayoutCache: this._dependencyLayoutCache instanceof Map,
        lineOffsetMap: this.lineOffsetMap instanceof Map,
        connectionConflictMap: this.connectionConflictMap instanceof Map,
      };

      console.log("[缓存验证]", status);
      return Object.values(status).every((isValid) => isValid);
    },

    // 生成布局哈希值 - 检测布局是否变化
    generateLayoutHash() {
      // 基于任务位置、依赖关系和可视区域生成哈希
      const taskPositions = this.taskBars
        .map((bar) => `${bar.task.id}_${bar.left}_${bar.width}_${bar.index}`)
        .join("|");

      const dependencyStr = this.dependencies
        .map((dep) => `${dep.from}_${dep.to}_${dep.type}_${dep.lag || 0}`)
        .join("|");

      const viewState = `${this.actualUnitWidth}_${this.startDate}_${this.endDate}`;

      // 连线样式状态 - 新增支持智能算法
      const connectionStyleState = `${this.connectionStyle}_${this.connectionEditable}_${this.grayConnectionMode}`;

      // 简单哈希算法
      const str = `${taskPositions}:${dependencyStr}:${viewState}:${connectionStyleState}`;
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // 转换为32位整数
      }
      return hash.toString();
    },

    // 检查布局是否已缓存
    isLayoutCached() {
      const currentHash = this.generateLayoutHash();
      if (this._layoutHash === currentHash && this._cachedDependencyLines) {
        return true;
      }
      this._layoutHash = currentHash;
      return false;
    },

    closeLinkEditModal() {
      // 如果有未保存的更改且存在原始状态，恢复原始状态
      if (this.linkEditModal.originalState) {
        console.log(
          "[连线编辑] 取消编辑，恢复原始状态:",
          this.linkEditModal.originalState
        );

        // 恢复依赖关系的原始属性
        this.$store.commit("UPDATE_DEPENDENCY_FULL", {
          from: this.linkEditModal.link.from,
          to: this.linkEditModal.link.to,
          updates: this.linkEditModal.originalState,
        });

        // 清除缓存以确保更新生效
        this.clearDependencyCache();
      }

      // 重置弹框状态
      this.linkEditModal = {
        visible: false,
        link: null,
        type: "FS",
        lag: 0,
        label: "",
        color: "#3498db",
        originalState: null,
        saving: false,
      };
    },

    deleteLinkFromModal() {
      this.removeDependency({
        from: this.linkEditModal.link.from,
        to: this.linkEditModal.link.to,
      });
      this.closeLinkEditModal();
    },

    async saveLinkChanges() {
      console.log("[GanttBars] 保存连线变更开始");

      // 设置保存状态
      this.linkEditModal.saving = true;

      try {
        // 获取原始依赖关系
        const originalDep = this.dependencies.find(
          (dep) =>
            dep.from === this.linkEditModal.link.from &&
            dep.to === this.linkEditModal.link.to
        );

        if (!originalDep) {
          throw new Error("找不到要更新的依赖关系");
        }

        // 确保数据类型正确
        const updatedDependency = {
          ...originalDep,
          type: this.linkEditModal.type,
          lag: parseInt(this.linkEditModal.lag) || 0,
          label: this.linkEditModal.label || "",
          color: this.linkEditModal.color || "#3498db",
        };

        console.log("[GanttBars] 准备更新依赖关系:", updatedDependency);

        // 1. 先触发父组件刷新事件
        this.$emit("dependency-updated", {
          action: "update",
          dependency: updatedDependency,
          force: true,
          requireRefresh: true,
        });

        // 2. 等待事件处理完成
        await this.$nextTick();

        // 3. 更新store中的依赖关系
        this.$store.commit("UPDATE_DEPENDENCY_FULL", {
          from: updatedDependency.from,
          to: updatedDependency.to,
          updates: {
            type: updatedDependency.type,
            lag: updatedDependency.lag,
            label: updatedDependency.label,
            color: updatedDependency.color,
          },
        });

        // 4. 等待store更新完成
        await this.$nextTick();

        // 5. 清除所有缓存并重新计算
        this.clearDependencyCache();
        this._cachedDependencyLines = null;
        this.taskBarMap = null;
        this.flatTaskMap = null;
        this.initializeCacheMaps();
        this._cachedDependencyLines = this.calculateDependencyLines();

        // 6. 强制组件重新渲染
        this.$forceUpdate();

        // 7. 关闭弹框
        this.closeLinkEditModal();

        // 8. 显示成功提示
        this.$message({
          message: "Connection updated successfully",
          type: "success",
          duration: 2000,
        });

        // 9. 触发全局事件通知其他组件
        window.dispatchEvent(
          new CustomEvent("dependency-updated", {
            detail: {
              from: updatedDependency.from,
              to: updatedDependency.to,
              updates: updatedDependency,
              source: "saveLinkChanges",
            },
          })
        );
      } catch (error) {
        console.error("[GanttBars] 保存连线变更失败:", error);
        this.$message({
          message: `Failed to update connection: ${error.message}`,
          type: "error",
          duration: 3000,
        });
      } finally {
        // 重置保存状态
        this.linkEditModal.saving = false;
      }
    },

    openLinkEditModal(line, event) {
      console.log("[调试] openLinkEditModal被调用", line);
      // 检查连接线是否可编辑
      if (!this.connectionEditable) {
        console.log("[连接线编辑] 连接线不可编辑，跳过");
        return;
      }

      console.log("[连接线编辑] 双击事件触发，打开编辑弹框", {
        from: line.from,
        to: line.to,
        type: line.type || "FS",
        lag: line.lag || 0,
      });

      // 获取任务名称
      const fromTask = this.taskBars.find(
        (bar) => bar.task.id === line.from
      )?.task;
      const toTask = this.taskBars.find((bar) => bar.task.id === line.to)?.task;

      // 获取依赖关系详细信息
      const dependency = this.dependencies.find(
        (dep) => dep.from === line.from && dep.to === line.to
      );

      // 备份原始状态
      const originalState = dependency
        ? {
            type: dependency.type || "FS",
            lag: dependency.lag || 0,
            label: dependency.label || "",
            color: dependency.color || "#3498db",
          }
        : null;

      // 设置弹框状态
      this.linkEditModal = {
        visible: true,
        link: {
          ...line,
          fromTaskName: fromTask?.name || "Unknown Task",
          toTaskName: toTask?.name || "Unknown Task",
        },
        type: dependency?.type || line.type || "FS",
        lag: dependency?.lag || line.lag || 0,
        label: dependency?.label || line.label || "",
        color: dependency?.color || line.color || "#3498db",
        originalState, // 保存原始状态
      };

      console.log("[调试] 连接线编辑弹窗已显示", {
        visible: this.linkEditModal.visible,
        type: this.linkEditModal.type,
        lag: this.linkEditModal.lag,
        originalState: this.linkEditModal.originalState,
      });
    },

    startProgressDrag(bar, event) {
      console.log(
        "[调试] startProgressDrag 被调用",
        bar.task.id,
        bar.task.progress
      );
      this.progressDragState = {
        bar,
        startX: event.clientX,
        startProgress: bar.task.progress,
        barWidth: bar.width,
      };
      // 添加拖拽状态类，禁用过渡效果
      const barElement = event.target.closest(".gantt-bar");
      if (barElement) {
        barElement.classList.add("progress-dragging");
        console.log("[调试] .progress-dragging 类已添加", barElement);
      }

      // 创建一个视觉反馈，表示拖拽已开始
      const progressHandle = event.target.closest(
        ".gantt-progress-handle-container"
      );
      if (progressHandle) {
        // 添加动画效果 - 更强烈的视觉反馈
        progressHandle.style.transform = "scale(1.1) translateY(-4px)";
        progressHandle.style.opacity = "1";
        progressHandle.style.background = "rgba(74, 144, 226, 0.2)";
        progressHandle.style.boxShadow = "0 0 10px rgba(74, 144, 226, 0.5)";

        // 添加一个临时的拖拽指示器
        const handleElement = progressHandle.querySelector(
          ".gantt-progress-handle"
        );
        if (handleElement) {
          handleElement.style.borderBottomColor = "#2c5f8a";
        }

        // 添加进度条样式变化
        const progressBar = barElement.querySelector(".gantt-bar-progress");
        if (progressBar) {
          progressBar.style.transition = "none";
          progressBar.style.background = "rgba(0, 0, 0, 0.4)";
          progressBar.style.boxShadow =
            "inset 0 0 10px rgba(255, 255, 255, 0.2)";
        }
      }

      // 按下时立即触发一次拖拽反馈，提升体验
      this.handleProgressDragMove(event);

      // 添加全局事件监听，确保拖拽过程中能持续获取鼠标移动
      document.addEventListener("mousemove", this.handleProgressDragMove);
      document.addEventListener("mouseup", this.handleProgressDragEnd);

      event.preventDefault();
    },

    handleProgressDragMove(event) {
      if (!this.progressDragState) {
        return;
      }
      const deltaX = event.clientX - this.progressDragState.startX;
      const progressChange = (deltaX / this.progressDragState.barWidth) * 100;
      let newProgress = this.progressDragState.startProgress + progressChange;
      newProgress = Math.max(0, Math.min(100, newProgress));
      this.progressDragState.bar.task.progress = Math.round(newProgress);

      // 更新进度拖拽手柄的视觉反馈
      const progressHandle = document.querySelector(
        ".progress-dragging .gantt-progress-handle-container"
      );
      if (progressHandle) {
        // 根据拖拽距离调整手柄的位置，减小scale避免三角形过大
        const moveOffset = Math.min(Math.max(deltaX * 0.1, -5), 5); // 限制移动范围
        progressHandle.style.transform = `scale(1.05) translateY(-2px) translateX(${moveOffset}px)`;

        // 确保手柄始终可见
        progressHandle.style.opacity = "1";

        // 更新三角形样式以提供更明显的视觉反馈，但保持合适大小
        const handleElement = progressHandle.querySelector(
          ".gantt-progress-handle"
        );
        if (handleElement) {
          handleElement.style.borderBottomColor = "#2c5f8a";
          handleElement.style.filter =
            "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))";
        }

        // 添加一个临时的进度指示器
        const barElement = document.querySelector(".progress-dragging");
        if (barElement) {
          const progressBar = barElement.querySelector(".gantt-bar-progress");
          if (progressBar) {
            progressBar.style.transition = "none";
            progressBar.style.background = "rgba(0, 0, 0, 0.4)";
            progressBar.style.boxShadow =
              "inset 0 0 10px rgba(255, 255, 255, 0.2)";
          }
        }
      }

      console.log(
        "[调试] handleProgressDragMove",
        this.progressDragState.bar.task.id,
        "新进度:",
        Math.round(newProgress)
      );
      this.$emit("progress-change", {
        id: this.progressDragState.bar.task.id,
        progress: Math.round(newProgress),
      });
    },

    handleProgressDragEnd(event) {
      if (!this.progressDragState) {
        return;
      }

      // 移除拖拽状态类
      const barElement = document.querySelector(".progress-dragging");
      if (barElement) {
        barElement.classList.remove("progress-dragging");

        // 重置进度条样式
        const progressBar = barElement.querySelector(".gantt-bar-progress");
        if (progressBar) {
          progressBar.style.transition = "";
          progressBar.style.background = "";
          progressBar.style.boxShadow = "";
        }
      }

      // 重置进度拖拽手柄样式
      const progressHandle = document.querySelector(
        ".gantt-progress-handle-container"
      );
      if (progressHandle) {
        progressHandle.style.transform = "";
        progressHandle.style.opacity = "";
        progressHandle.style.background = "";
        progressHandle.style.boxShadow = "";

        // 重置三角形样式
        const handleElement = progressHandle.querySelector(
          ".gantt-progress-handle"
        );
        if (handleElement) {
          handleElement.style.borderBottomColor = "";
          handleElement.style.filter = "";
          handleElement.style.transform = "";
        }
      }

      // 最后一次发送进度更新
      this.$emit("progress-change", {
        id: this.progressDragState.bar.task.id,
        progress: Math.round(this.progressDragState.bar.task.progress),
      });

      // 清理状态和事件监听
      this.progressDragState = null;
      document.removeEventListener("mousemove", this.handleProgressDragMove);
      document.removeEventListener("mouseup", this.handleProgressDragEnd);
    },

    handleParentScroll(e) {
      this.scrollLeft = e.target.scrollLeft;

      // 清除可视区域缓存，触发重新计算
      this._visibleAreaCache = null;

      // 节流处理，避免频繁更新
      if (this.scrollUpdateTimer) {
        clearTimeout(this.scrollUpdateTimer);
      }

      this.scrollUpdateTimer = setTimeout(() => {
        this.$forceUpdate();
      }, 16); // 60fps 更新频率
    },

    // 依赖类型变更处理
    onDependencyTypeChange(newType) {
      console.log("[调试] 依赖类型变更", newType);
      const typeConfig = getDependencyTypeConfig(newType);

      // 可以根据依赖类型自动调整颜色
      if (typeConfig && typeConfig.color) {
        this.linkEditModal.color = typeConfig.color;
      }
    },

    // 根据依赖类型和任务类型获取连接点位置（简洁版本）
    getConnectionPoint(taskBar, dependencyType, role) {
      if (!taskBar || !taskBar.left || !taskBar.width) {
        console.warn("getConnectionPoint: 无效的taskBar", taskBar);
        return 0;
      }

      const isMilestone = taskBar.task.type === "milestone";
      const left = taskBar.left;
      const width = taskBar.width;

      // 对于milestone，考虑diamond形状，调整连接点位置
      if (isMilestone) {
        const centerX = left + width / 2;
        const diamondRadius = width / 2; // diamond的半径

        if (role === "from") {
          // 源milestone的连接点
          switch (dependencyType) {
            case "FS": // Finish-To-Start: 从milestone右侧
            case "FF": // Finish-To-Finish: 从milestone右侧
              return centerX + diamondRadius + 5; // 右侧外延5px
            case "SS": // Start-To-Start: 从milestone左侧
            case "SF": // Start-To-Finish: 从milestone左侧
              return centerX - diamondRadius - 5; // 左侧外延5px
            default:
              return centerX + diamondRadius + 5;
          }
        } else {
          // 目标milestone的连接点
          switch (dependencyType) {
            case "FS": // Finish-To-Start: 到milestone左侧
            case "SS": // Start-To-Start: 到milestone左侧
              return centerX - diamondRadius - 5; // 左侧外延5px
            case "FF": // Finish-To-Finish: 到milestone右侧
            case "SF": // Start-To-Finish: 到milestone右侧
              return centerX + diamondRadius + 5; // 右侧外延5px
            default:
              return centerX - diamondRadius - 5;
          }
        }
      } else {
        // 普通任务的连接点（原逻辑）
        if (role === "from") {
          // 源任务的连接点
          switch (dependencyType) {
            case "FS": // Finish-To-Start: 从源任务的结束点
            case "FF": // Finish-To-Finish: 从源任务的结束点
              return left + width;
            case "SS": // Start-To-Start: 从源任务的开始点
            case "SF": // Start-To-Finish: 从源任务的开始点
              return left;
            default:
              return left + width;
          }
        } else {
          // 目标任务的连接点
          switch (dependencyType) {
            case "FS": // Finish-To-Start: 到目标任务的开始点
            case "SS": // Start-To-Start: 到目标任务的开始点
              return left;
            case "FF": // Finish-To-Finish: 到目标任务的结束点
            case "SF": // Start-To-Finish: 到目标任务的结束点
              return left + width;
            default:
              return left;
          }
        }
      }
    },

    // 根据四种依赖关系类型计算专用连线路径
    calculateOptimizedPath(
      fromX,
      fromY,
      toX,
      toY,
      dependencyType,
      fromBar,
      toBar
    ) {
      // 根据配置选择连线样式
      switch (this.connectionStyle) {
        case "bezier":
          // 使用贝塞尔曲线样式
          return this.createBezierPath(
            fromX,
            fromY,
            toX,
            toY,
            dependencyType,
            fromBar,
            toBar
          );
        case "z-shaped":
          // 使用标准四段式Z字形折线算法
          return this.createZShapedPath(
            fromX,
            fromY,
            toX,
            toY,
            dependencyType,
            fromBar,
            toBar
          );
        case "smart":
          // 使用智能化简约连线算法 - 优先直线和L形连接
          return this.createSmartPath(
            fromX,
            fromY,
            toX,
            toY,
            dependencyType,
            fromBar,
            toBar
          );
        default:
          // 使用传统连线样式
          return this.createTraditionalPath(
            fromX,
            fromY,
            toX,
            toY,
            dependencyType
          );
      }
    },

    // 智能化Z字形直角连线算法 - 支持多连线分层
    createSmartPath(fromX, fromY, toX, toY, dependencyType, fromBar, toBar) {
      const taskHeight = 28;
      const minOffset = 20; // 最小水平偏移量
      const maxOffset = 40; // 最大水平偏移量

      // 特殊处理milestone
      let adjustedToX = toX;
      if (toBar && toBar.task.type === "milestone") {
        const diamondRadius = toBar.width / 2;
        adjustedToX =
          dependencyType === "FF" || dependencyType === "SF"
            ? toX + diamondRadius
            : toX - diamondRadius;
      }

      // 计算基本距离
      const horizontalDist = Math.abs(adjustedToX - fromX);
      const verticalDist = Math.abs(toY - fromY);
      const isUpwardConnection = toY < fromY;

      // 同行任务特殊处理
      if (fromY === toY) {
        return `M ${fromX} ${fromY} L ${adjustedToX} ${toY}`;
      }

      // 计算水平偏移量
      const baseOffset = Math.min(
        Math.max(horizontalDist * 0.2, minOffset),
        maxOffset
      );

      // 根据依赖类型确定路径策略
      let pathPoints;

      switch (dependencyType) {
        case "FF": {
          // FF类型：从右侧连出，保持在右侧
          const midX = Math.max(fromX, adjustedToX) + baseOffset;
          pathPoints = [
            [fromX, fromY],
            [midX, fromY],
            [midX, toY],
            [adjustedToX, toY],
          ];
          break;
        }
        case "SS": {
          // SS类型：从左侧连出，保持在左侧
          const midX = Math.min(fromX, adjustedToX) - baseOffset;
          pathPoints = [
            [fromX, fromY],
            [midX, fromY],
            [midX, toY],
            [adjustedToX, toY],
          ];
          break;
        }
        case "SF": {
          // SF类型：从左侧连出，连接到右侧
          const midX1 = fromX - baseOffset;
          const midX2 = adjustedToX + baseOffset;
          const midY = (fromY + toY) / 2;
          pathPoints = [
            [fromX, fromY],
            [midX1, fromY],
            [midX1, midY],
            [midX2, midY],
            [midX2, toY],
            [adjustedToX, toY],
          ];
          break;
        }
        default: {
          // FS类型
          // FS类型：从右侧连出，连接到左侧
          const midX1 = fromX + baseOffset;
          const midX2 = adjustedToX - baseOffset;
          const midY = (fromY + toY) / 2;
          pathPoints = [
            [fromX, fromY],
            [midX1, fromY],
            [midX1, midY],
            [midX2, midY],
            [midX2, toY],
            [adjustedToX, toY],
          ];
        }
      }

      // 构建SVG路径
      return `M ${pathPoints.map((point) => point.join(" ")).join(" L ")}`;
    },

    // 渲染依赖连线
    renderDependencyLine(dependency, index) {
      const fromBar = this.findTaskBar(dependency.fromId);
      const toBar = this.findTaskBar(dependency.toId);
      if (!fromBar || !toBar) return null;

      const { from, to } = this.getLineDirection(dependency.type);
      const fromX =
        from === "right" ? fromBar.left + fromBar.width : fromBar.left;
      const fromY = fromBar.top + fromBar.height / 2;
      const toX = to === "right" ? toBar.left + toBar.width : toBar.left;
      const toY = toBar.top + toBar.height / 2;

      const path = this.createSmartPath(
        fromX,
        fromY,
        toX,
        toY,
        dependency.type,
        fromBar,
        toBar
      );

      // 设置连线样式和箭头
      const classes = ["dependency-line"];
      if (dependency.type === "FS") {
        classes.push("fs-dependency");
      }
      if (this.selectedDependency === dependency) {
        classes.push("selected");
      }
      if (this.highlightedDependency === dependency) {
        classes.push("highlighted");
      }

      return h("path", {
        class: classes,
        d: path,
        "data-dependency-id": dependency.id,
        "data-type": dependency.type,
        "marker-end": dependency.type === "FS" ? "url(#arrow-default)" : null,
        style: {
          zIndex: dependency.type === "FS" ? 100 : 1,
        },
      });
    },

    // 计算连接到同一点的连线数量
    countConnectionsToPoint(x, y) {
      return this.dependencies.filter((dep) => {
        const endPoint = this.calculateEndPoint(dep);
        return Math.abs(endPoint.x - x) < 1 && Math.abs(endPoint.y - y) < 1;
      }).length;
    },

    // 获取当前连线在同一终点连线中的索引
    getConnectionIndex(fromX, fromY, toX, toY) {
      const connections = this.dependencies
        .filter((dep) => {
          const endPoint = this.calculateEndPoint(dep);
          return (
            Math.abs(endPoint.x - toX) < 1 && Math.abs(endPoint.y - toY) < 1
          );
        })
        .sort((a, b) => {
          const startA = this.calculateStartPoint(a);
          const startB = this.calculateStartPoint(b);
          // 按照起点Y坐标排序
          return startA.y - startB.y;
        });

      return connections.findIndex((dep) => {
        const startPoint = this.calculateStartPoint(dep);
        return (
          Math.abs(startPoint.x - fromX) < 1 &&
          Math.abs(startPoint.y - fromY) < 1
        );
      });
    },

    // 计算依赖关系的起点坐标
    calculateStartPoint(dependency) {
      const fromBar = this.findTaskBar(dependency.fromId);
      if (!fromBar) return { x: 0, y: 0 };

      const { from } = this.getLineDirection(dependency.type);
      const x = from === "right" ? fromBar.left + fromBar.width : fromBar.left;
      const y = (fromBar.index || 0) * this.taskHeight + this.taskHeight / 2;

      return { x, y };
    },

    // 计算依赖关系的终点坐标
    calculateEndPoint(dependency) {
      const toBar = this.findTaskBar(dependency.toId);
      if (!toBar) return { x: 0, y: 0 };

      const { to } = this.getLineDirection(dependency.type);
      const x = to === "right" ? toBar.left + toBar.width : toBar.left;
      const y = (toBar.index || 0) * this.taskHeight + this.taskHeight / 2;

      return { x, y };
    },

    // 查找任务条
    findTaskBar(taskId) {
      return this.taskBars.find((bar) => bar.task.id === taskId);
    },

    // 同行智能连线 - 优化版
    createSameRowSmartPath(
      fromX,
      fromY,
      toX,
      toY,
      dependencyType,
      fromBar,
      toBar
    ) {
      const horizontalDistance = Math.abs(toX - fromX);
      const taskHeight = 28;

      // 检查是否有任务条可能遮挡连线路径
      const hasObstacle = this.checkHorizontalPathObstacles(
        fromX,
        fromY,
        toX,
        toY,
        fromBar,
        toBar
      );

      // 计算最优避让路径
      if (!hasObstacle && horizontalDistance > 20) {
        // 直线连接
        return `M ${fromX} ${fromY} L ${toX} ${toY}`;
      } else {
        // 智能避让路径
        const offsetY = hasObstacle ? -(taskHeight / 2) : -(taskHeight / 4);
        const midX = (fromX + toX) / 2;

        // 使用三点贝塞尔曲线创建平滑路径
        return `M ${fromX} ${fromY}
                C ${midX} ${fromY + offsetY} ${midX} ${
          toY + offsetY
        } ${toX} ${toY}`;
      }
    },

    // L形路径 - 优化版
    createLShapePath(fromX, fromY, toX, toY, dependencyType) {
      const { from, to } = this.getLineDirection(dependencyType);
      const taskHeight = 28;

      // 计算转折点
      let turnX = fromX;
      const verticalDist = Math.abs(toY - fromY);
      const horizontalOffset = Math.min(20, verticalDist * 0.2);

      if (from === "right") {
        turnX = Math.max(fromX + horizontalOffset, toX);
      } else {
        turnX = Math.min(fromX - horizontalOffset, toX);
      }

      // 使用三点贝塞尔曲线创建平滑转角
      return `M ${fromX} ${fromY}
              C ${turnX} ${fromY} ${turnX} ${toY} ${toX} ${toY}`;
    },

    // 简单直角连线 - 优化版
    createSimpleRightAnglePath(fromX, fromY, toX, toY, dependencyType) {
      const taskHeight = 28;
      const { from, to } = this.getLineDirection(dependencyType);

      // 计算控制点位置
      const cp1x =
        from === "right"
          ? Math.max(fromX, toX) + taskHeight / 2
          : Math.min(fromX, toX) - taskHeight / 2;

      // 使用三点贝塞尔曲线创建平滑路径
      return `M ${fromX} ${fromY}
              C ${cp1x} ${fromY} ${cp1x} ${toY} ${toX} ${toY}`;
    },

    // 优化的Z字形路径 - 优化版
    createOptimizedZPath(
      fromX,
      fromY,
      toX,
      toY,
      dependencyType,
      fromBar,
      toBar
    ) {
      const { from, to } = this.getLineDirection(dependencyType);
      const taskHeight = 28;

      // 计算水平偏移
      const horizontalDist = Math.abs(toX - fromX);
      const verticalDist = Math.abs(toY - fromY);
      const horizontalOffset = Math.min(taskHeight, horizontalDist * 0.2);

      // 计算转折点
      let midX = fromX;
      if (from === "right") {
        midX = fromX + horizontalOffset;
      } else {
        midX = fromX - horizontalOffset;
      }

      // 使用三点贝塞尔曲线创建平滑路径
      const cp1y = fromY + verticalDist * 0.25;
      const cp2y = toY - verticalDist * 0.25;

      return `M ${fromX} ${fromY}
              C ${midX} ${cp1y} ${midX} ${cp2y} ${toX} ${toY}`;
    },

    // 检查水平路径是否有障碍物 - 优化版
    checkHorizontalPathObstacles(fromX, fromY, toX, toY, fromBar, toBar) {
      const taskHeight = 28;
      const minX = Math.min(fromX, toX);
      const maxX = Math.max(fromX, toX);

      // 检查同行及相邻行的任务
      return this.taskBars.some((bar) => {
        if (!bar || bar === fromBar || bar === toBar) return false;

        const barY = (bar.index || 0) * taskHeight + taskHeight / 2;
        const barLeft = bar.left || 0;
        const barRight = barLeft + (bar.width || 0);

        // 检查任务是否在连线路径上
        return (
          Math.abs(barY - fromY) <= taskHeight &&
          barLeft < maxX &&
          barRight > minX
        );
      });
    },

    // 检查垂直路径是否有障碍物 - 优化版
    checkVerticalPathObstacles(fromX, fromY, toX, toY, fromBar, toBar) {
      const taskHeight = 28;
      const minY = Math.min(fromY, toY);
      const maxY = Math.max(fromY, toY);

      // 检查垂直路径上的任务
      return this.taskBars.some((bar) => {
        if (!bar || bar === fromBar || bar === toBar) return false;

        const barY = (bar.index || 0) * taskHeight + taskHeight / 2;
        const barLeft = bar.left || 0;
        const barRight = barLeft + (bar.width || 0);
        const barWidth = bar.width || 0;

        // 检查任务是否在垂直路径上
        return (
          barY > minY &&
          barY < maxY &&
          Math.abs(barLeft + barWidth / 2 - toX) < barWidth / 2
        );
      });
    },

    // 判断是否可以使用简单直角连线
    canUseSimpleRightAngle(fromX, fromY, toX, toY, fromBar, toBar) {
      // 检查垂直路径和水平路径是否都没有障碍物
      const hasVerticalObstacle = this.checkVerticalPathObstacles(
        fromX,
        fromY,
        toX,
        toY,
        fromBar,
        toBar
      );
      const hasHorizontalObstacle = this.checkHorizontalPathObstacles(
        toX,
        fromY,
        toX,
        toY,
        fromBar,
        toBar
      );

      return !hasVerticalObstacle && !hasHorizontalObstacle;
    },

    // 创建贝塞尔曲线路径
    createBezierPath(fromX, fromY, toX, toY, dependencyType, fromBar, toBar) {
      // 计算基础水平偏移
      const baseOffset = this.calculateHorizontalOffset(
        dependencyType,
        fromBar,
        toBar
      );

      // 根据依赖类型和方向调整控制点
      const { from, to } = this.getLineDirection(dependencyType);

      // 计算垂直距离和动态偏移
      const verticalDist = Math.abs(toY - fromY);
      const horizontalDist = Math.abs(toX - fromX);

      // 动态调整水平偏移，使其与垂直距离成比例
      const dynamicOffset = Math.min(baseOffset, verticalDist * 0.5);

      // 计算控制点
      let cp1x, cp2x;

      // 处理同行连线的特殊情况
      if (fromY === toY) {
        // 使用更平滑的水平曲线
        const midX = (fromX + toX) / 2;
        const smoothOffset = Math.min(Math.abs(toX - fromX) * 0.2, baseOffset);

        if (from === "right") {
          cp1x = fromX + smoothOffset;
        } else {
          cp1x = fromX - smoothOffset;
        }

        if (to === "right") {
          cp2x = toX + smoothOffset;
        } else {
          cp2x = toX - smoothOffset;
        }

        return `M ${fromX} ${fromY} C ${cp1x} ${fromY} ${cp2x} ${toY} ${toX} ${toY}`;
      }

      // 计算垂直方向的控制点偏移
      const verticalOffset = verticalDist * 0.2;
      const cp1y = fromY + (toY > fromY ? verticalOffset : -verticalOffset);
      const cp2y = toY - (toY > fromY ? verticalOffset : -verticalOffset);

      // 根据连接方向和距离动态调整水平控制点
      if (from === "right") {
        cp1x = fromX + Math.min(dynamicOffset, horizontalDist * 0.4);
      } else {
        cp1x = fromX - Math.min(dynamicOffset, horizontalDist * 0.4);
      }

      if (to === "right") {
        cp2x = toX + Math.min(dynamicOffset, horizontalDist * 0.4);
      } else {
        cp2x = toX - Math.min(dynamicOffset, horizontalDist * 0.4);
      }

      // 创建三次贝塞尔曲线路径，使用垂直偏移实现更自然的曲线
      return `M ${fromX} ${fromY} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${toX} ${toY}`;
    },

    // 优化的Z字形折线算法 - 智能转弯处理，箭头指向顶部
    createZShapedPath(fromX, fromY, toX, toY, dependencyType, fromBar, toBar) {
      // 根据依赖类型确定连线起始和结束方向
      const { from, to } = this.getLineDirection(dependencyType);
      const taskHeight = 28; // 任务条高度

      // 计算水平和垂直距离
      const horizontalDist = Math.abs(toX - fromX);
      const verticalDist = Math.abs(toY - fromY);

      // 同行任务特殊处理
      if (fromY === toY) {
        // 直接水平连线
        return `M ${fromX} ${fromY} L ${toX} ${toY}`;
      }

      // 计算中间点
      const zMidY = fromY + (toY - fromY) / 2;
      const zMidX = fromX + (toX - fromX) / 2;

      // 构建Z字形路径
      return `M ${fromX} ${fromY}
              L ${zMidX} ${fromY}
              L ${zMidX} ${toY}
              L ${toX} ${toY}`;

      // 智能计算终点位置
      let adjustedToX = toX;
      let adjustedToY = toY;
      const verticalDiff = toY - fromY;

      // 根据垂直距离调整终点位置
      if (Math.abs(verticalDiff) > taskHeight * 1.5) {
        // 垂直距离较大时，连接到顶部或底部
        if (verticalDiff > 0) {
          // 目标在下方，连接到顶部
          adjustedToY = toY - taskHeight / 2.5; // 更靠近顶部
          // 根据连接方向调整水平位置
          if (to === "left") {
            adjustedToX = toX + arrowSpace; // 左侧连接时向右偏移
          } else {
            adjustedToX = toX - arrowSpace; // 右侧连接时向左偏移
          }
        } else {
          // 目标在上方，连接到底部
          adjustedToY = toY + taskHeight / 2.5; // 更靠近底部
          // 根据连接方向调整水平位置
          if (to === "left") {
            adjustedToX = toX + arrowSpace; // 左侧连接时向右偏移
          } else {
            adjustedToX = toX - arrowSpace; // 右侧连接时向左偏移
          }
        }
      } else {
        // 垂直距离较小时，智能调整连接点
        if (to === "left") {
          adjustedToX = toX + arrowSpace; // 左侧连接时向右偏移
          adjustedToY = toY - taskHeight / 3; // 更靠近顶部
        } else {
          adjustedToX = toX - arrowSpace; // 右侧连接时向左偏移
          adjustedToY = toY - taskHeight / 3; // 更靠近顶部
        }
      }

      // 处理同行连线的特殊情况
      if (Math.abs(fromY - toY) < taskHeight) {
        const tasksMayOverlap =
          fromTaskWidth > 0 &&
          toTaskWidth > 0 &&
          horizontalDist < (fromTaskWidth + toTaskWidth) * 1.2;

        if (tasksMayOverlap) {
          // 任务可能重叠时，使用上方弧线
          const midY = Math.min(fromY, toY) - taskHeight * 0.75; // 增加弧线高度
          return `M ${adjustedFromX} ${adjustedFromY}
                  L ${adjustedFromX} ${midY}
                  L ${adjustedToX} ${midY}
                  L ${adjustedToX} ${adjustedToY}`;
        }
      }

      // 计算中间点
      const midX = adjustedFromX + (adjustedToX - adjustedFromX) / 2;
      const midY1 = adjustedFromY;
      const midY2 = adjustedToY;

      // 创建带有平滑转角的Z字形路径
      return `M ${adjustedFromX} ${adjustedFromY}
              L ${midX} ${midY1}
              L ${midX} ${midY2}
              L ${adjustedToX} ${adjustedToY}`;
    },

    // 计算水平偏移距离 - 根据依赖类型和节点间距智能调整，集成避障算法
    calculateHorizontalOffset(dependencyType, fromBar, toBar) {
      const baseOffset = 25; // 减少基础偏移距离，让连线更简洁

      // 安全检查：如果任务条信息不完整，使用默认偏移
      if (
        !fromBar ||
        !toBar ||
        typeof fromBar.left !== "number" ||
        typeof toBar.left !== "number"
      ) {
        return baseOffset;
      }

      const taskDistance = Math.abs(toBar.left - fromBar.left);

      // 基础偏移计算
      let offset = baseOffset;
      if (taskDistance < 100) {
        offset = baseOffset + 20; // 距离较近时增加偏移
      } else if (taskDistance > 300) {
        offset = Math.max(baseOffset - 10, 20); // 距离较远时减少偏移
      }

      // 集成避障偏移 - 避免连线交叉和穿过节点
      try {
        const fromY = (fromBar.index || 0) * 28 + 14;
        const toY = (toBar.index || 0) * 28 + 14;
        const fromX = this.getConnectionPoint(fromBar, dependencyType, "from");
        const toX = this.getConnectionPoint(toBar, dependencyType, "to");

        const avoidanceOffset = this.calculateCollisionAvoidanceOffset(
          fromX,
          fromY,
          toX,
          toY,
          fromBar,
          toBar,
          dependencyType
        );

        // 应用避障偏移，增加连线间的距离
        offset += Math.abs(avoidanceOffset.horizontal);
      } catch (error) {
        // 避障算法出错时使用基础偏移
        console.warn("避障算法计算失败，使用基础偏移", error);
      }

      return offset;
    },

    // 计算垂直间距 - 避免多条连线重叠
    calculateVerticalSpacing(fromBar, toBar) {
      const baseSpacing = 20;

      // 安全检查：如果任务条信息不完整，使用默认间距
      if (
        !fromBar ||
        !toBar ||
        typeof fromBar.index !== "number" ||
        typeof toBar.index !== "number"
      ) {
        return baseSpacing;
      }

      const rowDifference = Math.abs(toBar.index - fromBar.index);

      // 行距较小时减少垂直间距，行距较大时增加垂直间距
      if (rowDifference <= 1) {
        return baseSpacing;
      } else if (rowDifference <= 3) {
        return baseSpacing + 10;
      } else {
        return baseSpacing + Math.min(rowDifference * 5, 30);
      }
    },

    // 获取连线方向信息 - 根据依赖类型确定起始和结束方向
    getLineDirection(dependencyType) {
      // FS类型必须从右侧连出，连接到左侧
      if (dependencyType === "FS") {
        return { from: "right", to: "left" };
      }
      // SS类型从左侧连接到左侧
      if (dependencyType === "SS") {
        return { from: "left", to: "left" };
      }
      // FF类型从右侧连接到右侧
      if (dependencyType === "FF") {
        return { from: "right", to: "right" };
      }
      // SF类型从左侧连接到右侧
      if (dependencyType === "SF") {
        return { from: "left", to: "right" };
      }
      // 默认情况
      return { from: "right", to: "left" };
    },

    // 创建同行Z字形路径 - 处理源节点和目标节点在同一行的情况
    createSameRowZPath(
      fromX,
      fromY,
      toX,
      toY,
      direction,
      horizontalOffset,
      verticalSpacing
    ) {
      const { from: fromDirection, to: toDirection } = direction;

      // 计算避让高度，优先使用上方避让
      const avoidanceY = fromY - verticalSpacing;

      // 计算水平段的起点和终点
      const startOffset =
        fromDirection === "right" ? horizontalOffset : -horizontalOffset;
      const endOffset =
        toDirection === "right" ? horizontalOffset : -horizontalOffset;

      const p1X = fromX + startOffset;
      const p2X = toX + endOffset;

      // 如果连线距离很短，使用曲线连接以获得更好的视觉效果
      if (Math.abs(toX - fromX) < 80) {
        const midX = (fromX + toX) / 2;
        const controlY = avoidanceY - 10; // 增加曲线弯曲度
        return `M ${fromX} ${fromY} Q ${midX} ${controlY} ${toX} ${toY}`;
      }

      // 标准四段式Z字形路径：水平→垂直→水平→垂直
      return `M ${fromX} ${fromY} L ${p1X} ${fromY} L ${p1X} ${avoidanceY} L ${p2X} ${avoidanceY} L ${p2X} ${toY} L ${toX} ${toY}`;
    },

    // 创建标准四段式Z字形路径 - 处理不同行之间的连线
    createStandardZPath(
      fromX,
      fromY,
      toX,
      toY,
      direction,
      horizontalOffset,
      verticalSpacing
    ) {
      const { from: fromDirection, to: toDirection } = direction;

      // 计算四段式路径的关键点
      const startOffset =
        fromDirection === "right" ? horizontalOffset : -horizontalOffset;
      const endOffset =
        toDirection === "right" ? horizontalOffset : -horizontalOffset;

      // 第一段：水平段 - 从连接点水平延伸
      const p1X = fromX + startOffset;
      const p1Y = fromY;

      // 智能计算转折点位置，确保Z字形美观
      let midY;
      const yDistance = Math.abs(toY - fromY);

      if (yDistance > 60) {
        // 距离较远时，使用更平滑的中间位置
        midY = fromY + (toY - fromY) * 0.5;
      } else {
        // 距离较近时，使用偏向起点的位置，避免连线过于陡峭
        midY = fromY + (toY - fromY) * 0.3;
      }

      // 第二段：垂直段 - 转向中间水平线
      const p2X = p1X;
      const p2Y = midY;

      // 第三段：水平段 - 在中间高度水平移动到目标区域
      const p3X = toX + endOffset;
      const p3Y = midY;

      // 第四段：垂直段到达目标
      const p4X = p3X;
      const p4Y = toY;

      // 构建优化的四段式Z字形SVG路径
      // 确保路径点精确到整数，避免模糊渲染
      const points = [
        [Math.round(fromX), Math.round(fromY)],
        [Math.round(p1X), Math.round(p1Y)],
        [Math.round(p2X), Math.round(p2Y)],
        [Math.round(p3X), Math.round(p3Y)],
        [Math.round(p4X), Math.round(p4Y)],
        [Math.round(toX), Math.round(toY)],
      ];

      return `M ${points[0][0]} ${points[0][1]} L ${points[1][0]} ${points[1][1]} L ${points[2][0]} ${points[2][1]} L ${points[3][0]} ${points[3][1]} L ${points[4][0]} ${points[4][1]} L ${points[5][0]} ${points[5][1]}`;
    },

    // 传统连线算法 - 向后兼容保留
    createTraditionalPath(fromX, fromY, toX, toY, dependencyType) {
      const offset = 30; // 传统偏移距离

      // 同行连接处理 - 智能避让
      if (fromY === toY) {
        const avoidanceOffset = 15;
        let midY = fromY - avoidanceOffset;

        // 边界检测：如果上方空间不足，使用下方避让
        if (fromY - avoidanceOffset < 10) {
          midY = fromY + 30;
        }

        if (Math.abs(toX - fromX) < 50) {
          return `M ${fromX} ${fromY} Q ${
            (fromX + toX) / 2
          } ${midY} ${toX} ${toY}`;
        }
        return `M ${fromX} ${fromY} L ${fromX} ${midY} L ${toX} ${midY} L ${toX} ${toY}`;
      }

      // 传统的分类型连线处理
      switch (dependencyType) {
        case "SS": // Start-To-Start
          return this.createTraditionalSSPath(fromX, fromY, toX, toY, offset);
        case "SF": // Start-To-Finish
          return this.createTraditionalSFPath(fromX, fromY, toX, toY, offset);
        case "FS": // Finish-To-Start
          return this.createTraditionalFSPath(fromX, fromY, toX, toY, offset);
        case "FF": // Finish-To-Finish
          return this.createTraditionalFFPath(fromX, fromY, toX, toY, offset);
        default:
          return this.createTraditionalFSPath(fromX, fromY, toX, toY, offset);
      }
    },

    // 传统FS路径
    createTraditionalFSPath(fromX, fromY, toX, toY, offset) {
      const avoidanceOffset = 15;
      const minY = Math.min(fromY, toY);
      const maxY = Math.max(fromY, toY);
      const containerHeight = this.actualChartHeight || 600;

      let avoidanceY = minY - avoidanceOffset;
      if (minY - avoidanceOffset < 10) {
        const downAvoidance = maxY + 30;
        avoidanceY =
          downAvoidance > containerHeight - 20 ? minY - 5 : downAvoidance;
      }

      const rightExtend = fromX + offset;
      const leftExtend = toX - offset;
      return `M ${fromX} ${fromY} L ${rightExtend} ${fromY} L ${rightExtend} ${avoidanceY} L ${leftExtend} ${avoidanceY} L ${leftExtend} ${toY} L ${toX} ${toY}`;
    },

    // 传统SS路径
    createTraditionalSSPath(fromX, fromY, toX, toY, offset) {
      const avoidanceOffset = 15;
      const minY = Math.min(fromY, toY);
      const leftExtend = fromX - offset;
      const avoidanceY = minY - avoidanceOffset;

      return `M ${fromX} ${fromY} L ${leftExtend} ${fromY} L ${leftExtend} ${avoidanceY} L ${
        toX - offset
      } ${avoidanceY} L ${toX - offset} ${toY} L ${toX} ${toY}`;
    },

    // 传统SF路径
    createTraditionalSFPath(fromX, fromY, toX, toY, offset) {
      const avoidanceOffset = 15;
      const minY = Math.min(fromY, toY);
      const leftExtend = fromX - offset;
      const rightExtend = toX + offset;
      const avoidanceY = minY - avoidanceOffset;

      return `M ${fromX} ${fromY} L ${leftExtend} ${fromY} L ${leftExtend} ${avoidanceY} L ${rightExtend} ${avoidanceY} L ${rightExtend} ${toY} L ${toX} ${toY}`;
    },

    // 传统FF路径
    createTraditionalFFPath(fromX, fromY, toX, toY, offset) {
      const avoidanceOffset = 15;
      const minY = Math.min(fromY, toY);
      const rightExtend1 = fromX + offset;
      const rightExtend2 = toX + offset;
      const avoidanceY = minY - avoidanceOffset;

      return `M ${fromX} ${fromY} L ${rightExtend1} ${fromY} L ${rightExtend1} ${avoidanceY} L ${rightExtend2} ${avoidanceY} L ${rightExtend2} ${toY} L ${toX} ${toY}`;
    },

    // 连线避障算法 - 检测并避免连线交叉/穿过节点
    calculateCollisionAvoidanceOffset(
      fromX,
      fromY,
      toX,
      toY,
      fromBar,
      toBar,
      dependencyType
    ) {
      const connectionKey = `${fromBar.task.id}_${toBar.task.id}`;

      // 安全检查Map是否已初始化
      if (!this.lineOffsetMap) {
        this.lineOffsetMap = new Map();
      }

      // 检查缓存
      if (this.lineOffsetMap.has(connectionKey)) {
        return this.lineOffsetMap.get(connectionKey);
      }

      // 计算基础偏移
      let horizontalOffset = 0;
      let verticalOffset = 0;

      // 1. 检测与其他任务节点的冲突
      const conflictingBars = this.detectNodeConflicts(
        fromX,
        fromY,
        toX,
        toY,
        fromBar,
        toBar
      );
      if (conflictingBars.length > 0) {
        horizontalOffset += conflictingBars.length * 8; // 每个冲突节点增加8px偏移
      }

      // 2. 检测与其他连线的冲突
      const conflictingLines = this.detectLineConflicts(
        fromX,
        fromY,
        toX,
        toY,
        connectionKey
      );
      if (conflictingLines.length > 0) {
        verticalOffset += conflictingLines.length * 12; // 每条冲突连线增加12px偏移
      }

      // 3. 根据依赖类型调整偏移方向
      const direction = this.getLineDirection(dependencyType);
      if (direction.from === "left") {
        horizontalOffset = -horizontalOffset;
      }

      const offset = { horizontal: horizontalOffset, vertical: verticalOffset };
      this.lineOffsetMap.set(connectionKey, offset);
      return offset;
    },

    // 检测节点冲突 - 连线是否会穿过其他任务节点
    detectNodeConflicts(fromX, fromY, toX, toY, fromBar, toBar) {
      const conflictingBars = [];
      const lineRect = this.getLineRect(fromX, fromY, toX, toY);

      for (const bar of this.taskBars) {
        // 跳过起始和结束任务
        if (bar.task.id === fromBar.task.id || bar.task.id === toBar.task.id) {
          continue;
        }

        // 检查任务节点是否与连线路径相交
        const barY = (bar.index || 0) * 28;
        const barRect = {
          left: bar.left,
          top: barY,
          right: bar.left + bar.width,
          bottom: barY + 28,
        };

        if (this.isRectIntersecting(lineRect, barRect)) {
          conflictingBars.push(bar);
        }
      }

      return conflictingBars;
    },

    // 检测连线冲突 - 连线是否与其他连线重叠
    detectLineConflicts(fromX, fromY, toX, toY, currentConnectionKey) {
      const conflictingLines = [];
      const currentLineRect = this.getLineRect(fromX, fromY, toX, toY);

      // 安全检查Map是否已初始化
      if (!this.connectionConflictMap) {
        this.connectionConflictMap = new Map();
      }

      // 遍历已缓存的连线
      for (const [key, cachedLine] of this.connectionConflictMap) {
        if (key === currentConnectionKey) continue;

        const cachedLineRect = cachedLine.rect;
        if (this.isRectIntersecting(currentLineRect, cachedLineRect)) {
          conflictingLines.push(cachedLine);
        }
      }

      // 缓存当前连线信息
      this.connectionConflictMap.set(currentConnectionKey, {
        rect: currentLineRect,
        fromX,
        fromY,
        toX,
        toY,
      });

      return conflictingLines;
    },

    // 获取连线的边界矩形
    getLineRect(fromX, fromY, toX, toY) {
      const padding = 5; // 连线边界扩展
      return {
        left: Math.min(fromX, toX) - padding,
        top: Math.min(fromY, toY) - padding,
        right: Math.max(fromX, toX) + padding,
        bottom: Math.max(fromY, toY) + padding,
      };
    },

    // 判断两个矩形是否相交
    isRectIntersecting(rect1, rect2) {
      return !(
        rect1.right < rect2.left ||
        rect1.left > rect2.right ||
        rect1.bottom < rect2.top ||
        rect1.top > rect2.bottom
      );
    },

    // SS: Start-To-Start 连线路径 - 使用Z字形算法
    createStartToStartPath(fromX, fromY, toX, toY, offset) {
      // 使用统一的Z字形算法，保持代码一致性
      return this.createZShapedPath(fromX, fromY, toX, toY, "SS", null, null);
    },

    // SF: Start-To-Finish 连线路径 - 使用Z字形算法
    createStartToFinishPath(fromX, fromY, toX, toY, offset) {
      // 使用统一的Z字形算法，保持代码一致性
      return this.createZShapedPath(fromX, fromY, toX, toY, "SF", null, null);
    },

    // FS: Finish-To-Start 连线路径 - 使用Z字形算法
    createFinishToStartPath(fromX, fromY, toX, toY, offset) {
      // 使用统一的Z字形算法，保持代码一致性
      return this.createZShapedPath(fromX, fromY, toX, toY, "FS", null, null);
    },

    // FF: Finish-To-Finish 连线路径 - 使用Z字形算法
    createFinishToFinishPath(fromX, fromY, toX, toY, offset) {
      // 使用统一的Z字形算法，保持代码一致性
      return this.createZShapedPath(fromX, fromY, toX, toY, "FF", null, null);
    },

    // 确保箭头可见性 - 最小调整，保持箭头贴近节点
    ensureArrowVisibility(path, dependencyType, fromBar, toBar) {
      if (!path || !toBar) return path;

      // 检查最后一段路径是否可能被任务条遮挡
      const lastSegmentMatch = path.match(/L\s*([\d.-]+)\s+([\d.-]+)$/);
      if (!lastSegmentMatch) return path;

      const lastX = parseFloat(lastSegmentMatch[1]);
      const lastY = parseFloat(lastSegmentMatch[2]);

      // 计算任务条的边界
      const taskLeft = toBar.left || 0;
      const taskRight = taskLeft + (toBar.width || 0);
      const taskY = (toBar.index || 0) * 28 + 14;

      // 仅在箭头完全被任务条遮挡时才调整
      const arrowCompletelyBlocked =
        Math.abs(lastY - taskY) < 8 && // 垂直位置非常接近任务条中心
        lastX > taskLeft + 5 &&
        lastX < taskRight - 5; // 水平位置在任务条内部

      if (arrowCompletelyBlocked) {
        // 最小调整，确保箭头刚好露出任务条边缘
        const minExtension = 8; // 最小延伸距离，保持箭头贴近
        let adjustedX;

        if (dependencyType === "FS" || dependencyType === "SS") {
          // 连接到开始点，微调到左边缘外
          adjustedX = taskLeft - minExtension;
        } else {
          // 连接到结束点，微调到右边缘外
          adjustedX = taskRight + minExtension;
        }

        path = path.replace(
          /L\s*([\d.-]+)\s+([\d.-]+)$/,
          `L ${adjustedX} ${lastY}`
        );
      }

      return path;
    },

    // 调整milestone箭头路径，确保不被diamond形状遮挡但保持贴近
    adjustMilestoneArrowPath(path, dependencyType, toBar) {
      if (!path || !toBar) return path;

      const diamondRadius = (toBar.width || 0) / 2;
      const centerX = (toBar.left || 0) + diamondRadius;
      const minExtendLength = 10; // 最小延伸距离，保持箭头贴近milestone

      const lastSegmentMatch = path.match(/L\s*([\d.-]+)\s+([\d.-]+)$/);
      if (lastSegmentMatch) {
        const lastX = parseFloat(lastSegmentMatch[1]);
        const lastY = parseFloat(lastSegmentMatch[2]);

        // 根据连接方向决定延伸方向，最小化距离
        let extendX = lastX;
        if (dependencyType === "FS" || dependencyType === "SS") {
          // 连接到开始点，箭头在左侧，刚好避开diamond
          extendX = centerX - diamondRadius - minExtendLength;
        } else if (dependencyType === "FF" || dependencyType === "SF") {
          // 连接到结束点，箭头在右侧，刚好避开diamond
          extendX = centerX + diamondRadius + minExtendLength;
        }

        path = path.replace(
          /L\s*([\d.-]+)\s+([\d.-]+)$/,
          `L ${extendX} ${lastY}`
        );
      }

      return path;
    },

    // 检查是否为结束点连接
    isEndPointConnection(line) {
      if (!line.dependency) return false;
      const dependencyType = line.dependency.type || "FS";
      return dependencyType === "FF" || dependencyType === "SF";
    },

    // 获取终点指示器X坐标
    getEndPointIndicatorX(line) {
      // 使用toBar引用而不是dependency
      const toBar = line.toBar || this.getTaskBarById(line.to);
      if (!toBar) return 0;

      const dependencyType = line.type || "FS";
      const isMilestone = toBar.task.type === "milestone";

      if (dependencyType === "FF" || dependencyType === "SF") {
        // 结束点：在节点右侧外部显示指示器
        if (isMilestone) {
          // milestone：指示器在diamond右侧更远的位置
          const centerX = toBar.left + toBar.width / 2;
          const diamondRadius = toBar.width / 2;
          return centerX + diamondRadius + 25; // 确保不被diamond挡住
        } else {
          // 普通任务：指示器在任务条右侧
          return toBar.left + toBar.width + 12;
        }
      }
      return 0;
    },

    // 获取终点指示器Y坐标
    getEndPointIndicatorY(line) {
      // 使用toBar引用而不是重新查找
      const toBar = line.toBar || this.getTaskBarById(line.to);
      if (!toBar) return 0;
      return (toBar.index || 0) * 28 + 14;
    },

    // 获取连接线颜色 - 支持灰色模式和不可编辑模式
    getConnectionLineColor(line) {
      // 如果连接线不可编辑，使用默认灰色
      if (!this.connectionEditable) {
        return this.connectionDefaultColor;
      }

      if (this.grayConnectionMode) {
        return "#9e9e9e"; // bryntum风格的灰色
      }
      return line.color || "#666";
    },

    // 判断是否是结束点连接（需要额外的终点指示器）
    isEndPointConnection(line) {
      const dependencyType = line.type || "FS";
      // 检查是否连接到milestone类型任务的结束点
      const toBar = line.toBar || this.getTaskBarById(line.to);
      const isMilestone = toBar && toBar.task.type === "milestone";

      // milestone类型或FF/SF类型都需要终点指示器
      return dependencyType === "FF" || dependencyType === "SF" || isMilestone;
    },

    // 判断是否显示连接线
    shouldShowDependencyLine(line) {
      // 如果设置了全局隐藏依赖线
      if (this.temporarilyHideDependencies) {
        return false;
      }

      // 如果设置了隐藏特定任务的依赖线
      if (this.hidingTaskId) {
        if (line.from === this.hidingTaskId || line.to === this.hidingTaskId) {
          return false;
        }
      }

      // 如果设置了隐藏多个任务的依赖线（父节点及其子节点）
      if (this.hidingTaskIds && this.hidingTaskIds.length > 0) {
        if (
          this.hidingTaskIds.includes(line.from) ||
          this.hidingTaskIds.includes(line.to)
        ) {
          return false;
        }
      }

      // 检查连接线的两端节点是否都存在
      const fromBar = this.taskBars.find((bar) => bar.task.id === line.from);
      const toBar = this.taskBars.find((bar) => bar.task.id === line.to);
      if (!fromBar || !toBar) {
        return false;
      }

      return true;
    },

    // 计算关键路径 - 使用CPM算法
    calculateCriticalPath() {
      // 如果不显示关键路径，直接返回空数组
      if (!this.showCriticalPath) {
        return [];
      }

      // 创建任务映射表，便于快速查找
      const taskMap = {};
      this.tasks.forEach((task) => {
        taskMap[task.id] = {
          ...task,
          earliestStart: 0,
          earliestFinish: 0,
          latestStart: Infinity,
          latestFinish: Infinity,
          slack: 0,
          isCritical: false,
          successors: [],
          duration: 0,
        };
      });

      // 计算任务持续时间（天数）
      for (const taskId in taskMap) {
        const task = taskMap[taskId];
        if (task.startDate && task.endDate) {
          const startDate = moment(task.startDate);
          const endDate = moment(task.endDate);
          task.duration = endDate.diff(startDate, "days") + 1; // 包含首尾日期
        }
      }

      // 构建任务依赖关系图
      this.dependencies.forEach((dep) => {
        if (taskMap[dep.from] && taskMap[dep.to]) {
          taskMap[dep.from].successors.push(dep.to);
        }
      });

      // 找出所有没有前置任务的起始节点
      const startNodes = [];
      for (const taskId in taskMap) {
        const task = taskMap[taskId];
        const hasIncomingDeps = this.dependencies.some(
          (dep) => dep.to === taskId
        );
        if (!hasIncomingDeps) {
          startNodes.push(taskId);
        }
      }

      // 前向遍历：计算最早开始和最早完成时间
      const visited = new Set();

      // 定义递归函数计算最早时间
      const calculateEarliestTimes = (taskId) => {
        if (visited.has(taskId)) return;
        visited.add(taskId);

        const task = taskMap[taskId];

        // 计算前置任务的最早完成时间
        const predecessors = this.dependencies
          .filter((dep) => dep.to === taskId)
          .map((dep) => dep.from);

        // 如果有前置任务，取最大的最早完成时间作为当前任务的最早开始时间
        if (predecessors.length > 0) {
          let maxEarliestFinish = 0;
          predecessors.forEach((predId) => {
            if (!visited.has(predId)) {
              calculateEarliestTimes(predId);
            }
            maxEarliestFinish = Math.max(
              maxEarliestFinish,
              taskMap[predId].earliestFinish
            );
          });
          task.earliestStart = maxEarliestFinish;
        }

        // 计算最早完成时间
        task.earliestFinish = task.earliestStart + task.duration;

        // 递归计算后续任务
        task.successors.forEach((succId) => {
          calculateEarliestTimes(succId);
        });
      };

      // 从所有起始节点开始计算
      startNodes.forEach((taskId) => {
        calculateEarliestTimes(taskId);
      });

      // 找出项目的结束时间（所有任务中最大的最早完成时间）
      let projectFinish = 0;
      for (const taskId in taskMap) {
        projectFinish = Math.max(projectFinish, taskMap[taskId].earliestFinish);
      }

      // 找出所有没有后续任务的结束节点
      const endNodes = [];
      for (const taskId in taskMap) {
        const task = taskMap[taskId];
        if (task.successors.length === 0) {
          endNodes.push(taskId);
          // 设置结束节点的最晚完成时间为项目结束时间
          task.latestFinish = projectFinish;
        }
      }

      // 反向遍历：计算最晚开始和最晚完成时间
      visited.clear();

      // 定义递归函数计算最晚时间
      const calculateLatestTimes = (taskId) => {
        if (visited.has(taskId)) return;
        visited.add(taskId);

        const task = taskMap[taskId];

        // 如果是结束节点，已经设置了最晚完成时间
        if (task.successors.length === 0) {
          task.latestStart = task.latestFinish - task.duration;
        } else {
          // 计算所有后续任务的最晚开始时间
          let minLatestStart = Infinity;
          task.successors.forEach((succId) => {
            if (!visited.has(succId)) {
              calculateLatestTimes(succId);
            }
            minLatestStart = Math.min(
              minLatestStart,
              taskMap[succId].latestStart
            );
          });

          // 当前任务的最晚完成时间是后续任务的最早开始时间
          task.latestFinish = minLatestStart;
          task.latestStart = task.latestFinish - task.duration;
        }

        // 递归计算前置任务
        this.dependencies
          .filter((dep) => dep.to === taskId)
          .forEach((dep) => {
            calculateLatestTimes(dep.from);
          });
      };

      // 从所有结束节点开始反向计算
      endNodes.forEach((taskId) => {
        calculateLatestTimes(taskId);
      });

      // 计算每个任务的松弛时间并确定关键路径
      const criticalPathTaskIds = [];
      for (const taskId in taskMap) {
        const task = taskMap[taskId];
        task.slack = task.latestStart - task.earliestStart;

        // 松弛时间为0的任务在关键路径上
        if (task.slack === 0) {
          task.isCritical = true;
          criticalPathTaskIds.push(taskId);
        }
      }

      return criticalPathTaskIds;
    },

    // 获取可见任务ID（虚拟滚动或可见区过滤）- 性能优化版本
    getVisibleTaskIds() {
      // 缓存可视区域任务ID，避免重复计算
      const cacheKey = this.generateVisibleAreaCacheKey();
      if (this._visibleAreaCache && this._visibleAreaCache.key === cacheKey) {
        return this._visibleAreaCache.taskIds;
      }

      // 获取滚动容器信息
      const container = this._ganttScrollContainer;
      if (!container) {
        // 兜底：返回所有任务ID
        const allTaskIds = this.taskBars.map((bar) => bar.task.id);
        this._visibleAreaCache = { key: cacheKey, taskIds: allTaskIds };
        return allTaskIds;
      }

      // 计算可视区域范围
      const scrollLeft = container.scrollLeft;
      const containerWidth = container.clientWidth;
      const visibleLeft = scrollLeft - 100; // 左侧缓冲区
      const visibleRight = scrollLeft + containerWidth + 100; // 右侧缓冲区

      // 过滤可视区域内的任务
      const visibleTaskIds = this.taskBars
        .filter((bar) => {
          const barRight = bar.left + bar.width;
          return barRight >= visibleLeft && bar.left <= visibleRight;
        })
        .map((bar) => bar.task.id);

      // 缓存结果
      this._visibleAreaCache = { key: cacheKey, taskIds: visibleTaskIds };
      return visibleTaskIds;
    },

    // 生成可视区域缓存键
    generateVisibleAreaCacheKey() {
      if (!this._ganttScrollContainer) return "no-container";

      const container = this._ganttScrollContainer;
      return `${container.scrollLeft}_${container.clientWidth}_${this.taskBars.length}`;
    },

    // 全局双击事件处理
    handleGlobalDblClick(event) {
      console.log("[调试] 全局双击事件触发", event);

      // 防止重复触发
      if (this.dragPreventedByDblClick) {
        return;
      }

      // 设置双击防拖拽标志
      this.dragPreventedByDblClick = true;
      setTimeout(() => {
        this.dragPreventedByDblClick = false;
      }, 300);

      // 1. 检查是否点击了任务条或其子元素（改进选择器）
      const barContainer = event.target.closest(".gantt-bar-container");
      if (barContainer) {
        // 检查是否点击了任务条本身或其子元素（但排除特定的交互元素）
        const isTaskBar =
          event.target.closest(".gantt-bar") ||
          event.target.closest(".gantt-milestone-marker") ||
          event.target.classList.contains("gantt-bar") ||
          event.target.classList.contains("gantt-bar-text") ||
          event.target.classList.contains("task-name") ||
          event.target.classList.contains("gantt-bar-progress-text") ||
          event.target.classList.contains("task-type-icon");

        // 排除连接点、调整手柄和删除按钮区域
        const isExcludedElement =
          event.target.closest(".gantt-connection-point") ||
          event.target.closest(".resize-handle") ||
          event.target.closest(".task-delete-btn") ||
          event.target.closest(".gantt-progress-handle-container") ||
          event.target.classList.contains("parent-indicator");

        if (isTaskBar && !isExcludedElement) {
          // 找到对应的任务
          const taskId = barContainer.dataset.taskId;
          if (taskId) {
            const task = this.tasks.find((t) => t.id === taskId);
            if (task) {
              console.log("[调试] 双击任务条区域，编辑任务", task);
              this.editTask(task);
              return;
            }
          }
        }
      }

      // 2. 检查是否点击了依赖线
      const linkElement = event.target.closest(
        ".gantt-link-hit-area, .gantt-dependency-line-visual"
      );
      if (linkElement) {
        // 找到对应的依赖线
        const fromId = linkElement.closest(".gantt-dependency-group")?.dataset
          .from;
        const toId = linkElement.closest(".gantt-dependency-group")?.dataset.to;
        if (fromId && toId) {
          const line = this.dependencyLines.find(
            (l) => l.from === fromId && l.to === toId
          );
          if (line && this.connectionEditable) {
            console.log("[调试] 双击依赖线，编辑连线", line);
            this.openLinkEditModal(line, event);
            return;
          }
        }
      }

      // 3. 检查是否点击了里程碑（保持原有逻辑）
      const milestoneElement = event.target.closest(".milestone");
      if (milestoneElement) {
        // 找到对应的任务
        const taskId = milestoneElement.closest(".gantt-bar-container")?.dataset
          .taskId;
        if (taskId) {
          const task = this.tasks.find((t) => t.id === taskId);
          if (task) {
            console.log("[调试] 双击里程碑，编辑任务", task);
            this.editTask(task);
            return;
          }
        }
      }
    },

    // 显示任务右键菜单
    showTaskContextMenu(task, event) {
      console.log("[调试] 显示任务右键菜单", task);

      // 参考tooltip逻辑计算菜单位置
      const menuWidth = 200; // 估计菜单宽度
      const menuHeight = 200; // 估计菜单高度
      const padding = 10;
      const offset = 5; // 距离鼠标的偏移

      // 获取Gantt区域容器
      const container = this._ganttScrollContainer;
      let x, y;

      if (!container) {
        // 兜底：无容器时使用相对于viewport的定位
        x = event.clientX + offset;
        y = event.clientY + offset;

        // 智能边界检查
        if (x + menuWidth > window.innerWidth - padding) {
          x = event.clientX - menuWidth - offset;
        }
        if (x < padding) x = padding;
        if (y + menuHeight > window.innerHeight - padding) {
          y = event.clientY - menuHeight - offset;
        }
        if (y < padding) y = event.clientY + offset + 20;

        // 最终边界限制
        x = Math.max(
          padding,
          Math.min(x, window.innerWidth - menuWidth - padding)
        );
        y = Math.max(
          padding,
          Math.min(y, window.innerHeight - menuHeight - padding)
        );
      } else {
        // 获取容器的边界信息
        const containerRect = container.getBoundingClientRect();

        // 计算相对于容器的初始位置
        const relativeX = event.clientX - containerRect.left;
        const relativeY = event.clientY - containerRect.top;

        // 计算在容器内的绝对位置（考虑滚动）
        x = relativeX + container.scrollLeft + offset;
        y = relativeY + container.scrollTop + offset;

        // 容器边界计算
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const maxX =
          container.scrollLeft + containerWidth - menuWidth - padding;
        const minX = container.scrollLeft + padding;
        const maxY =
          container.scrollTop + containerHeight - menuHeight - padding;
        const minY = container.scrollTop + padding;

        // 智能位置调整
        if (x > maxX) {
          // 菜单超出右边界，调整到鼠标左侧
          x = relativeX + container.scrollLeft - menuWidth - offset;
        }
        if (x < minX) {
          // 菜单超出左边界，贴近左边界
          x = minX;
        }
        if (y > maxY) {
          // 菜单超出下边界，调整到鼠标上方
          y = relativeY + container.scrollTop - menuHeight - offset;
        }
        if (y < minY) {
          // 菜单超出上边界，在鼠标下方留出更多空间
          y = relativeY + container.scrollTop + offset + 20;
        }

        // 最终边界保护
        x = Math.max(minX, Math.min(x, maxX));
        y = Math.max(minY, Math.min(y, maxY));
      }

      this.contextMenu = {
        visible: true,
        x: Math.round(x),
        y: Math.round(y),
        type: "task",
        task: task,
        dependency: null,
      };

      console.log("[调试] 右键菜单位置计算完成", {
        x: this.contextMenu.x,
        y: this.contextMenu.y,
        containerInfo: container ? "container found" : "no container",
      });

      // 阻止默认行为和事件传播，确保不会触发拖动
      event.preventDefault();
      event.stopPropagation();
    },

    // 显示依赖线右键菜单
    showDependencyContextMenu(line, event) {
      console.log("[调试] 显示依赖线右键菜单", line);

      // 计算菜单位置，考虑滚动偏移和视口边界
      const x = event.pageX;
      const y = event.pageY;

      // 调整菜单位置，确保不超出视口边界
      const menuWidth = 200; // 估计菜单宽度
      const menuHeight = 150; // 估计菜单高度
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // 如果菜单会超出右边界，向左偏移
      const adjustedX = x + menuWidth > viewportWidth ? x - menuWidth : x;
      // 如果菜单会超出下边界，向上偏移
      const adjustedY = y + menuHeight > viewportHeight ? y - menuHeight : y;

      this.contextMenu = {
        visible: true,
        x: adjustedX,
        y: adjustedY,
        type: "dependency",
        task: null,
        dependency: line,
      };

      // 阻止默认行为和事件传播，确保不会触发拖动
      event.preventDefault();
      event.stopPropagation();
    },

    // 隐藏右键菜单
    hideContextMenu(event) {
      // 如果点击的是菜单本身，不隐藏
      if (
        event &&
        event.target &&
        event.target.closest(".gantt-context-menu")
      ) {
        return;
      }
      this.contextMenu.visible = false;
    },

    // 从右键菜单编辑任务
    editTaskFromMenu() {
      console.log("[调试] 从右键菜单编辑任务", this.contextMenu.task);
      if (this.contextMenu.task) {
        // 确保调用正确的编辑函数
        this.$nextTick(() => {
          this.editTask(this.contextMenu.task);
        });
      }
      this.hideContextMenu();
    },

    // 从右键菜单删除任务
    deleteTaskFromMenu() {
      if (this.contextMenu.task) {
        this.deleteTaskDirectly(this.contextMenu.task);
      }
      this.hideContextMenu();
    },

    // 从右键菜单添加子任务
    addChildTaskFromMenu() {
      if (this.contextMenu.task) {
        this.$emit("add-child-task", this.contextMenu.task);
      }
      this.hideContextMenu();
    },

    // 从右键菜单添加同级任务
    addSiblingTaskFromMenu() {
      if (this.contextMenu.task) {
        this.$emit("add-sibling-task", this.contextMenu.task);
      }
      this.hideContextMenu();
    },

    // 从右键菜单编辑依赖线
    editDependencyFromMenu() {
      console.log("[调试] 从右键菜单编辑连线", this.contextMenu.dependency);
      if (this.contextMenu.dependency) {
        // 确保调用正确的编辑函数
        this.$nextTick(() => {
          this.openLinkEditModal(this.contextMenu.dependency);
          console.log("[调试] 编辑连线弹框状态:", this.linkEditModal.visible);
        });
      }
      this.hideContextMenu();
    },

    // 从右键菜单删除依赖线
    deleteDependencyFromMenu() {
      if (this.contextMenu.dependency) {
        this.removeDependency({
          from: this.contextMenu.dependency.from,
          to: this.contextMenu.dependency.to,
        });
      }
      this.hideContextMenu();
    },

    // 获取任务类型配置
    getTaskTypeConfig(type) {
      return getTaskTypeConfig(type);
    },

    /**
     * 获取依赖类型的描述
     * @param {string} type 依赖类型
     * @returns {string} 描述文本
     */
    getDependencyDescription(type) {
      const typeConfig = {
        FS: "A完成后B开始",
        SS: "A开始后B开始",
        FF: "A完成后B完成",
        SF: "A开始后B完成",
      };
      return typeConfig[type] || typeConfig["FS"];
    },

    /**
     * 获取lag效果描述
     * @param {string} type 依赖类型
     * @param {number} lag lag值（天数）
     * @returns {string} 效果描述
     */
    getLagEffectDescription(type, lag) {
      if (lag === 0) return "";

      const absLag = Math.abs(lag);
      const direction = lag > 0 ? "延迟" : "提前";

      const effectMap = {
        FS:
          lag > 0
            ? `B将在A完成${absLag}天后开始`
            : `B将在A完成前${absLag}天开始`,
        SS:
          lag > 0
            ? `B将在A开始${absLag}天后开始`
            : `B将在A开始前${absLag}天开始`,
        FF:
          lag > 0
            ? `B将在A完成${absLag}天后完成`
            : `B将在A完成前${absLag}天完成`,
        SF:
          lag > 0
            ? `B将在A开始${absLag}天后完成`
            : `B将在A开始前${absLag}天完成`,
      };

      return ` → ${effectMap[type] || ""}`;
    },

    /**
     * 生成连线标签文本（包含lag信息）
     * @param {object} dependency 依赖关系对象
     * @returns {string} 标签文本
     */
    generateConnectionLabel(dependency) {
      if (!dependency) return "";

      let label = "";

      // 添加依赖类型
      if (dependency.type && dependency.type !== "FS") {
        label += dependency.type;
      }

      // 添加lag信息
      if (dependency.lag && dependency.lag !== 0) {
        const lagText =
          dependency.lag > 0 ? `+${dependency.lag}d` : `${dependency.lag}d`;
        label += (label ? " " : "") + lagText;
      }

      // 添加自定义标签
      if (dependency.label) {
        label += (label ? " " : "") + dependency.label;
      }

      return label;
    },

    applyUpdates(updates) {
      updates.forEach((update) => {
        const task = this.tasks.find((t) => t.id === update.taskId);
        if (task) {
          task.startDate = update.newStart;
          task.endDate = update.newEnd;
          // 触发任务更新事件或其他必要的操作
          this.$emit("task-updated", task);
        }
      });
    },

    // 获取连接点位置 - 增强版
    getConnectionPoint(bar, dependencyType, role) {
      if (!bar) return 0;

      const left = bar.left || 0;
      const width = bar.width || 0;
      const taskHeight = 28;

      if (role === "from") {
        // 源任务的连接点 - 只允许从中间位置出发
        switch (dependencyType) {
          case "FS": // Finish-To-Start: 从右边中间
          case "FF": // Finish-To-Finish: 从右边中间
            return left + width;
          case "SS": // Start-To-Start: 从左边中间
          case "SF": // Start-To-Finish: 从左边中间
            return left;
          default:
            return left + width;
        }
      } else {
        // 目标任务的连接点 - 智能判断最优位置
        const isMilestone = bar.task.type === "milestone";
        const centerX = left + width / 2;
        const centerY = (bar.index || 0) * taskHeight + taskHeight / 2;

        // 对于里程碑任务的特殊处理
        if (isMilestone) {
          switch (dependencyType) {
            case "FS":
            case "SS":
              return left; // 左侧连接
            case "FF":
            case "SF":
              return left + width; // 右侧连接
            default:
              return left;
          }
        }

        // 普通任务的智能连接点选择
        switch (dependencyType) {
          case "FS": // Finish-To-Start: 到左边
          case "SS": // Start-To-Start: 到左边
            return left;
          case "FF": // Finish-To-Finish: 到右边
          case "SF": // Start-To-Finish: 到右边
            return left + width;
          default:
            return left;
        }
      }
    },

    // 获取箭头标记
    getArrowMarker(line) {
      if (line.selected) {
        return "url(#arrow-selected)";
      }
      if (this.isDependencyHighlighted(line)) {
        return "url(#arrow-highlight)";
      }
      return "url(#arrow-default)";
    },
  },
};
</script>
