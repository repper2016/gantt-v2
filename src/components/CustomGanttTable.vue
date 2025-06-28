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
                      >
                        <!-- 自定义搜索图标 -->
                        <template slot="prefix">
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            class="custom-search-icon"
                          >
                            <circle
                              cx="11"
                              cy="11"
                              r="8"
                              stroke="#9ca3af"
                              stroke-width="2"
                              fill="none"
                            />
                            <path
                              d="m21 21-4.35-4.35"
                              stroke="#9ca3af"
                              stroke-width="2"
                              stroke-linecap="round"
                            />
                          </svg>
                        </template>
                      </el-input>
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
                      class="filter-icon "
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
                  <!-- Assignee列使用复选框筛选模式 -->
                  <el-popover
                    v-if="column.id === 'assignee'"
                    placement="bottom"
                    trigger="click"
                    :width="280"
                    @show="onAssigneeFilterShow"
                  >
                    <div class="filter-popover">
                      <el-input
                        v-model="assigneeFilterSearchText"
                        placeholder="Search assignees..."
                        size="mini"
                        clearable
                        @input="handleAssigneeFilter"
                        @clear="clearAssigneeFilter"
                      >
                        <!-- 自定义搜索图标 -->
                        <template slot="prefix">
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            class="custom-search-icon"
                          >
                            <circle
                              cx="11"
                              cy="11"
                              r="8"
                              stroke="#9ca3af"
                              stroke-width="2"
                              fill="none"
                            />
                            <path
                              d="m21 21-4.35-4.35"
                              stroke="#9ca3af"
                              stroke-width="2"
                              stroke-linecap="round"
                            />
                          </svg>
                        </template>
                      </el-input>
                      <div v-if="assigneeOptions.length > 0" class="filter-options">
                        <div class="filter-option-header">Available Assignees:</div>
                        <el-checkbox-group v-model="selectedAssignees" @change="handleAssigneeFilterChange">
                          <div v-for="option in filteredAssigneeOptions" :key="option.value" class="filter-option-item">
                            <el-checkbox :label="option.value" :disabled="false">
                              {{ option.label }}
                            </el-checkbox>
                          </div>
                        </el-checkbox-group>
                      </div>
                      <div class="filter-actions">
                        <el-button size="mini" @click="selectAllAssignees">Select All</el-button>
                        <el-button size="mini" @click="clearAllAssignees">Clear All</el-button>
                      </div>
                    </div>
                    <i
                      slot="reference"
                      class="filter-icon"
                      :class="{ 'active': activeFilters['assignee'] }"
                      title="Filter Assignees"
                    ></i>
                  </el-popover>
                  <!-- 其他列使用下拉筛选模式 -->
                  <el-dropdown
                    v-else-if="hasFilterOptions(column)"
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
                    <filter-popover
                      :options="taskNameOptions"
                      v-model="selectedTaskNames"
                      placeholder="搜索任务..."
                      options-title="可选任务"
                      @search="handleTaskNameFilter"
                      @change="handleTaskNameFilterChange"
                    />
                    <i
                      slot="reference"
                      class="filter-icon"
                      :class="{ 'active': activeFilters['taskName'] }"
                      title="筛选任务"
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
                  <!-- Assignee列使用复选框筛选模式 -->
                  <el-popover
                    v-if="column.id === 'assignee'"
                    placement="bottom"
                    trigger="click"
                    :width="280"
                    @show="onAssigneeFilterShow"
                  >
                    <div class="filter-popover">
                      <el-input
                        v-model="assigneeFilterSearchText"
                        placeholder="Search assignees..."
                        size="mini"
                        clearable
                        @input="handleAssigneeFilter"
                        @clear="clearAssigneeFilter"
                        prefix-icon="el-icon-search"
                      />
                      <div v-if="assigneeOptions.length > 0" class="filter-options">
                        <div class="filter-option-header">Available Assignees:</div>
                        <el-checkbox-group v-model="selectedAssignees" @change="handleAssigneeFilterChange">
                          <div v-for="option in filteredAssigneeOptions" :key="option.value" class="filter-option-item">
                            <el-checkbox :label="option.value" :disabled="false">
                              {{ option.label }}
                            </el-checkbox>
                          </div>
                        </el-checkbox-group>
                      </div>
                      <div class="filter-actions">
                        <el-button size="mini" @click="selectAllAssignees">Select All</el-button>
                        <el-button size="mini" @click="clearAllAssignees">Clear All</el-button>
                      </div>
                    </div>
                    <i
                      slot="reference"
                      class="filter-icon"
                      :class="{ 'active': activeFilters['assignee'] }"
                      title="Filter Assignees"
                    ></i>
                  </el-popover>
                  <!-- 其他列使用下拉筛选模式 -->
                  <el-dropdown
                    v-else-if="hasFilterOptions(column)"
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
              <div
                class="action-wrapper"
                @mouseenter="handleActionMouseEnter(task.id)"
                @mouseleave="handleActionMouseLeave(task.id)"
              >
                <el-popover
                  v-if="isActionVisible(task.id)"
                  placement="bottom-end"
                  trigger="click"
                  popper-class="task-action-popover"
                  :visible-arrow="false"
                >
                  <div class="task-action-menu">
                                        <!-- 根据任务类型动态生成菜单 -->
                    <template v-if="task.type === 'deliverable'">
                      <div class="task-action-item" @click="handleTaskAction(task, 'add-child')">
                        <i class="el-icon-circle-plus-outline"></i>
                        <span>添加子任务</span>
                      </div>
                      <div class="task-action-item" @click="handleTaskAction(task, 'add-sibling')">
                        <i class="el-icon-plus"></i>
                        <span>添加同级</span>
                      </div>
                      <div class="task-action-divider"></div>
                      <div class="task-action-item" @click="handleTaskAction(task, 'edit')">
                        <i class="el-icon-edit"></i>
                        <span>编辑22</span>
                      </div>
                      <div class="task-action-item" @click="handleTaskAction(task, 'delete')">
                        <i class="el-icon-delete"></i>
                        <span>删除</span>
                      </div>
                    </template>
                    <template v-else-if="task.type === 'task'">
                      <div class="task-action-item" @click="handleTaskAction(task, 'add-child')">
                        <i class="el-icon-circle-plus-outline"></i>
                        <span>添加子任务</span>
                      </div>
                      <div class="task-action-item" @click="handleTaskAction(task, 'add-sibling')">
                        <i class="el-icon-plus"></i>
                        <span>添加同级</span>
                      </div>
                      <div class="task-action-divider"></div>
                      <div class="task-action-item" @click="handleTaskAction(task, 'edit')">
                        <i class="el-icon-edit"></i>
                        <span>编辑</span>
                      </div>
                      <div class="task-action-divider"></div>
                      <div class="task-action-item" @click="handleTaskAction(task, 'delete')">
                        <i class="el-icon-delete"></i>
                        <span>删除</span>
                      </div>
                    </template>
                    <template v-else-if="task.type === 'milestone'">
                      <div class="task-action-item" @click="handleTaskAction(task, 'add-sibling')">
                        <i class="el-icon-plus"></i>
                        <span>添加同级</span>
                      </div>
                      <div class="task-action-divider"></div>
                      <div class="task-action-item" @click="handleTaskAction(task, 'edit')">
                        <i class="el-icon-edit"></i>
                        <span>编辑</span>
                      </div>
                      <div class="task-action-divider"></div>
                      <div class="task-action-item" @click="handleTaskAction(task, 'delete')">
                        <i class="el-icon-delete"></i>
                        <span>删除</span>
                      </div>
                    </template>
                    <template v-else>
                      <div class="task-action-item" @click="handleTaskAction(task, 'edit')">
                        <i class="el-icon-edit"></i>
                        <span>编辑</span>
                      </div>
                    </template>
                  </div>
                  <el-button
                    slot="reference"
                    size="mini"
                    type="text"
                    icon="el-icon-more"
                    class="task-action-btn"
                  />
                </el-popover>
              </div>
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
                  <div class="task-text-area" @mouseenter="hoveredTaskNameId = task.id" @mouseleave="hoveredTaskNameId = null">
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

                    <!-- 任务名称列内的编辑图标 -->
                    <el-dropdown
                      v-if="hoveredTaskNameId === task.id && hasPermission(task, 'editable')"
                      trigger="click"
                      size="mini"
                      :hide-on-click="true"
                      placement="bottom-end"
                      @command="(command) => handleTaskAction({ action: command, task })"
                      @visible-change="(visible) => handleDropdownVisibleChange(visible, task.id)"
                    >
                      <el-button
                        size="mini"
                        type="text"
                        icon="el-icon-more"
                        class="task-action-btn"
                        @click.stop="$event.preventDefault()"
                      />
                      <el-dropdown-menu
                        slot="dropdown"
                        class="task-action-dropdown"
                      >
                        <!-- 根据任务类型动态生成菜单 -->
                        <template v-if="task.type === 'deliverable'">
                          <el-dropdown-item command="add-child" icon="el-icon-circle-plus-outline">
                            Add Subtask
                          </el-dropdown-item>
                          <el-dropdown-item command="add-sibling" icon="el-icon-plus">
                            Add Sibling
                          </el-dropdown-item>
                          <el-dropdown-item command="edit" icon="el-icon-edit" divided>
                            Edit
                          </el-dropdown-item>
                          <el-dropdown-item command="delete" icon="el-icon-delete" divided>
                            Delete
                          </el-dropdown-item>
                        </template>
                        <template v-else-if="task.type === 'task'">
                          <el-dropdown-item command="add-child" icon="el-icon-circle-plus-outline">
                            Add Subtask
                          </el-dropdown-item>
                          <el-dropdown-item command="add-sibling" icon="el-icon-plus">
                            Add Sibling
                          </el-dropdown-item>
                          <el-dropdown-item command="edit" icon="el-icon-edit" divided>
                            Edit
                          </el-dropdown-item>
                          <el-dropdown-item command="delete" icon="el-icon-delete" divided>
                            Delete
                          </el-dropdown-item>
                        </template>
                        <template v-else-if="task.type === 'milestone'">
                          <el-dropdown-item command="add-sibling" icon="el-icon-plus">
                            Add Sibling
                          </el-dropdown-item>
                          <el-dropdown-item command="edit" icon="el-icon-edit" divided>
                            Edit
                          </el-dropdown-item>
                          <el-dropdown-item command="delete" icon="el-icon-delete" divided>
                            Delete
                          </el-dropdown-item>
                        </template>
                        <template v-else>
                          <el-dropdown-item command="edit" icon="el-icon-edit">
                            Edit
                          </el-dropdown-item>
                          <el-dropdown-item command="delete" icon="el-icon-delete" divided>
                            Delete
                          </el-dropdown-item>
                        </template>
                      </el-dropdown-menu>
                    </el-dropdown>
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

                  <!-- Assignee列 -->
                  <template v-else-if="column.id === 'assignee'">
                    <div
                      class="editable-cell"
                      @mouseenter="handleCellMouseEnter(task.id, 'assignee')"
                      @mouseleave="handleCellMouseLeave(task.id, 'assignee')"
                    >
                      <template>
                        <el-select
                          v-model="task.assignee"
                          class="cell-edit-input assignee-select"
                          filterable
                          clearable
                          placeholder="选择负责人"
                          @change="(value) => handleCellValueChange(task.id, 'assignee', value)"
                          :append-to-body="true"
                          :value="task.assignee || ''"
                          @blur="handleCellMouseLeave(task.id, 'assignee')"
                          popper-class="assignee-dropdown"
                        >
                          <el-option
                            v-for="person in assigneeOptions"
                            :key="person.value"
                            :label="person.label"
                            :value="person.value"
                          >
                          </el-option>
                        </el-select>
                      </template>

                    </div>
                  </template>

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
                  <div class="task-text-area" @mouseenter="hoveredTaskNameId = task.id" @mouseleave="hoveredTaskNameId = null">
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

                    <!-- 任务名称列内的编辑图标 -->
                    <el-dropdown
                      v-if="hasPermission(task, 'editable')"
                      trigger="click"
                      size="mini"
                      :hide-on-click="false"
                      placement="bottom-end"
                      @command="(command) => handleTaskAction({ action: command, task })"
                    >
                      <el-button
                        size="mini"
                        type="text"
                        icon="el-icon-more"
                        class="task-action-btn"
                      />
                      <el-dropdown-menu
                        slot="dropdown"
                        class="task-action-dropdown"
                      >
                        <!-- 根据任务类型动态生成菜单 -->
                        <template v-if="task.type === 'deliverable'">
                          <el-dropdown-item command="add-child" icon="el-icon-circle-plus-outline">
                            添加子任务
                          </el-dropdown-item>
                          <el-dropdown-item command="add-sibling" icon="el-icon-plus">
                            添加同级
                          </el-dropdown-item>
                          <el-dropdown-item command="edit" icon="el-icon-edit" divided>
                            编辑
                          </el-dropdown-item>
                          <el-dropdown-item command="delete" icon="el-icon-delete" divided>
                            删除
                          </el-dropdown-item>
                        </template>
                        <template v-else-if="task.type === 'task'">
                          <el-dropdown-item command="add-child" icon="el-icon-circle-plus-outline">
                            添加子任务
                          </el-dropdown-item>
                          <el-dropdown-item command="add-sibling" icon="el-icon-plus">
                            添加同级
                          </el-dropdown-item>
                          <el-dropdown-item command="edit" icon="el-icon-edit" divided>
                            编辑
                          </el-dropdown-item>
                          <el-dropdown-item command="delete" icon="el-icon-delete" divided>
                            删除
                          </el-dropdown-item>
                        </template>
                        <template v-else-if="task.type === 'milestone'">
                          <el-dropdown-item command="add-sibling" icon="el-icon-plus">
                            添加同级
                          </el-dropdown-item>
                          <el-dropdown-item command="edit" icon="el-icon-edit" divided>
                            编辑
                          </el-dropdown-item>
                          <el-dropdown-item command="delete" icon="el-icon-delete" divided>
                            删除
                          </el-dropdown-item>
                        </template>
                        <template v-else>
                          <el-dropdown-item command="edit" icon="el-icon-edit">
                            编辑
                          </el-dropdown-item>
                        </template>
                      </el-dropdown-menu>
                    </el-dropdown>
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

                    <!-- Assignee列 -->
                    <template v-else-if="column.id === 'assignee'">
                      <div
                        class="editable-cell"
                        @mouseenter="handleCellMouseEnter(task.id, 'assignee')"
                        @mouseleave="handleCellMouseLeave(task.id, 'assignee')"
                      >
                        <template>
                          <el-select
                            v-model="task.assignee"
                            class="cell-edit-input assignee-select"
                            filterable
                            clearable
                            placeholder="选择负责人"
                            @change="(value) => handleCellValueChange(task.id, 'assignee', value)"
                            :append-to-body="true"
                            :value="task.assignee || ''"
                            @blur="handleCellMouseLeave(task.id, 'assignee')"
                            popper-class="assignee-dropdown"
                          >
                            <el-option
                              v-for="person in assigneeOptions"
                              :key="person.value"
                              :label="person.label"
                              :value="person.value"
                            >
                            </el-option>
                          </el-select>
                        </template>

                      </div>
                    </template>

                    <!-- 其他列 -->
                    <span v-else>{{ task[column.prop] || '-' }}</span>
                  </template>
                </div>
              </div>

              <!-- 操作列 -->
              <div class="table-cell action-cell" v-if="showActionColumn">
                <div
                  class="action-wrapper"
                  @mouseenter="handleActionMouseEnter(task.id)"
                  @mouseleave="handleActionMouseLeave(task.id)"
                >
                  <el-popover
                    v-if="isActionVisible(task.id)"
                    placement="bottom-end"
                    trigger="click"
                    popper-class="task-action-popover"
                    :visible-arrow="false"
                  >
                    <task-action-menu
                      :task="task"
                      @action="handleTaskAction"
                    />
                    <el-button
                      slot="reference"
                      size="mini"
                      type="text"
                      icon="el-icon-more"
                      class="task-action-btn"
                    />
                  </el-popover>
                </div>
              </div>
            </div>
          </template>


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
import TaskActionMenu from './editDialog/TaskActionMenu.vue'
import FilterPopover from './editDialog/FilterPopover.vue'

