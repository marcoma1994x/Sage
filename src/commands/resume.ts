import type { Command, CommandContext } from './type.js'
import process from 'node:process'
import chalk from 'chalk'

export const resumeCommand: Command = {
  name: 'resume',
  description: 'Resume a previous session. Usage: /resume [id-prefix]',
  async execute(ctx: CommandContext, args: string) {
    const { sessionStore } = ctx

    let targetId: string

    if (!args) {
      const latest = sessionStore.latest(process.cwd())
      if (!latest) {
        console.log(chalk.dim('No previous session found for this directory.'))
        return
      }
      if (latest.id === sessionStore.session.id) {
        console.log(chalk.dim('Already in the latest session.'))
        return
      }
      targetId = latest.id
    }
    else {
      const all = sessionStore.list()
      const match = all.find(s => s.id.startsWith(args))
      if (!match) {
        console.log(chalk.red(`No session matching "${args}"`))
        return
      }
      targetId = match.id
    }

    const session = sessionStore.load(targetId)
    if (!session) {
      console.log(chalk.red('Failed to load session.'))
      return
    }

    sessionStore.resume(session)
    ctx.setMessages([...session.messages])
    console.log(
      chalk.green(`Resumed session ${targetId.slice(0, 8)} (${session.messageCount} messages)`),
    )
  },
}
