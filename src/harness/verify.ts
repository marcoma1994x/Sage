// Harness Verify
//
// Pure function. No LLM calls. No side effects.
// Input: file content + file path + rules
// Output: array of violations (empty = all checks passed)
//
// This is the deterministic verification layer of the Harness.
// ============================================================

import type { HarnessRule, Violation } from './rules.js'
import path from 'node:path'
import { HARNESS_RULES } from './rules.js'

/**
 * Run all applicable harness rules against file content.
 *
 * @param content  - The file content to verify
 * @param filePath - The file path (used to filter rules by extension)
 * @param rules    - Optional custom rules (defaults to HARNESS_RULES)
 * @returns Array of violations. Empty = all checks passed.
 */
export function verify(
  content: string,
  filePath: string,
  rules: HarnessRule[] = HARNESS_RULES,
): Violation[] {
  const ext = path.extname(filePath)
  const violations: Violation[] = []

  for (const rule of rules) {
    // Skip rules that don't apply to this file type
    if (rule.appliesTo.length > 0 && !rule.appliesTo.includes(ext)) {
      continue
    }

    violations.push(...rule.check(content))
  }

  return violations
}

/**
 * Format violations into a string that gets appended to tool result.
 * Returns empty string if no violations.
 *
 * The format is designed for Agent consumption:
 * - Starts with a clear header so the Agent knows this is a harness check
 * - Each violation contains the exact fix instruction
 * - Ends with a directive to fix before proceeding
 */
export function formatViolations(violations: Violation[], attempt: number, maxRetries: number): string {
  if (violations.length === 0)
    return ''

  const header = `

⚠️ HARNESS VIOLATIONS (${violations.length} found, attempt ${attempt}/${maxRetries}):`
  const body = violations.map(v => v.message).join('')
  const footer = `
Fix all violations above before proceeding with other tasks.`

  return `${header} ${body} ${footer}`
}
