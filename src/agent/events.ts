import type { Message, ToolCall } from '../llm/provider.js'

/**
 * AgentLoop 事件类型定义
 *
 * 职责：
 * - 定义 AgentLoop 发出的所有事件及其参数类型
 * - 提供类型安全的事件监听
 *
 * 设计原则：
 * - 事件名使用 "category:action" 格式（如 "tool:start"）
 * - void 类型表示事件无参数
 * - 所有事件数据都是只读的（防止监听者修改）
 */
export interface AgentLoopEvents {
  // ============ 迭代事件 ============
  /**
   * 迭代开始
   * 在每次 agent loop 循环开始时触发
   */
  'iteration:start': { iteration: number };

  /**
   * 迭代结束
   * 在每次 agent loop 循环结束时触发
   */
  'iteration:end': { iteration: number };

  // ============ LLM 事件 ============
  /**
   * LLM 开始调用
   * 在调用 chatStream() 之前触发
   */
  'llm:start': void;

  /**
   * LLM 流式文本片段
   * 在接收到 text_delta 事件时触发
   * 用于实时渲染 LLM 响应
   */
  'llm:text': { text: string };

  /**
   * LLM 调用完成
   * 在流式响应结束时触发
   */
  'llm:done': { text: string; toolCalls: ToolCall[] };

  /**
   * LLM 调用失败
   * 在 chatStream() 抛出错误时触发
   */
  'llm:error': { error: Error };

  // ============ 工具事件 ============
  /**
   * 工具开始执行
   * 在调用 tool.execute() 之前触发
   */
  'tool:start': { id: string; name: string; input: unknown };

  /**
   * 工具执行完成
   * 在 tool.execute() 成功返回后触发
   */
  'tool:done': { id: string; name: string; result: string };

  /**
   * 工具执行失败
   * 在 tool.execute() 抛出错误或超时时触发
   */
  'tool:error': { id: string; name: string; error: string };

  // ============ Compaction 事件 ============
  /**
   * 压缩开始
   * 在调用 compaction.compact() 之前触发
   */
  'compaction:start': void;

  /**
   * 压缩完成
   * 在 compaction.compact() 成功返回后触发
   */
  'compaction:done': void;

  // ============ 运行结果事件 ============
  /**
   * 运行完成
   * 在 run() 方法结束时触发（无论成功或失败）
   */
  'run:complete': { messages: readonly Message[] };
}
