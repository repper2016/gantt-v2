# Vue.js Gantt Chart Component

一个功能强大的 Vue.js 甘特图组件，具有 dhtmlx 风格的专业界面和完整的项目管理功能。

## 🚀 特性

### 核心功能

- **任务管理**: 创建、编辑、删除任务
- **进度控制**: 拖拽调整任务进度百分比
- **依赖关系**: 可视化任务依赖连接线
- **里程碑**: 支持里程碑任务类型
- **计划对比**: 显示计划时间 vs 实际时间
- **三级任务结构**: 支持父级->子级->孙级三层任务嵌套

### dhtmlx 风格界面

- **外部连接点**: 任务条外部的专业连接点
- **智能连接线**: 支持自定义颜色和标签的依赖线
- **进度拖拽**: dhtmlx 风格的进度调整手柄
- **连接预览**: 拖拽时的实时连线预览
- **专业样式**: 阴影、圆角、动画等现代 UI 效果

### 交互功能

- **拖拽**: 任务时间调整和位置移动
- **调整大小**: 拖拽任务条左右边缘调整时间范围
- **连接线编辑**: 双击连接线编辑颜色和标签
- **智能提示**: 详细的任务信息 tooltip
- **键盘支持**: 完整的键盘操作支持

### 性能优化

- **虚拟滚动**: 大数据集渲染优化
- **RAF 优化**: 60FPS 流畅动画
- **缓存机制**: 依赖线计算缓存
- **事件节流**: 防抖优化用户交互
- **自动优化**: 根据任务数量自动启用性能优化

### 用户界面优化

- **统一设置面板**: 所有控制功能集中在设置对话框中
- **精简操作栏**: 只保留最常用的快捷操作
- **智能布局**: 自适应界面布局，节省空间

## 🚀 性能优化

### 拖拽性能优化

为了解决左右拖拽节点时的卡顿问题，项目实施了多层次的性能优化策略：

#### 核心优化技术

1. **RAF 节流机制**

   - 使用`requestAnimationFrame`控制拖拽更新频率
   - 将更新频率限制在显示器刷新率内（通常 60fps）
   - 避免不必要的 DOM 重绘和重流

2. **计算结果缓存**

   - 缓存拖拽过程中的日期和位置计算结果
   - 只在鼠标位置变化时重新计算
   - 减少重复的时间复杂计算

3. **简化平滑算法**

   - 优化父节点拖拽的平滑移动算法
   - 减少复杂的停止检测和速度计算
   - 使用固定平滑系数提升性能

4. **CSS Transform 优化**

   - 使用`transform: translateX()`代替位置重新计算
   - 利用 GPU 加速减少 CPU 负担
   - 避免触发布局重排（reflow）

5. **批量 DOM 更新**

   - 将多个 DOM 操作合并为单次更新
   - 使用 RAF 管理更新时机
   - 减少页面重绘次数

6. **事件节流优化**
   - 滚动检查频率降低到 30fps
   - 数据更新事件使用 16ms 节流
   - 平衡响应性和性能消耗

#### 性能监控工具

项目内置了拖拽性能测试工具，可以实时监控拖拽性能：

```javascript
// 在设置中启用性能测试
ganttDisplayConfig.enableDragPerformanceTest = true;
```

**性能指标说明：**

- **平均 FPS > 55**：优秀，拖拽非常流畅
- **平均 FPS 45-55**：良好，拖拽流畅
- **平均 FPS 30-45**：一般，轻微延迟但可接受
- **平均 FPS < 30**：需要优化，明显卡顿

#### 配置参数

可以通过修改`src/config/performance.js`调整性能参数：

```javascript
export const PERFORMANCE_CONFIG = {
  RENDERING: {
    DRAG_THROTTLE: 16, // 拖拽节流时间(ms) - 60fps
    SCROLL_THROTTLE: 16, // 滚动节流时间(ms)
    BATCH_DELAY: 0, // 批处理延迟
  },
};
```

#### 使用建议

1. **大量任务时**：自动启用虚拟滚动优化
2. **低性能设备**：可适当提高节流时间
3. **高刷新率显示器**：可降低节流时间获得更流畅体验
4. **性能测试**：在开发环境启用性能监控以调优参数

## 📦 安装

```bash
npm install
npm run serve
```

## 🎯 快速开始

### 基础使用

#### 设置面板功能

甘特图提供了统一的设置面板，集成了所有主要控制功能：

- **日期范围设置**: 自定义甘特图时间范围或使用自动范围
- **显示设置**: 控制 Tooltip、概览时间轴等显示选项
- **连接线设置**: 管理任务依赖连接线的显示和样式
- **性能优化**: 启用/禁用自动优化功能
- **数据操作**: 快速跳转到今天、添加任务、导出数据、生成测试数据

#### 三级任务结构

支持完整的三级任务嵌套：

- **第一级**: 项目/模块级别
- **第二级**: 功能/组件级别
- **第三级**: 具体任务/工作项

#### 里程碑任务

支持里程碑类型任务，用于标记重要时间节点：

