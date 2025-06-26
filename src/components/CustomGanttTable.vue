<template>
  <div class="custom-gantt-table" style="height: 100%">
    <!-- 表格内容（移除表头，使用父组件的时间轴占位） -->
    <div
      class="table-body"
      ref="tableBody"
      @scroll="handleScroll"
      style="height: 100%"
    >
      <!-- 表头行 -->
      <div class="table-header-row" :class="{ 'no-fixed-columns': !fixedColumns }">

        <!-- 固定列布局 -->
        <template v-if="fixedColumns">
          <!-- 固定左侧列区域 -->
          <div class="fixed-left-columns">
            <!-- 复选框列 -->
            <div class="table-cell checkbox-cell header-cell fixed-cell">
              <el-checkbox
                :value="selectAllState === true"
                :indeterminate="selectAllState === 'indeterminate'"
                @change="handleSelectAll"
              />
            </div>

            <!-- 任务名称列 -->
            <div class="table-cell task-name-cell header-cell fixed-cell">
              <div class="header-content">
                <span class="header-text">{{ taskNameColumnLabel }}</span>
                <div class="header-actions">
                  <!-- 筛选按钮 - 使用复选框进行多选筛选 -->
                  <el-popover
                    placement="bottom"
                    trigger="click"
                    :width="250"
                    @show="onFilterShow('taskName')"
                  >
                    <div class="filter-popover">
                      <el-input
                        v-model="filterSearchText.taskName"
                        placeholder="Search tasks..."
                        size="mini"
                        clearable
                        @input="handleTaskNameFilter"
                        @clear="clearTaskNameFilter"
                        prefix-icon="el-icon-search"
                      />
                      <div v-if="taskNameOptions.length > 0" class="filter-options">
                        <div class="filter-option-header">Available Tasks:</div>
                        <el-checkbox-group v-model="selectedTaskNames" @change="handleTaskNameFilterChange">
                          <div v-for="option in filteredTaskNameOptions" :key="option.value" class="filter-option-item">
                            <el-checkbox :label="option.value" :disabled="false">
                              {{ option.label }}
                            </el-checkbox>
                          </div>
                        </el-checkbox-group>
                      </div>
                      <div class="filter-actions">
                        <el-button size="mini" @click="selectAllTaskNames">Select All</el-button>
                        <el-button size="mini" @click="clearAllTaskNames">Clear All</el-button>
                      </div>
                    </div>
                    <i
                      slot="reference"
                      class="filter-icon"
                      :class="{ 'active': activeFilters['taskName'] }"
                      title="Filter Tasks"
                    ></i>
                  </el-popover>
                  <i class="el-icon-sort sort-icon" title="Sortable"></i>
                </div>
              </div>
            </div>
          </div>

          <!-- 滚动区域列 -->
          <div class="scrollable-columns-header" ref="scrollableHeader">
            <div
              v-for="column in visibleColumns"
              :key="column.id"
              class="table-cell dynamic-cell header-cell scrollable-cell"
              :style="{
                width: (column.width || column.minWidth || 100) + 'px',
                minWidth: (column.width || column.minWidth || 100) + 'px',
                maxWidth: (column.width || column.minWidth || 100) + 'px',
                flex: column.width ? 'none' : (column.flex || 1)
              }"
              draggable="true"
              @dragstart="handleColumnDragStart(column, $event)"
              @dragover.prevent
              @drop="handleColumnDrop(column, $event)"
            >
              <div class="header-content">
                <span class="header-text">{{ column.label }}</span>
                <div class="header-actions">
                  <!-- 筛选按钮 -->
                  <el-dropdown
                    v-if="hasFilterOptions(column)"
                    trigger="click"
                    size="mini"
                    placement="bottom-end"
                    @command="(value) => handleFilter(column.id, value)"
                  >
                    <i
                      class="filter-icon"
                      :class="{ 'active': activeFilters[column.id] }"
                      title="Filter"
                    ></i>
                    <el-dropdown-menu slot="dropdown">
                      <el-dropdown-item command="">All</el-dropdown-item>
                      <el-dropdown-item
                        v-for="option in getFilterOptions(column)"
                        :key="option.value"
                        :command="option.value"
                      >
                        {{ option.label }}
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </el-dropdown>
                  <i class="el-icon-rank drag-handle" title="Drag to reorder"></i>
                </div>
              </div>

              <!-- 列宽调整手柄 -->
              <div
                v-if="allowColumnResize"
                class="column-resize-handle"
                @mousedown="startColumnResize(column, $event)"
                title="Drag to resize column"
              ></div>
            </div>
          </div>

          <!-- 固定右侧操作列 -->
          <div class="fixed-right-columns" v-if="showActionColumn">
            <div class="table-cell action-cell header-cell fixed-cell">
              <el-button
                size="mini"
                type="text"
                icon="el-icon-setting"
                @click="$emit('show-column-config')"
                title="Configure Columns"
                class="settings-btn"
              />
            </div>
          </div>
        </template>

        <!-- 非固定列布局（简化版） -->
        <template v-else>
          <div class="all-columns-header">
            <!-- 复选框列 -->
            <div class="table-cell checkbox-cell header-cell">
              <el-checkbox
                :value="selectAllState === true"
                :indeterminate="selectAllState === 'indeterminate'"
                @change="handleSelectAll"
              />
            </div>

            <!-- 任务名称列 -->
            <div class="table-cell task-name-cell header-cell">
              <div class="header-content">
                <span class="header-text">{{ taskNameColumnLabel }}</span>
                <div class="header-actions">
                  <!-- 筛选按钮 - 使用输入框进行搜索 -->
                  <el-popover
                    placement="bottom"
                    trigger="click"
                    :width="250"
                    @show="onFilterShow('taskName')"
                  >
                    <div class="filter-popover">
                      <el-input
                        v-model="filterSearchText.taskName"
                        placeholder="Search tasks..."
                        size="mini"
                        clearable
                        @input="handleTaskNameFilter"
                        @clear="clearTaskNameFilter"
                        prefix-icon="el-icon-search"
                      />
                      <div v-if="taskNameOptions.length > 0" class="filter-options">
                        <div class="filter-option-header">Available Tasks:</div>
                        <el-checkbox-group v-model="selectedTaskNames" @change="handleTaskNameFilterChange">
                          <div v-for="option in filteredTaskNameOptions" :key="option.value" class="filter-option-item">
                            <el-checkbox :label="option.value" :disabled="false">
                              {{ option.label }}
                            </el-checkbox>
                          </div>
                        </el-checkbox-group>
                      </div>
                      <div class="filter-actions">
                        <el-button size="mini" @click="selectAllTaskNames">Select All</el-button>
                        <el-button size="mini" @click="clearAllTaskNames">Clear All</el-button>
                      </div>
                    </div>
                    <i
                      slot="reference"
                      class="filter-icon"
                      :class="{ 'active': activeFilters['taskName'] }"
                      title="Filter Tasks"
                    ></i>
                  </el-popover>
                  <i class="el-icon-sort sort-icon" title="Sortable"></i>
                </div>
              </div>

              <!-- 列宽调整手柄 -->
              <div
                v-if="allowColumnResize"
                class="column-resize-handle"
                @mousedown="startTaskNameColumnResize($event)"
                title="Drag to resize column"
              ></div>
            </div>

            <!-- 动态列 -->
            <div
              v-for="column in visibleColumns"
              :key="column.id"
              class="table-cell dynamic-cell header-cell"
              :style="{
                width: (column.width || column.minWidth || 100) + 'px',
                minWidth: (column.width || column.minWidth || 100) + 'px',
                maxWidth: (column.width || column.minWidth || 100) + 'px',
                flex: column.width ? 'none' : (column.flex || 1)
              }"
              draggable="true"
              @dragstart="handleColumnDragStart(column, $event)"
              @dragover.prevent
              @drop="handleColumnDrop(column, $event)"
            >
              <div class="header-content">
                <span class="header-text">{{ column.label }}</span>
                <div class="header-actions">
                  <!-- 筛选按钮 -->
                  <el-dropdown
                    v-if="hasFilterOptions(column)"
                    trigger="click"
                    size="mini"
                    placement="bottom-end"
                    @command="(value) => handleFilter(column.id, value)"
                  >
                    <i
                      class="filter-icon"
                      :class="{ 'active': activeFilters[column.id] }"
                      title="Filter"
                    ></i>
                    <el-dropdown-menu slot="dropdown">
                      <el-dropdown-item command="">All</el-dropdown-item>
                      <el-dropdown-item
                        v-for="option in getFilterOptions(column)"
                        :key="option.value"
                        :command="option.value"
                      >
                        {{ option.label }}
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </el-dropdown>
                  <i class="el-icon-rank drag-handle" title="Drag to reorder"></i>
                </div>
              </div>

              <!-- 列宽调整手柄 -->
              <div
                v-if="allowColumnResize"
                class="column-resize-handle"
                @mousedown="startColumnResize(column, $event)"
                title="Drag to resize column"
              ></div>
            </div>

            <!-- 操作列 -->
            <div class="table-cell action-cell header-cell" v-if="showActionColumn">
              <el-button
                size="mini"
                type="text"
                icon="el-icon-setting"
                @click="$emit('show-column-config')"
                title="Configure Columns"
                class="settings-btn"
              />
            </div>
          </div>
        </template>
      </div>

      <div
        class="table-content"
        :style="{
          height: actualGanttHeight + 'px',
          minWidth: totalTableWidth + 'px'
        }"
      >
        <!-- 表格行 -->
        <div
          v-for="(task, index) in filteredTasks"
          :key="`task-${task.id}`"
          class="table-row data-row"
          :class="{
            highlighted: highlightedRowId === task.id,
            'parent-task': task.children && task.children.length > 0,
            'no-fixed-columns': !fixedColumns,
            'row-hover': hoveredTaskId === task.id
          }"
          :style="{
            position: 'absolute',
            top: index * 28 + 'px',
            left: '0px',
            right: '0px',
            height: '28px'
          }"
          @click="handleRowClick(task)"
          @mouseenter="hoveredTaskId = task.id"
          @mouseleave="hoveredTaskId = null"
        >
          <!-- 固定列布局 -->
          <template v-if="fixedColumns">
            <!-- 固定左侧列区域 -->
          <div class="fixed-left-columns">
            <!-- 复选框列 -->
            <div class="table-cell checkbox-cell fixed-cell">
              <el-checkbox
                :value="isTaskSelected(task.id)"
                @change="handleTaskSelect(task.id, $event)"
                @click.stop
              />
            </div>

            <!-- 任务名称列 -->
            <div class="table-cell task-name-cell fixed-cell">
              <div
                class="task-name-content"
                :style="{ paddingLeft: (task.level * 20 + 16) + 'px' }"
              >
                <!-- 折叠/展开按钮 -->
                <button
                  v-if="task.children && task.children.length > 0"
                  class="collapse-btn"
                  :class="{ 'collapsed': isTaskCollapsed(task.id) }"
                  @click.stop="handleToggleCollapse(task.id)"
                >
                  <span class="collapse-icon">
                    {{ isTaskCollapsed(task.id) ? '▶' : '▼' }}
                  </span>
                </button>

                <!-- 任务名称区域 -->
                <div class="task-text-area">
                  <!-- 任务类型图标 -->
                  <span
                    v-if="task.type"
                    class="task-type-icon"
                    :class="getTaskTypeConfig(task.type)?.iconClass"
                    :style="{
                      fontSize: getTaskTypeConfig(task.type)?.iconSize || '14px',
                      color: getTaskTypeConfig(task.type)?.iconColor || '#666'
                    }"
                    :title="getTaskTypeConfig(task.type)?.name"
                  >
                    <!-- 如果配置了iconClass，不显示emoji图标 -->
                    <template v-if="!getTaskTypeConfig(task.type)?.iconClass">
                      {{ getTaskTypeConfig(task.type)?.icon }}
                    </template>
                  </span>
                  <span class="task-name" :title="task.name">{{ task.name }}</span>

                  <!-- 子任务数量 -->
                  <span
                    v-if="task.children && task.children.length > 0"
                    class="children-count"
                  >
                    ({{ task.children.length }})
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- 滚动区域列 -->
          <div class="scrollable-columns" ref="scrollableContent">
            <!-- 动态列 -->
            <div
              v-for="column in visibleColumns"
              :key="column.id"
              class="table-cell dynamic-cell scrollable-cell"
              :style="{
                width: (column.width || column.minWidth || 100) + 'px',
                minWidth: (column.width || column.minWidth || 100) + 'px',
                maxWidth: (column.width || column.minWidth || 100) + 'px',
                flex: column.width ? 'none' : (column.flex || 1)
              }"
            >
              <!-- 可编辑的单元格内容 -->
              <div
                class="cell-content"
                :class="{ 'editable': allowCellEdit && isCellEditable(task, column.prop || column.id) }"
                @click="handleCellClick(task, column.prop || column.id, $event)"
              >
                <!-- 编辑模式 -->
                <template v-if="editingCell && editingCell.taskId === task.id && editingCell.field === (column.prop || column.id)">
                  <input
                    v-model="tempEditValue"
                    :data-edit-cell="`${task.id}-${column.prop || column.id}`"
                    class="cell-edit-input"
                    :type="column.id === 'progress' ? 'number' : (column.id.includes('Date') ? 'date' : 'text')"
                    :min="column.id === 'progress' ? 0 : undefined"
                    :max="column.id === 'progress' ? 100 : undefined"
                    @blur="finishCellEdit"
                    @keydown="handleCellKeydown"
                  />
                </template>

                <!-- 显示模式 -->
                <template v-else>
                  <!-- 进度列 -->
                  <div v-if="column.id === 'progress'" class="progress-content">
                    <!-- Milestone类型不显示进度 -->
                    <template v-if="task.type === 'milestone'">
                      <span class="milestone-indicator">Milestone</span>
                    </template>
                    <!-- 普通任务直接显示百分比，节省空间 -->
                    <template v-else>
                      <span class="progress-text">{{ task.progress || 0 }}%</span>
                    </template>
                  </div>

                  <!-- Duration列 -->
                  <span v-else-if="column.id === 'duration'" class="duration-text">
                    {{ calculateDuration(task) }}
                  </span>

                  <!-- 日期列 -->
                  <span
                    v-else-if="column.id === 'startDate' || column.id === 'endDate' || column.id === 'planStartDate' || column.id === 'planEndDate'"
                    class="date-text"
                    :class="{ 'plan-date': column.id.startsWith('plan') }"
                  >
                    {{ formatDate(task[column.prop]) }}
                  </span>

                  <!-- 状态列 -->
                  <span
                    v-else-if="column.id === 'status'"
                    class="status-badge"
                    :class="getStatusClass(task)"
                  >
                    {{ getTaskStatus(task) }}
                  </span>

                  <!-- 其他列 -->
                  <span v-else>{{ task[column.prop] || '-' }}</span>
                </template>
              </div>
            </div>
          </div>

          <!-- 固定右侧操作列 -->
          <div class="fixed-right-columns" v-if="showActionColumn">
            <div class="table-cell action-cell fixed-cell">
              <el-dropdown trigger="click" size="mini" :append-to-body="true">
                <el-button size="mini" type="text" icon="el-icon-more" />
                <el-dropdown-menu slot="dropdown">
                  <!-- 编辑任务 - 需要检查权限 -->
                  <el-dropdown-item
                    @click.native="$emit('edit-task', task)"
                    :disabled="!hasPermission(task, 'editable')"
                  >
                    <i class="el-icon-edit"></i> Edit Task
                    <span v-if="!hasPermission(task, 'editable')" class="permission-hint">(无权限)</span>
                  </el-dropdown-item>
                  <!-- 添加兄弟任务 - 需要检查权限 -->
                  <el-dropdown-item
                    @click.native="addSiblingTask(task)"
                    divided
                    :disabled="!hasPermission(task, 'editable')"
                  >
                    <i class="el-icon-plus"></i> Add Sibling Task
                    <span v-if="!hasPermission(task, 'editable')" class="permission-hint">(无权限)</span>
                  </el-dropdown-item>
                  <!-- 添加子任务 - 需要检查权限 -->
                  <el-dropdown-item
                    @click.native="addChildTask(task)"
                    :disabled="!hasPermission(task, 'editable')"
                  >
                    <i class="el-icon-circle-plus-outline"></i> Add Child Task
                    <span v-if="!hasPermission(task, 'editable')" class="permission-hint">(无权限)</span>
                  </el-dropdown-item>
                  <!-- 删除任务 - 需要检查删除权限 -->
                  <el-dropdown-item
                    @click.native="$emit('delete-task', task)"
                    divided
                    :disabled="!hasPermission(task, 'deletable')"
                  >
                    <i class="el-icon-delete"></i> Delete Task
                    <span v-if="!hasPermission(task, 'deletable')" class="permission-hint">(无权限)</span>
                  </el-dropdown-item>
                </el-dropdown-menu>
              </el-dropdown>
            </div>
          </div>

          <!-- 悬浮编辑按钮 -->
          <div
            v-if="hoveredTaskId === task.id && hasPermission(task, 'editable')"
            class="hover-edit-btn"
            @click.stop="$emit('edit-task', task)"
            title="Edit Task"
          >
            <i class="el-icon-edit"></i>
          </div>
          </template>

          <!-- 非固定列布局（简化版） -->
          <template v-else>
            <div class="all-columns-content">
              <!-- 复选框列 -->
              <div class="table-cell checkbox-cell">
                <el-checkbox
                  :value="isTaskSelected(task.id)"
                  @change="handleTaskSelect(task.id, $event)"
                  @click.stop
                />
              </div>

              <!-- 任务名称列 -->
              <div class="table-cell task-name-cell">
                <div
                  class="task-name-content"
                  :style="{ paddingLeft: (task.level * 20 + 16) + 'px' }"
                >
                  <!-- 折叠/展开按钮 -->
                  <button
                    v-if="task.children && task.children.length > 0"
                    class="collapse-btn"
                    :class="{ 'collapsed': isTaskCollapsed(task.id) }"
                    @click.stop="handleToggleCollapse(task.id)"
                  >
                    <span class="collapse-icon">
                      {{ isTaskCollapsed(task.id) ? '▶' : '▼' }}
                    </span>
                  </button>

                  <!-- 任务名称区域 -->
                  <div class="task-text-area">
                                      <!-- 任务类型图标 -->
                  <span
                    v-if="task.type"
                    class="task-type-icon"
                    :class="getTaskTypeConfig(task.type)?.iconClass"
                    :style="{
                      fontSize: getTaskTypeConfig(task.type)?.iconSize || '14px',
                      color: getTaskTypeConfig(task.type)?.iconColor || '#666'
                    }"
                    :title="getTaskTypeConfig(task.type)?.name"
                  >
                    <!-- 如果配置了iconClass，不显示emoji图标 -->
                    <template v-if="!getTaskTypeConfig(task.type)?.iconClass">
                      {{ getTaskTypeConfig(task.type)?.icon }}
                    </template>
                  </span>

                    <!-- 可编辑的任务名称 -->
                    <div
                      class="cell-content task-name-cell-content"
                      :class="{ 'editable': allowCellEdit && isCellEditable(task, 'name') }"
                      @click="handleCellClick(task, 'name', $event)"
                    >
                      <!-- 编辑模式 -->
                      <template v-if="editingCell && editingCell.taskId === task.id && editingCell.field === 'name'">
                        <input
                          v-model="tempEditValue"
                          :data-edit-cell="`${task.id}-name`"
                          class="cell-edit-input task-name-input"
                          type="text"
                          @blur="finishCellEdit"
                          @keydown="handleCellKeydown"
                        />
                      </template>

                      <!-- 显示模式 -->
                      <span v-else class="task-name" :title="task.name">{{ task.name }}</span>
                    </div>

                    <!-- 子任务数量 -->
                    <span
                      v-if="task.children && task.children.length > 0"
                      class="children-count"
                    >
                      ({{ task.children.length }})
                    </span>
                  </div>
                </div>
              </div>

              <!-- 动态列 -->
              <div
                v-for="column in visibleColumns"
                :key="column.id"
                class="table-cell dynamic-cell"
                :style="{
                  width: (column.width || column.minWidth || 100) + 'px',
                  minWidth: (column.width || column.minWidth || 100) + 'px',
                  maxWidth: (column.width || column.minWidth || 100) + 'px',
                  flex: column.width ? 'none' : (column.flex || 1)
                }"
              >
                <!-- 可编辑的单元格内容 -->
                <div
                  class="cell-content"
                  :class="{ 'editable': allowCellEdit && isCellEditable(task, column.prop || column.id) }"
                  @click="handleCellClick(task, column.prop || column.id, $event)"
                >
                  <!-- 编辑模式 -->
                  <template v-if="editingCell && editingCell.taskId === task.id && editingCell.field === (column.prop || column.id)">
                    <input
                      v-model="tempEditValue"
                      :data-edit-cell="`${task.id}-${column.prop || column.id}`"
                      class="cell-edit-input"
                      :type="column.id === 'progress' ? 'number' : (column.id.includes('Date') ? 'date' : 'text')"
                      :min="column.id === 'progress' ? 0 : undefined"
                      :max="column.id === 'progress' ? 100 : undefined"
                      @blur="finishCellEdit"
                      @keydown="handleCellKeydown"
                    />
                  </template>

                  <!-- 显示模式 -->
                  <template v-else>
                    <!-- 进度列 -->
                    <div v-if="column.id === 'progress'" class="progress-content">
                      <!-- Milestone类型不显示进度 -->
                      <template v-if="task.type === 'milestone'">
                        <span class="milestone-indicator">Milestone</span>
                      </template>
                      <!-- 普通任务直接显示百分比，节省空间 -->
                      <template v-else>
                        <span class="progress-text">{{ task.progress || 0 }}%</span>
                      </template>
                    </div>

                    <!-- Duration列 -->
                    <span v-else-if="column.id === 'duration'" class="duration-text">
                      {{ calculateDuration(task) }}
                    </span>

                    <!-- 日期列 -->
                    <span
                      v-else-if="column.id === 'startDate' || column.id === 'endDate' || column.id === 'planStartDate' || column.id === 'planEndDate'"
                      class="date-text"
                      :class="{ 'plan-date': column.id.startsWith('plan') }"
                    >
                      {{ formatDate(task[column.prop]) }}
                    </span>

                    <!-- 状态列 -->
                    <template v-else-if="column.id === 'status'">
                      <!-- 编辑模式 - 下拉选择 -->
                      <select
                        v-if="editingCell && editingCell.taskId === task.id && editingCell.field === 'status'"
                        v-model="tempEditValue"
                        class="cell-edit-input status-select"
                        @blur="finishCellEdit"
                        @keydown="handleCellKeydown"
                      >
                        <option value="Not Started">Not Started</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                        <option value="On Hold">On Hold</option>
                      </select>
                      <!-- 显示模式 -->
                      <span
                        v-else
                        class="status-badge"
                        :class="getStatusClass(task)"
                      >
                        {{ getTaskStatus(task) }}
                      </span>
                    </template>

                    <!-- 其他列 -->
                    <span v-else>{{ task[column.prop] || '-' }}</span>
                  </template>
                </div>
              </div>

              <!-- 操作列 -->
              <div class="table-cell action-cell" v-if="showActionColumn">
                <el-dropdown trigger="click" size="mini" :append-to-body="true">
                  <el-button size="mini" type="text" icon="el-icon-more" />
                  <el-dropdown-menu slot="dropdown">
                    <!-- 编辑任务 -->
                    <el-dropdown-item @click.native="$emit('edit-task', task)">
                      <i class="el-icon-edit"></i> Edit Task
                    </el-dropdown-item>
                    <!-- 添加兄弟任务 -->
                    <el-dropdown-item @click.native="addSiblingTask(task)" divided>
                      <i class="el-icon-plus"></i> Add Sibling Task
                    </el-dropdown-item>
                    <!-- 添加子任务 -->
                    <el-dropdown-item @click.native="addChildTask(task)">
                      <i class="el-icon-circle-plus-outline"></i> Add Child Task
                    </el-dropdown-item>
                    <!-- 删除任务 -->
                    <el-dropdown-item @click.native="$emit('delete-task', task)" divided>
                      <i class="el-icon-delete"></i> Delete Task
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </el-dropdown>
              </div>
            </div>
          </template>

          <!-- 悬浮编辑按钮 -->
          <div
            v-if="hoveredTaskId === task.id && hasPermission(task, 'editable')"
            class="hover-edit-btn"
            @click.stop="$emit('edit-task', task)"
            title="Edit Task"
          >
            <i class="el-icon-edit"></i>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapState, mapGetters, mapActions } from 'vuex'
