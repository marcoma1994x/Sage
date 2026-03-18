// 允许直接执行的只读命令
const SAFE_COMMANDS = [
  'ls',
  'cat',
  'head',
  'tail',
  'pwd',
  'echo',
  'wc',
  'find',
  'grep',
  'which',
  'whoami',
  'date',
  'env',
  'node',
  'npm',
  'pnpm',
  'git',
]

// shell 组合符号，出现任何一个就视为危险
const DANGEROUS_PATTERNS = [
  '|',
  ';',
  '&&',
  '||', // 管道和链式执行
  '`',
  '$(',
  '#{', // 命令替换
  '>',
  '>>',
  '<', // 重定向（可以覆盖文件）
  'rm ',
  'rm\t', // 显式删除
  'sudo ', // 提权
  'chmod ',
  'chown ', // 权限修改
  'curl ',
  'wget ', // 网络下载
  'eval ',
  'exec ', // 动态执行
  'kill ',
  'pkill ', // 进程操作
  'mv ',
  'cp ', // 文件移动/复制（可能覆盖）
  'dd ', // 磁盘操作
]

export function isSafeCommand(command: string): boolean {
  const trimmed = command.trim()

  // 包含任何危险模式 → 直接危险
  if (DANGEROUS_PATTERNS.some(p => trimmed.includes(p)))
    return false

  // 提取第一个词（实际执行的命令）
  // eslint-disable-next-line e18e/prefer-static-regex
  const binary = trimmed.split(/\s/)[0]

  // 命令本身必须在白名单中
  return SAFE_COMMANDS.includes(binary)
}
