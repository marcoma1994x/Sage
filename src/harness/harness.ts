/* eslint-disable e18e/prefer-static-regex */
// ============================================================
// Harness — Facade
//
// Single entry point for all harness logic.
// Tool code calls check() and gets back a string. That's it.
//
// Internally orchestrates: verify → circuit breaker → format → log.
// Tool code never imports verify, formatViolations, or breaker.
// ============================================================

import { appendFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import * as breaker from './circuit-breaker.js'
import { formatViolations, verify } from './verify.js'

const LOG_PATH = resolve(process.cwd(), 'harness.log.jsonl')

interface HarnessLogEntry {
  timestamp: string;
  filePath: string;
  violations: { ruleId: string; line: number }[];
  attempt: number;
  result: 'clean' | 'fix' | 'abort';
}

function log(entry: HarnessLogEntry): void {
  try {
    appendFileSync(LOG_PATH, `${JSON.stringify(entry)} `)
  }
  catch {
    // Logging failure must never break the tool.
  }
}

/**
 * Run harness checks on file content.
 *
 * @returns String to append to tool result.
 *          Empty string = all checks passed, nothing to append.
 */
export function check(content: string, filePath: string): string {
  const violations = verify(content, filePath)
  breaker.record(filePath, violations.length > 0)

  const attempt = breaker.getAttempt(filePath)

  // Extract line numbers from violation messages for logging
  const violationSummary = violations.map(v => ({
    ruleId: v.ruleId,
    line: Number.parseInt(v.message.match(/at line (\d+)/)?.[1] ?? '0', 10),
  }))

  if (violations.length === 0) {
    log({ timestamp: new Date().toISOString(), filePath, violations: [], attempt: 0, result: 'clean' })
    return ''
  }

  if (breaker.isTripped(filePath)) {
    log({ timestamp: new Date().toISOString(), filePath, violations: violationSummary, attempt, result: 'abort' })
    return breaker.abortMessage(filePath)
  }

  log({ timestamp: new Date().toISOString(), filePath, violations: violationSummary, attempt, result: 'fix' })

  return formatViolations(
    violations,
    attempt,
    breaker.getMaxRetries(),
  )
}