import moment from 'moment'
import Sortable from 'sortablejs'
import { getTaskTypeConfig } from '@/config/features'

export default {
  name: 'CustomGanttTable',
  props: {
    tasks: {
      type: Array,
      default: () => []
    },
    highlightedRowId: {
      type: [String, Number],
      default: null
    },
    tableHeight: {
      type: Number,
      default: 400
    },
    // 表格宽度配置
    tableWidth: {
      type: Number,
      default: 400
    },
    // 是否固定第一列和最后一列
    fixedColumns: {
      type: Boolean,
      default: false
    },
    // 是否允许列宽拖拽调整
    allowColumnResize: {
      type: Boolean,
      default: true
    },
    // 是否允许单元格内联编辑
    allowCellEdit: {
      type: Boolean,
      default: true
    },
    // 是否显示操作列
    showActionColumn: {
      type: Boolean,
      default: false
    },
    actualGanttHeight: {
      type: Number,
      required: true
    }
  },
  data() {
    return {
      // 拖拽状态
      isDraggingColumn: false,
      draggedColumn: null,
      dragOverColumn: null,

      // 列宽调整相关状态
      isResizingColumn: false,
      resizingColumn: null,
      resizeStartX: 0,
      resizeStartWidth: 0,

      // 任务名称列宽度配置
      taskNameColumnWidth: 200, // 任务名称列的默认宽度

      // 单元格编辑相关状态
      editingCell: null, // 当前编辑的单元格 {taskId, field, value}
      tempEditValue: '', // 临时编辑值

      // 选中状态管理
      selectedTasks: new Set(),

      // 表格滚动状态
      scrollLeft: 0,

      // 筛选状态
      activeFilters: {},
      // 任务名称筛选相关
      filterSearchText: {
        taskName: ''
      },
      selectedTaskNames: [],
      taskNameOptions: [],
      filterOptions: {
        status: [
          { label: 'Not Started', value: 'not-started' },
          { label: 'In Progress', value: 'in-progress' },
          { label: 'Completed', value: 'completed' },
          { label: 'On Hold', value: 'on-hold' }
        ],
        progress: [
          { label: '0%', value: '0' },
          { label: '1-25%', value: '1-25' },
          { label: '26-50%', value: '26-50' },
          { label: '51-75%', value: '51-75' },
          { label: '76-99%', value: '76-99' },
          { label: '100%', value: '100' }
        ]
      },
      sortableInstance: null,
      resizeObserver: null,
      hoveredTaskId: null,
      collapsedTasks: new Set(),
    }
  },
  computed: {
    ...mapState(['selectAllState']),
    ...mapGetters(['isTaskSelected', 'isTaskCollapsed']),

    // 过滤动态列，排除checkbox和taskName
    visibleColumns() {
      return this.$store.getters.visibleColumns.filter(col =>
        col.id !== 'checkbox' && col.id !== 'taskName'
      )
    },

    // 获取任务名称列的标签
    taskNameColumnLabel() {
      const taskNameColumn = this.$store.getters.getColumnConfig.find(col => col.id === 'taskName')
      return taskNameColumn ? taskNameColumn.label : 'Task Name'
    },

    // 计算表格总宽度 - 基于最小宽度
    totalTableWidth() {
      let width = 50 + 150 // checkbox(50) + taskName(150)
      if (this.showActionColumn) {
        width += 60 // action(60)
      }
      this.visibleColumns.forEach(col => {
        width += col.minWidth || col.width || 100
      })
      return width
    },

    // 计算滚动区域宽度 - 自适应
    scrollableColumnsWidth() {
      // 使用100%宽度，让flex布局自动分配
      return '100%'
    },

    // 计算表格内容高度
    contentHeight() {
      // 表格内容高度应该根据任务数量动态计算
      // 每行40px高度 + 额外的缓冲空间
      return Math.max(this.tasks.length * 40, 200)
    },

    // 计算实际表格高度 - 直接使用父组件传入的高度
    actualTableHeight() {
      // 父组件已经计算好可用高度，直接使用即可
      // 表头使用sticky定位，不占用内容滚动空间
      return Math.max(this.tableHeight, 200)
    },

    // 计算内容容器的最大高度
    maxContentHeight() {
      // 内容区域的最大高度应该精确匹配任务数量
      // 不添加额外的缓冲空间，确保与甘特图右侧一致
      return Math.max(this.filteredTasks.length * 40, 200)
    },

    // 过滤后的任务数据
    filteredTasks() {
      let tasks = this.tasks

      // 统一通过 activeFilters 处理所有筛选条件，避免双重筛选
      if (Object.keys(this.activeFilters).length > 0) {
        tasks = tasks.filter(task => {
          return Object.keys(this.activeFilters).every(columnId => {
            const filterValue = this.activeFilters[columnId]
            const taskValue = this.getTaskValueForFilter(task, columnId)
            return this.matchesFilter(columnId, taskValue, filterValue)
          })
        })
      }

      return tasks
    },

    // 过滤后的任务名称选项
    filteredTaskNameOptions() {
      if (!this.filterSearchText.taskName) {
        return this.taskNameOptions
      }
      const searchText = this.filterSearchText.taskName.toLowerCase()
      return this.taskNameOptions.filter(option =>
        option.label.toLowerCase().includes(searchText)
      )
    }
  },
  watch: {
    // 监听tasks变化，自动更新
    tasks: {
      handler(newTasks) {
        // 当任务数据变化时，更新任务名称选项
        this.updateTaskNameOptions()
        this.$forceUpdate()
      },
      deep: true,
      immediate: true
    },
    // 监听tableHeight变化，重新计算表格高度
    tableHeight: {
      handler(newHeight, oldHeight) {
        if (newHeight !== oldHeight) {
          this.$nextTick(() => {
            this.updateTableHeight()
          })
        }
      },
      immediate: true
    },

    // 监听可见列变化，重新初始化表格布局
    visibleColumns: {
      handler() {
        if (this.fixedColumns) {
          this.$nextTick(() => {
            this.initTableLayout()
          })
        }
        // 强制重新渲染以获取更新的列配置
        this.$forceUpdate()
      },
      deep: true
    },

    // 监听列配置变化，确保标签更新
    '$store.getters.getColumnConfig': {
      handler() {
        // 当列配置变化时，强制重新渲染以获取最新的列标签
        this.$forceUpdate()
      },
      deep: true
    }
  },
  methods: {
    ...mapActions(['toggleTaskSelection', 'toggleSelectAll', 'updateColumnOrder']),

    // 格式化日期
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

    // 处理行点击
    handleRowClick(task) {
      this.$emit('row-click', task)
    },

    // 处理任务选择 - 新增方法支持非固定列模式
    handleTaskSelect(taskId, checked) {
      this.$store.dispatch('setTaskSelection', { taskId, selected: checked })
    },

    // 处理全选 - 新增方法支持非固定列模式
    handleSelectAll(checked) {
      this.$store.dispatch('toggleSelectAll')
    },

    // 处理折叠展开
    handleToggleCollapse(taskId) {
      // 只传播事件给父组件，不要在这里调用store action
      // 父组件会处理store action
      this.$emit('toggle-collapse', taskId)

      // 延迟强制更新，确保store变化后重新渲染
      this.$nextTick(() => {
        this.$forceUpdate()
      })
    },

    // 处理滚动
    handleScroll(event) {
      const { scrollLeft, scrollTop } = event.target

      // 根据是否固定列来处理滚动同步
      if (this.fixedColumns) {
        // 固定列模式：使用统一的滚动同步方法
        this.syncScrollPosition(scrollLeft)
      }
      // 非固定列模式：不需要滚动同步，整个表格一起滚动

      // 缓存滚动位置
      this.scrollLeft = scrollLeft

      // 向父组件传递滚动事件
      this.$emit('scroll', event)
    },

    // 处理列拖拽开始
    handleColumnDragStart(column, event) {
      this.draggedColumn = column
      event.dataTransfer.setData('text/plain', column.id)
    },

    // 处理列拖拽放置
    handleColumnDrop(targetColumn, event) {
      event.preventDefault()
      if (!this.draggedColumn || this.draggedColumn.id === targetColumn.id) {
        return
      }

      const draggedIndex = this.visibleColumns.findIndex(col => col.id === this.draggedColumn.id)
      const targetIndex = this.visibleColumns.findIndex(col => col.id === targetColumn.id)

      if (draggedIndex !== -1 && targetIndex !== -1) {
        // 调整索引，加上固定列的偏移
        const actualDraggedIndex = draggedIndex + 2 // +2 因为前面有checkbox和taskName列
        const actualTargetIndex = targetIndex + 2

        this.updateColumnOrder({
          oldIndex: actualDraggedIndex,
          newIndex: actualTargetIndex
        })

        this.$emit('column-reorder')
      }

      this.draggedColumn = null
    },

    // 滚动到指定位置
    scrollTo(top) {
      if (this.$refs.tableBody) {
        this.$refs.tableBody.scrollTop = top
      }
    },

    // 滚动到指定行
    scrollToRow(rowIndex) {
      if (this.$refs.tableBody && rowIndex >= 0 && rowIndex < this.tasks.length) {
        const rowTop = rowIndex * 28 // 每行28px高度，修复滚动位置计算
        const containerHeight = this.$refs.tableBody.clientHeight
        const targetScrollTop = Math.max(0, rowTop - containerHeight / 2 + 20) // 居中显示，稍微偏上一点

        this.$refs.tableBody.scrollTo({
          top: targetScrollTop,
          behavior: 'smooth'
        })
      }
    },

    // 获取当前滚动位置
    getScrollTop() {
      return this.$refs.tableBody ? this.$refs.tableBody.scrollTop : 0
    },

    // 更新表格高度
    updateTableHeight() {
      this.$nextTick(() => {
        this.$forceUpdate()
      })
    },

    // 检查列是否有筛选选项
    hasFilterOptions(column) {
      if (!column.filterable) return false

      // 根据列类型判断是否支持筛选
      // 注意：taskName 已改为使用复选框模式，不再支持下拉筛选
      const filterableColumns = ['progress', 'status', 'startDate', 'endDate', 'planStartDate', 'planEndDate']
      return filterableColumns.includes(column.id)
    },

    // 获取列的筛选选项
    getFilterOptions(column) {
      if (!this.hasFilterOptions(column)) return []

      switch (column.id) {
        case 'status':
          return this.filterOptions.status
        case 'progress':
          return this.filterOptions.progress
        case 'taskName':
          // 任务名称筛选已改为使用复选框模式，不再使用下拉选项
          console.warn('任务名称筛选不应使用 getFilterOptions 方法')
          return []
        case 'startDate':
        case 'endDate':
        case 'planStartDate':
        case 'planEndDate':
          // 日期类型筛选：按月份分组
          const dates = this.tasks
            .map(task => task[column.prop])
            .filter(date => date)
            .map(date => moment(date).format('YYYY-MM'))
          const uniqueMonths = [...new Set(dates)].sort()
          return uniqueMonths.map(month => ({
            label: moment(month).format('MMM YYYY'),
            value: month
          }))
        default:
          return []
      }
    },

         // 处理筛选
     handleFilter(columnId, value) {
       // 特殊处理任务名称筛选，避免覆盖复选框多选逻辑
       if (columnId === 'taskName') {
         console.error('[表格筛选错误] 任务名称筛选应使用复选框模式，不应调用 handleFilter 方法。请检查模板中是否还有遗留的下拉筛选代码。')
         // 直接返回，避免处理错误的筛选类型
         return
       }

       if (!value || value === '') {
         // 清除筛选
         this.$delete(this.activeFilters, columnId)
       } else {
         // 设置筛选值
         this.$set(this.activeFilters, columnId, value)
       }

       // 触发筛选事件，将筛选条件传递给父组件
       this.$emit('filter-change', {
         column: columnId,
         value: value,
         activeFilters: { ...this.activeFilters }
       })
     },

     // 获取任务字段值用于筛选
     getTaskValueForFilter(task, columnId) {
       switch (columnId) {
         case 'taskName':
           return task.name
         case 'status':
           return this.getTaskStatus(task).toLowerCase().replace(' ', '-')
         case 'progress':
           return task.progress || 0
         case 'startDate':
         case 'endDate':
         case 'planStartDate':
         case 'planEndDate':
           return task[columnId] ? moment(task[columnId]).format('YYYY-MM') : null
         default:
           return task[columnId]
       }
     },

     // 判断值是否匹配筛选条件
     matchesFilter(columnId, taskValue, filterValue) {
       // 防止 undefined/null 导致的错误
       if (filterValue === undefined || filterValue === null) {
         return true
       }

       switch (columnId) {
         case 'taskName':
           // 统一处理任务名称筛选，支持数组和字符串两种格式
           if (Array.isArray(filterValue)) {
             // 多选模式：检查任务名称是否在选中列表中
             return filterValue.length === 0 || filterValue.includes(taskValue)
           } else if (typeof filterValue === 'string' && filterValue.trim() !== '') {
             // 搜索模式：模糊匹配任务名称

             return taskValue && typeof taskValue === 'string' &&
                    taskValue.toLowerCase().includes(filterValue.toLowerCase())
           }
           return true
         case 'status':
           return taskValue === filterValue
         case 'progress':
           const progress = parseInt(taskValue) || 0
           switch (filterValue) {
             case '0': return progress === 0
             case '1-25': return progress >= 1 && progress <= 25
             case '26-50': return progress >= 26 && progress <= 50
             case '51-75': return progress >= 51 && progress <= 75
             case '76-99': return progress >= 76 && progress <= 99
             case '100': return progress === 100
             default: return true
           }
         case 'startDate':
         case 'endDate':
         case 'planStartDate':
         case 'planEndDate':
           return taskValue === filterValue
         default:
           return true
       }
     },

     // 任务名称筛选相关方法
     onFilterShow(columnId) {
       if (columnId === 'taskName') {
         this.updateTaskNameOptions()
       }
     },

     updateTaskNameOptions() {
       const uniqueNames = [...new Set(this.tasks.map(task => task.name).filter(Boolean))]
       this.taskNameOptions = uniqueNames.map(name => ({
         label: name,
         value: name
       }))
     },

     handleTaskNameFilter() {
       // 实时搜索，无需额外处理
     },

     clearTaskNameFilter() {
       this.filterSearchText.taskName = ''
       this.selectedTaskNames = []
       this.updateTaskNameFilter()
     },

     handleTaskNameFilterChange() {
       this.updateTaskNameFilter()
     },

     updateTaskNameFilter() {
       // 更新活跃筛选状态 - 确保数组类型的一致性
       if (this.selectedTaskNames.length > 0) {
         // 确保传入的是数组的副本，避免引用问题
         this.$set(this.activeFilters, 'taskName', [...this.selectedTaskNames])
       } else {
         this.$delete(this.activeFilters, 'taskName')
       }

       // 触发筛选变化事件
       this.$emit('filter-change', {
         column: 'taskName',
         value: this.selectedTaskNames.length > 0 ? [...this.selectedTaskNames] : null,
         activeFilters: { ...this.activeFilters }
       })
     },

     selectAllTaskNames() {
       this.selectedTaskNames = this.filteredTaskNameOptions.map(option => option.value)
       this.updateTaskNameFilter()
     },

     clearAllTaskNames() {
       this.selectedTaskNames = []
       this.updateTaskNameFilter()
     },

    // 添加同级任务
    addSiblingTask(task) {
      // 发送添加同级任务的事件
      this.$emit('add-sibling-task', task)

      // 显示成功提示
      this.$message({
        message: `正在添加"${task.name}"的同级任务...`,
        type: 'info',
        duration: 1500
      })
    },

    // 添加子任务
    addChildTask(task) {
      // 发送添加子任务的事件
      this.$emit('add-child-task', task)

      // 显示成功提示
      this.$message({
        message: `正在添加"${task.name}"的子任务...`,
        type: 'info',
        duration: 1500
      })
    },

    // 检查任务权限 - 左侧表格和右侧节点每一行都需要有编辑权限控制
    hasPermission(task, permission) {
      // 防止 undefined 错误：安全检查任务对象
      if (!task || typeof task !== 'object') {
        console.warn('hasPermission: 任务对象无效', task)
        return true // 默认允许操作（向后兼容）
      }

      // 如果任务没有权限配置，默认允许所有操作（向后兼容）
      if (!task.permissions || typeof task.permissions !== 'object') {
        return true
      }

      // 特殊处理：父节点的编辑权限
      // 父节点应该可以编辑，除非明确设置为false
      if (permission === 'editable' && task.children && task.children.length > 0) {
        // 父节点默认可编辑，除非权限明确设置为false
        return task.permissions[permission] !== false
      }

      // 检查具体权限
      return task.permissions[permission] === true
    },

    // 获取任务类型配置 - 新增方法支持任务类型图标显示
    getTaskTypeConfig(type) {
      return getTaskTypeConfig(type)
    },

    // 同步滚动位置的通用方法 - 重新设计确保完美对齐
    syncScrollPosition(scrollLeft) {
      if (!this.fixedColumns) return

      // 同步表头滚动
      const scrollableHeader = this.$refs.scrollableHeader
      if (scrollableHeader) {
        scrollableHeader.style.transform = `translateX(-${scrollLeft}px)`
      }

      // 同步所有数据行的滚动
      const scrollableContents = this.$refs.tableBody?.querySelectorAll('.scrollable-columns')
      if (scrollableContents) {
        scrollableContents.forEach(element => {
          element.style.transform = `translateX(-${scrollLeft}px)`
        })
      }
    },

    // 清理筛选数据，确保数据类型正确
    cleanupFilters() {
      // 检查任务名称筛选是否存在且类型不正确
      if (this.activeFilters.taskName !== undefined) {
        const taskNameFilter = this.activeFilters.taskName

        // 如果是字符串类型，说明是旧的筛选数据，需要清理
        if (typeof taskNameFilter === 'string') {
          console.warn('[筛选数据清理] 发现旧的任务名称筛选数据，正在清理...')
          this.$delete(this.activeFilters, 'taskName')
          this.selectedTaskNames = []
        }
        // 如果是数组但与当前选中状态不一致，同步数据
        else if (Array.isArray(taskNameFilter)) {
          if (JSON.stringify(taskNameFilter.sort()) !== JSON.stringify(this.selectedTaskNames.sort())) {
            console.log('[筛选数据同步] 同步任务名称筛选状态')
            this.selectedTaskNames = [...taskNameFilter]
          }
        }
      }
    },

    // 初始化表格布局 - 完全重写确保表头数据行完美对齐
    initTableLayout() {
      if (!this.fixedColumns) return

      this.$nextTick(() => {
        // 计算所有可见列的总宽度
        let totalScrollableWidth = 0
        this.visibleColumns.forEach(column => {
          totalScrollableWidth += column.width || column.minWidth || 100
        })

        // 设置表头滚动区域宽度
        const scrollableHeader = this.$refs.scrollableHeader
        if (scrollableHeader) {
          scrollableHeader.style.width = `${totalScrollableWidth}px`
          scrollableHeader.style.minWidth = `${totalScrollableWidth}px`
          scrollableHeader.style.maxWidth = `${totalScrollableWidth}px`
        }

        // 设置所有数据行的滚动区域宽度 - 确保与表头完全一致
        const allScrollableColumns = this.$refs.tableBody?.querySelectorAll('.scrollable-columns')
        if (allScrollableColumns) {
          allScrollableColumns.forEach(element => {
            element.style.width = `${totalScrollableWidth}px`
            element.style.minWidth = `${totalScrollableWidth}px`
            element.style.maxWidth = `${totalScrollableWidth}px`
          })
        }

        console.log(`[表格布局] 滚动区域宽度: ${totalScrollableWidth}px，总列数: ${this.visibleColumns.length}`)

        // 重置滚动位置，确保初始状态正确
        if (this.$refs.tableBody) {
          const currentScrollLeft = this.$refs.tableBody.scrollLeft || 0
          this.syncScrollPosition(currentScrollLeft)
        }
      })
    },

    // ===== 列宽拖拽调整功能 =====
    // 开始列宽调整
    startColumnResize(column, event) {
      if (!this.allowColumnResize || !column) return

      event.preventDefault()
      event.stopPropagation()

      this.isResizingColumn = true
      this.resizingColumn = column
      this.resizeStartX = event.clientX
      this.resizeStartWidth = column.width || column.minWidth || 100

      // 添加全局鼠标事件监听
      document.addEventListener('mousemove', this.doColumnResize)
      document.addEventListener('mouseup', this.stopColumnResize)

      // 防止文本选择
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'col-resize'
    },

    // 执行列宽调整
    doColumnResize(event) {
      if (!this.isResizingColumn || !this.resizingColumn) return

      const deltaX = event.clientX - this.resizeStartX
      const newWidth = Math.max(this.resizeStartWidth + deltaX, 50) // 最小宽度50px

      // 实时更新列宽
      this.resizingColumn.width = newWidth

      // 实时更新表格布局
      this.initTableLayout()
    },

    // 结束列宽调整
    stopColumnResize() {
      if (!this.isResizingColumn) return

      // 清理状态
      this.isResizingColumn = false
      const column = this.resizingColumn
      this.resizingColumn = null

      // 移除事件监听
      document.removeEventListener('mousemove', this.doColumnResize)
      document.removeEventListener('mouseup', this.stopColumnResize)

      // 恢复样式
      document.body.style.userSelect = ''
      document.body.style.cursor = ''

      // 发射列宽变化事件
      if (column) {
        this.$emit('column-resize', {
          columnId: column.id,
          newWidth: column.width || column.minWidth || 100
        })
      }
    },

    // ===== 任务名称列宽度调整功能 =====
    // 开始任务名称列宽调整
    startTaskNameColumnResize(event) {
      if (!this.allowColumnResize) return

      event.preventDefault()
      event.stopPropagation()

      this.isResizingColumn = true
      this.resizingColumn = { id: 'taskName', width: this.taskNameColumnWidth }
      this.resizeStartX = event.clientX
      this.resizeStartWidth = this.taskNameColumnWidth

      // 添加全局鼠标事件监听
      document.addEventListener('mousemove', this.doTaskNameColumnResize)
      document.addEventListener('mouseup', this.stopTaskNameColumnResize)

      // 防止文本选择
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'col-resize'
    },

    // 执行任务名称列宽调整
    doTaskNameColumnResize(event) {
      if (!this.isResizingColumn) return

      const deltaX = event.clientX - this.resizeStartX
      const newWidth = Math.max(this.resizeStartWidth + deltaX, 100) // 最小宽度100px

      // 实时更新任务名称列宽
      this.taskNameColumnWidth = newWidth

      // 实时更新表格布局
      this.updateTaskNameColumnWidth()
    },

    // 结束任务名称列宽调整
    stopTaskNameColumnResize() {
      if (!this.isResizingColumn) return

      // 清理状态
      this.isResizingColumn = false
      this.resizingColumn = null

      // 移除事件监听
      document.removeEventListener('mousemove', this.doTaskNameColumnResize)
      document.removeEventListener('mouseup', this.stopTaskNameColumnResize)

      // 恢复样式
      document.body.style.userSelect = ''
      document.body.style.cursor = ''

      // 发射列宽变化事件
      this.$emit('column-resize', {
        columnId: 'taskName',
        newWidth: this.taskNameColumnWidth
      })
    },

    // 更新任务名称列宽度
    updateTaskNameColumnWidth() {
      // 安全检查：确保组件已挂载且$el是有效的DOM元素
      if (!this.$el || typeof this.$el.querySelectorAll !== 'function') {
        console.warn('updateTaskNameColumnWidth: 组件未正确挂载或$el无效')
        return
      }

      const taskNameCells = this.$el.querySelectorAll('.task-name-cell')
      taskNameCells.forEach(cell => {
        cell.style.width = this.taskNameColumnWidth + 'px'
        cell.style.minWidth = this.taskNameColumnWidth + 'px'
        cell.style.maxWidth = this.taskNameColumnWidth + 'px'
      })
    },

    // ===== 单元格内联编辑功能 =====
    // 开始编辑单元格
    startCellEdit(task, field, currentValue) {
      if (!this.allowCellEdit || !task || !field) return

      // 检查字段是否允许编辑
      if (!this.isCellEditable(task, field)) return

      this.editingCell = {
        taskId: task.id,
        field: field,
        originalValue: currentValue
      }
      this.tempEditValue = currentValue || ''

      // 延迟聚焦到输入框或选择器
      this.$nextTick(() => {
        // 安全检查：确保组件已挂载且$el是有效的DOM元素
        if (!this.$el || typeof this.$el.querySelector !== 'function') {
          console.warn('startCellEdit: 组件未正确挂载或$el无效')
          return
        }

        const input = this.$el.querySelector(`input[data-edit-cell="${task.id}-${field}"]`)
        const select = this.$el.querySelector(`select.status-select`)

        if (input) {
          input.focus()
          input.select()
        } else if (select && field === 'status') {
          select.focus()
        }
      })
    },

    // 完成单元格编辑
    finishCellEdit() {
      if (!this.editingCell) return

      const { taskId, field } = this.editingCell
      const newValue = this.validateCellValue(field, this.tempEditValue)

      // 如果验证失败，取消编辑
      if (newValue === null && this.tempEditValue !== '') {
        this.$message.warning('输入值格式无效')
        this.cancelCellEdit()
        return
      }

      // 查找任务进行日期验证
      const task = this.tasks.find(t => t.id === taskId)
      if (!task) {
        this.cancelCellEdit()
        return
      }

      // 日期字段特殊验证：确保开始时间不能大于结束时间
      if (field === 'startDate' || field === 'endDate') {
        const currentStartDate = field === 'startDate' ? newValue : task.startDate
        const currentEndDate = field === 'endDate' ? newValue : task.endDate

        if (currentStartDate && currentEndDate) {
          const startMoment = moment(currentStartDate)
          const endMoment = moment(currentEndDate)

          if (startMoment.isValid() && endMoment.isValid() && startMoment.isAfter(endMoment)) {
            this.$message.error('开始日期不能晚于结束日期!')
            this.cancelCellEdit()
            return
          }
        }
      }

      // 计划日期字段验证
      if (field === 'planStartDate' || field === 'planEndDate') {
        const currentPlanStartDate = field === 'planStartDate' ? newValue : task.planStartDate
        const currentPlanEndDate = field === 'planEndDate' ? newValue : task.planEndDate

        if (currentPlanStartDate && currentPlanEndDate) {
          const planStartMoment = moment(currentPlanStartDate)
          const planEndMoment = moment(currentPlanEndDate)

          if (planStartMoment.isValid() && planEndMoment.isValid() && planStartMoment.isAfter(planEndMoment)) {
            this.$message.error('计划开始日期不能晚于计划结束日期!')
            this.cancelCellEdit()
            return
          }
        }
      }

      // 触发值变化事件
      this.$emit('cell-value-change', {
        taskId: taskId,
        field: field,
        newValue: newValue,
        oldValue: task[field]
      })

      // 清理编辑状态
      this.editingCell = null
      this.tempEditValue = ''
    },

    // 取消单元格编辑
    cancelCellEdit() {
      this.editingCell = null
      this.tempEditValue = ''
    },

    // 检查单元格是否可编辑
    isCellEditable(task, field) {
      // 检查任务权限
      if (!this.hasPermission(task, 'editable')) {
        return false
      }

      // Milestone类型的任务不允许编辑progress字段
      if (task.type === 'milestone' && field === 'progress') {
        return false
      }

      // 定义可编辑的字段
      const editableFields = ['name', 'progress', 'startDate', 'endDate', 'planStartDate', 'planEndDate', 'status']
      return editableFields.includes(field)
    },

    // 验证单元格值
    validateCellValue(field, value) {
      if (value === null || value === undefined) return null

      try {
        switch (field) {
          case 'name':
            return String(value).trim() || null
          case 'progress':
            const progress = Number(value)
            return isNaN(progress) ? null : Math.max(0, Math.min(100, progress))
          case 'status':
            // 状态字段验证，允许的状态值
            const validStatuses = ['Not Started', 'In Progress', 'Completed', 'On Hold']
            return validStatuses.includes(value) ? value : 'Not Started'
          case 'startDate':
          case 'endDate':
          case 'planStartDate':
          case 'planEndDate':
            // 验证日期格式
            const date = moment(value)
            return date.isValid() ? date.format('YYYY-MM-DD') : null
          default:
            return String(value)
        }
      } catch (error) {
        console.warn('[单元格验证] 值验证失败:', error)
        return null
      }
    },

    // 获取单元格显示值（用于编辑初始值）
    getCellDisplayValue(task, field) {
      const value = task[field]

      switch (field) {
        case 'progress':
          return value || 0
        case 'status':
          return this.getTaskStatus(task)
        case 'startDate':
        case 'endDate':
        case 'planStartDate':
        case 'planEndDate':
          // 对于日期字段，如果存在值且格式正确，直接返回；否则返回空字符串
          if (value) {
            const date = moment(value)
            return date.isValid() ? date.format('YYYY-MM-DD') : ''
          }
          return ''
        default:
          return value || ''
      }
    },

    // 处理单元格点击
    handleCellClick(task, field, event) {
      // 防止冒泡到行点击
      event.stopPropagation()

      if (this.allowCellEdit && this.isCellEditable(task, field)) {
        const currentValue = this.getCellDisplayValue(task, field)
        this.startCellEdit(task, field, currentValue)
      }
    },

    // 处理按键事件
    handleCellKeydown(event) {
      switch (event.key) {
        case 'Enter':
          event.preventDefault()
          this.finishCellEdit()
          break
        case 'Escape':
          event.preventDefault()
          this.cancelCellEdit()
          break
      }
    },

    // 计算Duration列的值
    calculateDuration(task) {
      if (!task.startDate || !task.endDate) {
        return '-'
      }

      const startDate = moment(task.startDate)
      const endDate = moment(task.endDate)

      if (!startDate.isValid() || !endDate.isValid()) {
        return '-'
      }

      const duration = endDate.diff(startDate, 'days') + 1 // 包含首尾日期
      return `${duration} Days`
    }
  },
  mounted() {
    // 发送表格挂载事件给父组件
    this.$emit('table-mounted')

    // 初始化任务名称选项
    this.updateTaskNameOptions()

    // 清理可能存在的旧筛选数据，确保任务名称筛选使用正确的数据类型
    this.cleanupFilters()

    // 初始化表格布局和滚动同步
    this.initTableLayout()

    // 初始化滚动事件监听
    if (this.$refs.tableBody) {
      this.$refs.tableBody.addEventListener('scroll', this.handleScroll)
    }
  },

  beforeDestroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
    }

    // 清理滚动事件监听器
    if (this.$refs.tableBody) {
      this.$refs.tableBody.removeEventListener('scroll', this.handleScroll)
    }

    // 清理列宽调整事件监听器
    if (this.isResizingColumn) {
      document.removeEventListener('mousemove', this.doColumnResize)
      document.removeEventListener('mouseup', this.stopColumnResize)
      document.removeEventListener('mousemove', this.doTaskNameColumnResize)
      document.removeEventListener('mouseup', this.stopTaskNameColumnResize)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }

    // 清理编辑状态
    this.cancelCellEdit()
  }
}
</script>

