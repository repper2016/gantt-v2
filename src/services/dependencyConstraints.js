import moment from 'moment'
import { DEPENDENCY_TYPE_CONFIG, isValidDependencyType, parseLagValue, validateLagValue } from '@/config/dependencyTypes'

/**
 * 依赖关系约束引擎
 * 负责处理四种依赖类型的日期计算和约束验证，支持lag时间偏移
 */
export class DependencyConstraintEngine {
  constructor(tasks, dependencies) {
    this.tasks = tasks || []
    this.dependencies = dependencies || []
    this.taskMap = this.buildTaskMap()
    this.dependencyGraph = this.buildDependencyGraph()
  }

  // 构建任务映射表，支持扁平化访问
  buildTaskMap() {
    const taskMap = new Map()
    const flattenTasks = (tasks) => {
      tasks.forEach(task => {
        // 统一用字符串id做映射，彻底消除类型不一致
        const idStr = String(task.id)
        taskMap.set(idStr, task)
        if (task.children && Array.isArray(task.children)) {
          flattenTasks(task.children)
        }
      })
    }
    flattenTasks(this.tasks)
    console.log(`[依赖约束引擎] 构建任务映射表完成，共 ${taskMap.size} 个任务`)
    return taskMap
  }

  // 构建依赖关系图
  buildDependencyGraph() {
    const graph = {
      predecessors: new Map(),
      successors: new Map()
    }
    console.log(`[依赖约束引擎] 开始构建依赖关系图，共 ${this.dependencies.length} 个依赖关系`)
    this.dependencies.forEach((dep, index) => {
      // 统一用字符串id
      const fromId = String(dep.from)
      const toId = String(dep.to)
      console.log(`[依赖约束引擎] 处理依赖关系 ${index + 1}: ${dep.from}(${typeof dep.from}) -> ${dep.to}(${typeof dep.to}) 标准化为 ${fromId} -> ${toId}`)

      // 解析和验证lag值
      const lagInfo = parseLagValue(dep.lag || 0)
      if (lagInfo.error) {
        console.warn(`依赖关系 ${fromId}->${toId} 的lag值无效:`, lagInfo.error)
      }

      // 前导任务的后续任务列表
      if (!graph.successors.has(fromId)) {
        graph.successors.set(fromId, [])
      }
      graph.successors.get(fromId).push({
        taskId: toId,
        type: dep.type || 'FS',
        lag: lagInfo.days,
        lagInfo: lagInfo,
        dependency: dep
      })

      // 后续任务的前导任务列表
      if (!graph.predecessors.has(toId)) {
        graph.predecessors.set(toId, [])
      }
      graph.predecessors.get(toId).push({
        taskId: fromId,
        type: dep.type || 'FS',
        lag: lagInfo.days,
        lagInfo: lagInfo,
        dependency: dep
      })
    })
    console.log(`[依赖约束引擎] 依赖关系图构建完成`)
    console.log(`[依赖约束引擎] Successors:`, Object.fromEntries(graph.successors))
    console.log(`[依赖约束引擎] Predecessors:`, Object.fromEntries(graph.predecessors))
    return graph
  }

  // 检测循环依赖
  detectCyclicDependency() {
    console.log('[依赖约束引擎] 开始检测循环依赖');

    const visited = new Set();
    const recStack = new Set();
    const cycles = [];

    // 深度优先搜索检测循环
    const dfs = (taskId, path = []) => {
      if (!taskId) return false;

      // 如果已经在递归栈中，发现循环
      if (recStack.has(taskId)) {
        // 找到循环的起点
        const cycleStartIndex = path.indexOf(taskId);
        if (cycleStartIndex !== -1) {
          // 提取循环路径
          const cycle = path.slice(cycleStartIndex).concat(taskId);
          cycles.push(cycle);
        }
        return true;
      }

      // 如果已经访问过且没有循环，跳过
      if (visited.has(taskId)) return false;

      // 标记为已访问
      visited.add(taskId);
      recStack.add(taskId);
      path.push(taskId);

      // 检查所有后继任务
      const successors = this.dependencyGraph.successors.get(taskId) || [];
      for (const successor of successors) {
        if (dfs(successor.taskId, [...path])) {
          return true;
        }
      }

      // 回溯，从递归栈中移除
      recStack.delete(taskId);
      return false;
    };

    // 对所有任务进行检查
    for (const taskId of this.taskMap.keys()) {
      if (!visited.has(taskId)) {
        dfs(taskId, []);
      }
    }

    const hasCycle = cycles.length > 0;
    if (hasCycle) {
      console.warn('[依赖约束引擎] 检测到循环依赖:', cycles);
    } else {
      console.log('[依赖约束引擎] 未检测到循环依赖');
    }

    return {
      hasCycle,
      cycles
    };
  }