export default {
  name: 'CustomGanttTable',
  components: {
    TaskActionMenu,
    FilterPopover
  },
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
      // Assignee筛选相关
      assigneeFilterSearchText: '',
      selectedAssignees: [],
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
      editingCells: {}, // 用于跟踪正在编辑的单元格
      visibleActions: {}, // 用于跟踪显示的操作按钮
    }
  },
  computed: {
    ...mapState(['selectAllState']),
    ...mapGetters(['isTaskSelected', 'isTaskCollapsed', 'getAssigneeOptions']),

    // 人员选项数据
    assigneeOptions() {
      return this.getAssigneeOptions || []
    },

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
    },

    // 过滤后的Assignee选项
    filteredAssigneeOptions() {
      if (!this.assigneeFilterSearchText) {
        return this.assigneeOptions
      }
      const searchText = this.assigneeFilterSearchText.toLowerCase()
      return this.assigneeOptions.filter(option =>
        option.label.toLowerCase().includes(searchText) ||
        option.value.toLowerCase().includes(searchText)
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

      return task.status
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
      const filterableColumns = ['progress', 'status', 'assignee', 'startDate', 'endDate', 'planStartDate', 'planEndDate']
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
        case 'assignee':
          // 获取所有任务中的不重复负责人
          const assignees = this.tasks
            .map(task => task.assignee)
            .filter(assignee => assignee)
          const uniqueAssignees = [...new Set(assignees)]
          return uniqueAssignees.map(assignee => ({
            label: assignee,
            value: assignee
          }))
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
      // 特殊处理任务名称和Assignee筛选，避免覆盖复选框多选逻辑
      if (columnId === 'taskName') {
        console.error('[表格筛选错误] 任务名称筛选应使用复选框模式，不应调用 handleFilter 方法。请检查模板中是否还有遗留的下拉筛选代码。')
        return
      }
      if (columnId === 'assignee') {
        console.error('[表格筛选错误] Assignee筛选应使用复选框模式，不应调用 handleFilter 方法。请检查模板中是否还有遗留的下拉筛选代码。')
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
        case 'assignee':
          return task.assignee
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
        case 'assignee':
        if (Array.isArray(filterValue)) {
            // 多选模式：检查任务名称是否在选中列表中
            return filterValue.length === 0 || filterValue.includes(taskValue)
          } else if (typeof filterValue === 'string' && filterValue.trim() !== '') {
            // 搜索模式：模糊匹配任务名称

            return taskValue && typeof taskValue === 'string' &&
                   taskValue.toLowerCase().includes(filterValue.toLowerCase())
          }
          return true
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

    // Assignee筛选相关方法
    onAssigneeFilterShow() {
      // 当筛选弹窗显示时，无需特殊处理（assigneeOptions由store提供）
    },

    handleAssigneeFilter() {
      // 实时搜索，无需额外处理
    },

    clearAssigneeFilter() {
      this.assigneeFilterSearchText = ''
      this.selectedAssignees = []
      this.updateAssigneeFilter()
    },

    handleAssigneeFilterChange() {
      this.updateAssigneeFilter()
    },

    updateAssigneeFilter() {
      // 更新活跃筛选状态
      if (this.selectedAssignees.length > 0) {
        this.$set(this.activeFilters, 'assignee', [...this.selectedAssignees])
      } else {
        this.$delete(this.activeFilters, 'assignee')
      }

      // 触发筛选变化事件
      this.$emit('filter-change', {
        column: 'assignee',
        value: this.selectedAssignees.length > 0 ? [...this.selectedAssignees] : null,
        activeFilters: { ...this.activeFilters }
      })
    },

    selectAllAssignees() {
      this.selectedAssignees = this.filteredAssigneeOptions.map(option => option.value)
      this.updateAssigneeFilter()
    },

    clearAllAssignees() {
      this.selectedAssignees = []
      this.updateAssigneeFilter()
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
    // 开始列宽调整（统一处理所有列）
    startColumnResize(column, event) {
      if (!this.allowColumnResize) return

      this.isResizingColumn = true
      this.resizingColumn = column
      this.resizeStartX = event.clientX
      this.resizeStartWidth = column ? column.width || column.minWidth || 100 : this.taskNameColumnWidth

      // 添加事件监听
      document.addEventListener('mousemove', this.doColumnResize)
      document.addEventListener('mouseup', this.stopColumnResize)

      // 设置样式
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'col-resize'
    },

    // 执行列宽调整
    doColumnResize(event) {
      if (!this.isResizingColumn) return

      const deltaX = event.clientX - this.resizeStartX
      let newWidth = Math.max(100, this.resizeStartWidth + deltaX)

      if (this.resizingColumn) {
        // 动态列调整
        this.$set(this.resizingColumn, 'width', newWidth)
        this.$emit('column-resize', {
          columnId: this.resizingColumn.id,
          newWidth: newWidth
        })
      } else {
        // 任务名称列调整
        this.taskNameColumnWidth = newWidth
        this.updateTaskNameColumnWidth()
      }
    },

    // 结束列宽调整
    stopColumnResize() {
      if (!this.isResizingColumn) return

      // 清理状态
      this.isResizingColumn = false
      this.resizingColumn = null

      // 移除事件监听
      document.removeEventListener('mousemove', this.doColumnResize)
      document.removeEventListener('mouseup', this.stopColumnResize)

      // 恢复样式
      document.body.style.userSelect = ''
      document.body.style.cursor = ''

      // 发射列宽变化事件
      if (this.resizingColumn) {
        this.$emit('column-resize', {
          columnId: this.resizingColumn.id,
          newWidth: this.resizingColumn.width
        })
      } else {
        this.$emit('column-resize', {
          columnId: 'taskName',
          newWidth: this.taskNameColumnWidth
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
      const editableFields = ['name', 'progress', 'startDate', 'endDate', 'planStartDate', 'planEndDate', 'status', 'assignee']
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
          case 'assignee':
            // Assignee字段验证，确保是有效的人员选项
            const validAssignees = this.assigneeOptions.map(option => option.value)
            return validAssignees.includes(value) ? value : ''
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
        case 'assignee':
          return value || ''
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
    },



    // 处理单元格值变化
    handleCellValueChange(taskId, field, value) {
      // 触发值变化事件
      this.$emit('cell-value-change', {
        taskId: taskId,
        field: field,
        newValue: value,
        oldValue: this.tasks.find(t => t.id === taskId)?.[field]
      })
    },

    handleDropdownVisibleChange(visible) {
      // Add any additional logic you want to execute when dropdown is visible
      console.log('Dropdown visible:', visible)
    },

    // 获取负责人名称
    getAssigneeName(assigneeValue) {
      const assignee = this.assigneeOptions.find(option => option.value === assigneeValue)
      return assignee ? assignee.label : ''
    },
    // 处理单元格鼠标进入
    handleCellMouseEnter(taskId, field) {
      this.$set(this.editingCells, `${taskId}-${field}`, true)
    },
    // 处理单元格鼠标离开
    handleCellMouseLeave(taskId, field) {
      this.$set(this.editingCells, `${taskId}-${field}`, false)
    },
    // 判断单元格是否正在编辑
    isEditing(taskId, field) {
      return this.editingCells[`${taskId}-${field}`] === true
    },
    // 处理操作按钮鼠标进入
    handleActionMouseEnter(taskId) {
      this.$set(this.visibleActions, taskId, true)
    },
    // 处理操作按钮鼠标离开
    handleActionMouseLeave(taskId) {
      this.$set(this.visibleActions, taskId, false)
    },
    // 处理dropdown可见性变化
    handleDropdownVisibleChange(visible, taskId) {
      console.log('Dropdown visible change:', visible, taskId);
      // 当dropdown显示时，保持hover状态
      if (visible) {
        this.hoveredTaskNameId = taskId;
      }
    },
    // 判断操作按钮是否可见
    isActionVisible(taskId) {
      return this.visibleActions[taskId] === true
    },

    // 刷新表格数据
    refreshData() {
      // 强制更新表格数据
      this.$forceUpdate();
      // 重新计算虚拟滚动
      this.$nextTick(() => {
        if (this.$refs.tableBody) {
          this.handleScroll({ target: this.$refs.tableBody });
        }
      });
    },

    // 获取任务类型图标
    getTaskTypeIcon(type) {
      switch (type) {
        case 'milestone':
          return 'el-icon-star-on';
        case 'deliverable':
          return 'el-icon-goods';
        default:
          return 'el-icon-document';
      }
    },

    // 判断是否可以添加子任务
    canAddChild(task) {
      // milestone 不能添加子任务
      if (task.type === 'milestone') return false;
      // deliverable 只能添加 task 类型的子任务
      if (task.type === 'deliverable') return true;
      // task 可以添加任何类型的子任务
      return true;
    },

    // 处理任务操作
    handleTaskAction(payload) {
      // 统一处理不同来源的参数格式
      let task, action;

      // 处理直接传入的 action 和 task
      if (arguments.length === 2) {
        action = arguments[0];
        task = arguments[1];
      }
      // 处理对象格式的 payload
      else if (payload && typeof payload === 'object') {
        if (payload.task && payload.action) {
          task = payload.task;
          action = payload.action;
        } else if (payload.command && payload.task) {
          // 兼容旧的参数格式
          task = payload.task;
          action = payload.command;
        }
      }

      // 参数验证
      if (!task || !action) {
        console.warn('处理任务操作: 无效的参数', payload);
        return;
      }

      console.log('处理任务操作:', action, task);

      switch (action) {
        case 'edit':
          this.$emit('edit-task', task);
          break;
        case 'add-sibling':
          // 检查父任务是否允许添加同级任务
          const parentTask = this.findParentTask(task.parentId);
          if (parentTask && parentTask.type === 'milestone') {
            this.$message.warning('里程碑类型下不能添加同级任务');
            return;
          }
          this.$emit('add-sibling-task', task);
          break;
        case 'add-child':
          // 检查是否可以添加子任务
          if (task.type === 'milestone') {
            this.$message.warning('里程碑类型不能添加子任务');
            return;
          }
          this.$emit('add-child-task', task);
          break;
        case 'delete':
          this.$confirm('确定要删除此任务吗？此操作将同时删除所有子任务。', '确认', {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning'
          }).then(() => {
            this.$emit('delete-task', task);
          }).catch(() => {});
          break;
        default:
          console.warn('未知的任务操作:', action);
      }
    },

    // 查找父任务
    findParentTask(parentId) {
      if (!parentId) return null;
      return this.data.find(task => task.id === parentId);
    },
  }
}
</script>