<style scoped>
/* ===== 表格容器 ===== */
.custom-gantt-table {
  height: 100%;
  width: 100%;
  overflow: hidden;
  background: #ffffff;
  border-right: 1px solid #e1e8ed;
  display: block;
}

.table-body {
  overflow: auto;
  width: 100%;
  position: relative;
  background: #ffffff;
}

/* ===== 表头样式 ===== */
.table-header-row {
  position: sticky;
  top: 0;
  z-index: 100;
  background: #f8f9fa;
  border-bottom: 1px solid #e1e8ed;
  display: flex;
  height: 62px;
  font-weight: 600;
  font-size: 13px;
  color: #374151;
  /* DHTMLX风格：浅灰色背景，深灰色文字，与右侧甘特图时间轴高度一致 */
}

.table-cell {
  display: flex;
  align-items: center;
  padding: 0 10px;
  border-right: 1px solid #f0f3f6;
  border-bottom: 1px solid #eee;
  background: inherit;
  box-sizing: border-box;
  min-height: 62px;
  height: 62px;
  /* 表头单元格高度与表头行保持一致 */
}

/* 数据行中的单元格需要单独设置高度 */
.data-row .table-cell {
  min-height: 28px; /* 压缩行高 */
  height: 28px; /* 压缩行高 */
  /* 数据行单元格高度与数据行对齐 */
}

