import type { Tool, ToolResult } from './type.js'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { check } from '../harness/harness.js'

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
    const { content } = input
    try {
      // 确保目录存在
      await mkdir(path.dirname(filePath), { recursive: true })
      await writeFile(filePath, content, 'utf-8')
      // --- Harness verification ---
      const diagnosis = check(content, filePath)
      return {
        content: `Created ${filePath} (${content.length} bytes).${diagnosis}`,
      }
    }
    catch (err) {
      return { content: `Error writing file: ${err}`, isError: true }
    }
  },
}
