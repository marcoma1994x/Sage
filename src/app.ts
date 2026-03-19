import type { AgentRunner } from './agent/agent-runner.js'
import process from 'node:process'
import * as readLine from 'node:readline'
import chalk from 'chalk'
import { createAgent } from './agent/factory.js'
import { setTerminal } from './io/terminal.js'
import { signal } from './process/signal.js'

export interface AppOptions {
  modelName: string
  resumeSessionId?: string;
}

export class App {
  private rl: readLine.Interface
  private agent: AgentRunner

  constructor(options: AppOptions) {
    this.rl = this.createReadline()

    this.agent = createAgent(options)

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
