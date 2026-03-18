import type { Message } from '../llm/provider.js'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * 会话元数据，用于列表展示。
 * 独立于 messages 存储，list() 时不需要加载完整对话。
 */
export interface SessionMeta {
  id: string;
  cwd: string;
  model: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

/**
 * 完整会话，包含元数据和对话历史。
 */
export interface Session extends SessionMeta {
  messages: Message[];
}

/**
 * 会话存储。
 *
 * 存储结构：
 *   ~/.sage/sessions/
 *     <id>.json          — 完整会话文件
 *     _index.json        — 元数据索引（所有会话的 meta，不含 messages）
 *
 * 索引文件避免 list() 时逐个读取解析会话文件。
 * 索引与会话文件保持同步：save/delete 时同时更新索引。
 */
export class SessionStore {
  private dir: string
  private indexPath: string
  readonly session: Session

  constructor(options: { cwd: string; model: string; resumeId?: string }) {
    this.dir = path.join(os.homedir(), '.sage', 'sessions')
    this.indexPath = path.join(this.dir, '_index.json')
    this.ensureDir()

    if (options.resumeId) {
      const loaded = this.load(options.resumeId)
      if (!loaded)
        throw new Error(`Session not found: ${options.resumeId}`)
      this.session = loaded
    }
    else {
      this.session = this.createSession(options.cwd, options.model)
    }
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.dir)) {
      fs.mkdirSync(this.dir, { recursive: true })
    }
  }

  /** 加载索引文件 */
  private loadIndex(): Map<string, SessionMeta> {
    try {
      const raw = fs.readFileSync(this.indexPath, 'utf-8')
      const arr = JSON.parse(raw) as SessionMeta[]
      return new Map(arr.map(m => [m.id, m]))
    }
    catch {
      return new Map()
    }
  }

  /** 保存索引文件 */
  private saveIndex(index: Map<string, SessionMeta>): void {
    const arr = [...index.values()]
    fs.writeFileSync(this.indexPath, JSON.stringify(arr), 'utf-8')
  }

  private createSession(cwd: string, model: string): Session {
    const now = new Date().toISOString()
    return {
      id: crypto.randomUUID(),
      cwd,
      model,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      messages: [],
    }
  }

  /** 保存会话（写文件 + 更新索引） */
  save(messages: Message[]): void {
    this.session.messages = messages
    this.session.updatedAt = new Date().toISOString()
    this.session.messageCount = this.session.messages.length

    const filePath = path.join(this.dir, `${this.session.id}.json`)
    fs.writeFileSync(filePath, JSON.stringify(this.session), 'utf-8')

    const index = this.loadIndex()
    const { messages: _, ...meta } = this.session
    index.set(this.session.id, meta)
    this.saveIndex(index)
  }

  /** 加载指定会话 */
  load(id: string): Session | null {
    const filePath = path.join(this.dir, `${id}.json`)
    try {
      const raw = fs.readFileSync(filePath, 'utf-8')
      return JSON.parse(raw) as Session
    }
    catch {
      return null
    }
  }

  /** 列出所有会话的元数据，按更新时间倒序 */
  list(): SessionMeta[] {
    const index = this.loadIndex()
    return [...index.values()].toSorted(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
  }

  /** 获取最近一次会话（可选按 cwd 过滤） */
  latest(cwd?: string): SessionMeta | null {
    const all = this.list()
    if (cwd) {
      return all.find(s => s.cwd === cwd) ?? null
    }
    return all[0] ?? null
  }

  /** 删除会话 */
  delete(id: string): void {
    const filePath = path.join(this.dir, `${id}.json`)
    try {
      fs.unlinkSync(filePath)
    }
    catch {
      /* 文件不存在也没关系 */
    }

    const index = this.loadIndex()
    index.delete(id)
    this.saveIndex(index)
  }

  /** 重置为新会话（/clear 用） */
  reset(cwd: string, model: string): void {
    (this as { session: Session }).session = this.createSession(cwd, model)
  }

  resume(session: Session): void {
    (this as { session: Session }).session = session
  }
}
