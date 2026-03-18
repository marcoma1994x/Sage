import type { Command } from './type.js'

export const helpCommand: Command = {
  name: 'help',
  description: 'List all available commands',
  execute: async () => {
    // 通过 registry 获取所有命令需要循环依赖，这里直接从 ctx 获取不了
    // 所以 help 的内容硬编码，后面有更好的方案再改
    console.log('\nAvailable commands:')
    console.log('  /help              List all available commands')
    console.log('  /clear             Clear conversation history')
    console.log('  /compact [hint]    Compact conversation history, optional hint for what to preserve')
    console.log('  /tokens            Show current token usage')
    console.log()
  },
}