- 设置 `milestone: true` 创建里程碑任务
- 里程碑任务在甘特图中以特殊样式显示
- 通常用于项目重要节点和交付物标记

```vue
<template>
  <div id="app">
    <GanttChart
      :tasks="tasks"
      :dependencies="dependencies"
      start-date="2024-01-01"
      end-date="2024-12-31"
      :tooltip-enabled="true"
      :tooltip-delay="1000"
    />
  </div>
</template>

<script>
import GanttChart from "./components/GanttChart.vue";

export default {
  components: {
    GanttChart,
  },
  data() {
    return {
      tasks: [
        {
          id: 1,
          name: "Project Planning",
          startDate: "2024-01-01",
          endDate: "2024-01-15",
          progress: 100,
          color: "#3498db",
        },
        {
          id: 2,
          name: "Development",
          startDate: "2024-01-16",
          endDate: "2024-03-15",
          progress: 60,
          color: "#2ecc71",
        },
      ],
      dependencies: [
        {
          id: "dep1",
          from: 1,
          to: 2,
          type: "finish-to-start",
          color: "#3498db",
          label: "Dependency",
        },
      ],
    };
  },
};
</script>
```

### 高级配置

```vue
<template>
  <GanttChart
    :tasks="tasks"
    :dependencies="dependencies"
    start-date="2024-01-01"
    end-date="2024-12-31"

    <!-- Tooltip配置 -->
    :tooltip-enabled="true"
    :tooltip-delay="800"
    :tooltip-hide-delay="200"

    <!-- 性能配置 -->
    :virtual-scroll="true"
    :chunk-size="50"

    <!-- 显示配置 -->
    :show-progress="true"
    :show-dependencies="true"
    :show-milestones="true"

    <!-- 事件监听 -->
    @task-updated="handleTaskUpdate"
    @dependency-created="handleDependencyCreate"
    @task-selected="handleTaskSelect"
  />
</template>
```

## 📋 API 文档

### Props

| 属性               | 类型    | 默认值  | 描述                 |
| ------------------ | ------- | ------- | -------------------- |
| `tasks`            | Array   | `[]`    | 任务数据数组         |
| `dependencies`     | Array   | `[]`    | 依赖关系数组         |
| `startDate`        | String  | -       | 甘特图开始日期       |
| `endDate`          | String  | -       | 甘特图结束日期       |
| `tooltipEnabled`   | Boolean | `true`  | 启用/禁用 tooltip    |
| `tooltipDelay`     | Number  | `1000`  | Tooltip 显示延迟(ms) |
| `tooltipHideDelay` | Number  | `300`   | Tooltip 隐藏延迟(ms) |
| `virtualScroll`    | Boolean | `false` | 启用虚拟滚动         |
| `chunkSize`        | Number  | `50`    | 虚拟滚动块大小       |

### 任务对象结构

```javascript
{
  id: Number|String,           // 唯一标识
  name: String,                // 任务名称
  startDate: String,           // 开始日期 (YYYY-MM-DD)
  endDate: String,             // 结束日期 (YYYY-MM-DD)
  progress: Number,            // 进度百分比 (0-100)
  color: String,               // 任务条颜色
  milestone: Boolean,          // 是否为里程碑
  isParentNode: Boolean,       // 是否为父任务
  planStartDate: String,       // 计划开始日期
  planEndDate: String,         // 计划结束日期
  children: Array,             // 子任务数组（支持三级嵌套）
  level: Number,               // 任务层级 (0:一级, 1:二级, 2:三级)
  parentId: String,            // 父任务ID
  assignee: String,            // 分配人员
  priority: String,            // 优先级 ('low', 'medium', 'high', 'critical')
  description: String,         // 任务描述
  department: String,          // 所属部门
  taskType: String,            // 任务类型
  estimatedHours: Number,      // 预估工时
  actualHours: Number,         // 实际工时
  tags: Array                  // 标签数组
}
```

#### 三级任务结构示例

```javascript
[
  {
    id: "project_1",
    name: "Development Project",
    level: 0,
    isParentNode: true,
    children: [
      {
        id: "module_1",
        name: "Frontend Module",
        level: 1,
        parentId: "project_1",
        isParentNode: true,
        children: [
          {
            id: "task_1",
            name: "UI Component Implementation",
            level: 2,
            parentId: "module_1",
            startDate: "2024-01-01",
            endDate: "2024-01-15",
            progress: 50,
            milestone: false,
          },
          {
            id: "milestone_1",
            name: "Frontend Module Completion",
            level: 2,
            parentId: "module_1",
            startDate: "2024-01-30",
            endDate: "2024-01-30",
            progress: 0,
            milestone: true, // 里程碑任务
          },
        ],
      },
    ],
  },
];
```

### 依赖关系对象结构

```javascript
{
  id: String,                  // 依赖ID
  from: Number|String,         // 源任务ID
  to: Number|String,           // 目标任务ID
  type: String,                // 依赖类型: 'finish-to-start', 'start-to-start', etc.
  color: String,               // 连接线颜色
  label: String                // 连接线标签
}
```

