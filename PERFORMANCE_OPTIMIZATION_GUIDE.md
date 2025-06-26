# Vue Gantt Chart 性能优化指南

## 概述

本指南详细说明了 Vue 甘特图组件的性能优化功能，包括虚拟滚动、性能监控和自动优化系统。

## 核心优化功能

### 1. 虚拟滚动 (Virtual Scrolling)

虚拟滚动是处理大数据集的核心技术，只渲染可见区域的 DOM 元素。

#### 特性：

- **智能渲染**：只渲染可见区域 + 缓冲区的任务
- **动态高度**：支持可变行高度
- **缓冲区控制**：可配置上下缓冲区大小
- **滚动同步**：左右面板滚动同步

#### 配置参数：

```javascript
virtualScrollConfig: {
  itemHeight: 40,        // 每行高度
  containerHeight: 600,  // 容器高度
  bufferSize: 5         // 缓冲区大小
}
```

#### 使用场景：

- 超过 500 个任务时自动启用
- 手动切换：点击 "Virtual Scroll" 按钮
- 性能不佳时自动激活

### 2. 性能监控系统

实时监控甘特图的各项性能指标。

#### 监控指标：

- **FPS (帧率)**：实时帧率监控，目标 60 FPS
- **内存使用**：JavaScript 堆内存使用情况
- **渲染时间**：组件渲染耗时
- **DOM 节点数**：当前页面 DOM 元素总数
- **事件监听器**：估算的事件监听器数量

#### 性能等级：

- 🟢 **良好**：FPS ≥ 55，渲染时间 ≤ 8ms
- 🟡 **警告**：FPS ≥ 30，渲染时间 ≤ 16ms
- 🔴 **错误**：FPS < 30，渲染时间 > 16ms

#### 智能建议系统：

系统会根据性能指标自动提供优化建议：

- 低帧率警告
- 内存使用过高提醒
- 渲染时间优化建议
- 大数据集处理建议

### 3. 自动优化系统

基于性能数据的智能优化系统。

#### 自动优化触发条件：

- 任务数量 > 500 时启用虚拟滚动
- 平均渲染时间 > 16ms 时启用虚拟滚动
- 内存使用 > 100MB 时显示警告
- DOM 节点 > 5000 时显示优化建议

#### 配置参数：

```javascript
autoOptimizeConfig: {
  enabled: false,              // 是否启用自动优化
  maxTasksBeforeVirtual: 500,  // 启用虚拟滚动的任务数阈值
  maxRenderTime: 16,           // 最大可接受渲染时间(ms)
  performanceCheckInterval: 5000 // 性能检查间隔(ms)
}
```

## 使用指南

### 控制面板操作

#### 1. 虚拟滚动控制

```html
<!-- 虚拟滚动按钮 -->
<button class="btn btn-performance" @click="toggleVirtualScrolling">
  ⚡ Virtual Scroll
</button>
```

#### 2. 性能监控控制

```html
<!-- 性能监控按钮 -->
<button class="btn btn-monitor" @click="togglePerformanceMonitor">
  📊 Monitor
</button>
```

#### 3. 自动优化控制

```html
<!-- 自动优化按钮 -->
<button class="btn btn-auto-optimize" @click="handleAutoOptimizeToggle">
  🤖 Auto Optimize
</button>
```

### 性能监控面板

#### 实时指标显示：

- **FPS**：当前帧率
- **Memory**：内存使用量
- **Render Time**：渲染时间
- **Tasks**：任务总数

#### 详细统计：

- **Visible Tasks**：可见任务数
- **DOM Nodes**：DOM 节点数
- **Event Listeners**：事件监听器数
- **Scroll Events/s**：每秒滚动事件数

#### 性能图表：

- FPS 曲线（绿色）
- 渲染时间曲线（橙色）
- 内存使用曲线（红色）

#### 操作功能：

- **Reset**：重置所有指标
- **Export Report**：导出性能报告
- **Auto Optimize**：切换自动优化

## 最佳实践

### 1. 大数据集处理

对于超过 1000 个任务的项目：

```javascript
// 自动优化配置
this.optimizeForLargeData(); // 自动调整配置
this.useVirtualScrolling = true; // 启用虚拟滚动
this.virtualScrollConfig.bufferSize = Math.min(10, Math.ceil(taskCount / 100));
```

