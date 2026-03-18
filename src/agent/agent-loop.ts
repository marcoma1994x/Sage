import type { CommandRegistry } from '../commands/registry.js'
import type { CommandContext } from '../commands/type.js'
import type { LLMProvider, Message, ToolCall } from '../llm/provider.js'

import type { SessionStore } from '../memory/session-store.js'
import type { ToolRegistry } from '../tools/registry.js'
import { EventEmitter } from 'node:events'
import process from 'node:process'
import { Compaction } from '../context/compaction.js'
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
  private messages: Message[] = []
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
  }

  on(event: 'run:complete', listener: (messages: Message[]) => void): this {
    this.emitter.on(event, listener)
    return this
  }

  private emit(event: 'run:complete', messages: Message[]): void {
    this.emitter.emit(event, messages)
  }

  getMessages(): Message[] {
    return this.messages
  }

  setMessages(messages: Message[]): void {
    this.messages = messages
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

    this.messages.push({ role: 'user', content: userInput })

    let lastAssistantText = ''
    let success = false
    let reason: AgentRunResult['reason'] = 'max_iterations'

    for (let i = 0; i < this.MAX_ITERATIONS; i++) {
      if (signal.aborted) {
        reason = 'interrupted'
        break
      }

      const checkpoint = this.messages.length
      const result = await this.streamLLMResponse(checkpoint)
      if (!result) {
        reason = 'error'
        break // streaming 失败，已回滚
      }

      if (result.toolCalls.length === 0) {
        this.messages.push({ role: 'assistant', content: result.text })
        lastAssistantText = result.text
        success = true
        reason = 'completed'
        await this.compactIfNeeded()
        break
      }

      this.messages.push({
        role: 'assistant',
        content: result.text,
        toolCalls: result.toolCalls,
      })
      await this.executeToolCalls(result.toolCalls)
    }
    this.emit('run:complete', this.messages)
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
      messages: this.messages,
      setMessages: (msgs) => {
        this.messages = msgs
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
    checkpoint: number,
  ): Promise<StreamResult | null> {
    let text = ''
    let toolCalls: ToolCall[] = []
    const renderer = new TerminalRenderer()

    try {
      for await (const event of this.provider.chatStream(
        this.messages,
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
        return null
      }

      const msg = error instanceof Error ? error.message : String(error)
      if (!this.silent) {
        console.error(`\n[Error]: ${msg}`)
      }
      this.messages.length = checkpoint
      return null
    }

    if (!this.silent) {
      renderer.flush()
    }

    if (signal.aborted)
      return null

    return { text, toolCalls }
  }

  private async executeToolCalls(toolCalls: ToolCall[]): Promise<void> {
    for (const tc of toolCalls) {
      const tool = this.tools.get(tc.name)
      if (!tool) {
        this.messages.push({
          role: 'tool',
          content: `Error: Unknown tool "${tc.name}"`,
          toolCallId: tc.id,
        })
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

      this.messages.push({
        role: 'tool',
        content: truncatedResult,
        toolCallId: tc.id,
      })
    }
  }

  private async compactIfNeeded(): Promise<void> {
    if (!this.compaction.shouldCompact(this.messages, this.systemPrompt))
      return

    if (!this.silent) {
      console.log('\n[Compaction]: context approaching limit, compacting...')
    }
    this.messages = await this.compaction.compact(this.messages, this.provider)
    if (!this.silent) {
      console.log('[Compaction]: done.')
    }
  }

  resetSession(): void {
    this.messages = []
    this.sessionStore?.reset(process.cwd(), this.provider.modelName)
  }
}
