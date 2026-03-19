import type { Compaction } from '../context/compaction.js'
import type { LLMProvider, Message } from '../llm/provider.js'
import type { SessionStore } from '../memory/session-store.js'

export interface CommandContext {
  messages: readonly Message[];
  setMessages: (messages: readonly Message[]) => void;
  provider: LLMProvider;
  compaction: Compaction;
  systemPrompt: string;
  sessionStore: SessionStore
}

export interface Command {
  name: string;
  description: string;
  execute: (ctx: CommandContext, args: string) => Promise<void>;
}
