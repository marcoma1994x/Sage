/**
 * Agent 组装函数
 *
 * 职责：
 * 1. 创建 TodoManager 实例
 * 2. 注册所有 tools（Action tools + Planning tools）
 * 3. 返回组装好的依赖
 *
 * 为什么需要这个文件：
 * - tools/setup.ts 只负责 Action tools
 * - planning/tools/ 只负责 Planning tools
 * - agent/setup.ts 负责组装完整的 agent
 */

import type { LLMProvider } from '../llm/provider.js'
import type { ToolRegistry } from '../tools/registry.js'
import { TodoManager } from '../planning/todo-manager.js'
import { createTodoWriteTool } from '../planning/tools/todo_write.js'
import { setupActionTools } from '../tools/setup.js'

/**
 * Agent 组装结果
 */
export interface AgentDependencies {
  /** 完整的工具注册表（Action + Planning） */
  tools: ToolRegistry

  /** TodoManager 实例（需要传给 AgentLoop） */
  todoManager: TodoManager
}

/**
 * 组装 Agent 的所有依赖
 * @returns Agent 依赖对象
 */
export function setupAgent(provider?: LLMProvider): AgentDependencies {
  // 1. 创建 TodoManager（单例）
  const todoManager = new TodoManager()

  // 2. 注册 Action tools
  const tools = setupActionTools({ provider })

  // 3. 注册 Planning tools
  tools.register(createTodoWriteTool(todoManager))

  // 4. 返回组装结果
  return { tools, todoManager }
}
