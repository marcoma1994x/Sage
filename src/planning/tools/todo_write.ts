/**
 * TodoWrite Tool - LLM 用于管理 todo 列表的工具
 *
 * 职责：
 * 1. 定义 LLM 可见的接口（inputSchema）
 * 2. 验证输入参数
 * 3. 调用 TodoManager 更新状态
 * 4. 返回渲染结果给 LLM
 *
 * 设计原则：
 * - 依赖注入：接收 TodoManager 实例（而非内部创建）
 * - 容错性：捕获所有错误，返回友好的错误信息
 * - 职责分离：只负责接口适配，不负责业务逻辑
 *
 * 为什么放在 planning/tools/ 而非 tools/：
 * - tools/ 存放操作环境的工具（read、write、bash 等）
 * - planning/tools/ 存放 Agent 自我管理的工具（todo、task 等）
 * - 职责分离，依赖方向正确
 */

import type { Tool, ToolResult } from '../../tools/type.js'
import type { TodoManager } from '../todo-manager.js'
import type { TodoItem } from '../types.js'

/**
 * 创建 TodoWrite tool 的工厂函数
 *
 * @param todoManager - TodoManager 实例（依赖注入）
 * @returns Tool 对象
 *
 */
export function createTodoWriteTool(todoManager: TodoManager): Tool {
  return {
    definition: {
      name: 'todo_write',
      /**
       * 工具描述（LLM 会读取这个）
       *
       * 关键信息：
       * 1. 何时使用：多步骤任务
       * 2. 如何使用：创建计划 → 执行 → 更新状态
       * 3. 约束条件：只能一个 in_progress
       */
      description: `Manage your todo list for multi-step tasks.

WHEN TO USE:
- Multi-step tasks (3+ steps)
- Tasks with dependencies
- Tasks that take >5 minutes

HOW TO USE:
1. Call this at the START to create a plan
2. Update after completing each step
3. Mark items as "completed" immediately after finishing

IMPORTANT RULES:
- Only ONE todo can be "in_progress" at a time
- Always update the list to show progress
- Use specific, measurable task descriptions

STATUS VALUES:
- "pending": Not started yet
- "in_progress": Currently working on (only one allowed)
- "completed": Finished

EXAMPLE:
User: "Add user authentication"
You should call:
{
  "items": [
    {"id": "1", "content": "Create User model with email/password fields", "status": "pending"},
    {"id": "2", "content": "Add bcrypt for password hashing", "status": "pending"},
    {"id": "3", "content": "Implement login/logout endpoints", "status": "pending"},
    {"id": "4", "content": "Write authentication tests", "status": "pending"}
  ]
}

Then after completing step 1:
{
  "items": [
    {"id": "1", "content": "Create User model with email/password fields", "status": "completed"},
    {"id": "2", "content": "Add bcrypt for password hashing", "status": "in_progress"},
    {"id": "3", "content": "Implement login/logout endpoints", "status": "pending"},
    {"id": "4", "content": "Write authentication tests", "status": "pending"}
  ]
}`,

      /**
       * 输入参数的 JSON Schema
       *
       * LLM 会根据这个 schema 生成参数
       * 必须严格符合 JSON Schema 规范
       */
      inputSchema: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            description: 'List of todo items with id, content, and status',
            items: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'Unique identifier (e.g., "1", "2", "3")',
                },
                content: {
                  type: 'string',
                  description: 'Task description (specific and measurable)',
                },
                status: {
                  type: 'string',
                  enum: ['pending', 'in_progress', 'completed'],
                  description: 'Current status of the task',
                },
              },
              required: ['id', 'content', 'status'],
            },
          },
        },
        required: ['items'],
      },
    },

    /**
     * 工具执行函数
     *
     * 执行流程：
     * 1. 验证输入（TypeScript 类型检查）
     * 2. 调用 TodoManager.update()
     * 3. 返回渲染结果或错误信息
     *
     * @param raw - LLM 传入的参数
     * @returns 执行结果（success + output 或 error）
     */
    execute: async (raw: unknown): Promise<ToolResult> => {
      const input = raw as { items: TodoItem[] }
      try {
        // 1. 基本验证
        if (!input.items || !Array.isArray(input.items)) {
          return {
            isError: true,
            content: 'Invalid input: "items" must be an array',
          }
        }

        if (input.items.length === 0) {
          return {
            isError: true,
            content: 'Invalid input: "items" cannot be empty',
          }
        }

        // 2. 验证每个 item 的必需字段
        for (const item of input.items) {
          if (!item.id || !item.content || !item.status) {
            return {
              isError: true,
              content: `Invalid item: missing required fields (id, content, status). Got: ${JSON.stringify(item)}`,
            }
          }

          if (!['pending', 'in_progress', 'completed'].includes(item.status)) {
            return {
              isError: true,
              content: `Invalid status "${item.status}". Must be: pending, in_progress, or completed`,
            }
          }
        }

        // 3. 调用 TodoManager 更新状态
        // TodoManager 会自动处理约束验证和修复
        const result = todoManager.update(input.items)

        // 4. 返回成功结果（包含渲染后的 todo 列表）
        return {
          content: result,
        }
      }
      catch (error) {
        // 5. 捕获所有错误，返回友好的错误信息
        return {
          isError: true,
          content:
            error instanceof Error ? error.message : 'Unknown error occurred',
        }
      }
    },
  }
}
