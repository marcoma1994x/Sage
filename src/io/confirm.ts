import { getTerminal } from './terminal.js'

export function askConfirmation(message: string): Promise<boolean> {
  const rl = getTerminal()

  return new Promise((resolve) => {
    rl.question(`${message} (y/n): `, (answer) => {
      resolve(answer.trim().toLowerCase() === 'y')
    })
  })
}
