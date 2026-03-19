import type { CommandRegistry } from '../commands/registry.js'
import type { CommandContext } from '../commands/type.js'
import type { LLMProvider, Message, ToolCall } from '../llm/provider.js'

import type { SessionStore } from '../memory/session-store.js'
import type { TodoManager } from '../planning/todo-manager.js'
import type { ToolRegistry } from '../tools/registry.js'
import { EventEmitter } from 'node:events'

import { Compaction } from '../context/compaction.js'
import { MessageManager } from '../context/message-manager.js'
import { TerminalRenderer } from '../io/renderer.js'
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
  silent?: boolean; // 静默模式 - subagent 中使用
  todoManager: TodoManager;
}

interface StreamResult {
  text: string;
  toolCalls: ToolCall[];
}

export interface AgentRunResult {
  success: boolean;
  text: string;
  reason?: 'completed' | 'max_iterations' | 'interrupted' | 'error';
}

export class AgentLoop {
  private todoManager: TodoManager
  private messageManager = new MessageManager()
  private provider: LLMProvider
  private tools: ToolRegistry
  private systemPrompt: string
  private compaction: Compaction
  private commands?: CommandRegistry
  private MAX_ITERATIONS = 20
  private emitter = new EventEmitter()
  private sessionStore?: SessionStore
  private readonly silent: boolean

  constructor(options: AgentLoopOptions) {
    this.provider = options.provider
    this.tools = options.tools
    this.systemPrompt = options.systemPrompt
    this.compaction = new Compaction()
    this.commands = options.commands
    this.MAX_ITERATIONS = options.maxIterations ?? 20
    this.sessionStore = options.sessionStore
    this.silent = options.silent ?? false
    this.todoManager = options.todoManager
  }

  private emit(event: 'run:complete', messages: readonly Message[]): void {
    this.emitter.emit(event, messages)
  }

  on(event: 'run:complete', listener: (messages: Message[]) => void): this {
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

    for (let i = 0; i < this.MAX_ITERATIONS; i++) {
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
    }
    this.emit('run:complete', this.messageManager.getMessages())

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
  ): Promise<StreamResult | null> {
    // 创建 checkpoint
    this.messageManager.createCheckpoint(checkpointId)

    let text = ''
    let toolCalls: ToolCall[] = []
    const renderer = new TerminalRenderer()
    try {
      for await (const event of this.provider.chatStream(
        this.messageManager.getMessages(),
        this.tools.getDefinitions(),
        this.systemPrompt,
      )) {
        switch (event.type) {
          case 'text_delta':
            if (!this.silent) {
              renderer.write(event.text)
            }
            break
          case 'tool_call_start':
            if (!this.silent) {
              renderer.flush()
              console.log(`\n[Tool]: invoke tool「${event.name}」`)
            }
            break
          case 'done':
            text = event.result.text
            toolCalls = event.result.toolCalls
            break
        }
      }
    }
    catch (error) {
      if (signal.aborted) {
        if (!this.silent) {
          renderer.flush()
        }
        this.messageManager.rollback(checkpointId)
        return null
      }

      const msg = error instanceof Error ? error.message : String(error)
      if (!this.silent) {
        console.error(`\n[Error]: ${msg}`)
      }
      this.messageManager.rollback(checkpointId)
      return null
    }

    if (!this.silent) {
      renderer.flush()
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
    for (const tc of toolCalls) {
      const tool = this.tools.get(tc.name)
      if (!tool) {
        this.messageManager.addToolResult(
          tc.id,
          `Error: Unknown tool "${tc.name}"`,
        )
        continue
      }

      /*  console.log(
        `[Tool]: call tool-${tc.name} with input (${JSON.stringify(tc.input)})`,
      ) */

      let toolResult: { content: string }
      try {
        toolResult = await withTimeout(tool.execute(tc.input), 30000, tc.name)
      }
      catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        if (!this.silent) {
          console.error(`[Tool Error]: ${tc.name} failed: ${errMsg}`)
        }
        toolResult = { content: `Error: ${errMsg}` }
      }

      const truncatedResult = truncateToolResult(toolResult.content)
      /*  console.log(
        `[Tool]: ${tc.name}'s result is:(${JSON.stringify(truncatedResult)})`,
      ) */

      this.messageManager.addToolResult(
        tc.id,
        truncatedResult,
      )
    }
  }

  private async compactIfNeeded(): Promise<void> {
    const messages = this.messageManager.getMessages()
    if (!this.compaction.shouldCompact(messages, this.systemPrompt))
      return

    if (!this.silent) {
      console.log('\n[Compaction]: context approaching limit, compacting...')
    }
    const compactedMessages = await this.compaction.compact(messages, this.provider)
    this.messageManager.setMessages(compactedMessages)

    if (!this.silent) {
      console.log('[Compaction]: done.')
    }
  }

  setMessages(messages: Message[]): void {
    this.messageManager.setMessages(messages)
  }
}
