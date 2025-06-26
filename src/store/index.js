import Vue from 'vue'
import Vuex from 'vuex'
import moment from 'moment'
import {
  getTaskTypeConfig,
  canAddChildTask,
  isRootOnlyType
} from '@/config/features'
import { DEFAULT_DEPENDENCY_TYPE, DEPENDENCY_CALCULATION_CONFIG, isValidDependencyType } from '@/config/dependencyTypes'
import { DependencyConstraintEngine } from '@/services/dependencyConstraints'
import ganttTestData from './gantt-test-data.json' // 引入静态测试数据

Vue.use(Vuex)

// 从 localStorage 获取数据，如果没有则使用测试数据
const getInitialData = () => {
  try {
    const savedData = localStorage.getItem('ganttData')
    if (savedData) {
      const parsedData = JSON.parse(savedData)
      return {
        tasks: parsedData.tasks || ganttTestData.tasks,
        dependencies: parsedData.dependencies || ganttTestData.dependencies
      }
    }
  } catch (error) {
    console.warn('[数据初始化] 从 localStorage 读取数据失败:', error)
  }
  return {
    tasks: ganttTestData.tasks,
    dependencies: ganttTestData.dependencies
  }
}

// 获取初始数据
const initialData = getInitialData()

export default new Vuex.Store({
  state: {
    timelineData: [

    ],
    ganttData: initialData.tasks,
    dependencies: initialData.dependencies,
    dependencyEngine: null, // 添加dependencyEngine字段
    viewMode: 'month', // 'year', 'month', 'day'
    currentDate: moment().format('YYYY-MM-DD'),

    // 任务选择状态
    selectedTasks: [],
    selectAllState: false, // false: 未选, true: 全选, 'indeterminate': 部分选中

    // 任务折叠状态
    collapsedTasks: [],

    // 连接线文字信息
    dependencyLabels: {

    },

    // 左侧面板控制
    leftPanelVisible: true,

    // 连接线灰色模式控制
    grayConnectionMode: false,

    // 依赖关系高亮 - 增强版本
    highlightedConnections: {
      sourceTaskId: null,
      relatedTaskIds: [],
      relatedDependencies: [], // 相关的依赖关系
      isHighlightMode: false,   // 是否处于高亮模式
      upstreamTasks: [],        // 上游任务
      downstreamTasks: []       // 下游任务
    },

    // 今天日期标记
    todayMarker: {
      enabled: true,
      date: moment().format('YYYY-MM-DD')
    },

    // 表格筛选状态 - 新增筛选功能支持
    tableFilters: {},

    // 父子节点时间关联配置
    linkParentChildDates: false,

    // 列配置 - 支持自适应宽度
    columnConfig: [
    ]
  },
  mutations: {
    SET_VIEW_MODE(state, mode) {
      state.viewMode = mode
    },
    SET_GANTT_DATA(state, data) {
      state.ganttData = data || []
    },
    UPDATE_GANTT_ITEM(state, payload) {
      const { id, updates, isParentNode, daysDelta, linkParentChildDates } = payload

      const updateTask = (tasks) => {
        for (const task of tasks) {
          if (task.id === id) {
            // 验证日期逻辑：开始时间不能大于结束时间
            const proposedUpdates = { ...task, ...updates }

            // 如果更新涉及日期字段，进行验证
            if (updates.startDate || updates.endDate) {
              const startDate = moment(proposedUpdates.startDate)
              const endDate = moment(proposedUpdates.endDate)

              if (startDate.isValid() && endDate.isValid() && startDate.isAfter(endDate)) {
                console.warn(`[日期验证] 任务 ${task.name}: 开始时间 ${startDate.format('YYYY-MM-DD')} 不能晚于结束时间 ${endDate.format('YYYY-MM-DD')}`)
                // 自动调整：如果更新了开始时间，将结束时间设为开始时间
                if (updates.startDate && !updates.endDate) {
                  updates.endDate = updates.startDate
                }
                // 如果更新了结束时间且比开始时间早，将开始时间设为结束时间
                else if (updates.endDate && !updates.startDate) {
                  updates.startDate = updates.endDate
                }
                // 如果同时更新了两个日期但顺序错误，保持原有的正确日期
                else {
                  // 抛出错误，阻止错误的更新
                  throw new Error(`开始时间不能晚于结束时间`)
                }
              }
            }

            // 验证计划日期逻辑
            if (updates.planStartDate || updates.planEndDate) {
              const planStartDate = moment(proposedUpdates.planStartDate)
              const planEndDate = moment(proposedUpdates.planEndDate)

              if (planStartDate.isValid() && planEndDate.isValid() && planStartDate.isAfter(planEndDate)) {
                console.warn(`[计划日期验证] 任务 ${task.name}: 计划开始时间不能晚于计划结束时间`)
                // 自动调整计划日期
                if (updates.planStartDate && !updates.planEndDate) {
                  updates.planEndDate = updates.planStartDate
                } else if (updates.planEndDate && !updates.planStartDate) {
                  updates.planStartDate = updates.planEndDate
                } else {
                  throw new Error(`计划开始时间不能晚于计划结束时间`)
                }
              }
            }

            Object.assign(task, updates)

            // 如果更新后的任务是milestone类型，进行规范化
            if (task.type === 'milestone') {
              // 里程碑任务开始和结束日期应该相同
              if (updates.startDate && updates.startDate !== task.endDate) {
                // 修改了startDate，同步endDate
                task.endDate = updates.startDate
              } else if (updates.endDate && updates.endDate !== task.startDate) {
                // 修改了endDate，同步startDate
                task.startDate = updates.endDate
              } else if (task.startDate && !task.endDate) {
                task.endDate = task.startDate
              } else if (task.endDate && !task.startDate) {
                task.startDate = task.endDate
              } else if (task.startDate && task.endDate && task.startDate !== task.endDate) {
                // 如果开始和结束日期不同，优先使用更新的字段
                if (updates.startDate) {
                  task.endDate = task.startDate
                } else if (updates.endDate) {
                  task.startDate = task.endDate
                } else {
                  // 默认使用开始日期
                  task.endDate = task.startDate
                }
              }

              // 里程碑任务通常表示完成状态
              if (task.progress === undefined || task.progress === null) {
                task.progress = 100
              }
            }

            // 自动计算并更新Duration字段
            if (task.startDate && task.endDate) {
              const startMoment = moment(task.startDate)
              const endMoment = moment(task.endDate)
              if (startMoment.isValid() && endMoment.isValid()) {
                task.duration = endMoment.diff(startMoment, 'days') + 1 // 包含首尾日期
              }
            }

            // 根据配置决定是否同步父子节点时间
            // 只有当 linkParentChildDates 为 true 且是父节点拖拽时才同步子节点
            if (isParentNode && daysDelta !== undefined && task.children && linkParentChildDates) {
              console.log(`[父子时间关联] 父节点 ${task.name} 移动 ${daysDelta} 天，开始同步子节点`)

              const moveChildren = (children, depth = 1) => {
                children.forEach(child => {
                  const childStartDate = moment(child.startDate).add(daysDelta, 'days')
                  const childEndDate = moment(child.endDate).add(daysDelta, 'days')

                  console.log(`  ${'  '.repeat(depth)}移动子节点: ${child.name}`)
                  console.log(`  ${'  '.repeat(depth)}原日期: ${child.startDate} - ${child.endDate}`)
                  console.log(`  ${'  '.repeat(depth)}新日期: ${childStartDate.format('YYYY-MM-DD')} - ${childEndDate.format('YYYY-MM-DD')}`)

                  // 更新子节点日期
                  child.startDate = childStartDate.format('YYYY-MM-DD')
                  child.endDate = childEndDate.format('YYYY-MM-DD')

                  // 如果有计划日期，也要同步移动
                  if (child.planStartDate) {
                    child.planStartDate = moment(child.planStartDate).add(daysDelta, 'days').format('YYYY-MM-DD')
                  }
                  if (child.planEndDate) {
                    child.planEndDate = moment(child.planEndDate).add(daysDelta, 'days').format('YYYY-MM-DD')
                  }

                  // 重新计算子节点duration
                  if (child.startDate && child.endDate) {
                    const childStart = moment(child.startDate)
                    const childEnd = moment(child.endDate)
                    if (childStart.isValid() && childEnd.isValid()) {
                      child.duration = childEnd.diff(childStart, 'days') + 1
                    }
                  }

                  // 递归处理子节点的子节点
                  if (child.children && child.children.length > 0) {
                    moveChildren(child.children, depth + 1)
                  }
                })
              }

              moveChildren(task.children)
              console.log(`[父子时间关联] 父节点 ${task.name} 及其所有子节点移动完成`)
            }

            return true
          }
          if (task.children && task.children.length > 0) {
            if (updateTask(task.children)) {
              return true
            }
          }
        }
        return false
      }

      updateTask(state.ganttData)
    },
    ADD_DEPENDENCY(state, dependency) {
      const exists = state.dependencies.find(dep =>
        dep.from === dependency.from && dep.to === dependency.to
      )
      if (!exists) {
        // 创建新的依赖关系，设置默认值
        const newDependency = {
          from: dependency.from,
          to: dependency.to,
          color: dependency.color || '#666',
          type: dependency.type && isValidDependencyType(dependency.type) ? dependency.type : DEFAULT_DEPENDENCY_TYPE,
          lag: typeof dependency.lag === 'number' ? dependency.lag : DEPENDENCY_CALCULATION_CONFIG.defaultLag,
          // 可选字段
          label: dependency.label || '',
          fromPoint: dependency.fromPoint || null, // 连接点类型（会根据type自动计算）
          toPoint: dependency.toPoint || null
        }
        state.dependencies.push(newDependency)
        // 更新依赖约束引擎
        if (state.dependencyEngine) {
          state.dependencyEngine = new DependencyConstraintEngine(state.ganttData, state.dependencies)
        }
      }
    },
    REMOVE_DEPENDENCY(state, { from, to }) {
      const index = state.dependencies.findIndex(dep =>
        dep.from === from && dep.to === to
      )
      if (index > -1) {
        state.dependencies.splice(index, 1)
        // 更新依赖约束引擎
        if (state.dependencyEngine) {
          state.dependencyEngine = new DependencyConstraintEngine(state.ganttData, state.dependencies)
        }
      }

      const labelKey = `${from}_${to}`
      Vue.delete(state.dependencyLabels, labelKey)
    },
    // 任务选择相关
    TOGGLE_TASK_SELECTION(state, taskId) {
      // 防止undefined错误：确保selectedTasks数组存在
      if (!Array.isArray(state.selectedTasks)) {
        console.warn('TOGGLE_TASK_SELECTION: selectedTasks不是数组，重新初始化')
        state.selectedTasks = []
      }

      const index = state.selectedTasks.indexOf(taskId)
      if (index > -1) {
        state.selectedTasks.splice(index, 1)
      } else {
        state.selectedTasks.push(taskId)
      }
    },
    SET_TASK_SELECTION(state, { taskId, selected }) {
      // 防止undefined错误：确保selectedTasks数组存在
      if (!Array.isArray(state.selectedTasks)) {
        console.warn('SET_TASK_SELECTION: selectedTasks不是数组，重新初始化')
        state.selectedTasks = []
      }

      const index = state.selectedTasks.indexOf(taskId)
      if (selected && index === -1) {
        state.selectedTasks.push(taskId)
      } else if (!selected && index > -1) {
        state.selectedTasks.splice(index, 1)
      }
    },
    SELECT_ALL_TASKS(state, allTaskIds) {
      state.selectedTasks = [...allTaskIds]
      state.selectAllState = true
    },
    DESELECT_ALL_TASKS(state) {
      state.selectedTasks = []
      state.selectAllState = false
    },
    UPDATE_SELECT_ALL_STATE(state, allTaskIds) {
      const selectedCount = state.selectedTasks.length
      const totalCount = allTaskIds.length

      if (selectedCount === 0) {
        state.selectAllState = false
      } else if (selectedCount === totalCount) {
        state.selectAllState = true
      } else {
        state.selectAllState = 'indeterminate'
      }
    },
    // 任务折叠相关
    TOGGLE_TASK_COLLAPSED(state, taskId) {
      // 防止undefined错误：确保collapsedTasks数组存在
      if (!Array.isArray(state.collapsedTasks)) {
        console.warn('TOGGLE_TASK_COLLAPSED: collapsedTasks不是数组，重新初始化')
        state.collapsedTasks = []
      }

      const index = state.collapsedTasks.indexOf(taskId)
      if (index > -1) {
        state.collapsedTasks.splice(index, 1)
      } else {
        state.collapsedTasks.push(taskId)
      }
    },
    // 连接线相关
    UPDATE_DEPENDENCY_LABEL(state, { from, to, label }) {
      const key = `${from}_${to}`
      Vue.set(state.dependencyLabels, key, label)
    },
    UPDATE_DEPENDENCY_COLOR(state, { from, to, color }) {
      const dependency = state.dependencies.find(dep =>
        dep.from === from && dep.to === to
      )
      if (dependency) {
        Vue.set(dependency, 'color', color)
      }
    },
    // 新增：更新依赖关系类型
    UPDATE_DEPENDENCY_TYPE(state, { from, to, type }) {
      const dependency = state.dependencies.find(dep =>
        dep.from === from && dep.to === to
      )
      if (dependency && isValidDependencyType(type)) {
        Vue.set(dependency, 'type', type)
        // 更新依赖约束引擎
        if (state.dependencyEngine) {
          state.dependencyEngine = new DependencyConstraintEngine(state.ganttData, state.dependencies)
        }
      }
    },
    // 新增：更新依赖关系lag值
    UPDATE_DEPENDENCY_LAG(state, { from, to, lag }) {
      const dependency = state.dependencies.find(dep =>
        dep.from === from && dep.to === to
      )
      if (dependency && typeof lag === 'number') {
        // 验证lag值范围
        const validLag = Math.max(
          DEPENDENCY_CALCULATION_CONFIG.lagRange.min,
          Math.min(DEPENDENCY_CALCULATION_CONFIG.lagRange.max, lag)
        )
        Vue.set(dependency, 'lag', validLag)
        // 更新依赖约束引擎
        if (state.dependencyEngine) {
          state.dependencyEngine = new DependencyConstraintEngine(state.ganttData, state.dependencies)
        }
      }
    },
    // 批量更新依赖关系属性
    UPDATE_DEPENDENCY_FULL(state, { from, to, updates }) {
      console.log('[Store] 开始更新依赖关系:', { from, to, updates });

      // 1. 查找依赖关系
      const dependencyIndex = state.dependencies.findIndex(dep =>
        dep.from === from && dep.to === to
      );

      if (dependencyIndex !== -1) {
        // 2. 获取原始依赖关系
        const oldDependency = state.dependencies[dependencyIndex];
        const oldState = { ...oldDependency };

        // 3. 创建新的依赖关系对象
        const newDependency = { ...oldDependency };

        // 4. 更新允许的字段
        const allowedFields = ['color', 'type', 'lag', 'label'];
        let hasUpdates = false;

        allowedFields.forEach(field => {
          if (updates.hasOwnProperty(field)) {
            let value = updates[field];

            // 字段验证
            if (field === 'type' && !isValidDependencyType(value)) {
              console.warn(`[Store] 无效的依赖类型: ${value}`);
              return;
            }
            if (field === 'lag') {
              value = parseInt(value) || 0;
              value = Math.max(
                DEPENDENCY_CALCULATION_CONFIG.lagRange.min,
                Math.min(DEPENDENCY_CALCULATION_CONFIG.lagRange.max, value)
              );
            }

            // 使用Vue.set更新单个字段以确保响应式
            Vue.set(newDependency, field, value);
            hasUpdates = true;
          }
        });

        if (hasUpdates) {
          console.log('[Store] 依赖关系更新前:', oldState);
          console.log('[Store] 依赖关系更新后:', newDependency);

          // 5. 使用Vue.set更新整个依赖关系对象
          Vue.set(state.dependencies, dependencyIndex, newDependency);

          // 6. 强制更新依赖关系数组以触发响应式
          state.dependencies = [...state.dependencies];

          // 7. 重新初始化依赖约束引擎
          Vue.nextTick(() => {
            state.dependencyEngine = new DependencyConstraintEngine(state.ganttData, state.dependencies);

            // 8. 触发全局事件
            window.dispatchEvent(new CustomEvent('dependency-updated', {
              detail: {
                from,
                to,
                updates: newDependency,
                source: 'UPDATE_DEPENDENCY_FULL'
              }
            }));

            // 9. 保存到 localStorage
            try {
              localStorage.setItem('ganttData', JSON.stringify({
                tasks: state.ganttData,
                dependencies: state.dependencies
              }));
            } catch (error) {
              console.error('[Store] 保存到 localStorage 失败:', error);
            }
          });
        } else {
          console.log('[Store] 无有效更新');
        }
      } else {
        console.warn(`[Store] 未找到依赖关系: ${from} -> ${to}`);
      }
    },
    // 任务管理
    ADD_NEW_TASK(state, { task, parentId }) {
      if (parentId) {
        // 添加到指定父任务下
        const addToParent = (tasks) => {
          for (const parent of tasks) {
            if (parent.id === parentId) {
              if (!parent.children) {
                Vue.set(parent, 'children', [])
              }
              parent.children.push(task)
              return true
            }
            if (parent.children && addToParent(parent.children)) {
              return true
            }
          }
          return false
        }
        addToParent(state.ganttData)
      } else {
        // 添加到根级别
        state.ganttData.push({
          id: task.id,
          name: task.name,
          children: [task]
        })
      }
    },
    DELETE_TASK(state, taskId) {
      // 收集要删除的所有任务ID（包括子任务）
      const tasksToDelete = new Set()

      // 递归收集任务及其所有子任务的ID
      const collectTaskIds = (task) => {
        if (!task) return
        tasksToDelete.add(task.id)
        if (task.children && Array.isArray(task.children)) {
          task.children.forEach(child => collectTaskIds(child))
        }
      }

      // 查找并收集要删除的任务
      const findAndCollectTask = (tasks) => {
        if (!Array.isArray(tasks)) return false

        for (let i = 0; i < tasks.length; i++) {
          const task = tasks[i]

          // 如果是根级任务本身
          if (task.id === taskId) {
            collectTaskIds(task)
            tasks.splice(i, 1)
            return true
          }

          // 如果是子任务
          if (task.children && Array.isArray(task.children)) {
            for (let j = 0; j < task.children.length; j++) {
              if (task.children[j].id === taskId) {
                collectTaskIds(task.children[j])
                task.children.splice(j, 1)

                // 如果父任务没有子任务了，删除整个父任务组
                if (task.children.length === 0) {
                  tasks.splice(i, 1)
                }
                return true
              }
            }

            // 递归查找更深层的子任务
            if (findAndCollectTask(task.children)) {
              return true
            }
          }
        }
        return false
      }

      findAndCollectTask(state.ganttData)

      // 删除所有相关的依赖关系
      state.dependencies = state.dependencies.filter(dep =>
        !tasksToDelete.has(dep.from) && !tasksToDelete.has(dep.to)
      )

      // 删除所有相关的标签
      const labelsToDelete = Object.keys(state.dependencyLabels).filter(key => {
        const [fromId, toId] = key.split('_')
        return tasksToDelete.has(parseInt(fromId)) || tasksToDelete.has(parseInt(toId))
      })
      labelsToDelete.forEach(key => {
        Vue.delete(state.dependencyLabels, key)
      })

      // 从选中列表中移除所有被删除的任务
      if (!Array.isArray(state.selectedTasks)) {
        console.warn('DELETE_TASK: selectedTasks不是数组，重新初始化')
        state.selectedTasks = []
      }

      state.selectedTasks = state.selectedTasks.filter(id => !tasksToDelete.has(id))

      // 从折叠列表中移除所有被删除的任务
      if (!Array.isArray(state.collapsedTasks)) {
        console.warn('DELETE_TASK: collapsedTasks不是数组，重新初始化')
        state.collapsedTasks = []
      }

      state.collapsedTasks = state.collapsedTasks.filter(id => !tasksToDelete.has(id))
    },

    // 左侧面板控制
    TOGGLE_LEFT_PANEL(state) {
      state.leftPanelVisible = !state.leftPanelVisible
    },

    SET_LEFT_PANEL_VISIBLE(state, visible) {
      state.leftPanelVisible = visible
    },

    // 列配置管理
    UPDATE_COLUMN_CONFIG(state, newConfig) {
      state.columnConfig = newConfig
    },

    UPDATE_COLUMN_VISIBILITY(state, { id, visible }) {
      const column = state.columnConfig.find(col => col.id === id)
      if (column) {
        column.visible = visible
      }
    },

    UPDATE_COLUMN_ORDER(state, { oldIndex, newIndex }) {
      const column = state.columnConfig.splice(oldIndex, 1)[0]
      state.columnConfig.splice(newIndex, 0, column)

      // 重新设置order
      state.columnConfig.forEach((col, index) => {
        col.order = index
      })
    },

    UPDATE_COLUMN_WIDTH(state, { id, width }) {
      const column = state.columnConfig.find(col => col.id === id)
      if (column) {
        column.width = width
      }
    },

    // 设置血缘关系高亮 - 增强版本
    SET_LINEAGE_HIGHLIGHT(state, { sourceTaskId }) {
      if (!sourceTaskId) {
        state.highlightedConnections = {
          sourceTaskId: null,
          relatedTaskIds: [],
          relatedDependencies: [],
          isHighlightMode: false,
          upstreamTasks: [],
          downstreamTasks: []
        }
        return
      }

      // 找到所有上游任务（递归）
      const findUpstreamTasks = (taskId, visited = new Set()) => {
        if (visited.has(taskId)) return []
        visited.add(taskId)

        const upstream = []
        state.dependencies.forEach(dep => {
          if (dep.to === taskId) {
            upstream.push(dep.from)
            upstream.push(...findUpstreamTasks(dep.from, visited))
          }
        })
        return [...new Set(upstream)]
      }

      // 找到所有下游任务（递归）
      const findDownstreamTasks = (taskId, visited = new Set()) => {
        if (visited.has(taskId)) return []
        visited.add(taskId)

        const downstream = []
        state.dependencies.forEach(dep => {
          if (dep.from === taskId) {
            downstream.push(dep.to)
            downstream.push(...findDownstreamTasks(dep.to, visited))
          }
        })
        return [...new Set(downstream)]
      }

      const upstreamTasks = findUpstreamTasks(sourceTaskId)
      const downstreamTasks = findDownstreamTasks(sourceTaskId)
      const allRelatedTasks = [sourceTaskId, ...upstreamTasks, ...downstreamTasks]

      // 找到所有相关的依赖关系
      const relatedDependencies = state.dependencies.filter(dep =>
        allRelatedTasks.includes(dep.from) && allRelatedTasks.includes(dep.to)
      )

      state.highlightedConnections = {
        sourceTaskId,
        relatedTaskIds: allRelatedTasks,
        relatedDependencies,
        isHighlightMode: true,
        upstreamTasks,
        downstreamTasks
      }
    },

    // 清除血缘关系高亮
    CLEAR_LINEAGE_HIGHLIGHT(state) {
      state.highlightedConnections = {
        sourceTaskId: null,
        relatedTaskIds: [],
        relatedDependencies: [],
        isHighlightMode: false,
        upstreamTasks: [],
        downstreamTasks: []
      }
    },

    // 今天标记相关
    SET_TODAY_MARKER(state, enabled) {
      state.todayMarker.enabled = enabled
      state.todayMarker.date = moment().format('YYYY-MM-DD')
    },

    JUMP_TO_TODAY(state) {
      state.currentDate = moment().format('YYYY-MM-DD')
      state.todayMarker.date = moment().format('YYYY-MM-DD')
    },

    UPDATE_CURRENT_DATE(state, date) {
      state.currentDate = date
    },

    // 设置连接高亮
    SET_CONNECTION_HIGHLIGHT(state, { sourceTaskId, relatedTaskIds }) {
      state.highlightedConnections = {
        sourceTaskId,
        relatedTaskIds
      }
    },

    // 清除连接高亮
    CLEAR_CONNECTION_HIGHLIGHT(state) {
      state.highlightedConnections = {
        sourceTaskId: null,
        relatedTaskIds: []
      }
    },

    ADD_TASK_WITH_PARENT(state, { task, parentTask, newParentTask, insertPosition }) {
      if (newParentTask) {
        // 创建新的父级任务组
        newParentTask.children = [task]
        state.ganttData.push(newParentTask)
      } else if (parentTask) {
        // 添加到现有父级任务
        if (!parentTask.children) {
          Vue.set(parentTask, 'children', [])
        }

        // 如果有指定插入位置，则插入到指定位置，否则追加到末尾
        if (insertPosition && insertPosition.insertIndex !== undefined) {
          parentTask.children.splice(insertPosition.insertIndex, 0, task)
        } else {
          parentTask.children.push(task)
        }
      } else if (insertPosition && insertPosition.parentGroup) {
        // 同级任务插入到指定组的指定位置
        if (!insertPosition.parentGroup.children) {
          Vue.set(insertPosition.parentGroup, 'children', [])
        }
        insertPosition.parentGroup.children.splice(insertPosition.insertIndex, 0, task)
      } else {
        // 添加为独立的根级任务组
        const rootTask = {
          id: Date.now() + Math.floor(Math.random() * 10000),
          name: `${task.name  } Group`,
          children: [task],
          level: 0,
          color: task.color,
          isParentNode: true
        }
        state.ganttData.push(rootTask)
      }
    },

    SET_COLLAPSED_TASKS(state, tasks) {
      state.collapsedTasks = Array.isArray(tasks) ? tasks : []
    },

    // 设置连接线灰色模式
    SET_GRAY_CONNECTION_MODE(state, grayMode) {
      state.grayConnectionMode = grayMode
    },

    // 验证任务类型规则
    VALIDATE_TASK_TYPE(state, { taskType, parentType, isRoot }) {
      // 获取任务类型配置
      const config = getTaskTypeConfig(taskType)
      if (!config) {
        throw new Error(`未知的任务类型: ${taskType}`)
      }

      // 1. Milestone类型规则
      if (taskType === 'milestone') {
        // Milestone只能是根节点
        if (!isRoot) {
          throw new Error('Milestone类型只能作为根级任务')
        }
        // Milestone不能有子节点
        if (parentType) {
          throw new Error('Milestone类型不能作为子任务')
        }
      }

      // 2. Deliverable类型规则
      if (taskType === 'deliverable') {
        // Deliverable只能是根节点
        if (!isRoot) {
          throw new Error('Deliverable类型只能作为根级任务')
        }
      }

      // 3. Task类型规则
      if (taskType === 'task') {
        // Task可以是根节点，也可以是子节点
        // 不需要特殊限制
      }

      // 4. 父任务类型规则
      if (parentType) {
        switch (parentType) {
          case 'milestone':
            throw new Error('Milestone类型不能添加子任务')
          case 'deliverable':
          case 'task':
            // Deliverable和Task类型可以添加子任务，但子任务只能是Task类型
            if (taskType !== 'task') {
              throw new Error(`${parentType}类型只能添加Task类型的子任务`)
            }
            break
          default:
            throw new Error(`未知的父任务类型: ${parentType}`)
        }
      }
    },

    // 设置表格筛选状态 - 新增筛选功能
    SET_TABLE_FILTERS(state, filters) {
      state.tableFilters = filters || {}
    },

    // 设置父子节点时间关联配置
    SET_LINK_PARENT_CHILD_DATES(state, linkParentChildDates) {
      state.linkParentChildDates = linkParentChildDates
    },

    // 设置依赖关系数组
    SET_DEPENDENCIES(state, dependencies) {
      console.log('[Store] 开始更新依赖关系数组');
      // 1. 更新依赖关系数组
      state.dependencies = dependencies || [];
      console.log('[Store] 依赖关系数组已更新:', state.dependencies.length);

      // 2. 更新依赖约束引擎
      try {
        if (state.dependencyEngine) {
          state.dependencyEngine = new DependencyConstraintEngine(state.ganttData, state.dependencies);
          console.log('[Store] 依赖约束引擎已更新');
        } else {
          state.dependencyEngine = new DependencyConstraintEngine(state.ganttData, state.dependencies);
          console.log('[Store] 依赖约束引擎已初始化');
        }
      } catch (error) {
        console.error('[Store] 更新依赖约束引擎失败:', error);
      }

      // 3. 触发视图更新
      Vue.nextTick(() => {
        try {
          // 强制更新依赖关系相关的计算属性
          if (state.highlightedConnections.isHighlightMode) {
            const sourceTaskId = state.highlightedConnections.sourceTaskId;
            if (sourceTaskId) {
              // 重新计算高亮状态
              const relatedDeps = state.dependencies.filter(dep =>
                dep.from === sourceTaskId || dep.to === sourceTaskId
              );
              state.highlightedConnections.relatedDependencies = relatedDeps;
              console.log('[Store] 已更新高亮依赖关系:', relatedDeps.length);
            }
          }
        } catch (error) {
          console.error('[Store] 更新高亮状态失败:', error);
        }
      });
      console.log('[Store] 依赖关系更新完成');
    },

    // 规范化milestone任务：确保开始和结束日期相同，进度为100%
    NORMALIZE_MILESTONE_TASK(state, task) {
      if (task.type === 'milestone') {
        // 里程碑任务开始和结束日期应该相同
        if (task.startDate && !task.endDate) {
          task.endDate = task.startDate
        } else if (task.endDate && !task.startDate) {
          task.startDate = task.endDate
        } else if (task.startDate && task.endDate && task.startDate !== task.endDate) {
          // 如果开始和结束日期不同，使用开始日期
          task.endDate = task.startDate
        }

        // 里程碑任务通常表示完成状态
        if (task.progress === undefined || task.progress === null) {
          task.progress = 100
        }
      }
    },

    // 处理任务时间变更并级联更新
    UPDATE_TASK_DATES(state, { id, startDate, endDate }) {
      const task = state.ganttData.find(t => t.id === id)
      if (task) {
        task.startDate = startDate
        task.endDate = endDate
      }
    },

    // 处理依赖关系属性变更
    UPDATE_DEPENDENCY_PROPERTIES(state, { from, to, type, lag }) {
      const dependency = state.dependencies.find(dep =>
        dep.from === from && dep.to === to
      )
      if (dependency) {
        dependency.type = type
        dependency.lag = lag
      }
    },

    // 初始化依赖约束引擎
    INIT_DEPENDENCY_ENGINE(state) {
      console.log('[Store] 开始初始化依赖约束引擎');

      // 1. 初始化依赖约束引擎
      state.dependencyEngine = new DependencyConstraintEngine(state.ganttData, state.dependencies);

      // 2. 触发全局事件
      window.dispatchEvent(new CustomEvent('dependency-updated', {
        detail: { source: 'INIT_DEPENDENCY_ENGINE' }
      }));

      console.log('[Store] 依赖约束引擎初始化完成');
    },

    // 更新依赖约束引擎
    UPDATE_DEPENDENCY_ENGINE(state) {
      console.log('[Store] 开始更新依赖约束引擎');

      // 1. 更新依赖约束引擎
      state.dependencyEngine = new DependencyConstraintEngine(state.ganttData, state.dependencies);
      console.log('[Store] 依赖约束引擎已更新');

      // 2. 强制更新依赖关系数组，触发响应式更新
      state.dependencies = [...state.dependencies];
      console.log('[Store] 依赖关系数组已更新');

      // 3. 确保视图更新
      Vue.nextTick(() => {
        // 4. 再次更新依赖约束引擎
        state.dependencyEngine = new DependencyConstraintEngine(state.ganttData, state.dependencies);
        console.log('[Store] 依赖约束引擎已二次更新');

        // 5. 再次强制更新依赖关系数组
        state.dependencies = [...state.dependencies];
        console.log('[Store] 依赖关系数组已二次更新');

        // 6. 最后一次更新
        Vue.nextTick(() => {
          // 7. 最后一次更新依赖约束引擎
          state.dependencyEngine = new DependencyConstraintEngine(state.ganttData, state.dependencies);
          console.log('[Store] 依赖约束引擎已最终更新');

          // 8. 最后一次强制更新依赖关系数组
          state.dependencies = [...state.dependencies];
          console.log('[Store] 依赖关系数组已最终更新');
        });
      });
    },

    RESET_TO_TEST_DATA(state) {
      console.log('[数据重置] 开始重置到测试数据');
      try {
        // 1. 重置为测试数据
        state.ganttData = ganttTestData.tasks;
        state.dependencies = ganttTestData.dependencies;

        // 2. 清除 localStorage
        localStorage.removeItem('ganttData');
        console.log('[数据重置] localStorage 已清除');

        // 3. 重新初始化依赖约束引擎
        if (state.dependencyEngine) {
          state.dependencyEngine = new DependencyConstraintEngine(state.ganttData, state.dependencies);
          console.log('[数据重置] 依赖约束引擎已重置');
        }

        // 4. 等待下一个 tick
        Vue.nextTick(async () => {
          try {
            // 5. 强制更新
            state.dependencies = [...state.dependencies];
            console.log('[数据重置] 视图已更新');

            // 6. 触发全局事件
            window.dispatchEvent(new CustomEvent('dependency-updated'));
            console.log('[数据重置] 重置完成');
          } catch (error) {
            console.error('[数据重置] 更新过程中出错:', error);
          }
        });
      } catch (error) {
        console.error('[数据重置] 重置失败:', error);
      }
    },
  },
  actions: {
    setViewMode({ commit }, mode) {
      commit('SET_VIEW_MODE', mode)
    },
    updateGanttItem({ commit }, payload) {
      commit('UPDATE_GANTT_ITEM', payload)
    },
    addDependency({ commit }, dependency) {
      commit('ADD_DEPENDENCY', dependency)
    },

    // 处理任务时间变更并级联更新
    async handleTaskTimeChange({ commit, state, dispatch }, { taskId, newStartDate, newEndDate, source }) {
      console.log(`[依赖约束] 处理任务 ${taskId} 时间变更，来源: ${source}`)
      console.log(`[依赖约束] 新时间范围: ${newStartDate} ~ ${newEndDate}`)

      // 获取原始任务状态
      const findTaskInTree = (tasks, targetId) => {
        for (const task of tasks) {
          if (task.id === targetId) {
            return task;
          }
          if (task.children && task.children.length > 0) {
            const found = findTaskInTree(task.children, targetId);
            if (found) {
              return found;
            }
          }
        }
        return null;
      };

      const originalTask = findTaskInTree(state.ganttData, taskId);
      if (!originalTask) {
        console.error(`[依赖约束] 无法找到任务 ${taskId}`);
        return { updated: [], cascaded: false, error: new Error(`无法找到任务 ${taskId}`) };
      }

      // 备份原始状态
      const originalState = {
        startDate: originalTask.startDate,
        endDate: originalTask.endDate
      };

      // 更新当前任务
      commit('UPDATE_TASK_DATES', { id: taskId, startDate: newStartDate, endDate: newEndDate })

      // 检查级联更新
      try {
        // 使用相对路径导入
        const { createDependencyEngine } = await import('../services/dependencyConstraints')
        const engine = createDependencyEngine(state.ganttData, state.dependencies)

        // 检查是否需要级联更新
        if (!engine.checkNeedsCascadeUpdate(taskId)) {
          console.log('[依赖约束] 任务无依赖关系，无需级联更新')
          return { updated: [taskId], cascaded: false }
        }

        // 获取受影响的后续任务
        const affectedSuccessorTasks = engine.getAffectedTasksPreview(taskId, newStartDate, newEndDate)
        console.log(`[依赖约束] 发现 ${affectedSuccessorTasks.length} 个后续任务受影响`, affectedSuccessorTasks)

        // 获取受影响的前置任务
        const affectedPredecessorTasks = engine.getAffectedPredecessorTasksPreview(taskId, newStartDate, newEndDate)
        console.log(`[依赖约束] 发现 ${affectedPredecessorTasks.length} 个前置任务受影响`, affectedPredecessorTasks)

        // 合并所有受影响的任务
        let allAffectedTasks = [...affectedPredecessorTasks, ...affectedSuccessorTasks]

        // 检查并去重（可能存在同一个任务既是前置又是后续的情况）
        const uniqueTaskIds = new Set()
        const uniqueAffectedTasks = allAffectedTasks.filter(task => {
          if (uniqueTaskIds.has(task.taskId)) {
            console.log(`[依赖约束] 任务 ${task.taskId} 在影响列表中重复，保留第一次出现`)
            return false
          }
          uniqueTaskIds.add(task.taskId)
          return true
        })

        console.log(`[依赖约束] 合并后共 ${uniqueAffectedTasks.length} 个唯一任务受影响`)

        if (uniqueAffectedTasks.length === 0) {
          console.log('[依赖约束] 无任务受到影响，无需级联更新')
          return { updated: [taskId], cascaded: false }
        }

        console.log(`[依赖约束] 总计 ${uniqueAffectedTasks.length} 个任务受影响`, uniqueAffectedTasks)

        // 显示确认对话框
        try {
          // 构建受影响任务的描述文本
          const taskDescriptions = uniqueAffectedTasks.map(task => {
            const currentRange = `${task.currentStart} ~ ${task.currentEnd}`
            const newRange = `${task.newStart} ~ ${task.newEnd}`
            return `• ${task.taskName}: ${currentRange} → ${newRange} (${task.dependencyType} ${task.lag > 0 ? '+' : ''}${task.lag}d)`
          }).join('\n')

          const message = `检测到以下 ${uniqueAffectedTasks.length} 个任务需要根据依赖关系更新时间：\n\n${taskDescriptions}\n\n是否立即更新这些任务的时间安排？`

          // 使用 ElementUI 的确认对话框
          await Vue.prototype.$confirm(message, '级联更新确认', {
            confirmButtonText: '立即更新',
            cancelButtonText: '取消',
            type: 'warning',
            customClass: 'cascade-update-confirm-dialog'
          })

          console.log('[依赖约束] 用户确认了级联更新，开始执行...')

          // 用户确认，执行级联更新
          const updateResults = await dispatch('executeCascadeUpdate', { affectedTasks: uniqueAffectedTasks, source })
          console.log('[依赖约束] 级联更新执行完成，结果:', updateResults)

          // 通知用户更新成功
          Vue.prototype.$message.success(`已成功更新 ${updateResults.length} 个相关任务`)

          return { updated: [taskId, ...updateResults.map(r => r.id)], cascaded: true }
        } catch (error) {
          if (error === 'cancel') {
            console.log('[依赖约束] 用户取消了级联更新')
            Vue.prototype.$message.info('已取消级联更新')
            // 恢复原始位置
            commit('UPDATE_GANTT_ITEM', {
              id: taskId,
              updates: originalState
            })
          } else {
            console.error('[依赖约束] 确认弹框异常:', error)
          }
          return { updated: [taskId], cascaded: false, canceled: true }
        }
      } catch (error) {
        console.error('[依赖约束] 级联更新检查失败:', error)
        return { updated: [taskId], cascaded: false, error }
      }
    },

    // 执行级联更新
    async executeCascadeUpdate({ commit }, { affectedTasks, source }) {
      console.log(`[级联更新] 开始执行级联更新，共 ${affectedTasks.length} 个任务受影响，来源: ${source}`)

      try {
        // 按照深度排序，确保依赖链上游的任务先更新
        const sortedTasks = [...affectedTasks].sort((a, b) => (a.depth || 0) - (b.depth || 0))
        console.log(`[级联更新] 已排序的更新队列:`, sortedTasks.map(t => ({
          taskId: t.taskId,
          taskName: t.taskName,
          currentStart: t.currentStart,
          currentEnd: t.currentEnd,
          newStart: t.newStart,
          newEnd: t.newEnd,
          depth: t.depth
        })))

        // 批量更新任务
        const updates = sortedTasks.map(task => ({
          id: task.taskId,
          startDate: task.newStart,
          endDate: task.newEnd,
          reason: `${task.dependencyType} dependency with ${task.lag}d lag`
        }))

        // 应用更新 - 使用 UPDATE_GANTT_ITEM 替代 UPDATE_TASK_DATES
        updates.forEach(update => {
          console.log(`[级联更新] 更新任务 ${update.id}: ${update.startDate} ~ ${update.endDate}`)
          commit('UPDATE_GANTT_ITEM', {
            id: update.id,
            updates: {
              startDate: update.startDate,
              endDate: update.endDate
            }
          })
        })

        console.log(`[级联更新] 级联更新完成，共更新 ${updates.length} 个任务`)
        return updates
      } catch (error) {
        console.error('[级联更新] 执行级联更新时发生错误:', error)
        throw error // 重新抛出错误，让上层处理
      }
    },

    // 处理依赖关系属性变更
    async handleDependencyPropertyChange({ state, commit, dispatch }, {
      from,
      to,
      oldType,
      newType,
      oldLag,
      newLag,
      source = 'dependency-property-change'
    }) {
      console.log('[依赖约束] 处理依赖属性变更:', {
        from,
        to,
        oldType,
        newType,
        oldLag,
        newLag,
        source
      });

      try {
        // 确保依赖约束引擎已初始化
        if (!state.dependencyEngine) {
          console.log('[依赖约束] 依赖约束引擎未初始化，正在初始化...')
          commit('INIT_DEPENDENCY_ENGINE')
        }

        // 获取相关任务
        const findTaskInTree = (tasks, targetId) => {
          for (const task of tasks) {
            if (task.id === targetId) {
              return task;
            }
            if (task.children && task.children.length > 0) {
              const found = findTaskInTree(task.children, targetId);
              if (found) {
                return found;
              }
            }
          }
          return null;
        };

        const fromTask = findTaskInTree(state.ganttData, from);
        const toTask = findTaskInTree(state.ganttData, to);

        if (!fromTask || !toTask) {
          throw new Error(`无法找到相关任务: ${!fromTask ? '源任务' : '目标任务'} ${!fromTask ? from : to} 不存在`);
        }

        // 检查是否需要级联更新
        const { needsUpdate, affectedTasks } = state.dependencyEngine.checkDependencyPropertyUpdate(
          from,
          to,
          oldType,
          newType,
          oldLag,
          newLag
        );

        if (needsUpdate && affectedTasks.length > 0) {
          // 构建提示消息
          const message = `修改依赖关系属性将影响 ${affectedTasks.length} 个相关任务的时间范围，是否继续？\n\n受影响的任务：\n${affectedTasks.map(t => `- ${t.name}`).join('\n')}`;

          // 使用 ElementUI 的确认对话框
          await Vue.prototype.$confirm(message, '依赖关系变更确认', {
            confirmButtonText: '立即更新',
            cancelButtonText: '取消',
            type: 'warning',
            customClass: 'cascade-update-confirm-dialog'
          });

          console.log('[依赖约束] 用户确认了依赖关系变更级联更新，开始执行...');

          // 用户确认，执行级联更新
          const updateResults = await dispatch('executeCascadeUpdate', {
            affectedTasks,
            source: 'dependency-property-change'
          });

          console.log('[依赖约束] 级联更新执行完成，结果:', updateResults);

          // 通知用户更新成功
          Vue.prototype.$message.success(`已成功更新 ${updateResults.length} 个相关任务`);

          return { updated: updateResults.map(r => r.id), cascaded: true };
        } else {
          console.log('[依赖约束] 依赖属性变更无需级联更新');
          return { updated: [], cascaded: false };
        }
      } catch (error) {
        if (error === 'cancel') {
          console.log('[依赖约束] 用户取消了依赖关系变更');
          throw error;
        } else {
          console.error('[依赖约束] 处理依赖属性变更失败:', error);
          throw new Error('处理依赖属性变更失败: ' + error.message);
        }
      }
    },

    // 任务选择相关
    toggleTaskSelection({ commit, getters }, taskId) {
      commit('TOGGLE_TASK_SELECTION', taskId)
      commit('UPDATE_SELECT_ALL_STATE', getters.allTaskIds)
    },
    setTaskSelection({ commit, getters }, payload) {
      commit('SET_TASK_SELECTION', payload)
      commit('UPDATE_SELECT_ALL_STATE', getters.allTaskIds)
    },
    toggleSelectAll({ commit, state, getters }) {
      if (state.selectAllState === true) {
        commit('DESELECT_ALL_TASKS')
      } else {
        commit('SELECT_ALL_TASKS', getters.allTaskIds)
      }
    },
    // 任务折叠相关
    toggleTaskCollapsed({ commit }, taskId) {
      commit('TOGGLE_TASK_COLLAPSED', taskId)
    },
    // 连接线相关
    updateDependencyLabel({ commit }, payload) {
      commit('UPDATE_DEPENDENCY_LABEL', payload)
      if (payload.color) {
        commit('UPDATE_DEPENDENCY_COLOR', payload)
      }
    },
    removeDependency({ commit }, payload) {
      commit('REMOVE_DEPENDENCY', payload)
    },
    // 任务管理
    addNewTask({ commit }, payload) {
      commit('ADD_NEW_TASK', payload)
    },
    addTask({ commit }, task) {
      commit('ADD_NEW_TASK', { task, parentId: null })
    },
    addTaskWithParent({ commit }, { task, parentTask, newParentTask }) {
      commit('ADD_TASK_WITH_PARENT', { task, parentTask, newParentTask })
    },
    deleteTask({ commit }, taskId) {
      commit('DELETE_TASK', taskId)
    },

    // 移动任务到新的父任务
    moveTaskToNewParent({ commit, state }, { taskId, newParentId, updates }) {
      // 先删除任务从原位置
      commit('DELETE_TASK', taskId)

      // 创建新的任务对象
      const newTask = {
        ...updates,
        id: taskId,
        parentId: newParentId
      }

      // 添加到新位置
      if (newParentId) {
        commit('ADD_NEW_TASK', { task: newTask, parentId: newParentId })
      } else {
        // 如果新父任务为null，作为根级任务添加
        commit('ADD_NEW_TASK', { task: newTask, parentId: null })
      }
    },
    // 左侧面板控制
    toggleLeftPanel({ commit }) {
      commit('TOGGLE_LEFT_PANEL')
    },
    setLeftPanelVisible({ commit }, visible) {
      commit('SET_LEFT_PANEL_VISIBLE', visible)
    },
    // 列配置管理
    updateColumnConfig({ commit }, newConfig) {
      commit('UPDATE_COLUMN_CONFIG', newConfig)
    },
    updateColumnVisibility({ commit }, payload) {
      commit('UPDATE_COLUMN_VISIBILITY', payload)
    },
    updateColumnOrder({ commit }, payload) {
      commit('UPDATE_COLUMN_ORDER', payload)
    },
    updateColumnWidth({ commit }, payload) {
      commit('UPDATE_COLUMN_WIDTH', payload)
    },
    // 血缘关系高亮相关
    setLineageHighlight({ commit }, sourceTaskId) {
      commit('SET_LINEAGE_HIGHLIGHT', { sourceTaskId })
    },

    clearLineageHighlight({ commit }) {
      commit('CLEAR_LINEAGE_HIGHLIGHT')
    },

    toggleLineageHighlight({ commit, state }, sourceTaskId) {
      if (state.highlightedConnections.sourceTaskId === sourceTaskId) {
        commit('CLEAR_LINEAGE_HIGHLIGHT')
      } else {
        commit('SET_LINEAGE_HIGHLIGHT', { sourceTaskId })
      }
    },

    // 今天标记相关
    jumpToToday({ commit }) {
      commit('JUMP_TO_TODAY')
    },

    setTodayMarker({ commit }, enabled) {
      commit('SET_TODAY_MARKER', enabled)
    },

    updateCurrentDate({ commit }, date) {
      commit('UPDATE_CURRENT_DATE', date)
    },

    // 生成大量测试数据用于演示虚拟滚动
    generateLargeDataset({ commit }, count = 1000) {
      const priorities = ['low', 'medium', 'high', 'critical']
      const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#34495e', '#e67e22']
      const departments = ['Development', 'Design', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations']
      const taskTypes = ['Feature', 'Bug Fix', 'Enhancement', 'Research', 'Documentation', 'Testing', 'Review']
      const assignees = ['Alice Johnson', 'Bob Smith', 'Carol Davis', 'David Wilson', 'Eve Brown', 'Frank Miller', 'Grace Lee', 'Henry Taylor']
      const subTaskTypes = ['Analysis', 'Design', 'Implementation', 'Testing', 'Review', 'Deployment']

      const generateRandomDate = (start, end) => {
        return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
      }

      const baseStartDate = new Date('2024-01-01')
      const baseEndDate = new Date('2024-12-31')

      const ganttData = []

      // 生成父级任务组
      const parentGroups = Math.ceil(count / 100) // 每100个任务一个父级组，支持三级结构

      for (let g = 0; g < parentGroups; g++) {
        const parentId = `parent_${g + 1}`
        const parentStartDate = generateRandomDate(baseStartDate, new Date('2024-06-01'))
        const parentEndDate = generateRandomDate(new Date(parentStartDate.getTime() + 60 * 24 * 60 * 60 * 1000), baseEndDate)

        // 创建父级任务（第一级）
        const parentTask = {
          id: parentId,
          name: `${departments[g % departments.length]} - ${taskTypes[g % taskTypes.length]} Phase ${g + 1}`,
          startDate: parentStartDate.toISOString().split('T')[0],
          endDate: parentEndDate.toISOString().split('T')[0],
          progress: Math.floor(Math.random() * 101),
          priority: priorities[Math.floor(Math.random() * priorities.length)],
          color: colors[g % colors.length],
          assignee: assignees[g % assignees.length],
          description: `Parent task for ${departments[g % departments.length]} department`,
          level: 0,
          children: [],
          isParentNode: true,
          department: departments[g % departments.length],
          estimatedHours: Math.floor(Math.random() * 400) + 100,
          actualHours: Math.floor(Math.random() * 360) + 80
        }

        // 为每个父级任务生成子任务（第二级）
        const childGroupCount = Math.min(5, Math.ceil((count - g * 100) / 20)) // 每个父级最多5个子任务组
        for (let c = 0; c < childGroupCount; c++) {
          const childId = `${parentId}_child_${c + 1}`
          const childStartDate = generateRandomDate(parentStartDate, new Date(parentEndDate.getTime() - 20 * 24 * 60 * 60 * 1000))
          const childEndDate = generateRandomDate(new Date(childStartDate.getTime() + 10 * 24 * 60 * 60 * 1000), parentEndDate)

          const childTask = {
            id: childId,
            name: `${taskTypes[c % taskTypes.length]} Module ${c + 1}`,
            startDate: childStartDate.toISOString().split('T')[0],
            endDate: childEndDate.toISOString().split('T')[0],
            planStartDate: new Date(childStartDate.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            planEndDate: new Date(childEndDate.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            progress: Math.floor(Math.random() * 101),
            priority: priorities[Math.floor(Math.random() * priorities.length)],
            color: colors[Math.floor(Math.random() * colors.length)],
            assignee: assignees[Math.floor(Math.random() * assignees.length)],
            description: `Second level task for ${taskTypes[c % taskTypes.length]}`,
            level: 1,
            parentId,
            children: [],
            isParentNode: true,
            department: departments[g % departments.length],
            taskType: taskTypes[c % taskTypes.length],
            estimatedHours: Math.floor(Math.random() * 80) + 20,
            actualHours: Math.floor(Math.random() * 70) + 15
          }

          // 为每个子任务生成孙任务（第三级）
          const grandChildCount = Math.min(6, Math.ceil((count - g * 100 - c * 20) / 4)) // 每个子任务最多6个孙任务
          for (let gc = 0; gc < grandChildCount; gc++) {
            const grandChildIndex = g * 100 + c * 20 + gc
            if (grandChildIndex >= count) break

            const grandChildStartDate = generateRandomDate(childStartDate, new Date(childEndDate.getTime() - 3 * 24 * 60 * 60 * 1000))
            const grandChildEndDate = generateRandomDate(new Date(grandChildStartDate.getTime() + 3 * 24 * 60 * 60 * 1000), childEndDate)

            const grandChildTask = {
              id: `task_${grandChildIndex + 1}`,
              name: `${subTaskTypes[gc % subTaskTypes.length]} #${grandChildIndex + 1}: ${taskTypes[c % taskTypes.length]} Detail`,
              startDate: grandChildStartDate.toISOString().split('T')[0],
              endDate: grandChildEndDate.toISOString().split('T')[0],
              planStartDate: new Date(grandChildStartDate.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              planEndDate: new Date(grandChildEndDate.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              progress: Math.floor(Math.random() * 101),
              priority: priorities[Math.floor(Math.random() * priorities.length)],
              color: colors[Math.floor(Math.random() * colors.length)],
              assignee: assignees[Math.floor(Math.random() * assignees.length)],
              description: `Third level task for ${subTaskTypes[gc % subTaskTypes.length]} in ${taskTypes[c % taskTypes.length]}`,
              level: 2,
              parentId: childId,
              children: [],
              department: departments[g % departments.length],
              taskType: `${taskTypes[c % taskTypes.length]} - ${subTaskTypes[gc % subTaskTypes.length]}`,
              estimatedHours: Math.floor(Math.random() * 16) + 2,
              actualHours: Math.floor(Math.random() * 14) + 1,
              tags: [`${departments[g % departments.length].toLowerCase()}`, `${subTaskTypes[gc % subTaskTypes.length].toLowerCase()}`],
              // 随机添加一些milestone标记
              milestone: Math.random() < 0.1 // 10%的概率是milestone
            }

            childTask.children.push(grandChildTask)
          }

          parentTask.children.push(childTask)
        }

        ganttData.push(parentTask)
      }

      // 更新状态
      commit('SET_GANTT_DATA', ganttData)

      // 计算实际任务数量
      const countTotalTasks = (tasks) => {
        let total = 0
        tasks.forEach(task => {
          total += 1
          if (task.children && task.children.length > 0) {
            total += countTotalTasks(task.children)
          }
        })
        return total
      }

      const totalGeneratedTasks = countTotalTasks(ganttData)

      return {
        totalTasks: totalGeneratedTasks,
        parentGroups: ganttData.length,
        childGroups: ganttData.reduce((total, parent) => total + parent.children.length, 0),
        leafTasks: ganttData.reduce((total, parent) => {
          return total + parent.children.reduce((childTotal, child) => childTotal + child.children.length, 0)
        }, 0)
      }
    },
    // 切换连接线灰色模式
    toggleGrayConnectionMode({ commit, state }) {
      commit('SET_GRAY_CONNECTION_MODE', !state.grayConnectionMode)
    },
    // 设置表格筛选状态 - 新增筛选功能
    setTableFilters({ commit }, filters) {
      commit('SET_TABLE_FILTERS', filters)
    },

    // 设置父子节点时间关联配置
    setLinkParentChildDates({ commit }, linkParentChildDates) {
      commit('SET_LINK_PARENT_CHILD_DATES', linkParentChildDates)
    },

    // 生成400条蓝色主题测试数据
    generate400BlueDataset({ commit }) {
      const priorities = ['low', 'medium', 'high', 'critical']
      const departments = ['Development', 'Design', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations']
      const taskTypes = ['Feature', 'Bug Fix', 'Enhancement', 'Research', 'Documentation', 'Testing', 'Review']
      const assignees = ['Alice Johnson', 'Bob Smith', 'Carol Davis', 'David Wilson', 'Eve Brown', 'Frank Miller', 'Grace Lee', 'Henry Taylor']
      const subTaskTypes = ['Analysis', 'Design', 'Implementation', 'Testing', 'Review', 'Deployment']

      // 统一使用蓝色调色板
      const blueColors = ['#3498db', '#2980b9', '#5dade2', '#85c1e9', '#1f77b4', '#4682b4', '#6495ed', '#87ceeb']
      const blueConnectionColor = '#3498db' // 统一蓝色连线颜色
      const dependencyTypes = ['FS', 'SS', 'FF', 'SF']

      const generateRandomDate = (start, end) => {
        return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
      }

      const baseStartDate = new Date('2024-01-01')
      const baseEndDate = new Date('2024-12-31')

      const ganttData = []
      const dependencies = []
      const allTaskIds = []

      // 生成40个父级任务组，每组平均10个任务
      for (let g = 0; g < 40; g++) {
        const parentId = `parent_${g + 1}`
        const parentStartDate = generateRandomDate(baseStartDate, new Date('2024-06-01'))
        const parentEndDate = generateRandomDate(new Date(parentStartDate.getTime() + 60 * 24 * 60 * 60 * 1000), baseEndDate)

        // 创建父级任务（第一级）
        const parentTask = {
          id: parentId,
          name: `${departments[g % departments.length]} - ${taskTypes[g % taskTypes.length]} Phase ${g + 1}`,
          startDate: parentStartDate.toISOString().split('T')[0],
          endDate: parentEndDate.toISOString().split('T')[0],
          progress: Math.floor(Math.random() * 101),
          priority: priorities[Math.floor(Math.random() * priorities.length)],
          color: blueColors[0], // 统一使用主蓝色
          assignee: assignees[g % assignees.length],
          description: `Parent task for ${departments[g % departments.length]} department`,
          level: 0,
          children: [],
          isParentNode: true,
          department: departments[g % departments.length],
          estimatedHours: Math.floor(Math.random() * 400) + 100,
          actualHours: Math.floor(Math.random() * 360) + 80,
          type: 'deliverable', // 父节点类型
          permissions: {
            editable: true,
            deletable: true,
            movable: true
          }
        }

        // 为每个父级任务生成10个子任务
        for (let c = 0; c < 10; c++) {
          const childId = `task_${g * 10 + c + 1}`
          const childStartDate = generateRandomDate(parentStartDate, new Date(parentEndDate.getTime() - 10 * 24 * 60 * 60 * 1000))
          const childEndDate = generateRandomDate(new Date(childStartDate.getTime() + 5 * 24 * 60 * 60 * 1000), parentEndDate)

          const childTask = {
            id: childId,
            name: `${taskTypes[c % taskTypes.length]} Task ${g * 10 + c + 1}: ${subTaskTypes[c % subTaskTypes.length]}`,
            startDate: childStartDate.toISOString().split('T')[0],
            endDate: childEndDate.toISOString().split('T')[0],
            planStartDate: new Date(childStartDate.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            planEndDate: new Date(childEndDate.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            progress: Math.floor(Math.random() * 101),
            priority: priorities[Math.floor(Math.random() * priorities.length)],
            color: blueColors[c % blueColors.length], // 循环使用蓝色调色板
            assignee: assignees[Math.floor(Math.random() * assignees.length)],
            description: `Detailed task for ${taskTypes[c % taskTypes.length]} - ${subTaskTypes[c % subTaskTypes.length]}`,
            level: 1,
            parentId,
            children: [],
            department: departments[g % departments.length],
            taskType: `${taskTypes[c % taskTypes.length]} - ${subTaskTypes[c % subTaskTypes.length]}`,
            estimatedHours: Math.floor(Math.random() * 40) + 8,
            actualHours: Math.floor(Math.random() * 35) + 5,
            tags: [`${departments[g % departments.length].toLowerCase()}`, `${subTaskTypes[c % subTaskTypes.length].toLowerCase()}`],
            type: 'task', // 子节点类型
            milestone: Math.random() < 0.05, // 5%的概率是milestone
            permissions: {
              editable: true,
              deletable: true,
              movable: true
            }
          }
          parentTask.children.push(childTask)
          allTaskIds.push(childId)
        }
        ganttData.push(parentTask)
        allTaskIds.push(parentId)
      }

      // 生成依赖关系，确保from/to都存在且无重复
      const dependencySet = new Set()
      for (let i = 0; i < allTaskIds.length; i++) {
        // 每个任务30%概率生成依赖
        if (i > 0 && Math.random() < 0.3) {
          const from = allTaskIds[Math.floor(Math.random() * i)]
          const to = allTaskIds[i]
          if (from !== to) {
            const key = `${from}_${to}`
            if (!dependencySet.has(key)) {
              dependencySet.add(key)
              dependencies.push({
                from,
                to,
                color: blueConnectionColor,
                label: `Dependency ${dependencies.length + 1}`,
                type: dependencyTypes[Math.floor(Math.random() * dependencyTypes.length)],
                lag: Math.floor(Math.random() * 7) - 2 // -2~+4天
              })
            }
          }
        }
      }

      // 更新状态
      commit('SET_GANTT_DATA', ganttData)
      commit('SET_DEPENDENCIES', dependencies)
      return {
        totalTasks: allTaskIds.length,
        parentGroups: ganttData.length,
        dependencies: dependencies.length,
        colorTheme: 'Blue Unified'
      }
    },
    // 批量更新任务（级联更新）
    batchUpdateTasks({ commit }, { updates, reason = 'Cascade update' }) {
      console.log(`[级联更新] 开始批量更新 ${updates.length} 个任务，原因: ${reason}`)

      const updateResults = []

      updates.forEach(update => {
        try {
          commit('UPDATE_GANTT_ITEM', {
            id: update.taskId,
            updates: {
              startDate: update.newStart,
              endDate: update.newEnd
            }
          })

          updateResults.push({
            taskId: update.taskId,
            taskName: update.taskName,
            success: true,
            message: `任务 "${update.taskName}" 已更新`
          })

          console.log(`[级联更新] 任务 ${update.taskName} 更新成功: ${update.currentStart} -> ${update.newStart}`)
        } catch (error) {
          console.error(`[级联更新] 任务 ${update.taskName} 更新失败:`, error)

          updateResults.push({
            taskId: update.taskId,
            taskName: update.taskName,
            success: false,
            message: `任务 "${update.taskName}" 更新失败: ${error.message}`
          })
        }
      })

      console.log(`[级联更新] 批量更新完成，成功: ${updateResults.filter(r => r.success).length}，失败: ${updateResults.filter(r => !r.success).length}`)

      return updateResults
    },

    // 初始化依赖约束引擎
    initDependencyEngine({ commit }) {
      commit('INIT_DEPENDENCY_ENGINE')
    },

    // 更新依赖约束引擎
    updateDependencyEngine({ commit }) {
      commit('UPDATE_DEPENDENCY_ENGINE')
    },

    // 更新依赖关系
    setDependencies({ commit }, dependencies) {
      commit('SET_DEPENDENCIES', dependencies)
    },

    resetToTestData({ commit }) {
      commit('RESET_TO_TEST_DATA');
    },
  },
  getters: {
    allTaskIds: (state) => {
      const ids = []
      const collectIds = (tasks) => {
        tasks.forEach(task => {
          ids.push(task.id)
          if (task.children) {
            collectIds(task.children)
          }
        })
      }
      collectIds(state.ganttData)
      return ids
    },
    isTaskSelected: (state) => (taskId) => {
      return state.selectedTasks.includes(taskId)
    },
    isTaskCollapsed: (state) => (taskId) => {
      return state.collapsedTasks.includes(taskId)
    },
    getTaskById: (state) => (taskId) => {
      // 递归查找任务
      const findTask = (tasks) => {
        for (const task of tasks) {
          if (task.id === taskId || task.id === parseInt(taskId)) {
            return task
          }
          if (task.children && task.children.length > 0) {
            const found = findTask(task.children)
            if (found) return found
          }
        }
        return null
      }
      return findTask(state.ganttData)
    },
    visibleTasks: (state, getters) => {
      const visible = []
      const traverse = (tasks, level = 0) => {
        tasks.forEach(task => {
          const hasChildren = task.children && task.children.length > 0

          // 为父级节点计算日期范围和进度
          const taskData = { ...task, level, isParentNode: hasChildren }

          if (hasChildren) {
            // 根据配置决定是否自动计算父级节点的时间范围
            // 只有当 linkParentChildDates 为 true 时才自动从子节点计算父节点时间
            if (state.linkParentChildDates) {
              // 计算父级节点的开始和结束日期
              let minStart = null
              let maxEnd = null
              let totalProgress = 0
              let taskCount = 0

              const calculateFromChildren = (children) => {
                children.forEach(child => {
                  if (child.startDate) {
                    const startDate = new Date(child.startDate)
                    if (!minStart || startDate < minStart) {
                      minStart = startDate
                    }
                  }

                  if (child.endDate) {
                    const endDate = new Date(child.endDate)
                    if (!maxEnd || endDate > maxEnd) {
                      maxEnd = endDate
                    }
                  }

                  if (typeof child.progress === 'number') {
                    totalProgress += child.progress
                    taskCount++
                  }

                  // 递归处理子任务的子任务
                  if (child.children && child.children.length > 0) {
                    calculateFromChildren(child.children)
                  }
                })
              }

              calculateFromChildren(task.children)

              // 设置父级节点的日期和进度
              if (minStart) {
                taskData.startDate = minStart.toISOString().split('T')[0]
              }
              if (maxEnd) {
                taskData.endDate = maxEnd.toISOString().split('T')[0]
              }
              if (taskCount > 0) {
                taskData.progress = Math.round(totalProgress / taskCount)
              }
            } else {
              // 如果配置为false，父节点保持自己的时间设置，不自动计算
              // 父节点进度不受子节点影响，保持原有进度值
              // taskData.progress = task.progress || 0 // 保持父节点自己的进度
            }

            // 确保父级节点有颜色
            if (!taskData.color) {
              taskData.color = '#3498db' // 统一蓝色主题
            }
          }

          visible.push(taskData)

          if (hasChildren && !getters.isTaskCollapsed(task.id)) {
            traverse(task.children, level + 1)
          }
        })
      }
      traverse(state.ganttData)
      return visible
    },
    getDependencyLabel: (state) => (from, to) => {
      const key = `${from}_${to}`
      return state.dependencyLabels[key] || ''
    },
    // 列配置相关
    visibleColumns: (state) => {
      return state.columnConfig
        .filter(col => col.visible)
        .sort((a, b) => a.order - b.order)
    },
    getColumnConfig: (state) => {
      return state.columnConfig.slice().sort((a, b) => a.order - b.order)
    },
    isLeftPanelVisible: (state) => {
      return state.leftPanelVisible
    },
    // 血缘关系相关getter
    isTaskHighlighted: (state) => (taskId) => {
      if (!state.highlightedConnections.isHighlightMode) return false
      return state.highlightedConnections.relatedTaskIds.includes(taskId)
    },

    isTaskDimmed: (state) => (taskId) => {
      if (!state.highlightedConnections.isHighlightMode) return false
      return !state.highlightedConnections.relatedTaskIds.includes(taskId)
    },

    getTaskHighlightType: (state) => (taskId) => {
      if (!state.highlightedConnections.isHighlightMode) return 'normal'

      if (state.highlightedConnections.sourceTaskId === taskId) return 'source'
      if (state.highlightedConnections.upstreamTasks.includes(taskId)) return 'upstream'
      if (state.highlightedConnections.downstreamTasks.includes(taskId)) return 'downstream'

      return state.highlightedConnections.relatedTaskIds.includes(taskId) ? 'related' : 'dimmed'
    },

    isDependencyHighlighted: (state) => (dependency) => {
      if (!state.highlightedConnections.isHighlightMode) return false
      return state.highlightedConnections.relatedDependencies.some(dep =>
        dep.from === dependency.from && dep.to === dependency.to
      )
    },

    // 今天的日期（用于今天标记）
    getTodayDate: (state) => state.todayMarker.date,

    // 是否启用今天标记
    isTodayMarkerEnabled: (state) => state.todayMarker.enabled,

    // 获取筛选后的任务数据 - 新增筛选功能
    filteredTasks: (state, getters) => {
      const visibleTasks = getters.visibleTasks
      const filters = state.tableFilters

      // 如果没有筛选条件，返回所有可见任务
      if (!filters || Object.keys(filters).length === 0) {
        return visibleTasks
      }

      // 应用筛选条件
      return visibleTasks.filter(task => {
        return Object.keys(filters).every(columnId => {
          const filterValue = filters[columnId]
          if (!filterValue) return true

          // 根据列类型进行筛选匹配
          switch (columnId) {
            case 'taskName':
              console.log('task.name', filterValue)
              return task.name && filterValue.some(value =>
                task.name.toLowerCase().includes(value.toLowerCase())
              )
            case 'status':
              const status = task.progress >= 100 ? 'completed' : task.progress > 0 ? 'in-progress' : 'not-started'
              return status === filterValue
            case 'progress':
              const progress = parseInt(task.progress) || 0
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
              // 日期筛选：按年月匹配
              const taskDate = task[columnId]
              if (!taskDate) return false
              const taskMonth = moment(taskDate).format('YYYY-MM')
              return taskMonth === filterValue
            default:
              return true
          }
        })
      })
    },

    isToday: (state) => (date) => {
      return date === state.todayMarker.date
    },

    // 获取所有任务（扁平化）
    allTasks: state => {
      const flattenTasks = (tasks) => {
        return tasks.reduce((acc, task) => {
          acc.push(task)
          if (task.children && task.children.length > 0) {
            acc.push(...flattenTasks(task.children))
          }
          return acc
        }, [])
      }
      return flattenTasks(state.ganttData)
    },

    // 获取依赖类型选项
    dependencyTypeOptions: () => {
      const { getDependencyTypeOptions } = require('@/config/dependencyTypes')
      return getDependencyTypeOptions()
    },

    // 获取当前高亮的连接信息
    highlightedConnections: state => state.highlightedConnections,

    // 获取表格筛选状态
    tableFilters: state => state.tableFilters,

    // 检查任务是否有子任务
    hasChildren: state => (taskId) => {
      const task = state.ganttData.find(t => t.id === taskId)
      return task && task.children && task.children.length > 0
    },

    // 获取任务的层级深度
    getTaskDepth: state => (taskId) => {
      const findDepth = (tasks, targetId, currentDepth = 0) => {
        for (const task of tasks) {
          if (task.id === targetId) {
            return currentDepth
          }
          if (task.children && task.children.length > 0) {
            const childDepth = findDepth(task.children, targetId, currentDepth + 1)
            if (childDepth !== -1) {
              return childDepth
            }
          }
        }
        return -1
      }
      return findDepth(state.ganttData, taskId)
    }
  }
})
