# Vue Gantt Chart 组件使用文档

## 概述

这是一个基于 Vue.js 开发的功能完整的甘特图组件，支持任务管理、依赖关系、拖拽操作、虚拟滚动等企业级功能。

## 主要特性

- ✨ **完整的任务管理**: 创建、编辑、删除、拖拽任务
- 🔗 **依赖关系管理**: 可视化任务依赖，支持编辑和删除连接线
- 🎯 **层级任务支持**: 支持多级父子任务结构
- 📅 **多种视图模式**: 日/周/月/年视图切换
- 🖱️ **拖拽操作**: 任务拖拽、大小调整、进度调整
- 📊 **虚拟滚动**: 大数据量下的性能优化
- 🎨 **可定制主题**: 支持多种视觉主题
- 📱 **响应式设计**: 适配不同屏幕尺寸

## 快速开始

### 安装依赖

```bash
npm install element-ui moment vuex sortablejs lodash
```

### 基础使用

```vue
<template>
  <div id="app">
    <GanttChart
      :data="ganttData"
      :tooltip-enabled="true"
      :timeline-visible="true"
      :connection-editable="true"
      @task-update="handleTaskUpdate"
      @connection-editable-change="handleConnectionEditableChange"
    />
  </div>
</template>

<script>
import GanttChart from "./components/GanttChart.vue";

export default {
  name: "App",
  components: {
    GanttChart,
  },
  data() {
    return {
      ganttData: [
        {
          id: 1,
          name: "项目规划",
          startDate: "2024-01-01",
          endDate: "2024-01-15",
          progress: 100,
          color: "#3498db",
          children: [
            {
              id: 2,
              name: "需求分析",
              parentId: 1,
              startDate: "2024-01-01",
              endDate: "2024-01-05",
              progress: 100,
              color: "#2ecc71",
            },
          ],
        },
      ],
    };
  },
  methods: {
    handleTaskUpdate(task) {
      console.log("任务更新:", task);
    },
    handleConnectionEditableChange(editable) {
      console.log("连接线编辑状态:", editable);
    },
  },
};
</script>
```

## Props 配置

### 数据配置

#### `data`

- **类型**: `Array`
- **默认值**: `[]`
- **描述**: 甘特图数据数组

### 工具提示配置

#### `tooltipEnabled`

- **类型**: `Boolean`
- **默认值**: `false`
- **描述**: 是否启用任务悬浮工具提示

#### `tooltipDelay`

- **类型**: `Number`
- **默认值**: `1000`
- **描述**: 工具提示显示延迟时间（毫秒）

#### `tooltipHideDelay`

- **类型**: `Number`
- **默认值**: `300`
- **描述**: 工具提示隐藏延迟时间（毫秒）

### 时间轴配置

#### `timelineVisible`

- **类型**: `Boolean`
- **默认值**: `true`
- **描述**: 是否显示概览时间轴

#### `currentViewMode`

- **类型**: `String`
- **默认值**: `'month'`
- **可选值**: `'day'`, `'week'`, `'month'`, `'year'`
- **描述**: 当前视图模式

### 连接线配置

#### `connectionEditable`

- **类型**: `Boolean`
- **默认值**: `false`
- **描述**: Whether connection lines are editable. When disabled, all connection lines display in gray color and cannot be double-clicked for editing

#### `connectionDefaultColor`

- **类型**: `String`
- **默认值**: `'#9ca3af'`
- **描述**: 连接线默认颜色（当不可编辑时使用）

### 设置对话框配置

#### `showSettingsDialog`

- **类型**: `Boolean`
- **默认值**: `false`
- **描述**: 控制设置对话框的显示状态

## 事件监听

### 任务相关事件

#### `@task-update`

- **参数**: `(task: Object)`
- **描述**: 任务数据更新时触发

#### `@task-delete`

- **参数**: `(taskId: String|Number)`
- **描述**: 任务删除时触发

#### `@task-create`

- **参数**: `(task: Object)`
- **描述**: 创建新任务时触发

### 配置变更事件

#### `@connection-editable-change`

- **参数**: `(editable: Boolean)`
- **描述**: 连接线编辑状态变更时触发

#### `@gantt-display-config-change`

- **参数**: `(config: Object)`
- **描述**: 甘特图显示配置变更时触发

