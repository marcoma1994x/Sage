/**
 * 全局中断信号管理。
 *
 * 这是一个独立的状态模块，不依赖任何业务代码。
 * 任何需要检查中断状态的地方直接 import 使用，不需要通过参数传递。
 *
 * 用法：
 *   import { signal } from 'process/signal.js'
 *
 *   signal.start()          // 开始一轮新操作
 *   signal.abort()          // 中断
 *   signal.aborted          // 检查是否已中断
 *   signal.current          // 获取当前 AbortSignal（传给 SDK 等需要原生 signal 的地方）
 */

class InterruptSignal {
  private controller: AbortController | null = null

  /** 开始一轮新的可中断操作 */
  start(): void {
    this.controller = new AbortController()
  }

  /** 中断当前操作 */
  abort(): void {
    this.controller?.abort()
  }

  /** 当前操作是否已被中断 */
  get aborted(): boolean {
    return this.controller?.signal.aborted ?? false
  }

  /** 是否有活跃的操作 */
  get active(): boolean {
    return this.controller !== null
  }

  /** 获取原生 AbortSignal，用于传给需要它的 SDK */
  get current(): AbortSignal | undefined {
    return this.controller?.signal
  }

  /** 操作结束，重置状态 */
  clear(): void {
    this.controller = null
  }
}

export const signal = new InterruptSignal()
