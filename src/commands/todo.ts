/**
 * /todos 命令 - 显示当前的 todo 列表
 *
 * 用法：
 * - /todos          显示完整的 todo 列表和统计信息
 * - /todos clear    清空 todo 列表
 */

import type { TodoManager } from '../planning/todo-manager.js'
import type { Command, CommandContext } from './type.js'

export function createTodosCommand(todoManager: TodoManager): Command {
  return {
    name: 'todos',
    description: 'Show or manage todo list',

    execute: async (ctx: CommandContext, args: string) => {
      // 处理子命令
      if (args.trim() === 'clear') {
        todoManager.clear()
        console.log('✅ Todo list cleared.')
        return
      }

      // 显示 todo 列表
      const stats = todoManager.getStats()

      if (stats.total === 0) {
        console.log('\n📋 No todos yet.')
        console.log('Start a multi-step task to create a plan.\n')
        return
      }

      // 显示统计信息
      console.log('\n📋 Todo List\n')
      console.log(`Total: ${stats.total}`)
      console.log(
        `✅ Completed: ${stats.completed} (${stats.completionRate}%)`,
      )
      console.log(`🔄 In Progress: ${stats.inProgress}`)
      console.log(`⏳ Pending: ${stats.pending}\n`)

      // 显示每个 todo 项
      const items = todoManager.getItems()

      items.forEach((item, index) => {
        const icon
          = todoManager.getStatusIcon(item.status)
        console.log(`${icon} ${index + 1}. ${item.content}`)
      })

      console.log('')
    },
  }
}