#### `@settings-dialog-close`

- **描述**: 设置对话框关闭时触发

## 甘特图显示配置参数

| 参数名                  | 类型    | 默认值  | 说明                           |
| ----------------------- | ------- | ------- | ------------------------------ |
| `showTaskName`          | Boolean | `true`  | 是否在甘特图条上显示任务名称   |
| `showProgress`          | Boolean | `true`  | 是否显示进度条                 |
| `showProgressHandle`    | Boolean | `true`  | 是否显示进度拖拽控制柄         |
| `showConnections`       | Boolean | `false` | 是否显示任务间的连接线         |
| `showConnectionLabels`  | Boolean | `true`  | 是否显示连接线标签             |
| `showPlanNodes`         | Boolean | `false` | 是否显示计划节点（灰色虚线）   |
| `showMilestones`        | Boolean | `true`  | 是否显示里程碑节点（钻石形状） |
| `showCriticalPath`      | Boolean | `false` | 是否高亮显示关键路径           |
| `enableThreeLevelNodes` | Boolean | `true`  | 是否启用三级节点结构           |
| `allowParentDrag`       | Boolean | `false` | 父节点是否可拖拽               |
| `allowParentEdit`       | Boolean | `false` | 父节点是否可编辑               |
| `allowParentConnection` | Boolean | `false` | 父节点是否可以创建连接线       |
| `highlightTaskLineage`  | Boolean | `false` | 点击节点是否高亮显示血缘关系   |
| `linkParentChildDates`  | Boolean | `false` | 父子节点时间是否关联           |

### 父级节点连线配置

默认情况下，父级节点（包含子任务的节点）不能创建连接线，这是为了避免复杂的依赖关系管理。但在某些场景下，您可能需要允许父级节点参与连线：

```vue
<template>
  <GanttChart
    :data="ganttData"
    :show-connections="true"
    :allow-parent-connection="true"
    @connection-created="handleConnectionCreated"
  />
</template>

<script>
export default {
  data() {
    return {
      // 启用父级节点连线功能
      allowParentConnection: true,
    };
  },
  methods: {
    handleConnectionCreated(connection) {
      console.log("新建连接:", connection);
      // connection: { from: 'taskId1', to: 'taskId2', color: '#3498db' }
    },
  },
};
</script>
```

**配置说明：**

- `allowParentConnection: false`（默认）: 父级节点不显示连接点，无法创建连接线
- `allowParentConnection: true`: 父级节点显示连接点，可以与其他任务创建连接线

**使用场景：**

1. **项目阶段依赖**: 当需要表示项目不同阶段之间的依赖关系时
2. **里程碑连接**: 父级节点作为里程碑与其他任务建立依赖
3. **资源约束**: 表示父级任务组之间的资源依赖关系

**注意事项：**

- 启用父级节点连线后，请确保您的数据模型能够正确处理父子节点的复杂依赖关系
- 父级节点的时间范围通常由子节点决定，连接线可能影响这种自动计算
- 建议配合 `linkParentChildDates` 参数一起使用，以确保时间关系的一致性

### 测试父级节点连线功能

以下是一个完整的测试示例，展示如何启用和测试父级节点连线功能：

