import { AgentLoop } from '../src/agent/agent-loop.js'
import { setupAgent } from '../src/agent/setup.js'

const mockProvider = {
  async* chatStream() {
    // 第一次调用：返回 tool_use
    yield {
      name: 'todo_write',
      type: 'tool_call_start',
    }

    // 第二次调用：返回 stop
    yield {
      type: 'done',
      result: {
        text: 'call done',
        toolCalls: [{
          id: 'call_1',
          name: 'todo_write',
          input: {
            items: [
              { id: '1', content: 'test todo write tool', status: 'pending', createdAt: Date.now(), updatedAt: Date.now() },
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

console.log('=== AgentLoop 集成测试 ===')
// 这里需要根据你的 AgentLoop 实际接口调整
await agent.run('Create a todo list')
console.log('TodoManager 状态:', todoManager.getStats())
console.log('TodoManager items:', todoManager.getItems())
