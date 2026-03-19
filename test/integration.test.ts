import { AgentLoop } from '../src/agent/agent-loop.js'
import { setupAgent } from '../src/agent/setup.js'

console.log('=== 集成测试 ===\n')

// 创建 mock provider
const mockProvider = {
  async* chatStream(tools) {
    console.log('LLM 收到 system prompt（包含 todo 指南）')
    console.log('可用工具:', tools.map(t => t.name).join(', '))
    console.log('包含 todo_write:', tools.some(t => t.name === 'todo_write'))

    // 模拟 LLM 调用 todo_write
    yield {
      type: 'tool_call_start',
      name: 'todo_write',
    }

    yield {
      type: 'done',
      result: {
        text: 'I will create a todo list',
        toolCalls: [{
          id: 'call_1',
          name: 'todo_write',
          input: {
            items: [
              { id: '1', content: 'Step 1', status: 'pending', createdAt: Date.now(), updatedAt: Date.now() },
              { id: '2', content: 'Step 2', status: 'pending', createdAt: Date.now(), updatedAt: Date.now() },
            ],
          },
        }],
      },
    }
  },
}

const { tools, todoManager } = setupAgent(mockProvider as any)

const agent = new AgentLoop({
  provider: mockProvider as any,
  tools,
  todoManager,
  systemPrompt: '',
  maxIterations: 3,
})

await agent.run('Create a todo list')
console.log('TodoManager 状态:', todoManager.getStats())
console.log('TodoManager 事项:', todoManager.getItems())

console.log('\n=== 集成测试完成 ===')
