<template>
  <el-dialog
    :visible.sync="dialogVisible"
    width="60%"
    top="2%"
    :show-close="false"
    :modal-append-to-body="false"
    :append-to-body="false"
    :before-close="handleClose"
    custom-class="custom-dialog">
    <div class="dialog-content">
      <div class="dialog-header">
        <div class="dialog-title">
          {{ dialogTitle }}
        </div>
        <div v-if="type === 'task'" class="import-template" @click="importFromTemplate">
          import from template
        </div>
      </div>

      <div class="content-section">
        <el-form :model="localForm" label-width="0" size="medium">
          <!-- Title input -->
          <el-form-item>
            <div class="form-item-row">
              <div class="icon-section">
                <icon-component name="text"></icon-component>
              </div>
              <el-input
                v-model="localForm.title"
                :placeholder="type === 'deliverable' ? 'Enter deliverable title' : 'Enter task title'"
                class="form-input">
              </el-input>
            </div>
          </el-form-item>

          <!-- Assignee selection -->
          <el-form-item>
            <div class="form-item-row">
              <div class="icon-section">
                <icon-component name="user"></icon-component>
              </div>
              <div class="assignee-content">
                <el-select
                :append-to-body="true"
                  v-model="localForm.assignee"
                  placeholder="Select assignee"
                  class="assignee-select">
                  <el-option
                    v-for="person in assigneeOptions"
                    :key="person.value"
                    :label="person.label"
                    :value="person.value">
                  </el-option>
                </el-select>
              </div>
            </div>
          </el-form-item>

          <!-- Date range and progress -->
          <el-form-item>
            <div class="form-item-row">
              <div class="icon-section">
                <icon-component name="date"></icon-component>
              </div>
              <div class="date-progress-content">
                <div class="date-section">
                  <el-date-picker
                    v-model="localForm.startDate"
                    type="date"
                    placeholder="Start date"
                    format="yyyy-MM-dd"
                    value-format="yyyy-MM-dd"
                    :clearable="false"
                    @change="handleStartDateChange">
                  </el-date-picker>
                  <span class="arrow">→</span>
                  <el-date-picker
                    v-model="localForm.endDate"
                    type="date"
                    placeholder="End date"
                    format="yyyy-MM-dd"
                    value-format="yyyy-MM-dd"
                    :clearable="false"
                    @change="handleEndDateChange">
                  </el-date-picker>
                  <span class="working-days">{{ workingDays }} working days</span>
                </div>
                <div class="progress-section">
                  <el-input-number
                    v-model="localForm.progress"
                    :min="0"
                    :max="100"
                    :precision="0"
                    :controls="false"
                    class="progress-input">
                  </el-input-number>
                  <span class="percent-symbol">%</span>
                </div>
              </div>
            </div>
          </el-form-item>

          <!-- Status selection -->
          <el-form-item>
            <div class="form-item-row">
              <div class="icon-section">
                <icon-component name="tag"></icon-component>
              </div>
              <el-select
              :append-to-body="true"
                v-model="localForm.status"
                placeholder="Select status"
                class="status-select">
                <el-option
                  v-for="status in statusOptions"
                  :key="status.value"
                  :label="status.label"
                  :value="status.value">
                  <span :class="['status-dot', status.color]"></span>
                  {{ status.label }}
                </el-option>
              </el-select>
            </div>
          </el-form-item>

          <!-- Attachment upload -->
          <el-form-item>
            <div class="form-item-row">
              <div class="icon-section">
                <icon-component name="attachment"></icon-component>
              </div>
              <div class="attachment-content">
                <el-upload
                  class="upload-demo"
                  action="#"
                  :auto-upload="false"
                  :show-file-list="true">
                  <el-button size="small" type="text">Add attachment</el-button>
                </el-upload>
              </div>
            </div>
          </el-form-item>

          <!-- Links -->
          <el-form-item>
            <div class="form-item-row">
              <div class="icon-section">
                <icon-component name="link"></icon-component>
              </div>
              <div class="links-content">
                <div class="links-list" v-if="localForm.links.length > 0">
                  <div class="link-item" v-for="(link, index) in localForm.links" :key="index">
                    <a
                      :href="link.url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="link-anchor">
                      {{ link.name }}
                    </a>
                    <el-button type="text" size="mini" @click="removeLink(index)" class="remove-link">
                      <i class="el-icon-close"></i>
                    </el-button>
                  </div>
                </div>
                <el-button size="small" type="text" @click="showAddLinkDialog">Add link</el-button>
              </div>
            </div>
          </el-form-item>

        </el-form>
      </div>



      <div class="tasks-section">
        <!-- Parent task -->
        <div class="task-group" v-if="currentParentTask">
          <div class="task-group-header">
            <icon-component name="parent"></icon-component>
            <span class="group-title">Parent</span>
          </div>
          <div class="parent-task">
            <div class="task-item">
              <span class="task-type-icon">
                <i :class="getTaskTypeIcon(currentParentTask.type)"></i>
              </span>
              <span class="task-title">{{ currentParentTask.title || currentParentTask.name }}</span>
              <el-tag
                :type="getTaskStatusClass(currentParentTask.status)"
                size="small"
                class="task-status">
                {{ currentParentTask.status || 'Not Started' }}
              </el-tag>
              <span class="task-assignee">{{ currentParentTask.assignee }}</span>
            </div>
          </div>
        </div>

        <!-- Children tasks -->
        <div class="task-group" v-if="shouldShowChildrenInfo && currentChildrenTasks && currentChildrenTasks.length > 0">
          <div class="task-group-header">
            <icon-component name="children"></icon-component>
            <span class="group-title">{{ getChildrenSectionTitle() }}</span>
          </div>
          <div class="children-tasks">
            <div class="task-item" v-for="(task, index) in currentChildrenTasks" :key="task.id">
              <span class="task-number">{{ index + 1 }}.</span>
              <span class="task-type-icon">
                <i :class="getTaskTypeIcon(task.type)"></i>
              </span>
              <span class="task-title">{{ task.title || task.name }}</span>
              <el-tag
                :type="getTaskStatusClass(task.status)"
                size="small"
                class="task-status">
                {{ task.status || 'Not Started' }}
              </el-tag>
              <span class="task-assignee">{{ task.assignee }}</span>
            </div>
          </div>
        </div>

        <!-- Sibling tasks -->
        <div class="task-group" v-if="mode === 'add-sibling' && currentSiblingTasks && currentSiblingTasks.length > 0">
          <div class="task-group-header">
            <icon-component name="children"></icon-component>
            <span class="group-title">Sibling Tasks ({{ currentSiblingTasks.length }})</span>
          </div>
          <div class="sibling-tasks">
            <div class="task-item" v-for="(task, index) in currentSiblingTasks" :key="task.id">
              <span class="task-number">{{ index + 1 }}.</span>
              <span class="task-type-icon">
                <i :class="getTaskTypeIcon(task.type)"></i>
              </span>
              <span class="task-title">{{ task.title || task.name }}</span>
              <el-tag
                :type="getTaskStatusClass(task.status)"
                size="small"
                class="task-status">
                {{ task.status || 'Not Started' }}
              </el-tag>
              <span class="task-assignee">{{ task.assignee }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="action-buttons">
        <el-button @click="closeDialog">Close</el-button>
        <el-button type="primary" @click="handleSave">Save</el-button>
      </div>
    </div>

    <!-- Add link dialog -->
    <el-dialog
      title="Add Link"
      :visible.sync="addLinkDialogVisible"
      width="400px"
      :append-to-body="true">
      <el-form :model="newLink" label-width="80px">
        <el-form-item label="Link Name">
          <el-input v-model="newLink.name" placeholder="Enter link name"></el-input>
        </el-form-item>
        <el-form-item label="Link URL" style="margin-top: 20px;">
          <el-input v-model="newLink.url" placeholder="Enter link URL"></el-input>
        </el-form-item>
      </el-form>
      <div slot="footer" class="dialog-footer">
        <el-button @click="addLinkDialogVisible = false">Cancel</el-button>
        <el-button type="primary" @click="addLink">Add</el-button>
      </div>
    </el-dialog>
  </el-dialog>
</template>

<script>
import IconComponent from './IconComponent.vue'
import { mapState, mapGetters, mapActions } from 'vuex'
import moment from 'moment'

export default {
  name: 'MyDialog',
  components: {
    IconComponent
  },
  props: {
    // 对话框可见性
    visible: {
      type: Boolean,
      default: false
    },
    // 对话框类型
    type: {
      type: String,
      default: 'task',
      validator: function(value) {
        return ['task', 'milestone', 'deliverable'].includes(value)
      }
    },
    // 对话框模式
    mode: {
      type: String,
      default: 'add',
      validator: function(value) {
        return ['add', 'edit', 'add-sibling', 'add-child'].includes(value)
      }
    },
    // 编辑的任务数据
    task: {
      type: Object,
      default: () => ({})
    },
    // 父任务数据
    parentTask: {
      type: Object,
      default: () => ({})
    },
    // 表单数据
    form: {
      type: Object,
      default: () => ({})
    },
    // 对话框标题
    title: {
      type: String,
      default: ''
    },
    // 甘特图数据 - 用于计算父子任务关系
    ganttData: {
      type: Array,
      default: () => []
    },
    // 扁平化任务数据 - 用于快速查找
    flattenTasks: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      // 本地表单数据
      localForm: {
        id: '',
        title: '',
        assignee: '',
        startDate: '',
        endDate: '',
        progress: 0,
        status: 'not-started',
        links: []
      },
      // 本地对话框可见性
      dialogVisible: false,
      statusOptions: [
        { value: 'Not Started', label: 'Not Started', color: 'gray' },
        { value: 'In Progress', label: 'In Progress', color: 'blue' },
        { value: 'Completed', label: 'Completed', color: 'green' },
        { value: 'On Hold', label: 'On Hold', color: 'red' }

      ],
      addLinkDialogVisible: false,
      newLink: {
        name: '',
        url: ''
      }
    }
  },
  computed: {
    ...mapGetters(['getAssigneeOptions']),

    // 人员选项数据（从store获取）
    assigneeOptions() {
      return this.getAssigneeOptions || []
    },

    // 对话框标题
    dialogTitle() {
      // 根据模式和类型生成标题
      let action = 'Create';
      if (this.mode === 'edit') {
        action = 'Edit';
      } else if (this.mode === 'add-sibling') {
        action = 'Create';
      } else if (this.mode === 'add-child') {
        action = 'Create';
      }

      // 根据类型生成任务类型名称
      let typeName = 'Task';
      if (this.type === 'milestone') {
        typeName = 'Milestone';
      } else if (this.type === 'deliverable') {
        typeName = 'Deliverable';
      }

      return `${action} ${typeName}`;
    },

    // 工作天数
    workingDays() {
      if (!this.localForm.startDate || !this.localForm.endDate) return 0
      const start = new Date(this.localForm.startDate)
      const end = new Date(this.localForm.endDate)
      return Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1
    },

        currentParentTask() {
      // 在add-child模式下，父任务就是当前选中的任务（要为其添加子任务）
      if (this.mode === 'add-child') {
        return this.parentTask || null
      }
      // 在add-sibling模式下，父任务是当前任务的父任务（与当前任务同级）
      else if (this.mode === 'add-sibling') {
        return this.parentTask || null
      }
      // 在edit模式下，需要查找当前编辑任务的父任务
      else if (this.mode === 'edit' && this.task) {
        // 优先使用传入的parentTask
        if (this.parentTask && this.parentTask.id) {
          return this.parentTask
        }

        // 备用：从ganttData中递归查找父任务
        if (this.ganttData && this.ganttData.length > 0 && this.task.id) {
          const findParentInTree = (tasks, targetTaskId) => {
            for (const task of tasks) {
              if (task.children && Array.isArray(task.children)) {
                // 检查是否为直接子任务
                const foundChild = task.children.find(child => child.id === targetTaskId)
                if (foundChild) {
                  return task
                }
                // 递归查找更深层的子任务
                const foundInChildren = findParentInTree(task.children, targetTaskId)
                if (foundInChildren) {
                  return foundInChildren
                }
              }
            }
            return null
          }

          const foundParent = findParentInTree(this.ganttData, this.task.id)
          if (foundParent) {
            return foundParent
          }
        }

        // 备用：从flattenTasks中查找
        if (this.flattenTasks && this.flattenTasks.length > 0 && this.task.parentId) {
          const foundParent = this.flattenTasks.find(t => t.id === this.task.parentId)
          if (foundParent) {
            return foundParent
          }
        }

        return null
      }

      // 默认返回传入的父任务
      return this.parentTask || null
    },

    currentChildrenTasks() {
      if (this.mode === 'edit' && this.task && this.task.id) {
        // 编辑模式：显示当前任务的子任务
        // 优先使用树形结构的children数组
        if (this.task.children && Array.isArray(this.task.children) && this.task.children.length > 0) {
          return this.task.children
        }
        // 备用：从扁平结构中查找
        if (this.flattenTasks && this.flattenTasks.length > 0) {
          return this.flattenTasks.filter(item => item.parentId === this.task.id) || []
        }
        // 备用：从ganttData中递归查找
        if (this.ganttData && this.ganttData.length > 0) {
          const findChildren = (tasks, parentId) => {
            let children = []
            for (const task of tasks) {
              if (task.id === parentId && task.children) {
                return task.children
              }
              if (task.children && task.children.length > 0) {
                const found = findChildren(task.children, parentId)
                if (found.length > 0) return found
              }
            }
            return children
          }
          return findChildren(this.ganttData, this.task.id)
        }
        return []
      } else if (this.mode === 'add-child' && this.parentTask && this.parentTask.id) {
        // 添加子任务模式：显示即将成为父任务的现有子任务
        // 优先使用树形结构的children数组
        if (this.parentTask.children && Array.isArray(this.parentTask.children) && this.parentTask.children.length > 0) {
          return this.parentTask.children
        }
        // 备用：从扁平结构中查找
        if (this.flattenTasks && this.flattenTasks.length > 0) {
          return this.flattenTasks.filter(item => item.parentId === this.parentTask.id) || []
        }
        // 备用：从ganttData中递归查找
        if (this.ganttData && this.ganttData.length > 0) {
          const findChildren = (tasks, parentId) => {
            let children = []
            for (const task of tasks) {
              if (task.id === parentId && task.children) {
                return task.children
              }
              if (task.children && task.children.length > 0) {
                const found = findChildren(task.children, parentId)
                if (found.length > 0) return found
              }
            }
            return children
          }
          return findChildren(this.ganttData, this.parentTask.id)
        }
        return []
      }
      return []
    },

    // 当前兄弟任务列表
    currentSiblingTasks() {
      if (this.mode === 'add-sibling' && this.parentTask) {
        // 添加同级任务模式：显示同级任务（兄弟任务）
        if (this.flattenTasks && this.flattenTasks.length > 0) {
          return this.flattenTasks.filter(item => item.parentId === this.parentTask.id) || []
        }
        if (this.ganttData && this.ganttData.length > 0) {
          const findChildren = (tasks, parentId) => {
            let children = []
            for (const task of tasks) {
              if (task.parentId === parentId) {
                children.push(task)
              }
              if (task.children && task.children.length > 0) {
                children = children.concat(findChildren(task.children, parentId))
              }
            }
            return children
          }
          return findChildren(this.ganttData, this.parentTask.id)
        }
      }
      return []
    },

    // 是否显示子任务信息
    shouldShowChildrenInfo() {
      // 编辑模式：显示当前任务的子任务
      // add-child模式：显示即将添加到的父任务的现有子任务
      // add-sibling模式：虽然显示兄弟任务，但也可以显示子任务作为参考
      return this.mode === 'edit' || this.mode === 'add-child'
    }
  },
  watch: {
    // 监听外部可见性变化
    visible: {
      handler(newVal) {
        this.dialogVisible = newVal
        if (newVal) {
          // 对话框打开时，初始化表单数据
          this.initFormData()
        }
      },
      immediate: true
    },
    // 监听本地可见性变化
    dialogVisible(newVal) {
      this.$emit('update:visible', newVal)
      if (!newVal) {
        this.$emit('close')
        this.resetForm()
      }
    },
    // 监听表单数据变化
    form: {
      handler(newVal) {
        this.localForm = {
          id: '',
          title: '',
          assignee: '',
          startDate: '',
          endDate: '',
          progress: 0,
          status: 'not-started',
          links: [],
          parentId: this.parentTask ? this.parentTask.id : null
        }
      },
      immediate: true,
      deep: true
    },
    // 监听任务数据变化
    task: {
      handler(newTask) {
        if (newTask) {
          // 更新本地表单数据
          this.localForm = {
            ...this.localForm,
            id: newTask.id,
            title: newTask.title || newTask.name || '',
            assignee: newTask.assignee || '',
            startDate: newTask.startDate || '',
            endDate: newTask.endDate || '',
            progress: newTask.progress || 0,
            status: newTask.status || 'not-started',
            links: Array.isArray(newTask.links) ? [...newTask.links] : []
          }
        }
      },
      deep: true
    },
    // 监听开始日期变化
    'localForm.startDate': {
      handler(newDate) {
        // 如果是里程碑类型，结束日期跟随开始日期
        if (this.type === 'milestone' && newDate) {
          this.localForm.endDate = newDate
        }
      }
    },
    // 监听结束日期变化
    'localForm.endDate': {
      handler(newDate) {
        // 如果是里程碑类型，开始日期跟随结束日期
        if (this.type === 'milestone' && newDate) {
          this.localForm.startDate = newDate
        }
      }
    },
    parentTask: {
      immediate: true,
      handler(newVal) {
        // 父任务更新处理
      }
    },
    task: {
      immediate: true,
      handler(newVal) {
        // 当前任务更新处理
      }
    }
  },
  methods: {
    ...mapActions(['updateGanttItem', 'addNewTask']),

    /**
     * 初始化表单数据
     */
    initFormData() {
      // 编辑模式下，使用传入的任务数据
      if (this.mode === 'edit' && this.task) {
        this.localForm = {
          ...this.task,
          title: this.task.title || this.task.name || '',  // 兼容 name 字段
          status: this.task.status || 'Not Started',  // 使用英文状态默认值
          progress: this.task.progress || 0,
          links: this.task.links || [],
          startDate: this.task.startDate || '',
          endDate: this.task.endDate || '',
          assignee: this.task.assignee || '',
          id: this.task.id
        };
      } else {
        // 新建模式下，使用默认值
        const today = moment().format('YYYY-MM-DD');
        this.localForm = {
          id: '',
          title: '',
          assignee: '',
          startDate: today,
          endDate: this.type === 'milestone' ? today : moment().add(7, 'days').format('YYYY-MM-DD'),
          progress: 0,
          status: 'Not Started',
          links: []
        };
      }

      // 如果是milestone类型，确保开始日期等于结束日期
      if (this.type === 'milestone') {
        this.localForm.endDate = this.localForm.startDate;
      }
    },

    /**
     * 重置表单数据
     */
    resetForm() {
      this.localForm = {
        id: '',
        title: '',
        assignee: '',
        startDate: '',
        endDate: '',
        progress: 0,
        status: 'not-started',
        links: []
      }
      // 注意：currentParentTask 和 currentChildrenTasks 是 computed 属性，不能直接赋值
      // 它们会根据 props 和 mode 自动计算
    },

    /**
     * 关闭对话框
     */
    closeDialog() {
      this.$confirm('Are you sure to close the dialog? Unsaved changes will be lost.', 'Confirm', {
        confirmButtonText: 'Confirm',
        cancelButtonText: 'Cancel',
        type: 'warning'
      }).then(() => {
        this.dialogVisible = false
      }).catch(() => {
        // 用户取消关闭，不做任何操作
      })
    },

    /**
     * 保存表单数据
     */
    async handleSave() {
      // 验证必填字段
      if (!this.validateForm()) {
        return;
      }

      try {
        // 构建完整的任务数据
        const taskData = {
          id: this.localForm.id,
          title: this.localForm.title || '',
          name: this.localForm.title || '', // 同时更新 name 字段以保持一致性
          type: this.type || 'task',
          startDate: this.localForm.startDate || moment().format('YYYY-MM-DD'),
          endDate: this.localForm.endDate || moment().format('YYYY-MM-DD'),
          progress: this.localForm.progress || 0,
          status: this.localForm.status || 'Not Started',
          assignee: this.localForm.assignee || '',
          links: this.localForm.links || [],
          parentId: this.currentParentTask ? this.currentParentTask.id : null,
          mode: this.mode,
          children: this.localForm.children || [],
          childrenTasks: this.currentChildrenTasks || []
        };

        // 根据模式选择不同的保存逻辑
        if (this.mode === 'edit') {
          // 编辑模式：更新任务
          await this.$store.dispatch('updateGanttItem', {
            id: taskData.id,
            updates: taskData
          });
          this.$emit('task-updated', taskData);
        } else {
          // 添加模式：新建任务
          await this.$store.dispatch('addNewTask', {
            task: taskData,
            parentId: taskData.parentId
          });
          this.$emit('task-added', taskData);
        }

        // 更新 localStorage
        this.updateLocalStorage(taskData);

        // 关闭对话框
        this.closeDialog();

        // 显示成功提示
        this.$message.success('Task saved successfully');
      } catch (error) {
        console.error('保存任务失败:', error);
        this.$message.error('Failed to save task');
      }
    },

    /**
     * 更新 localStorage 中的数据
     */
    updateLocalStorage(taskData) {
      try {
        // 从 localStorage 获取数据，确保是一个有效的对象
        let storedData = localStorage.getItem('ganttData');
        let parsedData;

        try {
          parsedData = JSON.parse(storedData) || { tasks: [], dependencies: [] };
        } catch (e) {
          console.warn('解析 localStorage 数据失败，使用默认空数据');
          parsedData = { tasks: [], dependencies: [] };
        }

        // 确保 tasks 是一个数组
        if (!Array.isArray(parsedData.tasks)) {
          parsedData.tasks = [];
        }

        // 根据模式更新任务数据
        if (this.mode === 'edit') {
          const index = parsedData.tasks.findIndex(item => item.id === taskData.id);
          if (index !== -1) {
            parsedData.tasks[index] = { ...parsedData.tasks[index], ...taskData };
          }
        } else {
          parsedData.tasks.push(taskData);
        }

        // 保存回 localStorage
        localStorage.setItem('ganttData', JSON.stringify(parsedData));
      } catch (error) {
        console.error('更新 localStorage 失败:', error);
        // 显示错误提示
        this.$message.error('保存到本地存储失败，请检查浏览器存储空间');
      }
    },

    /**
     * 验证表单数据
     */
    validateForm() {
      if (!this.localForm.title) {
        this.$message.warning('Please enter a title');
        return false;
      }
      if (!this.localForm.startDate || !this.localForm.endDate) {
        this.$message.warning('Please select both start and end dates');
        return false;
      }
      if (moment(this.localForm.startDate).isAfter(this.localForm.endDate)) {
        this.$message.warning('Start date cannot be later than end date');
        return false;
      }
      return true;
    },

    handleClose(done) {
      this.$confirm('确认关闭对话框？')
        .then(_ => {
          done()
        })
        .catch(_ => {})
    },
    addChildTask() {
      this.$message.info('添加子任务功能')
    },
    showAddLinkDialog() {
      this.addLinkDialogVisible = true
    },
    addLink() {
      if (!this.localForm.links) {
        this.localForm.links = []
      }

      if (this.newLink.name && this.newLink.url) {
        this.localForm.links.push({
          name: this.newLink.name,
          url: this.newLink.url
        })
        this.newLink = {
          name: '',
          url: ''
        }
        this.addLinkDialogVisible = false
      }
    },
    removeLink(index) {
      if (this.localForm.links && Array.isArray(this.localForm.links)) {
        this.localForm.links.splice(index, 1)
      }
    },
    importFromTemplate() {
      // 模拟从模板导入数据
      const templateData = {
        title: 'Template Task: Development Phase',
        parentId: '1345',
        assignee: 'Wang Tian(VM/ECN1-P)',
        startDate: '2025/07/01',
        endDate: '2025/07/15',
        progress: 0,
        status: 'todo',
        links: [
          {
            name: 'Template Documentation',
            url: 'https://example.com/template-doc'
          },
          {
            name: 'Reference Guide',
            url: 'https://example.com/reference'
          }
        ]
      };

      // 填入模板数据
      Object.assign(this.localForm, templateData);

      this.$message.success('Template data imported successfully');
    },
    handleStartDateChange(date) {
      if (!date) return

      // 如果是里程碑类型，结束日期跟随开始日期
      if (this.type === 'milestone') {
        this.localForm.endDate = date
        return
      }

      // 如果开始日期晚于结束日期，自动调整结束日期
      if (this.localForm.endDate && date > this.localForm.endDate) {
        this.localForm.endDate = date
        this.$message.warning('End date has been automatically adjusted')
      }
    },
    handleEndDateChange(date) {
      if (!date) return

      // 如果是里程碑类型，开始日期跟随结束日期
      if (this.type === 'milestone') {
        this.localForm.startDate = date
        return
      }

      // 如果结束日期早于开始日期，自动调整开始日期
      if (this.localForm.startDate && date < this.localForm.startDate) {
        this.localForm.startDate = date
        this.$message.warning('Start date has been automatically adjusted')
      }
    },
    getTaskStatusValue(task) {
      if (!task) return 'not-started';
      return task.status || (task.progress >= 100 ? 'completed' : task.progress > 0 ? 'in-progress' : 'not-started');
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
    // 获取任务状态样式类
    getTaskStatusClass(status) {
      switch (status) {
        case 'completed':
          return 'success';
        case 'in-progress':
          return 'warning';
        case 'delayed':
          return 'danger';
        default:
          return 'info';
      }
    },
    /**
     * 获取子任务区域标题
     */
    getChildrenSectionTitle() {
      if (this.mode === 'edit') {
        return `Children (${this.currentChildrenTasks.length})`
      } else if (this.mode === 'add-child') {
        return `Existing Children (${this.currentChildrenTasks.length})`
      }
      return `Children (${this.currentChildrenTasks.length})`
    },


  }
}
</script>

<style lang="scss" scoped>
// 全局样式覆盖
::v-deep .custom-dialog {
  .el-dialog__header {
    display: none;
  }

  .el-dialog__footer {
    display: none;
  }

  .el-dialog__body {
    padding: 0;
  }

  // 输入框统一样式优化
  .el-input__inner,
  .el-textarea__inner {
    background-color: #f9fafb !important;
    border-color: #e5e7eb !important;
    color: #1f2937 !important;
    font-size: 13px !important;

    &:hover {
      background-color: #f3f4f6 !important;
      border-color: #d1d5db !important;
    }

    &:focus {
      background-color: #ffffff !important;
      border-color: #2563eb !important;
      box-shadow: 0 0 0 2px rgba(37,99,235,0.1) !important;
    }

    &::placeholder {
      color: #9ca3af !important;
    }
  }

  // 选择器样式优化
  .el-select .el-input__inner {
    background-color: #f9fafb !important;
  }

  // 日期选择器样式优化
  .el-date-editor {
    .el-input__inner {
      background-color: #f9fafb !important;
    }
    .el-input__prefix {
      left: 8px !important;
    }
    .el-input__inner {
      padding-left: 32px !important;
    }
  }

  // 数字输入框样式优化
  .el-input-number {
    .el-input__inner {
      background-color: #f9fafb !important;
      text-align: center !important;
      padding: 0 8px !important;
    }
  }
}

.dialog-content {
  padding: 16px 20px;
  color: #1f2937;

  .dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #e5e7eb;

    .dialog-title {
      font-size: 16px;
      font-weight: 500;
      color: #1f2937;
      line-height: 1.4;
    }

    .import-template {
      color: #2563eb;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;

      &:hover {
        color: #1d4ed8;
      }
    }
  }

  .content-section {
    margin-bottom: 16px;
  }

  .form-item-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    min-height: 32px;
    position: relative;

    &:last-child {
      margin-bottom: 0;
    }

    .icon-section {
      flex-shrink: 0;
      width: 16px;
      height: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #6b7280;

      svg {
        width: 14px;
        height: 14px;
      }
    }

    .form-input {
      flex: 1;

      ::v-deep .el-input__inner {
        background-color: #f9fafb;
        border-color: #e5e7eb;
        color: #1f2937;
        font-size: 13px;
        height: 32px;
        line-height: 32px;
        padding: 0 12px;
        transition: all 0.2s;

        &::placeholder {
          color: #9ca3af;
        }

        &:hover {
          background-color: #f3f4f6;
          border-color: #d1d5db;
        }

        &:focus {
          background-color: #ffffff;
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37,99,235,0.1);
        }
      }
    }

    .assignee-content {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;

      .assignee-select {
        width: 240px;

        ::v-deep .el-input__inner {
          background-color: #f9fafb;
          border-color: #e5e7eb;
          height: 32px;
          line-height: 32px;
          font-size: 13px;
          color: #1f2937;

          &:hover {
            background-color: #f3f4f6;
            border-color: #d1d5db;
          }

          &:focus {
            background-color: #ffffff;
            border-color: #2563eb;
            box-shadow: 0 0 0 2px rgba(37,99,235,0.1);
          }
        }
      }
    }

    .date-progress-content {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: nowrap;

      .date-section {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;

        ::v-deep .el-date-editor {
          .el-input__inner {
            background-color: #f9fafb;
            border-color: #e5e7eb;
            height: 32px;
            line-height: 32px;
            font-size: 13px;
            color: #1f2937;
            padding-left: 32px;

            &:hover {
              background-color: #f3f4f6;
              border-color: #d1d5db;
            }

            &:focus {
              background-color: #ffffff;
              border-color: #2563eb;
              box-shadow: 0 0 0 2px rgba(37,99,235,0.1);
            }
          }

          .el-input__prefix {
            left: 8px;
          }
        }

        .arrow {
          color: #6b7280;
          font-size: 12px;
        }

        .working-days {
          color: #6b7280;
          font-size: 12px;
          white-space: nowrap;
          background: #f3f4f6;
          padding: 2px 8px;
          border-radius: 4px;
        }
      }

      .progress-section {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-shrink: 0;
        min-width: 80px;

        ::v-deep .progress-input {
          width: 60px;

          .el-input__inner {
            background-color: #f9fafb;
            border-color: #e5e7eb;
            padding: 0 8px;
            text-align: center;
            color: #1f2937;
            height: 32px;
            line-height: 32px;

            &:hover {
              background-color: #f3f4f6;
              border-color: #d1d5db;
            }

            &:focus {
              background-color: #ffffff;
              border-color: #2563eb;
              box-shadow: 0 0 0 2px rgba(37,99,235,0.1);
            }
          }
        }

        .percent-symbol {
          color: #6b7280;
          font-size: 13px;
        }
      }
    }
  }

  .status-select {
    width: 240px;

    ::v-deep .el-input__inner {
      background-color: #f9fafb;
      border-color: #e5e7eb;
      height: 32px;
      line-height: 32px;
      font-size: 13px;
      color: #1f2937;

      &:hover {
        background-color: #f3f4f6;
        border-color: #d1d5db;
      }

      &:focus {
        background-color: #ffffff;
        border-color: #2563eb;
        box-shadow: 0 0 0 2px rgba(37,99,235,0.1);
      }
    }
  }

  .tasks-section {
    margin: 16px 0;
    border-top: 1px solid #e5e7eb;
    padding-top: 16px;

    .task-group {
      margin-bottom: 16px;

      &:last-child {
        margin-bottom: 0;
      }

      .task-group-header {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 8px;
        padding: 0;

        .group-title {
          font-weight: 500;
          color: #4b5563;
          font-size: 13px;
        }
      }

      .task-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px;
        border-radius: 4px;
        background-color: #f9fafb;
        margin-bottom: 4px;
        font-size: 13px;
        border: 1px solid #e5e7eb;

        &:last-child {
          margin-bottom: 0;
        }

        &:hover {
          background-color: #f3f4f6;
        }

        .task-number {
          color: #6b7280;
          font-size: 12px;
          width: 16px;
        }

        .task-type-icon {
          color: #6b7280;
          font-size: 14px;
        }

        .task-title {
          flex: 1;
          color: #374151;
          font-size: 13px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .task-status {
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          background: #f3f4f6;
          color: #4b5563;
          border: 1px solid #e5e7eb;

          &.success {
            background: #ecfdf5;
            color: #059669;
            border-color: #d1fae5;
          }

          &.warning {
            background: #fffbeb;
            color: #d97706;
            border-color: #fef3c7;
          }

          &.danger {
            background: #fef2f2;
            color: #dc2626;
            border-color: #fee2e2;
          }
        }

        .task-assignee {
          color: #6b7280;
          font-size: 12px;
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }
    }
  }

  .action-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding-top: 16px;
    border-top: 1px solid #e5e7eb;

    .el-button {
      padding: 6px 16px;
      font-size: 13px;
      height: 32px;
      font-weight: 500;
      border-radius: 4px;

      &.el-button--default {
        border-color: #d1d5db;
        color: #374151;

        &:hover {
          border-color: #9ca3af;
          color: #1f2937;
          background: #f9fafb;
        }
      }

      &.el-button--primary {
        background: #2563eb;
        border-color: #2563eb;

        &:hover {
          background: #1d4ed8;
          border-color: #1d4ed8;
        }
      }
    }
  }

  // 优化上传区域样式
  .upload-section {
    background-color: #f9fafb;
    border: 1px dashed #d1d5db;
    border-radius: 4px;
    padding: 12px;
    margin-top: 4px;

    .upload-hint {
      color: #6b7280;
      font-size: 13px;
      font-style: italic;
      display: flex;
      align-items: center;
      gap: 4px;

      .upload-icon {
        color: #9ca3af;
        font-size: 14px;
      }
    }
  }

  // 优化链接区域样式
  .link-section {
    background-color: #f9fafb;
    border: 1px dashed #d1d5db;
    border-radius: 4px;
    padding: 12px;
    margin-top: 4px;

    .link-hint {
      color: #6b7280;
      font-size: 13px;
      font-style: italic;
      display: flex;
      align-items: center;
      gap: 4px;

      .link-icon {
        color: #9ca3af;
        font-size: 14px;
      }
    }
  }

  // 优化任务列表区域
  .tasks-section {
    .task-group {
      .task-list {
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 4px;
        overflow: hidden;

        .task-item {
          border: none;
          border-bottom: 1px solid #e5e7eb;
          margin: 0;
          background: transparent;
          transition: background-color 0.2s;

          &:last-child {
            border-bottom: none;
          }

          &:hover {
            background-color: #f3f4f6;
          }

          // 任务编号样式
          .task-id {
            color: #2563eb;
            font-weight: 500;
            min-width: 60px;
          }

          // 任务标题样式
          .task-title {
            font-weight: normal;
            color: #374151;
          }

          // 状态标签样式优化
          .task-status {
            min-width: 90px;
            text-align: center;
            justify-content: center;
            display: inline-flex;
            align-items: center;

            &.not-started {
              background-color: #f3f4f6;
              color: #4b5563;
            }

            &.in-progress {
              background-color: #eff6ff;
              color: #2563eb;
              border-color: #bfdbfe;
            }

            &.completed {
              background-color: #ecfdf5;
              color: #059669;
              border-color: #a7f3d0;
            }
          }

          // 任务分配者样式
          .task-assignee {
            text-align: right;
            padding-right: 8px;
          }
        }
      }

      // 添加子任务按钮样式
      .add-child-task {
        margin-top: 8px;
        padding: 0 8px;

        .el-button {
          color: #2563eb;
          font-size: 13px;
          font-weight: 500;
          padding: 0;
          height: auto;

          &:hover {
            color: #1d4ed8;
            background: none;
          }

          i {
            margin-right: 4px;
          }
        }
      }
    }
  }

  // 优化进度显示
  .progress-display {
    display: flex;
    align-items: center;
    gap: 8px;

    .progress-bar {
      flex: 1;
      height: 6px;
      background: #e5e7eb;
      border-radius: 3px;
      overflow: hidden;

      .progress-fill {
        height: 100%;
        background: #2563eb;
        border-radius: 3px;
        transition: width 0.3s ease;
      }
    }

    .progress-text {
      min-width: 45px;
      text-align: right;
      font-size: 13px;
      color: #4b5563;
    }
  }

  // 优化日期选择器样式
  .el-date-editor {
    .el-input__inner {
      background: #f9fafb;

      &:hover {
        background: #f3f4f6;
      }

      &:focus {
        background: #ffffff;
      }
    }
  }

  // 优化选择器样式
  .el-select {
    .el-input__inner {
      background: #f9fafb;

      &:hover {
        background: #f3f4f6;
      }

      &:focus {
        background: #ffffff;
      }
    }
  }

  // 优化数字输入框样式
  .el-input-number {
    .el-input__inner {
      background: #f9fafb;

      &:hover {
        background: #f3f4f6;
      }

      &:focus {
        background: #ffffff;
      }
    }
  }
}

