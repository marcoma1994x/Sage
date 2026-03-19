import { setupAgent } from '../src/agent/setup.js'
// 需要一个 mock provider
const mockProvider = {
  chat: async () => ({ stopReason: 'end_turn', content: [] }),
}

const { tools, todoManager } = setupAgent(mockProvider as any)

// 测试 todo_write 执行
console.log('\n=== todo_write 执行测试 ===')
const tool = tools.get('todo_write')
if (tool) {
  const result = await tool.execute({
    items: [
      {
        id: '1',
        content: 'Test task',
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ],
  })
  console.log('执行结果:', result)
  console.log('TodoManager 状态:', todoManager.getStats())
}
