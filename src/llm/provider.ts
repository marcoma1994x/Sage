import type { ToolDefinition } from '../tools/type.js'

export interface ToolCall {
  id: string;
  name: string;
  input: unknown;
}

export interface Message {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

export type StreamEvent
  = | { type: 'text_delta'; text: string }
    | { type: 'tool_call_start'; id: string; name: string }
    | { type: 'tool_call_done'; id: string; input: unknown }
    | { type: 'done'; result: ChatResult }

export interface ChatResult {
  text: string;
  toolCalls: ToolCall[];
}

export interface LLMProvider {
  modelName: string,
  chat: (
    messages: Message[],
    tools?: ToolDefinition[],
    systemPrompt?: string,
  ) => Promise<ChatResult>;
  chatStream: (
    messages: readonly Message[],
    tools?: ToolDefinition[],
    systemPrompt?: string,
  ) => AsyncIterable<StreamEvent>;
}

export type { ToolDefinition }
