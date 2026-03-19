# Sage README

> An educational agentic system

**⚠️ Learning Project**: This is a hands-on exploration of agent architecture, not production software.

## Project Goals

### Primary Objective

Build a functional agentic system to understand:

- How autonomous agents work internally

- What makes a good agent architecture

- How to apply software engineering principles to AI systems

### Learning Focus

- **Agent fundamentals**: Perception → Reasoning → Action loop

- **Architecture patterns**: Layered design, event-driven communication, dependency injection

- **Engineering practices**: Type safety, error handling, testing

### Non-goals

- ❌ Production-ready tool

- ❌ Feature completeness

- ❌ Performance optimization

## Features

### Core Capabilities

- ✅ **Autonomous reasoning loop** - Self-directed multi-step task execution

- ✅ **Tool calling** - Dynamic tool selection and execution

- ✅ **Context management** - Automatic context compression when approaching limits

- ✅ **Sub-agent orchestration** - Delegate complex subtasks to independent agents

- ✅ **Planning & tracking** - Built-in todo system for progress visibility

- ✅ **Session persistence** - Resume conversations across sessions

### Built-in Tools

| Tool | Purpose |
| --- | --- |
| **Read** | Read file contents |
| **Write** | Create or overwrite files |
| **Edit** | Precise string replacement in files |
| **Bash** | Execute shell commands |
| **Glob** | File pattern matching |
| **Grep** | Search file contents |
| **Task** | Delegate to sub-agent |
| **TodoWrite** | Update task list |

### CLI Commands

- `/help` - Show available commands

- `/clear` - Clear conversation

- `/sessions` - List all sessions

- `/resume <id>` - Resume a session

- `/todos` - View task list

- `/tokens` - Show token usage

- `/compact` - Manually compress context

## Architecture

### High-level Design

```plaintext
┌─────────────┐
│   App       │  CLI interface (readline, prompts)
└──────┬──────┘
       │ createAgent()
       ▼
┌─────────────────┐
│  AgentRunner    │  Presentation layer
│  - Event listeners
│  - Terminal output
│  - Session coordination
└──────┬──────────┘
       │ wraps & listens to
       ▼
┌─────────────────┐
│  AgentLoop      │  Business logic (pure)
│  - Reasoning loop
│  - Tool execution
│  - Event emission
└──────┬──────────┘
       │ uses
       ▼
┌─────────────────────────────────────┐
│  MessageManager  │  SessionStore    │
│  (runtime state) │  (persistence)   │
└──────────────────┴──────────────────┘
```

### Key Components

**AgentLoop** (`src/agent/agent-loop.ts`)

- Core reasoning loop: LLM → Tools → LLM → ...

- Emits events (no direct I/O)

- Stateless business logic

**AgentRunner** (`src/agent/agent-runner.ts`)

- Wraps AgentLoop

- Listens to events and outputs to terminal

- Coordinates session persistence

**MessageManager** (`src/context/message-manager.ts`)

- Manages conversation history in memory

- Provides checkpoint/rollback for error recovery

- Type-safe message operations

**SessionStore** (`src/memory/session-store.ts`)

- Persists conversations to disk

- Loads historical messages on startup

- Independent of runtime state

**TodoManager** (`src/planning/todo-manager.ts`)

- Tracks task progress

- Enforces constraints (one in_progress at a time)

- Reminds LLM to update todos

### Design Principles

**1. Separation of Concerns**

- Business logic (AgentLoop) ≠ Presentation (AgentRunner)

- Runtime state (MessageManager) ≠ Persistence (SessionStore)

**2. Event-driven Architecture**

- AgentLoop emits events (`llm: text`, `tool: start`, `run: complete`, etc.)

- AgentRunner listens and reacts

- Enables sub-agents to run silently (no AgentRunner wrapper)

**3. Dependency Injection**

- All dependencies passed via constructor

- Easy to test and swap implementations

## Getting Started

### Prerequisites

- Node.js >= 18

- OpenAI API key

### Installation

```bash
git clone https://github.com/marcoma1994x/Sage.git
cd Sage
npm install
echo "OPENAI_API_KEY=your-key-here" > .env
npm run dev
```

### Quick Example

```bash
> Read package.json and tell me the project name

I'll read the package.json file for you.

[Tool]: invoke tool「Read」

The project name is "sage".
```

## Project Structure

```plaintext
src/
├── agent/          # Core agent (AgentLoop, AgentRunner, factory)
├── commands/       # CLI commands (/help, /clear, etc.)
├── context/        # Message management, compaction, system prompt
├── llm/            # LLM provider abstraction (OpenAI)
├── memory/         # Session persistence
├── orchestration/  # Sub-agent (Task tool)
├── planning/       # Todo system
├── tools/          # Built-in tools (Read, Write, Edit, Bash, etc.)
└── utils/          # Helpers (retry, timeout, token counter)
```

## Learning Resources

### Recommended Reading

- [Anthropic: Building effective agents](https://www.anthropic.com/research/building-effective-agents)

- [OpenAI: Function calling](https://platform.openai.com/docs/guides/function-calling)

- [Patterns for Building LLM-based Systems](https://eugeneyan.com/writing/llm-patterns/)


## License

MIT