import type { SessionStore } from '../memory/session-store.js'
import type { AgentLoop, AgentRunResult } from './agent-loop.js'
import { TerminalRenderer } from '../io/renderer.js'

/**
 * AgentRunner - Agent 的展示层包装器
 *
 * 职责：
 * 1. 监听 AgentLoop 的事件
 * 2. 输出到终端（日志、流式文本、错误）
 * 3. 管理 TerminalRenderer（流式渲染）
 * 4. 管理 sessionStore 与 MessageManager 的交互
 *
 * 设计原则：
 * - 单一职责：只负责输出，不涉及业务逻辑
 * - 包装模式：包装 AgentLoop，代理 run() 方法
 * - 事件驱动：通过监听事件实现输出
 *
 * 使用场景：
 * - 主 agent：需要终端输出，使用 AgentRunner
 * - Sub-agent：不需要输出，直接使用 AgentLoop
 */
export class AgentRunner {
  private agent: AgentLoop
  private sessionStore: SessionStore
  private renderer: TerminalRenderer

  /**
   * 构造函数
   *
   * @param agent - AgentLoop 实例
   */
  constructor(agent: AgentLoop, sessionStore: SessionStore) {
    this.agent = agent
    this.renderer = new TerminalRenderer()
    this.sessionStore = sessionStore

    // 绑定事件监听器
    this.setupListeners()
  }

  /**
   * 运行 agent（代理到 AgentLoop.run）
   *
   * @param userInput - 用户输入
   * @returns 运行结果
   */
  async run(userInput: string): Promise<AgentRunResult> {
    return this.agent.run(userInput)
  }

  /**
   * 设置事件监听器
   *
   * 私有方法，在构造函数中调用
   * 监听 AgentLoop 的事件并输出到终端
   */
  private setupListeners(): void {
    let llmStartTime: number
    let toolStartTime: number

    this.agent.on('llm:start', () => {
      llmStartTime = Date.now()
      console.log('🤖 LLM thinking...')
    })
    // 1. LLM 流式文本输出
    this.agent.on('llm:text', ({ text }) => {
      this.renderer.write(text)
    })

    this.agent.on('llm:done', ({ toolCalls }) => {
      const duration = (Date.now() - llmStartTime) / 1000
      this.renderer.flush()
      console.log(`✓ LLM done (${duration}s)`)
      if (toolCalls.length > 0) {
        console.log(`  └─ Tool calls: ${toolCalls.length}`)
      }
    })

    this.agent.on('llm:error', ({ error }) => {
      this.renderer.flush()
      console.error(`\n❌ LLM Error: ${error.message}`)
    })

    this.agent.on('tool:start', ({ name, input }) => {
      toolStartTime = Date.now()
      this.renderer.flush()
      console.log(`\n🔧 ${name}`)
      const inputStr = JSON.stringify(input, null, 2)
        .split('\n')
        .slice(0, 5) // 只显示前 5 行
        .join('\n')
      console.log(`  ├─ Input: ${inputStr}`)
    })

    this.agent.on('tool:done', ({ result }) => {
      const duration = (Date.now() - toolStartTime) / 1000
      console.log(`  ├─ Duration: ${duration}ms`)

      const resultStr
        = result.length > 200 ? `${result.slice(0, 200)}... (truncated)` : result
      console.log(`  └─ Result: ${resultStr}`)
    })

    this.agent.on('tool:error', ({ error }) => {
      console.error(`  └─ ❌ Error: ${error}`)
    })

    // 5. LLM 调用错误
    this.agent.on('llm:error', ({ error }) => {
      // 清空渲染缓冲区，确保错误信息在新行显示
      this.renderer.flush()
      console.error(`\n[Error]: ${error.message}`)
    })

    this.agent.on('compaction:start', () => {
      console.log('\n📦 Compacting context (approaching limit)...')
    })

    this.agent.on('compaction:done', ({ compactedMessages }) => {
      console.log(`✓ Compaction done (${compactedMessages.length}  messages)`)
    })

    this.agent.on(
      'run:complete',
      ({ messages, iteration, reason }) => {
        this.sessionStore.save(messages)

        const statusIcon = reason === 'completed' ? '✅' : '⚠️'
        console.log(
          `\n${statusIcon} Task ${reason} (${iteration} iterations)`,
        )
      },
    )

    this.agent.on('iteration:start', ({ iteration }) => {
      console.log(`\n━━━ Iteration ${iteration} ━━━`)
    })

    this.agent.on('iteration:end', ({ iteration }) => {
      console.log(`━━━ Iteration ${iteration} completed ━━━\n`)
    })
  }
}
