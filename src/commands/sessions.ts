import type { Command, CommandContext } from './type.js'
import chalk from 'chalk'

export const sessionsCommand: Command = {
  name: 'sessions',
  description: 'List recent sessions',
  async execute(ctx: CommandContext) {
    const { sessionStore } = ctx
    const sessions = sessionStore.list()

    if (sessions.length === 0) {
      console.log(chalk.dim('No sessions found.'))
      return
    }

    console.log(chalk.bold(`\nRecent sessions (${sessions.length}):\n`))
    for (const s of sessions.slice(0, 20)) {
      const date = new Date(s.updatedAt).toLocaleString()
      const current = s.id === sessionStore.session.id ? chalk.green(' (current)') : ''
      console.log(
        `  ${chalk.dim(s.id.slice(0, 8))}  ${date}  ${chalk.cyan(s.cwd)}  ${s.messageCount} msgs${current}`,
      )
    }
    console.log()
  },
}