.fixed-cell {
  background: #f8f9fa;
  z-index: 10;
  /* 固定列保持表头背景色 */
}

.header-text {
  flex: 1;
  font-weight: 600;
  color: #374151;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-actions {
  margin-left: 8px;
  display: flex;
  gap: 4px;
  opacity: 1; /* 确保始终显示 */
}

.header-cell:hover .header-actions {
  opacity: 1;
}

.sort-icon,
.drag-handle,
.filter-icon {
  color: #9ca3af;
  cursor: pointer;
  font-size: 14px;
  transition: color 0.2s ease;
  padding: 2px 4px;
  border-radius: 3px;
  display: inline-block;
}

.sort-icon:hover,
.drag-handle:hover,
.filter-icon:hover {
  color: #4a90e2;
  background: rgba(74, 144, 226, 0.1);
}

/* ===== 筛选功能样式 ===== */
.filter-icon {
  position: relative;
  cursor: pointer;
  color: #9ca3af;
  font-size: 14px;
  transition: color 0.2s ease;
  padding: 2px 4px;
  border-radius: 3px;
  display: inline-block;
}

/* 如果Element UI图标没有正确加载，使用备用方案 */
.filter-icon:before {
  content: "🔍"; /* Unicode筛选图标作为备用 */
  font-size: 12px;
}

