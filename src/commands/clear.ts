import type { Command, CommandContext } from './type.js'

export const clearCommand: Command = {
  name: 'clear',
  description: 'Clear conversation history',
  execute: async (ctx: CommandContext) => {
    ctx.setMessages([])
    console.log('\nConversation cleared.\n')
  },
}
