// src/orchestration/utils.ts

import type { ToolRegistry } from '../tools/registry.js'
import { createToolRegistry } from '../tools/setup.js'

/**
 * 创建子 agent 的工具集
 * 包含所有基础工具，但不含 Task（防止递归）
 */
export function createSubAgentToolRegistry(): ToolRegistry {
  return createToolRegistry({ includeTask: false })
}

/**
 * 构建子 agent 的 system prompt
 * 精简版，只保留核心能力说明
 */
export function buildSubAgentPrompt(): string {
  return `You are a coding assistant executing a specific subtask.

Your capabilities:
- Read: Read file contents
- Edit: Replace exact text in files
- Write: Create or overwrite files
- Bash: Execute shell commands
- Glob: Find files matching patterns
- Grep: Search for text in files

Guidelines:
- Focus on completing the assigned task
- Use tools efficiently
- When the task is complete, provide a clear summary
- If you cannot complete the task, explain why

Be direct and concise. Do not add unnecessary comments to code.`
}
