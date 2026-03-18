interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
}

function isRetryable(error: unknown): boolean {
  // AbortError 永远不重试
  if (error instanceof Error && error.name === 'AbortError')
    return false

  // OpenAI SDK 抛出的错误带 status 属性
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status
    return status === 429 || status >= 500
  }
  // 网络错误（无 status）
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    return (
      msg.includes('timeout')
      || msg.includes('econnreset')
      || msg.includes('fetch failed')
    )
  }
  return false
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: Partial<RetryOptions>,
): Promise<T> {
  const { maxRetries, baseDelayMs } = { ...DEFAULT_OPTIONS, ...options }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    }
    catch (error) {
      const isLast = attempt === maxRetries
      if (isLast || !isRetryable(error)) {
        throw error
      }
      const delay = baseDelayMs * 2 ** attempt
      console.log(
        `[Retry]: attempt ${attempt + 1} failed, retrying in ${delay}ms...`,
      )
      await sleep(delay)
    }
  }
  throw new Error('Unreachable')
}
