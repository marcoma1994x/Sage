import type { Command, CommandContext } from './type.js'
import { countMessageTokens, countTokens } from '../utils/token-counter.js'

export const tokensCommand: Command = {
  name: 'tokens',
  description: 'Show current token usage',
  execute: async (ctx: CommandContext) => {
    const systemTokens = countTokens(ctx.systemPrompt)
    const messageTokens = countMessageTokens(ctx.messages)
    const total = systemTokens + messageTokens

    console.log('\nToken usage:')
    console.log(`  System prompt:  ${systemTokens.toLocaleString()}`)
    console.log(
      `  Messages:       ${messageTokens.toLocaleString()} (${ctx.messages.length} messages)`,
    )
    console.log(`  Total:          ${total.toLocaleString()}`)
    console.log()
  },
}
