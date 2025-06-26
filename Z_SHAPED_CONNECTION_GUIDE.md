# 四段式 Z 字形折线连接指南

## 概述

本项目已成功实现了四段式 Z 字形折线算法，优化了甘特图节点连线的视觉效果和一致性。新算法提供了更加标准化、美观的连线体验。

## 核心特性

### 1. 标准四段式 Z 字形算法

采用经典的四段式连线路径：

- **第一段**：从源节点水平延伸
- **第二段**：垂直转向目标行
- **第三段**：水平移动到目标区域
- **第四段**：垂直连接到目标节点

### 2. 智能路径优化

- **智能偏移计算**：根据节点间距自动调整水平偏移距离
- **垂直间距优化**：根据行距避免多条连线重叠
- **同行特殊处理**：同行连线使用曲线或特殊避让策略
- **精确坐标渲染**：确保路径点为整数，避免模糊渲染

### 3. 连线避障算法 ⭐ 新增

- **节点冲突检测**：自动检测连线是否穿过其他任务节点
- **连线交叉避免**：智能计算偏移值，避免多条连线重叠
- **动态偏移调整**：根据冲突数量自动增加偏移距离
- **矩形相交算法**：精确判断连线与节点的相交关系

### 4. 高级缓存机制 ⭐ 新增

- **布局哈希检测**：基于任务位置和依赖关系生成哈希值，检测布局变化
- **多层级缓存**：路径计算缓存、可视区域缓存、连线冲突缓存
- **智能失效策略**：仅在布局真正变化时清除缓存
- **可视区域过滤**：仅渲染可视区域内的连接线，提升大型项目性能

### 5. 依赖类型支持

支持所有四种项目依赖类型：

- **FS (Finish-To-Start)**：完成到开始
- **SS (Start-To-Start)**：开始到开始
- **FF (Finish-To-Finish)**：完成到完成
- **SF (Start-To-Finish)**：开始到完成

## 使用方法

### 基本使用

```vue
<template>
  <GanttBars
    :tasks="tasks"
    :dependencies="dependencies"
    :connection-style="'z-shaped'"
    :show-dependency-lines="true"
  />
</template>
```

### 配置选项

#### connectionStyle

控制连线样式模式：

- `'z-shaped'`：使用 Z 字形连线（默认）
- `'traditional'`：使用传统连线样式

```vue
<!-- 使用Z字形连线 -->
<GanttBars :connection-style="'z-shaped'" />

<!-- 使用传统连线 -->
<GanttBars :connection-style="'traditional'" />
```

#### 其他相关配置

```vue
<GanttBars
  :show-dependency-lines="true"
  :connection-editable="true"
  :connection-default-color="'#666'"
  :show-connection-labels="true"
/>
```

## 算法原理

### 路径计算流程

1. **方向检测**：根据依赖类型确定起始和结束方向
2. **偏移计算**：计算水平偏移距离和垂直间距
3. **路径生成**：创建标准四段式 Z 字形路径
4. **坐标优化**：精确到整数坐标，优化渲染效果

### 智能优化特性

#### 动态偏移调整

```javascript
// 根据任务间距调整偏移
if (taskDistance < 100) {
  return baseOffset + 20; // 距离较近时增加偏移
} else if (taskDistance > 300) {
  return Math.max(baseOffset - 10, 20); // 距离较远时减少偏移
}
```

#### 垂直间距计算

```javascript
// 根据行差调整垂直间距
if (rowDifference <= 1) {
  return baseSpacing;
} else if (rowDifference <= 3) {
  return baseSpacing + 10;
} else {
  return baseSpacing + Math.min(rowDifference * 5, 30);
}
```

## 性能特性

### 优化亮点

- **统一算法**：所有依赖类型使用相同的 Z 字形算法
- **智能缓存**：布局哈希检测 + 多层级缓存机制
- **避障算法**：连线冲突检测 + 动态偏移计算
- **可视区域过滤**：仅渲染可视区域内的连接线
- **渲染优化**：整数坐标避免浏览器子像素渲染
- **节流处理**：滚动事件节流，60fps 更新频率
- **向后兼容**：保留传统连线算法，支持平滑迁移

### 缓存机制详解

```javascript
// 布局哈希检测 - 自动识别布局变化
generateLayoutHash() {
  const taskPositions = this.taskBars.map(bar =>
    `${bar.task.id}_${bar.left}_${bar.width}_${bar.index}`
  ).join('|')

  const dependencyStr = this.storeDependencies.map(dep =>
    `${dep.from}_${dep.to}_${dep.type}_${dep.lag || 0}`
  ).join('|')

  // 返回哈希值检测变化
  return simpleHash(`${taskPositions}:${dependencyStr}:${viewState}`)
}

// 可视区域缓存 - 性能提升
getVisibleTaskIds() {
  const cacheKey = this.generateVisibleAreaCacheKey()
  if (this._visibleAreaCache?.key === cacheKey) {
    return this._visibleAreaCache.taskIds // 缓存命中
  }

  // 重新计算可视区域
  const visibleTaskIds = this.calculateVisibleTasks()
  this._visibleAreaCache = { key: cacheKey, taskIds: visibleTaskIds }
  return visibleTaskIds
}
```

### 避障算法详解

