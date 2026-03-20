/**
 * SubAgentPool - 并发控制层
 *
 * 职责:
 * - 限制同时运行的 sub-agent 数量
 * - 管理等待队列(FIFO)
 * - 自动调度
 */

export class SubAgentPool {
  private maxConcurrency: number
  private running: number = 0
  private queue: Array<() => void> = []

  constructor(maxConcurrency = 7) {
    this.maxConcurrency = maxConcurrency
  }

  /**
   * 将当前任务加入等待队列
   *
   * @returns Promise,在轮到执行时 resolve
   */
  private enqueue(): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push(resolve)
    })
  }

  /**
   * 处理队列中的下一个任务
   */
  private processQueue(): void {
    if (this.queue.length > 0 && this.running < this.maxConcurrency) {
      const next = this.queue.shift()
      if (next) {
        next() // resolve Promise,让等待的任务继续执行
      }
    }
  }

  /**
   * 执行一个任务,受并发限制
   *
   * @param fn - 要执行的异步函数
   * @returns Promise,在任务完成时 resolve
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // 如果达到并发限制,加入队列等待
    if (this.running >= this.maxConcurrency) {
      await this.enqueue()
    }

    // 开始执行
    this.running++

    try {
      return await fn()
    }
    finally {
      // 执行完成,释放资源
      this.running--
      this.processQueue()
    }
  }

  /**
   * 并行执行多个任务,受并发限制
   *
   * @param tasks - 任务数组
   * @returns Promise 数组的结果
   */
  async executeAll<T>(tasks: Array<() => Promise<T>>): Promise<T[]> {
    const promises = tasks.map(task => this.execute(task))
    return Promise.all(promises)
  }

  /**
   * 获取当前状态(用于调试)
   */
  getStatus() {
    return {
      running: this.running,
      queued: this.queue.length,
      maxConcurrency: this.maxConcurrency,
    }
  }
}