  // 根据依赖类型和lag计算任务的约束日期
  calculateConstrainedDate(taskId, updates = {}) {
    console.log(`[约束计算] 开始计算任务 ${taskId} 的约束`)
    console.log(`[约束计算] 使用的更新:`, updates)

    const task = this.taskMap.get(taskId)
    if (!task) {
      throw new Error(`Task ${taskId} not found`)
    }

    // 获取当前任务的所有前导任务约束
    const predecessors = this.dependencyGraph.predecessors.get(taskId) || []
    console.log(`[约束计算] 任务 ${taskId} 有 ${predecessors.length} 个前导任务:`, predecessors)

    let earliestStart = null
    let earliestFinish = null
    let latestStart = null
    let latestFinish = null

    // 约束详情，用于调试和说明
    const constraintDetails = []

    predecessors.forEach((pred, index) => {
      console.log(`[约束计算] 处理前导任务 ${index + 1}: ${pred.taskId}, 类型: ${pred.type}, lag: ${pred.lag}`)

      const predTask = this.taskMap.get(pred.taskId)
      if (!predTask) {
        console.warn(`[约束计算] 前导任务 ${pred.taskId} 未找到，跳过`)
        return
      }

      console.log(`[约束计算] 前导任务详情:`, {
        id: predTask.id,
        name: predTask.name,
        startDate: predTask.startDate,
        endDate: predTask.endDate
      })

      // 获取前导任务的时间（可能是更新后的时间）
      const predStart = moment(updates[pred.taskId]?.startDate || predTask.startDate)
      const predEnd = moment(updates[pred.taskId]?.endDate || predTask.endDate)
      const lag = pred.lag || 0 // 使用解析后的天数

      console.log(`[约束计算] 前导任务时间范围: ${predStart.format('YYYY-MM-DD')} ~ ${predEnd.format('YYYY-MM-DD')}, lag: ${lag}`)

      // 根据依赖类型计算约束
      switch (pred.type) {
        case 'FS': // Finish-To-Start
          // 前导任务完成后，加上lag，后续任务才能开始
          const fsConstraint = predEnd.clone().add(lag, 'days')
          console.log(`[约束计算] FS约束: ${predEnd.format('YYYY-MM-DD')} + ${lag}天 = ${fsConstraint.format('YYYY-MM-DD')}`)

          if (!earliestStart || fsConstraint.isAfter(earliestStart)) {
            const oldEarliestStart = earliestStart ? earliestStart.format('YYYY-MM-DD') : 'null'
            earliestStart = fsConstraint
            console.log(`[约束计算] 更新最早开始时间: ${oldEarliestStart} -> ${earliestStart.format('YYYY-MM-DD')}`)
          }
          constraintDetails.push({
            type: 'FS',
            fromTask: predTask.name,
            constraint: 'earliestStart',
            date: fsConstraint.format('YYYY-MM-DD'),
            lag: lag,
            description: `${predTask.name} 完成后 ${lag > 0 ? `+${lag}天` : lag < 0 ? `${lag}天` : ''} 才能开始`
          })
          break

        case 'SS': // Start-To-Start
          // 前导任务开始后，加上lag，后续任务才能开始
          const ssConstraint = predStart.clone().add(lag, 'days')
          if (!earliestStart || ssConstraint.isAfter(earliestStart)) {
            earliestStart = ssConstraint
          }
          constraintDetails.push({
            type: 'SS',
            fromTask: predTask.name,
            constraint: 'earliestStart',
            date: ssConstraint.format('YYYY-MM-DD'),
            lag: lag,
            description: `${predTask.name} 开始后 ${lag > 0 ? `+${lag}天` : lag < 0 ? `${lag}天` : ''} 才能开始`
          })
          break

        case 'FF': // Finish-To-Finish
          // 前导任务完成后，加上lag，后续任务才能完成
          const ffConstraint = predEnd.clone().add(lag, 'days')
          if (!earliestFinish || ffConstraint.isAfter(earliestFinish)) {
            earliestFinish = ffConstraint
          }
          constraintDetails.push({
            type: 'FF',
            fromTask: predTask.name,
            constraint: 'earliestFinish',
            date: ffConstraint.format('YYYY-MM-DD'),
            lag: lag,
            description: `${predTask.name} 完成后 ${lag > 0 ? `+${lag}天` : lag < 0 ? `${lag}天` : ''} 才能完成`
          })
          break

        case 'SF': // Start-To-Finish
          // 前导任务开始后，加上lag，后续任务才能完成
          const sfConstraint = predStart.clone().add(lag, 'days')
          if (!earliestFinish || sfConstraint.isAfter(earliestFinish)) {
            earliestFinish = sfConstraint
          }
          constraintDetails.push({
            type: 'SF',
            fromTask: predTask.name,
            constraint: 'earliestFinish',
            date: sfConstraint.format('YYYY-MM-DD'),
            lag: lag,
            description: `${predTask.name} 开始后 ${lag > 0 ? `+${lag}天` : lag < 0 ? `${lag}天` : ''} 才能完成`
          })
          break
      }
    })

    const result = {
      taskId,
      constraints: {
        earliestStart: earliestStart ? earliestStart.format('YYYY-MM-DD') : null,
        earliestFinish: earliestFinish ? earliestFinish.format('YYYY-MM-DD') : null,
        latestStart: latestStart ? latestStart.format('YYYY-MM-DD') : null,
        latestFinish: latestFinish ? latestFinish.format('YYYY-MM-DD') : null
      },
      constraintDetails: constraintDetails
    }

    console.log(`[约束计算] 任务 ${taskId} 的最终约束结果:`, result)
    return result
  }