```vue
<template>
  <div class="parent-connection-test">
    <h2>父级节点连线功能测试</h2>

    <!-- 控制开关 -->
    <div class="control-panel">
      <el-switch
        v-model="allowParentConnection"
        active-text="允许父节点连线"
        inactive-text="禁用父节点连线"
        @change="onParentConnectionToggle"
      />
      <el-switch
        v-model="showConnections"
        active-text="显示连接线"
        inactive-text="隐藏连接线"
      />
    </div>

    <!-- 甘特图组件 -->
    <GanttChart
      :data="testData"
      :height="'500px'"
      :show-connections="showConnections"
      :allow-parent-connection="allowParentConnection"
      :connection-editable="true"
      @dependency-created="onDependencyCreated"
      @dependency-updated="onDependencyUpdated"
    />

    <!-- 连接信息显示 -->
    <div class="connection-info">
      <h3>当前连接列表：</h3>
      <ul>
        <li v-for="conn in connections" :key="`${conn.from}-${conn.to}`">
          从 "{{ getTaskName(conn.from) }}" 到 "{{ getTaskName(conn.to) }}"
          <el-tag
            :type="
              isParentTask(conn.from) || isParentTask(conn.to)
                ? 'warning'
                : 'info'
            "
          >
            {{
              isParentTask(conn.from) || isParentTask(conn.to)
                ? "包含父节点"
                : "子节点间"
            }}
          </el-tag>
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
import { mapState } from "vuex";

export default {
  name: "ParentConnectionTest",
  data() {
    return {
      allowParentConnection: false, // 默认禁用
      showConnections: true,
      testData: [
        {
          id: 1,
          name: "项目阶段A",
          startDate: "2024-01-01",
          endDate: "2024-01-31",
          progress: 50,
          children: [
            {
              id: 11,
              name: "任务A1",
              startDate: "2024-01-01",
              endDate: "2024-01-15",
              progress: 80,
            },
            {
              id: 12,
              name: "任务A2",
              startDate: "2024-01-16",
              endDate: "2024-01-31",
              progress: 20,
            },
          ],
        },
        {
          id: 2,
          name: "项目阶段B",
          startDate: "2024-02-01",
          endDate: "2024-02-28",
          progress: 30,
          children: [
            {
              id: 21,
              name: "任务B1",
              startDate: "2024-02-01",
              endDate: "2024-02-14",
              progress: 60,
            },
            {
              id: 22,
              name: "任务B2",
              startDate: "2024-02-15",
              endDate: "2024-02-28",
              progress: 0,
            },
          ],
        },
        {
          id: 3,
          name: "独立任务C",
          startDate: "2024-03-01",
          endDate: "2024-03-15",
          progress: 0,
        },
      ],
    };
  },
  computed: {
    ...mapState(["dependencies"]),
    connections() {
      return this.dependencies || [];
    },
  },
  methods: {
    onParentConnectionToggle(enabled) {
      this.$message({
        message: `父节点连线功能已${enabled ? "启用" : "禁用"}`,
        type: enabled ? "success" : "warning",
      });
    },
    onDependencyCreated(dependency) {
      console.log("新建连接:", dependency);
      this.$message({
        message: `成功创建连接: ${this.getTaskName(
          dependency.from
        )} → ${this.getTaskName(dependency.to)}`,
        type: "success",
      });
    },
    onDependencyUpdated(dependency) {
      console.log("更新连接:", dependency);
    },
    getTaskName(taskId) {
      const findTask = (tasks, id) => {
        for (const task of tasks) {
          if (task.id === id) return task.name;
          if (task.children) {
            const found = findTask(task.children, id);
            if (found) return found;
          }
        }
        return "未知任务";
      };
      return findTask(this.testData, taskId);
    },
    isParentTask(taskId) {
      const findTask = (tasks, id) => {
        for (const task of tasks) {
          if (task.id === id)
            return !!task.children && task.children.length > 0;
          if (task.children) {
            const found = findTask(task.children, id);
            if (found !== null) return found;
          }
        }
        return false;
      };
      return findTask(this.testData, taskId);
    },
  },
};
</script>

<style scoped>
.parent-connection-test {
  padding: 20px;
}

.control-panel {
  margin-bottom: 20px;
  padding: 15px;
  background: #f5f5f5;
  border-radius: 6px;
}

.control-panel .el-switch {
  margin-right: 20px;
}

.connection-info {
  margin-top: 20px;
  padding: 15px;
  background: #f9f9f9;
  border-radius: 6px;
}

.connection-info ul {
  margin: 10px 0;
  padding-left: 20px;
}

.connection-info li {
  margin: 8px 0;
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
```

**测试步骤：**

1. **默认状态测试**：

   - 确认父节点连线开关默认为关闭状态
   - 验证父节点（项目阶段 A、项目阶段 B）没有显示连接点
   - 验证子节点（任务 A1、A2、B1、B2）正常显示连接点

2. **启用父节点连线**：

   - 打开"允许父节点连线"开关
   - 验证父节点现在显示连接点
   - 尝试创建父节点到子节点的连接
   - 尝试创建父节点到父节点的连接

3. **功能验证**：
   - 测试连接线的创建、编辑、删除功能
   - 验证连接信息是否正确记录
   - 检查界面标签是否正确显示连接类型