### Events

| 事件名               | 参数               | 描述           |
| -------------------- | ------------------ | -------------- |
| `task-updated`       | `(task)`           | 任务更新时触发 |
| `task-created`       | `(task)`           | 任务创建时触发 |
| `task-deleted`       | `(taskId)`         | 任务删除时触发 |
| `dependency-created` | `(dependency)`     | 依赖创建时触发 |
| `dependency-updated` | `(dependency)`     | 依赖更新时触发 |
| `dependency-deleted` | `(dependencyId)`   | 依赖删除时触发 |
| `task-selected`      | `(task)`           | 任务选中时触发 |
| `progress-changed`   | `(task, progress)` | 进度改变时触发 |

## 🎨 主题定制

### CSS 变量

```css
:root {
  --gantt-primary-color: #3498db;
  --gantt-success-color: #2ecc71;
  --gantt-warning-color: #f39c12;
  --gantt-danger-color: #e74c3c;
  --gantt-border-color: #ddd;
  --gantt-background-color: #fff;
  --gantt-text-color: #333;
  --gantt-hover-color: #f8f9fa;
}
```

### 自定义样式

```css
/* 任务条样式 */
.gantt-bar {
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* 连接线样式 */
.gantt-dependency-line {
  stroke-width: 2px;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
}

/* Tooltip样式 */
.gantt-tooltip {
  background: rgba(0, 0, 0, 0.9);
  color: white;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
```

## 🔧 开发指南

### 本地开发

```bash
# 克隆项目
git clone <repository-url>

# 安装依赖
npm install

# 启动开发服务器
npm run serve

# 构建生产版本
npm run build
```

### 项目结构

```
src/
├── components/
│   ├── GanttChart.vue      # 主甘特图组件
│   ├── GanttBars.vue       # 任务条渲染组件
│   ├── GanttTimeline.vue   # 时间轴组件
│   └── TaskTable.vue       # 任务表格组件
├── store/
│   └── gantt.js           # Vuex状态管理
├── config/
│   └── performance.js     # 性能配置
└── testData/
    └── sampleData.js      # 测试数据
```

### 组件开发

```vue
<!-- 创建自定义甘特图组件 -->
<template>
  <div class="custom-gantt">
    <GanttChart v-bind="ganttProps" @task-updated="handleTaskUpdate" />
  </div>
</template>

<script>
import GanttChart from "./GanttChart.vue";

export default {
  components: { GanttChart },
  computed: {
    ganttProps() {
      return {
        tasks: this.processedTasks,
        dependencies: this.processedDependencies,
        // 其他配置...
      };
    },
  },
  methods: {
    handleTaskUpdate(task) {
      // 处理任务更新逻辑
      this.$emit("task-change", task);
    },
  },
};
</script>
```

## 📊 测试数据

项目包含完整的测试数据生成功能，支持：

### 三级测试数据生成

- **层级结构**: 自动生成父级->子级->孙级三层任务结构
- **数据规模**: 支持生成 100、500、1000、2000 个任务
- **智能分布**: 根据设定数量合理分配到各个层级
- **随机属性**: 自动生成日期、进度、优先级、分配人等属性

### 里程碑数据

- **自动标记**: 10%概率随机生成里程碑任务
- **专门示例**: 初始数据中包含完整的里程碑任务示例
- **关键节点**: 标记项目重要时间节点和交付物

### 使用测试数据

1. 点击甘特图右上角的"Settings"按钮
2. 在设置面板的"数据操作"部分选择"Generate Test Data"
3. 选择要生成的任务数量
4. 系统自动生成对应的三级层次结构数据

测试数据包含：

- 多种任务类型（功能开发、Bug 修复、文档编写等）
- 不同优先级和状态
- 完整的工时估算数据
- 部门和人员分配信息

## ⚡ 性能优化

### 大数据集处理

```javascript
// 启用虚拟滚动
<GanttChart
  :virtual-scroll="true"
  :chunk-size="100"
  :tasks="largeTasks"
/>

// 使用数据分页
const chunkedTasks = computed(() => {
  return tasks.value.slice(0, visibleCount.value)
})
```

### 渲染优化

```javascript
// 使用防抖处理频繁更新
import { debounce } from "lodash";

const debouncedUpdate = debounce((task) => {
  updateTask(task);
}, 100);
```

## 🐛 故障排除

### 常见问题

1. **任务不显示**: 检查日期格式是否为 YYYY-MM-DD
2. **拖拽无响应**: 确保任务不是父任务且未锁定
3. **依赖线不显示**: 验证任务 ID 是否正确匹配
4. **性能问题**: 启用虚拟滚动或减少任务数量

### 调试技巧

```javascript
// 启用调试模式
Vue.config.devtools = true;

// 监控性能
console.time("gantt-render");
// 渲染代码
console.timeEnd("gantt-render");
```

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 📞 支持

如有问题，请通过以下方式联系：

- 提交 Issue
- 发送邮件
- 查看文档

---

**享受使用 Vue Gantt Chart！** 🎉