  // 验证任务日期是否符合约束
  validateTaskDates(taskId, startDate, endDate) {
    const constraints = this.calculateConstrainedDate(taskId)
    const taskStart = moment(startDate)
    const taskEnd = moment(endDate)
    const violations = []

    // 检查开始日期约束
    if (constraints.constraints.earliestStart) {
      const earliestStart = moment(constraints.constraints.earliestStart)
      if (taskStart.isBefore(earliestStart)) {
        violations.push({
          type: 'earliestStart',
          expected: earliestStart.format('YYYY-MM-DD'),
          actual: taskStart.format('YYYY-MM-DD'),
          message: `任务不能在 ${earliestStart.format('YYYY-MM-DD')} 之前开始`,
          relatedConstraints: constraints.constraintDetails.filter(c => c.constraint === 'earliestStart')
        })
      }
    }

    // 检查结束日期约束
    if (constraints.constraints.earliestFinish) {
      const earliestFinish = moment(constraints.constraints.earliestFinish)
      if (taskEnd.isBefore(earliestFinish)) {
        violations.push({
          type: 'earliestFinish',
          expected: earliestFinish.format('YYYY-MM-DD'),
          actual: taskEnd.format('YYYY-MM-DD'),
          message: `任务不能在 ${earliestFinish.format('YYYY-MM-DD')} 之前完成`,
          relatedConstraints: constraints.constraintDetails.filter(c => c.constraint === 'earliestFinish')
        })
      }
    }

    return {
      isValid: violations.length === 0,
      violations,
      constraintDetails: constraints.constraintDetails
    }
  }

  // 自动调整任务日期以符合约束（考虑lag影响）
  adjustTaskDates(taskId, newStartDate, newEndDate) {
    const constraints = this.calculateConstrainedDate(taskId)
    let adjustedStart = moment(newStartDate)
    let adjustedEnd = moment(newEndDate)
    const adjustments = []

    // 计算任务持续时间（保持duration不变）
    const originalDuration = adjustedEnd.diff(adjustedStart, 'days') + 1

    // 调整开始日期
    if (constraints.constraints.earliestStart) {
      const earliestStart = moment(constraints.constraints.earliestStart)
      if (adjustedStart.isBefore(earliestStart)) {
        adjustedStart = earliestStart.clone()
        adjustments.push({
          type: 'startDateAdjusted',
          from: newStartDate,
          to: adjustedStart.format('YYYY-MM-DD'),
          reason: 'Dependency constraint with lag',
          relatedConstraints: constraints.constraintDetails.filter(c => c.constraint === 'earliestStart')
        })
      }
    }

    // 调整结束日期
    if (constraints.constraints.earliestFinish) {
      const earliestFinish = moment(constraints.constraints.earliestFinish)
      if (adjustedEnd.isBefore(earliestFinish)) {
        adjustedEnd = earliestFinish.clone()
        adjustments.push({
          type: 'endDateAdjusted',
          from: newEndDate,
          to: adjustedEnd.format('YYYY-MM-DD'),
          reason: 'Dependency constraint with lag',
          relatedConstraints: constraints.constraintDetails.filter(c => c.constraint === 'earliestFinish')
        })
      }
    }

    // 确保结束日期不早于开始日期，保持任务持续时间
    if (adjustedEnd.isBefore(adjustedStart)) {
      adjustedEnd = adjustedStart.clone().add(originalDuration - 1, 'days')
      adjustments.push({
        type: 'endDateRecalculated',
        to: adjustedEnd.format('YYYY-MM-DD'),
        reason: '保持任务持续时间不变'
      })
    }

    // 如果开始日期被调整但结束日期约束不够强，重新计算结束日期以保持duration
    if (adjustments.some(a => a.type === 'startDateAdjusted') &&
        !adjustments.some(a => a.type === 'endDateAdjusted' || a.type === 'endDateRecalculated')) {
      const newEnd = adjustedStart.clone().add(originalDuration - 1, 'days')
      if (!newEnd.isSame(adjustedEnd)) {
        adjustedEnd = newEnd
        adjustments.push({
          type: 'endDateRecalculated',
          to: adjustedEnd.format('YYYY-MM-DD'),
          reason: '根据调整后的开始时间保持持续时间'
        })
      }
    }

    return {
      taskId,
      adjustedDates: {
        startDate: adjustedStart.format('YYYY-MM-DD'),
        endDate: adjustedEnd.format('YYYY-MM-DD')
      },
      adjustments,
      wasAdjusted: adjustments.length > 0,
      constraintDetails: constraints.constraintDetails
    }
  }

  // 级联更新：当一个任务日期变更时，更新所有受影响的后续任务
  cascadeTaskUpdate(taskId, newStartDate, newEndDate) {
    const updates = new Map();
    const queue = [{
      taskId,
      startDate: newStartDate,
      endDate: newEndDate,
      reason: 'User edit'
    }];

    const processed = new Set();

    while (queue.length > 0) {
      const current = queue.shift();

      if (processed.has(current.taskId)) {
        continue;
      }
      processed.add(current.taskId);

      // 调整当前任务的日期
      const adjustment = this.adjustTaskDates(current.taskId, current.startDate, current.endDate);
      updates.set(current.taskId, {
        ...adjustment,
        reason: current.reason
      });

      console.log(`[级联更新] 处理任务 ${current.taskId}, 更新结果:`, adjustment);

      // 检查前置任务
      const predecessors = this.dependencyGraph.predecessors.get(current.taskId) || [];
      predecessors.forEach(predecessor => {
        if (!processed.has(predecessor.taskId)) {
          const predecessorTask = this.taskMap.get(predecessor.taskId);
          if (predecessorTask) {
            // 计算前置任务的新约束
            const predecessorConstraints = this.calculateConstrainedDate(predecessor.taskId,
              Object.fromEntries(Array.from(updates.entries()).map(([id, data]) => [id, data.adjustedDates]))
            );

            console.log(`[级联更新] 前置任务 ${predecessor.taskId} 的约束:`, predecessorConstraints);

            queue.push({
              taskId: predecessor.taskId,
              startDate: predecessorTask.startDate,
              endDate: predecessorTask.endDate,
              reason: `Cascade from task ${current.taskId} (lag: ${predecessor.lag || 0}d)`
            });
          }
        }
      });

      // 检查后续任务
      const successors = this.dependencyGraph.successors.get(current.taskId) || [];
      successors.forEach(successor => {
        if (!processed.has(successor.taskId)) {
          const successorTask = this.taskMap.get(successor.taskId);
          if (successorTask) {
            // 计算后续任务的新约束
            const successorConstraints = this.calculateConstrainedDate(successor.taskId,
              Object.fromEntries(Array.from(updates.entries()).map(([id, data]) => [id, data.adjustedDates]))
            );

            console.log(`[级联更新] 后续任务 ${successor.taskId} 的约束:`, successorConstraints);

            queue.push({
              taskId: successor.taskId,
              startDate: successorTask.startDate,
              endDate: successorTask.endDate,
              reason: `Cascade from task ${current.taskId} (lag: ${successor.lag || 0}d)`
            });
          }
        }
      });
    }

    return Array.from(updates.values());
  }

