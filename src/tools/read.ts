import type { Tool, ToolResult } from './type.js'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

interface ReadInput {
  file_path: string
  offset?: number
  limit?: number
}

export const readTool: Tool = {
  definition: {
    name: 'read',
    description: 'Reads a file from the local filesystem and returns its contents with line numbers.',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'The path to the file to read',
        },
      },
      required: ['file_path'],
    },
  },
  execute: async (raw: unknown): Promise<ToolResult> => {
    const input = raw as ReadInput
    try {
      const filePath = path.resolve(input.file_path)
      const content = await readFile(filePath, 'utf-8')
      const allLines = content.split('\n')
      const total = allLines.length
      const start = Math.max(0, (input.offset ?? 1) - 1)
      const end = input.limit ? Math.min(start + input.limit, total) : total
      const lines = allLines.slice(start, end)

      const numbered = lines.map((line, i) => `${start + i + 1}|${line}`).join('\n')

      // 输出加了 header — [Lines 1-200 of 1500] 让 LLM 知道总共多少行、当前看到哪里，方便决定是否需要继续读
      const header = `[Lines ${start + 1}-${end} of ${total}]`

      return { content: `${header}\n${numbered}` }
    }

    catch {
      return { content: `Error: Could not read file: ${input.file_path}`, isError: true }
    }
  },
}
