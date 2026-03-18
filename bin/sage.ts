import process from 'node:process'
import { App } from '../src/app.js'
import 'dotenv/config'

const app = new App({
  modelName: process.env.MODEL_NAME ?? 'qwen-plus',
  // resumeSessionId: parseArgs().resume,  // 后续加 CLI 参数解析
})

app.run()