  /**
   * 计算依赖关系的有效lag值范围
   * @param {string} fromTaskId 前导任务ID
   * @param {string} toTaskId 后续任务ID
   * @param {string} dependencyType 依赖类型
   * @returns {object} lag值范围建议
   */
  calculateLagRange(fromTaskId, toTaskId, dependencyType) {
    const fromTask = this.taskMap.get(fromTaskId)
    const toTask = this.taskMap.get(toTaskId)

    if (!fromTask || !toTask) {
      return {
        min: -999,
        max: 999,
        recommended: 0,
        warnings: ['任务不存在']
      }
    }

    const fromStart = moment(fromTask.startDate)
    const fromEnd = moment(fromTask.endDate)
    const toStart = moment(toTask.startDate)
    const toEnd = moment(toTask.endDate)

    const warnings = []
    let recommendedLag = 0

    // 根据依赖类型计算推荐的lag值
    switch (dependencyType) {
      case 'FS':
        recommendedLag = toStart.diff(fromEnd, 'days')
        if (recommendedLag < 0) {
          warnings.push(`当前任务时间安排导致负lag: ${recommendedLag}天`)
        }
        break
      case 'SS':
        recommendedLag = toStart.diff(fromStart, 'days')
        break
      case 'FF':
        recommendedLag = toEnd.diff(fromEnd, 'days')
        break
      case 'SF':
        recommendedLag = toEnd.diff(fromStart, 'days')
        break
    }

    return {
      min: -999,
      max: 999,
      recommended: recommendedLag,
      current: recommendedLag,
      warnings: warnings
    }
  }

  // 检查任务是否需要级联更新
  checkNeedsCascadeUpdate(taskId) {
    // 检查后续依赖
    const successors = this.dependencyGraph.successors.get(taskId) || [];
    // 检查前置依赖
    const predecessors = this.dependencyGraph.predecessors.get(taskId) || [];

    // 如果有后续依赖或前置依赖，都需要级联更新
    return successors.length > 0 || predecessors.length > 0;
  }

