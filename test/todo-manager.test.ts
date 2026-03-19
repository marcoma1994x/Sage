import { TodoManager } from '../src/planning/todo-manager.js'

const manager = new TodoManager()

// 测试 1：创建 todo
console.log('=== 测试 1：创建 todo ===')
manager.incrementRound()
const result1 = manager.update([
  { id: '1', content: 'Task A', status: 'pending', createdAt: Date.now(), updatedAt: Date.now() },
  { id: '2', content: 'Task B', status: 'pending', createdAt: Date.now(), updatedAt: Date.now() },
])
console.log(result1)
console.log('Stats:', manager.getStats())

// 测试 2：更新状态
console.log('\n=== 测试 2：更新状态 ===')
manager.incrementRound()
const result2 = manager.update([
  { id: '1', content: 'Task A', status: 'completed', createdAt: Date.now(), updatedAt: Date.now() },
  { id: '2', content: 'Task B', status: 'in_progress', createdAt: Date.now(), updatedAt: Date.now() },
])
console.log(result2)
console.log('Stats:', manager.getStats())

// 测试 3：约束验证（多个 in_progress）
console.log('\n=== 测试 3：约束验证 ===')
manager.incrementRound()
const result3 = manager.update([
  { id: '1', content: 'Task A', status: 'in_progress', createdAt: Date.now(), updatedAt: Date.now() },
  { id: '2', content: 'Task B', status: 'in_progress', createdAt: Date.now(), updatedAt: Date.now() },
])
console.log(result3)
console.log('应该只有一个 in_progress')

// 测试 4：提醒机制
console.log('\n=== 测试 4：提醒机制 ===')
manager.incrementRound()
manager.incrementRound()
manager.incrementRound()
console.log('needsReminder:', manager.needsReminder()) // 应该是 true
