import type { LLMProvider } from '../llm/provider.js'
import type { TodoManager } from '../planning/todo-manager.js'
import { AgentLoop } from '../agent/agent-loop.js'
import { MessageManager } from '../context/message-manager.js'
import { setupActionTools } from '../tools/setup.js'

export interface SubAgentRunnerOptions {
  provider: LLMProvider
  todoManager: TodoManager
  maxIterations?: number
}

/**
 * SubAgentRunner - 执行层
 *
 * 职责:
 * - 创建独立的 AgentLoop 实例
 * - 执行单个 sub-agent
 * - 返回结果摘要
 */
export class SubAgentRunner {
  constructor(private options: SubAgentRunnerOptions) {}

  /**
   * 执行单个 sub-agent 任务
   *
   * @param task - 任务描述
   * @returns 任务结果文本
   */
  async execute(task: string): Promise<string> {
    const { provider, todoManager, maxIterations = 10 } = this.options

    // 创建独立的 MessageManager
    const messageManager = new MessageManager()

    // 创建独立的 AgentLoop 实例
    const subAgent = new AgentLoop({
      provider,
      tools: setupActionTools(),
      systemPrompt: this.buildSubAgentPrompt(),
      maxIterations,
      todoManager,
      messageManager,
      isSubAgent: true,
    })

    // 执行任务
    const result = await subAgent.run(task)

    // 返回结果文本（最后的 assistant 消息）
    return result.text
  }

  /**
   * 构建 sub-agent 的 system prompt
   */
  private buildSubAgentPrompt(): string {
    return `You are a specialized sub-agent focused on completing a specific task.

Your responsibilities:
- Complete the assigned task efficiently
- Use available tools to gather information and make changes
- Provide a clear summary of your findings and actions
- Stay focused on the task scope

Important:
- You have a limited iteration budget, work efficiently
- Provide actionable results that the main agent can use
- If you encounter blockers, explain them clearly`
  }
}
