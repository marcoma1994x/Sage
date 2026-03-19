import type { TodoManager } from '../planning/todo-manager.js'
import { clearCommand } from './clear.js'
import { compactCommand } from './compact.js'
import { helpCommand } from './help.js'
import { CommandRegistry } from './registry.js'
import { resumeCommand } from './resume.js'
import { sessionsCommand } from './sessions.js'
import { createTodosCommand } from './todo.js'
import { tokensCommand } from './tokens.js'

export function setupCommands(todoManager: TodoManager): CommandRegistry {
  const registry = new CommandRegistry()

  const commands = [
    helpCommand,
    clearCommand,
    compactCommand,
    tokensCommand,
    sessionsCommand,
    resumeCommand,
    createTodosCommand(todoManager),
  ]

  commands.forEach((c) => {
    registry.register(c)
  })

  return registry
}
