import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// fs.readFileSync 而不是 fs/promises — system prompt 在启动时构建一次，同步读取更简单
function loadFileIfExists(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8').trim()
  }
  catch {
    return null
  }
}

function loadSageConfigs(cwd: string): string {
  const configs: { label: string; content: string }[] = []

  // 全局配置：~/.sage/SAGE.md
  const globalPath = path.join(os.homedir(), '.sage', 'SAGE.md')
  const globalContent = loadFileIfExists(globalPath)
  if (globalContent) {
    configs.push({
      label: 'Global config (~/.sage/SAGE.md)',
      content: globalContent,
    })
  }

  // 项目级配置：$cwd/SAGE.md
  const projectPath = path.join(cwd, 'SAGE.md')
  const projectContent = loadFileIfExists(projectPath)

  if (projectContent) {
    configs.push({
      label: 'Project config (SAGE.md)',
      content: projectContent,
    })
  }

  if (configs.length === 0)
    return ''

  return configs.map(c => `## ${c.label}\n\n${c.content}`).join('\n')
}

export function buildSystemPrompt(cwd: string): string {
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const userConfigs = loadSageConfigs(cwd)

  return `You are Sage, an interactive CLI tool that helps users with software engineering tasks.

## Tone and style
- Be concise, direct, and to the point.
- Do not add unnecessary preamble or postamble.
- Do not explain your code unless the user asks.

## Tool usage
- Use Read to read files. NEVER use Bash to run cat, head, or tail.
- Use Edit for small changes to existing files (old_string → new_string replacement).
- Use Write for creating new files or completely rewriting existing files.
- Use Bash for running commands: tests, builds, git, package managers, etc.
- When editing a file, always Read it first to see the exact content.

## Environment
Working directory: ${cwd}
Platform: ${os.platform()}
Today's date: ${date}
${userConfigs ? `\n## User Instructions\n\n${userConfigs}\n` : ''}
`
}