/* 当Element UI图标正确加载时，隐藏备用图标 */
.el-icon-filter:before {
  content: "";
}

.filter-icon:hover {
  color: #4a90e2;
}

.filter-icon.active {
  color: #4a90e2 !important;
  background: rgba(74, 144, 226, 0.1) !important;
}

.filter-icon.active::after {
  content: '';
  position: absolute;
  top: -2px;
  right: -2px;
  width: 6px;
  height: 6px;
  background: #f56c6c;
  border-radius: 50%;
  border: 1px solid #fff;
}

/* 筛选下拉菜单样式 */
.el-dropdown-menu {
  max-height: 200px;
  overflow-y: auto;
}

.el-dropdown-menu__item {
  font-size: 12px;
  padding: 8px 16px;
}

/* ===== 表格内容区域 ===== */
.table-content {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: auto;
  overflow-x: hidden;
}

.table-row {
  position: absolute;
  width: 100%;
  display: flex;
  border-bottom: 1px solid #f0f3f6;
  transition: background-color 0.15s ease;
  cursor: pointer;
  /* 确保与甘特图节点对齐 - 精确匹配甘特图行高 */
  height: 28px; /* 压缩行高 */
  line-height: 28px; /* 压缩行高 */
  box-sizing: border-box;
  /* 添加对齐基线 */
  align-items: center;
}

