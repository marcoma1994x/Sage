/* eslint-disable e18e/prefer-static-regex */
// ============================================================
// Harness Rules
//
// Each rule is a deterministic check with agent-readable diagnostics.
// Rules do NOT call LLM. A rule either passes or fails.
//
// Error messages are written FOR the Agent — they contain specific
// remediation instructions, not human-readable error descriptions.
// This mirrors OpenAI Codex team's practice of rewriting linter
// output for agent consumption.
// ============================================================

export interface Violation {
  ruleId: string;
  /** Agent-readable remediation instruction */
  message: string;
}

export interface HarnessRule {
  id: string;
  /** Human-readable description (for logging/debugging, not sent to Agent) */
  description: string;
  /** File extensions this rule applies to. Empty = all files. */
  appliesTo: string[];
  /** Check content, return violations. Empty array = passed. */
  check: (content: string) => Violation[];
}

// ─── Helper ─────────────────────────────────────────────────

function isCommentLine(trimmed: string): boolean {
  return (
    trimmed.startsWith('//')
    || trimmed.startsWith('*')
    || trimmed.startsWith('/*')
  )
}

// ─── Rule: no-any-type ──────────────────────────────────────
// Detects TypeScript `any` used as a type annotation.
// Patterns caught: `: any`, `as any`, `<any>`, `any[]`
// Patterns ignored: `any` in variable names, comments
//
// Why this rule first:
// - Agents frequently generate `any` as a shortcut
// - Regex-checkable, no AST parser needed
// - Fix instruction is one sentence

const NO_ANY_TYPE: HarnessRule = {
  id: 'no-any-type',
  description: 'Disallow `any` type annotations in TypeScript',
  appliesTo: ['.ts', '.tsx'],

  check(content: string): Violation[] {
    const violations: Violation[] = []
    const patterns = [
      { regex: /:\s*any\b/g, context: 'type annotation' },
      { regex: /\bas\s+any\b/g, context: 'type assertion' },
      { regex: /\bany\s*\[/g, context: 'array type' },
      { regex: /\bany\s*>/g, context: 'generic parameter' },
    ]
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim()
      if (isCommentLine(trimmed))
        continue

      for (const { regex, context } of patterns) {
        regex.lastIndex = 0
        if (regex.test(lines[i])) {
          violations.push({
            ruleId: 'no-any-type',
            message: [
              `HARNESS VIOLATION [no-any-type] at line ${i + 1}:`,
              `  Found \`any\` used as ${context}: "${trimmed}"`,
              `  FIX: Replace \`any\` with a specific type, or use \`unknown\` if the type is truly indeterminate.`,
              `  If this is a third-party API with no type definition, use \`unknown\` and narrow with a type guard.`,
            ].join('\n'),
          })
          break // One violation per line
        }
      }
    }
    return violations
  },
}

// ─── Rule: no-console-log ───────────────────────────────────
// Detects `console.log(` left in production code.
// Patterns caught: `console.log(`
// Patterns ignored: comment lines, `console.warn`, `console.error`
//
// Why this rule second:
// - Agents almost always sprinkle console.log for "debugging"
// - Trivially regex-checkable
// - Orthogonal to no-any-type — validates multi-rule coexistence

const NO_CONSOLE_LOG: HarnessRule = {
  id: 'no-console-log',
  description: 'Disallow `console.log` in production code',
  appliesTo: ['.ts', '.tsx', '.js', '.jsx'],

  check(content: string): Violation[] {
    const violations: Violation[] = []
    const regex = /\bconsole\.log\s*\(/g
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim()
      if (isCommentLine(trimmed))
        continue

      regex.lastIndex = 0
      if (regex.test(lines[i])) {
        violations.push({
          ruleId: 'no-console-log',
          message: [
            `HARNESS VIOLATION [no-console-log] at line ${i + 1}:`,
            `  Found \`console.log\`: "${trimmed}"`,
            `  FIX: Remove this \`console.log\` call. If logging is needed, use a structured logger (e.g. \`logger.info()\`).`,
            `  \`console.warn\` and \`console.error\` are allowed.`,
          ].join(''),
        })
      }
    }
    return violations
  },
}

// ─── Rule Registry ──────────────────────────────────────────
// All active rules. Add new rules here as the Harness evolves.

export const HARNESS_RULES: HarnessRule[] = [NO_ANY_TYPE, NO_CONSOLE_LOG]
