import type { Tool, ToolResult } from './type.js'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

interface WriteInput {
  file_path: string
  content: string
}

export const writeTool: Tool = {
  definition: {
    name: 'Write',
    description:
      'Creates a new file or completely overwrites an existing file with the given content. '
      + 'Use this for creating new files or when the entire file needs to be rewritten. '
      + 'For small changes to existing files, use Edit instead.',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'The path to the file to create or overwrite',
        },
        content: {
          type: 'string',
          description: 'The complete file content to write',
        },
      },
      required: ['file_path', 'content'],
    },
  },

  execute: async (raw: unknown): Promise<ToolResult> => {
    const input = raw as WriteInput
    const filePath = path.resolve(input.file_path)

    try {
      // 确保目录存在
      await mkdir(path.dirname(filePath), { recursive: true })
      await writeFile(filePath, input.content, 'utf-8')
      return { content: `Written to ${input.file_path}` }
    }
    catch (err) {
      return { content: `Error writing file: ${err}`, isError: true }
    }
  },
}