  // 获取受影响的前置任务列表（级联更新预览）
  getAffectedPredecessorTasksPreview(taskId, newStartDate, newEndDate) {
    console.log(`[前置任务影响预览] 开始分析任务 ${taskId} 对前置任务的影响`);
    console.log(`[前置任务影响预览] 新时间范围: ${newStartDate} ~ ${newEndDate}`);

    const affectedTasks = [];
    const queue = [{
      taskId,
      startDate: newStartDate,
      endDate: newEndDate,
      reason: 'User edit',
      depth: 0
    }];

    const processed = new Set();
    // 记录任务的临时更新状态
    const tempUpdates = {};
    tempUpdates[taskId] = {
      startDate: newStartDate,
      endDate: newEndDate
    };

    while (queue.length > 0) {
      const current = queue.shift();

      if (processed.has(current.taskId) || current.depth > 10) {
        continue; // 避免循环依赖和过深递归
      }
      processed.add(current.taskId);

      // 更新临时更新状态
      tempUpdates[current.taskId] = {
        startDate: current.startDate,
        endDate: current.endDate
      };

      // 检查前置任务
      const predecessors = this.dependencyGraph.predecessors.get(current.taskId) || [];
      console.log(`[前置任务影响预览] 任务 ${current.taskId} 有 ${predecessors.length} 个前置任务:`, predecessors);

      predecessors.forEach((predecessor, index) => {
        console.log(`[前置任务影响预览] 处理前置任务 ${index + 1}: ${predecessor.taskId}`);

        if (!processed.has(predecessor.taskId)) {
          const predecessorTask = this.taskMap.get(predecessor.taskId);
          if (predecessorTask) {
            console.log(`[前置任务影响预览] 找到前置任务详情:`, {
              id: predecessorTask.id,
              name: predecessorTask.name,
              currentStart: predecessorTask.startDate,
              currentEnd: predecessorTask.endDate
            });

            try {
              // 根据依赖类型计算前置任务是否需要调整
              let needsUpdate = false;
              let newStart = predecessorTask.startDate;
              let newEnd = predecessorTask.endDate;
              const lag = predecessor.lag || 0;

              // 获取当前任务的时间
              const currentTaskStart = moment(current.startDate);
              const currentTaskEnd = moment(current.endDate);

              // 获取前置任务的时间
              const predecessorStart = moment(predecessorTask.startDate);
              const predecessorEnd = moment(predecessorTask.endDate);

              switch (predecessor.type) {
                case 'FS': // Finish-To-Start
                  // 前置任务结束后，后续任务才能开始
                  // 如果后续任务开始时间变化，可能需要调整前置任务结束时间
                  {
                    // 创建副本以避免修改原始对象
                    const adjustedTaskStart = moment(current.startDate).subtract(lag, 'days');

                    // 检查是否需要更新前置任务
                    // 如果后续任务开始时间 - lag 与前置任务结束时间不一致，则需要更新
                    console.log(`[前置任务影响预览] FS关系比较: 后续任务开始时间(减去lag) ${adjustedTaskStart.format('YYYY-MM-DD')} vs 前置任务结束时间 ${predecessorEnd.format('YYYY-MM-DD')}`);

                    if (!adjustedTaskStart.isSame(predecessorEnd, 'day')) {
                      console.log(`[前置任务影响预览] FS关系: 后续任务开始时间 ${adjustedTaskStart.format('YYYY-MM-DD')} 与前置任务结束时间 ${predecessorEnd.format('YYYY-MM-DD')} 不一致`);

                      // 新的结束时间应该是后续任务开始时间减去lag
                      newEnd = adjustedTaskStart.format('YYYY-MM-DD');

                      // 保持任务持续时间不变
                      const duration = predecessorEnd.diff(predecessorStart, 'days');
                      newStart = moment(newEnd).subtract(duration, 'days').format('YYYY-MM-DD');
                      console.log(`[前置任务影响预览] FS关系: 计算新时间范围 ${newStart} ~ ${newEnd}, 持续时间 ${duration} 天`);
                      needsUpdate = true;
                    }
                  }
                  break;

                case 'SS': // Start-To-Start
                  // 前置任务开始后，后续任务才能开始
                  // 如果后续任务开始时间变化，可能需要调整前置任务开始时间
                  {
                    // 创建副本以避免修改原始对象
                    const adjustedTaskStart = moment(current.startDate).subtract(lag, 'days');

                    // 检查是否需要更新前置任务
                    // 如果后续任务开始时间 - lag 与前置任务开始时间不一致，则需要更新
                    console.log(`[前置任务影响预览] SS关系比较: 后续任务开始时间(减去lag) ${adjustedTaskStart.format('YYYY-MM-DD')} vs 前置任务开始时间 ${predecessorStart.format('YYYY-MM-DD')}`);

                    if (!adjustedTaskStart.isSame(predecessorStart, 'day')) {
                      console.log(`[前置任务影响预览] SS关系: 后续任务开始时间 ${adjustedTaskStart.format('YYYY-MM-DD')} 与前置任务开始时间 ${predecessorStart.format('YYYY-MM-DD')} 不一致`);

                      // 新的开始时间应该是后续任务开始时间减去lag
                      newStart = adjustedTaskStart.format('YYYY-MM-DD');

                      // 保持任务持续时间不变
                      const duration = predecessorEnd.diff(predecessorStart, 'days');
                      newEnd = moment(newStart).add(duration, 'days').format('YYYY-MM-DD');
                      console.log(`[前置任务影响预览] SS关系: 计算新时间范围 ${newStart} ~ ${newEnd}, 持续时间 ${duration} 天`);
                      needsUpdate = true;
                    }
                  }
                  break;

                case 'FF': // Finish-To-Finish
                  // 前置任务结束后，后续任务才能结束
                  // 如果后续任务结束时间变化，可能需要调整前置任务结束时间
                  {
                    // 创建副本以避免修改原始对象
                    const adjustedTaskEnd = moment(current.endDate).subtract(lag, 'days');

                    // 检查是否需要更新前置任务
                    // 如果后续任务结束时间 - lag 与前置任务结束时间不一致，则需要更新
                    console.log(`[前置任务影响预览] FF关系比较: 后续任务结束时间(减去lag) ${adjustedTaskEnd.format('YYYY-MM-DD')} vs 前置任务结束时间 ${predecessorEnd.format('YYYY-MM-DD')}`);

                    if (!adjustedTaskEnd.isSame(predecessorEnd, 'day')) {
                      console.log(`[前置任务影响预览] FF关系: 后续任务结束时间 ${adjustedTaskEnd.format('YYYY-MM-DD')} 与前置任务结束时间 ${predecessorEnd.format('YYYY-MM-DD')} 不一致`);

                      // 新的结束时间应该是后续任务结束时间减去lag
                      newEnd = adjustedTaskEnd.format('YYYY-MM-DD');

                      // 保持任务持续时间不变
                      const duration = predecessorEnd.diff(predecessorStart, 'days');
                      newStart = moment(newEnd).subtract(duration, 'days').format('YYYY-MM-DD');
                      console.log(`[前置任务影响预览] FF关系: 计算新时间范围 ${newStart} ~ ${newEnd}, 持续时间 ${duration} 天`);
                      needsUpdate = true;
                    }
                  }
                  break;

                case 'SF': // Start-To-Finish
                  // 前置任务开始后，后续任务才能结束
                  // 如果后续任务结束时间变化，可能需要调整前置任务开始时间
                  {
                    // 创建副本以避免修改原始对象
                    const adjustedTaskEnd = moment(current.endDate).subtract(lag, 'days');

                    // 检查是否需要更新前置任务
                    // 如果后续任务结束时间 - lag 与前置任务开始时间不一致，则需要更新
                    console.log(`[前置任务影响预览] SF关系比较: 后续任务结束时间(减去lag) ${adjustedTaskEnd.format('YYYY-MM-DD')} vs 前置任务开始时间 ${predecessorStart.format('YYYY-MM-DD')}`);

                    if (!adjustedTaskEnd.isSame(predecessorStart, 'day')) {
                      console.log(`[前置任务影响预览] SF关系: 后续任务结束时间 ${adjustedTaskEnd.format('YYYY-MM-DD')} 与前置任务开始时间 ${predecessorStart.format('YYYY-MM-DD')} 不一致`);

                      // 新的开始时间应该是后续任务结束时间减去lag
                      newStart = adjustedTaskEnd.format('YYYY-MM-DD');

                      // 保持任务持续时间不变
                      const duration = predecessorEnd.diff(predecessorStart, 'days');
                      newEnd = moment(newStart).add(duration, 'days').format('YYYY-MM-DD');
                      console.log(`[前置任务影响预览] SF关系: 计算新时间范围 ${newStart} ~ ${newEnd}, 持续时间 ${duration} 天`);
                      needsUpdate = true;
                    }
                  }
                  break;

                default:
                  console.warn(`[前置任务影响预览] 未知的依赖类型: ${predecessor.type}`);
              }

              console.log(`[前置任务影响预览] 任务 ${predecessor.taskId} needsUpdate: ${needsUpdate}`);

              if (needsUpdate) {
                const affectedTask = {
                  taskId: predecessor.taskId,
                  taskName: predecessorTask.name,
                  currentStart: predecessorTask.startDate,
                  currentEnd: predecessorTask.endDate,
                  newStart: newStart,
                  newEnd: newEnd,
                  dependencyType: predecessor.type,
                  lag: lag,
                  reason: `${predecessor.type} dependency to "${this.taskMap.get(current.taskId)?.name}" with ${lag}d lag`,
                  depth: current.depth + 1
                };

                affectedTasks.push(affectedTask);
                console.log(`[前置任务影响预览] 添加到受影响列表:`, affectedTask);

                // 继续检查这个任务的前置任务
                queue.push({
                  taskId: predecessor.taskId,
                  startDate: newStart,
                  endDate: newEnd,
                  reason: `Cascade from ${current.taskId}`,
                  depth: current.depth + 1
                });

                // 更新临时更新状态
                tempUpdates[predecessor.taskId] = {
                  startDate: newStart,
                  endDate: newEnd
                };
              }
            } catch (error) {
              console.warn(`[前置任务影响预览] 计算任务 ${predecessor.taskId} 约束失败:`, error);
            }
          } else {
            console.warn(`[前置任务影响预览] 未找到前置任务 ${predecessor.taskId} 的详情`);
          }
        } else {
          console.log(`[前置任务影响预览] 任务 ${predecessor.taskId} 已处理，跳过`);
        }
      });
    }

    console.log(`[前置任务影响预览] 最终受影响前置任务列表:`, affectedTasks);
    return affectedTasks;
  }

