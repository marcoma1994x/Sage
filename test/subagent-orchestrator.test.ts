import type { Tool, ToolResult } from '../src/tools/type.js'
import { Orchestrator } from '../src/orchestration/orchestrator.js'
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

const sub = new Orchestrator()

console.time()

const result = await sub.execute([
  { id: '1', name: 'read', input: {} },
  { id: '2', name: 'Task', input: {} },
  { id: '3', name: 'Task', input: {} },
  { id: '4', name: 'Task', input: {} },
  { id: '5', name: 'write', input: {} },

  /*   { id: '6', name: 'Task', input: {} },
  { id: '7', name: 'Task', input: {} },
  { id: '8', name: 'Task', input: {} },
  { id: '9', name: 'Task', input: {} },
  { id: '10', name: 'Task', input: {} },
  { id: '11', name: 'Task', input: {} },
  { id: '12', name: 'Task', input: {} }, */

])
console.timeEnd()

console.log(result)
