import type { LLMProvider, Message } from '../llm/provider.js'
import { countMessageTokens, countTokens } from '../utils/token-counter.js'

interface CompactionOptions {
  maxTokens: number; // 模型的 context window 大小
  threshold: number; // 触发压缩的比例，比如 0.8
  preserveRecent: number; // 压缩时保留最近几轮不动
}

const DEFAULT_OPTIONS: CompactionOptions = {
  maxTokens: 128_000,
  threshold: 0.8,
  preserveRecent: 4,
}

export class Compaction {
  private options: CompactionOptions

  constructor(options?: Partial<CompactionOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  shouldCompact(messages: readonly Message[], systemPrompt: string): boolean {
    const total = countTokens(systemPrompt) + countMessageTokens(messages)
    const limit = this.options.maxTokens * this.options.threshold
    return total > limit
  }

  async compact(
    messages: readonly Message[],
    provider: LLMProvider,
    hint?: string,
  ): Promise<readonly Message[]> {
    const { preserveRecent } = this.options

    if (messages.length < preserveRecent) {
      return messages
    }
    // 分成两部分：要压缩的旧消息 + 保留的近期消息
    const oldMessages = messages.slice(0, messages.length - preserveRecent)
    const recentMessages = messages.slice(messages.length - preserveRecent)

    const hintInstruction = hint
      ? `\n\nAdditional instruction: ${hint}`
      : ''

    // 让 LLM 生成摘要
    const summaryPrompt = [
      {
        role: 'user' as const,
        content: `
        Summarize the following conversation history concisely. Preserve:
            - Key decisions made
            - File paths and code changes
            - Important errors and how they were resolved
            - Current task context and progress

        Be specific with file names, function names, and technical details. Do not lose any actionable information.
        ${hintInstruction}.
        Conversation: ${oldMessages.map(m => `[${m.role}]: ${m.content}`).join('\n\n')}`,
      },
    ]

    const result = await provider.chat(summaryPrompt)

    // 用摘要替换旧消息
    const summaryMessage: Message = {
      role: 'user',
      content: `[Previous conversation summary]\n${result.text}`,
    }

    const assistantAck: Message = {
      role: 'assistant',
      content: 'Understood. I have the context from our previous conversation. Let\'s continue.',
    }

    return [summaryMessage, assistantAck, ...recentMessages]
  }
}