  // 获取受影响的任务列表（级联更新预览）
  getAffectedTasksPreview(taskId, newStartDate, newEndDate) {
    console.log(`[受影响任务预览] 开始分析任务 ${taskId} 的影响范围`)
    console.log(`[受影响任务预览] 新时间范围: ${newStartDate} ~ ${newEndDate}`)

    const affectedTasks = []
    const queue = [{
      taskId,
      startDate: newStartDate,
      endDate: newEndDate,
      reason: 'User edit',
      depth: 0
    }]

    const processed = new Set()

    while (queue.length > 0) {
      const current = queue.shift()

      if (processed.has(current.taskId) || current.depth > 10) {
        continue // 避免循环依赖和过深递归
      }
      processed.add(current.taskId)

      // 检查后续任务
      const successors = this.dependencyGraph.successors.get(current.taskId) || []
      console.log(`[受影响任务预览] 任务 ${current.taskId} 有 ${successors.length} 个后续任务:`, successors)

      successors.forEach((successor, index) => {
        console.log(`[受影响任务预览] 处理后续任务 ${index + 1}: ${successor.taskId}`)

        if (!processed.has(successor.taskId)) {
          const successorTask = this.taskMap.get(successor.taskId)
          if (successorTask) {
            console.log(`[受影响任务预览] 找到后续任务详情:`, {
              id: successorTask.id,
              name: successorTask.name,
              currentStart: successorTask.startDate,
              currentEnd: successorTask.endDate
            })

            try {
              // 计算后续任务的新约束
              const tempUpdates = {}
              tempUpdates[current.taskId] = {
                startDate: current.startDate,
                endDate: current.endDate
              }

              console.log(`[受影响任务预览] 使用临时更新计算约束:`, tempUpdates)
              const constraints = this.calculateConstrainedDate(successor.taskId, tempUpdates)
              console.log(`[受影响任务预览] 计算得到的约束:`, constraints)

              // 只有当约束确实影响任务时间时才加入受影响列表
              const currentSuccessorStart = moment(successorTask.startDate)
              const currentSuccessorEnd = moment(successorTask.endDate)
              const constrainedStart = constraints.constraints.earliestStart ? moment(constraints.constraints.earliestStart) : null
              const constrainedEnd = constraints.constraints.earliestFinish ? moment(constraints.constraints.earliestFinish) : null

              console.log(`[受影响任务预览] 时间比较:`, {
                currentStart: currentSuccessorStart.format('YYYY-MM-DD'),
                currentEnd: currentSuccessorEnd.format('YYYY-MM-DD'),
                constrainedStart: constrainedStart ? constrainedStart.format('YYYY-MM-DD') : 'null',
                constrainedEnd: constrainedEnd ? constrainedEnd.format('YYYY-MM-DD') : 'null',
                constraintsRaw: constraints.constraints
              })

              let needsUpdate = false
              let newStart = successorTask.startDate
              let newEnd = successorTask.endDate

              // 检查是否需要调整开始时间
              if (constrainedStart && constrainedStart.isAfter(currentSuccessorStart)) {
                const daysDiff = constrainedStart.diff(currentSuccessorStart, 'days')
                newStart = constrainedStart.format('YYYY-MM-DD')
                newEnd = moment(successorTask.endDate).add(daysDiff, 'days').format('YYYY-MM-DD')
                needsUpdate = true
                console.log(`[受影响任务预览] 需要调整开始时间，向后推迟 ${daysDiff} 天`)
              }

              // 检查是否需要调整结束时间
              if (constrainedEnd && constrainedEnd.isAfter(currentSuccessorEnd)) {
                newEnd = constrainedEnd.format('YYYY-MM-DD')
                needsUpdate = true
                console.log(`[受影响任务预览] 需要调整结束时间`)
              }

              console.log(`[受影响任务预览] 任务 ${successor.taskId} needsUpdate: ${needsUpdate}`)

              if (needsUpdate) {
                const affectedTask = {
                  taskId: successor.taskId,
                  taskName: successorTask.name,
                  currentStart: successorTask.startDate,
                  currentEnd: successorTask.endDate,
                  newStart: newStart,
                  newEnd: newEnd,
                  dependencyType: successor.type,
                  lag: successor.lag || 0,
                  reason: `${successor.type} dependency from "${this.taskMap.get(current.taskId)?.name}" with ${successor.lag || 0}d lag`,
                  depth: current.depth + 1
                }

                affectedTasks.push(affectedTask)
                console.log(`[受影响任务预览] 添加到受影响列表:`, affectedTask)

                // 继续检查这个任务的后续任务
                queue.push({
                  taskId: successor.taskId,
                  startDate: newStart,
                  endDate: newEnd,
                  reason: `Cascade from ${current.taskId}`,
                  depth: current.depth + 1
                })
              }
            } catch (error) {
              console.warn(`[受影响任务预览] 计算任务 ${successor.taskId} 约束失败:`, error)
            }
          } else {
            console.warn(`[受影响任务预览] 未找到后续任务 ${successor.taskId} 的详情`)
          }
        } else {
          console.log(`[受影响任务预览] 任务 ${successor.taskId} 已处理，跳过`)
        }
      })
    }

    console.log(`[受影响任务预览] 最终受影响任务列表:`, affectedTasks)
    return affectedTasks
  }

