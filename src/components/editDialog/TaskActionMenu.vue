<template>
  <div class="task-action-menu">
    <!-- 根据任务类型动态生成菜单 -->
    <template v-if="task.type === 'deliverable'">
      <div class="task-action-item" @click="handleAction('add-child')">
        <i class="el-icon-circle-plus-outline"></i>
        <span>添加子任务</span>
      </div>
      <div class="task-action-item" @click="handleAction('add-sibling')">
        <i class="el-icon-plus"></i>
        <span>添加同级</span>
      </div>
      <div class="task-action-divider"></div>
      <div class="task-action-item" @click="handleAction('edit')">
        <i class="el-icon-edit"></i>
        <span>编辑</span>
      </div>
      <div class="task-action-item" @click="handleAction('delete')">
        <i class="el-icon-delete"></i>
        <span>删除</span>
      </div>
    </template>
    <template v-else-if="task.type === 'task'">
      <div class="task-action-item" @click="handleAction('add-child')">
        <i class="el-icon-circle-plus-outline"></i>
        <span>添加子任务</span>
      </div>
      <div class="task-action-item" @click="handleAction('add-sibling')">
        <i class="el-icon-plus"></i>
        <span>添加同级</span>
      </div>
      <div class="task-action-divider"></div>
      <div class="task-action-item" @click="handleAction('edit')">
        <i class="el-icon-edit"></i>
        <span>编辑</span>
      </div>
      <div class="task-action-item" @click="handleAction('delete')">
        <i class="el-icon-delete"></i>
        <span>删除</span>
      </div>
    </template>
    <template v-else-if="task.type === 'milestone'">
      <div class="task-action-item" @click="handleAction('add-sibling')">
        <i class="el-icon-plus"></i>
        <span>添加同级</span>
      </div>
      <div class="task-action-divider"></div>
      <div class="task-action-item" @click="handleAction('edit')">
        <i class="el-icon-edit"></i>
        <span>编辑</span>
      </div>
      <div class="task-action-item" @click="handleAction('delete')">
        <i class="el-icon-delete"></i>
        <span>删除</span>
      </div>
    </template>
    <template v-else>
      <div class="task-action-item" @click="handleAction('edit')">
        <i class="el-icon-edit"></i>
        <span>编辑</span>
      </div>
    </template>
  </div>
</template>

<script>
export default {
  name: 'TaskActionMenu',
  props: {
    task: {
      type: Object,
      required: true
    }
  },
  methods: {
    handleAction(action) {
      this.$emit('action', { task: this.task, action })
    }
  }
}
</script>

<style scoped>
.task-action-menu {
  padding: 8px 0;
}

.task-action-item {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.task-action-item:hover {
  background-color: #f5f7fa;
}

.task-action-item i {
  margin-right: 8px;
  font-size: 16px;
}

.task-action-divider {
  height: 1px;
  background-color: #ebeef5;
  margin: 4px 0;
}
</style>