.data-row {
  background: #ffffff;
  min-height: 28px; /* 压缩行高 */
  height: 28px; /* 压缩行高 */
  /* 确保行高一致，与甘特图节点完全对齐 */
}

/* 行选中状态 - 优化视觉效果，移除边框避免被覆盖 */
.table-row.highlighted {
  position: relative;
  z-index: 50;
  /* 移除border，使用背景色和伪元素实现高亮效果 */
}

.table-row.highlighted::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 999;
  /* 确保高亮背景在最顶层，避免被其他元素覆盖 */
}
.table-row.highlighted .all-columns-content{
  background: linear-gradient(90deg, rgba(74, 144, 226, 0.12) 0%, rgba(74, 144, 226, 0.08) 100%);

}

.table-row.highlighted::after {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;

  pointer-events: none;
  /* 使用伪元素实现左侧指示条 */
}

/* 行悬停效果 */
.table-row:hover {
  background: #f8f9fa;
}

.table-row.highlighted:hover {
  background: rgba(74, 144, 226, 0.18) !important;
}

.data-row.even-row {
  background: #ffffff;
}

.data-row.odd-row {
  background: #fafbfc;
  /* 轻微的斑马条纹效果 */
}

.data-row.parent-row {
  background: #f8f9fa;
  font-weight: 600;
  border-bottom: 1px solid #e1e8ed;
  /* 父节点使用更深的背景色 */
}

