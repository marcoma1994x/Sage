import type { LLMProvider } from '../llm/provider.js'
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

export function setupActionTools(options?: {
  includeTask?: boolean;
  provider?: LLMProvider;
}): ToolRegistry {
  const registry = new ToolRegistry()
  commonTools.forEach((t) => {
    registry.register(t)
  })
  // includeTask 为 false 时不注册 sub-agent
  if (options?.includeTask !== false && options?.provider) {
    registry.register(createTaskTool(options.provider))
  }

  return registry
}
