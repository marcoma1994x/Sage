// test/message-manager.test.ts
import { MessageManager } from '../src/context/message-manager.js'

const manager = new MessageManager()

// 测试 1: 添加用户消息
manager.addUserMessage('hello')
console.assert(manager.getMessageCount() === 1, '❌ 消息数量应为 1')
console.assert(manager.getMessages()[0].role === 'user', '❌ 角色应为 user')
console.assert(manager.getMessages()[0].content === 'hello', '❌ 内容应为 hello')

// 测试 2: 添加 assistant 消息（无工具调用）
manager.addAssistantMessage('hi there')
console.assert(manager.getMessageCount() === 2, '❌ 消息数量应为 2')
console.assert(manager.getMessages()[1].toolCalls === undefined, '❌ 不应有 toolCalls')

// 测试 3: 添加 assistant 消息（有工具调用）
manager.addAssistantMessage('', [{ id: '1', name: 'read', input: {} }])
console.assert(manager.getMessageCount() === 3, '❌ 消息数量应为 3')
console.assert(manager.getMessages()[2].toolCalls?.length === 1, '❌ 应有 1 个 toolCall')

// 测试 4: 添加工具结果
manager.addToolResult('1', 'file content')
console.assert(manager.getMessageCount() === 4, '❌ 消息数量应为 4')
console.assert(manager.getMessages()[3].role === 'tool', '❌ 角色应为 tool')

console.log('✅ Step 1 所有测试通过')

// 测试 5: Checkpoint 创建和回滚
const manager2 = new MessageManager()
manager2.addUserMessage('msg1')
manager2.addUserMessage('msg2')
manager2.createCheckpoint('cp1')

manager2.addUserMessage('msg3')
console.assert(manager2.getMessageCount() === 3, '❌ 应有 3 条消息')

const rollbackSuccess = manager2.rollback('cp1')
console.assert(rollbackSuccess === true, '❌ 回滚应成功')
console.assert(manager2.getMessageCount() === 2, '❌ 回滚后应有 2 条消息')

// 测试 6: 回滚到不存在的 checkpoint
const rollbackFail = manager2.rollback('nonexistent')
console.assert(rollbackFail === false, '❌ 回滚不存在的 checkpoint 应返回 false')

// 测试 7: 清除 checkpoint
manager2.createCheckpoint('cp2')
manager2.clearCheckpoint('cp2')
const rollbackAfterClear = manager2.rollback('cp2')
console.assert(rollbackAfterClear === false, '❌ 清除后的 checkpoint 应无法回滚')

// 测试 8: setMessages 批量设置
manager2.setMessages([
  { role: 'user', content: 'new1' },
  { role: 'assistant', content: 'new2' },
])
console.assert(manager2.getMessageCount() === 2, '❌ setMessages 后应有 2 条消息')
console.assert(manager2.getMessages()[0].content === 'new1', '❌ 第一条消息内容错误')

// 测试 9: clear 清空
manager2.clear()
console.assert(manager2.getMessageCount() === 0, '❌ clear 后应为空')

console.log('✅ Step 2 所有测试通过')