.data-row.parent-row:hover {
  background: #f1f3f4;
}

/* ===== 任务名称列优化 - 自适应宽度 ===== */
.task-name-cell {
  /* 样式在内联style中定义，这里保留基础样式 */
}

.task-name-content {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 6px;
  height: 100%;
  justify-content: space-between;
  /* 确保内容垂直居中，任务文本和操作按钮分别在两端 */
}

.collapse-btn {
  background: none;
  border: none;
  padding: 2px 4px;
  cursor: pointer;
  color: #6b7280;
  border-radius: 2px;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.collapse-btn:hover {
  background: #e5e7eb;
  color: #374151;
}

.collapse-icon {
  font-size: 10px;
  transition: transform 0.15s ease;
}

.collapse-btn.collapsed .collapse-icon {
  transform: rotate(0deg);
}

.task-name {
  font-weight: 500;
  color: #374151;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  line-height: 1.2;
  min-width: 0;
  flex: 1;
  /* 确保文本能够正确省略 */
}

.children-count {
  color: #9ca3af;
  font-size: 11px;
  font-weight: 400;
  background: #f3f4f6;
  padding: 1px 6px;
  border-radius: 10px;
}

/* ===== 复选框列 ===== */
.checkbox-cell {
  justify-content: center;
}

/* Element UI复选框样式重写 */
.checkbox-cell .el-checkbox__input.is-checked .el-checkbox__inner {
  background-color: #4a90e2;
  border-color: #4a90e2;
  /* DHTMLX蓝色主题 */
}

.checkbox-cell .el-checkbox__inner:hover {
  border-color: #4a90e2;
}

/* ===== 操作列 ===== */
.action-cell {
  justify-content: center;
}

.settings-btn {
  color: #6b7280 !important;
  font-size: 16px !important;
  padding: 4px !important;
  border: none !important;
  background: none !important;
}

.settings-btn:hover {
  color: #4a90e2 !important;
  background: rgba(74, 144, 226, 0.1) !important;
}

/* ===== 筛选图标样式 ===== */
.filter-icon {
  margin-left: 4px;
  cursor: pointer;
  color: #9ca3af;
  transition: color 0.2s ease;
}

.filter-icon:hover {
  color: #4a90e2;
}

.filter-icon.active {
  color: #4a90e2;
  font-weight: bold;
}

/* ===== 表头操作按钮区域 ===== */
.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* ===== 进度条样式 ===== */
.progress-content {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: #f3f4f6;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #4a90e2;
  border-radius: 3px;
  transition: width 0.3s ease;
  /* DHTMLX蓝色进度条 */
}

.progress-text {
  font-size: 11px;
  color: #6b7280;
  font-weight: 500;
  min-width: 35px;
  text-align: right;
}

/* ===== 状态标签 ===== */
.status-badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  text-align: center;
  white-space: nowrap;
}

/* ===== 权限控制样式 ===== */
.permission-hint {
  color: #f56c6c;
  font-size: 10px;
  margin-left: 4px;
  font-style: italic;
  /* 权限提示样式 */
}

.status-badge.not-started {
  background: #f3f4f6;
  color: #6b7280;
}

.status-badge.in-progress {
  background: rgba(74, 144, 226, 0.1);
  color: #4a90e2;
}

.status-badge.completed {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
}

