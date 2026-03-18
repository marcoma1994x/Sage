import { clearCommand } from './clear.js'
import { compactCommand } from './compact.js'
import { helpCommand } from './help.js'
import { CommandRegistry } from './registry.js'
import { resumeCommand } from './resume.js'
import { sessionsCommand } from './sessions.js'
import { tokensCommand } from './tokens.js'

export function createCommandRegistry(): CommandRegistry {
  const registry = new CommandRegistry()

  const commands = [
    helpCommand,
    clearCommand,
    compactCommand,
    tokensCommand,
    sessionsCommand,
    resumeCommand,
  ]

  commands.forEach((c) => {
    registry.register(c)
  })

  return registry
}