### 2. 性能监控策略

开发环境：

```javascript
performanceMonitorEnabled: process.env.NODE_ENV === "development";
```

生产环境：

```javascript
// 仅在必要时启用性能监控
performanceMonitorEnabled: this.taskCount > 500;
```

### 3. 内存优化

避免内存泄漏：

```javascript
beforeDestroy() {
  // 清理性能监控定时器
  this.cleanupPerformanceMonitoring()

  // 清理事件监听器
  if (this.resizeObserver) {
    this.resizeObserver.disconnect()
  }
}
```

### 4. 滚动优化

防抖滚动事件：

```javascript
handleScroll(event) {
  if (this.scrollTimer) {
    clearTimeout(this.scrollTimer)
  }

  this.scrollTimer = setTimeout(() => {
    this.handleScrollLogic(event)
  }, 16) // 约60fps
}
```

## API 参考

### 虚拟滚动组件属性

| 属性             | 类型          | 默认值 | 说明         |
| ---------------- | ------------- | ------ | ------------ |
| data             | Array         | []     | 数据列表     |
| columns          | Array         | []     | 列配置       |
| itemHeight       | Number        | 40     | 行高度       |
| containerHeight  | Number        | 400    | 容器高度     |
| bufferSize       | Number        | 5      | 缓冲区大小   |
| highlightedRowId | String/Number | null   | 高亮行 ID    |
| loading          | Boolean       | false  | 加载状态     |
| showStats        | Boolean       | false  | 显示性能统计 |

### 性能监控组件属性

| 属性             | 类型    | 默认值 | 说明       |
| ---------------- | ------- | ------ | ---------- |
| enabled          | Boolean | true   | 是否启用   |
| taskCount        | Number  | 0      | 任务总数   |
| visibleTaskCount | Number  | 0      | 可见任务数 |
| renderTime       | Number  | 0      | 渲染时间   |

### 事件

| 事件                 | 参数       | 说明         |
| -------------------- | ---------- | ------------ |
| row-click            | item       | 行点击事件   |
| scroll               | scrollInfo | 滚动事件     |
| sort                 | sortInfo   | 排序事件     |
| auto-optimize-toggle | enabled    | 自动优化切换 |

## 性能基准

### 小型项目 (< 100 任务)

- FPS: 60
- 渲染时间: < 5ms
- 内存使用: < 20MB
- 推荐：使用普通表格

### 中型项目 (100-500 任务)

- FPS: 55-60
- 渲染时间: 5-10ms
- 内存使用: 20-50MB
- 推荐：开启性能监控

### 大型项目 (500-2000 任务)

- FPS: 45-55
- 渲染时间: 10-16ms
- 内存使用: 50-100MB
- 推荐：启用虚拟滚动

### 超大项目 (> 2000 任务)

- FPS: 30-45
- 渲染时间: 16-30ms
- 内存使用: > 100MB
- 推荐：虚拟滚动 + 自动优化

## 故障排除

### 1. 滚动不流畅

```javascript
// 检查缓冲区设置
virtualScrollConfig.bufferSize = 3; // 减少缓冲区

// 启用虚拟滚动
this.useVirtualScrolling = true;
```

### 2. 内存使用过高

```javascript
// 清理未使用的数据
this.cleanupUnusedData();

// 实现数据分页
this.implementPagination();
```

### 3. 渲染性能差

```javascript
// 启用自动优化
this.autoOptimizeConfig.enabled = true;

// 减少DOM操作
this.optimizeDOMOperations();
```

### 4. 事件监听器过多

```javascript
// 使用事件委托
this.useEventDelegation();

// 及时清理监听器
this.cleanupEventListeners();
```

## 开发模式功能

### 性能调试

```javascript
// 显示性能统计
showStats: process.env.NODE_ENV === "development";

// 导出性能报告
exportPerformanceData();

// 实时性能监控
performanceMonitorEnabled: true;
```

### 调试信息

```javascript
console.log("Performance metrics:", {
  fps: this.fps,
  renderTime: this.currentRenderTime,
  taskCount: this.flattenTasks.length,
  memoryUsage: this.memoryUsage,
});
```

通过这些优化功能，Vue 甘特图可以高效处理包含数千个任务的大型项目，同时保持流畅的用户体验。
