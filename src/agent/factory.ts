import type { AppOptions } from '../app.js'
import type { SessionStore } from '../memory/session-store.js'
import { setupCommands } from '../commands/setup.js'
import { buildSystemPrompt } from '../context/system-prompt.js'
import { OpenAIProvider } from '../llm/openai.js'
import { AgentLoop } from './agent-loop.js'
import { setupAgent } from './setup.js'

export function createAgent(options: AppOptions, sessionStore: SessionStore): AgentLoop {
  const provider = new OpenAIProvider(options.modelName)
  const { tools, todoManager } = setupAgent(provider)
  const commands = setupCommands(todoManager)
  return new AgentLoop({
    provider,
    tools,
    systemPrompt: buildSystemPrompt(),
    commands,
    maxIterations: 20,
    sessionStore,
    todoManager,
  })
}
