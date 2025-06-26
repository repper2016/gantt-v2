# 功能控制指南

## 项目概述

本指南将帮助您了解如何控制项目中的各种功能，特别是性能测试相关的配置。

**⚠️ 重要说明**: 项目现在使用纯 Vue 实现的时间轴概览，不再依赖第三方库。

---

## 功能控制配置

### 1. 性能监控控制

在 `src/config/features.js` 中控制性能监控功能：

```javascript
export const FEATURE_CONFIG = {
  // 性能监控功能
  performanceMonitoring: {
    enabled: process.env.NODE_ENV === "development", // 是否启用性能监控
    memoryMonitoring: process.env.NODE_ENV === "development", // 内存监控
    fpsMonitoring: process.env.NODE_ENV === "development", // FPS监控
  },

  // 调试功能
  debugging: {
    consoleOutput: false, // 控制台输出
    errorReporting: true, // 错误报告
    performanceLogs: false, // 性能日志
  },
};
```

### 2. 实验性功能

```javascript
// 实验性功能
experimental: {
  virtualScrolling: true, // 虚拟滚动
  intelligentCaching: true, // 智能缓存
  autoOptimization: true // 自动优化
}
```

---

## 性能测试模式

### 简化时间轴概览

项目使用纯 Vue 实现的简化时间轴，具有以下特点：

- ✅ 纯 Vue/CSS 实现，无第三方依赖
- ✅ 轻量级，快速渲染
- ✅ 响应式设计
- ✅ 基本的任务展示和时间线功能

---

## 性能控制台工具

在开发环境中，打开浏览器控制台可以使用以下工具：

```javascript
// 功能控制
FeatureConfig.enableDebugging(); // 启用调试
FeatureConfig.disableDebugging(); // 禁用调试
FeatureConfig.summary(); // 查看功能摘要

// 强制重新加载
FeatureConfig.forceReload();
```

---

## 性能测试检查清单

### 基础性能检查

- [ ] 性能监控面板显示正常
- [ ] FPS 保持在 30+ 以上
- [ ] 内存使用合理（< 100MB）
- [ ] 渲染时间 < 16ms

### 功能验证检查

- [ ] 时间轴概览正常显示
- [ ] 任务列表渲染正常
- [ ] 滚动性能流畅
- [ ] 交互响应及时

---

## 常见问题

### Q: 如何进一步优化性能？

A: 可以调整以下配置：

- 减少同时显示的任务数量
- 启用虚拟滚动
- 禁用调试输出

### Q: 如何监控内存使用？

A: 在开发环境中，顶部性能条会显示实时内存使用情况。

---

## 技术实现说明

- 时间轴概览使用纯 Vue 组件实现
- 去除了所有第三方时间轴库依赖
- 代码更清晰，维护成本更低
- 包大小显著减少

## 父级节点连线功能控制

### 功能描述

控制父级节点（包含子任务的节点）是否可以创建和参与任务间的连接线。

### 配置参数

- **参数名**: `allowParentConnection`
- **类型**: `Boolean`
- **默认值**: `false`
- **作用域**: GanttChart 组件

### 配置位置

#### 在 GanttChart 组件中：

```vue
<GanttChart :allow-parent-connection="true" :show-connections="true" />
```

#### 在 GanttView.vue 中：

```javascript
data() {
  return {
    allowParentConnection: false, // 默认禁用父节点连线
  }
}
```

### 实现细节

- 当 `allowParentConnection: false` 时，父节点不显示连接点，无法创建连接线
- 当 `allowParentConnection: true` 时，父节点显示连接点，可以与其他任务建立连接关系
- 配置通过 `GanttChart.vue` → `GanttBars.vue` 的 props 传递链实现
- 连接点显示逻辑：`showConnections && (allowParentConnection || !bar.task.isParentNode) && bar.task.type !== 'milestone'`

### 相关功能联动

- 需要配合 `showConnections: true` 才能生效
- 建议与 `connectionEditable: true` 一起使用以支持连接线编辑
- 可以与 `linkParentChildDates` 配合使用以保持时间关系一致性

### 使用场景

1. **项目阶段依赖**: 不同项目阶段之间的依赖关系
2. **里程碑连接**: 父级节点作为里程碑与其他任务的依赖
3. **资源约束建模**: 表示父级任务组之间的资源依赖关系
4. **复杂项目管理**: 需要多层级依赖关系的复杂项目

### 注意事项

- 启用后需要确保数据模型能够处理复杂的依赖关系
- 父节点时间范围通常由子节点计算，连接线可能影响这种自动计算
- 建议在启用前充分测试依赖关系的业务逻辑
