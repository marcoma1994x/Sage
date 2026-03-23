import { verify } from '../src/harness/verify.js'

const code = `export function foo(x: any): any { console.log(x); return x; }`
let violations = verify(code, '../tmp/harness.ts')
console.log(violations)
console.log(violations.length === 2)
console.log(violations[0].ruleId === 'no-any-type')
console.log(violations[1].ruleId === 'no-console-log')
console.log(violations[0].message.includes('FIX:'))

const commented = `// This can accept any value
export function foo(x: string) {}`
violations = verify(commented, '../tmp/test.ts')
console.log(violations.length === 0)
