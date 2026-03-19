/**
 * Todo 系统的类型定义
 *
 * 设计原则：
 * 1. 简单的三状态模型（pending/in_progress/completed）
 * 2. 为未来升级到 Tasks 预留扩展空间
 * 3. 所有字段都是必需的，避免 undefined 检查
 */

/**
 * Todo 项的状态
 *
 * - pending: 未开始，等待执行
 * - in_progress: 正在执行（同时只能有一个）
 * - completed: 已完成
 */
export type TodoStatus = 'pending' | 'in_progress' | 'completed'

/**
 * 单个 Todo 项
 *
 * 约束：
 * - id 必须在同一个列表中唯一
 * - content 不能为空
 * - status 必须是三个值之一
 */
export interface TodoItem {
  /** 唯一标识符（由 LLM 生成，通常是 "1", "2", "3" 等） */
  id: string

  /** 任务描述（具体、可衡量） */
  content: string

  /** 当前状态 */
  status: TodoStatus

  /** 创建时间戳（毫秒） */
  createdAt: number

  /** 最后更新时间戳（毫秒） */
  updatedAt: number
}

/**
 * Todo 列表的完整状态
 *
 * 用于内部状态管理和 /todos 命令的输出
 */
export interface TodoList {
  /** 所有 todo 项 */
  items: TodoItem[]

  /** 最后一次更新 todo 的轮次（用于提醒机制） */
  lastUpdatedRound: number

  /** 当前轮次（AgentLoop 的循环计数） */
  currentRound: number
}

/**
 * Todo 统计信息
 *
 * 用于 /todos 命令的输出和进度显示
 */
export interface TodoStats {
  /** 总数 */
  total: number

  /** 已完成数量 */
  completed: number

  /** 进行中数量（应该总是 0 或 1） */
  inProgress: number

  /** 待处理数量 */
  pending: number

  /** 完成百分比（0-100） */
  completionRate: number
}
