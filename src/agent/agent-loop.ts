import type { CommandRegistry } from '../commands/registry.js'
import type { CommandContext } from '../commands/type.js'
import type { MessageManager } from '../context/message-manager.js'

import type {
  ChatResult,
  LLMProvider,
  Message,
  ToolCall,
} from '../llm/provider.js'
import type { SessionStore } from '../memory/session-store.js'
import type { TodoManager } from '../planning/todo-manager.js'
import type { ToolRegistry } from '../tools/registry.js'

import type { AgentLoopEvents } from './events.js'
import { EventEmitter } from 'node:events'
import { Compaction } from '../context/compaction.js'
import { Orchestrator } from '../orchestration/orchestrator.js'
import { signal } from '../process/signal.js'
import { withTimeout } from '../utils/timeout.js'
import { truncateToolResult } from '../utils/truncate.js'

interface AgentLoopOptions {
  provider: LLMProvider;
  tools: ToolRegistry;
  systemPrompt: string;
  commands?: CommandRegistry;
  sessionStore?: SessionStore; // 只给 commands 用
  maxIterations: number;
  todoManager: TodoManager;
  messageManager: MessageManager;
  isSubAgent?: boolean;
}

export interface AgentRunResult {
  success: boolean;
  text: string;
  reason?: 'completed' | 'max_iterations' | 'interrupted' | 'error';
}

export class AgentLoop {
  private todoManager: TodoManager
  private messageManager: MessageManager
  private provider: LLMProvider
  private tools: ToolRegistry
  private systemPrompt: string
  private compaction: Compaction
  private commands?: CommandRegistry
  private MAX_ITERATIONS = 20
  private emitter = new EventEmitter()
  private sessionStore?: SessionStore
  private orchestrator?: Orchestrator

  constructor(options: AgentLoopOptions) {
    const {
      provider,
      tools,
      systemPrompt,
      commands,
      maxIterations,
      sessionStore,
      todoManager,
      messageManager,
      isSubAgent,
    } = options

    this.provider = provider
    this.tools = tools
    this.systemPrompt = systemPrompt
    this.compaction = new Compaction()
    this.commands = commands
    this.MAX_ITERATIONS = maxIterations ?? 20
    this.sessionStore = sessionStore
    this.todoManager = todoManager
    this.messageManager = messageManager

    // 创建 orchestrator（只在主 agent 中创建）
    if (!isSubAgent) {
      this.orchestrator = new Orchestrator({
        tools: this.tools,
        provider: this.provider,
        todoManager: this.todoManager,
        maxConcurrency: 7,
        subAgentMaxIterations: 10,
      })
    }
  }

  /**
   * 发出事件（类型安全）
   *
   * 私有方法，只能在 AgentLoop 内部调用
   * 使用泛型确保事件名和参数类型匹配
   *
   * @param event - 事件名（必须是 AgentLoopEvents 中定义的键）
   * @param args - 事件参数（类型由 AgentLoopEvents[event] 决定）
   */
  private emit<K extends keyof AgentLoopEvents>(
    event: K,
    ...args: AgentLoopEvents[K] extends void ? [] : [AgentLoopEvents[K]]
  ): void {
    this.emitter.emit(event, ...args)
  }

  /**
   * 监听事件（类型安全）
   *
   * 公开方法，外部可以调用
   * 使用泛型确保监听器的参数类型与事件匹配
   *
   * @param event - 事件名
   * @param listener - 事件监听器（参数类型由 AgentLoopEvents[event] 决定）
   * @returns this（支持链式调用）
   */
  on<K extends keyof AgentLoopEvents>(
    event: K,
    listener: (data: AgentLoopEvents[K]) => void,
  ): this {
    this.emitter.on(event, listener)
    return this
  }

  /**
   * 处理一次用户输入。
   * 外部可通过 signal 中断执行：
   * - streaming 中：SDK 取消 HTTP 连接，streamLLMResponse 返回 null
   * - tool 执行间隙：主循环检查 aborted 后 break
   * AgentLoop 不关心 signal 从哪来（可能是 Ctrl+C、超时、或其他原因）。
   */
  async run(userInput: string): Promise<AgentRunResult> {
    if (this.commands && (await this.handleCommand(userInput))) {
      return { success: true, text: '', reason: 'completed' }
    }

    this.messageManager.addUserMessage(userInput)

    let lastAssistantText = ''
    let success = false
    let reason: AgentRunResult['reason'] = 'max_iterations'

    let i = 0
    for (; i < this.MAX_ITERATIONS; i++) {
      // 发出迭代开始事件
      this.emit('iteration:start', { iteration: i + 1 })

      if (signal.aborted) {
        reason = 'interrupted'
        break
      }

      this.todoManager.incrementRound() // 移到这里
      // 检查提醒
      if (this.todoManager.needsReminder()) {
        const reminder = '\n\n[Reminder] You have an active todo list...'
        this.messageManager.addUserMessage(reminder)
      }

      const checkpointId = `iteration-${i}`
      const result = await this.streamLLMResponse(checkpointId)
      if (!result) {
        reason = 'error'
        break // streaming 失败，已回滚
      }

      if (result.toolCalls.length === 0) {
        this.messageManager.addAssistantMessage(result.text)
        lastAssistantText = result.text
        success = true
        reason = 'completed'
        await this.compactIfNeeded()
        break
      }

      this.messageManager.addAssistantMessage(result.text, result.toolCalls)
      await this.executeToolCalls(result.toolCalls)
      // 发出迭代结束事件
      this.emit('iteration:end', { iteration: i + 1 })
    }
    this.emit('run:complete', {
      messages: this.messageManager.getMessages(),
      iteration: i + 1,
      reason,
    })

    if (this.todoManager.hasTodos()) {
      const stats = this.todoManager.getStats()
      if (stats.completed === stats.total) {
        console.log('\n✅ All todos completed!')
        this.todoManager.clear()
      }
    }

    return {
      success,
      text: lastAssistantText,
      reason,
    }
  }

