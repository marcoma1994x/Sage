// src/agent/message-manager.ts

import type { Message, ToolCall } from '../llm/provider.js'

/**
 * MessageManager - 消息状态管理器
 *
 * 职责：
 * 1. 管理对话历史（messages 数组）
 * 2. 提供类型安全的消息添加接口
 * 3. 提供只读访问（防止外部直接修改）
 *
 * 设计原则：
 * - 单一职责：只管理消息状态，不关心 LLM 调用或业务逻辑
 * - 封装性：messages 私有，只能通过方法操作
 * - 类型安全：强制使用正确的 Message 结构
 */
export class MessageManager {
  /**
   * 对话历史消息列表
   * 私有属性，外部只能通过 getMessages() 只读访问
   */
  private messages: Message[] = []

  /**
   * Checkpoint 存储
   * key: checkpoint ID（如 "iteration-5"）
   * value: 该时刻的消息列表快照（深拷贝）
   */
  private checkpoints: Map<string, Message[]> = new Map()

  constructor(messages?: Message[]) {
    if (messages) {
      // 恢复历史消息
      this.messages = messages
    }
  }

  /**
   * 添加用户消息
   *
   * 用途：用户输入时调用
   *
   * @param content - 用户输入的文本内容
   *
   * @example
   * manager.addUserMessage('Read package.json')
   */
  addUserMessage(content: string): void {
    this.messages.push({ role: 'user', content })
  }

  /**
   * 添加 assistant 消息
   *
   * 用途：LLM 响应时调用
   *
   * @param content - LLM 生成的文本内容
   * @param toolCalls - 可选的工具调用列表（如果 LLM 决定调用工具）
   *
   * @example
   * // 纯文本响应
   * manager.addAssistantMessage('I will read the file for you.')
   *
   * // 带工具调用的响应
   * manager.addAssistantMessage('', [{ id: '1', name: 'read', input: {...} }])
   */
  addAssistantMessage(content: string, toolCalls?: ToolCall[]): void {
    this.messages.push({
      role: 'assistant',
      content,
      // 只有当 toolCalls 存在且非空时才添加到消息对象
      ...(toolCalls && toolCalls.length > 0 ? { toolCalls } : {}),
    })
  }

  /**
   * 添加工具执行结果
   *
   * 用途：工具执行完成后，将结果返回给 LLM
   *
   * @param toolCallId - 工具调用的唯一标识（与 assistant 消息中的 toolCall.id 对应）
   * @param content - 工具执行的输出结果（字符串格式）
   *
   * @example
   * manager.addToolResult('call_123', 'File content: {...}')
   */
  addToolResult(toolCallId: string, content: string): void {
    this.messages.push({
      role: 'tool',
      content,
      toolCallId,
    })
  }

  /**
   * 获取消息列表（只读）
   *
   * 返回类型为 readonly Message[]，防止外部直接修改数组
   * 外部必须通过 MessageManager 的方法来修改消息
   *
   * @returns 只读的消息数组
   *
   * @example
   * const messages = manager.getMessages()
   * // messages.push(...) // ❌ TypeScript 会报错
   */
  getMessages(): readonly Message[] {
    return this.messages
  }

  /**
   * 获取消息数量
   *
   * 用途：调试、日志、判断是否为空对话
   *
   * @returns 当前消息总数
   */
  getMessageCount(): number {
    return this.messages.length
  }

  /**
   * 创建 checkpoint（保存当前消息快照）
   *
   * 用途：在 LLM 调用前创建，失败时可回滚
   *
   * 实现：深拷贝消息列表，避免引用污染
   *
   * @param id - checkpoint 唯一标识
   *
   * @example
   * manager.createCheckpoint('iteration-5')
   * // ... LLM 调用 ...
   * if (failed) {
   *   manager.rollback('iteration-5')
   * }
   */
  createCheckpoint(id: string): void {
    // 使用 JSON 序列化实现深拷贝（简单且可靠）
    this.checkpoints.set(id, JSON.parse(JSON.stringify(this.messages)))
  }

  /**
   * 回滚到指定 checkpoint
   *
   * 用途：LLM 调用失败时，恢复到调用前的状态
   *
   * @param id - checkpoint 唯一标识
   * @returns true 表示回滚成功，false 表示 checkpoint 不存在
   *
   * @example
   * const success = manager.rollback('iteration-5')
   * if (!success) {
   *   console.error('Checkpoint not found')
   * }
   */
  rollback(id: string): boolean {
    const checkpoint = this.checkpoints.get(id)
    if (!checkpoint) {
      return false
    }
    // 深拷贝恢复，避免后续修改影响 checkpoint
    this.messages = JSON.parse(JSON.stringify(checkpoint))
    return true
  }

  /**
   * 清除指定 checkpoint（释放内存）
   *
   * 用途：LLM 调用成功后，清理不再需要的 checkpoint
   *
   * @param id - checkpoint 唯一标识
   *
   * @example
   * manager.createCheckpoint('iteration-5')
   * // ... LLM 调用成功 ...
   * manager.clearCheckpoint('iteration-5')  // 释放内存
   */
  clearCheckpoint(id: string): void {
    this.checkpoints.delete(id)
  }

  /**
   * 批量设置消息（替换整个列表）
   *
   * 用途：compaction 后替换压缩后的消息列表
   *
   * 实现：浅拷贝输入数组，避免外部修改影响内部状态
   *
   * @param messages - 新的消息列表
   *
   * @example
   * const compactedMessages = await compaction.compact(manager.getMessages())
   * manager.setMessages(compactedMessages)
   */
  setMessages(messages: readonly Message[]): void {
    this.messages = [...messages]
  }

  /**
   * 清空所有消息和 checkpoint
   *
   * 用途：/clear 命令，重置对话
   *
   * 注意：会同时清理所有 checkpoint，避免内存泄漏
   */
  clear(): void {
    this.messages = []
    this.checkpoints.clear()
  }
}
