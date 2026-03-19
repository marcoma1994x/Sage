/**
 * TodoManager - Todo 列表的状态管理器
 *
 * 职责：
 * 1. 管理 todo 列表的状态（增删改查）
 * 2. 管理轮次计数（用于提醒机制）
 * 3. 验证约束（同时只能有一个 in_progress）
 * 4. 自动修复违反约束的情况
 * 5. 渲染终端显示
 *
 * 设计原则：
 * - 单一职责：只管理 todo 状态，不关心 AgentLoop 的执行逻辑
 * - 自包含：轮次计数由自己管理，不依赖外部传入
 * - 容错性：自动修复约束违反，而非直接抛错
 */

import type { TodoItem, TodoList, TodoStats, TodoStatus } from './types.js'

export class TodoManager {
  /** 当前的 todo 列表 */
  private todos: TodoItem[] = []

  /** 当前轮次（每次 AgentLoop 循环递增） */
  private currentRound = 0

  /** 最后一次更新 todo 的轮次 */
  private lastUpdatedRound = 0

  /**
   * 递增轮次计数
   *
   * 应该在每次 AgentLoop 循环开始时调用
   * 用于追踪距离上次更新 todo 过了多少轮
   */
  incrementRound(): void {
    this.currentRound++
  }

  /**
   * 更新 todo 列表
   *
   * 核心方法，由 todo_write tool 调用
   *
   * 约束验证和自动修复：
   * 1. 检查是否有多个 in_progress
   * 2. 如果有，只保留第一个，其他改为 pending
   * 3. 输出警告信息
   *
   * @param items - 新的 todo 列表（由 LLM 生成）
   * @returns 渲染后的字符串（显示在终端）
   */
  update(items: TodoItem[]): string {
    const now = Date.now()

    // 1. 验证约束：同时只能有一个 in_progress
    const inProgressItems = items.filter(
      item => item.status === 'in_progress',
    )

    if (inProgressItems.length > 1) {
      // 自动修复：只保留第一个 in_progress
      const firstInProgress = inProgressItems[0]
      items = items.map((item) => {
        if (item.status === 'in_progress' && item.id !== firstInProgress.id) {
          return { ...item, status: 'pending' as TodoStatus }
        }
        return item
      })

      // 输出警告（不阻塞执行）
      console.warn(
        `⚠️  Auto-fixed: Only one todo can be in_progress. `
        + `Kept "${firstInProgress.content}" as in_progress, `
        + `others changed to pending.`,
      )
    }

    // 2. 更新时间戳
    this.todos = items.map(item => ({
      ...item,
      createdAt: item.createdAt || now,
      updatedAt: now,
    }))

    // 3. 记录更新轮次
    this.lastUpdatedRound = this.currentRound

    // 4. 返回渲染结果
    return this.render()
  }

  /**
   * 渲染 todo 列表为终端显示的字符串
   *
   * 格式：
   * 📋 Todo List (2/5 completed)
   *
   * ✅ 1. Create User model
   * 🔄 2. Add auth middleware
   * ⏳ 3. Write tests
   * ⏳ 4. Update docs
   * ⏳ 5. Deploy
   *
   * @returns 格式化的字符串
   */
  render(): string {
    if (this.todos.length === 0) {
      return 'No todos yet.'
    }

    const stats = this.getStats()

    let output = `\n📋 Todo List (${stats.completed}/${stats.total} completed)\n\n`

    this.todos.forEach((todo, index) => {
      const icon = this.getStatusIcon(todo.status)
      output += `${icon} ${index + 1}. ${todo.content}\n`
    })

    return output
  }

  /**
   * 获取状态对应的图标
   *
   * @param status - Todo 状态
   * @returns 对应的 emoji 图标
   */
  getStatusIcon(status: TodoStatus): string {
    switch (status) {
      case 'completed':
        return '✅'
      case 'in_progress':
        return '🔄'
      case 'pending':
        return '⏳'
    }
  }

  /**
   * 获取统计信息
   *
   * 用于 /todos 命令和进度显示
   *
   * @returns 统计对象
   */
  getStats(): TodoStats {
    const total = this.todos.length
    const completed = this.todos.filter(t => t.status === 'completed').length
    const inProgress = this.todos.filter(
      t => t.status === 'in_progress',
    ).length
    const pending = this.todos.filter(t => t.status === 'pending').length

    return {
      total,
      completed,
      inProgress,
      pending,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    }
  }

  /**
   * 获取完整的 todo 列表（包含所有项）
   *
   * 用于 /todos 命令的详细输出
   *
   * @returns 所有 todo 项的副本（防止外部修改）
   */
  getItems(): TodoItem[] {
    return [...this.todos]
  }

  /**
   * 检查是否需要提醒 LLM 更新 todo
   *
   * 提醒条件：
   * 1. 有 todo 列表（不为空）
   * 2. 距离上次更新已经过了 3 轮或更多
   *
   * 这个机制防止 LLM 忘记更新 todo，导致进度不可见
   *
   * @returns true 表示需要提醒
   */
  needsReminder(): boolean {
    return (
      this.todos.length > 0 && this.currentRound - this.lastUpdatedRound >= 3
    )
  }

  /**
   * 清空 todo 列表
   *
   * 用于任务完成后清理，或 /clear 命令
   */
  clear(): void {
    this.todos = []
    this.lastUpdatedRound = 0
    // 注意：不重置 currentRound，因为轮次是持续递增的
  }

  /**
   * 检查是否有 todo 列表
   *
   * @returns true 表示有至少一个 todo
   */
  hasTodos(): boolean {
    return this.todos.length > 0
  }

  /**
   * 获取完整状态（用于调试和持久化）
   *
   * @returns 完整的内部状态
   */
  getState(): TodoList {
    return {
      items: this.getItems(),
      lastUpdatedRound: this.lastUpdatedRound,
      currentRound: this.currentRound,
    }
  }
}
