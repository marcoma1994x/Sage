import { AgentLoop } from '../src/agent/agent-loop.js'
import { setupAgent } from '../src/agent/setup.js'

console.log('=== 集成测试 ===\n')

// 创建 mock provider
const mockProvider = {
  async* chatStream() {
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

let startCount = 0
let endCount = 0

agent.on('iteration:start', ({ iteration }) => {
  startCount++
  console.log(`Iteration ${iteration} started`)
})

agent.on('iteration:end', ({ iteration }) => {
  endCount++
  console.log(`Iteration ${iteration} ended`)
})

await agent.run('Read package.json')

console.log(`Start events: ${startCount}`)
console.log(`End events: ${endCount}`)