// 优化弹窗内的表单项间距
.el-form {
  .el-form-item {
    margin-bottom: 16px !important;

    &:last-child {
      margin-bottom: 0 !important;
    }
  }
}

// 优化下拉面板样式
::v-deep .el-select-dropdown {
  border: 1px solid #e5e7eb !important;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;

  .el-select-dropdown__item {
    height: 32px !important;
    line-height: 32px !important;
    padding: 0 12px !important;
    font-size: 13px !important;
    color: #374151 !important;

    &:hover {
      background-color: #f3f4f6 !important;
    }

    &.selected {
      background-color: #eff6ff !important;
      color: #2563eb !important;
      font-weight: 500 !important;
    }
  }
}

// 优化日期选择器面板
::v-deep .el-date-picker {
  border: 1px solid #e5e7eb !important;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;

  .el-date-picker__header {
    margin: 8px 0 !important;

    button {
      color: #6b7280 !important;

      &:hover {
        color: #2563eb !important;
      }
    }

    .el-date-picker__header-label {
      font-size: 14px !important;
      color: #1f2937 !important;

      &:hover {
        color: #2563eb !important;
      }
    }
  }

  .el-date-table {
    th {
      color: #6b7280 !important;
      font-weight: normal !important;
      border-bottom: 1px solid #e5e7eb !important;
    }

    td {
      &.available:hover {
        color: #2563eb !important;

        span {
          background-color: #eff6ff !important;
        }
      }

      &.current:not(.disabled) span {
        background-color: #2563eb !important;
        color: white !important;
      }

      &.today span {
        color: #2563eb !important;
        font-weight: bold !important;
      }

      &.disabled {
        background-color: #f9fafb !important;

        span {
          color: #9ca3af !important;
        }
      }
    }
  }
}
</style>
