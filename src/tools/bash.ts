import type { Buffer } from 'node:buffer'
import type { Tool, ToolResult } from './type.js'
import { spawn } from 'node:child_process'
import { askConfirmation } from '../io/confirm.js'
import { isSafeCommand } from '../security/policy.js'

interface BashInput {
  command: string;
  timeout?: number;
}

export const bashTool: Tool = {
  definition: {
    name: 'Bash',
    description:
      'Executes a shell command and returns the output. '
      + 'Use this for running tests, git operations, installing packages, builds, etc. '
      + 'Do NOT use this for reading files (use Read), searching code (use Grep/Glob), or listing directories. '
      + 'Commands have a default timeout of 30 seconds.',
    inputSchema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The shell command to execute',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds (default: 30000)',
        },
      },
      required: ['command'],
    },
  },
  execute: async (raw: unknown): Promise<ToolResult> => {
    const input = raw as BashInput
    const timeout = input.timeout ?? 30000

    // 安全检查：非安全命令需要用户确认
    if (!isSafeCommand(input.command)) {
      console.log(`\n[Security]: Potentially dangerous command:`)
      console.log(`  $ ${input.command}`)
      const confirmed = await askConfirmation('Allow execution?')
      if (!confirmed) {
        return { content: 'Command rejected by user.', isError: true }
      }
    }

    return new Promise((resolve) => {
      const child = spawn('sh', ['-c', input.command], {
        timeout,
      })

      let stdout = ''
      let stderr = ''

      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString()
      })

      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString()
      })

      child.on('close', (code) => {
        // 截断过长的输出，防止撑爆 context
        const maxLen = 30000
        let output = stdout + (stderr ? `\n[stderr]\n${stderr}` : '')
        if (output.length > maxLen) {
          output = `${output.slice(0, maxLen)}\n...[truncated, total ${output.length} chars]`
        }
        if (code !== 0) {
          resolve({
            content: `Command exited with code ${code}\n${output}`,
            isError: true,
          })
        }
        else {
          resolve({ content: output || '(no output)' })
        }
      })

      child.on('error', (err) => {
        resolve({
          content: `Error executing command: ${err.message}`,
          isError: true,
        })
      })
    })
  },
}
