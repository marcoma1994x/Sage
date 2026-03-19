import type {
  ChatResult,
  LLMProvider,
  Message,
  StreamEvent,
  ToolCall,
  ToolDefinition,
} from './provider.js'
import process from 'node:process'
import OpenAI from 'openai'
import { signal } from '../process/signal.js'
import { withRetry } from '../utils/retry.js'
import 'dotenv/config'

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI
  public modelName: string

  constructor(modelName: string) {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
    this.modelName = modelName
  }

  async chat(
    messages: readonly Message[],
    tools?: ToolDefinition[],
    systemPrompt?: string,
  ): Promise<ChatResult> {
    const response = await withRetry(() =>
      this.client.chat.completions.create({
        model: this.modelName,
        messages: this.convertMessages(messages, systemPrompt),
        tools: tools ? this.convertTools(tools) : undefined,
      }),
    )
    const choice = response.choices[0]
    const message = choice?.message

    // 提取 tool calls
    const toolCalls: ToolCall[] = (message?.tool_calls ?? [])
      .filter(tc => tc.type === 'function')
      .map((tc) => {
        let input: unknown
        try {
          input = JSON.parse(tc.function.arguments)
        }
        catch {
          input = { _parseError: true, rawArguments: tc.function.arguments }
        }
        return { id: tc.id, name: tc.function.name, input }
      })

    console.log(
      `[Assistant]: assistant response is: ${message?.content}, ${JSON.stringify(toolCalls)}`,
    )
    return {
      text: message?.content ?? '',
      toolCalls,
    }
  }

  /**
   * 流式调用 LLM，返回 AsyncIterable<StreamEvent>。
   * signal 用于外部中断：abort 时 SDK 会立刻取消 HTTP 连接，
   * for await 循环抛出 AbortError，由调用方捕获处理。
   */
  async* chatStream(
    messages: readonly Message[],
    tools?: ToolDefinition[],
    systemPrompt?: string,
  ): AsyncIterable<StreamEvent> {
    const stream = await withRetry(() =>
      this.client.chat.completions.create(
        {
          model: this.modelName,
          messages: this.convertMessages(messages, systemPrompt),
          tools: tools ? this.convertTools(tools) : undefined,
          stream: true,
        },
        { signal: signal.current }, // signal 透传给 create，abort 时 SDK 直接断开 HTTP 连接
      ),
    )
    // 累积 tool call 数据。
    // streaming 时 tool call 的 arguments 是分片到达的，
    // 需要用 buffer 拼接完整后再 JSON.parse。
    const toolCallBuffers = new Map<
      number,
      { id: string; name: string; arguments: string }
    >()

    let text = ''

    for await (const chunk of stream) {
      if (signal.aborted)
        break

      const delta = chunk.choices[0]?.delta

      // 文本片段
      if (delta?.content) {
        text += delta.content
        yield { type: 'text_delta', text: delta.content }
      }

      // tool call 片段
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index

          if (!toolCallBuffers.has(idx)) {
            toolCallBuffers.set(idx, {
              id: tc.id ?? '',
              name: tc.function?.name ?? '',
              arguments: '',
            })
            yield {
              type: 'tool_call_start',
              id: tc.id ?? '',
              name: tc.function?.name ?? '',
            }
          }

          const buf = toolCallBuffers.get(idx)!
          if (tc.id)
            buf.id = tc.id
          if (tc.function?.name)
            buf.name = tc.function.name
          if (tc.function?.arguments)
            buf.arguments += tc.function.arguments
        }
      }
    }

    // stream 结束，组装最终结果
    const toolCalls: ToolCall[] = []
    for (const buf of toolCallBuffers.values()) {
      let input: unknown
      try {
        input = JSON.parse(buf.arguments || '{}')
      }
      catch {
        input = { _parseError: true, rawArguments: buf.arguments }
      }
      toolCalls.push({ id: buf.id, name: buf.name, input })
    }

    // 发送所有 tool_call_done 事件
    for (const tc of toolCalls) {
      yield { type: 'tool_call_done', id: tc.id, input: tc.input }
    }

    yield { type: 'done', result: { text, toolCalls } }
  }

  /**
   * 统一消息格式 → OpenAI 格式
   *
   * 三种角色的转换：
   * - user → 直接映射
   * - assistant（带 toolCalls）→ assistant + tool_calls
   * - tool → role: "tool" + tool_call_id
   */
  private convertMessages(
    messages: readonly Message[],
    systemPrompt?: string,
  ): OpenAI.ChatCompletionMessageParam[] {
    const result: OpenAI.ChatCompletionMessageParam[] = []
    // system prompt 作为第一条 message
    if (systemPrompt) {
      result.push({ role: 'system', content: systemPrompt })
    }

    for (const m of messages) {
      if (m.role === 'assistant' && m.toolCalls?.length) {
        result.push({
          role: 'assistant' as const,
          content: m.content || null,
          tool_calls: m.toolCalls.map(tc => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.input),
            },
          })),
        })
      }
      else if (m.role === 'tool') {
        result.push({
          role: 'tool' as const,
          content: m.content,
          tool_call_id: m.toolCallId!,
        })
      }
      else {
        result.push({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })
      }
    }

    return result
  }

  /**
   * ToolDefinition → OpenAI 的 tool 格式
   */
  private convertTools(tools: ToolDefinition[]): OpenAI.ChatCompletionTool[] {
    return tools.map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      },
    }))
  }
}
