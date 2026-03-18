import type * as readLine from 'node:readline'

let _rl: readLine.Interface | null = null

export function setTerminal(rl: readLine.Interface): void {
  _rl = rl
}

export function getTerminal(): readLine.Interface {
  if (!_rl)
    throw new Error('Terminal not initialized')
  return _rl
}
