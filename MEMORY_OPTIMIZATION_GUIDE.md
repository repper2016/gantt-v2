# Vue 甘特图项目内存优化指南

## 🧠 内存优化概述

本指南专门解决 Vue 甘特图项目中的内存使用问题，提供实用的优化策略和监控方法。

## 🎯 当前优化状态

✅ **已实现的内存优化**:

- 智能内存阈值（开发环境 200MB，生产环境 100MB）
- 内存使用趋势分析
- 自动垃圾回收建议
- 组件资源自动清理
- 性能监控数据限制

## 📊 内存监控系统

### 新的监控特性

1. **智能阈值调整**

   ```javascript
   // 开发环境阈值更宽松
   warningThreshold: 200MB (开发) / 100MB (生产)
   errorThreshold: 300MB (开发) / 200MB (生产)
   ```

2. **内存趋势分析**

   - 🟢 稳定：内存使用平稳
   - 🔴 上升：内存持续增长（需要关注）
   - 🟢 下降：内存使用减少

3. **可视化指示器**
   - 性能监控条显示内存趋势箭头
   - ↗ 表示内存增长
   - ↘ 表示内存下降

## 🔧 内存优化工具

### 1. 性能监控面板

在开发环境下，顶部的性能监控条提供：

- **实时内存使用**: 当前内存占用量
- **趋势指示器**: 内存使用趋势
- **清理按钮**: 🧹 清理性能监控数据
- **垃圾回收**: 🗑️ 强制执行垃圾回收

### 2. 控制台命令

```javascript
// 在浏览器控制台执行

// 1. 检查内存使用
this.$root.checkMemoryUsage();

// 2. 强制垃圾回收（需要 --expose-gc 参数）
this.$root.forceGarbageCollection();

// 3. 清理性能数据
this.$root.clearPerformanceData();

// 4. 获取性能摘要
globalPerformanceConfig.getPerformanceSummary();
```

### 3. 启动参数优化

为了更好的内存调试，启动时添加参数：

```bash
# Windows
set NODE_OPTIONS=--max-old-space-size=4096 --expose-gc && npm run serve

# Mac/Linux
NODE_OPTIONS="--max-old-space-size=4096 --expose-gc" npm run serve
```

## 🛠️ 常见内存问题解决方案

### 1. 开发环境内存使用过高

**问题**: 开发环境下内存使用 160-200MB

**解决方案**:

```javascript
// 1. 这是正常现象，开发环境包含：
// - Vue DevTools
// - webpack-dev-server
// - 热重载模块
// - Source Maps
// - 开发版 Vue（包含更多调试信息）

// 2. 已优化措施：
// - 调整开发环境阈值到 200MB
// - 减少性能监控频率
// - 限制历史数据大小
```

### 2. 内存持续增长

**问题**: 内存使用趋势显示持续上升

**解决方案**:

```javascript
// 1. 检查组件清理
beforeDestroy() {
  // 清理定时器
  if (this.timer) clearInterval(this.timer)

  // 清理事件监听器
  if (this.resizeListener) {
    window.removeEventListener('resize', this.resizeListener)
  }

  // 清理大对象引用
  this.largeDataArray = null
}

// 2. 使用性能 Mixin 自动清理
import { PerformanceMixin } from '@/mixins/performance'

export default {
  mixins: [PerformanceMixin], // 自动清理资源
  // ...
}
```

### 3. 大数据集内存优化

**问题**: 处理大量甘特图数据时内存占用高

**解决方案**:

```javascript
// 1. 启用虚拟滚动（自动启用 > 500 条数据）
computed: {
  shouldUseVirtualScrolling() {
    return this.tasks.length > 500
  }
}

// 2. 数据分页加载
async loadTasks(page = 1, pageSize = 100) {
  const response = await api.getTasks({ page, pageSize })
  // 只保留当前页和前后各一页的数据
  this.managePaginatedData(response.data)
}

// 3. 对象池重用
const objectPool = {
  taskObjects: [],
  getTask() {
    return this.taskObjects.pop() || { /* 默认结构 */ }
  },
  releaseTask(task) {
    // 重置对象
    Object.keys(task).forEach(key => task[key] = null)
    this.taskObjects.push(task)
  }
}
```

