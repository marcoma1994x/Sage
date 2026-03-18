import type { AppOptions } from '../app.js'
import type { SessionStore } from '../memory/session-store.js'
import process from 'node:process'
import { createCommandRegistry } from '../commands/setup.js'
import { buildSystemPrompt } from '../context/system-prompt.js'
import { OpenAIProvider } from '../llm/openai.js'
import { createToolRegistry } from '../tools/setup.js'
import { AgentLoop } from './agent-loop.js'

export function createAgent(options: AppOptions, sessionStore: SessionStore): AgentLoop {
  const provider = new OpenAIProvider(options.modelName)

  return new AgentLoop({
    provider,
    tools: createToolRegistry({ provider }),
    systemPrompt: buildSystemPrompt(process.cwd()),
    commands: createCommandRegistry(),
    maxIterations: 20,
    sessionStore,
  })
}
