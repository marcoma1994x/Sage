import type { Tool, ToolResult } from './type.js'
import process from 'node:process'
import fg from 'fast-glob'

interface GlobInput {
  pattern: string
  path?: string
}

export const globTool: Tool = {
  definition: {
    name: 'Glob',
    description:
      'Finds files by name pattern. Returns a list of matching file paths. '
      + 'Examples: \'**/*.ts\' finds all TypeScript files, \'src/**/*.test.ts\' finds all test files in src.',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Glob pattern to match files (e.g. \'**/*.ts\', \'src/**/*.json\')',
        },
        path: {
          type: 'string',
          description: 'Directory to search in (default: current working directory)',
        },
      },
      required: ['pattern'],
    },
  },

  execute: async (raw: unknown): Promise<ToolResult> => {
    const input = raw as GlobInput
    try {
      const files = await fg(input.pattern, {
        cwd: input.path || process.cwd(),
        ignore: ['node_modules/**', '.git/**'],
      })

      if (files.length === 0) {
        return { content: 'No files matched.' }
      }

      return { content: files.join('\n') }
    }
    catch (err) {
      return { content: `Error: ${err}`, isError: true }
    }
  },
}
