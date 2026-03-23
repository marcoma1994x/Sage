// ============================================================
// Circuit Breaker
//
// Single responsibility: per-file retry counting + trip decision.
// No formatting, no verification, no LLM calls.
//
// Lifecycle:
//   1. Tool calls record(filePath, hasViolations)
//   2. If hasViolations → increment counter
//   3. If !hasViolations → reset counter (file is clean)
//   4. Tool calls isTripped(filePath) before formatting
//   5. If tripped → Tool emits ABORT, skips formatViolations
// ============================================================

const MAX_RETRIES = 3

const retryCount = new Map<string, number>()

/**
 * Record a verification result for a file.
 * - violations present → increment counter
 * - no violations → reset counter (file is clean)
 */
export function record(filePath: string, hasViolations: boolean): void {
  if (!hasViolations) {
    retryCount.delete(filePath)
    return
  }
  retryCount.set(filePath, (retryCount.get(filePath) ?? 0) + 1)
}

/**
 * Check if a file has exceeded the retry limit.
 */
export function isTripped(filePath: string): boolean {
  return (retryCount.get(filePath) ?? 0) >= MAX_RETRIES
}

/**
 * Get current attempt number for a file (1-based, after record()).
 * Returns 0 if no violations have been recorded.
 */
export function getAttempt(filePath: string): number {
  return retryCount.get(filePath) ?? 0
}

/**
 * Get the max retries constant.
 */
export function getMaxRetries(): number {
  return MAX_RETRIES
}

/**
 * Generate the ABORT message for a tripped file.
 */
export function abortMessage(filePath: string): string {
  return `

🛑 HARNESS ABORT (${filePath}): Tried to fix ${MAX_RETRIES} times, violations persist. Skip this file and continue with other tasks.`
}

/**
 * Reset all state. Call in tests or when starting a new task.
 */
export function reset(): void {
  retryCount.clear()
}