  private async handleCommand(input: string): Promise<boolean> {
    if (!this.commands?.isCommand(input))
      return false

    const ctx: CommandContext = {
      messages: this.messageManager.getMessages() as Message[],
      setMessages: (msgs) => {
        this.messageManager.setMessages(msgs)
      },
      provider: this.provider,
      compaction: this.compaction,
      systemPrompt: this.systemPrompt,
      sessionStore: this.sessionStore as SessionStore,
    }
    await this.commands.execute(input, ctx)
    return true
  }

  /**
   * 流式消费一次 LLM 响应。
   * 返回 StreamResult 表示成功，null 表示失败或被中断。
   * checkpoint 用于失败时回滚 messages 到调用前的状态。
   */
  private async streamLLMResponse(
    checkpointId: string,
  ): Promise<ChatResult | null> {
    // 创建 checkpoint
    this.messageManager.createCheckpoint(checkpointId)

    let text = ''
    let toolCalls: ToolCall[] = []
    try {
      // 发出 LLM 开始事件
      this.emit('llm:start')

      for await (const event of this.provider.chatStream(
        this.messageManager.getMessages(),
        this.tools.getDefinitions(),
        this.systemPrompt,
      )) {
        switch (event.type) {
          case 'text_delta':
            // 发出文本片段事件
            this.emit('llm:text', { text: event.text })
            break
          case 'tool_call_start':
            break
          case 'done':
            text = event.result.text
            toolCalls = event.result.toolCalls
            // 发出 LLM 完成事件
            this.emit('llm:done', { text, toolCalls })
            break
        }
      }
    }
    catch (error) {
      if (signal.aborted) {
        this.messageManager.rollback(checkpointId)
        return null
      }

      const err = error instanceof Error ? error : new Error(String(error))
      this.emit('llm:error', { error: err })
      this.messageManager.rollback(checkpointId)
      return null
    }

    if (signal.aborted) {
      this.messageManager.rollback(checkpointId)
      return null
    }

    // 成功时清理 checkpoint
    this.messageManager.clearCheckpoint(checkpointId)
    return { text, toolCalls }
  }

  private async executeToolCalls(toolCalls: ToolCall[]): Promise<void> {
    // 主 agent 使用 orchestrator 编排任务
    if (this.orchestrator) {
      // 发出工具开始执行事件
      this.emit('tool:start', { id: '', name: 'orchestrator', input: '' })
      const results = await this.orchestrator.execute(toolCalls)

      // 将结果添加到 messages
      for (const result of results) {
        this.emit('tool:done', {
          id: result.toolCallId,
          name:
            toolCalls.find(tc => tc.id === result.toolCallId)?.name
            ?? 'Unknown',
          result: result.content,
        })

        this.messageManager.addToolResult(result.toolCallId, result.content)
      }

      return
    }

    // 子 agent 直接调用工具
    for (const tc of toolCalls) {
      const tool = this.tools.get(tc.name)
      if (!tool) {
        this.messageManager.addToolResult(
          tc.id,
          `Error: Unknown tool "${tc.name}"`,
        )
        continue
      }

      let toolResult: { content: string }
      try {
        toolResult = await withTimeout(tool.execute(tc.input), 30000, tc.name)
      }
      catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)

        // 发出工具错误事件
        this.emit('tool:error', { id: tc.id, name: tc.name, error: errMsg })

        toolResult = { content: `Error: ${errMsg}` }
      }

      const truncatedResult = truncateToolResult(toolResult.content)

      this.messageManager.addToolResult(tc.id, truncatedResult)
    }
  }

  private async compactIfNeeded(): Promise<void> {
    const messages = this.messageManager.getMessages()
    if (!this.compaction.shouldCompact(messages, this.systemPrompt))
      return

    // 发出压缩开始事件
    this.emit('compaction:start')

    const compactedMessages = await this.compaction.compact(
      messages,
      this.provider,
    )
    // 发出压缩完成事件
    this.emit('compaction:done', { compactedMessages })
    this.messageManager.setMessages(compactedMessages)
  }

  setMessages(messages: Message[]): void {
    this.messageManager.setMessages(messages)
  }
}