  // 执行级联更新并返回更新结果
  executeCascadeUpdate(taskId, newStartDate, newEndDate) {
    // 检测循环依赖
    const cyclicCheck = this.detectCyclicDependency();
    if (cyclicCheck.hasCycle) {
      console.warn('[依赖约束引擎] 检测到循环依赖，可能导致无限递归:', cyclicCheck.cycles);
      // 对于循环依赖，我们仍然尝试更新，但会限制递归深度
    }

    const updateResults = []
    const updates = this.cascadeTaskUpdate(taskId, newStartDate, newEndDate)

    updates.forEach(update => {
      const task = this.taskMap.get(update.taskId)
      if (task) {
        updateResults.push({
          taskId: update.taskId,
          taskName: task.name,
          oldStart: task.startDate,
          oldEnd: task.endDate,
          newStart: update.adjustedDates.startDate,
          newEnd: update.adjustedDates.endDate,
          reason: update.reason
        })
      }
    })

    return updateResults
  }

  // 检查依赖属性变更是否需要级联更新
  checkDependencyPropertyUpdate(fromId, toId, oldType, newType, oldLag, newLag) {
    console.log(`[依赖约束引擎] 检查依赖属性变更: ${fromId}->${toId}, 类型: ${oldType}->${newType}, Lag: ${oldLag}->${newLag}`);

    const fromTask = this.taskMap.get(fromId);
    const toTask = this.taskMap.get(toId);

    if (!fromTask || !toTask) {
      console.warn('[依赖约束引擎] 无法找到任务:', !fromTask ? fromId : '', !toTask ? toId : '');
      return { needsUpdate: false, affectedTasks: [] };
    }

    // 检查类型变更
    const typeChanged = oldType !== newType;
    // 检查lag变更
    const lagChanged = oldLag !== newLag;

    if (!typeChanged && !lagChanged) {
      console.log('[依赖约束引擎] 依赖属性未发生变化');
      return { needsUpdate: false, affectedTasks: [] };
    }

    // 获取当前约束下的时间范围
    const currentConstraints = this.calculateConstrainedDate(toId);

    // 临时应用新属性
    const dependency = this.dependencies.find(d => d.from === fromId && d.to === toId);
    if (!dependency) {
      console.warn('[依赖约束引擎] 无法找到依赖关系:', fromId, toId);
      return { needsUpdate: false, affectedTasks: [] };
    }

    // 备份原始属性
    const originalType = dependency.type;
    const originalLag = dependency.lag;

    // 临时应用新属性
    dependency.type = newType;
    dependency.lag = newLag;

    // 计算新约束下的时间范围
    const newConstraints = this.calculateConstrainedDate(toId);

    // 恢复原始属性
    dependency.type = originalType;
    dependency.lag = originalLag;

    // 检查时间范围是否发生变化
    const startDateChanged = !this.areDatesEqual(currentConstraints.constraints.earliestStart, newConstraints.constraints.earliestStart);
    const endDateChanged = !this.areDatesEqual(currentConstraints.constraints.earliestFinish, newConstraints.constraints.earliestFinish);

    if (!startDateChanged && !endDateChanged) {
      console.log('[依赖约束引擎] 依赖属性变更不影响时间范围');
      return { needsUpdate: false, affectedTasks: [] };
    }

    // 收集受影响的任务
    const affectedTasks = new Set();
    const processedTasks = new Set(); // 用于防止重复处理

    // 递归收集所有受影响的任务
    const collectAffectedTasks = (taskId, isUpstream = false) => {
      if (processedTasks.has(taskId)) return;
      processedTasks.add(taskId);

      const task = this.taskMap.get(taskId);
      if (!task) return;

      affectedTasks.add(task);

      // 收集上游任务
      if (isUpstream) {
        const predecessors = this.dependencyGraph.predecessors.get(taskId) || [];
        predecessors.forEach(pred => {
          collectAffectedTasks(pred.taskId, true);
        });
      }

      // 收集下游任务
      const successors = this.dependencyGraph.successors.get(taskId) || [];
      successors.forEach(succ => {
        collectAffectedTasks(succ.taskId, false);
      });
    };

    // 从源任务和目标任务开始收集
    collectAffectedTasks(fromId, true);
    collectAffectedTasks(toId, false);

    // 转换为数组并按照依赖关系排序
    const sortedAffectedTasks = Array.from(affectedTasks)
      .sort((a, b) => {
        // 检查 a 是否是 b 的前置任务
        const aSuccessors = this.dependencyGraph.successors.get(a.id) || [];
        if (aSuccessors.some(s => s.taskId === b.id)) return -1;

        // 检查 b 是否是 a 的前置任务
        const bSuccessors = this.dependencyGraph.successors.get(b.id) || [];
        if (bSuccessors.some(s => s.taskId === a.id)) return 1;

        return 0;
      });

    console.log('[依赖约束引擎] 依赖属性变更影响的任务:', sortedAffectedTasks.map(t => ({
      id: t.id,
      name: t.name,
      currentDates: {
        start: t.startDate,
        end: t.endDate
      }
    })));

    return {
      needsUpdate: true,
      affectedTasks: sortedAffectedTasks,
      changes: {
        startDateChanged,
        endDateChanged,
        currentConstraints,
        newConstraints,
        originalValues: {
          type: originalType,
          lag: originalLag
        }
      }
    };
  }

