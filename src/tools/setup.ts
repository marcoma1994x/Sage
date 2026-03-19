import type { LLMProvider } from '../llm/provider.js'
import type { TodoManager } from '../planning/todo-manager.js'
import { createTaskTool } from '../orchestration/task.js'
import { bashTool } from './bash.js'
import { editTool } from './edit.js'
import { globTool } from './glob.js'
import { grepTool } from './grep.js'
import { readTool } from './read.js'
import { ToolRegistry } from './registry.js'
import { writeTool } from './write.js'

const commonTools = [
  readTool,
  editTool,
  writeTool,
  bashTool,
  grepTool,
  globTool,
]

export function setupActionTools(options: {
  includeTask?: boolean;
  provider?: LLMProvider;
  todoManager: TodoManager
}): ToolRegistry {
  const registry = new ToolRegistry()
  commonTools.forEach((t) => {
    registry.register(t)
  })
  const { includeTask, provider, todoManager } = options
  // includeTask 为 false 时不注册 sub-agent
  if (includeTask !== false && provider) {
    registry.register(createTaskTool(provider, todoManager))
  }

  return registry
}