```javascript
// 连线冲突检测
calculateCollisionAvoidanceOffset(fromX, fromY, toX, toY, fromBar, toBar, type) {
  // 1. 检测节点冲突
  const conflictingBars = this.detectNodeConflicts(fromX, fromY, toX, toY, fromBar, toBar)

  // 2. 检测连线冲突
  const conflictingLines = this.detectLineConflicts(fromX, fromY, toX, toY, connectionKey)

  // 3. 计算避障偏移
  const horizontalOffset = conflictingBars.length * 8
  const verticalOffset = conflictingLines.length * 12

  return { horizontal: horizontalOffset, vertical: verticalOffset }
}
```

### 性能对比

| 特性       | Z 字形算法 | 传统算法  |
| ---------- | ---------- | --------- |
| 视觉一致性 | ✅ 高      | ❌ 中等   |
| 算法复杂度 | ✅ 简单    | ❌ 复杂   |
| 渲染性能   | ✅ 优秀    | ⚠️ 良好   |
| 维护性     | ✅ 易维护  | ❌ 难维护 |

## 最佳实践

### 1. 样式选择建议

```javascript
// 新项目推荐使用Z字形
connectionStyle: "z-shaped";

// 现有项目可保持传统样式
connectionStyle: "traditional";
```

### 2. 依赖关系规划

- 优先使用 **FS (Finish-To-Start)** 类型，视觉效果最佳
- 合理规划任务层级，避免过多交叉连线
- 保持适当的任务间距，确保连线清晰

### 3. 视觉优化技巧

```vue
<template>
  <GanttBars
    :connection-style="'z-shaped'"
    :show-connection-labels="true"
    :connection-editable="true"
  >
    <!-- 启用连线标签提升可读性 -->
    <!-- 支持连线编辑增强交互性 -->
  </GanttBars>
</template>
```

## 调试与问题解决

### 常见问题

1. **连线显示异常**

   - 检查 `showDependencyLines` 是否为 true
   - 确认依赖数据格式正确

2. **连线位置偏移**

   - 验证任务坐标计算是否准确
   - 检查容器尺寸变化情况

3. **性能问题**
   - 启用连线缓存 `USE_CACHE: true`
   - 减少不必要的依赖关系

### 调试模式

```javascript
// 在开发模式下启用详细日志
if (process.env.NODE_ENV === "development") {
  console.log("[Z字形连线] 路径计算:", pathData);
}
```

## 升级指南

### 从传统连线升级

1. **修改配置**：

   ```javascript
   // 旧配置
   connectionStyle: "traditional";

   // 新配置
   connectionStyle: "z-shaped";
   ```

2. **测试验证**：

   - 验证所有依赖类型显示正常
   - 检查连线交互功能正常
   - 确认性能无明显下降

3. **渐进式升级**：
   - 可先在新功能中使用 Z 字形连线
   - 逐步迁移现有功能
   - 保留传统算法作为备选

## 技术细节

### 核心方法

- `createZShapedPath()`: Z 字形路径生成核心
- `calculateHorizontalOffset()`: 水平偏移计算
- `calculateVerticalSpacing()`: 垂直间距计算
- `createStandardZPath()`: 标准 Z 字形路径创建

### 配置参数

- `baseOffset: 40`: 基础水平偏移距离
- `baseSpacing: 20`: 基础垂直间距
- `midY calculation`: 智能转折点计算

---

通过使用四段式 Z 字形折线算法，您的甘特图连线将获得更加专业、一致的视觉效果。

## 修复问题记录

### 1. Map 初始化错误修复

**问题**: `Cannot read properties of undefined (reading 'clear')`
**原因**: Vue 组件 data 中直接创建 Map 对象可能导致 undefined
**解决方案**:

- data 中声明 Map 为 null，延迟到 mounted 初始化
- 创建统一初始化方法`initializeCacheMaps()`
- 所有 Map 操作前添加安全检查

### 2. 连线高亮功能修复

**问题**: 点击连线高亮功能丢失
**原因**: selectDependencyLine 方法缺少强制更新和事件通知
**解决方案**:

- 增加调试日志和`$forceUpdate()`强制更新
- 添加`dependency-select`事件发射
- 确保选中状态正确传递到视图

### 3. Milestone 连线箭头修复

**问题**: 连接到 milestone 类型的连线箭头看不到
**原因**: SVG 箭头标记尺寸过小，milestone 连线路径计算不当
**解决方案**:

- 增大箭头标记尺寸（10x10 -> 12x12）
- 增强 stroke-width 提高可见性（0.5 -> 0.8）
- 特殊处理 milestone 连线路径延伸 8px
- 优化`isEndPointConnection`判断逻辑
- 添加完整依赖对象引用到 line 数据结构

### 修复代码示例

```javascript
// 连线高亮修复
selectDependencyLine(line, event) {
  event.stopPropagation()
  console.log('[调试] 连线被点击', line)

  this.selectedDependency = { from: line.from, to: line.to }
  this.hideColorPicker()
  this.$forceUpdate() // 强制更新确保选中状态生效
  this.$emit('dependency-select', line) // 发出选中事件
}

// Milestone箭头修复
// 增大箭头标记尺寸
<marker id="arrow-default" markerWidth="12" markerHeight="12" refX="10" refY="6">
  <path d="M 2,2 L 2,10 L 10,6 Z" fill="#666" stroke="white" stroke-width="0.8"/>
</marker>

// 特殊处理milestone连线延伸
const isMilestoneTarget = toBar.task.type === 'milestone'
if (isMilestoneTarget) {
  const extendLength = 8
  // 路径延伸逻辑确保箭头可见
  path = path.replace(/L\s*([\d.]+)\s+([\d.]+)$/, `L ${extendX} ${lastY}`)
}
```
