import type { LLMProvider, ToolCall } from '../llm/provider.js'
import type { TodoManager } from '../planning/todo-manager.js'
import type { ToolRegistry } from '../tools/registry.js'
import { withTimeout } from '../utils/timeout.js'
import { SubAgentPool } from './subagent-pool.js'
import { SubAgentRunner } from './subagent-runner.js'

export interface ToolResult {
  toolCallId: string;
  content: string;
  isError: boolean;
}

export interface SubAgentOrchestratorOptions {
  tools: ToolRegistry;
  provider: LLMProvider;
  todoManager: TodoManager;
  maxConcurrency?: number;
  subAgentMaxIterations?: number;
}

export class Orchestrator {
  private pool: SubAgentPool
  private subAgentRunner: SubAgentRunner

  constructor(private options: SubAgentOrchestratorOptions) {
    const { maxConcurrency, provider, todoManager, subAgentMaxIterations }
      = options

    this.pool = new SubAgentPool(maxConcurrency)

    this.subAgentRunner = new SubAgentRunner({
      provider,
      todoManager,
      maxIterations: subAgentMaxIterations ?? 10,
    })
  }

  /**
   * 执行 tool calls
   *
   * - 非 Task 工具：顺序执行
   * - Task 工具：并行执行（使用 Promise.all）
   */
  async execute(toolCalls: ToolCall[]): Promise<ToolResult[]> {
    // Step 1: 分组
    const { taskCalls, otherCalls } = this.groupToolCalls(toolCalls)

    const results: ToolResult[] = []
    // Step 2: 执行非 Task 工具（顺序）
    for (const tc of otherCalls) {
      const result = await this.executeSingleTool(tc)
      results.push(result)
    }

    // Step 3: 执行 Task 工具（并行 + 并发控制）
    if (taskCalls.length > 0) {
      const taskResults = await this.executeTasksInParallel(taskCalls)
      results.push(...taskResults)
    }

    // Step 4: 按原始顺序排序结果
    return this.sortResults(results, toolCalls)
  }

  /**
   * 分组 tool calls
   */
  private groupToolCalls(toolCalls: ToolCall[]): {
    taskCalls: ToolCall[];
    otherCalls: ToolCall[];
  } {
    const taskCalls: ToolCall[] = []
    const otherCalls: ToolCall[] = []

    for (const tc of toolCalls) {
      if (tc.name === 'Task') {
        taskCalls.push(tc)
      }
      else {
        otherCalls.push(tc)
      }
    }

    return { taskCalls, otherCalls }
  }

  /**
   * 并行执行多个 Task tool calls
   */
  private async executeTasksInParallel(
    taskCalls: ToolCall[],
  ): Promise<ToolResult[]> {
    // 单个 Task：直接执行
    if (taskCalls.length === 1) {
      const result = await this.executeSingleTool(taskCalls[0])
      return [result]
    }
    // 多个 Task：并行执行（受并发限制）
    console.log(`🚀 Spawning ${taskCalls.length} sub-agents in parallel...`)

    const poolStatus = this.pool.getStatus()
    if (taskCalls.length > poolStatus.maxConcurrency) {
      console.log(
        `📊 Pool: max ${poolStatus.maxConcurrency} concurrent, ${taskCalls.length - poolStatus.maxConcurrency} will queue`,
      )
    }

    // 创建任务数组（每个任务是一个返回 Promise 的函数）
    const tasks = taskCalls.map(tc => () => this.executeSingleTool(tc))

    // 通过 pool 执行（自动处理并发限制和队列）
    const results = await this.pool.executeAll(tasks)

    return results
  }

  /**
   * 执行 Task tool call（委托给 SubAgentRunner）
   */
  private async executeTaskTool(tc: ToolCall): Promise<ToolResult> {
    try {
      const input = tc.input as { task: string }
      const result = await this.subAgentRunner.execute(input.task)

      return {
        toolCallId: tc.id,
        content: result,
        isError: false,
      }
    }
    catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      return {
        toolCallId: tc.id,
        content: `Error: Sub-agent failed - ${errMsg}`,
        isError: true,
      }
    }
  }

  /**
   * 执行单个 tool call
   */
  private async executeSingleTool(tc: ToolCall): Promise<ToolResult> {
    // Task 类型任务使用 subAgent 处理
    if (tc.name === 'Task') {
      return this.executeTaskTool(tc)
    }

    // 其他工具直接调用
    const tool = this.options.tools.get(tc.name)

    if (!tool) {
      return {
        toolCallId: tc.id,
        content: `Error: Unknown tool "${tc.name}"`,
        isError: true,
      }
    }

    try {
      const result = await withTimeout(tool.execute(tc.input), 30000, tc.name)
      return {
        toolCallId: tc.id,
        content: result.content,
        isError: false,
      }
    }
    catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      return {
        toolCallId: tc.id,
        content: `Error: ${errMsg}`,
        isError: true,
      }
    }
  }

  /**
   * 按原始 toolCalls 顺序排序结果
   */
  private sortResults(
    results: ToolResult[],
    originalToolCalls: ToolCall[],
  ): ToolResult[] {
    const resultMap = new Map<string, ToolResult>()
    for (const result of results) {
      resultMap.set(result.toolCallId, result)
    }

    return originalToolCalls.map((tc) => {
      const result = resultMap.get(tc.id)
      if (!result) {
        throw new Error(`Missing result for tool call ${tc.id}`)
      }
      return result
    })
  }
}
