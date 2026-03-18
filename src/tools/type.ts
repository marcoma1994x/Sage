export interface ToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface ToolResult {
  content: string
  isError?: boolean
}

export interface Tool {
  definition: ToolDefinition
  execute: (input: unknown) => Promise<ToolResult>
}
