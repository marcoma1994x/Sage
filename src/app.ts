import type { AgentLoop } from './agent/agent-loop.js'

import process from 'node:process'
import * as readLine from 'node:readline'
import chalk from 'chalk'
import { createAgent } from './agent/factory.js'
import { setTerminal } from './io/terminal.js'
import { SessionStore } from './memory/session-store.js'
import { signal } from './process/signal.js'

export interface AppOptions {
  modelName: string
  resumeSessionId?: string;
}

export class App {
  private rl: readLine.Interface
  private agent: AgentLoop
  private sessionStore: SessionStore

  constructor(options: AppOptions) {
    this.rl = this.createReadline()

    this.sessionStore = new SessionStore({
      cwd: process.cwd(),
      model: options.modelName,
      resumeId: options.resumeSessionId,
    })
    this.agent = createAgent(options, this.sessionStore)

    // 恢复历史消息
    this.agent.setMessages([...this.sessionStore.session.messages])

    // 订阅 run 完成事件
    this.agent.on('run:complete', (messages) => {
      this.sessionStore.save(messages)
    })

    this.setupSignalHandlers()
  }

  run(): void {
    console.log('Sage v0.1.0\nType your message. Ctrl+C to exit.\n')
    this.rl.setPrompt('> ')
    this.rl.prompt()

    this.rl.on('line', async (input) => {
      if (!input.trim()) {
        this.rl.prompt()
        return
      }

      try {
        signal.start()
        await this.agent.run(input)
      }
      catch (err) {
        console.error('[Error]', err instanceof Error ? err.message : err)
      }
      finally {
        signal.clear()
        this.rl.prompt()
      }
    })
  }

  private createReadline(): readLine.Interface {
    const rl = readLine.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    })
    setTerminal(rl)
    return rl
  }

  private setupSignalHandlers(): void {
    this.rl.on('SIGINT', () => {
      if (signal.active) {
        signal.abort()
        console.log(chalk.dim('\n[Interrupted]\n'))
        this.rl.prompt()
      }
      else {
        console.log('\nBye!')
        this.rl.close()
        process.exit(0)
      }
    })
  }
}