  // 辅助方法：比较日期是否相等
  areDatesEqual(date1, date2) {
    if (!date1 || !date2) return date1 === date2;
    return new Date(date1).getTime() === new Date(date2).getTime();
  }

  // 根据依赖关系计算约束
  calculateConstraintByDependency(fromTask, toTask, type, lag) {
    const fromStart = moment(fromTask.startDate);
    const fromEnd = moment(fromTask.endDate);
    const lagDays = parseInt(lag) || 0;

    let earliestStart = null;
    let earliestFinish = null;

    switch (type) {
      case 'FS': // Finish-To-Start
        // 前导任务完成后，加上lag，后续任务才能开始
        earliestStart = fromEnd.clone().add(lagDays, 'days');
        break;
      case 'SS': // Start-To-Start
        // 前导任务开始后，加上lag，后续任务才能开始
        earliestStart = fromStart.clone().add(lagDays, 'days');
        break;
      case 'FF': // Finish-To-Finish
        // 前导任务完成后，加上lag，后续任务才能完成
        earliestFinish = fromEnd.clone().add(lagDays, 'days');
        break;
      case 'SF': // Start-To-Finish
        // 前导任务开始后，加上lag，后续任务才能完成
        earliestFinish = fromStart.clone().add(lagDays, 'days');
        break;
    }

    return {
      earliestStart: earliestStart ? earliestStart.format('YYYY-MM-DD') : null,
      earliestFinish: earliestFinish ? earliestFinish.format('YYYY-MM-DD') : null,
      type,
      lag: lagDays
    };
  }

  applyUpdates(updates) {
    updates.forEach(update => {
      const task = this.tasks.find(t => t.id === update.taskId);
      if (task) {
        task.startDate = update.newStart;
        task.endDate = update.newEnd;
        // 触发任务更新事件或其他必要的操作
        this.$emit('task-updated', task);
      }
    });
  }
}

// 工厂函数
export function createDependencyEngine(tasks, dependencies) {
  return new DependencyConstraintEngine(tasks, dependencies)
}

// 快速验证依赖关系（包含lag验证）
export function validateDependency(dependency) {
  const errors = []

  // 验证基本字段
  if (!dependency.from || !dependency.to) {
    errors.push('Dependency must have from and to task IDs')
  }

  if (dependency.from === dependency.to) {
    errors.push('Task cannot depend on itself')
  }

  // 验证依赖类型
  if (dependency.type && !isValidDependencyType(dependency.type)) {
    errors.push(`Invalid dependency type: ${dependency.type}`)
  }

  // 验证lag值
  if (dependency.lag !== undefined) {
    const lagInfo = parseLagValue(dependency.lag)
    if (lagInfo.error) {
      errors.push(`Invalid lag value: ${lagInfo.error}`)
    } else {
      const validation = validateLagValue(lagInfo.days)
      if (!validation.valid) {
        errors.push(`Lag validation failed: ${validation.message}`)
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}
