import type { Tool, ToolResult } from './type.js'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

interface EditInput {
  file_path: string
  old_string: string
  new_string: string
  replace_all: boolean
}

export const editTool: Tool = {
  definition: {
    name: 'Edit',
    description:
      'Replaces an exact string match in a file with new content. '
      + 'Use Read tool first to see the current content. '
      + 'old_string must match exactly including whitespace and indentation. '
      + 'For creating new files or full rewrites, use Write instead.',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'The path to the file to modify',
        },
        old_string: {
          type: 'string',
          description: 'The exact text to find and replace',
        },
        new_string: {
          type: 'string',
          description: 'The replacement text',
        },
        replace_all: {
          type: 'boolean',
          description: 'Replace all occurrences (default: first only)',
        },
      },
      required: ['file_path', 'old_string', 'new_string'],
    },
  },
  execute: async (raw: unknown): Promise<ToolResult> => {
    const input = raw as EditInput
    const filePath = path.resolve(input.file_path)

    // 1. 读取文件
    let content: string
    try {
      content = await readFile(filePath, 'utf-8')
    }
    catch {
      return { content: `Error: File not found: ${filePath}`, isError: true }
    }

    // 2. 检查 old_string 是否存在
    if (!content.includes(input.old_string)) {
      return {
        content: `Error: old_string not found in ${input.file_path}. Use Read tool to verify exact content.`,
        isError: true,
      }
    }

    // 3. 替换
    const newContent = input.replace_all
      ? content.replaceAll(input.old_string, input.new_string)
      : content.replace(input.old_string, input.new_string)

    // 4. 写入
    await writeFile(filePath, newContent, 'utf-8')

    // 5. 返回结果
    const occurrences = content.split(input.old_string).length - 1
    const replaced = input.replace_all ? occurrences : 1
    return { content: `Edited ${input.file_path}: replaced ${replaced} occurrence(s).` }
  },
}
