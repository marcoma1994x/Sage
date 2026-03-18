import { withRetry } from '../src/utils/retry.js'

// 模拟一个前 2 次失败、第 3 次成功的函数
function makeFlaky(failTimes: number) {
  let count = 0
  return async () => {
    count++
    if (count <= failTimes) {
      const err = new Error('Server error') as Error & { status: number }
      err.status = 500
      throw err
    }
    return `success on attempt ${count}`
  }
}

async function main() {
  // 测试 1：失败 2 次，第 3 次成功 → 应该拿到结果
  console.log('--- Test 1: recoverable ---')
  const result = await withRetry(makeFlaky(2))
  console.log(result) // "success on attempt 3"

  // 测试 2：失败 4 次，超过重试上限 → 应该抛错
  console.log('--- Test 2: exhausted ---')
  try {
    await withRetry(makeFlaky(4))
  }
  catch (e) {
    console.log(`Caught: ${(e as Error).message}`) // "Server error"
  }

  // 测试 3：不可重试的错误（401）→ 不重试，直接抛
  console.log('--- Test 3: non-retryable ---')
  try {
    await withRetry(async () => {
      const err = new Error('Unauthorized') as Error & { status: number }
      err.status = 401
      throw err
    })
  }
  catch (e) {
    console.log(`Caught: ${(e as Error).message}`) // "Unauthorized"
  }
}

main()
