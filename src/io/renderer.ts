import process from 'node:process'

export class TerminalRenderer {
  write(text: string): void {
    process.stdout.write(text)
  }

  flush(): void {
    process.stdout.write('\n')
  }
}
