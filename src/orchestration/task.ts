import type { LLMProvider } from '../llm/provider.js'
import type { TodoManager } from '../planning/todo-manager.js'
import type { Tool, ToolResult } from '../tools/type.js'
import chalk from 'chalk'
import { AgentLoop } from '../agent/agent-loop.js'
import { buildSubAgentPrompt, createSubAgentToolRegistry } from './subagent.js'

interface TaskInput {
  task: string;
  max_iterations?: number;
}

/**
 * Task tool - 委托子任务给独立的 sub-agent
 *
 * 子 agent 有自己的 context 和完整工具集（除了 Task 本身），
 * 执行完成后返回摘要给主 agent。
 */
export function createTaskTool(provider: LLMProvider, todoManager: TodoManager): Tool {
  return {
    definition: {
      name: 'Task',
      description:
        'Delegate a well-defined subtask to an independent sub-agent. '
        + 'The sub-agent has its own context and full access to tools (Read, Edit, Write, Bash, etc.), '
        + 'but cannot spawn further sub-agents. '
        + 'Use this when a subtask is complex enough to require multiple steps but conceptually independent. '
        + 'The sub-agent will return a summary of what it accomplished.',
      inputSchema: {
        type: 'object',
        properties: {
          task: {
            type: 'string',
            description:
              'Clear description of the subtask. Include all necessary context, file paths, and constraints.',
          },
          max_iterations: {
            type: 'number',
            description:
              'Maximum number of iterations for the sub-agent. Default: 10',
            default: 10,
          },
        },
        required: ['task'],
      },
    },
    async execute(input: unknown): Promise<ToolResult> {
      const { task, max_iterations = 10 } = input as TaskInput
      // 截断任务描述用于显示
      const taskPreview = task.length > 80 ? `${task.slice(0, 80)}...` : task

      console.log(chalk.dim(`\n[SubAgent] Starting task: "${taskPreview}"\n`))
      // 创建子 agent
      const subAgent = new AgentLoop({
        provider,
        tools: createSubAgentToolRegistry({ provider, todoManager }),
        systemPrompt: buildSubAgentPrompt(),
        maxIterations: max_iterations,
        todoManager,
      })

      // 执行子任务
      const result = await subAgent.run(task)

      // 处理结果
      if (result.success) {
        console.log(chalk.green('\n[SubAgent] Task completed successfully.\n'))
        return { content: result.text }
      }

      // 失败场景
      const reasonMsg: Record<string, string> = {
        max_iterations: `Failed: reached maximum iterations (${max_iterations})`,
        interrupted: 'Failed: interrupted by user',
        error: 'Failed: execution error',
      }

      const failureMsg = reasonMsg[result.reason!] || 'Failed: unknown reason'

      console.log(chalk.red(`\n[SubAgent] ${failureMsg}\n`))

      if (result.text) {
        const textPreview = result.text.length > 200
          ? `${result.text.slice(0, 200)}...`
          : result.text
        console.log(chalk.dim(`[SubAgent] Last output: ${textPreview}\n`))
      }

      return {
        content: `Subtask failed (${result.reason}). ${result.text || 'No output.'}`,
        isError: true,
      }
    },
  }
}
