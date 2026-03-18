import type { Message } from '../llm/provider.js'
import { encoding_for_model } from 'tiktoken'

// encoding_for_model('gpt-4o') — tiktoken 会根据模型名选择对应的 tokenizer（gpt-4o 用的是 o200k_base）
const encoder = encoding_for_model('gpt-4o')

export function countTokens(text: string): number {
  return encoder.encode(text).length
}

export function countMessageTokens(messages: Message[]): number {
  let total = 0
  for (const msg of messages) {
    // 每条 message 有 ~4 tokens 的结构开销（role、分隔符等），这是 OpenAI 官方文档给的经验值
    total += 4
    total += countTokens(msg.content)

    // tool call 的 name 和 arguments 也要算进去，它们占 token
    if (msg.toolCalls) {
      for (const tc of msg.toolCalls) {
        total += countTokens(tc.name)
        total += countTokens(JSON.stringify(tc.input))
      }
    }
  }
  // 最后有一个 reply 的 priming token
  total += 2
  return total
}