.status-badge.overdue {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

/* ===== 日期文本样式 ===== */
.date-text {
  font-size: 12px;
  color: #6b7280;
}

.date-text.plan-date {
  color: #4a90e2;
  font-style: italic;
}

/* ===== 表格布局 - 固定列布局 ===== */
.table-header-row,
.table-row {
  display: flex;
  align-items: center;
  position: relative;
}

/* 修复固定列模式下表头宽度计算 */
.table-header-row {
  background: #f8fafc;
  border-bottom: 1px solid #e1e8ed;
  position: sticky;
  top: 0;
  z-index: 2;
  height: 62px;
}

/* 根据固定列配置动态调整表头宽度 */
.custom-gantt-table.fixed-columns .table-header-row {
  /* 固定列模式下使用flex布局，让各部分自动计算宽度 */
  display: flex;
  width: 100%;
  min-width: fit-content;
}

.custom-gantt-table:not(.fixed-columns) .table-header-row {
  /* 非固定列模式下使用100%宽度 */
  width: 100%;
  min-width: 100%;
}

.table-row {
  width: 100%;
}

.table-row {
  border-bottom: 1px solid #f0f0f0;
  position: absolute;
  left: 0;
  width: 100%;
  height: 28px; /* 修复表格行高度 */
}

/* ===== 固定列布局 ===== */
.fixed-left-columns {
  display: flex;
  position: sticky;
  left: 0;
  z-index: 5;
  background: #f8f9fa;
  box-shadow: 2px 0 4px rgba(0, 0, 0, 0.1);
  /* 固定左侧列总宽度：checkbox(50) + taskName(200) = 250px */
  width: 250px;
  min-width: 250px;
  flex-shrink: 0;
}

.scrollable-columns-header,
.scrollable-columns {
  display: flex;
  overflow: hidden;
  flex-shrink: 0;
  /* 宽度、最小宽度、最大宽度都由JavaScript动态设置，确保完全一致 */
  position: relative;
}

.fixed-right-columns {
  display: none;
  position: sticky;
  right: 0;
  z-index: 5;
  background: #f8f9fa;
  box-shadow: -2px 0 4px rgba(0, 0, 0, 0.1);
  width: 60px;
  min-width: 60px;
  flex-shrink: 0;
}

/* ===== 表格单元格 ===== */
.table-cell {
  padding: 8px 12px;
  border-right: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  white-space: nowrap;
  overflow: hidden;
}

.header-cell {
  height: 100%;
  font-weight: 600;
  background: #f8fafc;
}

.fixed-cell {
  background: #f8f9fa !important;
}

/* ===== 固定列宽度 ===== */
.checkbox-cell.fixed-cell {
  width: 50px;
  min-width: 50px;
  max-width: 50px;
  flex: 0 0 50px;
}

.task-name-cell.fixed-cell {
  width: 200px;
  min-width: 200px;
  max-width: 200px;
  flex: 0 0 200px;
}

.action-cell.fixed-cell {
  width: 60px;
  min-width: 60px;
  max-width: 60px;
  flex: 0 0 60px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

/* ===== 滚动条样式 ===== */
.table-body::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.table-body::-webkit-scrollbar-track {
  background: #f8f9fa;
}

.table-body::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 4px;
}

.table-body::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

/* ===== 响应式优化 ===== */
@media (max-width: 768px) {
  .table-cell {
    padding: 0 8px;
  }

  .task-name-cell {
    min-width: 150px;
  }

  .header-text,
  .task-name {
    font-size: 12px;
  }
}

/* ===== 任务悬停操作菜单 ===== */
.task-name-content {
  position: relative;
}

/* 任务文本区域 */
.task-text-area {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  /* 允许文本压缩，为操作按钮预留空间 */
}

.task-hover-actions {
  display: flex;
  gap: 4px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 4px;
  padding: 2px 4px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  z-index: 100;
  animation: fadeIn 0.2s ease;
  border: 1px solid rgba(0, 0, 0, 0.05);
  flex-shrink: 0;
  /* 操作按钮不压缩，始终保持原尺寸 */
}

.task-action-btn {
  width: 24px;
  height: 24px;
  border-radius: 3px;
  border: none;
  background: #f3f4f6;
  color: #6b7280;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 0;
  position: relative;
  font-size: 12px;
}

.task-action-btn:hover {
  background: #4a90e2;
  color: white;
  transform: translateY(-2px);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
}

.task-action-btn:hover::after {
  content: attr(title);
  position: absolute;
  bottom: -25px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 3px 8px;
  border-radius: 3px;
  font-size: 11px;
  white-space: nowrap;
  z-index: 101;
}

.edit-btn:hover {
  background: #22c55e;
}

.add-sibling-btn:hover {
  background: #3b82f6;
}

.add-child-btn:hover {
  background: #8b5cf6;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-50%) translateX(10px);
  }
  to {
    opacity: 1;
    transform: translateY(-50%) translateX(0);
  }
}

/* 筛选功能相关样式 */
.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 100%;
  padding: 0 8px;
}

.filter-icon {
  cursor: pointer;
  color: #606266;
  font-size: 12px;
  transition: color 0.3s;
}

.filter-icon:hover {
  color: #409eff;
}

.filter-icon.active {
  color: #409eff;
}

.drag-handle {
  cursor: move;
  color: #909399;
  font-size: 12px;
}

.drag-handle:hover {
  color: #409eff;
}

/* 任务类型图标样式 */
.task-type-icon {
  display: inline-flex;
  align-items: center;
  margin-right: 6px;
  font-size: 14px;
  vertical-align: middle;
}

/* 任务文本区域布局 */
.task-text-area {
  display: flex;
  align-items: center;
  flex: 1;
}

/* ===== 非固定列布局样式 ===== */
.table-header-row.no-fixed-columns,
.table-row.no-fixed-columns {
  /* 不固定列时，使用简单的flex布局 */
}

.all-columns-header,
.all-columns-content {
  display: flex;
  width: 100%;
  /* 整体水平滚动 */
}

/* 非固定模式下的列宽度 */
.no-fixed-columns .checkbox-cell {
  width: 50px;
  min-width: 50px;
  max-width: 50px;
  flex: 0 0 50px;
}

.no-fixed-columns .task-name-cell {
  width: 200px;
  min-width: 200px;
  max-width: 200px;
  flex: 0 0 200px;
}

/* 任务名称列动态宽度样式 */
.task-name-cell {
  transition: width 0.1s ease;
  position: relative; /* 为了拖拽手柄定位 */
}

.no-fixed-columns .action-cell {
  width: 60px;
  min-width: 60px;
  max-width: 60px;
  flex: 0 0 60px;
}

/* 筛选弹窗样式 */
.filter-popover {
  padding: 12px;
}

.filter-options {
  max-height: 200px;
  overflow-y: auto;
  margin-top: 8px;
  border: 1px solid #e1e8ed;
  border-radius: 4px;
  padding: 8px;
}

.filter-option-header {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 8px;
  font-weight: 500;
}

.filter-option-item {
  margin-bottom: 4px;
}

.filter-option-item:last-child {
  margin-bottom: 0;
}

.filter-actions {
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid #e1e8ed;
  text-align: right;
}

.filter-actions .el-button {
  margin-left: 8px;
}

/* ===== 列宽调整手柄样式 ===== */
.column-resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  width: 4px;
  height: 100%;
  cursor: col-resize;
  background: transparent;
  border-right: 2px solid transparent;
  transition: border-color 0.2s ease;
  z-index: 10;
}

.column-resize-handle:hover {
  border-right-color: #4a90e2;
  background: rgba(74, 144, 226, 0.1);
}

.table-cell {
  position: relative; /* 为了让调整手柄定位正确 */
}

/* 调整中的样式 */
.table-cell.resizing {
  background: rgba(74, 144, 226, 0.05);
}

/* ===== 单元格内联编辑样式 ===== */
.cell-content {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  padding: 0 4px;
  min-height: 24px; /* 适配新的行高 */
  transition: background-color 0.2s ease;
  overflow: hidden; /* 防止内容溢出 */
}

.cell-content.editable {
  cursor: text;
  border-radius: 3px;
}

.cell-content.editable:hover {
  background: rgba(74, 144, 226, 0.05);
  box-shadow: inset 0 0 0 1px rgba(74, 144, 226, 0.2);
}

.cell-edit-input {
  width: 100%;
  height: 24px; /* 适配新的行高 */
  border: 1px solid #4a90e2;
  border-radius: 3px;
  padding: 0 6px;
  font-size: 11px; /* 压缩字体 */
  background: #ffffff;
  outline: none;
  box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.1);
  box-sizing: border-box; /* 防止溢出 */
  max-width: 100%; /* 确保不超出单元格 */
}

.cell-edit-input:focus {
  box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.3);
}

/* 特殊字段的编辑样式 */
.cell-edit-input[type="number"] {
  text-align: right;
}

.cell-edit-input[type="date"] {
  padding: 0 4px;
}

/* 编辑模式下的进度条样式调整 */
.progress-content {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
}

.progress-bar {
  flex: 1;
  height: 12px;
  background: #f0f0f0;
  border-radius: 6px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  transition: width 0.3s ease;
  border-radius: 6px;
}

.progress-text {
  font-size: 11px;
  color: #666;
  min-width: 35px;
  text-align: right;
}

/* 可编辑提示 */
.cell-content.editable::after {
  content: '';
  position: absolute;
  top: 2px;
  right: 2px;
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-top: 4px solid #d1d5db;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.cell-content.editable:hover::after {
  opacity: 1;
}

/* ===== 任务名称编辑特殊样式 ===== */
.task-name-cell-content {
  flex: 1;
  min-width: 0;
}

.task-name-input {
  flex: 1;
  min-width: 120px;
}

/* ===== 状态选择器特殊样式 ===== */
.status-select {
  min-width: 100px;
  padding: 2px 4px;
  font-size: 12px;
  background: #ffffff;
  border: 1px solid #4a90e2;
  border-radius: 3px;
  outline: none;
}

.status-select:focus {
  box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.3);
}

/* Milestone 指示器样式 */
.milestone-indicator {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  background: linear-gradient(135deg, #f39c12, #e67e22);
  color: #ffffff;
  border-radius: 12px;
  font-size: 10px;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  min-width: 60px;
  justify-content: center;
}

.duration-text {
  font-size: 12px;
  color: #6b7280;
}

/* 表格行悬停效果 */
.table-row.row-hover {
  background-color: #f8f9fa;
  transition: background-color 0.2s ease;
}

/* 悬浮编辑按钮 */
.hover-edit-btn {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 26px;
  height: 26px;
  background: #409eff;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 20;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.4);
  border: 2px solid white;
  opacity: 0.95;
}

.hover-edit-btn:hover {
  background: #337ecc;
  border-color: white;
  transform: translateY(-50%) scale(1.15);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.6);
  opacity: 1;
}

.hover-edit-btn i {
  font-size: 13px;
  color: white;
  font-weight: bold;
}

/* 确保表格行相对定位，以便悬浮按钮正确定位 */
.table-row {
  position: relative !important;
}

/* 修复表格行样式问题 */
.table-row.data-row {
  position: absolute !important;
  left: 0;
  right: 0;
  height: 28px;
  border-bottom: 1px solid #ebeef5;
  background: white;
}

.table-row.data-row.no-fixed-columns {
  position: absolute !important;
  width: 100%;
}

/* 悬停状态的表格行 */
.table-row.row-hover {
  background-color: #f8f9fa !important;
  transition: background-color 0.2s ease;
}

</style>
