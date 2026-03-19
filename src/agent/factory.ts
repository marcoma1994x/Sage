import type { AppOptions } from '../app.js'

import { setupCommands } from '../commands/setup.js'
import { buildSystemPrompt } from '../context/system-prompt.js'
import { OpenAIProvider } from '../llm/openai.js'
import { AgentLoop } from './agent-loop.js'
import { AgentRunner } from './agent-runner.js'
import { setupAgent } from './setup.js'

export function createAgent(options: AppOptions): AgentRunner {
  const provider = new OpenAIProvider(options.modelName)
  const { tools, todoManager, sessionStore, messageManager } = setupAgent(provider, options)
  const commands = setupCommands(todoManager)

  // 创建 AgentLoop
  const agentLoop = new AgentLoop({
    provider,
    tools,
    systemPrompt: buildSystemPrompt(),
    commands,
    maxIterations: 20,
    sessionStore,
    messageManager,
    todoManager,
  })

  // 用 AgentRunner 包装
  return new AgentRunner(agentLoop, sessionStore)
}
