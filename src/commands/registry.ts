import type { Command, CommandContext } from './type.js'

export class CommandRegistry {
  private commands = new Map<string, Command>()

  register(command: Command): void {
    this.commands.set(command.name, command)
  }

  isCommand(input: string): boolean {
    return input.trimStart().startsWith('/')
  }

  parse(input: string): { name: string; args: string } | null {
    const trimmed = input.trimStart()
    if (!trimmed.startsWith('/'))
      return null

    const spaceIndex = trimmed.indexOf(' ')
    if (spaceIndex === -1) {
      return { name: trimmed.slice(1), args: '' }
    }
    return {
      name: trimmed.slice(1, spaceIndex),
      args: trimmed.slice(spaceIndex + 1).trim(),
    }
  }

  async execute(input: string, ctx: CommandContext): Promise<boolean> {
    const parsed = this.parse(input)
    if (!parsed)
      return false

    const command = this.commands.get(parsed.name)
    if (!command) {
      console.log(
        `Unknown command: /${parsed.name}. Type /help for available commands.`,
      )
      return true
    }

    await command.execute(ctx, parsed.args)
    return true
  }
}
