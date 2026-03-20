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

export function setupActionTools(): ToolRegistry {
  const registry = new ToolRegistry()
  commonTools.forEach((t) => {
    registry.register(t)
  })

  return registry
}
