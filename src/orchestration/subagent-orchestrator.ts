import type { ToolCall } from '../llm/provider.js'
import type { ToolRegistry } from '../tools/registry.js'
import { withTimeout } from '../utils/timeout.js'

export interface ToolResult {
  toolCallId: string;
  content: string;
  isError: boolean;
}

export class SubAgentOrchestrator {
  constructor(private tools: ToolRegistry) {}

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

    // Step 3: 执行 Task 工具（并行）
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

    // 多个 Task：并行执行
    console.log(`🚀 Spawning ${taskCalls.length} sub-agents in parallel...`)

    const promises = taskCalls.map(tc => this.executeSingleTool(tc))
    const results = await Promise.allSettled(promises)

    return results.map((r, i) => {
      if (r.status === 'fulfilled') {
        return r.value
      }
      else {
        // Promise rejected（不应该发生，因为 executeSingleTool 已捕获异常）
        return {
          toolCallId: taskCalls[i].id,
          content: `Error: ${r.reason}`,
          isError: true,
        }
      }
    })
  }

  /**
   * 执行单个 tool call
   */
  private async executeSingleTool(tc: ToolCall): Promise<ToolResult> {
    const tool = this.tools.get(tc.name)

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
