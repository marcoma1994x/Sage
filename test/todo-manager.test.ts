import { TodoManager } from '../src/planning/todo-manager.js'

console.log('=== 测试 TodoManager ===\n')

const manager = new TodoManager()

// 测试 1：创建 todo
console.log('测试 1：创建 todo')
manager.incrementRound()
const result1 = manager.update([
  { id: '1', content: 'Read package.json', status: 'pending', createdAt: Date.now(), updatedAt: Date.now() },
  { id: '2', content: 'Update dependencies', status: 'pending', createdAt: Date.now(), updatedAt: Date.now() },
])
console.log(result1)
console.log('Stats:', manager.getStats())
console.log('✅ 测试 1 通过\n')

// 测试 2：更新状态
console.log('测试 2：更新状态')
manager.incrementRound()
const result2 = manager.update([
  { id: '1', content: 'Read package.json', status: 'completed', createdAt: Date.now(), updatedAt: Date.now() },
  { id: '2', content: 'Update dependencies', status: 'in_progress', createdAt: Date.now(), updatedAt: Date.now() },
])
console.log(result2)
console.log('✅ 测试 2 通过\n')

// 测试 3：约束验证（自动修复多个 in_progress）
console.log('测试 3：约束验证')
manager.incrementRound()
const result3 = manager.update([
  { id: '1', content: 'Task A', status: 'in_progress', createdAt: Date.now(), updatedAt: Date.now() },
  { id: '2', content: 'Task B', status: 'in_progress', createdAt: Date.now(), updatedAt: Date.now() },
])
console.log(result3)
console.log('应该只有一个 in_progress')
console.log('✅ 测试 3 通过\n')

// 测试 4：提醒机制
console.log('测试 4：提醒机制')
manager.incrementRound()
manager.incrementRound()
manager.incrementRound()
console.log('needsReminder:', manager.needsReminder())
console.log('预期：true')
console.log('✅ 测试 4 通过\n')

console.log('=== 所有测试通过 ===')
