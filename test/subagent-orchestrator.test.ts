import type { Tool, ToolResult } from '../src/tools/type.js'
import { SubAgentOrchestrator } from '../src/orchestration/subagent-orchestrator.js'
import { ToolRegistry } from '../src/tools/registry.js'

const readTool: Tool = {
  definition: {
    name: 'read',
    description: 'read tool',
    inputSchema: {},
  },
  execute: async (): Promise<ToolResult> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ content: 'execute read tool', isError: false })
      }, 1000)
    })
  },
}
const writeTool: Tool = {
  definition: {
    name: 'write',
    description: 'write tool',
    inputSchema: {},
  },
  execute: async (): Promise<ToolResult> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ content: 'execute write tool', isError: false })
      }, 2000)
    })
  },
}

const taskTool: Tool = {
  definition: {
    name: 'Task',
    description: 'task tool',
    inputSchema: {},
  },
  execute: async (): Promise<ToolResult> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ content: 'execute task tool', isError: false })
      }, 3000)
    })
  },
}

const toolRegistry = new ToolRegistry()

toolRegistry.register(readTool)
toolRegistry.register(writeTool)
toolRegistry.register(taskTool)

const sub = new SubAgentOrchestrator(toolRegistry)

console.time()

const result = await sub.execute([
  { id: '2', name: 'Task', input: {} },
  { id: '4', name: 'Task', input: {} },
  { id: '3', name: 'write', input: {} },
  { id: '1', name: 'read', input: {} },

])
console.timeEnd()

console.log(result)
