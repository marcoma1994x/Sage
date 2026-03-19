/**
 * Agent 组装函数
 */

import type { AppOptions } from '../app.js'
import type { LLMProvider } from '../llm/provider.js'
import type { ToolRegistry } from '../tools/registry.js'
import process from 'node:process'
import { MessageManager } from '../context/message-manager.js'
import { SessionStore } from '../memory/session-store.js'
import { TodoManager } from '../planning/todo-manager.js'
import { createTodoWriteTool } from '../planning/tools/todo_write.js'
import { setupActionTools } from '../tools/setup.js'
/**
 * Agent 组装结果
 */
export interface AgentDependencies {
  /** 完整的工具注册表（Action + Planning） */
  tools: ToolRegistry;

  /** TodoManager 实例（需要传给 AgentLoop） */
  todoManager: TodoManager;

  // 会话存储
  sessionStore: SessionStore

  // 消息管理
  messageManager: MessageManager
}

/**
 * 组装 Agent 的所有依赖
 * @returns Agent 依赖对象
 */
export function setupAgent(
  provider: LLMProvider,
  options: AppOptions,
): AgentDependencies {
  // 1. 创建 TodoManager（单例）
  const todoManager = new TodoManager()

  // 2. 注册 Action tools
  const tools = setupActionTools({ provider, todoManager })

  // 3. 注册 Planning tools
  tools.register(createTodoWriteTool(todoManager))

  const sessionStore = new SessionStore({
    cwd: process.cwd(),
    model: options.modelName,
    resumeId: options.resumeSessionId,
  })

  const messageManager = new MessageManager([...sessionStore.session.messages])

  // 4. 返回组装结果
  return { tools, todoManager, sessionStore, messageManager }
}