## 📈 内存监控最佳实践

### 1. 监控策略

```javascript
// 定期检查内存趋势
setInterval(() => {
  const summary = globalPerformanceConfig.getPerformanceSummary();
  if (summary?.memoryTrend === "increasing") {
    console.warn("内存使用呈上升趋势，建议检查");
  }
}, 30000); // 30秒检查一次
```

### 2. 自动优化触发

```javascript
// 根据内存使用自动调整配置
watch: {
  memoryUsage(newValue) {
    if (newValue > 250) {
      // 启用更激进的优化
      this.enableAggressiveOptimization()
    }
  }
}
```

### 3. 用户引导

```javascript
// 向用户提供内存优化建议
methods: {
  showMemoryOptimizationTips() {
    if (this.memoryUsage > 200) {
      this.$message({
        type: 'info',
        message: '数据量较大，建议启用虚拟滚动以提升性能',
        duration: 5000
      })
    }
  }
}
```

## 🎯 性能目标

### 内存使用目标

| 环境     | 目标内存使用 | 警告阈值 | 错误阈值 |
| -------- | ------------ | -------- | -------- |
| 开发环境 | < 150MB      | 200MB    | 300MB    |
| 生产环境 | < 80MB       | 100MB    | 200MB    |

### 监控指标

- **内存增长率**: < 1MB/分钟
- **垃圾回收频率**: 正常范围内
- **内存碎片**: 最小化
- **峰值内存**: 不超过错误阈值

## 🔍 调试工具

### 1. Chrome DevTools

```javascript
// 1. 打开 Performance 面板
// 2. 录制 5-10 秒的内存使用
// 3. 查看 Memory 图表，识别内存泄漏

// 快捷键：
// Ctrl+Shift+I -> Performance -> 录制
```

### 2. 内存快照对比

```javascript
// 1. 在 Memory 面板创建快照
// 2. 执行操作后再创建快照
// 3. 对比两个快照找出增长的对象
```

### 3. 自动内存分析

```javascript
// 在控制台运行内存分析
function analyzeMemoryUsage() {
  const memory = performance.memory;
  const result = {
    used: Math.round(memory.usedJSHeapSize / 1024 / 1024),
    total: Math.round(memory.totalJSHeapSize / 1024 / 1024),
    limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024),
    utilization: Math.round(
      (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
    ),
  };

  console.table(result);
  return result;
}
```

## 📋 内存优化检查清单

### 开发阶段

- [ ] 启用性能监控
- [ ] 检查内存使用趋势
- [ ] 确保组件正确清理资源
- [ ] 使用 PerformanceMixin
- [ ] 限制历史数据大小

### 测试阶段

- [ ] 长时间运行测试
- [ ] 内存使用压力测试
- [ ] 大数据集性能测试
- [ ] 内存泄漏检测

### 生产部署

- [ ] 设置内存监控
- [ ] 配置内存警报
- [ ] 优化服务器内存分配
- [ ] 监控用户反馈

## 🚨 故障排除

### 问题：内存使用过高警告

**解决步骤**:

1. 检查当前环境（开发/生产）
2. 查看内存使用趋势
3. 检查组件资源清理
4. 考虑启用虚拟滚动
5. 清理性能监控数据

### 问题：内存持续增长

**解决步骤**:

1. 使用 Chrome DevTools 录制内存
2. 检查定时器和事件监听器
3. 查看大对象引用
4. 执行强制垃圾回收
5. 重启应用验证

### 问题：应用变慢

**解决步骤**:

1. 检查 FPS 和渲染时间
2. 启用虚拟滚动
3. 减少不必要的计算
4. 优化事件处理
5. 使用防抖节流

## 📞 技术支持

如需更多帮助：

- 查看 [性能优化指南](./PERFORMANCE_OPTIMIZATIONS.md)
- 检查 [项目文档](./README.md)
- 运行 `node scripts/performance-test.js` 进行全面分析

---

**记住：开发环境的内存使用通常比生产环境高 50-100%，这是正常现象。** 🧠💡
