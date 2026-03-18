import type { Buffer } from 'node:buffer'
import type { Tool, ToolResult } from './type.js'
import { spawn } from 'node:child_process'
import process from 'node:process'

interface GrepInput {
  pattern: string
  path?: string
  include?: string
}

export const grepTool: Tool = {
  definition: {
    name: 'Grep',
    description:
      'Searches file contents by regex pattern. Returns matching lines with file paths and line numbers. '
      + 'Use this to find where a function, variable, or string is used in the codebase. '
      + 'NEVER use Bash to run grep or rg. Always use this tool instead.',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Regex pattern to search for (e.g. \'LLMProvider\', \'import.*from\')',
        },
        path: {
          type: 'string',
          description: 'Directory to search in (default: current working directory)',
        },
        include: {
          type: 'string',
          description: 'File pattern to filter (e.g. \'*.ts\', \'*.json\')',
        },
      },
      required: ['pattern'],
    },
  },
  execute: async (raw: unknown): Promise<ToolResult> => {
    const input = raw as GrepInput
    const cwd = input.path || process.cwd()

    const args = ['-rn', '--color=never']
    // 排除常见无关目录
    args.push('--exclude-dir=node_modules', '--exclude-dir=.git', '--exclude-dir=dist')

    if (input.include) {
      args.push(`--include=${input.include}`)
    }

    args.push(input.pattern, '.')
    return new Promise((resolve) => {
      const child = spawn('grep', args, { cwd, timeout: 10000 })

      let output = ''

      child.stdout.on('data', (data: Buffer) => {
        output += data.toString()
      })

      child.stderr.on('data', (data: Buffer) => {
        output += data.toString()
      })

      child.on('close', (code) => {
        // grep 返回 1 表示没有匹配，不算错误
        if (code === 1 && output === '') {
          resolve({ content: 'No matches found.' })
          return
        }

        // 截断过长输出
        if (output.length > 30000) {
          output = `${output.slice(0, 30000)}\n...[truncated]`
        }

        resolve({ content: output || 'No matches found.' })
      })

      child.on('error', (err) => {
        resolve({ content: `Error: ${err.message}`, isError: true })
      })
    })
  },
}
