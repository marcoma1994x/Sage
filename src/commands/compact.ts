import type { Command, CommandContext } from './type.js'

export const compactCommand: Command = {
  name: 'compact',
  description: 'Compact conversation history',
  execute: async (ctx: CommandContext, args: string) => {
    if (ctx.messages.length === 0) {
      console.log('\nNothing to compact.\n')
      return
    }

    console.log('\n[Compaction]: compacting...')
    const compacted = await ctx.compaction.compact(
      ctx.messages,
      ctx.provider,
      args || undefined,
    )
    ctx.setMessages(compacted)
    console.log('[Compaction]: done.\n')
  },
}
