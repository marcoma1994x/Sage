import { countTokens } from './token-counter.js'

// 8000 token 上限 — 单个 tool 结果最多占 8K token，足够 LLM 理解内容，又不会吃掉太多 context
const MAX_TOOL_RESULT_TOKENS = 8000

// 截断提示 — 告诉 LLM 内容被截断了，并建议用 grep 或指定行范围来读取更多。
// 这样 LLM 知道信息不完整，可以自主决定是否需要进一步查看
const TRUNCATION_NOTICE
  = '\n\n[Output truncated. Use grep or read with specific line range to see more.]'

export function truncateToolResult(content: string): string {
  const tokens = countTokens(content)
  console.log(`[Truncate]: content has ${tokens} tokens, limit is ${MAX_TOOL_RESULT_TOKENS}`)
  if (tokens <= MAX_TOOL_RESULT_TOKENS)
    return content

  // 按行截断，而不是按字符，避免截断到一行中间
  const lines = content.split('\n')
  let result = ''
  let currentTokens = 0
  const noticeTokens = countTokens(TRUNCATION_NOTICE)

  for (const line of lines) {
    const lineTokens = countTokens(`${line}\n`)
    if (currentTokens + lineTokens + noticeTokens > MAX_TOOL_RESULT_TOKENS)
      break
    result += `${line}\n`
    currentTokens += lineTokens
  }

  return result + TRUNCATION_NOTICE
}
